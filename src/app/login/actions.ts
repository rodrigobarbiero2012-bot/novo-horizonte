"use server";

import { redirect } from "next/navigation";
import { entrar } from "@/lib/usuario";

export async function acaoEntrar(_: { erro?: string } | undefined, form: FormData) {
  const email = String(form.get("email") ?? "");
  const senha = String(form.get("senha") ?? "");
  if (!email || !senha) return { erro: "Informe e-mail e senha." };
  const resultado = await entrar(email, senha);
  if (resultado === "bloqueado") return { erro: "Muitas tentativas erradas. Acesso bloqueado por 15 minutos." };
  if (resultado === "invalido") return { erro: "E-mail ou senha incorretos." };
  redirect("/");
}
