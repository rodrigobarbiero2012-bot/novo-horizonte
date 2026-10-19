"use server";

import { revalidatePath } from "next/cache";
import { lerValorBr } from "@/lib/contabil/lancamento";
import { prisma } from "@/lib/db";
import { ATIVIDADES_PRODUCAO, ehSlugProducao } from "@/lib/producao/atividades";
import { exigirUsuario } from "@/lib/usuario";
import { ehDataIso, ehId, lerNumeroBr } from "@/lib/validacao";
import { aEntregar, ehModalidade } from "@/lib/vendas/calculo";
import { criarTituloDaEntrega, desfazerEntregaTx, registrarEntregaTx } from "@/lib/vendas/entregas";

export type EstadoVenda = { erro?: string; ok?: string } | undefined;

const texto = (form: FormData, campo: string) => String(form.get(campo) ?? "").trim();
const dataOpcional = (v: string) => (v ? (ehDataIso(v) ? new Date(v) : undefined) : null); // undefined = inválida

function revalidar() {
  revalidatePath("/a-pagar-receber");
  revalidatePath("/producao", "layout");
  revalidatePath("/");
}

async function auditar(usuarioId: string, entidadeId: string, acao: string, dados?: object) {
  await prisma.registroAuditoria.create({ data: { usuarioId, entidade: "Venda", entidadeId, acao, depois: dados } });
}

/** Preço por unidade em centavos (positivo), ou null se vazio; NaN se inválido. */
function lerPreco(v: string) {
  const c = lerValorBr(v);
  return c === null ? null : Number.isNaN(c) || c <= 0 ? NaN : c;
}

export async function criarVenda(slug: string, _: EstadoVenda, form: FormData): Promise<EstadoVenda> {
  const usuario = await exigirUsuario();
  if (!ehSlugProducao(slug)) return { erro: "Atividade inválida." };
  const def = ATIVIDADES_PRODUCAO[slug];
  const comprador = texto(form, "comprador");
  const dataContrato = texto(form, "dataContrato");
  const quantidade = lerNumeroBr(form.get("quantidade"));
  const modalidade = texto(form, "modalidade");
  const preco = lerPreco(texto(form, "preco"));
  const entregaPrevista = dataOpcional(texto(form, "entregaPrevista"));
  const pagamentoPrevisto = dataOpcional(texto(form, "pagamentoPrevisto"));
  const contaReceitaId = texto(form, "contaReceitaId");
  const entregueAgora = form.get("entregueAgora") === "on";

  if (!comprador) return { erro: "Informe o comprador." };
  if (!ehDataIso(dataContrato)) return { erro: "Data do contrato inválida." };
  if (quantidade === null || quantidade <= 0) return { erro: `Informe a quantidade em ${def.unidade}.` };
  if (!ehModalidade(modalidade)) return { erro: "Escolha a modalidade." };
  if (Number.isNaN(preco)) return { erro: "Preço inválido." };
  if (modalidade !== "A_FIXAR" && preco === null) return { erro: `Informe o preço por ${def.unidadeCurta}.` };
  if (entregaPrevista === undefined || pagamentoPrevisto === undefined) return { erro: "Data prevista inválida." };
  const conta = ehId(contaReceitaId) ? await prisma.conta.findUnique({ where: { id: contaReceitaId } }) : null;
  if (!conta || conta.categoria !== "Receita") return { erro: "Escolha a conta de receita." };

  const venda = await prisma.$transaction(async (tx) => {
    const v = await tx.venda.create({
      data: {
        atividade: def.chave,
        comprador,
        dataContrato: new Date(dataContrato),
        quantidade,
        precoUnitarioCentavos: modalidade === "A_FIXAR" ? null : preco,
        modalidade,
        entregaPrevista,
        pagamentoPrevisto,
        contaReceitaId: conta.id,
        observacao: texto(form, "observacao") || null,
        criadoPorId: usuario.id,
      },
    });
    if (entregueAgora) {
      await registrarEntregaTx(tx, v, { data: v.dataContrato, quantidade, vencimento: pagamentoPrevisto ?? v.dataContrato, usuarioId: usuario.id });
    }
    return v;
  });
  await auditar(usuario.id, venda.id, "CRIAR", { comprador, quantidade, modalidade, precoCentavos: venda.precoUnitarioCentavos, entregueAgora });
  revalidar();
  return { ok: entregueAgora ? "Venda registrada, entregue e lançada em contas a receber." : "Venda registrada." };
}

export async function registrarEntrega(vendaId: string, _: EstadoVenda, form: FormData): Promise<EstadoVenda> {
  const usuario = await exigirUsuario();
  if (!ehId(vendaId)) return { erro: "Registro inválido." };
  const data = texto(form, "data");
  const quantidade = lerNumeroBr(form.get("quantidade"));
  const vencimento = dataOpcional(texto(form, "vencimento"));
  if (!ehDataIso(data)) return { erro: "Data inválida." };
  if (quantidade === null || quantidade <= 0) return { erro: "Informe a quantidade entregue." };
  if (vencimento === undefined) return { erro: "Vencimento inválido." };

  const erro = await prisma.$transaction(async (tx) => {
    const venda = await tx.venda.findUnique({ where: { id: vendaId }, include: { entregas: { select: { quantidade: true } } } });
    if (!venda || venda.cancelada) return "Venda não encontrada ou cancelada.";
    const entregue = venda.entregas.reduce((s, e) => s + e.quantidade, 0);
    const falta = aEntregar({ quantidade: venda.quantidade, cancelada: false, entregue });
    if (quantidade > falta + 1e-6) return `Faltam só ${falta.toLocaleString("pt-BR")} para completar o contrato.`;
    await registrarEntregaTx(tx, venda, { data: new Date(data), quantidade, vencimento: vencimento ?? venda.pagamentoPrevisto ?? new Date(data), usuarioId: usuario.id });
    return null;
  });
  if (erro) return { erro };
  await auditar(usuario.id, vendaId, "ENTREGAR", { data, quantidade });
  revalidar();
  return { ok: "Entrega registrada." };
}

/** Fixa o preço de um contrato "a fixar" e cria as contas a receber das entregas já feitas. */
export async function fixarPreco(vendaId: string, _: EstadoVenda, form: FormData): Promise<EstadoVenda> {
  const usuario = await exigirUsuario();
  if (!ehId(vendaId)) return { erro: "Registro inválido." };
  const preco = lerPreco(texto(form, "preco"));
  const vencimento = dataOpcional(texto(form, "vencimento"));
  if (preco === null || Number.isNaN(preco)) return { erro: "Informe o preço." };
  if (vencimento === undefined) return { erro: "Vencimento inválido." };

  const erro = await prisma.$transaction(async (tx) => {
    const { count } = await tx.venda.updateMany({ where: { id: vendaId, precoUnitarioCentavos: null }, data: { precoUnitarioCentavos: preco } });
    if (count !== 1) return "Este contrato já tem preço.";
    const venda = await tx.venda.findUniqueOrThrow({ where: { id: vendaId } });
    const pendentes = await tx.movimentoProducao.findMany({ where: { vendaId, valorCentavos: null } });
    for (const e of pendentes) {
      await tx.movimentoProducao.update({ where: { id: e.id }, data: { valorCentavos: Math.round(e.quantidade * preco) } });
      await criarTituloDaEntrega(tx, venda, e, vencimento ?? venda.pagamentoPrevisto ?? e.data, usuario.id);
    }
    return null;
  });
  if (erro) return { erro };
  await auditar(usuario.id, vendaId, "FIXAR_PRECO", { precoCentavos: preco });
  revalidar();
  return { ok: "Preço fixado." };
}

/** Cancela o que falta entregar (as entregas feitas continuam valendo); chamar de novo reativa. */
export async function alternarCancelamento(vendaId: string) {
  const usuario = await exigirUsuario();
  if (!ehId(vendaId)) return;
  const v = await prisma.venda.findUnique({ where: { id: vendaId }, select: { cancelada: true } });
  if (!v) return;
  await prisma.venda.update({ where: { id: vendaId }, data: { cancelada: !v.cancelada } });
  await auditar(usuario.id, vendaId, v.cancelada ? "REATIVAR" : "CANCELAR");
  revalidar();
}

/** Exclui um contrato lançado por engano — só sem entregas. */
export async function excluirVenda(vendaId: string): Promise<string | undefined> {
  const usuario = await exigirUsuario();
  if (!ehId(vendaId)) return;
  const { count } = await prisma.venda.deleteMany({ where: { id: vendaId, entregas: { none: {} } } });
  if (count !== 1) return "Desfaça as entregas antes de excluir a venda.";
  await auditar(usuario.id, vendaId, "EXCLUIR");
  revalidar();
}

export async function desfazerEntrega(movimentoId: string): Promise<string | undefined> {
  const usuario = await exigirUsuario();
  if (!ehId(movimentoId)) return;
  const m = await prisma.movimentoProducao.findUnique({ where: { id: movimentoId }, select: { vendaId: true, quantidade: true } });
  if (!m?.vendaId) return;
  const erro = await prisma.$transaction((tx) => desfazerEntregaTx(tx, movimentoId));
  if (erro) return erro;
  await auditar(usuario.id, m.vendaId, "DESFAZER_ENTREGA", { quantidade: m.quantidade });
  revalidar();
}
