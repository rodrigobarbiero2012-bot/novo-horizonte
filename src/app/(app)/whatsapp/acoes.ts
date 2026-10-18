"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { exigirUsuario } from "@/lib/usuario";
import { normalizarNumero } from "@/lib/whatsapp/meta";
import { CHAVE_NUMEROS, type NumeroAutorizado } from "@/lib/whatsapp/processar";
import { ehId } from "@/lib/validacao";

export type EstadoWhatsapp = { erro?: string; ok?: string } | undefined;

/** Grava os números que podem enviar documentos (campos nome0/numero0, nome1/numero1...). */
export async function salvarNumeros(_: EstadoWhatsapp, form: FormData): Promise<EstadoWhatsapp> {
  const usuario = await exigirUsuario();
  const numeros: NumeroAutorizado[] = [];
  for (let i = 0; i < 6; i++) {
    const nome = String(form.get(`nome${i}`) ?? "").trim();
    const texto = String(form.get(`numero${i}`) ?? "").trim();
    if (!nome && !texto) continue;
    if (!nome) return { erro: "Informe o nome de cada número." };
    const numero = normalizarNumero(texto);
    if (!numero) return { erro: `Número de ${nome} inválido: use um celular brasileiro com DDD, ex.: (11) 98765-4321.` };
    numeros.push({ nome, numero });
  }
  const antes = await prisma.configuracao.findUnique({ where: { chave: CHAVE_NUMEROS } });
  await prisma.configuracao.upsert({ where: { chave: CHAVE_NUMEROS }, create: { chave: CHAVE_NUMEROS, valor: numeros }, update: { valor: numeros } });
  await prisma.registroAuditoria.create({
    data: { usuarioId: usuario.id, entidade: "Configuracao", entidadeId: CHAVE_NUMEROS, acao: antes ? "ALTERAR" : "CRIAR", antes: antes?.valor ?? undefined, depois: numeros },
  });
  revalidatePath("/whatsapp");
  return { ok: "Números gravados." };
}

/** Tira o documento da caixa de entrada sem lançar (o arquivo é apagado). */
export async function descartarDocumento(id: string) {
  const usuario = await exigirUsuario();
  if (!ehId(id)) return;
  const doc = await prisma.documentoRecebido.findUnique({ where: { id } });
  if (!doc || doc.status !== "PENDENTE") return;
  await prisma.$transaction(async (tx) => {
    await tx.documentoRecebido.update({ where: { id }, data: { status: "DESCARTADO", anexoId: null } });
    if (doc.anexoId) await tx.anexo.deleteMany({ where: { id: doc.anexoId, lancamentoId: null, tituloId: null } });
  });
  await prisma.registroAuditoria.create({ data: { usuarioId: usuario.id, entidade: "DocumentoRecebido", entidadeId: id, acao: "DESCARTAR" } });
  revalidatePath("/lancamentos/ler");
  revalidatePath("/");
}
