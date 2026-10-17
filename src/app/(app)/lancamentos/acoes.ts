"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { lerValorBr, validarLancamento, type LancamentoDigitado } from "@/lib/contabil/lancamento";
import { exigirUsuario } from "@/lib/usuario";

export type EstadoFormulario = { erros?: string[]; ok?: string } | undefined;

// Cada linha do formulário manda todos os campos (alguns ocultos), então os
// arrays de getAll() ficam alinhados por índice.
function lerFormulario(form: FormData): LancamentoDigitado | string[] {
  const col = (nome: string) => form.getAll(nome).map(String);
  const [contas, debitos, creditos, datas, historicos, fiscais, linhas] = [
    col("conta"), col("debito"), col("credito"), col("dataLinha"), col("historicoLinha"), col("fiscalLinha"), col("linhaPlanilha"),
  ];
  const erros: string[] = [];
  const partidas: LancamentoDigitado["partidas"] = [];
  for (let i = 0; i < contas.length; i++) {
    const d = lerValorBr(debitos[i] ?? "");
    const c = lerValorBr(creditos[i] ?? "");
    if (d === null && c === null && !contas[i]) continue; // linha em branco
    if (Number.isNaN(d) || Number.isNaN(c)) {
      erros.push(`Linha ${i + 1}: valor não reconhecido.`);
      continue;
    }
    if (d && c) {
      erros.push(`Linha ${i + 1}: preencha débito ou crédito, não os dois.`);
      continue;
    }
    partidas.push({
      contaId: contas[i],
      valorCentavos: d ? d : -(c ?? 0),
      data: datas[i] || null,
      historico: historicos[i]?.trim() || null,
      fiscal: fiscais[i] === "s" ? true : fiscais[i] === "n" ? false : null,
      linhaPlanilha: linhas[i] ? Number(linhas[i]) : null,
    });
  }
  if (erros.length) return erros;
  return { data: String(form.get("data") ?? ""), historico: String(form.get("historico") ?? "").trim(), partidas };
}

async function validar(form: FormData) {
  const lido = lerFormulario(form);
  if (Array.isArray(lido)) return { erros: lido };
  const contas = await prisma.conta.findMany({ where: { ativa: true }, select: { id: true } });
  const erros = validarLancamento(lido, new Set(contas.map((c) => c.id)));
  return erros.length ? { erros } : { lancamento: lido };
}

function partidasParaGravar(l: LancamentoDigitado): Prisma.PartidaCreateWithoutLancamentoInput[] {
  return l.partidas.map((p) => ({
    conta: { connect: { id: p.contaId } },
    valorCentavos: p.valorCentavos,
    data: new Date(p.data ?? l.data),
    historico: p.historico,
    fiscal: p.fiscal,
    linhaPlanilha: p.linhaPlanilha,
  }));
}

type LancamentoComPartidas = Prisma.LancamentoGetPayload<{ include: { partidas: true } }>;

/** Estado gravado na auditoria (antes/depois), em formato legível. */
function fotografia(l: LancamentoComPartidas) {
  return {
    data: l.data.toISOString().slice(0, 10),
    historico: l.historico,
    origem: l.origem,
    partidas: l.partidas.map((p) => ({
      contaId: p.contaId,
      valorCentavos: p.valorCentavos,
      data: p.data.toISOString().slice(0, 10),
      historico: p.historico,
    })),
  };
}

export async function criarLancamento(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const usuario = await exigirUsuario();
  const v = await validar(form);
  if (!v.lancamento) return { erros: v.erros };
  const l = v.lancamento;
  const origem = form.get("origem") === "DOCUMENTO" ? "DOCUMENTO" : "MANUAL";
  const criado = await prisma.$transaction(async (tx) => {
    const novo = await tx.lancamento.create({
      data: {
        data: new Date(l.data),
        historico: l.historico,
        origem,
        criadoPorId: usuario.id,
        atualizadoPorId: usuario.id,
        partidas: { create: partidasParaGravar(l) },
      },
      include: { partidas: true },
    });
    await tx.registroAuditoria.create({
      data: { usuarioId: usuario.id, entidade: "Lancamento", entidadeId: novo.id, acao: "CRIAR", depois: fotografia(novo) },
    });
    return novo;
  });
  revalidatePath("/", "layout");
  return { ok: criado.id };
}

export async function atualizarLancamento(id: string, _: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const usuario = await exigirUsuario();
  const v = await validar(form);
  if (!v.lancamento) return { erros: v.erros };
  const l = v.lancamento;
  await prisma.$transaction(async (tx) => {
    const antes = await tx.lancamento.findUniqueOrThrow({ where: { id }, include: { partidas: true } });
    // As partidas são recriadas: transações de extrato ligadas a elas voltam a pendentes.
    await tx.transacaoBancaria.updateMany({ where: { partida: { lancamentoId: id } }, data: { status: "PENDENTE", partidaId: null } });
    await tx.partida.deleteMany({ where: { lancamentoId: id } });
    const depois = await tx.lancamento.update({
      where: { id },
      data: {
        data: new Date(l.data),
        historico: l.historico,
        atualizadoPorId: usuario.id,
        partidas: { create: partidasParaGravar(l) },
      },
      include: { partidas: true },
    });
    await tx.registroAuditoria.create({
      data: {
        usuarioId: usuario.id,
        entidade: "Lancamento",
        entidadeId: id,
        acao: "ALTERAR",
        antes: fotografia(antes),
        depois: fotografia(depois),
      },
    });
  });
  revalidatePath("/", "layout");
  return { ok: id };
}

export async function excluirLancamento(id: string) {
  const usuario = await exigirUsuario();
  await prisma.$transaction(async (tx) => {
    const antes = await tx.lancamento.findUniqueOrThrow({ where: { id }, include: { partidas: true } });
    // Lançamento gerado pela baixa de uma conta a pagar/receber: o título volta a ficar em aberto.
    await tx.titulo.updateMany({
      where: { lancamentoId: id },
      data: { status: "ABERTO", baixadoEm: null, valorBaixaCentavos: null, contaBaixaId: null, lancamentoId: null },
    });
    // Transações de extrato conciliadas com este lançamento voltam a pendentes.
    await tx.transacaoBancaria.updateMany({ where: { partida: { lancamentoId: id } }, data: { status: "PENDENTE", partidaId: null } });
    await tx.lancamento.delete({ where: { id } });
    await tx.registroAuditoria.create({
      data: { usuarioId: usuario.id, entidade: "Lancamento", entidadeId: id, acao: "EXCLUIR", antes: fotografia(antes) },
    });
  });
  revalidatePath("/", "layout");
  redirect("/lancamentos");
}
