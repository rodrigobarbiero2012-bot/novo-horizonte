import { quantidadeComSinal, type Movimento } from "../producao/indicadores";

// Vendas (contratos) de uma atividade: quanto foi vendido, entregue, falta
// entregar e a que preço — frente ao estoque físico da produção.

export const MODALIDADES = {
  PRONTA: "Pronta entrega",
  FUTURA: "Entrega futura",
  A_FIXAR: "Preço a fixar",
} as const;
export type Modalidade = keyof typeof MODALIDADES;
export const ehModalidade = (v: unknown): v is Modalidade => typeof v === "string" && v in MODALIDADES;

export type Contrato = {
  dataContrato: string; // aaaa-mm-dd
  quantidade: number;
  precoUnitarioCentavos: number | null; // null = a fixar
  cancelada: boolean;
  entregue: number; // soma das entregas
};

/** Situação do contrato: cancelado, entregue (concluído) ou em aberto. */
export function situacaoContrato(c: Pick<Contrato, "quantidade" | "cancelada" | "entregue">): "CANCELADA" | "CONCLUIDA" | "ABERTA" {
  if (c.cancelada) return "CANCELADA";
  return c.entregue >= c.quantidade - 1e-9 ? "CONCLUIDA" : "ABERTA";
}

/** O que ainda falta entregar (contrato cancelado não compromete mais nada). */
export const aEntregar = (c: Pick<Contrato, "quantidade" | "cancelada" | "entregue">) => (c.cancelada ? 0 : Math.max(0, c.quantidade - c.entregue));

/** Valor do contrato em centavos (null enquanto o preço não for fixado). */
export const valorContrato = (c: Pick<Contrato, "quantidade" | "precoUnitarioCentavos">) =>
  c.precoUnitarioCentavos === null ? null : Math.round(c.quantidade * c.precoUnitarioCentavos);

export type ResumoVendas = {
  estoque: number; // físico, pelos movimentos da produção
  comprometido: number; // vendido e ainda não entregue
  livre: number; // estoque − comprometido (negativo = venda antecipada da próxima colheita)
  vendidoAno: number; // contratado no ano (exceto cancelado; no cancelado conta só o entregue)
  fixadoAno: number; // parte do vendido no ano com preço definido
  aFixarAno: number;
  valorFixadoAno: number; // centavos
  precoMedioAno: number | null; // centavos por unidade, ponderado pelos fixados
};

export function resumoVendas(contratos: Contrato[], movimentos: Movimento[], ano: number): ResumoVendas {
  const estoque = movimentos.reduce((s, m) => s + quantidadeComSinal(m), 0);
  const comprometido = contratos.reduce((s, c) => s + aEntregar(c), 0);
  let vendidoAno = 0;
  let fixadoAno = 0;
  let valorFixadoAno = 0;
  for (const c of contratos) {
    if (!c.dataContrato.startsWith(`${ano}-`)) continue;
    const qtd = c.cancelada ? c.entregue : c.quantidade;
    vendidoAno += qtd;
    if (c.precoUnitarioCentavos !== null) {
      fixadoAno += qtd;
      valorFixadoAno += Math.round(qtd * c.precoUnitarioCentavos);
    }
  }
  return {
    estoque,
    comprometido,
    livre: estoque - comprometido,
    vendidoAno,
    fixadoAno,
    aFixarAno: vendidoAno - fixadoAno,
    valorFixadoAno,
    precoMedioAno: fixadoAno > 0 ? Math.round(valorFixadoAno / fixadoAno) : null,
  };
}
