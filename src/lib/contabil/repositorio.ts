import type { PrismaClient } from "@prisma/client";
import { ehAtividade, ehCategoria, type PartidaContabil } from "./tipos";

/** Todas as partidas do razão, já classificadas pela conta, para os relatórios. */
export async function carregarPartidas(prisma: PrismaClient): Promise<PartidaContabil[]> {
  const partidas = await prisma.partida.findMany({
    select: { data: true, valorCentavos: true, conta: { select: { nome: true, categoria: true, atividade: true } } },
  });
  return partidas.map((p) => {
    const { categoria, atividade, nome } = p.conta;
    if (!ehCategoria(categoria) || !ehAtividade(atividade)) {
      throw new Error(`conta "${nome}" com categoria/atividade inválida: ${categoria} / ${atividade}`);
    }
    return { data: p.data.toISOString().slice(0, 10), categoria, atividade, valorCentavos: p.valorCentavos, conta: nome };
  });
}
