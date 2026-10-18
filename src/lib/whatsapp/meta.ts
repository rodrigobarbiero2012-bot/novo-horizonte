import { createHmac, timingSafeEqual } from "node:crypto";

// WhatsApp Business Cloud API (Meta): partes puras — assinatura do webhook,
// leitura da notificação e comparação de números. Chamadas HTTP ficam em processar.ts.

/** Confere o cabeçalho X-Hub-Signature-256 ("sha256=<hex>") com o segredo do app. */
export function assinaturaValida(corpo: string, cabecalho: string | null, segredo: string): boolean {
  if (!cabecalho?.startsWith("sha256=")) return false;
  const esperado = Buffer.from(createHmac("sha256", segredo).update(corpo, "utf8").digest("hex"));
  const recebido = Buffer.from(cabecalho.slice(7));
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

export type MensagemRecebida =
  | { tipo: "midia"; id: string; de: string; nomeContato: string | null; mediaId: string; mime: string; nomeArquivo: string | null; legenda: string | null }
  | { tipo: "texto"; id: string; de: string; nomeContato: string | null; texto: string }
  | { tipo: "outro"; id: string; de: string; nomeContato: string | null };

type Valor = {
  contacts?: { wa_id?: string; profile?: { name?: string } }[];
  messages?: {
    id: string;
    from: string;
    type: string;
    text?: { body?: string };
    image?: { id: string; mime_type?: string; caption?: string };
    document?: { id: string; mime_type?: string; caption?: string; filename?: string };
  }[];
};

/** Mensagens de uma notificação do webhook (ignora status de entrega e outros eventos). */
export function lerNotificacao(corpo: unknown): MensagemRecebida[] {
  const entradas = (corpo as { entry?: { changes?: { field?: string; value?: Valor }[] }[] })?.entry ?? [];
  const lista: MensagemRecebida[] = [];
  for (const e of entradas) {
    for (const c of e.changes ?? []) {
      if (c.field !== "messages" || !c.value?.messages) continue;
      for (const m of c.value.messages) {
        const nomeContato = c.value.contacts?.find((ct) => ct.wa_id === m.from)?.profile?.name ?? null;
        const base = { id: m.id, de: m.from, nomeContato };
        const midia = m.type === "image" ? m.image : m.type === "document" ? m.document : undefined;
        if (midia?.id) {
          lista.push({
            ...base,
            tipo: "midia",
            mediaId: midia.id,
            mime: (midia.mime_type ?? "").split(";")[0].trim(),
            nomeArquivo: (m.document?.filename ?? null) || null,
            legenda: midia.caption ?? null,
          });
        } else if (m.type === "text") lista.push({ ...base, tipo: "texto", texto: m.text?.body ?? "" });
        else lista.push({ ...base, tipo: "outro" });
      }
    }
  }
  return lista;
}

/**
 * Chave para comparar números brasileiros: DDD + últimos 8 dígitos. O WhatsApp
 * às vezes identifica celulares sem o 9 inicial (55 11 8765-4321 em vez de
 * 55 11 98765-4321), então o 9 não entra na comparação.
 */
export function chaveNumero(numero: string): string {
  let d = numero.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.length < 10) return d;
  return d.slice(0, 2) + d.slice(-8);
}

export const mesmoNumero = (a: string, b: string) => chaveNumero(a) === chaveNumero(b);

/** "5511987654321" → "+55 11 98765-4321" (só para exibir). */
export function formatarNumero(numero: string): string {
  const d = numero.replace(/\D/g, "");
  const m = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `+55 ${m[1]} ${m[2]}-${m[3]}` : `+${d}`;
}
