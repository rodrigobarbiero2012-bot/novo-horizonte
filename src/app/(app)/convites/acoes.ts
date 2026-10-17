"use server";

import { headers } from "next/headers";
import { criarConvite, exigirUsuario } from "@/lib/usuario";

export type EstadoConvite = { erro?: string; link?: string; nome?: string } | undefined;

export async function acaoConvidar(_: EstadoConvite, form: FormData): Promise<EstadoConvite> {
  const usuario = await exigirUsuario();
  const nome = String(form.get("nome") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  if (!nome || !email.includes("@")) return { erro: "Informe nome e e-mail." };
  const token = await criarConvite(nome, email, usuario.id);
  if (!token) return { erro: "Esse e-mail já tem senha definida." };
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  return { link: `${proto}://${h.get("host")}/primeiro-acesso?convite=${token}`, nome };
}
