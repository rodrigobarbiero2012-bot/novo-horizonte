import { somarMeses } from "../titulos/regras";

// Cronograma de financiamento: cada parcela separada em amortização (abate a
// dívida, conta de passivo) e juros (despesa financeira). Valores em centavos.

export const SISTEMAS = { PRICE: "Price (parcelas iguais)", SAC: "SAC (amortização constante)" } as const;
export type Sistema = keyof typeof SISTEMAS;
export const ehSistema = (v: unknown): v is Sistema => typeof v === "string" && v in SISTEMAS;

export const PERIODICIDADES = { 1: "Mensal", 3: "Trimestral", 6: "Semestral", 12: "Anual" } as const;
export type Periodicidade = 1 | 3 | 6 | 12;
export const ehPeriodicidade = (v: number): v is Periodicidade => v === 1 || v === 3 || v === 6 || v === 12;

export type ParcelaPrevista = {
  numero: number; // 1..total (inclui as de carência)
  vencimento: string; // aaaa-mm-dd
  amortizacao: number;
  juros: number;
  parcela: number; // amortização + juros
  saldoDepois: number;
  carencia: boolean; // só juros
};

/** Taxa do período a partir da taxa efetiva anual: (1 + a)^(meses/12) − 1. */
export const taxaDoPeriodo = (taxaAnualPct: number, meses: Periodicidade) => Math.pow(1 + taxaAnualPct / 100, meses / 12) - 1;

/**
 * Cronograma: `carencia` períodos pagando só juros, depois `parcelas`
 * amortizações (Price ou SAC). A última parcela leva o resto de centavos
 * para o saldo terminar exatamente em zero.
 */
export function gerarCronograma(p: {
  valorCentavos: number;
  taxaAnualPct: number;
  parcelas: number;
  carencia: number;
  sistema: Sistema;
  periodicidadeMeses: Periodicidade;
  primeiroVencimento: string;
}): ParcelaPrevista[] {
  const i = taxaDoPeriodo(p.taxaAnualPct, p.periodicidadeMeses);
  const lista: ParcelaPrevista[] = [];
  let saldo = p.valorCentavos;
  const total = p.carencia + p.parcelas;
  const pmt = i === 0 ? p.valorCentavos / p.parcelas : (p.valorCentavos * i) / (1 - Math.pow(1 + i, -p.parcelas));
  for (let n = 1; n <= total; n++) {
    const vencimento = somarMeses(p.primeiroVencimento, (n - 1) * p.periodicidadeMeses);
    const juros = Math.round(saldo * i);
    const carencia = n <= p.carencia;
    let amortizacao = 0;
    if (!carencia) {
      const ultima = n === total;
      amortizacao = ultima ? saldo : p.sistema === "SAC" ? Math.round(p.valorCentavos / p.parcelas) : Math.round(pmt) - juros;
      amortizacao = Math.min(Math.max(amortizacao, 0), saldo);
    }
    saldo -= amortizacao;
    lista.push({ numero: n, vencimento, amortizacao, juros, parcela: amortizacao + juros, saldoDepois: saldo, carencia });
  }
  return lista;
}

/**
 * Pagamento de uma parcela: a amortização prevista abate a dívida; o que for
 * pago além dela (juros previstos, multa, juros de atraso) é despesa
 * financeira. Pagando menos que a amortização, tudo abate a dívida.
 */
export function dividirPagamento(valorPagoCentavos: number, parcelaCentavos: number, jurosPrevistosCentavos: number) {
  const amortizacaoPrevista = parcelaCentavos - jurosPrevistosCentavos;
  const amortizacao = Math.min(amortizacaoPrevista, valorPagoCentavos);
  return { amortizacao, juros: valorPagoCentavos - amortizacao };
}
