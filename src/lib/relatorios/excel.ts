import "server-only";
import ExcelJS from "exceljs";

// Geração dos arquivos .xlsx. Valores monetários entram como número (em reais,
// não em centavos) com formato brasileiro, para o Excel somar e filtrar.

export type EstiloLinha = "secao" | "valor" | "total" | "destaque" | "pct" | "nota";

/** Relatório em grade: linhas (contas/totais) × colunas (anos, meses...). Valores em centavos; "pct" em fração (0,15 = 15%). */
export type Relatorio = {
  titulo: string;
  subtitulo?: string;
  colunas: string[];
  /** Colunas em percentual (fração), pelo índice; as demais são valores em centavos. */
  colunasPct?: number[];
  linhas: { rotulo: string; estilo: EstiloLinha; valores: (number | null)[] }[];
  notas?: string[];
};

/** Lista simples (ex.: lançamentos). */
export type Lista = {
  titulo: string;
  subtitulo?: string;
  colunas: { titulo: string; tipo: "texto" | "data" | "moeda" | "numero"; largura?: number }[];
  linhas: (string | number | null)[][]; // moeda em centavos; data em "aaaa-mm-dd"
  /** Nome da aba, quando diferente do título (máx. 31 caracteres). */
  aba?: string;
};

const MOEDA = '#,##0.00;[Red]-#,##0.00;"–"';
const PCT = '0.0%;[Red]-0.0%;"–"';
const VERDE = "FF1F5130";
const FUNDO_DESTAQUE = "FFEEF5EF";

function novoArquivo() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Novo Horizonte";
  wb.created = new Date();
  return wb;
}

function cabecalhoPlanilha(ws: ExcelJS.Worksheet, titulo: string, subtitulo: string | undefined, largura: number) {
  ws.addRow([titulo]).font = { bold: true, size: 14, color: { argb: VERDE } };
  ws.addRow([subtitulo ?? `Gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`]).font = {
    italic: true,
    size: 9,
    color: { argb: "FF78716C" },
  };
  ws.addRow([]);
  ws.mergeCells(1, 1, 1, Math.max(largura, 1));
  ws.mergeCells(2, 1, 2, Math.max(largura, 1));
}

export async function relatorioParaExcel(r: Relatorio): Promise<Buffer> {
  const wb = novoArquivo();
  const ws = wb.addWorksheet(r.titulo.slice(0, 31).replace(/[\\/?*[\]:]/g, "-"));
  cabecalhoPlanilha(ws, r.titulo, r.subtitulo, r.colunas.length + 1);

  const cab = ws.addRow(["R$", ...r.colunas]);
  cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cab.eachCell((c, coluna) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
    c.alignment = { horizontal: coluna === 1 ? "left" : "right" };
  });
  const linhaCabecalho = cab.number;

  for (const l of r.linhas) {
    const valores = l.valores.map((v, i) => {
      if (v === null) return null;
      return l.estilo === "pct" || r.colunasPct?.includes(i) ? v : v / 100;
    });
    const row = ws.addRow([l.estilo === "valor" ? `   ${l.rotulo}` : l.rotulo, ...(l.estilo === "secao" ? [] : valores)]);
    row.eachCell((c, coluna) => {
      if (coluna === 1) return;
      c.numFmt = l.estilo === "pct" || r.colunasPct?.includes(coluna - 2) ? PCT : MOEDA;
    });
    if (l.estilo === "secao") row.font = { bold: true, size: 9, color: { argb: VERDE } };
    if (l.estilo === "total") {
      row.font = { bold: true };
      row.eachCell((c) => (c.border = { top: { style: "thin", color: { argb: "FFD6D3D1" } } }));
    }
    if (l.estilo === "destaque") {
      row.font = { bold: true };
      for (let c = 1; c <= r.colunas.length + 1; c++) row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: FUNDO_DESTAQUE } };
    }
    if (l.estilo === "pct") row.font = { italic: true, color: { argb: "FF78716C" } };
  }

  for (const n of r.notas ?? []) {
    ws.addRow([]);
    ws.addRow([n]).font = { italic: true, size: 9, color: { argb: "FF78716C" } };
  }

  ws.getColumn(1).width = Math.min(60, Math.max(28, ...r.linhas.map((l) => l.rotulo.length + 4)));
  for (let i = 2; i <= r.colunas.length + 1; i++) ws.getColumn(i).width = 14;
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: linhaCabecalho }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function adicionarLista(wb: ExcelJS.Workbook, l: Lista) {
  const ws = wb.addWorksheet((l.aba ?? l.titulo).slice(0, 31).replace(/[\\/?*[\]:]/g, "-"));
  cabecalhoPlanilha(ws, l.titulo, l.subtitulo, l.colunas.length);
  const cab = ws.addRow(l.colunas.map((c) => c.titulo));
  cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cab.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } }));
  const linhaCabecalho = cab.number;

  for (const linha of l.linhas) {
    ws.addRow(
      linha.map((v, i) => {
        if (v === null || v === "") return null;
        const tipo = l.colunas[i].tipo;
        if (tipo === "moeda") return Number(v) / 100;
        if (tipo === "data") {
          const [a, m, d] = String(v).split("-").map(Number);
          return new Date(Date.UTC(a, m - 1, d));
        }
        return v;
      }),
    );
  }
  l.colunas.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = c.largura ?? (c.tipo === "texto" ? 30 : 14);
    if (c.tipo === "moeda") col.numFmt = MOEDA;
    if (c.tipo === "data") col.numFmt = "dd/mm/yyyy";
    if (c.tipo === "numero") col.numFmt = "#,##0.####";
  });
  if (l.linhas.length) ws.autoFilter = { from: { row: linhaCabecalho, column: 1 }, to: { row: linhaCabecalho, column: l.colunas.length } };
  ws.views = [{ state: "frozen", ySplit: linhaCabecalho }];
}

export async function listaParaExcel(l: Lista): Promise<Buffer> {
  return listasParaExcel([l]);
}

/** Várias listas no mesmo arquivo, uma por aba (ex.: backup completo). */
export async function listasParaExcel(listas: Lista[]): Promise<Buffer> {
  const wb = novoArquivo();
  for (const l of listas) adicionarLista(wb, l);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Modelo para importar lançamentos: aba "Lançamentos" (com 2 exemplos) e aba "Contas" com os nomes válidos. */
export async function modeloImportacao(contas: { nome: string; categoria: string; atividade: string }[]): Promise<Buffer> {
  const wb = novoArquivo();
  const ws = wb.addWorksheet("Lançamentos");
  const cab = ws.addRow(["Data", "Histórico", "Conta débito", "Conta crédito", "Valor"]);
  cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cab.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } }));
  const exemplo = (data: Date, historico: string, debito: string, credito: string, valor: number) =>
    (ws.addRow([data, historico, debito, credito, valor]).font = { italic: true, color: { argb: "FF78716C" } });
  const nome = (re: RegExp, padrao: string) => contas.find((c) => re.test(c.nome))?.nome ?? padrao;
  exemplo(new Date(Date.UTC(2026, 9, 2)), "EXEMPLO — apague esta linha: adubo NPK nf 123", nome(/^Custeio Adubos$/, "Custeio Adubos"), nome(/CC ACM/, "CC ACM (Capital Sócio)"), 1234.56);
  exemplo(new Date(Date.UTC(2026, 9, 5)), "EXEMPLO — apague esta linha: venda de café", nome(/CC ACM/, "CC ACM (Capital Sócio)"), nome(/^Receita.*Caf/i, "Receita Café"), 15000);
  ws.getColumn(1).width = 12;
  ws.getColumn(1).numFmt = "dd/mm/yyyy";
  ws.getColumn(2).width = 50;
  ws.getColumn(3).width = 34;
  ws.getColumn(4).width = 34;
  ws.getColumn(5).width = 14;
  ws.getColumn(5).numFmt = "#,##0.00";
  ws.views = [{ state: "frozen", ySplit: 1 }];
  // Lista suspensa com as contas nas colunas de débito e crédito.
  const fim = contas.length + 1;
  for (let linha = 2; linha <= 1001; linha++) {
    for (const coluna of ["C", "D"]) {
      ws.getCell(`${coluna}${linha}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`Contas!$A$2:$A$${fim}`],
        showErrorMessage: true,
        errorTitle: "Conta inexistente",
        error: "Escolha uma conta da aba Contas.",
      };
    }
  }

  const wc = wb.addWorksheet("Contas");
  const cabC = wc.addRow(["Conta", "Categoria", "Atividade"]);
  cabC.font = { bold: true };
  for (const c of contas) wc.addRow([c.nome, c.categoria, c.atividade]);
  wc.getColumn(1).width = 40;
  wc.getColumn(2).width = 26;
  wc.getColumn(3).width = 12;
  wc.autoFilter = { from: "A1", to: "C1" };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

