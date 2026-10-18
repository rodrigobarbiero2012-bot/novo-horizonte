import type { Atividade, PartidaContabil } from "../contabil/tipos";

// Resultado gerencial por atividade: além da receita e do custeio direto de
// cada atividade, distribui entre elas o que é comum (custeio geral, despesas
// administrativas e financeiras, outras receitas e a depreciação dos bens de
// uso geral) por um critério escolhido. Valores em centavos, positivos para
// receita e para custo; o resultado tem sinal.

export const ATIVIDADES_RATEIO = ["Café", "Maracujá", "Milho", "Pecuária"] as const;
export type AtividadeRateio = (typeof ATIVIDADES_RATEIO)[number];
export const ehAtividadeRateio = (a: string): a is AtividadeRateio => (ATIVIDADES_RATEIO as readonly string[]).includes(a);

export const CRITERIOS = {
  receita: "Proporcional à receita",
  custeio: "Proporcional ao custeio direto",
  manual: "Percentuais definidos",
} as const;
export type Criterio = keyof typeof CRITERIOS;
export const ehCriterio = (c: unknown): c is Criterio => typeof c === "string" && c in CRITERIOS;

type PorAtividade = Record<AtividadeRateio, number>;
const zeros = (): PorAtividade => ({ Café: 0, Maracujá: 0, Milho: 0, Pecuária: 0 });

/** Pesos (somam 1) pelo critério; null quando a base é zero (nada para ratear proporcionalmente). */
export function pesos(criterio: Criterio, receita: PorAtividade, custeio: PorAtividade, manual: PorAtividade): PorAtividade | null {
  const base = criterio === "receita" ? receita : criterio === "custeio" ? custeio : manual;
  const positivos = ATIVIDADES_RATEIO.map((a) => Math.max(base[a], 0));
  const total = positivos.reduce((s, v) => s + v, 0);
  if (total <= 0) return null;
  return Object.fromEntries(ATIVIDADES_RATEIO.map((a, i) => [a, positivos[i] / total])) as PorAtividade;
}

/** Divide um valor pelos pesos, em centavos inteiros; a sobra do arredondamento vai para a atividade de maior peso. */
export function ratear(valor: number, p: PorAtividade): PorAtividade {
  const r = zeros();
  for (const a of ATIVIDADES_RATEIO) r[a] = Math.round(valor * p[a]);
  const maior = ATIVIDADES_RATEIO.reduce((m, a) => (p[a] > p[m] ? a : m));
  r[maior] += valor - ATIVIDADES_RATEIO.reduce((s, a) => s + r[a], 0);
  return r;
}

export type Comuns = {
  custeioGeral: number;
  despesasAdministrativas: number;
  despesasFinanceiras: number;
  outrasReceitas: number; // positiva; reduz o custo comum
  depreciacaoGeral: number; // dos bens sem atividade (máquinas, prédios, veículos...)
};

export type ResultadoAtividades = {
  receita: PorAtividade;
  custeio: PorAtividade;
  depreciacaoDireta: PorAtividade; // bens de uma atividade só (ex.: reforma do cafezal)
  margemDireta: PorAtividade;
  comuns: Comuns;
  pesos: PorAtividade | null;
  rateado: Record<keyof Comuns, PorAtividade>;
  resultado: PorAtividade;
};

/**
 * Receita, custeio direto e custos comuns do ano. `depreciacao` é a do ano por
 * atividade do bem ("N/A" = uso geral, entra no rateio).
 */
export function resultadoPorAtividade(
  partidas: PartidaContabil[],
  ano: number,
  criterio: Criterio,
  manual: PorAtividade,
  depreciacao: { atividade: Atividade; valor: number }[],
): ResultadoAtividades {
  const receita = zeros();
  const custeio = zeros();
  const comuns: Comuns = { custeioGeral: 0, despesasAdministrativas: 0, despesasFinanceiras: 0, outrasReceitas: 0, depreciacaoGeral: 0 };
  const prefixo = `${ano}-`;
  for (const p of partidas) {
    if (!p.data.startsWith(prefixo)) continue;
    if (p.categoria === "Receita") {
      if (ehAtividadeRateio(p.atividade)) receita[p.atividade] -= p.valorCentavos;
      else comuns.outrasReceitas -= p.valorCentavos;
    } else if (p.categoria === "Custeio") {
      if (ehAtividadeRateio(p.atividade)) custeio[p.atividade] += p.valorCentavos;
      else comuns.custeioGeral += p.valorCentavos;
    } else if (p.categoria === "Despesa Administrativa") comuns.despesasAdministrativas += p.valorCentavos;
    else if (p.categoria === "Despesa Financeira") comuns.despesasFinanceiras += p.valorCentavos;
  }
  const depreciacaoDireta = zeros();
  for (const d of depreciacao) {
    if (ehAtividadeRateio(d.atividade)) depreciacaoDireta[d.atividade] += d.valor;
    else comuns.depreciacaoGeral += d.valor;
  }

  const margemDireta = zeros();
  for (const a of ATIVIDADES_RATEIO) margemDireta[a] = receita[a] - custeio[a] - depreciacaoDireta[a];
  const p = pesos(criterio, receita, custeio, manual);
  const rateado = Object.fromEntries(
    (Object.keys(comuns) as (keyof Comuns)[]).map((k) => [k, p ? ratear(comuns[k], p) : zeros()]),
  ) as Record<keyof Comuns, PorAtividade>;
  const resultado = zeros();
  for (const a of ATIVIDADES_RATEIO) {
    resultado[a] =
      margemDireta[a] -
      rateado.custeioGeral[a] -
      rateado.despesasAdministrativas[a] -
      rateado.despesasFinanceiras[a] -
      rateado.depreciacaoGeral[a] +
      rateado.outrasReceitas[a];
  }
  return { receita, custeio, depreciacaoDireta, margemDireta, comuns, pesos: p, rateado, resultado };
}
