// Regras de contas a pagar e a receber, sem banco: parcelamento, faixas de
// vencimento, partidas da baixa e projeção do caixa. Valores em centavos,
// datas ISO (yyyy-mm-dd).

export type TipoTitulo = "PAGAR" | "RECEBER";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const diaUTC = (s: string) => new Date(`${s}T00:00:00Z`);
const somarDias = (s: string, dias: number) => iso(new Date(diaUTC(s).getTime() + dias * 86_400_000));

/** Mesmo dia `meses` depois; se o mês não tem o dia (31/02), usa o último dia do mês. */
export function somarMeses(s: string, meses: number): string {
  const [a, m, d] = s.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(a, m - 1 + meses + 1, 0)).getUTCDate();
  return iso(new Date(Date.UTC(a, m - 1 + meses, Math.min(d, ultimoDia))));
}

/** Divide o total em n parcelas mensais; a diferença de centavos fica na primeira. */
export function gerarParcelas(totalCentavos: number, n: number, primeiroVencimento: string) {
  const base = Math.floor(totalCentavos / n);
  const resto = totalCentavos - base * n;
  return Array.from({ length: n }, (_, i) => ({
    parcela: i + 1,
    valorCentavos: base + (i === 0 ? resto : 0),
    vencimento: somarMeses(primeiroVencimento, i),
  }));
}

export type Faixa = "vencido" | "semana" | "mes" | "depois";

export const FAIXAS: { faixa: Faixa; rotulo: string }[] = [
  { faixa: "vencido", rotulo: "Vencidos" },
  { faixa: "semana", rotulo: "Próximos 7 dias" },
  { faixa: "mes", rotulo: "Próximos 30 dias" },
  { faixa: "depois", rotulo: "Depois" },
];

export function faixaDoVencimento(vencimento: string, hoje: string): Faixa {
  if (vencimento < hoje) return "vencido";
  if (vencimento <= somarDias(hoje, 7)) return "semana";
  if (vencimento <= somarDias(hoje, 30)) return "mes";
  return "depois";
}

/**
 * Partidas do lançamento gerado na baixa (débito positivo, crédito negativo).
 * A pagar: debita a conta do título (despesa, custo, passivo) e credita a de pagamento.
 * A receber: debita a conta de recebimento e credita a do título (receita).
 */
/**
 * Pernas do lançamento da baixa. Parcela de financiamento (`juros`): a parte
 * de amortização debita a conta do título (passivo do empréstimo) e a parte
 * de juros, a conta de despesa financeira.
 */
export function partidasDaBaixa(
  tipo: TipoTitulo,
  contaTituloId: string,
  contaBaixaId: string,
  valorCentavos: number,
  juros?: { contaJurosId: string; jurosCentavos: number },
) {
  if (tipo === "PAGAR" && juros && juros.jurosCentavos > 0) {
    return [
      ...(valorCentavos - juros.jurosCentavos !== 0 ? [{ contaId: contaTituloId, valorCentavos: valorCentavos - juros.jurosCentavos }] : []),
      { contaId: juros.contaJurosId, valorCentavos: juros.jurosCentavos },
      { contaId: contaBaixaId, valorCentavos: -valorCentavos },
    ];
  }
  return tipo === "PAGAR"
    ? [
        { contaId: contaTituloId, valorCentavos },
        { contaId: contaBaixaId, valorCentavos: -valorCentavos },
      ]
    : [
        { contaId: contaBaixaId, valorCentavos },
        { contaId: contaTituloId, valorCentavos: -valorCentavos },
      ];
}

export type SemanaProjetada = { inicio: string; fim: string; entradas: number; saidas: number; saldoFinal: number };

/**
 * Caixa projetado por semana (segunda a domingo), a partir de hoje. Títulos
 * vencidos e ainda abertos entram na primeira semana — é dinheiro que precisa
 * sair (ou entrar) já.
 */
export function projecaoSemanal(
  titulos: { tipo: TipoTitulo; valorCentavos: number; vencimento: string }[],
  saldoInicial: number,
  hoje: string,
  semanas = 12,
): SemanaProjetada[] {
  const diaSemana = (diaUTC(hoje).getUTCDay() + 6) % 7; // 0 = segunda
  const primeiraSegunda = somarDias(hoje, -diaSemana);
  const resultado: SemanaProjetada[] = [];
  let saldo = saldoInicial;
  for (let i = 0; i < semanas; i++) {
    const inicio = somarDias(primeiraSegunda, i * 7);
    const fim = somarDias(inicio, 6);
    let entradas = 0;
    let saidas = 0;
    for (const t of titulos) {
      const naSemana = i === 0 ? t.vencimento <= fim : t.vencimento >= inicio && t.vencimento <= fim;
      if (!naSemana) continue;
      if (t.tipo === "RECEBER") entradas += t.valorCentavos;
      else saidas += t.valorCentavos;
    }
    saldo += entradas - saidas;
    resultado.push({ inicio, fim, entradas, saidas, saldoFinal: saldo });
  }
  return resultado;
}
