import type { PartidaContabil } from "./tipos";

// Fluxo de caixa realizado, método direto, mês a mês.
//
// "Caixa" aqui é bancos + aplicações. Toda perna de lançamento fora dessas
// contas vira uma linha do fluxo, com sinal invertido (entrada positiva). Como
// cada lançamento soma zero, a soma das linhas é sempre igual à variação do
// caixa no mês.
//
// Boa parte das despesas do sítio é paga direto pelo sócio (CC ACM), sem passar
// pelo banco. Essas saídas aparecem no operacional e o mesmo valor aparece como
// "Aportes do sócio" no financiamento, deixando visível quem financiou.

/** Estoque de café e a provisão de receita que o acompanha: ajuste contábil sem dinheiro. */
const CONTAS_SEM_EFEITO_CAIXA = new Set(["Estoques (Café/Produtos)", "Receita de Vendas - Provisão Estoque"]);

export const LINHAS_FLUXO = [
  { chave: "receitas", rotulo: "Recebimentos de vendas e outras receitas", grupo: "operacional" },
  { chave: "custeio", rotulo: "Custeio da produção", grupo: "operacional" },
  { chave: "despesasAdministrativas", rotulo: "Despesas administrativas", grupo: "operacional" },
  { chave: "despesasFinanceiras", rotulo: "Juros e encargos financeiros", grupo: "operacional" },
  { chave: "imobilizado", rotulo: "Máquinas, benfeitorias e lavouras", grupo: "investimento" },
  { chave: "gado", rotulo: "Compra e venda de gado", grupo: "investimento" },
  { chave: "vendaImobilizado", rotulo: "Venda de imobilizado", grupo: "investimento" },
  { chave: "emprestimos", rotulo: "Empréstimos e financiamentos (captação − amortização)", grupo: "financiamento" },
  { chave: "fornecedores", rotulo: "Fornecedores e parcerias a pagar", grupo: "financiamento" },
  { chave: "socio", rotulo: "Aportes (−retiradas) do sócio", grupo: "financiamento" },
  { chave: "semEfeitoCaixa", rotulo: "Ajustes de estoque sem efeito caixa", grupo: "ajuste" },
] as const;

export type LinhaFluxo = (typeof LINHAS_FLUXO)[number]["chave"];
export type GrupoFluxo = (typeof LINHAS_FLUXO)[number]["grupo"];

export type FluxoMes = Record<LinhaFluxo, number> & {
  operacional: number;
  investimento: number;
  financiamento: number;
  /**
   * Diferença entre a variação real do caixa e a soma das linhas. Só não é zero
   * quando um lançamento tem pernas em períodos diferentes — típico dos lotes da
   * planilha (despesas do mês com datas próprias, pagamento total numa data só)
   * e dos erros de ano de 2021 e 2025.
   */
  aConciliar: number;
  variacaoCaixa: number;
  saldoInicial: number;
  saldoFinal: number;
};

function classificar(p: PartidaContabil): LinhaFluxo | "caixa" {
  if (p.conta && CONTAS_SEM_EFEITO_CAIXA.has(p.conta)) return "semEfeitoCaixa";
  switch (p.categoria) {
    case "Ativo Caixa/Banco":
    case "Ativo Aplicação Financeira":
      return "caixa";
    case "Receita":
      return "receitas";
    case "Custeio":
      return "custeio";
    case "Despesa Administrativa":
      return "despesasAdministrativas";
    case "Despesa Financeira":
      return "despesasFinanceiras";
    case "Ativo Imobilizado":
      return "imobilizado";
    case "Ativo Estoque":
      return "gado";
    case "Receita Não Operacional":
      return "vendaImobilizado";
    case "Passivo Empréstimo":
      return "emprestimos";
    case "Passivo Fornecedor":
      return "fornecedores";
    case "PL Capital Sócio":
      return "socio";
  }
}

const vazio = (): Record<LinhaFluxo, number> =>
  Object.fromEntries(LINHAS_FLUXO.map((l) => [l.chave, 0])) as Record<LinhaFluxo, number>;

/** Fluxo dos 12 meses de `ano` (chave "01".."12"), em centavos. */
export function fluxoMensal(partidas: PartidaContabil[], ano: number): Map<string, FluxoMes> {
  const meses = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  return fluxoPorPeriodo(partidas, meses, `${ano}-01-01`, (d) => (d.startsWith(String(ano)) ? d.slice(5, 7) : null));
}

/** Fluxo de cada ano pedido (chave "2015", "2016"…), em centavos. */
export function fluxoAnual(partidas: PartidaContabil[], anos: number[]): Map<string, FluxoMes> {
  const chaves = [...anos].sort((a, b) => a - b).map(String);
  return fluxoPorPeriodo(partidas, chaves, `${chaves[0]}-01-01`, (d) => (chaves.includes(d.slice(0, 4)) ? d.slice(0, 4) : null));
}

/**
 * `periodos` em ordem cronológica e contíguos; `inicio` é a data do primeiro
 * (o que vem antes forma o saldo inicial); `periodoDe` diz em que período uma
 * data cai, ou null se estiver fora.
 */
function fluxoPorPeriodo(
  partidas: PartidaContabil[],
  periodos: string[],
  inicio: string,
  periodoDe: (data: string) => string | null,
): Map<string, FluxoMes> {
  const linhas = new Map(periodos.map((m) => [m, vazio()]));
  const movimentoCaixa = new Map(periodos.map((m) => [m, 0]));
  let saldoAnterior = 0;

  for (const p of partidas) {
    const tipo = classificar(p);
    if (p.data < inicio) {
      if (tipo === "caixa") saldoAnterior += p.valorCentavos;
      continue;
    }
    const periodo = periodoDe(p.data);
    if (periodo === null) continue;
    if (tipo === "caixa") movimentoCaixa.set(periodo, movimentoCaixa.get(periodo)! + p.valorCentavos);
    else linhas.get(periodo)![tipo] -= p.valorCentavos;
  }

  const resultado = new Map<string, FluxoMes>();
  let saldo = saldoAnterior;
  for (const m of periodos) {
    const l = linhas.get(m)!;
    const somaGrupo = (g: GrupoFluxo) =>
      LINHAS_FLUXO.filter((x) => x.grupo === g).reduce((s, x) => s + l[x.chave], 0);
    const operacional = somaGrupo("operacional");
    const investimento = somaGrupo("investimento");
    const financiamento = somaGrupo("financiamento");
    const variacaoCaixa = movimentoCaixa.get(m)!;
    resultado.set(m, {
      ...l,
      operacional,
      investimento,
      financiamento,
      aConciliar: variacaoCaixa - (operacional + investimento + financiamento + l.semEfeitoCaixa),
      variacaoCaixa,
      saldoInicial: saldo,
      saldoFinal: saldo + variacaoCaixa,
    });
    saldo += variacaoCaixa;
  }
  return resultado;
}
