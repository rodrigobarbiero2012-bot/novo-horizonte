// Leitura das fontes públicas de cotação. Funções puras de parse (testáveis
// com HTML/JSON de exemplo) separadas das que fazem a requisição.

export type PontoCotacao = { data: string; valor: number }; // data ISO yyyy-mm-dd

const AGENTE = "Mozilla/5.0 (compatible; NovoHorizonte/1.0; gestao de sitio)";
/** Uma fonte travada não pode segurar o cron inteiro até a Vercel matar a função. */
const LIMITE_MS = 15_000;

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
  const resposta = await fetch(url, { headers: { "user-agent": AGENTE }, cache: "no-store", signal: AbortSignal.timeout(LIMITE_MS) });
  if (!resposta.ok) throw new Error(`CEPEA: HTTP ${resposta.status}`);
  return lerTabelaCepea(await resposta.text());
}

/**
 * Indicador do CEPEA republicado pelo Notícias Agrícolas (ex.: café arábica):
 * um bloco "Fechamento: dd/mm/aaaa" por dia, com a tabela Data | Valor R$ | Variação.
 */
export function lerIndicadorNoticias(html: string): PontoCotacao[] {
  const pontos: PontoCotacao[] = [];
  for (const bloco of html.split(/<div class="fechamento">\s*Fechamento:\s*/).slice(1)) {
    for (const linha of bloco.slice(0, bloco.indexOf("</table>")).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
      const [data, valor] = [...linha[1].matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((m) => m[1].trim());
      if (!data || !/^\d{2}\/\d{2}\/\d{4}$/.test(data)) continue;
      const v = numeroBr(valor ?? "");
      if (Number.isFinite(v) && v > 0) pontos.push({ data: dataBr(data), valor: v });
    }
  }
  if (!pontos.length) throw new Error("Notícias Agrícolas: nenhuma linha de cotação lida (layout mudou?)");
  return pontos;
}

/**
 * Café arábica: o site do CEPEA bloqueia os servidores da Vercel (HTTP 403),
 * então a fonte principal é o mesmo indicador no Notícias Agrícolas; o CEPEA
 * direto fica como reserva.
 */
export async function buscarCafeArabica(urlNoticias: string, urlCepea: string): Promise<PontoCotacao[]> {
  try {
    const resposta = await fetch(urlNoticias, { headers: { "user-agent": AGENTE }, cache: "no-store", signal: AbortSignal.timeout(LIMITE_MS) });
    if (!resposta.ok) throw new Error(`Notícias Agrícolas: HTTP ${resposta.status}`);
    return lerIndicadorNoticias(await resposta.text());
  } catch (e) {
    try {
      return await buscarCepea(urlCepea);
    } catch (e2) {
      throw new Error(`${e instanceof Error ? e.message : e}; reserva ${e2 instanceof Error ? e2.message : e2}`);
    }
  }
}

/**
 * "Indicador da Vaca" (Datagro) publicado pelo Notícias Agrícolas: a página traz
 * vários dias, cada um num bloco "Fechamento: dd/mm/aaaa" seguido de uma tabela
 * Estado | R$/@ | Variação | US$/@. Devolve o valor do estado pedido em cada dia.
 */
export function lerIndicadorVaca(html: string, estado = "São Paulo"): PontoCotacao[] {
  const pontos: PontoCotacao[] = [];
  const blocos = html.split(/<div class="fechamento">\s*Fechamento:\s*/).slice(1);
  for (const bloco of blocos) {
    const data = bloco.match(/^(\d{2}\/\d{2}\/\d{4})/)?.[1];
    if (!data) continue;
    const tabela = bloco.slice(0, bloco.indexOf("</table>"));
    for (const linha of tabela.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
      const celulas = [...linha[1].matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((m) => m[1].trim());
      if (celulas[0] !== estado) continue;
      const valor = numeroBr(celulas[1] ?? "");
      if (Number.isFinite(valor) && valor > 0) pontos.push({ data: dataBr(data), valor });
    }
  }
  if (!pontos.length) throw new Error(`Indicador da Vaca: nenhuma cotação de ${estado} lida (layout mudou?)`);
  return pontos;
}

/**
 * "Maracujá - Ceasas" do Notícias Agrícolas: um bloco por dia, com várias
 * centrais na mesma tabela. A linha da central vem com "***" nos valores; as
 * linhas seguintes são os tipos dela. Devolve o primeiro tipo "Azedo…" da
 * central pedida (na Ceagesp, "Azedo 4A"), em R$/kg.
 */
export function lerMaracujaCeasa(html: string, central = "Ceagesp/SP"): PontoCotacao[] {
  const pontos: PontoCotacao[] = [];
  for (const bloco of html.split(/<div class="fechamento">\s*Fechamento:\s*/).slice(1)) {
    const data = bloco.match(/^(\d{2}\/\d{2}\/\d{4})/)?.[1];
    if (!data) continue;
    let secao = "";
    for (const linha of bloco.slice(0, bloco.indexOf("</table>")).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
      const [tipo, preco] = [...linha[1].matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((m) => m[1].trim());
      if (!tipo) continue;
      if (preco === "***") {
        secao = tipo;
        continue;
      }
      if (secao !== central || !/^azedo/i.test(tipo)) continue;
      const valor = numeroBr(preco ?? "");
      if (Number.isFinite(valor) && valor > 0) pontos.push({ data: dataBr(data), valor });
      break;
    }
  }
  if (!pontos.length) throw new Error(`Maracujá: nenhuma cotação de ${central} lida (layout mudou?)`);
  return pontos;
}

export async function buscarMaracuja(url: string): Promise<PontoCotacao[]> {
  const resposta = await fetch(url, { headers: { "user-agent": AGENTE }, cache: "no-store", signal: AbortSignal.timeout(LIMITE_MS) });
  if (!resposta.ok) throw new Error(`Notícias Agrícolas: HTTP ${resposta.status}`);
  return lerMaracujaCeasa(await resposta.text());
}

export async function buscarVacaGorda(url: string): Promise<PontoCotacao[]> {
  const resposta = await fetch(url, { headers: { "user-agent": AGENTE }, cache: "no-store", signal: AbortSignal.timeout(LIMITE_MS) });
  if (!resposta.ok) throw new Error(`Notícias Agrícolas: HTTP ${resposta.status}`);
  return lerIndicadorVaca(await resposta.text());
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
  const resposta = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(LIMITE_MS) });
  if (!resposta.ok) throw new Error(`Banco Central: HTTP ${resposta.status}`);
  return lerPtax(await resposta.json());
}
