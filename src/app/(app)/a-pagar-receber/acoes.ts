"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { vincularAnexo } from "@/lib/anexos";
import { prisma } from "@/lib/db";
import { lerValorBr } from "@/lib/contabil/lancamento";
import { CATEGORIAS_BAIXA, categoriasDoTitulo } from "@/lib/titulos/categorias";
import { dividirPagamento } from "@/lib/financiamentos/calculo";
import { gerarParcelas, partidasDaBaixa, type TipoTitulo } from "@/lib/titulos/regras";
import { exigirUsuario } from "@/lib/usuario";
import { ehDataIso, ehId } from "@/lib/validacao";

export type EstadoTitulo = { erro?: string; ok?: string } | undefined;

const dataValida = ehDataIso;
const revalidar = () => {
  revalidatePath("/a-pagar-receber");
  revalidatePath("/");
};

export async function criarTitulo(_: EstadoTitulo, form: FormData): Promise<EstadoTitulo> {
  const usuario = await exigirUsuario();
  const tipo = form.get("tipo") === "RECEBER" ? "RECEBER" : "PAGAR";
  const descricao = String(form.get("descricao") ?? "").trim();
  const contraparte = String(form.get("contraparte") ?? "").trim() || null;
  const vencimento = String(form.get("vencimento") ?? "");
  const contaId = String(form.get("contaId") ?? "");
  const valor = lerValorBr(String(form.get("valor") ?? ""));
  const parcelas = Math.trunc(Number(form.get("parcelas") ?? 1));
  const origem = form.get("origem") === "DOCUMENTO" ? "DOCUMENTO" : "MANUAL";

  if (!descricao) return { erro: "Informe a descrição." };
  if (valor === null || Number.isNaN(valor) || valor <= 0) return { erro: "Informe um valor maior que zero." };
  if (!dataValida(vencimento)) return { erro: "Vencimento inválido." };
  if (!(parcelas >= 1 && parcelas <= 60)) return { erro: "Parcelas: de 1 a 60." };
  const conta = await prisma.conta.findUnique({ where: { id: contaId } });
  if (!conta || !categoriasDoTitulo(tipo).includes(conta.categoria)) return { erro: "Escolha a conta." };

  const grupoParcelasId = parcelas > 1 ? randomUUID() : null;
  const dados = gerarParcelas(valor, parcelas, vencimento).map((p) => ({
    tipo,
    descricao,
    contraparte,
    valorCentavos: p.valorCentavos,
    vencimento: new Date(p.vencimento),
    contaId,
    numeroDocumento: String(form.get("numeroDocumento") ?? "").trim() || null,
    linhaDigitavel: String(form.get("linhaDigitavel") ?? "").trim() || null,
    grupoParcelasId,
    parcela: parcelas > 1 ? p.parcela : null,
    totalParcelas: parcelas > 1 ? parcelas : null,
    origem,
    criadoPorId: usuario.id,
  }));
  await prisma.$transaction(async (tx) => {
    const criados = await tx.titulo.createManyAndReturn({ data: dados, select: { id: true, parcela: true } });
    // O arquivo do documento lido fica na 1ª parcela (a lista mostra para todas).
    const primeira = criados.find((t) => (t.parcela ?? 1) === 1) ?? criados[0];
    await vincularAnexo(tx, form.get("anexoId"), { tituloId: primeira.id });
    await tx.registroAuditoria.create({
      data: {
        usuarioId: usuario.id,
        entidade: "Titulo",
        entidadeId: grupoParcelasId ?? "avulso",
        acao: "CRIAR",
        depois: { tipo, descricao, contraparte, valorCentavos: valor, vencimento, parcelas, conta: conta.nome },
      },
    });
  });
  revalidar();
  const rotulo = tipo === "PAGAR" ? "Conta a pagar" : "Conta a receber";
  return { ok: parcelas > 1 ? `${rotulo} criada em ${parcelas} parcelas.` : `${rotulo} criada.` };
}

/** Paga ou recebe o título: gera o lançamento e liga os dois. */
export async function baixarTitulo(id: string, _: EstadoTitulo, form: FormData): Promise<EstadoTitulo> {
  const usuario = await exigirUsuario();
  if (!ehId(id)) return { erro: "Registro inválido." };
  const data = String(form.get("data") ?? "");
  const contaBaixaId = String(form.get("contaBaixaId") ?? "");
  const valor = lerValorBr(String(form.get("valor") ?? ""));
  if (!dataValida(data)) return { erro: "Data inválida." };
  if (valor === null || Number.isNaN(valor) || valor <= 0) return { erro: "Valor inválido." };
  const contaBaixa = await prisma.conta.findUnique({ where: { id: contaBaixaId } });
  if (!contaBaixa || !CATEGORIAS_BAIXA.includes(contaBaixa.categoria)) return { erro: "Escolha de onde sai (ou entra) o dinheiro." };

  const erro = await prisma.$transaction(async (tx) => {
    // Reserva o título antes de criar o lançamento: com dois cliques (ou os dois sócios ao mesmo
    // tempo) só um pedido muda ABERTO → BAIXADO; o outro recebe a mensagem e não gera lançamento.
    const { count } = await tx.titulo.updateMany({ where: { id, status: "ABERTO" }, data: { status: "BAIXADO" } });
    if (count !== 1) return "Este título não está em aberto.";
    const t = await tx.titulo.findUniqueOrThrow({ where: { id } });
    const tipo = t.tipo as TipoTitulo;
    // Parcela de financiamento: a parte além da amortização prevista vai para juros (inclusive multa/atraso).
    const fin = t.financiamentoId ? await tx.financiamento.findUnique({ where: { id: t.financiamentoId }, select: { contaJurosId: true } }) : null;
    const juros =
      fin && t.jurosCentavos !== null
        ? { contaJurosId: fin.contaJurosId, jurosCentavos: dividirPagamento(valor, t.valorCentavos, t.jurosCentavos).juros }
        : undefined;
    const parcela = t.parcela ? ` (${t.parcela}/${t.totalParcelas})` : "";
    const quando = new Date(data);
    const lancamento = await tx.lancamento.create({
      data: {
        data: quando,
        historico: `${tipo === "PAGAR" ? "pgto" : "receb."} ${t.descricao}${t.contraparte ? ` — ${t.contraparte}` : ""}${parcela}`,
        origem: "TITULO",
        criadoPorId: usuario.id,
        atualizadoPorId: usuario.id,
        partidas: { create: partidasDaBaixa(tipo, t.contaId, contaBaixaId, valor, juros).map((p) => ({ ...p, data: quando })) },
      },
    });
    await tx.titulo.update({
      where: { id },
      data: { baixadoEm: quando, valorBaixaCentavos: valor, contaBaixaId, lancamentoId: lancamento.id },
    });
    await tx.registroAuditoria.create({
      data: { usuarioId: usuario.id, entidade: "Titulo", entidadeId: id, acao: "BAIXAR", depois: { data, valorCentavos: valor, conta: contaBaixa.nome, lancamentoId: lancamento.id } },
    });
    return null;
  });
  if (erro) return { erro };
  revalidar();
  revalidatePath("/lancamentos");
  return { ok: "Baixa registrada e lançamento gerado." };
}

/** Desfaz a baixa: apaga o lançamento gerado e reabre o título. */
export async function estornarBaixa(id: string) {
  const usuario = await exigirUsuario();
  if (!ehId(id)) return;
  await prisma.$transaction(async (tx) => {
    const t = await tx.titulo.findUnique({ where: { id } });
    if (!t || t.status !== "BAIXADO") return;
    await tx.titulo.update({
      where: { id },
      data: { status: "ABERTO", baixadoEm: null, valorBaixaCentavos: null, contaBaixaId: null, lancamentoId: null },
    });
    if (t.lancamentoId) {
      // Comprovante anexado ao lançamento da baixa continua com o título.
      await tx.anexo.updateMany({ where: { lancamentoId: t.lancamentoId }, data: { lancamentoId: null, tituloId: id } });
      await tx.lancamento.delete({ where: { id: t.lancamentoId } });
    }
    await tx.registroAuditoria.create({
      data: { usuarioId: usuario.id, entidade: "Titulo", entidadeId: id, acao: "ESTORNAR_BAIXA", antes: { lancamentoId: t.lancamentoId } },
    });
  });
  revalidar();
  revalidatePath("/lancamentos");
}

/** Exclui um título em aberto (lançado por engano). Títulos baixados precisam do estorno antes. */
export async function excluirTitulo(id: string) {
  const usuario = await exigirUsuario();
  if (!ehId(id)) return;
  await prisma.$transaction(async (tx) => {
    const t = await tx.titulo.findUnique({ where: { id } });
    if (!t || t.status !== "ABERTO") return;
    // Parcela com o arquivo do documento: o arquivo passa para outra parcela do mesmo parcelamento.
    const outra = t.grupoParcelasId
      ? await tx.titulo.findFirst({ where: { grupoParcelasId: t.grupoParcelasId, id: { not: id } }, orderBy: { vencimento: "asc" }, select: { id: true } })
      : null;
    if (outra) await tx.anexo.updateMany({ where: { tituloId: id }, data: { tituloId: outra.id } });
    // Só apaga se ainda estiver em aberto (pode ter sido baixado por outro pedido nesse meio tempo).
    const { count } = await tx.titulo.deleteMany({ where: { id, status: "ABERTO" } });
    if (count !== 1) throw new Error("Título deixou de estar em aberto.");
    await tx.registroAuditoria.create({
      data: {
        usuarioId: usuario.id,
        entidade: "Titulo",
        entidadeId: id,
        acao: "EXCLUIR",
        antes: { descricao: t.descricao, valorCentavos: t.valorCentavos, vencimento: t.vencimento.toISOString().slice(0, 10) },
      },
    });
  });
  revalidar();
}
