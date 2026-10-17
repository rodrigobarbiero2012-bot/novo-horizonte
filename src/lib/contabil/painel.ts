import type { Atividade, PartidaContabil } from "./tipos";

// Números do painel. Todos em centavos, com a convenção "positivo é bom de
// ler": receita, custo e aporte aparecem positivos; resultado tem sinal.
// Períodos são inclusivos, datas ISO (yyyy-mm-dd).

type Periodo = { inicio: string; fim: string };

const dentro = (p: PartidaContabil, { inicio, fim }: Periodo) => p.data >= inicio && p.data <= fim;

/** Mesmo dia um ano antes (29/02 vira 28/02). */
export function umAnoAntes(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  const dia = m === 2 && d === 29 ? 28 : d;
  return `${a - 1}-${String(m).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export type Resumo = {
  receita: number;
  custeio: number;
  despesas: number; // administrativas + financeiras
  resultado: number; // inclui o não operacional, como na DRE
  aportesSocio: number; // líquido: aportes − retiradas na CC do sócio
};

export function resumoPeriodo(partidas: PartidaContabil[], periodo: Periodo): Resumo {
  const r = { receita: 0, custeio: 0, despesas: 0, naoOperacional: 0, aportesSocio: 0 };
  for (const p of partidas) {
    if (!dentro(p, periodo)) continue;
    switch (p.categoria) {
      case "Receita":
        r.receita -= p.valorCentavos;
        break;
      case "Custeio":
        r.custeio += p.valorCentavos;
        break;
      case "Despesa Administrativa":
      case "Despesa Financeira":
        r.despesas += p.valorCentavos;
        break;
      case "Receita Não Operacional":
        r.naoOperacional -= p.valorCentavos;
        break;
      case "PL Capital Sócio":
        r.aportesSocio -= p.valorCentavos;
        break;
    }
  }
  return {
    receita: r.receita,
    custeio: r.custeio,
    despesas: r.despesas,
    resultado: r.receita - r.custeio - r.despesas + r.naoOperacional,
    aportesSocio: r.aportesSocio,
  };
}

export type MixAtividade = { atividade: Atividade; receita: number; custeio: number; margem: number };

/** Receita, custeio direto e margem por atividade; custeio "Geral" e despesas ficam em naoAlocado. */
export function mixAtividades(partidas: PartidaContabil[], periodo: Periodo): { atividades: MixAtividade[]; naoAlocado: number } {
  const porAtividade = new Map<Atividade, MixAtividade>();
  let naoAlocado = 0;
  for (const p of partidas) {
    if (!dentro(p, periodo)) continue;
    const ehReceita = p.categoria === "Receita" && p.atividade !== "Geral";
    const ehCusteioDireto = p.categoria === "Custeio" && p.atividade !== "Geral";
    if (ehReceita || ehCusteioDireto) {
      const m = porAtividade.get(p.atividade) ?? { atividade: p.atividade, receita: 0, custeio: 0, margem: 0 };
      if (ehReceita) m.receita -= p.valorCentavos;
      else m.custeio += p.valorCentavos;
      m.margem = m.receita - m.custeio;
      porAtividade.set(p.atividade, m);
    } else if (p.categoria === "Custeio" || p.categoria === "Despesa Administrativa" || p.categoria === "Despesa Financeira") {
      naoAlocado += p.valorCentavos;
    }
  }
  const atividades = [...porAtividade.values()].sort((a, b) => b.receita + b.custeio - (a.receita + a.custeio));
  return { atividades, naoAlocado };
}

export type CustoConta = { conta: string; valor: number; anterior: number };

/** Maiores contas de custeio e despesa no período, com o valor do período de comparação. */
export function maioresCustos(partidas: PartidaContabil[], atual: Periodo, anterior: Periodo, quantos = 5): CustoConta[] {
  const contas = new Map<string, CustoConta>();
  for (const p of partidas) {
    if (!p.conta || !["Custeio", "Despesa Administrativa", "Despesa Financeira"].includes(p.categoria)) continue;
    const noAtual = dentro(p, atual);
    const noAnterior = dentro(p, anterior);
    if (!noAtual && !noAnterior) continue;
    const c = contas.get(p.conta) ?? { conta: p.conta, valor: 0, anterior: 0 };
    if (noAtual) c.valor += p.valorCentavos;
    if (noAnterior) c.anterior += p.valorCentavos;
    contas.set(p.conta, c);
  }
  return [...contas.values()].sort((a, b) => b.valor - a.valor).slice(0, quantos);
}

export type Mes = { mes: string; receitas: number; gastos: number; aportesSocio: number }; // mes = "yyyy-mm"

/** Os 12 meses terminando em `ultimoMes` (inclusive): receitas × gastos operacionais e aportes do sócio. */
export function ultimos12Meses(partidas: PartidaContabil[], ultimoMes: string): Mes[] {
  const [a, m] = ultimoMes.split("-").map(Number);
  const meses = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(a, m - 12 + i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  const porMes = new Map(meses.map((mes) => [mes, { mes, receitas: 0, gastos: 0, aportesSocio: 0 }]));
  for (const p of partidas) {
    const linha = porMes.get(p.data.slice(0, 7));
    if (!linha) continue;
    if (p.categoria === "Receita") linha.receitas -= p.valorCentavos;
    else if (p.categoria === "Custeio" || p.categoria === "Despesa Administrativa" || p.categoria === "Despesa Financeira")
      linha.gastos += p.valorCentavos;
    else if (p.categoria === "PL Capital Sócio") linha.aportesSocio -= p.valorCentavos;
  }
  return meses.map((mes) => porMes.get(mes)!);
}

/** Saldo devedor de empréstimos e financiamentos até a data (positivo). */
export function dividaEm(partidas: PartidaContabil[], data: string): number {
  let saldo = 0;
  for (const p of partidas) if (p.categoria === "Passivo Empréstimo" && p.data <= data) saldo -= p.valorCentavos;
  return saldo;
}

/** Variação percentual; null quando a base é zero (não dá para comparar). */
export function variacao(atual: number, anterior: number): number | null {
  return anterior === 0 ? null : (atual - anterior) / Math.abs(anterior);
}
