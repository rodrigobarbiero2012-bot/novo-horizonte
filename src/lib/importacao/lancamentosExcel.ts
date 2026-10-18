import { lerValorBr } from "../contabil/lancamento";

// Importação de lançamentos a partir de uma planilha no modelo do sistema:
// uma linha por lançamento — Data | Histórico | Conta débito | Conta crédito | Valor.
// Aqui ficam as partes puras (leitura e validação); o arquivo é aberto na ação.

export const COLUNAS_MODELO = ["Data", "Histórico", "Conta débito", "Conta crédito", "Valor"] as const;
export const LIMITE_LINHAS = 2000;

export type ContaImportacao = { id: string; nome: string };

export type LinhaImportada = {
  linha: number; // número da linha na planilha
  data: string; // aaaa-mm-dd
  historico: string;
  debito: string; // nome como veio na planilha
  credito: string;
  debitoId: string | null;
  creditoId: string | null;
  valorCentavos: number;
  erros: string[];
};

const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Valor de uma célula (exceljs pode trazer fórmula, texto rico, hyperlink ou data). */
export function valorCelula(v: unknown): string | number | Date | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date || typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    const o = v as { result?: unknown; richText?: { text: string }[]; text?: unknown };
    if ("result" in o) return valorCelula(o.result);
    if (o.richText) return o.richText.map((t) => t.text).join("");
    if (typeof o.text === "string") return o.text;
  }
  return null;
}

/** Data da célula: data do Excel (lida como UTC), "dd/mm/aaaa" ou "aaaa-mm-dd". */
export function lerData(v: string | number | Date | null): string | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  if (typeof v === "number" && v > 20000 && v < 80000) {
    // número de série do Excel (dias desde 30/12/1899)
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000).toISOString().slice(0, 10);
  }
  if (typeof v !== "string") return null;
  const t = v.trim();
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return valida(iso) ? iso : null;
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m && valida(t) ? t : null;
}
const valida = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
};

function lerValor(v: string | number | Date | null): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 100) : null;
  if (typeof v !== "string") return null;
  const c = lerValorBr(v);
  return c === null || Number.isNaN(c) ? null : c;
}

/**
 * Lê as linhas da planilha (primeira linha com os títulos das colunas, em
 * qualquer ordem) e valida cada lançamento contra o plano de contas.
 */
export function lerPlanilhaLancamentos(
  linhas: unknown[][],
  contas: ContaImportacao[],
): { linhas: LinhaImportada[]; erro?: string } {
  const indiceCabecalho = linhas.findIndex((l) => l.some((c) => semAcento(String(valorCelula(c) ?? "")) === "conta debito"));
  if (indiceCabecalho < 0) return { linhas: [], erro: `Não achei a linha de títulos. Use o modelo: ${COLUNAS_MODELO.join(" | ")}.` };
  const cab = linhas[indiceCabecalho].map((c) => semAcento(String(valorCelula(c) ?? "")));
  const col = Object.fromEntries(COLUNAS_MODELO.map((n) => [n, cab.indexOf(semAcento(n))])) as Record<(typeof COLUNAS_MODELO)[number], number>;
  const faltando = COLUNAS_MODELO.filter((n) => col[n] < 0);
  if (faltando.length) return { linhas: [], erro: `Faltam as colunas: ${faltando.join(", ")}.` };

  const porNome = new Map(contas.map((c) => [semAcento(c.nome), c.id]));
  const resultado: LinhaImportada[] = [];
  for (let i = indiceCabecalho + 1; i < linhas.length; i++) {
    const cel = (n: (typeof COLUNAS_MODELO)[number]) => valorCelula(linhas[i]?.[col[n]]);
    const vazia = COLUNAS_MODELO.every((n) => {
      const v = cel(n);
      return v === null || (typeof v === "string" && !v.trim());
    });
    if (vazia) continue;
    if (resultado.length >= LIMITE_LINHAS) return { linhas: resultado, erro: `A planilha passa de ${LIMITE_LINHAS} lançamentos; divida em arquivos menores.` };

    const erros: string[] = [];
    const data = lerData(cel("Data"));
    if (!data) erros.push("data inválida");
    const historico = String(cel("Histórico") ?? "").trim();
    if (!historico) erros.push("histórico vazio");
    const debito = String(cel("Conta débito") ?? "").trim();
    const credito = String(cel("Conta crédito") ?? "").trim();
    const debitoId = porNome.get(semAcento(debito)) ?? null;
    const creditoId = porNome.get(semAcento(credito)) ?? null;
    if (!debitoId) erros.push(debito ? `conta "${debito}" não existe` : "conta débito vazia");
    if (!creditoId) erros.push(credito ? `conta "${credito}" não existe` : "conta crédito vazia");
    if (debitoId && debitoId === creditoId) erros.push("débito e crédito na mesma conta");
    const valor = lerValor(cel("Valor"));
    if (valor === null || valor <= 0) erros.push("valor inválido (use número positivo)");

    resultado.push({ linha: i + 1, data: data ?? "", historico, debito, credito, debitoId, creditoId, valorCentavos: valor ?? 0, erros });
  }
  if (!resultado.length) return { linhas: [], erro: "Nenhum lançamento encontrado abaixo dos títulos." };
  return { linhas: resultado };
}

/** Chave para achar lançamento já existente (mesma data, valor, contas e histórico). */
export const chaveDuplicata = (l: { data: string; valorCentavos: number; debitoId: string | null; creditoId: string | null; historico: string }) =>
  [l.data, l.valorCentavos, l.debitoId, l.creditoId, semAcento(l.historico)].join("|");
