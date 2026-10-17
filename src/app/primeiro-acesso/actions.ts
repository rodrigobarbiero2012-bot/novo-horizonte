"use server";

import { redirect } from "next/navigation";
import { definirPrimeiraSenha, TAMANHO_MINIMO_SENHA } from "@/lib/usuario";

export async function acaoPrimeiroAcesso(_: { erro?: string } | undefined, form: FormData) {
  const convite = String(form.get("convite") ?? "");
  const senha = String(form.get("senha") ?? "");
  const confirmacao = String(form.get("confirmacao") ?? "");
  if (senha.length < TAMANHO_MINIMO_SENHA) return { erro: `A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.` };
  if (senha !== confirmacao) return { erro: "As duas senhas não são iguais." };
  if (!convite || !(await definirPrimeiraSenha(convite, senha))) {
    return { erro: "Convite inválido, já usado ou expirado. Peça um novo link ao outro sócio." };
  }
  redirect("/");
}
