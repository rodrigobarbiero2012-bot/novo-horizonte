import { prisma } from "../db";
import { buscarCafeArabica, buscarCdiMensal, buscarDolarPtax, buscarMaracuja, buscarVacaGorda, type PontoCotacao } from "./fontes";
import { PRODUTOS, type ChaveProduto } from "./produtos";

const FONTES: Partial<Record<ChaveProduto, () => Promise<PontoCotacao[]>>> = {
  CAFE_ARABICA: () => buscarCafeArabica(PRODUTOS.CAFE_ARABICA.url, "https://www.cepea.org.br/br/indicador/cafe.aspx"),
  VACA_GORDA: () => buscarVacaGorda(PRODUTOS.VACA_GORDA.url),
  MARACUJA: () => buscarMaracuja(PRODUTOS.MARACUJA.url),
  DOLAR: () => buscarDolarPtax(),
};

export const CHAVE_ULTIMA_EXECUCAO = "cotacoes.ultimaExecucao"; // { em, resultado }
export const CHAVE_CDI = "benchmark.cdiMensal"; // { "yyyy-mm": % no mês }

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
  // CDI mensal: referência para comparar o retorno do sítio (análise por cultivo).
  try {
    const meses = await buscarCdiMensal();
    await prisma.configuracao.upsert({ where: { chave: CHAVE_CDI }, create: { chave: CHAVE_CDI, valor: meses }, update: { valor: meses } });
    resultado.CDI = { gravados: Object.keys(meses).length };
  } catch (e) {
    resultado.CDI = { erro: e instanceof Error ? e.message : String(e) };
  }
  // Guarda o resultado da última execução (com o erro de cada fonte) para diagnóstico na tela e no banco.
  await prisma.configuracao.upsert({
    where: { chave: CHAVE_ULTIMA_EXECUCAO },
    create: { chave: CHAVE_ULTIMA_EXECUCAO, valor: { em: new Date().toISOString(), resultado } },
    update: { valor: { em: new Date().toISOString(), resultado } },
  });
  return resultado;
}
