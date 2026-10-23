"use server";

import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { ehCultivoLinha } from "@/lib/contabil/lancamento";
import { prisma } from "@/lib/db";
import { chaveDuplicata, lerPlanilhaLancamentos, LIMITE_LINHAS, type LinhaImportada } from "@/lib/importacao/lancamentosExcel";
import { exigirUsuario } from "@/lib/usuario";
import { ehDataIso } from "@/lib/validacao";

export type LinhaPrevia = LinhaImportada & { duplicada: boolean };
export type ResultadoAnalise = { ok: true; arquivo: string; linhas: LinhaPrevia[] } | { ok: false; erro: string };

const TAMANHO_MAXIMO = 4 * 1024 * 1024;

/** Lê a planilha enviada e devolve a prévia, sem gravar nada. */
export async function analisarPlanilha(form: FormData): Promise<ResultadoAnalise> {
  await exigirUsuario();
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, erro: "Escolha a planilha." };
  if (!/\.xlsx$/i.test(arquivo.name)) return { ok: false, erro: "Envie um arquivo .xlsx (Excel). Se estiver em .xls ou .csv, abra no Excel e salve como .xlsx." };
  if (arquivo.size > TAMANHO_MAXIMO) return { ok: false, erro: "Arquivo acima de 4 MB." };

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(await arquivo.arrayBuffer());
  } catch {
    return { ok: false, erro: "Não consegui abrir a planilha. Confira se é um .xlsx válido." };
  }
  // Primeira aba com a coluna "Conta débito"; normalmente a primeira.
  const contas = await prisma.conta.findMany({ where: { ativa: true }, select: { id: true, nome: true } });
  let lido: ReturnType<typeof lerPlanilhaLancamentos> = { linhas: [], erro: "A planilha está vazia." };
  for (const ws of wb.worksheets) {
    const valores = ws.getSheetValues(); // índice = número da linha; cada linha começa no índice 1
    const linhas = Array.from({ length: ws.rowCount }, (_, i) => {
      const v = valores[i + 1];
      return Array.isArray(v) ? v.slice(1) : [];
    });
    lido = lerPlanilhaLancamentos(linhas, contas);
    if (lido.linhas.length || !lido.erro?.startsWith("Não achei")) break;
  }
  if (lido.erro && !lido.linhas.length) return { ok: false, erro: lido.erro };
  if (lido.erro) return { ok: false, erro: lido.erro };

  const existentes = await chavesExistentes(lido.linhas.map((l) => l.data));
  const vistas = new Set<string>();
  const linhas = lido.linhas.map((l) => {
    const chave = chaveDuplicata(l);
    const duplicada = existentes.has(chave) || vistas.has(chave);
    vistas.add(chave);
    return { ...l, duplicada };
  });
  return { ok: true, arquivo: arquivo.name, linhas };
}

/** Chaves (data, valor, contas, histórico) dos lançamentos de duas pernas já gravados no período das datas. */
async function chavesExistentes(datas: string[]): Promise<Set<string>> {
  const validas = datas.filter(Boolean).sort();
  const existentes = new Set<string>();
  if (!validas.length) return existentes;
  const lancs = await prisma.lancamento.findMany({
    where: { data: { gte: new Date(validas[0]), lte: new Date(validas.at(-1)!) } },
    select: { data: true, historico: true, partidas: { select: { contaId: true, valorCentavos: true } } },
  });
  for (const l of lancs) {
    if (l.partidas.length !== 2) continue;
    const deb = l.partidas.find((p) => p.valorCentavos > 0);
    const cred = l.partidas.find((p) => p.valorCentavos < 0);
    if (!deb || !cred) continue;
    existentes.add(chaveDuplicata({ data: l.data.toISOString().slice(0, 10), valorCentavos: deb.valorCentavos, debitoId: deb.contaId, creditoId: cred.contaId, historico: l.historico ?? "" }));
  }
  return existentes;
}

export type ResultadoImportacao = { ok: true; criados: number } | { ok: false; erro: string };

/** Grava as linhas válidas escolhidas na prévia. Revalida tudo no servidor. */
export async function importarLancamentos(arquivo: string, linhas: LinhaImportada[], permitirDuplicadas = false): Promise<ResultadoImportacao> {
  const usuario = await exigirUsuario();
  if (typeof arquivo !== "string") return { ok: false, erro: "Arquivo inválido." };
  if (!Array.isArray(linhas) || !linhas.length) return { ok: false, erro: "Nada para importar." };
  if (linhas.length > LIMITE_LINHAS) return { ok: false, erro: `No máximo ${LIMITE_LINHAS} lançamentos por vez.` };
  const ativas = new Set((await prisma.conta.findMany({ where: { ativa: true }, select: { id: true } })).map((c) => c.id));
  const validas = linhas.filter(
    (l) =>
      ehDataIso(l.data) &&
      typeof l.historico === "string" &&
      l.historico.trim() &&
      l.debitoId &&
      l.creditoId &&
      l.debitoId !== l.creditoId &&
      ativas.has(l.debitoId) &&
      ativas.has(l.creditoId) &&
      Number.isSafeInteger(l.valorCentavos) &&
      l.valorCentavos > 0 &&
      (l.cultivo === null || l.cultivo === undefined || ehCultivoLinha(l.cultivo)),
  );
  if (validas.length !== linhas.length) return { ok: false, erro: "Há linhas inválidas na seleção. Analise a planilha de novo." };

  // Repetidos conferidos de novo aqui (não só na prévia): evita importar o mesmo arquivo duas vezes.
  if (!permitirDuplicadas) {
    const existentes = await chavesExistentes(validas.map((l) => l.data));
    const repetidas = validas.filter((l) => existentes.has(chaveDuplicata(l)));
    if (repetidas.length) return { ok: false, erro: `${repetidas.length} lançamento(s) já existem no sistema (ex.: linha ${repetidas[0].linha}). Analise a planilha de novo.` };
  }

  // Tudo numa transação só, com ids gerados aqui: duas instruções no banco, e nada fica pela metade.
  const lancamentos = validas.map((l) => ({ ...l, id: randomUUID(), quando: new Date(l.data) }));
  await prisma.$transaction([
    prisma.lancamento.createMany({
      data: lancamentos.map((l) => ({
        id: l.id,
        data: l.quando,
        historico: l.historico.trim(),
        origem: "IMPORTACAO",
        criadoPorId: usuario.id,
        atualizadoPorId: usuario.id,
      })),
    }),
    prisma.partida.createMany({
      data: lancamentos.flatMap((l) => [
        { lancamentoId: l.id, contaId: l.debitoId!, valorCentavos: l.valorCentavos, data: l.quando, atividade: l.cultivo ?? null },
        { lancamentoId: l.id, contaId: l.creditoId!, valorCentavos: -l.valorCentavos, data: l.quando, atividade: l.cultivo ?? null },
      ]),
    }),
  ]);
  await prisma.registroAuditoria.create({
    data: {
      usuarioId: usuario.id,
      entidade: "Importacao",
      entidadeId: arquivo.slice(0, 120),
      acao: "IMPORTAR",
      depois: { lancamentos: validas.length, totalCentavos: validas.reduce((s, l) => s + l.valorCentavos, 0), linhas: validas.map((l) => l.linha) },
    },
  });
  revalidatePath("/", "layout");
  return { ok: true, criados: validas.length };
}
