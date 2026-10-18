import "server-only";
import { guardarAnexo, TAMANHO_MAXIMO_ANEXO } from "../anexos";
import { prisma } from "../db";
import { analisarDocumento } from "../documentos/analise";
import { ehTipoAceito, TIPOS_DOCUMENTO } from "../documentos/esquema";
import { dataBr } from "../formato";
import { mesmoNumero, type MensagemRecebida } from "./meta";

// Recebimento de boletos e notas pelo WhatsApp (Cloud API da Meta). Variáveis
// de ambiente, configuradas na Vercel:
//   WHATSAPP_TOKEN            token de acesso permanente (usuário do sistema no Business Manager)
//   WHATSAPP_APP_SECRET       "chave secreta do app" — confere a assinatura do webhook
//   WHATSAPP_VERIFY_TOKEN     texto livre, o mesmo digitado na Meta ao cadastrar o webhook
//   WHATSAPP_PHONE_NUMBER_ID  id do número que recebe as mensagens
// Os números autorizados a enviar ficam na tabela Configuracao (chave abaixo), editáveis no site.

export const CHAVE_NUMEROS = "whatsapp.numeros"; // [{ nome, numero }]
const VERSAO_API = process.env.WHATSAPP_GRAPH_VERSAO || "v23.0";
const API = `https://graph.facebook.com/${VERSAO_API}`;

export const VARIAVEIS_WHATSAPP = ["WHATSAPP_TOKEN", "WHATSAPP_APP_SECRET", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"] as const;
export const variaveisFaltando = () => VARIAVEIS_WHATSAPP.filter((v) => !process.env[v]);

export type NumeroAutorizado = { nome: string; numero: string };

export async function numerosAutorizados(): Promise<NumeroAutorizado[]> {
  const c = await prisma.configuracao.findUnique({ where: { chave: CHAVE_NUMEROS } });
  return Array.isArray(c?.valor) ? (c.valor as NumeroAutorizado[]) : [];
}

/** Endereço público do site, para os links nas respostas. */
export function enderecoSite(): string {
  const host = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  return (host || "http://localhost:3000").replace(/\/$/, "");
}

async function graph(caminho: string, init?: RequestInit) {
  return fetch(caminho.startsWith("http") ? caminho : `${API}/${caminho}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, ...init?.headers },
  });
}

export async function enviarTexto(para: string, texto: string) {
  const r = await graph(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: para, type: "text", text: { body: texto, preview_url: false } }),
  });
  if (!r.ok) console.error("WhatsApp: falha ao responder", r.status, await r.text());
}

/** Baixa a mídia: primeiro o endereço temporário, depois o arquivo (os dois pedem o token). */
async function baixarMidia(mediaId: string): Promise<{ dados: Buffer; mime: string } | { erro: string }> {
  const info = await graph(mediaId);
  if (!info.ok) return { erro: `a Meta não entregou o arquivo (${info.status})` };
  const { url, mime_type, file_size } = (await info.json()) as { url: string; mime_type?: string; file_size?: number };
  if (file_size && file_size > TAMANHO_MAXIMO_ANEXO) return { erro: "arquivo acima de 4 MB" };
  const arquivo = await graph(url);
  if (!arquivo.ok) return { erro: `falha ao baixar o arquivo (${arquivo.status})` };
  const dados = Buffer.from(await arquivo.arrayBuffer());
  if (dados.length > TAMANHO_MAXIMO_ANEXO) return { erro: "arquivo acima de 4 MB" };
  return { dados, mime: (mime_type ?? "").split(";")[0].trim() };
}

const AJUDA =
  "Olá! Mande aqui a foto ou o PDF do boleto, da nota fiscal ou do recibo. Eu leio, guardo o arquivo e deixo pronto no Novo Horizonte para você conferir e gravar.";

const valorBr = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Trata uma mensagem do webhook. Números não autorizados são ignorados em silêncio. */
export async function processarMensagem(m: MensagemRecebida) {
  const autorizados = await numerosAutorizados();
  if (!autorizados.some((a) => mesmoNumero(a.numero, m.de))) {
    console.warn("WhatsApp: mensagem de número não autorizado ignorada");
    return;
  }
  if (m.tipo !== "midia") return enviarTexto(m.de, AJUDA);

  // A Meta pode reenviar a mesma notificação: o id da mensagem é único.
  const existente = await prisma.documentoRecebido.findUnique({ where: { mensagemId: m.id }, select: { id: true } });
  if (existente) return;
  const doc = await prisma.documentoRecebido.create({
    data: { canal: "WHATSAPP", mensagemId: m.id, remetente: m.de, legenda: m.legenda },
  });
  const link = `${enderecoSite()}/lancamentos/ler?documento=${doc.id}`;

  if (!ehTipoAceito(m.mime)) {
    await prisma.documentoRecebido.update({ where: { id: doc.id }, data: { erro: "Formato não aceito (envie PDF ou foto).", status: "DESCARTADO" } });
    return enviarTexto(m.de, "Esse formato eu não consigo ler. Envie o boleto ou a nota em PDF ou como foto.");
  }
  const midia = await baixarMidia(m.mediaId);
  if ("erro" in midia) {
    await prisma.documentoRecebido.update({ where: { id: doc.id }, data: { erro: midia.erro, status: "DESCARTADO" } });
    return enviarTexto(m.de, `Não consegui receber o arquivo: ${midia.erro}. Tente enviar de novo.`);
  }
  const tipo = ehTipoAceito(midia.mime) ? midia.mime : m.mime;
  const extensao = tipo === "application/pdf" ? "pdf" : tipo.split("/")[1];
  const nome = m.nomeArquivo || `whatsapp-${new Date().toISOString().slice(0, 10)}.${extensao}`;
  const anexoId = await guardarAnexo({ name: nome, type: tipo, dados: midia.dados }, null);
  await prisma.documentoRecebido.update({ where: { id: doc.id }, data: { anexoId } });

  const analise = await analisarDocumento({ dados: midia.dados, tipo: tipo as Parameters<typeof analisarDocumento>[0]["tipo"] });
  if (!analise.ok) {
    await prisma.documentoRecebido.update({ where: { id: doc.id }, data: { erro: analise.erro } });
    return enviarTexto(m.de, `Recebi e guardei o arquivo, mas não consegui ler: ${analise.erro}\nVocê pode lançar manualmente aqui: ${link}`);
  }
  await prisma.documentoRecebido.update({ where: { id: doc.id }, data: { leitura: analise } });
  const d = analise.documento;
  const partes = [
    `${TIPOS_DOCUMENTO[d.tipo]} lido`,
    d.fornecedor,
    d.valor !== null ? valorBr(d.valor) : null,
    d.vencimento ? `vence ${dataBr(d.vencimento)}` : null,
  ].filter(Boolean);
  const alerta = d.confianca === "alta" ? "" : "\n⚠ Leitura com confiança " + (d.confianca === "media" ? "média" : "baixa") + ": confira os campos.";
  await enviarTexto(m.de, `✓ ${partes.join(" — ")}.${alerta}\nConfira e grave: ${link}`);
}
