import { casa, LINHAS_DRE, type LinhaDre } from "../contabil/relatorios";
import type { PartidaContabil } from "../contabil/tipos";

// Orçamento × realizado. Tudo no sinal da DRE (receita positiva, custeio e
// despesas negativos): assim `realizado − orçado` positivo é sempre favorável,
// seja receita acima do previsto ou gasto abaixo.

export const LINHAS_ORCAMENTO = Object.keys(LINHAS_DRE) as LinhaDre[];

export const ehLinhaOrcamento = (v: string): v is LinhaDre => (LINHAS_ORCAMENTO as string[]).includes(v);

/** Sinal para a digitação: o sócio digita receitas e gastos positivos. */
export const SINAL: Record<LinhaDre, 1 | -1> = Object.fromEntries(
  LINHAS_ORCAMENTO.map((l) => [l, l.startsWith("receita") || l === "outrasReceitas" || l === "resultadoNaoOperacional" ? 1 : -1]),
) as Record<LinhaDre, 1 | -1>;

/** 12 valores (jan–dez) por linha da DRE, em centavos. */
export type Matriz = Record<LinhaDre, number[]>;

export const matrizVazia = (): Matriz => Object.fromEntries(LINHAS_ORCAMENTO.map((l) => [l, Array(12).fill(0)])) as Matriz;

/** Realizado de cada linha da DRE, mês a mês, no ano pedido. */
export function realizadoMensal(partidas: PartidaContabil[], ano: number): Matriz {
  const m = matrizVazia();
  const prefixo = `${ano}-`;
  for (const p of partidas) {
    if (!p.data.startsWith(prefixo)) continue;
    const mes = Number(p.data.slice(5, 7)) - 1;
    for (const l of LINHAS_ORCAMENTO) if (casa(p, LINHAS_DRE[l].filtro)) m[l][mes] -= p.valorCentavos;
  }
  return m;
}

export const TOTAIS = ["totalReceita", "totalCusteio", "margemContribuicao", "totalDespesas", "resultado"] as const;
export type Total = (typeof TOTAIS)[number];

/** Subtotais da DRE, mês a mês (mesma composição de dreAnual). */
export function totaisMensais(m: Matriz): Record<Total, number[]> {
  const mes = (f: (i: number) => number) => Array.from({ length: 12 }, (_, i) => f(i));
  const totalReceita = mes((i) => m.receitaCafe[i] + m.receitaMaracuja[i] + m.receitaPecuaria[i] + m.outrasReceitas[i]);
  const totalCusteio = mes((i) => m.custeioCafe[i] + m.custeioMaracuja[i] + m.custeioMilho[i] + m.custeioPecuaria[i] + m.custeioGeral[i]);
  const margemContribuicao = mes((i) => totalReceita[i] + totalCusteio[i]);
  const totalDespesas = mes((i) => m.despesasAdministrativas[i] + m.despesasFinanceiras[i]);
  const resultado = mes((i) => margemContribuicao[i] + totalDespesas[i] + m.resultadoNaoOperacional[i]);
  return { totalReceita, totalCusteio, margemContribuicao, totalDespesas, resultado };
}

/** Soma de janeiro até o mês `ate` (1–12; 0 = nada). */
export const somaAte = (valores: number[], ate: number) => valores.slice(0, ate).reduce((s, v) => s + v, 0);

/** Divide um total em 12 meses iguais, em centavos; a sobra vai, 1 centavo por mês, para os primeiros meses. */
export function distribuir(total: number): number[] {
  const base = Math.trunc(total / 12);
  const sobra = total - base * 12;
  return Array.from({ length: 12 }, (_, i) => base + (i < Math.abs(sobra) ? Math.sign(sobra) : 0));
}

/** Matriz multiplicada por (1 + pct/100), arredondada ao real inteiro. */
export function ajustar(m: Matriz, pct: number): Matriz {
  const fator = 1 + pct / 100;
  return Object.fromEntries(LINHAS_ORCAMENTO.map((l) => [l, m[l].map((v) => Math.round((v * fator) / 100) * 100)])) as Matriz;
}

/** Último mês fechado ou em andamento para comparar: ano passado → 12; ano futuro → 0. */
export function mesDeCorte(ano: number, hoje: string): number {
  const anoHoje = Number(hoje.slice(0, 4));
  if (ano < anoHoje) return 12;
  if (ano > anoHoje) return 0;
  return Number(hoje.slice(5, 7));
}

export type Comparacao = { orcado: number; realizado: number; desvio: number; pct: number | null };

/** Desvio favorável quando positivo; `pct` relativo ao valor orçado (null se nada foi orçado). */
export function comparar(orcado: number, realizado: number): Comparacao {
  const desvio = realizado - orcado;
  return { orcado, realizado, desvio, pct: orcado === 0 ? null : desvio / Math.abs(orcado) };
}
