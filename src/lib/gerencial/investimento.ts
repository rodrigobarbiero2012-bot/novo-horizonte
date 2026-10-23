import { ehEstoqueAnimais } from "../contabil/painel";
import type { Atividade, PartidaContabil } from "../contabil/tipos";
import { depreciacaoNoAno, type Camada } from "./depreciacao";
import { ATIVIDADES_RATEIO, ehAtividadeRateio, resultadoPorAtividade, type AtividadeRateio, type Criterio } from "./rateio";

// Análise de investimento por cultivo: resultado ano a ano, capital investido
// e retorno sobre esse capital. Valores em centavos.
//
// Decisões do Rodrigo (23/10/2026):
//  - Investimento de uso geral (máquinas, prédios, terra, veículos) é 100% do
//    café — e, por coerência, a depreciação desses bens também.
//  - O capital do café hoje é o valor de mercado do sítio "porteira fechada"
//    (terra, lavouras e máquinas) informado por ele, no lugar do valor contábil
//    desses bens. Na TIR, o ponto de partida é o que foi efetivamente investido
//    (aportes, pela contabilidade) e o de chegada é o valor de mercado: a
//    valorização do sítio entra no retorno.

export const DESTINO_INVESTIMENTO_GERAL: AtividadeRateio = "Café";

/**
 * Gastos lançados como custeio que, na análise, são investimento (formação de
 * lavoura): saem do custeio e entram como capital do cultivo no ano do gasto,
 * sem depreciação. Decisão do Rodrigo (23/10/2026): só o "Custeio Geral -
 * Maracujá" de 2026, que inclui o material da nova área.
 */
export const CUSTEIO_COMO_INVESTIMENTO: { conta: string; ano: number; cultivo: AtividadeRateio }[] = [
  { conta: "Custeio Geral - Maracujá", ano: 2026, cultivo: "Maracujá" },
];

/** Cultivo que recebe a partida como investimento, se ela for um custeio reclassificado. */
export const investimentoEmCusteio = (p: PartidaContabil): AtividadeRateio | null =>
  (p.categoria === "Custeio" && CUSTEIO_COMO_INVESTIMENTO.find((c) => c.conta === p.conta && p.data.startsWith(`${c.ano}-`))?.cultivo) || null;

type Por = Record<AtividadeRateio, number>;
const zeros = (): Por => ({ Café: 0, Maracujá: 0, Milho: 0, Pecuária: 0 });

export type AnoCultivo = {
  ano: number;
  receita: number;
  custeio: number;
  margemDireta: number; // receita − custeio − depreciação dos bens do cultivo
  resultado: number; // margem direta − custos comuns rateados
  depreciacao: number;
  investimento: number; // imobilizado comprado (no gado, animais; custeio reclassificado como formação) no ano
  capital: number; // imobilizado líquido de depreciação (+ rebanho e formação de lavoura) em 31/12
  /** Caixa da operação no ano: resultado + depreciação − investimento. */
  caixa: number;
};

export type TaxaImobilizado = { nome: string; atividade: string; taxa: number };

/** Cultivo dono de uma conta de imobilizado: o da conta ou, se for de uso geral, o destino do investimento geral. */
export const donoDoBem = (atividade: string): AtividadeRateio => (ehAtividadeRateio(atividade) ? atividade : DESTINO_INVESTIMENTO_GERAL);

/** Série anual por cultivo, para os anos pedidos (em ordem crescente). */
export function serieInvestimento(
  partidas: PartidaContabil[],
  anos: number[],
  taxas: TaxaImobilizado[],
  criterio: Criterio,
  manual: Por,
): Record<AtividadeRateio, AnoCultivo[]> {
  const camadas = new Map<string, Camada[]>();
  for (const p of partidas) {
    if (p.categoria !== "Ativo Imobilizado" || !p.conta) continue;
    camadas.set(p.conta, [...(camadas.get(p.conta) ?? []), { data: p.data, valorCentavos: p.valorCentavos }]);
  }
  const serie = Object.fromEntries(ATIVIDADES_RATEIO.map((a) => [a, [] as AnoCultivo[]])) as Record<AtividadeRateio, AnoCultivo[]>;
  // O resultado sai sem o custeio reclassificado como investimento.
  const operacionais = partidas.filter((p) => !investimentoEmCusteio(p));

  for (const ano of [...anos].sort((x, y) => x - y)) {
    const depreciacao = zeros();
    const liquido = zeros();
    for (const t of taxas) {
      const d = depreciacaoNoAno(camadas.get(t.nome) ?? [], t.taxa, ano);
      depreciacao[donoDoBem(t.atividade)] += d.doAno;
      liquido[donoDoBem(t.atividade)] += d.liquido;
    }
    // Depreciação já atribuída ao dono do bem: nada de "uso geral" sobra para o rateio.
    const r = resultadoPorAtividade(
      operacionais,
      ano,
      criterio,
      manual,
      ATIVIDADES_RATEIO.map((a) => ({ atividade: a as Atividade, valor: depreciacao[a] })),
    );
    const investimento = zeros();
    const semDepreciacao = zeros(); // rebanho e formação de lavoura vinda do custeio
    for (const p of partidas) {
      const a = Number(p.data.slice(0, 4));
      if (a > ano) continue;
      if (p.categoria === "Ativo Imobilizado" && a === ano) investimento[donoDoBem(p.atividade)] += p.valorCentavos;
      const cultivo = ehEstoqueAnimais(p) ? "Pecuária" : investimentoEmCusteio(p);
      if (cultivo) {
        semDepreciacao[cultivo] += p.valorCentavos;
        if (a === ano) investimento[cultivo] += p.valorCentavos;
      }
    }
    for (const a of ATIVIDADES_RATEIO) {
      serie[a].push({
        ano,
        receita: r.receita[a],
        custeio: r.custeio[a],
        margemDireta: r.margemDireta[a],
        resultado: r.resultado[a],
        depreciacao: depreciacao[a],
        investimento: investimento[a],
        capital: liquido[a] + semDepreciacao[a],
        caixa: r.resultado[a] + depreciacao[a] - investimento[a],
      });
    }
  }
  return serie;
}

/**
 * Taxa interna de retorno de fluxos anuais (o primeiro no instante zero).
 * Com aportes e retiradas alternados pode haver mais de uma raiz: fica a mais
 * próxima de zero. Null se não houver troca de sinal.
 */
export function tir(fluxos: number[]): number | null {
  if (!fluxos.some((f) => f < 0) || !fluxos.some((f) => f > 0)) return null;
  const vpl = (taxa: number) => fluxos.reduce((s, f, i) => s + f / (1 + taxa) ** i, 0);
  const raizes: number[] = [];
  const pontos = [-0.95, -0.9, -0.8, -0.7, -0.6, -0.5, -0.4, -0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10];
  for (let k = 0; k < pontos.length - 1; k++) {
    let baixo = pontos[k];
    let alto = pontos[k + 1];
    if (Math.sign(vpl(baixo)) === Math.sign(vpl(alto))) continue;
    for (let i = 0; i < 100; i++) {
      const meio = (baixo + alto) / 2;
      if (Math.sign(vpl(meio)) === Math.sign(vpl(baixo))) baixo = meio;
      else alto = meio;
    }
    raizes.push((baixo + alto) / 2);
  }
  return raizes.length ? raizes.reduce((m, r) => (Math.abs(r) < Math.abs(m) ? r : m)) : null;
}

export type ResumoCultivo = {
  anos: number; // anos completos considerados
  resultadoAcumulado: number;
  margemDiretaAcumulada: number;
  receitaAcumulada: number;
  investimentoAcumulado: number;
  caixaAcumulado: number; // resultado + depreciação − investimento, somados
  margemMedia: number | null; // resultado acumulado ÷ receita acumulada
  capitalHoje: number; // valor de mercado informado ou, sem ele, o capital contábil do fim do último ano
  /** Resultado médio dos últimos 3 anos ÷ capital de hoje. */
  retornoRecente: number | null;
  /** TIR do período: caixa de cada ano (inclui os investimentos) → capital final (a mercado, se informado). */
  tir: number | null;
};

/**
 * Resumo do período (só anos completos). `mercado` = valor de mercado dos bens
 * do cultivo hoje (centavos), que substitui o capital contábil no fim; 0
 * quando não informado.
 */
export function resumirCultivo(serie: AnoCultivo[], mercado = 0): ResumoCultivo | null {
  if (!serie.length) return null;
  const soma = (f: (a: AnoCultivo) => number) => serie.reduce((s, a) => s + f(a), 0);
  const ultimo = serie.at(-1)!;
  const receitaAcumulada = soma((a) => a.receita);
  const resultadoAcumulado = soma((a) => a.resultado);
  const capitalHoje = mercado > 0 ? mercado : ultimo.capital;
  const recentes = serie.slice(-3);
  const mediaRecente = recentes.reduce((s, a) => s + a.resultado, 0) / recentes.length;
  // O dinheiro entra pelos investimentos de cada ano (no caixa); no último ano, mais o capital que ficou.
  const fluxos = [0, ...serie.map((a, i) => a.caixa + (i === serie.length - 1 ? capitalHoje : 0))];
  const investimentoAcumulado = soma((a) => a.investimento);
  return {
    anos: serie.length,
    resultadoAcumulado,
    margemDiretaAcumulada: soma((a) => a.margemDireta),
    receitaAcumulada,
    investimentoAcumulado,
    caixaAcumulado: soma((a) => a.caixa),
    margemMedia: receitaAcumulada > 0 ? resultadoAcumulado / receitaAcumulada : null,
    capitalHoje,
    retornoRecente: capitalHoje > 0 ? mediaRecente / capitalHoje : null,
    // Sem capital próprio (nada investido nem valor de mercado), "retorno sobre o investimento" não tem base.
    tir: investimentoAcumulado > 0 || mercado > 0 ? tir(fluxos) : null,
  };
}

export type AnoSocios = { ano: number; aportes: number; retiradas: number; patrimonio: number };

/**
 * Dinheiro dos sócios no sítio inteiro: aportes e retiradas (conta PL Capital
 * Sócio) e o patrimônio líquido contábil no fim de cada ano.
 */
export function serieSocios(partidas: PartidaContabil[], anos: number[], patrimonio: Map<number, number>): AnoSocios[] {
  return [...anos]
    .sort((x, y) => x - y)
    .map((ano) => {
      let aportes = 0;
      let retiradas = 0;
      for (const p of partidas) {
        if (p.categoria !== "PL Capital Sócio" || !p.data.startsWith(`${ano}-`)) continue;
        if (p.valorCentavos < 0) aportes -= p.valorCentavos;
        else retiradas += p.valorCentavos;
      }
      return { ano, aportes, retiradas, patrimonio: patrimonio.get(ano) ?? 0 };
    });
}

/**
 * TIR do dinheiro dos sócios: começa com o patrimônio do fim do 1º ano, depois
 * aportes (saída) e retiradas (entrada) de cada ano, e termina com o patrimônio
 * do último ano. Para a versão a mercado, só o último ano vem com o patrimônio
 * a mercado (ver `patrimonioAMercado`): o início é o que foi aportado.
 */
export function tirSocios(serie: AnoSocios[]): number | null {
  if (serie.length < 2) return null;
  const [inicio, ...resto] = serie;
  return tir([-inicio.patrimonio, ...resto.map((a, i) => a.retiradas - a.aportes + (i === resto.length - 1 ? a.patrimonio : 0))]);
}

/**
 * Patrimônio com o sítio porteira fechada a mercado: tira o imobilizado
 * contábil (terra, lavouras, máquinas pelo custo) e põe o valor de mercado.
 */
export const patrimonioAMercado = (patrimonioContabil: number, imobilizadoContabil: number, mercado: number) =>
  patrimonioContabil - imobilizadoContabil + mercado;

// ---------------- Comparação com o CDI ----------------

/** Fator do CDI no ano (produto dos meses); null se faltar algum mês. */
export function fatorCdiAno(mensal: Record<string, number>, ano: number): number | null {
  let f = 1;
  for (let m = 1; m <= 12; m++) {
    const v = mensal[`${ano}-${String(m).padStart(2, "0")}`];
    if (v === undefined) return null;
    f *= 1 + v / 100;
  }
  return f;
}

/** CDI médio ao ano entre `de` e `ate` (anos inteiros); null se faltar dado. */
export function cdiMedioAnual(mensal: Record<string, number>, de: number, ate: number): number | null {
  let f = 1;
  for (let a = de; a <= ate; a++) {
    const fa = fatorCdiAno(mensal, a);
    if (fa === null) return null;
    f *= fa;
  }
  return f ** (1 / (ate - de + 1)) - 1;
}

/**
 * Quanto valeria em 31/12 de `ate` o dinheiro aplicado no CDI: cada valor
 * (positivo = aplicado, negativo = resgatado) entra em 31/12 do seu ano, como
 * na TIR anual. Null se faltar CDI de algum ano.
 */
export function valorNoCdi(aplicacoes: { ano: number; valor: number }[], mensal: Record<string, number>, ate: number): number | null {
  let total = 0;
  for (const { ano, valor } of aplicacoes) {
    let f = 1;
    for (let a = ano + 1; a <= ate; a++) {
      const fa = fatorCdiAno(mensal, a);
      if (fa === null) return null;
      f *= fa;
    }
    total += valor * f;
  }
  return Math.round(total);
}
