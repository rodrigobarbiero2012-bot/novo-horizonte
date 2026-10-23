import { ehEstoqueAnimais } from "../contabil/painel";
import type { Atividade, PartidaContabil } from "../contabil/tipos";
import { depreciacaoNoAno, type Camada } from "./depreciacao";
import { ATIVIDADES_RATEIO, ehAtividadeRateio, resultadoPorAtividade, type AtividadeRateio, type Criterio } from "./rateio";

// Análise de investimento por cultivo: resultado ano a ano, capital investido
// e retorno sobre esse capital. Valores em centavos.
//
// Decisões do Rodrigo (23/10/2026):
//  - Investimento de uso geral (máquinas, prédios, terra, veículos) é 100% do
//    café — e, por coerência, a depreciação desses bens também.
//  - A terra entra pelo valor de mercado informado por ele. Como ela não está
//    na contabilidade, entra como capital no início e no fim do período pelo
//    mesmo valor: o retorno é o da operação sobre o patrimônio de hoje, sem
//    contar valorização da terra.

export const DESTINO_INVESTIMENTO_GERAL: AtividadeRateio = "Café";

type Por = Record<AtividadeRateio, number>;
const zeros = (): Por => ({ Café: 0, Maracujá: 0, Milho: 0, Pecuária: 0 });

export type AnoCultivo = {
  ano: number;
  receita: number;
  custeio: number;
  margemDireta: number; // receita − custeio − depreciação dos bens do cultivo
  resultado: number; // margem direta − custos comuns rateados
  depreciacao: number;
  investimento: number; // imobilizado comprado (e, no gado, animais) no ano
  capital: number; // imobilizado líquido de depreciação (+ rebanho) em 31/12
  /** Caixa da operação no ano: resultado + depreciação − investimento. */
  caixa: number;
};

export type TaxaImobilizado = { nome: string; atividade: string; taxa: number };

/** Cultivo dono de uma conta de imobilizado: o da conta ou, se for de uso geral, o destino do investimento geral. */
export const donoDoBem = (atividade: string): AtividadeRateio => (ehAtividadeRateio(atividade) ? atividade : DESTINO_INVESTIMENTO_GERAL);

/** Série anual por cultivo, para os anos pedidos (em ordem crescente). */
export function serieInvestimento(
  partidas: PartidaContabil[],
  anos: number[],
  taxas: TaxaImobilizado[],
  criterio: Criterio,
  manual: Por,
): Record<AtividadeRateio, AnoCultivo[]> {
  const camadas = new Map<string, Camada[]>();
  for (const p of partidas) {
    if (p.categoria !== "Ativo Imobilizado" || !p.conta) continue;
    camadas.set(p.conta, [...(camadas.get(p.conta) ?? []), { data: p.data, valorCentavos: p.valorCentavos }]);
  }
  const serie = Object.fromEntries(ATIVIDADES_RATEIO.map((a) => [a, [] as AnoCultivo[]])) as Record<AtividadeRateio, AnoCultivo[]>;

  for (const ano of [...anos].sort((x, y) => x - y)) {
    const depreciacao = zeros();
    const liquido = zeros();
    for (const t of taxas) {
      const d = depreciacaoNoAno(camadas.get(t.nome) ?? [], t.taxa, ano);
      depreciacao[donoDoBem(t.atividade)] += d.doAno;
      liquido[donoDoBem(t.atividade)] += d.liquido;
    }
    // Depreciação já atribuída ao dono do bem: nada de "uso geral" sobra para o rateio.
    const r = resultadoPorAtividade(
      partidas,
      ano,
      criterio,
      manual,
      ATIVIDADES_RATEIO.map((a) => ({ atividade: a as Atividade, valor: depreciacao[a] })),
    );
    const investimento = zeros();
    const rebanho = zeros();
    for (const p of partidas) {
      const a = Number(p.data.slice(0, 4));
      if (a > ano) continue;
      if (p.categoria === "Ativo Imobilizado" && a === ano) investimento[donoDoBem(p.atividade)] += p.valorCentavos;
      if (ehEstoqueAnimais(p)) {
        rebanho.Pecuária += p.valorCentavos;
        if (a === ano) investimento.Pecuária += p.valorCentavos;
      }
    }
    for (const a of ATIVIDADES_RATEIO) {
      serie[a].push({
        ano,
        receita: r.receita[a],
        custeio: r.custeio[a],
        margemDireta: r.margemDireta[a],
        resultado: r.resultado[a],
        depreciacao: depreciacao[a],
        investimento: investimento[a],
        capital: liquido[a] + rebanho[a],
        caixa: r.resultado[a] + depreciacao[a] - investimento[a],
      });
    }
  }
  return serie;
}

/**
 * Taxa interna de retorno de fluxos anuais (o primeiro no instante zero).
 * Com aportes e retiradas alternados pode haver mais de uma raiz: fica a mais
 * próxima de zero. Null se não houver troca de sinal.
 */
export function tir(fluxos: number[]): number | null {
  if (!fluxos.some((f) => f < 0) || !fluxos.some((f) => f > 0)) return null;
  const vpl = (taxa: number) => fluxos.reduce((s, f, i) => s + f / (1 + taxa) ** i, 0);
  const raizes: number[] = [];
  const pontos = [-0.95, -0.9, -0.8, -0.7, -0.6, -0.5, -0.4, -0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10];
  for (let k = 0; k < pontos.length - 1; k++) {
    let baixo = pontos[k];
    let alto = pontos[k + 1];
    if (Math.sign(vpl(baixo)) === Math.sign(vpl(alto))) continue;
    for (let i = 0; i < 100; i++) {
      const meio = (baixo + alto) / 2;
      if (Math.sign(vpl(meio)) === Math.sign(vpl(baixo))) baixo = meio;
      else alto = meio;
    }
    raizes.push((baixo + alto) / 2);
  }
  return raizes.length ? raizes.reduce((m, r) => (Math.abs(r) < Math.abs(m) ? r : m)) : null;
}

export type ResumoCultivo = {
  anos: number; // anos completos considerados
  resultadoAcumulado: number;
  margemDiretaAcumulada: number;
  receitaAcumulada: number;
  investimentoAcumulado: number;
  caixaAcumulado: number; // resultado + depreciação − investimento, somados
  margemMedia: number | null; // resultado acumulado ÷ receita acumulada
  capitalHoje: number; // capital contábil no fim do último ano + terra
  /** Resultado médio dos últimos 3 anos ÷ capital de hoje. */
  retornoRecente: number | null;
  /** TIR do período: capital inicial (terra) → caixa de cada ano → capital final. */
  tir: number | null;
};

/**
 * Resumo do período (só anos completos). `terra` = valor de mercado (centavos)
 * que entra como capital no início e no fim; 0 quando não informado.
 */
export function resumirCultivo(serie: AnoCultivo[], terra = 0): ResumoCultivo | null {
  if (!serie.length) return null;
  const soma = (f: (a: AnoCultivo) => number) => serie.reduce((s, a) => s + f(a), 0);
  const ultimo = serie.at(-1)!;
  const receitaAcumulada = soma((a) => a.receita);
  const resultadoAcumulado = soma((a) => a.resultado);
  const capitalHoje = ultimo.capital + terra;
  const recentes = serie.slice(-3);
  const mediaRecente = recentes.reduce((s, a) => s + a.resultado, 0) / recentes.length;
  // Instante zero = início do 1º ano (terra); cada ano, o caixa; no último, mais o capital que ficou.
  const fluxos = [-terra, ...serie.map((a, i) => a.caixa + (i === serie.length - 1 ? capitalHoje : 0))];
  const investimentoAcumulado = soma((a) => a.investimento);
  return {
    anos: serie.length,
    resultadoAcumulado,
    margemDiretaAcumulada: soma((a) => a.margemDireta),
    receitaAcumulada,
    investimentoAcumulado,
    caixaAcumulado: soma((a) => a.caixa),
    margemMedia: receitaAcumulada > 0 ? resultadoAcumulado / receitaAcumulada : null,
    capitalHoje,
    retornoRecente: capitalHoje > 0 ? mediaRecente / capitalHoje : null,
    // Sem capital próprio (nada investido nem terra), "retorno sobre o investimento" não tem base.
    tir: investimentoAcumulado > 0 || terra > 0 ? tir(fluxos) : null,
  };
}

export type AnoSocios = { ano: number; aportes: number; retiradas: number; patrimonio: number };

/**
 * Dinheiro dos sócios no sítio inteiro: aportes e retiradas (conta PL Capital
 * Sócio) e o patrimônio líquido contábil no fim de cada ano.
 */
export function serieSocios(partidas: PartidaContabil[], anos: number[], patrimonio: Map<number, number>): AnoSocios[] {
  return [...anos]
    .sort((x, y) => x - y)
    .map((ano) => {
      let aportes = 0;
      let retiradas = 0;
      for (const p of partidas) {
        if (p.categoria !== "PL Capital Sócio" || !p.data.startsWith(`${ano}-`)) continue;
        if (p.valorCentavos < 0) aportes -= p.valorCentavos;
        else retiradas += p.valorCentavos;
      }
      return { ano, aportes, retiradas, patrimonio: patrimonio.get(ano) ?? 0 };
    });
}

/**
 * TIR do dinheiro dos sócios: começa com o patrimônio do fim do 1º ano (e a
 * terra), depois aportes (saída) e retiradas (entrada) de cada ano, e termina
 * com o patrimônio do último ano (e a terra).
 */
export function tirSocios(serie: AnoSocios[], terra = 0): number | null {
  if (serie.length < 2) return null;
  const [inicio, ...resto] = serie;
  return tir([
    -(inicio.patrimonio + terra),
    ...resto.map((a, i) => a.retiradas - a.aportes + (i === resto.length - 1 ? a.patrimonio + terra : 0)),
  ]);
}
