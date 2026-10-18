import type { BalancoAno, DreAno } from "../contabil/relatorios";

// Linhas da DRE, do Balanço e do Fluxo de caixa como aparecem na tela e na
// exportação para Excel (uma definição só para as duas).

export type LinhaDreTela =
  | { tipo: "secao"; rotulo: string }
  | { tipo: "valor" | "total" | "destaque"; rotulo: string; chave: keyof DreAno }
  | { tipo: "pct"; rotulo: string; de: keyof DreAno };

export const LINHAS_DRE_TELA: LinhaDreTela[] = [
  { tipo: "secao", rotulo: "Receita operacional" },
  { tipo: "valor", rotulo: "Café", chave: "receitaCafe" },
  { tipo: "valor", rotulo: "Maracujá", chave: "receitaMaracuja" },
  { tipo: "valor", rotulo: "Milho", chave: "receitaMilho" },
  { tipo: "valor", rotulo: "Pecuária", chave: "receitaPecuaria" },
  { tipo: "valor", rotulo: "Outras (diversas/financeiras)", chave: "outrasReceitas" },
  { tipo: "total", rotulo: "Total receita", chave: "totalReceita" },
  { tipo: "secao", rotulo: "Custeio (custo direto de produção)" },
  { tipo: "valor", rotulo: "Café", chave: "custeioCafe" },
  { tipo: "valor", rotulo: "Maracujá", chave: "custeioMaracuja" },
  { tipo: "valor", rotulo: "Milho", chave: "custeioMilho" },
  { tipo: "valor", rotulo: "Pecuária", chave: "custeioPecuaria" },
  { tipo: "valor", rotulo: "Geral (não alocado)", chave: "custeioGeral" },
  { tipo: "total", rotulo: "Total custeio", chave: "totalCusteio" },
  { tipo: "destaque", rotulo: "Margem de contribuição", chave: "margemContribuicao" },
  { tipo: "pct", rotulo: "Margem de contribuição %", de: "margemContribuicao" },
  { tipo: "secao", rotulo: "Despesas operacionais" },
  { tipo: "valor", rotulo: "Administrativas", chave: "despesasAdministrativas" },
  { tipo: "valor", rotulo: "Financeiras", chave: "despesasFinanceiras" },
  { tipo: "total", rotulo: "Total despesas", chave: "totalDespesas" },
  { tipo: "valor", rotulo: "Resultado não operacional", chave: "resultadoNaoOperacional" },
  { tipo: "destaque", rotulo: "Resultado do período", chave: "resultado" },
  { tipo: "pct", rotulo: "Margem líquida %", de: "resultado" },
  { tipo: "valor", rotulo: "Resultado acumulado", chave: "resultadoAcumulado" },
];

export type LinhaBalancoTela =
  | { tipo: "secao"; rotulo: string }
  | { tipo: "valor" | "total" | "destaque"; rotulo: string; chave: keyof BalancoAno };

export const LINHAS_BALANCO_TELA: LinhaBalancoTela[] = [
  { tipo: "secao", rotulo: "Ativo" },
  { tipo: "valor", rotulo: "Caixa e bancos", chave: "caixaBancos" },
  { tipo: "valor", rotulo: "Aplicações financeiras", chave: "aplicacoes" },
  { tipo: "valor", rotulo: "Estoques", chave: "estoques" },
  { tipo: "valor", rotulo: "Imobilizado (sem depreciação)", chave: "imobilizado" },
  { tipo: "destaque", rotulo: "Total do ativo", chave: "totalAtivo" },
  { tipo: "secao", rotulo: "Passivo" },
  { tipo: "valor", rotulo: "Empréstimos e financiamentos", chave: "emprestimos" },
  { tipo: "valor", rotulo: "Fornecedores / parcerias a pagar", chave: "fornecedores" },
  { tipo: "total", rotulo: "Total do passivo", chave: "totalPassivo" },
  { tipo: "secao", rotulo: "Patrimônio líquido" },
  { tipo: "valor", rotulo: "Capital do sócio (CC ACM + saldos iniciais)", chave: "capitalSocio" },
  { tipo: "valor", rotulo: "Resultado acumulado", chave: "resultadoAcumulado" },
  { tipo: "total", rotulo: "Total do patrimônio líquido", chave: "totalPL" },
  { tipo: "destaque", rotulo: "Total passivo + PL", chave: "totalPassivoPL" },
];

export const GRUPOS_FLUXO = [
  { grupo: "operacional", rotulo: "Atividades operacionais", total: "operacional" },
  { grupo: "investimento", rotulo: "Investimentos", total: "investimento" },
  { grupo: "financiamento", rotulo: "Financiamentos e sócio", total: "financiamento" },
] as const;
