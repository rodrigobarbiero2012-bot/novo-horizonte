"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { chaveDuplicata, lerPlanilhaLancamentos, LIMITE_LINHAS, type LinhaImportada } from "@/lib/importacao/lancamentosExcel";
import { exigirUsuario } from "@/lib/usuario";

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

  // Duplicados: lançamentos de duas pernas já gravados com mesma data, valor, contas e histórico.
  const datas = lido.linhas.filter((l) => l.data).map((l) => l.data).sort();
  const existentes = new Set<string>();
  if (datas.length) {
    const lancs = await prisma.lancamento.findMany({
      where: { data: { gte: new Date(datas[0]), lte: new Date(datas.at(-1)!) } },
      select: { data: true, historico: true, partidas: { select: { contaId: true, valorCentavos: true } } },
    });
    for (const l of lancs) {
      if (l.partidas.length !== 2) continue;
      const deb = l.partidas.find((p) => p.valorCentavos > 0);
      const cred = l.partidas.find((p) => p.valorCentavos < 0);
      if (!deb || !cred) continue;
      existentes.add(chaveDuplicata({ data: l.data.toISOString().slice(0, 10), valorCentavos: deb.valorCentavos, debitoId: deb.contaId, creditoId: cred.contaId, historico: l.historico ?? "" }));
    }
  }
  const vistas = new Set<string>();
  const linhas = lido.linhas.map((l) => {
    const chave = chaveDuplicata(l);
    const duplicada = existentes.has(chave) || vistas.has(chave);
    vistas.add(chave);
    return { ...l, duplicada };
  });
  return { ok: true, arquivo: arquivo.name, linhas };
}

export type ResultadoImportacao = { ok: true; criados: number } | { ok: false; erro: string };

/** Grava as linhas válidas escolhidas na prévia. Revalida tudo no servidor. */
export async function importarLancamentos(arquivo: string, linhas: LinhaImportada[]): Promise<ResultadoImportacao> {
  const usuario = await exigirUsuario();
  if (!Array.isArray(linhas) || !linhas.length) return { ok: false, erro: "Nada para importar." };
  if (linhas.length > LIMITE_LINHAS) return { ok: false, erro: `No máximo ${LIMITE_LINHAS} lançamentos por vez.` };
  const ativas = new Set((await prisma.conta.findMany({ where: { ativa: true }, select: { id: true } })).map((c) => c.id));
  const validas = linhas.filter(
    (l) =>
      /^\d{4}-\d{2}-\d{2}$/.test(l.data) &&
      !Number.isNaN(Date.parse(l.data)) &&
      typeof l.historico === "string" &&
      l.historico.trim() &&
      l.debitoId &&
      l.creditoId &&
      l.debitoId !== l.creditoId &&
      ativas.has(l.debitoId) &&
      ativas.has(l.creditoId) &&
      Number.isSafeInteger(l.valorCentavos) &&
      l.valorCentavos > 0,
  );
  if (validas.length !== linhas.length) return { ok: false, erro: "Há linhas inválidas na seleção. Analise a planilha de novo." };

  // Em lotes, para não estourar o tempo de uma transação só no banco.
  const LOTE = 200;
  for (let i = 0; i < validas.length; i += LOTE) {
    await prisma.$transaction(
      validas.slice(i, i + LOTE).map((l) =>
        prisma.lancamento.create({
          data: {
            data: new Date(l.data),
            historico: l.historico.trim(),
            origem: "IMPORTACAO",
            criadoPorId: usuario.id,
            atualizadoPorId: usuario.id,
            partidas: {
              create: [
                { contaId: l.debitoId!, valorCentavos: l.valorCentavos, data: new Date(l.data) },
                { contaId: l.creditoId!, valorCentavos: -l.valorCentavos, data: new Date(l.data) },
              ],
            },
          },
        }),
      ),
    );
  }
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
