"use server";

import Anthropic from "@anthropic-ai/sdk";
import { guardarAnexo, validarArquivo } from "@/lib/anexos";
import { prisma } from "@/lib/db";
import type { DocumentoLido, TipoAceito } from "@/lib/documentos/esquema";
import { LeituraIndisponivel, lerDocumento } from "@/lib/documentos/leitura";
import { contaMaisUsada, termosDoFornecedor } from "@/lib/documentos/sugestoes";
import { exigirUsuario } from "@/lib/usuario";

// Contas onde o valor de um boleto/nota normalmente vai (débito).
const CATEGORIAS_DESTINO = ["Custeio", "Despesa Administrativa", "Despesa Financeira", "Ativo Imobilizado", "Ativo Estoque"];
// Contas de onde o pagamento costuma sair (crédito).
const CATEGORIAS_PAGAMENTO = ["Ativo Caixa/Banco", "PL Capital Sócio"];

export type ResultadoLeitura =
  | {
      ok: true;
      documento: DocumentoLido;
      contaDebitoId: string | null;
      origemConta: "historico" | "ia" | null;
      vezesNoHistorico: number;
      contaCreditoId: string | null;
      anexoId: string; // arquivo guardado, a vincular quando o lançamento ou a conta a pagar for gravado
    }
  | { ok: false; erro: string };

export async function lerDocumentoAcao(form: FormData): Promise<ResultadoLeitura> {
  const usuario = await exigirUsuario();
  const arquivo = form.get("arquivo");
  const invalido = validarArquivo(arquivo);
  if (invalido || !(arquivo instanceof File)) return { ok: false, erro: invalido ?? "Escolha um arquivo." };

  const contas = await prisma.conta.findMany({
    where: { ativa: true },
    select: { id: true, nome: true, categoria: true, atividade: true },
    orderBy: { nome: "asc" },
  });

  let documento: DocumentoLido;
  try {
    documento = await lerDocumento(
      { dados: Buffer.from(await arquivo.arrayBuffer()), tipo: arquivo.type as TipoAceito }, // já conferido em validarArquivo
      contas.filter((c) => CATEGORIAS_DESTINO.includes(c.categoria)),
    );
  } catch (e) {
    if (e instanceof LeituraIndisponivel) return { ok: false, erro: e.message };
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, erro: "Chave da API Anthropic inválida — confira ANTHROPIC_API_KEY." };
    if (e instanceof Anthropic.RateLimitError) return { ok: false, erro: "Muitas leituras seguidas; tente de novo em instantes." };
    if (e instanceof Anthropic.APIError) {
      console.error("Leitura de documento: erro da API", e.status, e.message);
      return { ok: false, erro: `O serviço de leitura falhou (${e.status}). Tente de novo.` };
    }
    console.error("Leitura de documento:", e);
    return { ok: false, erro: e instanceof Error ? e.message : "Falha na leitura do documento." };
  }

  // 1) Histórico: conta mais usada em lançamentos anteriores do mesmo fornecedor.
  let contaDebitoId: string | null = null;
  let origemConta: "historico" | "ia" | null = null;
  let vezesNoHistorico = 0;
  const termos = documento.fornecedor ? termosDoFornecedor(documento.fornecedor) : [];
  if (termos.length) {
    const usos = await prisma.partida.findMany({
      where: {
        valorCentavos: { gt: 0 },
        conta: { categoria: { in: CATEGORIAS_DESTINO }, ativa: true },
        OR: termos.flatMap((t) => [
          { historico: { contains: t, mode: "insensitive" as const } },
          { lancamento: { historico: { contains: t, mode: "insensitive" as const } } },
        ]),
      },
      select: { contaId: true },
      orderBy: { data: "desc" },
      take: 50,
    });
    const melhor = contaMaisUsada(usos);
    if (melhor) {
      contaDebitoId = melhor.contaId;
      origemConta = "historico";
      vezesNoHistorico = melhor.vezes;
    }
  }
  // 2) Sem histórico: a sugestão da IA (nome exato de uma conta da lista).
  if (!contaDebitoId && documento.contaSugerida) {
    const conta = contas.find((c) => c.nome.toLowerCase() === documento.contaSugerida!.toLowerCase());
    if (conta) {
      contaDebitoId = conta.id;
      origemConta = "ia";
    }
  }

  // Conta de pagamento: a mais usada nos créditos dos últimos 120 dias (hoje, quase sempre a CC do sócio).
  const desde = new Date(Date.now() - 120 * 86_400_000);
  const pagamentos = await prisma.partida.findMany({
    where: { valorCentavos: { lt: 0 }, data: { gte: desde }, conta: { categoria: { in: CATEGORIAS_PAGAMENTO } } },
    select: { contaId: true },
  });
  const contaCreditoId = contaMaisUsada(pagamentos)?.contaId ?? null;

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
  return { ok: true, documento, contaDebitoId, origemConta, vezesNoHistorico, contaCreditoId, anexoId };
}
