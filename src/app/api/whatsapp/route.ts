import { after } from "next/server";
import { assinaturaValida, lerNotificacao } from "@/lib/whatsapp/meta";
import { processarMensagem } from "@/lib/whatsapp/processar";

// Webhook do WhatsApp (Cloud API da Meta). Fora do login (ver proxy.ts): a
// autenticação é o verify token no cadastro (GET) e a assinatura HMAC em cada
// notificação (POST).

/** Cadastro do webhook na Meta: devolve o "challenge" se o verify token conferir. */
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (token && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === token) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const segredo = process.env.WHATSAPP_APP_SECRET;
  const corpo = await request.text();
  if (!segredo || !assinaturaValida(corpo, request.headers.get("x-hub-signature-256"), segredo)) {
    return new Response("Assinatura inválida", { status: 401 });
  }
  let mensagens;
  try {
    mensagens = lerNotificacao(JSON.parse(corpo));
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }
  // A Meta espera resposta rápida (senão reenvia); a leitura do documento leva de 10 a 30 s.
  after(async () => {
    for (const m of mensagens) {
      try {
        await processarMensagem(m);
      } catch (e) {
        console.error("WhatsApp: erro ao processar mensagem", m.id, e);
      }
    }
  });
  return new Response("ok", { status: 200 });
}
