"use server";

import { guardarAnexo, validarArquivo } from "@/lib/anexos";
import { prisma } from "@/lib/db";
import { analisarDocumento, type Analise } from "@/lib/documentos/analise";
import type { TipoAceito } from "@/lib/documentos/esquema";
import { exigirUsuario } from "@/lib/usuario";

export type ResultadoLeitura =
  | (Extract<Analise, { ok: true }> & {
      anexoId: string; // arquivo guardado, a vincular quando o lançamento ou a conta a pagar for gravado
    })
  | { ok: false; erro: string };

export async function lerDocumentoAcao(form: FormData): Promise<ResultadoLeitura> {
  const usuario = await exigirUsuario();
  const arquivo = form.get("arquivo");
  const invalido = validarArquivo(arquivo);
  if (invalido || !(arquivo instanceof File)) return { ok: false, erro: invalido ?? "Escolha um arquivo." };

  const analise = await analisarDocumento({ dados: Buffer.from(await arquivo.arrayBuffer()), tipo: arquivo.type as TipoAceito }); // tipo já conferido em validarArquivo
  if (!analise.ok) return analise;

  const { documento } = analise;
  await prisma.registroAuditoria.create({
    data: {
      usuarioId: usuario.id,
      entidade: "Documento",
      entidadeId: arquivo.name.slice(0, 120),
      acao: "LER",
      depois: { tipo: documento.tipo, fornecedor: documento.fornecedor, valor: documento.valor, confianca: documento.confianca },
    },
  });

  const anexoId = await guardarAnexo(arquivo, usuario.id);
  return { ...analise, anexoId };
}
