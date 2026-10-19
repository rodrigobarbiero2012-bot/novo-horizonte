"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { chaveInvestimento, ehLinhaInvestimento, ehLinhaOrcamento } from "@/lib/orcamento/calculo";
import { exigirUsuario } from "@/lib/usuario";

export type EstadoOrcamento = { erro?: string; ok?: string } | undefined;

/**
 * Grava o orçamento do ano inteiro, substituindo o anterior. `valores` vem do
 * editor: linha da DRE → 12 valores em centavos, já no sinal da DRE.
 */
export async function salvarOrcamento(ano: number, valores: Record<string, number[]>): Promise<EstadoOrcamento> {
  const usuario = await exigirUsuario();
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) return { erro: "Ano inválido." };
  if (typeof valores !== "object" || !valores) return { erro: "Dados do orçamento inválidos." };
  // Linhas de investimento só para contas de imobilizado que existem.
  const imobilizado = new Set(
    (await prisma.conta.findMany({ where: { categoria: "Ativo Imobilizado" }, select: { nome: true } })).map((c) => chaveInvestimento(c.nome)),
  );
  const itens: { ano: number; linha: string; mes: number; valorCentavos: number }[] = [];
  for (const [linha, meses] of Object.entries(valores)) {
    const valida = ehLinhaOrcamento(linha) || (ehLinhaInvestimento(linha) && imobilizado.has(linha));
    if (!valida || !Array.isArray(meses) || meses.length !== 12) return { erro: "Dados do orçamento inválidos." };
    for (const [i, v] of meses.entries()) {
      if (!Number.isSafeInteger(v) || Math.abs(v) > 1e13) return { erro: "Valor inválido no orçamento." };
      if (v !== 0) itens.push({ ano, linha, mes: i + 1, valorCentavos: v });
    }
  }

  const antes = await prisma.orcamentoItem.findMany({ where: { ano }, select: { linha: true, mes: true, valorCentavos: true } });
  await prisma.$transaction([prisma.orcamentoItem.deleteMany({ where: { ano } }), prisma.orcamentoItem.createMany({ data: itens })]);
  const totalPorLinha = (xs: { linha: string; valorCentavos: number }[]) =>
    xs.reduce<Record<string, number>>((t, x) => ({ ...t, [x.linha]: (t[x.linha] ?? 0) + x.valorCentavos }), {});
  await prisma.registroAuditoria.create({
    data: {
      usuarioId: usuario.id,
      entidade: "Orcamento",
      entidadeId: String(ano),
      acao: antes.length ? "ALTERAR" : "CRIAR",
      antes: totalPorLinha(antes),
      depois: totalPorLinha(itens),
    },
  });
  revalidatePath("/orcamento");
  revalidatePath("/");
  return { ok: `Orçamento de ${ano} gravado.` };
}
