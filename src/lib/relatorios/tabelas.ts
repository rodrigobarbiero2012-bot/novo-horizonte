import { fluxoAnual, fluxoMensal, LINHAS_FLUXO, type FluxoMes } from "../contabil/fluxo";
import { balancoAnual, dreAnual, LINHAS_DRE, type LinhaDre } from "../contabil/relatorios";
import type { PartidaContabil } from "../contabil/tipos";
import { MESES } from "../formato";
import { comparar, somaAte, totaisMensais, type Matriz, type Total } from "../orcamento/calculo";
import type { EstiloLinha, Relatorio } from "./excel";
import { GRUPOS_FLUXO, LINHAS_BALANCO_TELA, LINHAS_DRE_TELA } from "./estrutura";

// Montagem dos relatórios para exportação, com as mesmas linhas e filtros das telas.

const estilo = (tipo: string): EstiloLinha => (tipo === "secao" || tipo === "total" || tipo === "destaque" || tipo === "pct" ? tipo : "valor");

/** Anos exibidos na DRE: os que têm receita ou custeio. */
export function relatorioDre(partidas: PartidaContabil[], todosAnos: number[], anoAtual: number): Relatorio {
  const dre = dreAnual(partidas, todosAnos);
  const anos = todosAnos.filter((a) => dre.get(a)!.totalReceita !== 0 || dre.get(a)!.totalCusteio !== 0);
  return {
    titulo: "DRE — Demonstração do Resultado",
    subtitulo: `Novo Horizonte · valores em R$ por ano${anos.includes(anoAtual) ? ` · ${anoAtual} parcial, até o último lançamento` : ""}`,
    colunas: anos.map((a) => (a === anoAtual ? `${a}*` : String(a))),
    linhas: LINHAS_DRE_TELA.map((l) => ({
      rotulo: l.rotulo,
      estilo: estilo(l.tipo),
      valores:
        l.tipo === "secao"
          ? []
          : l.tipo === "pct"
            ? anos.map((a) => {
                const d = dre.get(a)!;
                return d.totalReceita === 0 ? null : d[l.de] / d.totalReceita;
              })
            : anos.map((a) => dre.get(a)![l.chave]),
    })),
  };
}

export function relatorioBalanco(partidas: PartidaContabil[], todosAnos: number[]): Relatorio {
  const balanco = balancoAnual(partidas, todosAnos);
  const anos = todosAnos.filter((a) => balanco.get(a)!.totalAtivo !== 0 || a > todosAnos[0]);
  const comDiferenca = anos.filter((a) => balanco.get(a)!.diferenca !== 0);
  return {
    titulo: "Balanço patrimonial",
    subtitulo: "Novo Horizonte · saldos em 31 de dezembro de cada ano, em R$",
    colunas: anos.map(String),
    linhas: [
      ...LINHAS_BALANCO_TELA.map((l) => ({
        rotulo: l.rotulo,
        estilo: estilo(l.tipo),
        valores: l.tipo === "secao" ? [] : anos.map((a) => balanco.get(a)![l.chave]),
      })),
      ...(comDiferenca.length ? [{ rotulo: "Diferença (ativo − passivo − PL)", estilo: "valor" as const, valores: anos.map((a) => balanco.get(a)!.diferenca) }] : []),
    ],
    notas: comDiferenca.length
      ? [`Balanço não fecha em ${comDiferenca.join(", ")}: lançamentos com pernas em anos diferentes (erro de data na planilha original).`]
      : [],
  };
}

/** Fluxo por ano (sem `anoMensal`) ou mês a mês de um ano. */
export function relatorioFluxo(partidas: PartidaContabil[], todosAnos: number[], anoMensal?: number): Relatorio {
  const anos = todosAnos.filter((a) => a > todosAnos[0]);
  const fluxo = anoMensal ? fluxoMensal(partidas, anoMensal) : fluxoAnual(partidas, anos);
  const colunas = [...fluxo.keys()];
  const linha = (rotulo: string, chave: keyof FluxoMes, e: EstiloLinha = "valor") => ({ rotulo, estilo: e, valores: colunas.map((c) => fluxo.get(c)![chave]) });
  const temAConciliar = colunas.some((c) => fluxo.get(c)!.aConciliar !== 0);
  return {
    titulo: anoMensal ? `Fluxo de caixa ${anoMensal}` : "Fluxo de caixa",
    subtitulo: "Novo Horizonte · realizado, entradas positivas e saídas negativas · caixa = bancos + aplicações",
    colunas: colunas.map((c) => (anoMensal ? MESES[Number(c) - 1] : c)),
    linhas: [
      linha("Saldo inicial", "saldoInicial", "total"),
      ...GRUPOS_FLUXO.flatMap((g) => [
        { rotulo: g.rotulo, estilo: "secao" as const, valores: [] },
        ...LINHAS_FLUXO.filter((l) => l.grupo === g.grupo).map((l) => linha(l.rotulo, l.chave)),
        linha(`Total ${g.rotulo.toLowerCase()}`, g.total, "total"),
      ]),
      linha("Ajustes de estoque sem efeito caixa", "semEfeitoCaixa"),
      ...(temAConciliar ? [linha("Diferença de data entre pernas (a conciliar)", "aConciliar")] : []),
      linha("Variação do caixa", "variacaoCaixa", "destaque"),
      linha("Saldo final", "saldoFinal", "total"),
    ],
  };
}

const ROTULOS_ORCAMENTO: Record<LinhaDre, string> = Object.fromEntries(
  (Object.keys(LINHAS_DRE) as LinhaDre[]).map((l) => [l, LINHAS_DRE[l].rotulo]),
) as Record<LinhaDre, string>;

/** Soma mês a mês de várias séries de 12 meses. */
const somaMeses = (series: number[][]) => Array.from({ length: 12 }, (_, m) => series.reduce((s, v) => s + v[m], 0));

/** Orçamento × realizado do ano, acumulado até o mês `ate`. */
export function relatorioOrcamento(
  ano: number,
  ate: number,
  orcado: Matriz,
  realizado: Matriz,
  investimentos: { rotulo: string; orcado: number[]; realizado: number[] }[] = [],
): Relatorio {
  const totOrc = totaisMensais(orcado);
  const totReal = totaisMensais(realizado);
  const linha = (rotulo: string, o: number[], r: number[], e: EstiloLinha = "valor") => {
    const c = comparar(somaAte(o, ate), somaAte(r, ate));
    const anual = somaAte(o, 12);
    // Mesma regra da tela: sem percentual quando orçado e realizado têm sinais opostos (ex.: lucro × prejuízo).
    const executado = anual === 0 || c.realizado * anual < 0 ? null : c.realizado / anual;
    return { rotulo, estilo: e, valores: [anual, c.orcado, c.realizado, c.desvio, c.pct, executado] };
  };
  const total = (rotulo: string, chave: Total, e: EstiloLinha = "total") => linha(rotulo, totOrc[chave], totReal[chave], e);
  const valor = (l: LinhaDre) => linha(ROTULOS_ORCAMENTO[l], orcado[l], realizado[l]);
  const secao = (rotulo: string) => ({ rotulo, estilo: "secao" as const, valores: [] });
  const mes = ate === 0 ? "—" : MESES[ate - 1].toLowerCase();
  return {
    titulo: `Orçamento × realizado ${ano}`,
    subtitulo: `Novo Horizonte · acumulado de jan a ${mes}/${ano} · desvio positivo é favorável (receita acima ou gasto abaixo do orçado)`,
    colunas: [`Orçado ${ano}`, `Orçado até ${mes}`, "Realizado", "Desvio", "Desvio %", "Executado do ano"],
    colunasPct: [4, 5],
    linhas: [
      secao("Receita operacional"),
      ...(["receitaCafe", "receitaMaracuja", "receitaMilho", "receitaPecuaria", "outrasReceitas"] as const).map(valor),
      total("Total receita", "totalReceita"),
      secao("Custeio"),
      ...(["custeioCafe", "custeioMaracuja", "custeioMilho", "custeioPecuaria", "custeioGeral"] as const).map(valor),
      total("Total custeio", "totalCusteio"),
      secao("Despesas operacionais"),
      ...(["despesasAdministrativas", "despesasFinanceiras"] as const).map(valor),
      total("Total despesas", "totalDespesas"),
      valor("resultadoNaoOperacional"),
      total("Resultado do período", "resultado", "destaque"),
      ...(investimentos.length
        ? [
            secao("Investimentos (imobilizado)"),
            ...investimentos.map((i) => linha(i.rotulo, i.orcado, i.realizado)),
            linha("Total investimentos", somaMeses(investimentos.map((i) => i.orcado)), somaMeses(investimentos.map((i) => i.realizado)), "total"),
          ]
        : []),
    ],
  };
}
