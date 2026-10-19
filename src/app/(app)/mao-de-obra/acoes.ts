"use server";

import { revalidatePath } from "next/cache";
import { lerValorBr } from "@/lib/contabil/lancamento";
import { prisma } from "@/lib/db";
import { ehAtividadeMaoDeObra, ehTipoTrabalhador, partidasDoFechamento, resumirFechamento, valorApontamento } from "@/lib/maoDeObra/calculo";
import { CATEGORIAS_BAIXA } from "@/lib/titulos/categorias";
import { exigirUsuario } from "@/lib/usuario";
import { ehDataIso, ehId, lerNumeroBr } from "@/lib/validacao";

export type EstadoMaoDeObra = { erro?: string; ok?: string } | undefined;

const texto = (form: FormData, campo: string) => String(form.get(campo) ?? "").trim();
/** Valor em centavos opcional: null se vazio, NaN se inválido ou negativo. */
const valorOpcional = (v: string) => {
  const c = lerValorBr(v);
  return c === null ? null : Number.isNaN(c) || c < 0 ? NaN : c;
};

function revalidar() {
  revalidatePath("/mao-de-obra");
  revalidatePath("/", "layout");
}

async function auditar(usuarioId: string, entidade: string, entidadeId: string, acao: string, dados?: object) {
  await prisma.registroAuditoria.create({ data: { usuarioId, entidade, entidadeId, acao, depois: dados } });
}

/** Cadastra (ou atualiza, com `id`) uma pessoa da equipe. */
export async function salvarTrabalhador(_: EstadoMaoDeObra, form: FormData): Promise<EstadoMaoDeObra> {
  const usuario = await exigirUsuario();
  const id = texto(form, "id");
  const nome = texto(form, "nome");
  const tipo = texto(form, "tipo");
  const diaria = valorOpcional(texto(form, "diaria"));
  const preco = valorOpcional(texto(form, "precoUnidade"));
  if (!nome) return { erro: "Informe o nome." };
  if (!ehTipoTrabalhador(tipo)) return { erro: "Escolha o tipo." };
  if (Number.isNaN(diaria) || Number.isNaN(preco)) return { erro: "Valor inválido." };
  if (id && !ehId(id)) return { erro: "Registro inválido." };
  const dados = { nome, tipo, diariaCentavos: diaria, precoUnidadeCentavos: preco, observacao: texto(form, "observacao") || null };
  const t = id ? await prisma.trabalhador.update({ where: { id }, data: dados }) : await prisma.trabalhador.create({ data: dados });
  await auditar(usuario.id, "Trabalhador", t.id, id ? "ALTERAR" : "CRIAR", dados);
  revalidar();
  return { ok: id ? `"${nome}" atualizado.` : `"${nome}" cadastrado.` };
}

export async function alternarTrabalhador(id: string) {
  const usuario = await exigirUsuario();
  if (!ehId(id)) return;
  const t = await prisma.trabalhador.findUnique({ where: { id }, select: { ativo: true, nome: true } });
  if (!t) return;
  await prisma.trabalhador.update({ where: { id }, data: { ativo: !t.ativo } });
  await auditar(usuario.id, "Trabalhador", id, t.ativo ? "DESATIVAR" : "REATIVAR", { nome: t.nome });
  revalidar();
}

/**
 * Apontamento de um dia de serviço para a turma: campos comuns (data,
 * atividade, serviço, conta) e, por pessoa marcada, "dias:<id>", "qtd:<id>" e,
 * opcional, "valor:<id>" (substitui o cálculo pela diária/preço padrão).
 */
export async function registrarDia(_: EstadoMaoDeObra, form: FormData): Promise<EstadoMaoDeObra> {
  const usuario = await exigirUsuario();
  const data = texto(form, "data");
  const atividade = texto(form, "atividade");
  const servico = texto(form, "servico");
  const contaId = texto(form, "contaId");
  if (!ehDataIso(data)) return { erro: "Data inválida." };
  if (!ehAtividadeMaoDeObra(atividade)) return { erro: "Escolha a atividade." };
  if (!servico) return { erro: "Informe o serviço." };
  const conta = ehId(contaId) ? await prisma.conta.findUnique({ where: { id: contaId } }) : null;
  if (!conta || conta.categoria !== "Custeio") return { erro: "Escolha a conta de custeio." };

  const marcados = form.getAll("pessoa").map(String).filter(ehId);
  if (!marcados.length) return { erro: "Marque quem trabalhou." };
  const equipe = await prisma.trabalhador.findMany({ where: { id: { in: marcados } } });
  const dados = [];
  for (const t of equipe) {
    const dias = lerNumeroBr(form.get(`dias:${t.id}`)) ?? 0;
    const quantidade = lerNumeroBr(form.get(`qtd:${t.id}`));
    const valorDigitado = valorOpcional(texto(form, `valor:${t.id}`));
    if (dias < 0 || dias > 31 || (quantidade !== null && quantidade < 0) || Number.isNaN(valorDigitado)) return { erro: `Valores inválidos para ${t.nome}.` };
    const valorCentavos = valorDigitado ?? valorApontamento(dias, t.diariaCentavos, quantidade, t.precoUnidadeCentavos);
    if (valorCentavos <= 0) return { erro: `${t.nome}: informe dias, quantidade colhida ou o valor (sem diária/preço cadastrado não há como calcular).` };
    dados.push({ trabalhadorId: t.id, data: new Date(data), atividade, servico, dias, quantidade, valorCentavos, contaId: conta.id, criadoPorId: usuario.id });
  }
  await prisma.apontamento.createMany({ data: dados });
  await auditar(usuario.id, "Apontamento", data, "CRIAR", { servico, atividade, pessoas: dados.length, totalCentavos: dados.reduce((s, d) => s + d.valorCentavos, 0) });
  revalidar();
  return { ok: `${dados.length} apontamento${dados.length > 1 ? "s" : ""} registrado${dados.length > 1 ? "s" : ""}.` };
}

/** Exclui um apontamento ainda não pago. */
export async function excluirApontamento(id: string): Promise<string | undefined> {
  const usuario = await exigirUsuario();
  if (!ehId(id)) return;
  const { count } = await prisma.apontamento.deleteMany({ where: { id, fechamentoId: null } });
  if (count !== 1) return "Este apontamento já foi pago (fechado). Desfaça o fechamento antes.";
  await auditar(usuario.id, "Apontamento", id, "EXCLUIR");
  revalidar();
}

/** Fecha o período: tudo o que não foi pago entre as datas vira um lançamento e fica marcado como pago. */
export async function fecharPeriodo(_: EstadoMaoDeObra, form: FormData): Promise<EstadoMaoDeObra> {
  const usuario = await exigirUsuario();
  const inicio = texto(form, "inicio");
  const fim = texto(form, "fim");
  const dataPagamento = texto(form, "dataPagamento");
  const contaPagamentoId = texto(form, "contaPagamentoId");
  if (!ehDataIso(inicio) || !ehDataIso(fim) || inicio > fim) return { erro: "Período inválido." };
  if (!ehDataIso(dataPagamento)) return { erro: "Data do pagamento inválida." };
  const contaPagamento = ehId(contaPagamentoId) ? await prisma.conta.findUnique({ where: { id: contaPagamentoId } }) : null;
  if (!contaPagamento || !CATEGORIAS_BAIXA.includes(contaPagamento.categoria)) return { erro: "Escolha de onde saiu o pagamento." };

  const resultado = await prisma.$transaction(async (tx) => {
    const abertos = await tx.apontamento.findMany({
      where: { fechamentoId: null, data: { gte: new Date(inicio), lte: new Date(fim) } },
      include: { trabalhador: { select: { nome: true } } },
    });
    if (!abertos.length) return { erro: "Nada em aberto nesse período." };
    const r = resumirFechamento(abertos.map((a) => ({ ...a, nome: a.trabalhador.nome })));
    const quando = new Date(dataPagamento);
    const lancamento = await tx.lancamento.create({
      data: {
        data: quando,
        historico: `Mão de obra ${inicio.split("-").reverse().join("/")} a ${fim.split("-").reverse().join("/")} (${r.porPessoa.length} pessoa${r.porPessoa.length > 1 ? "s" : ""})`,
        origem: "MAO_DE_OBRA",
        criadoPorId: usuario.id,
        atualizadoPorId: usuario.id,
        partidas: { create: partidasDoFechamento(r, contaPagamento.id).map((p) => ({ ...p, data: quando })) },
      },
    });
    const fechamento = await tx.fechamentoMaoDeObra.create({
      data: { inicio: new Date(inicio), fim: new Date(fim), dataPagamento: quando, contaPagamentoId: contaPagamento.id, totalCentavos: r.totalCentavos, lancamentoId: lancamento.id, criadoPorId: usuario.id },
    });
    // Só marca os que continuam em aberto: se outro pedido fechou algum no meio tempo, nada é gravado.
    const { count } = await tx.apontamento.updateMany({ where: { id: { in: abertos.map((a) => a.id) }, fechamentoId: null }, data: { fechamentoId: fechamento.id } });
    if (count !== abertos.length) throw new Error("Apontamentos alterados durante o fechamento; tente de novo.");
    return { fechamentoId: fechamento.id, total: r.totalCentavos, pessoas: r.porPessoa.length };
  });
  if ("erro" in resultado) return { erro: resultado.erro };
  await auditar(usuario.id, "FechamentoMaoDeObra", resultado.fechamentoId, "CRIAR", { inicio, fim, totalCentavos: resultado.total });
  revalidar();
  return { ok: `Fechamento lançado: ${resultado.pessoas} pessoa(s), R$ ${(resultado.total / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.` };
}

/** Desfaz o fechamento: apaga o lançamento e os apontamentos voltam a ficar em aberto. */
export async function desfazerFechamento(id: string): Promise<string | undefined> {
  const usuario = await exigirUsuario();
  if (!ehId(id)) return;
  const f = await prisma.fechamentoMaoDeObra.findUnique({ where: { id }, select: { lancamentoId: true, totalCentavos: true } });
  if (!f) return;
  await prisma.$transaction(async (tx) => {
    // Extrato conciliado com este pagamento volta a pendente (como ao excluir um lançamento).
    await tx.transacaoBancaria.updateMany({ where: { partida: { lancamentoId: f.lancamentoId } }, data: { status: "PENDENTE", partidaId: null } });
    await tx.apontamento.updateMany({ where: { fechamentoId: id }, data: { fechamentoId: null } });
    await tx.lancamento.delete({ where: { id: f.lancamentoId } }); // apaga o fechamento junto (cascade)
  });
  await auditar(usuario.id, "FechamentoMaoDeObra", id, "DESFAZER", { totalCentavos: f.totalCentavos });
  revalidar();
}
