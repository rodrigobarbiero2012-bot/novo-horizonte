// Leitura das fontes públicas de cotação. Funções puras de parse (testáveis
// com HTML/JSON de exemplo) separadas das que fazem a requisição.

export type PontoCotacao = { data: string; valor: number }; // data ISO yyyy-mm-dd

const AGENTE = "Mozilla/5.0 (compatible; NovoHorizonte/1.0; gestao de sitio)";

/** "1.601,25" → 1601.25 */
const numeroBr = (s: string) => Number(s.trim().replace(/\./g, "").replace(",", "."));
/** "16/10/2026" → "2026-10-16" */
const dataBr = (s: string) => {
  const [d, m, a] = s.trim().split("/");
  return `${a}-${m}-${d}`;
};

/**
 * Indicador principal de uma página do CEPEA: a tabela id="imagenet-indicador1",
 * com linhas Data | Valor R$ | Var./Dia | Var./Mês | Valor US$ (mais recente primeiro).
 */
export function lerTabelaCepea(html: string): PontoCotacao[] {
  const inicio = html.indexOf('id="imagenet-indicador1"');
  if (inicio < 0) throw new Error("CEPEA: tabela do indicador não encontrada (layout mudou?)");
  const tabela = html.slice(inicio, html.indexOf("</table>", inicio));
  const pontos: PontoCotacao[] = [];
  // As linhas além das 5 primeiras vêm com class="imagenet-tbl-esconder" (escondidas por CSS), por isso <tr[^>]*>.
  for (const linha of tabela.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const celulas = [...linha[1].matchAll(/<td>([^<]*)<\/td>/g)].map((m) => m[1]);
    if (celulas.length < 2 || !/^\d{2}\/\d{2}\/\d{4}$/.test(celulas[0].trim())) continue;
    const valor = numeroBr(celulas[1]);
    if (Number.isFinite(valor) && valor > 0) pontos.push({ data: dataBr(celulas[0]), valor });
  }
  if (!pontos.length) throw new Error("CEPEA: nenhuma linha de cotação lida");
  return pontos;
}

export async function buscarCepea(url: string): Promise<PontoCotacao[]> {
  const resposta = await fetch(url, { headers: { "user-agent": AGENTE }, cache: "no-store" });
  if (!resposta.ok) throw new Error(`CEPEA: HTTP ${resposta.status}`);
  return lerTabelaCepea(await resposta.text());
}

/** Resposta da API PTAX do Banco Central (CotacaoDolarPeriodo). Último boletim de cada dia. */
export function lerPtax(json: { value: { cotacaoVenda: number; dataHoraCotacao: string }[] }): PontoCotacao[] {
  const porDia = new Map<string, number>();
  for (const v of json.value) porDia.set(v.dataHoraCotacao.slice(0, 10), v.cotacaoVenda);
  return [...porDia].map(([data, valor]) => ({ data, valor }));
}

export async function buscarDolarPtax(hoje = new Date()): Promise<PontoCotacao[]> {
  const fmt = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${d.getFullYear()}`;
  const inicio = new Date(hoje.getTime() - 20 * 86_400_000);
  const url =
    "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/" +
    "CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)" +
    `?@dataInicial='${fmt(inicio)}'&@dataFinalCotacao='${fmt(hoje)}'&$format=json&$select=cotacaoVenda,dataHoraCotacao`;
  const resposta = await fetch(url, { cache: "no-store" });
  if (!resposta.ok) throw new Error(`Banco Central: HTTP ${resposta.status}`);
  return lerPtax(await resposta.json());
}
