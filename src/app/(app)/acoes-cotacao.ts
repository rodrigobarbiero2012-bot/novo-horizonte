"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { lerValorBr } from "@/lib/contabil/lancamento";
import { ehProduto, PRODUTOS } from "@/lib/cotacoes/produtos";
import { exigirUsuario } from "@/lib/usuario";

export type EstadoCotacao = { erro?: string; ok?: string } | undefined;

/** Registro manual de cotação (hoje só o maracujá, que não tem fonte automática). */
export async function registrarCotacaoManual(_: EstadoCotacao, form: FormData): Promise<EstadoCotacao> {
  const usuario = await exigirUsuario();
  const produto = String(form.get("produto") ?? "");
  const data = String(form.get("data") ?? "");
  const centavos = lerValorBr(String(form.get("valor") ?? ""));
  if (!ehProduto(produto) || PRODUTOS[produto].automatica) return { erro: "Produto inválido." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { erro: "Data inválida." };
  if (centavos === null || Number.isNaN(centavos) || centavos <= 0) return { erro: "Informe o preço, ex.: 4,86" };

  const valor = centavos / 100;
  const cotacao = await prisma.cotacao.upsert({
    where: { produto_data: { produto, data: new Date(data) } },
    create: { produto, data: new Date(data), valor, origem: "MANUAL", criadoPorId: usuario.id },
    update: { valor, origem: "MANUAL", criadoPorId: usuario.id },
  });
  await prisma.registroAuditoria.create({
    data: { usuarioId: usuario.id, entidade: "Cotacao", entidadeId: cotacao.id, acao: "REGISTRAR", depois: { produto, data, valor } },
  });
  revalidatePath("/");
  return { ok: `${PRODUTOS[produto].nome}: R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} registrado.` };
}
