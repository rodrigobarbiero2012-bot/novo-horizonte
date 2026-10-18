import type { Atividade, Categoria, PartidaContabil } from "./tipos";

// Linhas da DRE e do Balanço, na mesma estrutura das abas "DRE Anual" e
// "Balanço Patrimonial Anual" da planilha, para que a importação possa ser
// conferida linha a linha. Receitas e passivos aparecem com sinal invertido
// (positivos), despesas e custeio negativos, como na planilha.

type Filtro = { categoria: Categoria; atividade?: Atividade };

export const LINHAS_DRE = {
  receitaCafe: { rotulo: "Receita Café", filtro: { categoria: "Receita", atividade: "Café" } },
  receitaMaracuja: { rotulo: "Receita Maracujá", filtro: { categoria: "Receita", atividade: "Maracujá" } },
  receitaPecuaria: { rotulo: "Receita Pecuária", filtro: { categoria: "Receita", atividade: "Pecuária" } },
  outrasReceitas: { rotulo: "Outras Receitas (Diversas/Financeiras)", filtro: { categoria: "Receita", atividade: "Geral" } },
  custeioCafe: { rotulo: "Custeio Café", filtro: { categoria: "Custeio", atividade: "Café" } },
  custeioMaracuja: { rotulo: "Custeio Maracujá", filtro: { categoria: "Custeio", atividade: "Maracujá" } },
  custeioMilho: { rotulo: "Custeio Milho", filtro: { categoria: "Custeio", atividade: "Milho" } },
  custeioPecuaria: { rotulo: "Custeio Pecuária", filtro: { categoria: "Custeio", atividade: "Pecuária" } },
  custeioGeral: { rotulo: "Custeio Geral (overhead agrícola não alocado)", filtro: { categoria: "Custeio", atividade: "Geral" } },
  despesasAdministrativas: { rotulo: "Despesas Administrativas", filtro: { categoria: "Despesa Administrativa" } },
  despesasFinanceiras: { rotulo: "Despesas Financeiras", filtro: { categoria: "Despesa Financeira" } },
  resultadoNaoOperacional: {
    rotulo: "Resultado Não Operacional (venda/baixa de imobilizado)",
    filtro: { categoria: "Receita Não Operacional" },
  },
} satisfies Record<string, { rotulo: string; filtro: Filtro }>;

export type LinhaDre = keyof typeof LINHAS_DRE;

export type DreAno = Record<LinhaDre, number> & {
  totalReceita: number;
  totalCusteio: number;
  margemContribuicao: number;
  totalDespesas: number;
  resultado: number;
  resultadoAcumulado: number;
};

export type BalancoAno = {
  caixaBancos: number;
  aplicacoes: number;
  estoques: number;
  imobilizado: number;
  totalAtivo: number;
  emprestimos: number;
  fornecedores: number;
  totalPassivo: number;
  capitalSocio: number;
  resultadoAcumulado: number;
  totalPL: number;
  totalPassivoPL: number;
  diferenca: number; // Ativo − Passivo − PL; diferente de zero indica lançamento sem contrapartida
};

const ano = (p: PartidaContabil) => Number(p.data.slice(0, 4));

export function casa(p: PartidaContabil, f: Filtro) {
  return p.categoria === f.categoria && (f.atividade === undefined || p.atividade === f.atividade);
}

function soma(partidas: PartidaContabil[], f: Filtro, pred: (a: number) => boolean) {
  let total = 0;
  for (const p of partidas) if (casa(p, f) && pred(ano(p))) total += p.valorCentavos;
  return total;
}

/** DRE anual em centavos, para cada ano pedido (em ordem crescente). */
export function dreAnual(partidas: PartidaContabil[], anos: number[]): Map<number, DreAno> {
  const resultado = new Map<number, DreAno>();
  let acumulado = 0;
  for (const a of [...anos].sort((x, y) => x - y)) {
    const linhas = Object.fromEntries(
      Object.entries(LINHAS_DRE).map(([chave, { filtro }]) => [chave, -soma(partidas, filtro, (x) => x === a)]),
    ) as Record<LinhaDre, number>;
    const totalReceita = linhas.receitaCafe + linhas.receitaMaracuja + linhas.receitaPecuaria + linhas.outrasReceitas;
    const totalCusteio =
      linhas.custeioCafe + linhas.custeioMaracuja + linhas.custeioMilho + linhas.custeioPecuaria + linhas.custeioGeral;
    const margemContribuicao = totalReceita + totalCusteio;
    const totalDespesas = linhas.despesasAdministrativas + linhas.despesasFinanceiras;
    const res = margemContribuicao + totalDespesas + linhas.resultadoNaoOperacional;
    acumulado += res;
    resultado.set(a, {
      ...linhas,
      totalReceita,
      totalCusteio,
      margemContribuicao,
      totalDespesas,
      resultado: res,
      resultadoAcumulado: acumulado,
    });
  }
  return resultado;
}

/**
 * Balanço em 31/dez de cada ano, em centavos. Como na planilha, o resultado
 * acumulado vem da DRE (soma dos resultados desde o primeiro ano pedido), e não
 * do saldo das contas de resultado — por isso `anos` deve começar no primeiro
 * exercício com movimento.
 */
export function balancoAnual(partidas: PartidaContabil[], anos: number[]): Map<number, BalancoAno> {
  const dre = dreAnual(partidas, anos);
  const resultado = new Map<number, BalancoAno>();
  for (const a of [...anos].sort((x, y) => x - y)) {
    const ate = (x: number) => x <= a;
    const caixaBancos = soma(partidas, { categoria: "Ativo Caixa/Banco" }, ate);
    const aplicacoes = soma(partidas, { categoria: "Ativo Aplicação Financeira" }, ate);
    const estoques = soma(partidas, { categoria: "Ativo Estoque" }, ate);
    const imobilizado = soma(partidas, { categoria: "Ativo Imobilizado" }, ate);
    const emprestimos = -soma(partidas, { categoria: "Passivo Empréstimo" }, ate);
    const fornecedores = -soma(partidas, { categoria: "Passivo Fornecedor" }, ate);
    const capitalSocio = -soma(partidas, { categoria: "PL Capital Sócio" }, ate);
    const resultadoAcumulado = dre.get(a)!.resultadoAcumulado;
    const totalAtivo = caixaBancos + aplicacoes + estoques + imobilizado;
    const totalPassivo = emprestimos + fornecedores;
    const totalPL = capitalSocio + resultadoAcumulado;
    resultado.set(a, {
      caixaBancos,
      aplicacoes,
      estoques,
      imobilizado,
      totalAtivo,
      emprestimos,
      fornecedores,
      totalPassivo,
      capitalSocio,
      resultadoAcumulado,
      totalPL,
      totalPassivoPL: totalPassivo + totalPL,
      diferenca: totalAtivo - totalPassivo - totalPL,
    });
  }
  return resultado;
}
