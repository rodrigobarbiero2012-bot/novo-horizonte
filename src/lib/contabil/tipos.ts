// Convenção de sinal (herdada da planilha Gerencial Financeiro):
// valor positivo = débito, negativo = crédito. Todo lançamento soma zero.
// Valores sempre em centavos inteiros para não acumular erro de ponto flutuante.

export const CATEGORIAS = [
  "Ativo Caixa/Banco",
  "Ativo Aplicação Financeira",
  "Ativo Estoque",
  "Ativo Imobilizado",
  "Passivo Empréstimo",
  "Passivo Fornecedor",
  "PL Capital Sócio",
  "Receita",
  "Receita Não Operacional",
  "Custeio",
  "Despesa Administrativa",
  "Despesa Financeira",
] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const ATIVIDADES = ["Café", "Maracujá", "Milho", "Pecuária", "Geral", "N/A"] as const;
export type Atividade = (typeof ATIVIDADES)[number];

/** Uma perna de um lançamento, já com a classificação da conta resolvida. */
export type PartidaContabil = {
  data: string; // ISO yyyy-mm-dd
  categoria: Categoria;
  atividade: Atividade;
  valorCentavos: number;
  conta?: string; // nome da conta; só o fluxo de caixa precisa dele
};

export function paraCentavos(reais: number): number {
  return Math.round(reais * 100);
}

export function ehCategoria(v: string | null | undefined): v is Categoria {
  return CATEGORIAS.includes(v as Categoria);
}

export function ehAtividade(v: string | null | undefined): v is Atividade {
  return ATIVIDADES.includes(v as Atividade);
}
