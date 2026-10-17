"use server";

import { redirect } from "next/navigation";
import { definirPrimeiraSenha, TAMANHO_MINIMO_SENHA } from "@/lib/usuario";

export async function acaoPrimeiroAcesso(_: { erro?: string } | undefined, form: FormData) {
  const email = String(form.get("email") ?? "");
  const senha = String(form.get("senha") ?? "");
  const confirmacao = String(form.get("confirmacao") ?? "");
  if (!email) return { erro: "Informe o e-mail." };
  if (senha.length < TAMANHO_MINIMO_SENHA) return { erro: `A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.` };
  if (senha !== confirmacao) return { erro: "As duas senhas não são iguais." };
  if (!(await definirPrimeiraSenha(email, senha))) {
    return { erro: "Este e-mail não está liberado para primeiro acesso. Se você já definiu sua senha, use a tela de login." };
  }
  redirect("/");
}
