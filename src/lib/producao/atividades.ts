import type { Atividade } from "../contabil/tipos";
import type { ChaveProduto } from "../cotacoes/produtos";

// Atividades produtivas: unidade física, tipos de movimento e ligação com a
// contabilidade (atividade das contas) e com as cotações.

export type TipoMovimento = "COLHEITA" | "NASCIMENTO" | "COMPRA" | "VENDA" | "CONSUMO" | "PERDA" | "MORTE" | "AJUSTE";

/** +1 entra no estoque/rebanho, −1 sai; AJUSTE usa o sinal da própria quantidade. */
export const SINAL: Record<TipoMovimento, 1 | -1> = {
  COLHEITA: 1,
  NASCIMENTO: 1,
  COMPRA: 1,
  VENDA: -1,
  CONSUMO: -1,
  PERDA: -1,
  MORTE: -1,
  AJUSTE: 1,
};

type DefAtividade = {
  chave: string;
  nome: string;
  atividadeContabil: Atividade;
  unidade: string; // plural, por extenso
  unidadeCurta: string;
  produtividade: string | null; // rótulo da produtividade por hectare
  cotacao: ChaveProduto | null; // valoriza o estoque e a margem por unidade
  tipos: { tipo: TipoMovimento; rotulo: string }[];
  /** O que conta como "produção do ano". */
  producao: TipoMovimento;
  rotuloEstoque: string;
  rotuloArea: string;
};

// Tipos que o sócio registra à mão na Produção. VENDA não entra: venda se
// registra em Vendas, que gera o movimento (a entrega) — assim a mesma venda
// não é lançada duas vezes.
const LAVOURA = (rotuloConsumo: string) => [
  { tipo: "COLHEITA" as const, rotulo: "Colheita" },
  { tipo: "CONSUMO" as const, rotulo: rotuloConsumo },
  { tipo: "PERDA" as const, rotulo: "Perda / quebra" },
  { tipo: "AJUSTE" as const, rotulo: "Ajuste de inventário (±)" },
];

export const ATIVIDADES_PRODUCAO = {
  cafe: {
    chave: "CAFE",
    nome: "Café",
    atividadeContabil: "Café",
    unidade: "sacas de 60 kg (beneficiado)",
    unidadeCurta: "sc",
    produtividade: "sc/ha",
    cotacao: "CAFE_ARABICA",
    tipos: LAVOURA("Consumo / doação"),
    producao: "COLHEITA",
    rotuloEstoque: "Café em estoque",
    rotuloArea: "Área de café",
  },
  maracuja: {
    chave: "MARACUJA",
    nome: "Maracujá",
    atividadeContabil: "Maracujá",
    unidade: "kg",
    unidadeCurta: "kg",
    produtividade: "kg/ha",
    cotacao: "MARACUJA",
    tipos: LAVOURA("Descarte / consumo"),
    producao: "COLHEITA",
    rotuloEstoque: "Fruta em estoque",
    rotuloArea: "Área de maracujá",
  },
  milho: {
    chave: "MILHO",
    nome: "Milho",
    atividadeContabil: "Milho",
    unidade: "sacas de 60 kg",
    unidadeCurta: "sc",
    produtividade: "sc/ha",
    cotacao: null,
    tipos: LAVOURA("Uso no trato do gado"),
    producao: "COLHEITA",
    rotuloEstoque: "Milho em estoque",
    rotuloArea: "Área de milho",
  },
  pecuaria: {
    chave: "PECUARIA",
    nome: "Pecuária",
    atividadeContabil: "Pecuária",
    unidade: "cabeças",
    unidadeCurta: "cab.",
    produtividade: null,
    cotacao: null,
    tipos: [
      { tipo: "NASCIMENTO", rotulo: "Nascimento" },
      { tipo: "COMPRA", rotulo: "Compra" },
      { tipo: "MORTE", rotulo: "Morte" },
      { tipo: "CONSUMO", rotulo: "Abate para consumo" },
      { tipo: "AJUSTE", rotulo: "Ajuste de contagem (±)" },
    ],
    producao: "NASCIMENTO",
    rotuloEstoque: "Rebanho",
    rotuloArea: "Área de pasto",
  },
} satisfies Record<string, DefAtividade>;

export type SlugProducao = keyof typeof ATIVIDADES_PRODUCAO;
export const ehSlugProducao = (s: string): s is SlugProducao => s in ATIVIDADES_PRODUCAO;
export const definicaoPorChave = (chave: string) => Object.values(ATIVIDADES_PRODUCAO).find((a) => a.chave === chave);
