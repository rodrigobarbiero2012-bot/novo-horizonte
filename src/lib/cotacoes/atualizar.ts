import { prisma } from "../db";
import { buscarCepea, buscarDolarPtax, buscarMaracuja, buscarVacaGorda, type PontoCotacao } from "./fontes";
import { PRODUTOS, type ChaveProduto } from "./produtos";

const FONTES: Partial<Record<ChaveProduto, () => Promise<PontoCotacao[]>>> = {
  CAFE_ARABICA: () => buscarCepea(PRODUTOS.CAFE_ARABICA.url),
  VACA_GORDA: () => buscarVacaGorda(PRODUTOS.VACA_GORDA.url),
  MARACUJA: () => buscarMaracuja(PRODUTOS.MARACUJA.url),
  BEZERRO_MS: () => buscarCepea(PRODUTOS.BEZERRO_MS.url),
  DOLAR: () => buscarDolarPtax(),
};

export type ResultadoAtualizacao = Record<string, { gravados: number } | { erro: string }>;

/**
 * Busca as cotações automáticas e grava (upsert por produto+dia). Cada fonte
 * é independente: se o CEPEA falhar, o dólar ainda é gravado, e o erro volta
 * no resultado para aparecer no log do cron.
 */
export async function atualizarCotacoes(): Promise<ResultadoAtualizacao> {
  const resultado: ResultadoAtualizacao = {};
  await Promise.all(
    Object.entries(FONTES).map(async ([produto, buscar]) => {
      try {
        const pontos = await buscar();
        for (const p of pontos) {
          await prisma.cotacao.upsert({
            where: { produto_data: { produto, data: new Date(p.data) } },
            create: { produto, data: new Date(p.data), valor: p.valor, origem: "AUTOMATICA" },
            update: { valor: p.valor, origem: "AUTOMATICA" },
          });
        }
        resultado[produto] = { gravados: pontos.length };
      } catch (e) {
        resultado[produto] = { erro: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
  return resultado;
}
