"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ATIVIDADES_CRONOGRAMA, ehSlugAtividade, MODELOS } from "@/lib/cronograma/modelos";
import { exigirUsuario } from "@/lib/usuario";

const caminho = (slug: string) => `/cronograma/${slug}`;

async function auditar(usuarioId: string, entidadeId: string, acao: string, dados: object) {
  await prisma.registroAuditoria.create({ data: { usuarioId, entidade: "TarefaCronograma", entidadeId, acao, depois: dados } });
}

/** Cria o cronograma do ano copiando o modelo da atividade (só se o ano ainda estiver vazio). */
export async function criarDoModelo(slug: string, ano: number) {
  const usuario = await exigirUsuario();
  if (!ehSlugAtividade(slug) || !Number.isInteger(ano)) return;
  const atividade = ATIVIDADES_CRONOGRAMA[slug].chave;
  if (await prisma.tarefaCronograma.count({ where: { atividade, ano } })) return;
  await prisma.tarefaCronograma.createMany({
    data: MODELOS[atividade].map((m, i) => ({ ...m, atividade, ano, ordem: i })),
  });
  await auditar(usuario.id, `${atividade}-${ano}`, "CRIAR_DO_MODELO", { atividade, ano, tarefas: MODELOS[atividade].length });
  revalidatePath(caminho(slug));
}

export async function alternarTarefa(slug: string, id: string) {
  const usuario = await exigirUsuario();
  const tarefa = await prisma.tarefaCronograma.findUnique({ where: { id } });
  if (!tarefa) return;
  const concluida = !tarefa.concluida;
  await prisma.tarefaCronograma.update({
    where: { id },
    data: concluida ? { concluida, concluidaEm: new Date(), concluidaPorId: usuario.id } : { concluida, concluidaEm: null, concluidaPorId: null },
  });
  await auditar(usuario.id, id, concluida ? "CONCLUIR" : "REABRIR", { titulo: tarefa.titulo });
  revalidatePath(caminho(slug));
}

export type EstadoTarefa = { erro?: string; ok?: string } | undefined;

export async function adicionarTarefa(slug: string, ano: number, _: EstadoTarefa, form: FormData): Promise<EstadoTarefa> {
  const usuario = await exigirUsuario();
  if (!ehSlugAtividade(slug)) return { erro: "Atividade inválida." };
  const atividade = ATIVIDADES_CRONOGRAMA[slug].chave;
  const titulo = String(form.get("titulo") ?? "").trim();
  const etapa = String(form.get("etapa") ?? "").trim();
  const mesInicio = Number(form.get("mesInicio"));
  const mesFim = Number(form.get("mesFim"));
  if (!titulo || !etapa) return { erro: "Informe a tarefa e a etapa." };
  if (!(mesInicio >= 1 && mesFim <= 12 && mesInicio <= mesFim)) return { erro: "O mês final precisa ser igual ou depois do inicial." };
  const ultima = await prisma.tarefaCronograma.findFirst({ where: { atividade, ano }, orderBy: { ordem: "desc" } });
  const tarefa = await prisma.tarefaCronograma.create({
    data: { atividade, ano, etapa, titulo, mesInicio, mesFim, ordem: (ultima?.ordem ?? -1) + 1 },
  });
  await auditar(usuario.id, tarefa.id, "CRIAR", { titulo, etapa, mesInicio, mesFim, ano });
  revalidatePath(caminho(slug));
  return { ok: `"${titulo}" adicionada.` };
}

export async function excluirTarefa(slug: string, id: string) {
  const usuario = await exigirUsuario();
  const tarefa = await prisma.tarefaCronograma.findUnique({ where: { id } });
  if (!tarefa) return;
  await prisma.tarefaCronograma.delete({ where: { id } });
  await auditar(usuario.id, id, "EXCLUIR", { titulo: tarefa.titulo, etapa: tarefa.etapa, ano: tarefa.ano });
  revalidatePath(caminho(slug));
}
