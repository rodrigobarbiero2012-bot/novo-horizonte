"use server";

import { revalidatePath } from "next/cache";
import { lerValorBr } from "@/lib/contabil/lancamento";
import { prisma } from "@/lib/db";
import { ehPeriodicidade, ehSistema, gerarCronograma } from "@/lib/financiamentos/calculo";
import { CATEGORIAS_BAIXA } from "@/lib/titulos/categorias";
import { exigirUsuario } from "@/lib/usuario";
import { ehDataIso, ehId, lerNumeroBr } from "@/lib/validacao";

export type EstadoFinanciamento = { erro?: string; ok?: string } | undefined;

const texto = (form: FormData, campo: string) => String(form.get(campo) ?? "").trim();
const inteiro = (form: FormData, campo: string) => {
  const n = lerNumeroBr(form.get(campo));
  return n !== null && Number.isInteger(n) ? n : null;
};

function revalidar() {
  revalidatePath("/financiamentos");
  revalidatePath("/", "layout");
}

/**
 * Cadastra o financiamento e cria as parcelas em contas a pagar. Para um
 * contrato antigo, informar o saldo devedor de hoje e as parcelas que faltam
 * (sem registrar a liberação, que já está na contabilidade).
 */
export async function criarFinanciamento(_: EstadoFinanciamento, form: FormData): Promise<EstadoFinanciamento> {
  const usuario = await exigirUsuario();
  const credor = texto(form, "credor");
  const descricao = texto(form, "descricao");
  const contaPassivoId = texto(form, "contaPassivoId");
  const contaJurosId = texto(form, "contaJurosId");
  const valor = lerValorBr(texto(form, "valor"));
  const taxa = lerNumeroBr(form.get("taxaAnual"));
  const sistema = texto(form, "sistema");
  const periodicidade = Number(texto(form, "periodicidade"));
  const parcelas = inteiro(form, "parcelas");
  const carencia = inteiro(form, "carencia") ?? 0;
  const dataContratacao = texto(form, "dataContratacao");
  const primeiroVencimento = texto(form, "primeiroVencimento");
  const registrarLiberacao = form.get("registrarLiberacao") === "on";
  const contaLiberacaoId = texto(form, "contaLiberacaoId");

  if (!credor || !descricao) return { erro: "Informe o banco e a finalidade." };
  if (valor === null || Number.isNaN(valor) || valor <= 0) return { erro: "Informe o valor (ou o saldo devedor de hoje)." };
  if (taxa === null || taxa < 0 || taxa > 100) return { erro: "Taxa de juros ao ano inválida." };
  if (!ehSistema(sistema)) return { erro: "Escolha o sistema de amortização." };
  if (!ehPeriodicidade(periodicidade)) return { erro: "Escolha a periodicidade." };
  if (parcelas === null || parcelas < 1 || parcelas > 480) return { erro: "Número de parcelas inválido." };
  if (carencia < 0 || carencia > 60) return { erro: "Carência inválida." };
  if (!ehDataIso(dataContratacao) || !ehDataIso(primeiroVencimento)) return { erro: "Datas inválidas." };
  if (primeiroVencimento < dataContratacao) return { erro: "O primeiro vencimento é antes da contratação." };
  const ids = [contaPassivoId, contaJurosId, ...(registrarLiberacao ? [contaLiberacaoId] : [])];
  if (!ids.every(ehId)) return { erro: "Escolha as contas." };
  const contas = await prisma.conta.findMany({ where: { id: { in: ids } } });
  const conta = (id: string) => contas.find((c) => c.id === id);
  if (conta(contaPassivoId)?.categoria !== "Passivo Empréstimo") return { erro: "Escolha a conta do empréstimo (passivo)." };
  if (conta(contaJurosId)?.categoria !== "Despesa Financeira") return { erro: "Escolha a conta de juros (despesa financeira)." };
  if (registrarLiberacao && !CATEGORIAS_BAIXA.includes(conta(contaLiberacaoId)?.categoria ?? "")) return { erro: "Escolha onde o dinheiro entrou." };

  const cronograma = gerarCronograma({
    valorCentavos: valor,
    taxaAnualPct: taxa,
    parcelas,
    carencia,
    sistema,
    periodicidadeMeses: periodicidade,
    primeiroVencimento,
  });
  const total = cronograma.length;

  const financiamento = await prisma.$transaction(async (tx) => {
    const liberacao = registrarLiberacao
      ? await tx.lancamento.create({
          data: {
            data: new Date(dataContratacao),
            historico: `Liberação ${descricao} — ${credor}`,
            origem: "FINANCIAMENTO",
            criadoPorId: usuario.id,
            atualizadoPorId: usuario.id,
            partidas: {
              create: [
                { contaId: contaLiberacaoId, valorCentavos: valor, data: new Date(dataContratacao) },
                { contaId: contaPassivoId, valorCentavos: -valor, data: new Date(dataContratacao) },
              ],
            },
          },
        })
      : null;
    const f = await tx.financiamento.create({
      data: {
        credor,
        descricao,
        contaPassivoId,
        contaJurosId,
        valorCentavos: valor,
        taxaAnualPct: taxa,
        sistema,
        periodicidadeMeses: periodicidade,
        parcelas,
        carencia,
        dataContratacao: new Date(dataContratacao),
        primeiroVencimento: new Date(primeiroVencimento),
        liberacaoLancamentoId: liberacao?.id ?? null,
        observacao: texto(form, "observacao") || null,
        criadoPorId: usuario.id,
      },
    });
    await tx.titulo.createMany({
      data: cronograma
        .filter((p) => p.parcela > 0)
        .map((p) => ({
          tipo: "PAGAR",
          descricao: `${descricao}${p.carencia ? " (só juros)" : ""}`,
          contraparte: credor,
          valorCentavos: p.parcela,
          jurosCentavos: p.juros,
          vencimento: new Date(p.vencimento),
          contaId: contaPassivoId,
          grupoParcelasId: f.id,
          parcela: p.numero,
          totalParcelas: total,
          origem: "FINANCIAMENTO",
          financiamentoId: f.id,
          criadoPorId: usuario.id,
        })),
    });
    return f;
  });
  await prisma.registroAuditoria.create({
    data: { usuarioId: usuario.id, entidade: "Financiamento", entidadeId: financiamento.id, acao: "CRIAR", depois: { credor, descricao, valorCentavos: valor, taxa, sistema, periodicidade, parcelas, carencia } },
  });
  revalidar();
  return { ok: `Financiamento cadastrado: ${total} parcelas em contas a pagar.` };
}

/** Exclui o financiamento e as parcelas em aberto. Recusa se alguma parcela já foi paga. */
export async function excluirFinanciamento(id: string): Promise<string | undefined> {
  const usuario = await exigirUsuario();
  if (!ehId(id)) return;
  const erro = await prisma.$transaction(async (tx) => {
    const f = await tx.financiamento.findUnique({ where: { id }, include: { titulos: { select: { status: true } } } });
    if (!f) return null;
    if (f.titulos.some((t) => t.status === "BAIXADO")) return "Há parcelas pagas. Desfaça os pagamentos em “A pagar e receber” antes de excluir.";
    await tx.titulo.deleteMany({ where: { financiamentoId: id, status: "ABERTO" } });
    await tx.financiamento.delete({ where: { id } });
    if (f.liberacaoLancamentoId) {
      await tx.transacaoBancaria.updateMany({ where: { partida: { lancamentoId: f.liberacaoLancamentoId } }, data: { status: "PENDENTE", partidaId: null } });
      await tx.lancamento.delete({ where: { id: f.liberacaoLancamentoId } });
    }
    return null;
  });
  if (erro) return erro;
  await prisma.registroAuditoria.create({ data: { usuarioId: usuario.id, entidade: "Financiamento", entidadeId: id, acao: "EXCLUIR" } });
  revalidar();
}
