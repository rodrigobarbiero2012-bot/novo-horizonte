// Cotações acompanhadas no painel. Os dados do CEPEA são CC BY-NC 4.0:
// exigem citar a fonte, que aparece junto de cada cotação.

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
  BOI_GORDO: {
    nome: "Boi gordo",
    unidade: "R$/@",
    fonte: "CEPEA/ESALQ",
    url: "https://www.cepea.org.br/br/indicador/boi-gordo.aspx",
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
    nome: "Maracujá azedo",
    unidade: "R$/kg",
    fonte: "registro manual",
    url: "",
    casas: 2,
    automatica: false,
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
