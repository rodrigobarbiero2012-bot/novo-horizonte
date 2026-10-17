"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { lerValorBr } from "@/lib/contabil/lancamento";
import { ATIVIDADES_PRODUCAO, ehSlugProducao, type TipoMovimento } from "@/lib/producao/atividades";
import { exigirUsuario } from "@/lib/usuario";

export type EstadoProducao = { erro?: string; ok?: string } | undefined;

/** "1.234,5" / "1234.5" / "-3" → número; null se vazio ou inválido. */
function numero(texto: FormDataEntryValue | null): number | null {
  const t = String(texto ?? "").trim();
  if (!t) return null;
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

const revalidar = (slug: string) => {
  revalidatePath(`/producao/${slug}`);
  revalidatePath("/");
};

async function auditar(usuarioId: string, entidade: string, entidadeId: string, acao: string, dados: object) {
  await prisma.registroAuditoria.create({ data: { usuarioId, entidade, entidadeId, acao, depois: dados } });
}

export async function criarTalhao(slug: string, _: EstadoProducao, form: FormData): Promise<EstadoProducao> {
  const usuario = await exigirUsuario();
  if (!ehSlugProducao(slug)) return { erro: "Atividade inválida." };
  const nome = String(form.get("nome") ?? "").trim();
  const areaHa = numero(form.get("areaHa"));
  const anoPlantio = numero(form.get("anoPlantio"));
  const plantas = numero(form.get("plantas"));
  if (!nome) return { erro: "Informe o nome." };
  if (areaHa === null || areaHa <= 0) return { erro: "Informe a área em hectares (ex.: 12,5)." };
  if (anoPlantio !== null && !(anoPlantio >= 1950 && anoPlantio <= 2100)) return { erro: "Ano de plantio inválido." };
  const talhao = await prisma.talhao.create({
    data: {
      atividade: ATIVIDADES_PRODUCAO[slug].chave,
      nome,
      areaHa,
      variedade: String(form.get("variedade") ?? "").trim() || null,
      anoPlantio: anoPlantio !== null ? Math.trunc(anoPlantio) : null,
      plantas: plantas !== null ? Math.trunc(plantas) : null,
    },
  });
  await auditar(usuario.id, "Talhao", talhao.id, "CRIAR", { nome, areaHa });
  revalidar(slug);
  return { ok: `"${nome}" cadastrado.` };
}

export async function alternarTalhao(slug: string, id: string) {
  const usuario = await exigirUsuario();
  const t = await prisma.talhao.findUnique({ where: { id } });
  if (!t) return;
  await prisma.talhao.update({ where: { id }, data: { ativo: !t.ativo } });
  await auditar(usuario.id, "Talhao", id, t.ativo ? "DESATIVAR" : "REATIVAR", { nome: t.nome });
  revalidar(slug);
}

export async function registrarMovimento(slug: string, _: EstadoProducao, form: FormData): Promise<EstadoProducao> {
  const usuario = await exigirUsuario();
  if (!ehSlugProducao(slug)) return { erro: "Atividade inválida." };
  const def = ATIVIDADES_PRODUCAO[slug];
  const tipo = String(form.get("tipo") ?? "") as TipoMovimento;
  const data = String(form.get("data") ?? "");
  const quantidade = numero(form.get("quantidade"));
  const valor = lerValorBr(String(form.get("valor") ?? ""));
  const talhaoId = String(form.get("talhaoId") ?? "") || null;
  if (!def.tipos.some((t) => t.tipo === tipo)) return { erro: "Escolha o tipo." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { erro: "Data inválida." };
  if (quantidade === null || quantidade === 0 || (tipo !== "AJUSTE" && quantidade < 0)) {
    return { erro: tipo === "AJUSTE" ? "Informe a diferença (positiva ou negativa)." : "Informe a quantidade." };
  }
  if (Number.isNaN(valor)) return { erro: "Valor inválido." };
  if (talhaoId && !(await prisma.talhao.findFirst({ where: { id: talhaoId, atividade: def.chave } }))) return { erro: "Talhão inválido." };

  const mov = await prisma.movimentoProducao.create({
    data: {
      atividade: def.chave,
      data: new Date(data),
      tipo,
      quantidade,
      talhaoId,
      valorCentavos: valor ?? null,
      observacao: String(form.get("observacao") ?? "").trim() || null,
      criadoPorId: usuario.id,
    },
  });
  await auditar(usuario.id, "MovimentoProducao", mov.id, "CRIAR", { tipo, data, quantidade, valorCentavos: valor });
  revalidar(slug);
  return { ok: `${def.tipos.find((t) => t.tipo === tipo)!.rotulo} de ${quantidade.toLocaleString("pt-BR")} ${def.unidadeCurta} registrada.` };
}

export async function excluirMovimento(slug: string, id: string) {
  const usuario = await exigirUsuario();
  const m = await prisma.movimentoProducao.findUnique({ where: { id } });
  if (!m) return;
  await prisma.movimentoProducao.delete({ where: { id } });
  await auditar(usuario.id, "MovimentoProducao", id, "EXCLUIR", { tipo: m.tipo, quantidade: m.quantidade, data: m.data.toISOString().slice(0, 10) });
  revalidar(slug);
}
