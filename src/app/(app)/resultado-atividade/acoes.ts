"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { CHAVE_RATEIO, CHAVE_TAXAS } from "@/lib/gerencial/parametros";
import { ATIVIDADES_RATEIO } from "@/lib/gerencial/rateio";
import { exigirUsuario } from "@/lib/usuario";

export type EstadoParametros = { erro?: string; ok?: string } | undefined;

const numero = (v: FormDataEntryValue | null) => {
  const t = String(v ?? "").trim().replace(",", ".");
  return t === "" ? null : Number(t);
};

async function gravar(usuarioId: string, chave: string, valor: Record<string, number>) {
  const antes = await prisma.configuracao.findUnique({ where: { chave } });
  await prisma.configuracao.upsert({ where: { chave }, create: { chave, valor }, update: { valor } });
  await prisma.registroAuditoria.create({
    data: { usuarioId, entidade: "Configuracao", entidadeId: chave, acao: antes ? "ALTERAR" : "CRIAR", antes: antes?.valor ?? undefined, depois: valor },
  });
  revalidatePath("/resultado-atividade");
  revalidatePath("/");
}

/** Grava as taxas de depreciação (campos "taxa:<contaId>", em % ao ano). */
export async function salvarTaxas(_: EstadoParametros, form: FormData): Promise<EstadoParametros> {
  const usuario = await exigirUsuario();
  const contas = await prisma.conta.findMany({ where: { categoria: "Ativo Imobilizado" }, select: { id: true } });
  const taxas: Record<string, number> = {};
  for (const { id } of contas) {
    const v = numero(form.get(`taxa:${id}`));
    if (v === null) continue;
    if (!Number.isFinite(v) || v < 0 || v > 100) return { erro: "Taxa deve estar entre 0 e 100% ao ano." };
    taxas[id] = v;
  }
  await gravar(usuario.id, CHAVE_TAXAS, taxas);
  return { ok: "Taxas gravadas." };
}

/** Grava os percentuais de rateio por atividade (campos com o nome da atividade). */
export async function salvarRateio(_: EstadoParametros, form: FormData): Promise<EstadoParametros> {
  const usuario = await exigirUsuario();
  const pct: Record<string, number> = {};
  for (const a of ATIVIDADES_RATEIO) {
    const v = numero(form.get(a)) ?? 0;
    if (!Number.isFinite(v) || v < 0 || v > 100) return { erro: "Percentuais entre 0 e 100." };
    pct[a] = v;
  }
  const soma = Object.values(pct).reduce((s, v) => s + v, 0);
  if (Math.abs(soma - 100) > 0.01) return { erro: `Os percentuais somam ${soma.toLocaleString("pt-BR")}%; precisam somar 100%.` };
  await gravar(usuario.id, CHAVE_RATEIO, pct);
  return { ok: "Percentuais gravados." };
}
