"use server";

import { revalidatePath } from "next/cache";
import { guardarAnexo, validarArquivo } from "@/lib/anexos";
import { prisma } from "@/lib/db";
import { exigirUsuario } from "@/lib/usuario";

export type EstadoAnexo = { erro?: string; ok?: string } | undefined;
export type DestinoAnexo = { lancamentoId: string } | { tituloId: string };

async function auditar(usuarioId: string, anexoId: string, acao: string, dados: object) {
  await prisma.registroAuditoria.create({ data: { usuarioId, entidade: "Anexo", entidadeId: anexoId, acao, depois: dados } });
}

/** Anexa um arquivo enviado pelo sócio a um lançamento ou conta a pagar/receber já gravados. */
export async function anexarArquivo(destino: DestinoAnexo, _: EstadoAnexo, form: FormData): Promise<EstadoAnexo> {
  const usuario = await exigirUsuario();
  const arquivo = form.get("arquivo");
  const invalido = validarArquivo(arquivo);
  if (invalido || !(arquivo instanceof File)) return { erro: invalido ?? "Escolha um arquivo." };
  const existe =
    "lancamentoId" in destino
      ? await prisma.lancamento.findUnique({ where: { id: destino.lancamentoId }, select: { id: true } })
      : await prisma.titulo.findUnique({ where: { id: destino.tituloId }, select: { id: true } });
  if (!existe) return { erro: "Registro não encontrado." };
  const id = await guardarAnexo(arquivo, usuario.id, destino);
  await auditar(usuario.id, id, "CRIAR", { nome: arquivo.name, ...destino });
  revalidatePath("/", "layout");
  return { ok: `"${arquivo.name}" anexado.` };
}

export async function removerAnexo(id: string) {
  const usuario = await exigirUsuario();
  const anexo = await prisma.anexo.findUnique({ where: { id }, select: { nome: true, lancamentoId: true, tituloId: true } });
  if (!anexo) return;
  await prisma.anexo.delete({ where: { id } });
  await auditar(usuario.id, id, "EXCLUIR", anexo);
  revalidatePath("/", "layout");
}
