import "server-only";
import { cache } from "react";
import { prisma } from "./db";
import { carregarPartidas } from "./contabil/repositorio";
import { CHAVES_PRODUTO, type ChaveProduto } from "./cotacoes/produtos";
import { anoSP } from "./hoje";

/** Partidas do razão inteiro, uma vez por requisição. ~10 mil linhas: cabe em memória sem esforço. */
export const partidasDoRazao = cache(() => carregarPartidas(prisma));

/** Do primeiro ano com movimento até o ano atual (ou o último lançamento, se for posterior). */
export async function anosComMovimento(): Promise<number[]> {
  const [primeiro, ultimo] = await Promise.all([
    prisma.partida.findFirst({ orderBy: { data: "asc" }, select: { data: true } }),
    prisma.partida.findFirst({ orderBy: { data: "desc" }, select: { data: true } }),
  ]);
  const atual = anoSP();
  if (!primeiro || !ultimo) return [atual];
  const de = primeiro.data.getUTCFullYear();
  const ate = Math.max(atual, ultimo.data.getUTCFullYear());
  return Array.from({ length: ate - de + 1 }, (_, i) => de + i);
}

export type ResumoCotacao = {
  produto: ChaveProduto;
  atual: { data: string; valor: number; origem: string } | null;
  semanaAntes: number | null; // valor de ~7 dias antes da última cotação
  serie: { data: string; valor: number }[]; // últimos 30 dias, do mais antigo ao mais recente
};

/** Última cotação de cada produto, a de uma semana antes e a série dos últimos 30 dias. */
export async function resumoCotacoes(): Promise<ResumoCotacao[]> {
  const desde = new Date(Date.now() - 45 * 86_400_000);
  const todas = await prisma.cotacao.findMany({ where: { data: { gte: desde } }, orderBy: { data: "asc" } });
  return CHAVES_PRODUTO.map((produto) => {
    const serie = todas
      .filter((c) => c.produto === produto)
      .map((c) => ({ data: c.data.toISOString().slice(0, 10), valor: c.valor, origem: c.origem }));
    const atual = serie.at(-1) ?? null;
    const corte = atual ? new Date(new Date(atual.data).getTime() - 7 * 86_400_000).toISOString().slice(0, 10) : "";
    const semanaAntes = atual ? (serie.filter((c) => c.data <= corte).at(-1)?.valor ?? null) : null;
    const inicio30 = atual ? new Date(new Date(atual.data).getTime() - 30 * 86_400_000).toISOString().slice(0, 10) : "";
    return { produto, atual, semanaAntes, serie: serie.filter((c) => c.data >= inicio30).map(({ data, valor }) => ({ data, valor })) };
  });
}

export const contasAtivas = cache(() =>
  prisma.conta.findMany({
    where: { ativa: true },
    orderBy: [{ categoria: "asc" }, { nome: "asc" }],
    select: { id: true, nome: true, categoria: true, atividade: true },
  }),
);
