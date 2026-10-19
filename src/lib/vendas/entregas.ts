import "server-only";
import type { Prisma } from "@prisma/client";
import { definicaoPorChave } from "../producao/atividades";

// Escrita das entregas de venda, usada pelas ações de vendas e pela tela de
// produção (excluir um movimento que é entrega precisa cuidar do título).

type Tx = Prisma.TransactionClient;
type VendaBase = { id: string; atividade: string; comprador: string; contaReceitaId: string; precoUnitarioCentavos: number | null };

const qtdTexto = (q: number) => q.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

/** Conta a receber de uma entrega (quantidade × preço), ligada à entrega e à venda. */
export async function criarTituloDaEntrega(tx: Tx, venda: VendaBase, entrega: { id: string; quantidade: number }, vencimento: Date, usuarioId: string) {
  if (venda.precoUnitarioCentavos === null) return null;
  const def = definicaoPorChave(venda.atividade);
  return tx.titulo.create({
    data: {
      tipo: "RECEBER",
      descricao: `Venda ${def?.nome.toLowerCase() ?? ""} — ${qtdTexto(entrega.quantidade)} ${def?.unidadeCurta ?? ""}`.replace(/\s+/g, " ").trim(),
      contraparte: venda.comprador,
      valorCentavos: Math.round(entrega.quantidade * venda.precoUnitarioCentavos),
      vencimento,
      contaId: venda.contaReceitaId,
      origem: "VENDA",
      vendaId: venda.id,
      entregaId: entrega.id,
      criadoPorId: usuarioId,
    },
  });
}

/** Registra a entrega (saída VENDA na produção) e, com preço fixado, a conta a receber. */
export async function registrarEntregaTx(
  tx: Tx,
  venda: VendaBase,
  p: { data: Date; quantidade: number; vencimento: Date; usuarioId: string },
) {
  const entrega = await tx.movimentoProducao.create({
    data: {
      atividade: venda.atividade,
      data: p.data,
      tipo: "VENDA",
      quantidade: p.quantidade,
      valorCentavos: venda.precoUnitarioCentavos === null ? null : Math.round(p.quantidade * venda.precoUnitarioCentavos),
      observacao: `Entrega a ${venda.comprador}`,
      vendaId: venda.id,
      criadoPorId: p.usuarioId,
    },
  });
  const titulo = await criarTituloDaEntrega(tx, venda, entrega, p.vencimento, p.usuarioId);
  return { entrega, titulo };
}

/**
 * Desfaz uma entrega: apaga a conta a receber (se ainda em aberto) e o
 * movimento. Recusa se o dinheiro já foi recebido — é preciso estornar antes.
 */
export async function desfazerEntregaTx(tx: Tx, movimentoId: string): Promise<string | null> {
  const titulo = await tx.titulo.findUnique({ where: { entregaId: movimentoId }, select: { id: true, status: true } });
  if (titulo?.status === "BAIXADO") return "Esta entrega já foi recebida. Desfaça o recebimento em “A pagar e receber” antes.";
  if (titulo) await tx.titulo.delete({ where: { id: titulo.id } });
  await tx.movimentoProducao.delete({ where: { id: movimentoId } });
  return null;
}
