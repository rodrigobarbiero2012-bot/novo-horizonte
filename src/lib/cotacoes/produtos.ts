// Cotações acompanhadas no painel. Os dados do CEPEA são CC BY-NC 4.0:
// exigem citar a fonte, que aparece junto de cada cotação. A vaca gorda não tem
// indicador do CEPEA: vem do Indicador da Vaca (Datagro), praça São Paulo. O
// maracujá azedo vem da Ceagesp (tipo 4A), publicado pelo Notícias Agrícolas.

export type Produto = {
  nome: string;
  unidade: string;
  fonte: string;
  url: string;
  casas: number; // casas decimais na exibição
  automatica: boolean;
};

export const PRODUTOS = {
  CAFE_ARABICA: {
    nome: "Café arábica",
    unidade: "R$/saca 60 kg",
    fonte: "CEPEA/ESALQ",
    url: "https://www.cepea.org.br/br/indicador/cafe.aspx",
    casas: 2,
    automatica: true,
  },
  VACA_GORDA: {
    nome: "Vaca gorda (SP)",
    unidade: "R$/@",
    fonte: "Datagro, via Notícias Agrícolas",
    url: "https://www.noticiasagricolas.com.br/cotacoes/boi-gordo/indicador-da-vaca",
    casas: 2,
    automatica: true,
  },
  BEZERRO_MS: {
    nome: "Bezerro (MS)",
    unidade: "R$/cabeça",
    fonte: "CEPEA/ESALQ",
    url: "https://www.cepea.org.br/br/indicador/bezerro.aspx",
    casas: 2,
    automatica: true,
  },
  MARACUJA: {
    nome: "Maracujá azedo (Ceagesp)",
    unidade: "R$/kg",
    fonte: "Ceagesp/SP, via Notícias Agrícolas",
    url: "https://www.noticiasagricolas.com.br/cotacoes/frutas/maracuja-ceasas",
    casas: 2,
    automatica: true,
  },
  DOLAR: {
    nome: "Dólar (PTAX venda)",
    unidade: "R$/US$",
    fonte: "Banco Central",
    url: "https://www.bcb.gov.br/estabilidadefinanceira/historicocotacoes",
    casas: 4,
    automatica: true,
  },
} satisfies Record<string, Produto>;

export type ChaveProduto = keyof typeof PRODUTOS;
export const CHAVES_PRODUTO = Object.keys(PRODUTOS) as ChaveProduto[];
export const ehProduto = (v: string): v is ChaveProduto => v in PRODUTOS;
