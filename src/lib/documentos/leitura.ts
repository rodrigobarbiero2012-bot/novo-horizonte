import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { DocumentoLido, type TipoAceito } from "./esquema";

// Leitura de boleto/nota/recibo com o Claude: o arquivo vai como documento
// (PDF) ou imagem, e a resposta volta validada pelo esquema DocumentoLido.

const MODELO = "claude-opus-5-5";

export class LeituraIndisponivel extends Error {}

type ContaParaIA = { nome: string; categoria: string; atividade: string };

const instrucoes = (contas: ContaParaIA[]) => `Você lê documentos financeiros de um sítio no Brasil que produz café, maracujá e gado.
Extraia os dados do documento anexado (boleto, nota fiscal, recibo ou comprovante de pagamento).

Regras:
- Copie o que está escrito; se um campo não aparece ou está ilegível, use null. Não invente.
- Datas no formato AAAA-MM-DD. Valor em reais como número (1.234,56 → 1234.56).
- Em boleto, "fornecedor" é o beneficiário/cedente; em nota fiscal, o emitente.
- Escolha em "contaSugerida" a conta de despesa, custo ou ativo mais adequada da lista abaixo, usando o nome exatamente como escrito. Pense no que foi comprado: adubo e fertilizante → adubos; fungicida/inseticida/herbicida → defensivos; peças e oficina de trator → manutenção de máquinas; diesel → combustível; energia elétrica → energia; salário/diária → pessoal; máquina nova ou obra → imobilizado.
- Se o item for claramente do maracujá ou do gado, prefira a conta dessa atividade.

Contas disponíveis (nome | categoria | atividade):
${contas.map((c) => `${c.nome} | ${c.categoria} | ${c.atividade}`).join("\n")}`;

export async function lerDocumento(arquivo: { dados: Buffer; tipo: TipoAceito }, contas: ContaParaIA[]): Promise<DocumentoLido> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new LeituraIndisponivel("A leitura por IA ainda não foi configurada (falta ANTHROPIC_API_KEY).");
  }
  // Abaixo do limite das funções (maxDuration 60 s): uma falha volta como mensagem, não como página quebrada.
  const client = new Anthropic({ timeout: 45_000, maxRetries: 1 });
  const base64 = arquivo.dados.toString("base64");
  const anexo: Anthropic.Beta.BetaContentBlockParam =
    arquivo.tipo === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : { type: "image", source: { type: "base64", media_type: arquivo.tipo, data: base64 } };

  const resposta = await client.beta.messages.parse({
    model: MODELO,
    max_tokens: 16000,
    // Se o modelo principal recusar por política, a API refaz no modelo recomendado.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(DocumentoLido) },
    messages: [{ role: "user", content: [anexo, { type: "text", text: instrucoes(contas) }] }],
  });

  if (resposta.stop_reason === "refusal") throw new Error("A IA não conseguiu processar este documento.");
  if (resposta.stop_reason === "max_tokens") throw new Error("A leitura foi interrompida; tente um arquivo menor.");
  if (!resposta.parsed_output) throw new Error("A IA não devolveu os dados no formato esperado. Tente de novo.");
  return resposta.parsed_output;
}
