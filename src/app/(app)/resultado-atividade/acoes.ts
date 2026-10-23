"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { lerValorBr } from "@/lib/contabil/lancamento";
import { CHAVE_RATEIO, CHAVE_TAXAS, CHAVE_TERRA } from "@/lib/gerencial/parametros";
import { ATIVIDADES_RATEIO } from "@/lib/gerencial/rateio";
import { exigirUsuario } from "@/lib/usuario";
import { ehDataIso } from "@/lib/validacao";

export type EstadoParametros = { erro?: string; ok?: string } | undefined;

const numero = (v: FormDataEntryValue | null) => {
  const t = String(v ?? "").trim().replace(",", ".");
  return t === "" ? null : Number(t);
};

async function gravar(usuarioId: string, chave: string, valor: Record<string, number | string>) {
  const antes = await prisma.configuracao.findUnique({ where: { chave } });
  await prisma.configuracao.upsert({ where: { chave }, create: { chave, valor }, update: { valor } });
  await prisma.registroAuditoria.create({
    data: { usuarioId, entidade: "Configuracao", entidadeId: chave, acao: antes ? "ALTERAR" : "CRIAR", antes: antes?.valor ?? undefined, depois: valor },
  });
  revalidatePath("/resultado-atividade");
  revalidatePath("/analise-cultivo");
  revalidatePath("/");
}

/** Grava as taxas de depreciaÃ§Ã£o (campos "taxa:<contaId>", em % ao ano). */
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

/** Grava o valor de mercado do sítio (terra e benfeitorias), usado como capital na análise por cultivo. */
export async function salvarValorTerra(_: EstadoParametros, form: FormData): Promise<EstadoParametros> {
  const usuario = await exigirUsuario();
  const valor = lerValorBr(String(form.get("valor") ?? ""));
  const data = String(form.get("data") ?? "");
  if (valor === null || Number.isNaN(valor) || valor <= 0) return { erro: "Informe o valor de mercado." };
  if (!ehDataIso(data)) return { erro: "Informe a data da estimativa." };
  await gravar(usuario.id, CHAVE_TERRA, { valorCentavos: valor, data });
  return { ok: "Valor gravado." };
}
