import "server-only";
import { prisma } from "../db";
import { ATIVIDADES_RATEIO, type AtividadeRateio } from "./rateio";
import { taxaSugerida } from "./depreciacao";

// Chaves da tabela Configuracao usadas aqui:
//   "depreciacao.taxas" → { [contaId]: taxa anual em % }  (só as definidas pelos sócios)
//   "rateio.manual"     → { Café: %, Maracujá: %, Milho: %, Pecuária: % }
export const CHAVE_TAXAS = "depreciacao.taxas";
export const CHAVE_RATEIO = "rateio.manual";

async function ler<T>(chave: string, padrao: T): Promise<T> {
  const c = await prisma.configuracao.findUnique({ where: { chave } });
  return c ? (c.valor as T) : padrao;
}

export type TaxaConta = {
  contaId: string;
  nome: string;
  atividade: string;
  taxa: number;
  definida: boolean; // false = sugestão do sistema, ainda não confirmada
  confirmar?: string; // motivo para confirmar, quando a sugestão é incerta
};

/** Taxa de depreciação de cada conta de imobilizado: a definida pelos sócios ou a sugerida. */
export async function taxasDepreciacao(): Promise<TaxaConta[]> {
  const [contas, definidas] = await Promise.all([
    prisma.conta.findMany({ where: { categoria: "Ativo Imobilizado" }, orderBy: { nome: "asc" }, select: { id: true, nome: true, atividade: true } }),
    ler<Record<string, number>>(CHAVE_TAXAS, {}),
  ]);
  return contas.map((c) => {
    const sugerida = taxaSugerida(c.nome);
    const definida = typeof definidas[c.id] === "number";
    return { contaId: c.id, nome: c.nome, atividade: c.atividade, taxa: definida ? definidas[c.id] : sugerida.taxa, definida, confirmar: sugerida.confirmar };
  });
}

//   "analise.valorTerra" → { valorCentavos, data } — valor de mercado do sítio (terra e benfeitorias) informado pelos sócios
export const CHAVE_TERRA = "analise.valorTerra";
export type ValorTerra = { valorCentavos: number; data: string };

export async function valorTerra(): Promise<ValorTerra | null> {
  const v = await ler<Partial<ValorTerra> | null>(CHAVE_TERRA, null);
  return v && typeof v.valorCentavos === "number" && v.valorCentavos > 0 && typeof v.data === "string" ? { valorCentavos: v.valorCentavos, data: v.data } : null;
}

export async function rateioManual(): Promise<Record<AtividadeRateio, number>> {
  const v = await ler<Partial<Record<AtividadeRateio, number>>>(CHAVE_RATEIO, {});
  return Object.fromEntries(ATIVIDADES_RATEIO.map((a) => [a, typeof v[a] === "number" ? v[a] : 0])) as Record<AtividadeRateio, number>;
}
