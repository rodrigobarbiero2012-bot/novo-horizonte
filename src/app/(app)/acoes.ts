"use server";

import { redirect } from "next/navigation";
import { sair, sairDeTodos } from "@/lib/usuario";

export async function acaoSair() {
  await sair();
  redirect("/login");
}

/** Encerra a sessão em todos os aparelhos (ex.: celular perdido) e volta ao login. */
export async function acaoSairDeTodos() {
  await sairDeTodos();
  redirect("/login");
}
