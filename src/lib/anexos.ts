import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { ehTipoAceito } from "./documentos/esquema";

export const TAMANHO_MAXIMO_ANEXO = 4 * 1024 * 1024;

/** Campos de listagem: nunca carregar `conteudo` sem precisar. */
export const CAMPOS_ANEXO = { id: true, nome: true, tipo: true, tamanho: true, criadoEm: true } as const;

/** Mensagem de erro, ou null se o arquivo pode ser guardado. */
export function validarArquivo(arquivo: FormDataEntryValue | null): string | null {
  if (!(arquivo instanceof File) || arquivo.size === 0) return "Escolha um arquivo.";
  if (!ehTipoAceito(arquivo.type)) return "Envie um PDF ou uma foto (JPG, PNG, WEBP).";
  if (arquivo.size > TAMANHO_MAXIMO_ANEXO) return "Arquivo acima de 4 MB.";
  return null;
}

/**
 * Guarda o arquivo, já validado. Sem `destino`, fica solto até ser vinculado
 * (leitura de documento); arquivos soltos com mais de 1 dia, que não sejam de
 * documento recebido pelo WhatsApp, são apagados aqui.
 */
export async function guardarAnexo(
  arquivo: File | { name: string; type: string; dados: Buffer },
  usuarioId: string | null,
  destino: { lancamentoId?: string; tituloId?: string } = {},
): Promise<string> {
  const conteudo = new Uint8Array(arquivo instanceof File ? await arquivo.arrayBuffer() : arquivo.dados);
  // Soltos há mais de 1 dia: leitura abandonada. Os que vieram pelo WhatsApp esperam a revisão.
  await prisma.anexo.deleteMany({
    where: { lancamentoId: null, tituloId: null, documentoRecebido: null, criadoEm: { lt: new Date(Date.now() - 86_400_000) } },
  });
  const anexo = await prisma.anexo.create({
    data: {
      nome: arquivo.name.slice(0, 200) || "documento",
      tipo: arquivo.type,
      tamanho: conteudo.length,
      sha256: createHash("sha256").update(conteudo).digest("hex"),
      conteudo,
      criadoPorId: usuarioId,
      ...destino,
    },
    select: { id: true },
  });
  return anexo.id;
}

/** Liga um arquivo solto (recém-lido) ao lançamento ou título gravado. Ignora id inválido ou já vinculado. */
export async function vincularAnexo(
  tx: Prisma.TransactionClient,
  anexoId: FormDataEntryValue | null,
  destino: { lancamentoId: string } | { tituloId: string },
) {
  if (typeof anexoId !== "string" || !anexoId) return;
  await tx.anexo.updateMany({ where: { id: anexoId, lancamentoId: null, tituloId: null }, data: destino });
  // Se veio pelo WhatsApp, o documento sai da caixa de entrada.
  await tx.documentoRecebido.updateMany({ where: { anexoId, status: "PENDENTE" }, data: { status: "GRAVADO" } });
}
