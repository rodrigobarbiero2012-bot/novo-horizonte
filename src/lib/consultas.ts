import "server-only";
import { cache } from "react";
import { prisma } from "./db";
import { carregarPartidas } from "./contabil/repositorio";

/** Partidas do razão inteiro, uma vez por requisição. ~10 mil linhas: cabe em memória sem esforço. */
export const partidasDoRazao = cache(() => carregarPartidas(prisma));

/** Do primeiro ano com movimento até o ano atual (ou o último lançamento, se for posterior). */
export async function anosComMovimento(): Promise<number[]> {
  const [primeiro, ultimo] = await Promise.all([
    prisma.partida.findFirst({ orderBy: { data: "asc" }, select: { data: true } }),
    prisma.partida.findFirst({ orderBy: { data: "desc" }, select: { data: true } }),
  ]);
  const atual = new Date().getFullYear();
  if (!primeiro || !ultimo) return [atual];
  const de = primeiro.data.getUTCFullYear();
  const ate = Math.max(atual, ultimo.data.getUTCFullYear());
  return Array.from({ length: ate - de + 1 }, (_, i) => de + i);
}

export const contasAtivas = cache(() =>
  prisma.conta.findMany({
    where: { ativa: true },
    orderBy: [{ categoria: "asc" }, { nome: "asc" }],
    select: { id: true, nome: true, categoria: true, atividade: true },
  }),
);
