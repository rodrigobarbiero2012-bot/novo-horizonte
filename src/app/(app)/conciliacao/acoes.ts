"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { casarAutomaticamente } from "@/lib/conciliacao/casamento";
import { decodificarOfx, lerOfx } from "@/lib/conciliacao/ofx";
import { CATEGORIAS_BAIXA } from "@/lib/titulos/categorias";
import { exigirUsuario } from "@/lib/usuario";

export type EstadoConciliacao = { erro?: string; ok?: string } | undefined;

const TAMANHO_MAXIMO = 4 * 1024 * 1024;
const iso = (d: Date) => d.toISOString().slice(0, 10);

function revalidar() {
  revalidatePath("/conciliacao");
  revalidatePath("/lancamentos");
}

async function contaConciliavel(contaId: string) {
  const conta = await prisma.conta.findUnique({ where: { id: contaId } });
  return conta && CATEGORIAS_BAIXA.includes(conta.categoria) ? conta : null;
}

/** Casa as transações pendentes da conta com partidas ainda não conciliadas. Devolve quantas casou. */
async function conciliarPendentes(contaId: string): Promise<number> {
  const pendentes = await prisma.transacaoBancaria.findMany({ where: { contaId, status: "PENDENTE" }, select: { id: true, data: true, valorCentavos: true } });
  if (!pendentes.length) return 0;
  const datas = pendentes.map((t) => t.data.getTime());
  const partidas = await prisma.partida.findMany({
    where: {
      contaId,
      transacaoBancaria: null,
      data: { gte: new Date(Math.min(...datas) - 3 * 86_400_000), lte: new Date(Math.max(...datas) + 3 * 86_400_000) },
    },
    select: { id: true, data: true, valorCentavos: true },
  });
  const pares = casarAutomaticamente(
    pendentes.map((t) => ({ id: t.id, data: iso(t.data), valorCentavos: t.valorCentavos })),
    partidas.map((p) => ({ id: p.id, data: iso(p.data), valorCentavos: p.valorCentavos })),
  );
  for (const par of pares) {
    await prisma.transacaoBancaria.update({ where: { id: par.transacaoId }, data: { status: "CONCILIADA", partidaId: par.partidaId } });
  }
  return pares.length;
}

export async function importarExtrato(contaId: string, _: EstadoConciliacao, form: FormData): Promise<EstadoConciliacao> {
  const usuario = await exigirUsuario();
  const conta = await contaConciliavel(contaId);
  if (!conta) return { erro: "Escolha uma conta bancária (ou a CC do sócio)." };
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Escolha o arquivo OFX." };
  if (arquivo.size > TAMANHO_MAXIMO) return { erro: "Arquivo acima de 4 MB; exporte um período menor." };

  let extrato;
  try {
    extrato = lerOfx(decodificarOfx(new Uint8Array(await arquivo.arrayBuffer())));
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não foi possível ler o arquivo." };
  }
  if (!extrato.transacoes.length) return { erro: "O arquivo não tem transações." };

  const importacao = await prisma.importacaoExtrato.create({
    data: {
      contaId,
      arquivo: arquivo.name.slice(0, 200),
      banco: extrato.banco,
      inicio: extrato.inicio ? new Date(extrato.inicio) : null,
      fim: extrato.fim ? new Date(extrato.fim) : null,
      saldoFinalCentavos: extrato.saldoFinalCentavos,
      dataSaldo: extrato.dataSaldo ? new Date(extrato.dataSaldo) : null,
      novas: 0,
      repetidas: 0,
      criadoPorId: usuario.id,
    },
  });
  // Re-importar o mesmo período não duplica: (conta, fitid) é único.
  const { count: novas } = await prisma.transacaoBancaria.createMany({
    data: extrato.transacoes.map((t) => ({
      importacaoId: importacao.id,
      contaId,
      fitid: t.fitid,
      data: new Date(t.data),
      valorCentavos: t.valorCentavos,
      descricao: t.descricao,
    })),
    skipDuplicates: true,
  });
  const repetidas = extrato.transacoes.length - novas;
  await prisma.importacaoExtrato.update({ where: { id: importacao.id }, data: { novas, repetidas } });
  const casadas = await conciliarPendentes(contaId);
  await prisma.registroAuditoria.create({
    data: { usuarioId: usuario.id, entidade: "ImportacaoExtrato", entidadeId: importacao.id, acao: "IMPORTAR", depois: { conta: conta.nome, arquivo: arquivo.name, novas, repetidas, casadas } },
  });
  revalidar();
  return {
    ok: `${novas} transação(ões) nova(s)${repetidas ? `, ${repetidas} já importada(s) antes` : ""}; ${casadas} conciliada(s) automaticamente.`,
  };
}

export async function conciliarAutomatico(contaId: string) {
  await exigirUsuario();
  if (!(await contaConciliavel(contaId))) return;
  await conciliarPendentes(contaId);
  revalidar();
}

export async function conciliarManual(transacaoId: string, partidaId: string) {
  const usuario = await exigirUsuario();
  const [t, p] = await Promise.all([
    prisma.transacaoBancaria.findUnique({ where: { id: transacaoId } }),
    prisma.partida.findUnique({ where: { id: partidaId }, include: { transacaoBancaria: true } }),
  ]);
  if (!t || !p || t.status !== "PENDENTE" || p.contaId !== t.contaId || p.transacaoBancaria) return;
  await prisma.transacaoBancaria.update({ where: { id: transacaoId }, data: { status: "CONCILIADA", partidaId } });
  await prisma.registroAuditoria.create({ data: { usuarioId: usuario.id, entidade: "TransacaoBancaria", entidadeId: transacaoId, acao: "CONCILIAR", depois: { partidaId } } });
  revalidar();
}

/** Cria o lançamento que faltava (transação do extrato sem lançamento no sistema) e já concilia. */
export async function lancarTransacao(transacaoId: string, _: EstadoConciliacao, form: FormData): Promise<EstadoConciliacao> {
  const usuario = await exigirUsuario();
  const contrapartidaId = String(form.get("contaId") ?? "");
  const historico = String(form.get("historico") ?? "").trim();
  if (!historico) return { erro: "Informe o histórico." };
  const t = await prisma.transacaoBancaria.findUnique({ where: { id: transacaoId } });
  if (!t || t.status !== "PENDENTE") return { erro: "Transação já tratada." };
  const contrapartida = await prisma.conta.findUnique({ where: { id: contrapartidaId } });
  if (!contrapartida || contrapartida.id === t.contaId) return { erro: "Escolha a conta." };

  await prisma.$transaction(async (tx) => {
    const lancamento = await tx.lancamento.create({
      data: {
        data: t.data,
        historico,
        origem: "EXTRATO",
        criadoPorId: usuario.id,
        atualizadoPorId: usuario.id,
        partidas: {
          create: [
            { contaId: t.contaId, valorCentavos: t.valorCentavos, data: t.data, historico },
            { contaId: contrapartida.id, valorCentavos: -t.valorCentavos, data: t.data, historico },
          ],
        },
      },
      include: { partidas: true },
    });
    const partidaDaConta = lancamento.partidas.find((p) => p.contaId === t.contaId)!;
    await tx.transacaoBancaria.update({ where: { id: transacaoId }, data: { status: "CONCILIADA", partidaId: partidaDaConta.id } });
    await tx.registroAuditoria.create({
      data: { usuarioId: usuario.id, entidade: "Lancamento", entidadeId: lancamento.id, acao: "CRIAR", depois: { origem: "EXTRATO", historico, valorCentavos: t.valorCentavos, contrapartida: contrapartida.nome } },
    });
  });
  revalidar();
  return { ok: "Lançado e conciliado." };
}

export async function ignorarTransacao(transacaoId: string) {
  const usuario = await exigirUsuario();
  await prisma.transacaoBancaria.updateMany({ where: { id: transacaoId, status: "PENDENTE" }, data: { status: "IGNORADA" } });
  await prisma.registroAuditoria.create({ data: { usuarioId: usuario.id, entidade: "TransacaoBancaria", entidadeId: transacaoId, acao: "IGNORAR" } });
  revalidar();
}

/** Volta a transação para pendente (desfaz conciliação ou "ignorar"). Não apaga lançamentos. */
export async function reabrirTransacao(transacaoId: string) {
  const usuario = await exigirUsuario();
  await prisma.transacaoBancaria.update({ where: { id: transacaoId }, data: { status: "PENDENTE", partidaId: null } });
  await prisma.registroAuditoria.create({ data: { usuarioId: usuario.id, entidade: "TransacaoBancaria", entidadeId: transacaoId, acao: "REABRIR" } });
  revalidar();
}
