"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { CHAVE_DESTINATARIOS, enviarLembrete } from "@/lib/lembretes/enviar";
import { exigirUsuario } from "@/lib/usuario";

export type EstadoLembrete = { erro?: string; ok?: string } | undefined;

const ehEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/** Grava quem recebe os lembretes (um e-mail por linha ou separados por vírgula). */
export async function salvarDestinatarios(_: EstadoLembrete, form: FormData): Promise<EstadoLembrete> {
  const usuario = await exigirUsuario();
  const emails = [
    ...new Set(
      String(form.get("emails") ?? "")
        .split(/[\s,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  const invalido = emails.find((e) => !ehEmail(e));
  if (invalido) return { erro: `E-mail inválido: ${invalido}` };
  if (emails.length > 10) return { erro: "No máximo 10 destinatários." };
  await prisma.configuracao.upsert({ where: { chave: CHAVE_DESTINATARIOS }, create: { chave: CHAVE_DESTINATARIOS, valor: emails }, update: { valor: emails } });
  await prisma.registroAuditoria.create({ data: { usuarioId: usuario.id, entidade: "Configuracao", entidadeId: CHAVE_DESTINATARIOS, acao: "ALTERAR", depois: emails } });
  revalidatePath("/lembretes");
  return { ok: emails.length ? "Destinatários gravados." : "Sem lista: os lembretes vão para os sócios cadastrados." };
}

/** Manda agora o resumo da semana só para quem pediu (para testar a configuração). */
export async function enviarTeste(): Promise<EstadoLembrete> {
  const usuario = await exigirUsuario();
  try {
    const r = await enviarLembrete({ semanal: true, forcar: true, para: [usuario.email] });
    return r.enviado ? { ok: `Enviado para ${usuario.email}. Confira a caixa de entrada (e o spam).` } : { erro: `Não enviado: ${r.motivo}.` };
  } catch (e) {
    console.error("lembretes: teste falhou", e);
    const msg = e instanceof Error ? e.message : String(e);
    return { erro: /auth|535|Username and Password/i.test(msg) ? "O Gmail recusou o login: confira SMTP_USUARIO e a senha de app (SMTP_SENHA)." : `Falha no envio: ${msg}` };
  }
}
