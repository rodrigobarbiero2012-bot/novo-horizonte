"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ehAtividade, ehCategoria } from "@/lib/contabil/tipos";
import { exigirUsuario } from "@/lib/usuario";

export type EstadoConta = { erro?: string; ok?: string } | undefined;

const NATUREZA_CREDORA = new Set(["Passivo Empréstimo", "Passivo Fornecedor", "PL Capital Sócio", "Receita", "Receita Não Operacional"]);

export async function criarConta(_: EstadoConta, form: FormData): Promise<EstadoConta> {
  const usuario = await exigirUsuario();
  const nome = String(form.get("nome") ?? "").trim();
  const categoria = String(form.get("categoria") ?? "");
  const atividade = String(form.get("atividade") ?? "");
  if (!nome) return { erro: "Informe o nome da conta." };
  if (!ehCategoria(categoria)) return { erro: "Escolha a categoria." };
  if (!ehAtividade(atividade)) return { erro: "Escolha a atividade." };
  if (await prisma.conta.findUnique({ where: { nome } })) return { erro: `Já existe uma conta "${nome}".` };

  const conta = await prisma.conta.create({
    data: { nome, categoria, atividade, natureza: NATUREZA_CREDORA.has(categoria) ? "C" : "D" },
  });
  await prisma.registroAuditoria.create({
    data: { usuarioId: usuario.id, entidade: "Conta", entidadeId: conta.id, acao: "CRIAR", depois: { nome, categoria, atividade } },
  });
  revalidatePath("/", "layout");
  return { ok: `Conta "${nome}" criada.` };
}
