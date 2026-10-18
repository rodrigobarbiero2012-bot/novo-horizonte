import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assinaturaValida, chaveNumero, formatarNumero, lerNotificacao, mesmoNumero } from "./meta";

const notificacao = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "123",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "5511999990000", phone_number_id: "111" },
            contacts: [{ wa_id: "5511987654321", profile: { name: "Rodrigo" } }],
            messages: [
              { id: "wamid.1", from: "5511987654321", type: "document", document: { id: "m1", mime_type: "application/pdf", filename: "boleto.pdf", caption: "adubo" } },
              { id: "wamid.2", from: "5511987654321", type: "image", image: { id: "m2", mime_type: "image/jpeg" } },
              { id: "wamid.3", from: "5511987654321", type: "text", text: { body: "oi" } },
              { id: "wamid.4", from: "5511987654321", type: "audio", audio: { id: "m4" } },
            ],
          },
        },
        { field: "messages", value: { statuses: [{ id: "wamid.0", status: "read" }] } },
      ],
    },
  ],
};

describe("lerNotificacao", () => {
  it("separa documentos, fotos, textos e o resto, e ignora status de entrega", () => {
    const ms = lerNotificacao(notificacao);
    expect(ms).toHaveLength(4);
    expect(ms[0]).toEqual({
      tipo: "midia",
      id: "wamid.1",
      de: "5511987654321",
      nomeContato: "Rodrigo",
      mediaId: "m1",
      mime: "application/pdf",
      nomeArquivo: "boleto.pdf",
      legenda: "adubo",
    });
    expect(ms[1]).toMatchObject({ tipo: "midia", mediaId: "m2", mime: "image/jpeg", nomeArquivo: null });
    expect(ms[2]).toMatchObject({ tipo: "texto", texto: "oi" });
    expect(ms[3]).toMatchObject({ tipo: "outro", id: "wamid.4" });
  });
  it("aguenta corpo inesperado", () => {
    expect(lerNotificacao(null)).toEqual([]);
    expect(lerNotificacao({ entry: [{}] })).toEqual([]);
  });
});

describe("assinaturaValida", () => {
  it("aceita só o HMAC certo do corpo", () => {
    const corpo = JSON.stringify(notificacao);
    const assinatura = "sha256=" + createHmac("sha256", "segredo").update(corpo).digest("hex");
    expect(assinaturaValida(corpo, assinatura, "segredo")).toBe(true);
    expect(assinaturaValida(corpo + " ", assinatura, "segredo")).toBe(false);
    expect(assinaturaValida(corpo, assinatura, "outro")).toBe(false);
    expect(assinaturaValida(corpo, null, "segredo")).toBe(false);
    expect(assinaturaValida(corpo, "sha256=abc", "segredo")).toBe(false);
  });
});

describe("números", () => {
  it("reconhece o mesmo celular com ou sem o 9 e com ou sem formatação", () => {
    expect(mesmoNumero("5511987654321", "551187654321")).toBe(true);
    expect(mesmoNumero("+55 (11) 98765-4321", "5511987654321")).toBe(true);
    expect(mesmoNumero("11 98765-4321", "5511987654321")).toBe(true);
    expect(mesmoNumero("5511987654321", "5521987654321")).toBe(false); // outro DDD
    expect(chaveNumero("5531912345678")).toBe("3112345678");
  });
  it("formata para exibir", () => {
    expect(formatarNumero("5511987654321")).toBe("+55 11 98765-4321");
  });
});
