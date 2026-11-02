import Link from "next/link";
import type { Metadata } from "next";
import { FormValorTerra } from "@/components/gerencial/Formularios";
import { Pagina } from "@/components/Pagina";
import { Abas, Cabecalho, Cartao } from "@/components/ui";
import { anosComMovimento, partidasDoRazao } from "@/lib/consultas";
import { prisma } from "@/lib/db";
import { dataBr, percentual, reais, reaisCurto } from "@/lib/formato";
import { hojeSP } from "@/lib/hoje";
import { dividaEm } from "@/lib/contabil/painel";
import {
  cdiMedioAnual,
  custosPorConta,
  CUSTEIO_COMO_INVESTIMENTO,
  DESTINO_CUSTEIO_GERAL,
  DESTINO_INVESTIMENTO_GERAL,
  indicadoresCultivo,
  resumirCultivo,
  retornoDosSocios,
  saudeFinanceira,
  serieInvestimento,
  valorNoCdi,
  type AnoCultivo,
} from "@/lib/gerencial/investimento";
import { cdiMensal, taxasDepreciacao, valorTerra } from "@/lib/gerencial/parametros";
import type { AtividadeRateio } from "@/lib/gerencial/rateio";
import { ATIVIDADES_PRODUCAO, ehSlugProducao, type SlugProducao } from "@/lib/producao/atividades";
import { exigirUsuario } from "@/lib/usuario";

export const metadata: Metadata = { title: "Análise por cultivo" };

const NOME: Record<SlugProducao, AtividadeRateio> = { cafe: "Café", maracuja: "Maracujá", milho: "Milho", pecuaria: "Pecuária" };
const taxa = (v: number | null) => (v === null ? "—" : percentual(v, 1));

function Numero({ rotulo, valor, nota, sinal }: { rotulo: string; valor: string; nota?: React.ReactNode; sinal?: number | null }) {
  return (
    <Cartao className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{rotulo}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${valor === "—" ? "text-stone-300" : sinal !== undefined && sinal !== null && sinal < 0 ? "neg" : ""}`}>{valor}</p>
      {nota && <p className="mt-0.5 text-xs text-stone-500">{nota}</p>}
    </Cartao>
  );
}

/** Barras do resultado por ano (positivo para cima, negativo para baixo); o ano em curso fica mais claro. */
function GraficoResultado({ anos, anoAtual }: { anos: AnoCultivo[]; anoAtual: number }) {
  const largura = 720;
  const altura = 200;
  const margem = { topo: 12, base: 22, esq: 8, dir: 8 };
  const max = Math.max(1, ...anos.map((a) => Math.abs(a.resultado)));
  const temNegativo = anos.some((a) => a.resultado < 0);
  const util = altura - margem.topo - margem.base;
  const zero = margem.topo + (temNegativo ? util / 2 : util);
  const escala = (temNegativo ? util / 2 : util) / max;
  const passo = (largura - margem.esq - margem.dir) / anos.length;
  const barra = Math.min(36, passo - 6);
  return (
    <svg viewBox={`0 0 ${largura} ${altura}`} className="h-auto w-full" role="img" aria-label="Resultado gerencial por ano">
      <line x1={margem.esq} x2={largura - margem.dir} y1={zero} y2={zero} className="stroke-stone-300" strokeWidth={1} />
      {anos.map((a, i) => {
        const h = Math.max(1, Math.abs(a.resultado) * escala);
        const x = margem.esq + i * passo + (passo - barra) / 2;
        const y = a.resultado >= 0 ? zero - h : zero;
        const parcial = a.ano === anoAtual;
        return (
          <g key={a.ano}>
            <title>{`${a.ano}${parcial ? " (até hoje)" : ""}: resultado R$ ${reaisCurto(a.resultado)} · receita R$ ${reaisCurto(a.receita)}`}</title>
            <rect x={x - 3} y={margem.topo} width={barra + 6} height={util} fill="transparent" />
            <rect
              x={x}
              y={y}
              width={barra}
              height={h}
              rx={4}
              className={`${a.resultado >= 0 ? "fill-folha-600" : "fill-red-600"} ${parcial ? "opacity-40" : ""}`}
            />
            <text x={x + barra / 2} y={altura - 6} textAnchor="middle" className="fill-stone-500 text-[11px]">
              {a.ano}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

async function Conteudo({ searchParams }: PageProps<"/analise-cultivo">) {
  await exigirUsuario();
  const busca = await searchParams;
  const aba = typeof busca.cultivo === "string" && (ehSlugProducao(busca.cultivo) || busca.cultivo === "socios") ? busca.cultivo : "cafe";
  const hoje = hojeSP();
  const anoAtual = Number(hoje.slice(0, 4));

  const [partidas, anos, taxas, terra, talhoes, colheitas, cdi] = await Promise.all([
    partidasDoRazao(),
    anosComMovimento(),
    taxasDepreciacao(),
    valorTerra(),
    prisma.talhao.groupBy({ by: ["atividade"], where: { ativo: true }, _sum: { areaHa: true } }),
    prisma.movimentoProducao.groupBy({ by: ["atividade"], where: { tipo: { in: ["COLHEITA", "NASCIMENTO"] } }, _count: true }),
    cdiMensal(),
  ]);
  const anosAnalise = anos.filter((a) => a > anos[0]); // o 1º ano só tem saldos iniciais
  const href = (cultivo: string) => `/analise-cultivo?cultivo=${cultivo}`;

  const cabecalho = (
    <>
      <Cabecalho
        titulo="Análise por cultivo"
        subtitulo="Quanto cada cultivo rende sobre o dinheiro investido nele, ano a ano, desde o início da contabilidade. Visão gerencial: não altera a DRE nem o Balanço."
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Abas
          atual={aba}
          opcoes={[
            ...Object.entries(NOME).map(([s, n]) => ({ valor: s, rotulo: n, href: href(s) })),
            { valor: "socios", rotulo: "Sítio todo (sócios)", href: href("socios") },
          ]}
        />

      </div>
    </>
  );

  // ---------------- Sítio todo: o dinheiro dos sócios ----------------
  if (aba === "socios") {
    const s = retornoDosSocios(partidas, anos, anoAtual, terra?.valorCentavos ?? 0, cdi);
    const { completos, corrente, aportadoLiquido, tirContabil, tirMercado, plHoje, fim, noCdi, cdiPeriodo, semSitio, tirCom, empate } = s;
    const aMercado = () => s.patrimonioMercadoHoje ?? plHoje;
    const patrimonio = new Map([...completos, corrente].map((a) => [a.ano, a.patrimonio]));
    // Saúde financeira do sítio (anos fechados).
    const saude = saudeFinanceira(partidas, anos).filter((x) => x.ano > anos[0] && x.ano < anoAtual);
    const ultimaSaude = saude.at(-1);
    const ebitdaMedio3 = saude.slice(-3).reduce((soma, x) => soma + x.ebitda, 0) / Math.max(1, saude.slice(-3).length);
    const divida = dividaEm(partidas, hoje);
    const dividaPorEbitda = ebitdaMedio3 > 0 ? divida / ebitdaMedio3 : null;
    const tres = saude.slice(-3);
    const juros3 = tres.reduce((soma, x) => soma + x.juros, 0);
    const cobertura = juros3 > 0 ? tres.reduce((soma, x) => soma + x.ebitda, 0) / juros3 : null;
    const anosSemJuros = tres.filter((x) => x.juros === 0).map((x) => x.ano);
    const rendimento = terra && ebitdaMedio3 ? ebitdaMedio3 / terra.valorCentavos : null;
    const vezes = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}×`);
    return (
      <>
        {cabecalho}
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Numero rotulo={`Aportado pelos sócios desde ${anos[1]}`} valor={`R$ ${reaisCurto(aportadoLiquido)}`} nota="aportes − retiradas (conta Capital Sócio)" />
          <Numero
            rotulo="Patrimônio hoje"
            valor={`R$ ${reaisCurto(terra ? aMercado() : plHoje)}`}
            nota={terra ? `com o sítio porteira fechada a R$ ${reaisCurto(terra.valorCentavos)}, menos as dívidas · contábil R$ ${reaisCurto(plHoje)}` : "ativos − dívidas, pelo balanço"}
          />
          <Numero
            rotulo={`Retorno ao ano pelo balanço (TIR ${anos[0]}–${anoAtual - 1})`}
            valor={taxa(tirContabil)}
            sinal={tirContabil}
            nota="TIR pelo balanço: aportes e retiradas de cada ano contra o patrimônio contábil no fim"
          />
          <Numero
            rotulo={`Retorno ao ano com o sítio a mercado (TIR ${anos[0]}–${anoAtual - 1})`}
            valor={taxa(tirMercado)}
            sinal={tirMercado}
            nota={
              terra
                ? `começa no que foi aportado e termina com o sítio porteira fechada a R$ ${reaisCurto(terra.valorCentavos)}: inclui a valorização`
                : "informe o valor de mercado na aba Café"
            }
          />
        </div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Saúde financeira do sítio</h2>
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Numero
            rotulo="EBITDA médio (últimos 3 anos)"
            valor={saude.length ? `R$ ${reaisCurto(ebitdaMedio3)}` : "—"}
            sinal={ebitdaMedio3}
            nota={ultimaSaude ? `${ultimaSaude.ano}: R$ ${reaisCurto(ultimaSaude.ebitda)} · receita − custeio − despesas administrativas, antes dos juros` : undefined}
          />
          <Numero
            rotulo="Dívida bancária ÷ EBITDA"
            valor={dividaPorEbitda === null ? (divida > 0 ? "EBITDA negativo" : "—") : vezes(dividaPorEbitda)}
            sinal={dividaPorEbitda === null ? (divida > 0 ? -1 : null) : 3 - dividaPorEbitda}
            nota={`dívida hoje R$ ${reaisCurto(divida)} · em quantos anos de geração de caixa ela seria paga; até 2–3× costuma ser considerado confortável`}
          />
          <Numero
            rotulo="Cobertura de juros (últimos 3 anos)"
            valor={vezes(cobertura)}
            sinal={cobertura === null ? null : cobertura - 1}
            nota={`EBITDA ÷ juros pagos (R$ ${reaisCurto(juros3)} em ${tres.map((x) => x.ano).join(", ")}); abaixo de 1× a operação não paga os juros${anosSemJuros.length ? `. Sem juros lançados em ${anosSemJuros.join(", ")}: a cobertura real é menor` : ""}`}
          />
          <Numero
            rotulo="Rendimento operacional do patrimônio"
            valor={rendimento === null ? "—" : `${taxa(rendimento)} ao ano`}
            sinal={rendimento}
            nota={terra ? `EBITDA médio ÷ sítio a R$ ${reaisCurto(terra.valorCentavos)}: quanto o patrimônio rende só com a operação (CDI no período: ${taxa(cdiPeriodo)})` : "informe o valor de mercado na aba Café"}
          />
        </div>

        {noCdi !== null && (
          <Cartao className="mb-6 overflow-x-auto p-5">
            <h2 className="mb-1 font-semibold text-stone-800">Vale a pena? O sítio comparado ao CDI</h2>
            <p className="mb-3 text-xs text-stone-500">
              Mesmo dinheiro, nas mesmas datas: o que entrou e saiu da conta dos sócios em cada ano, aplicado no CDI até 31/12/{fim}. Fonte do CDI: Banco
              Central (série 4391).
            </p>
            <table className="w-full min-w-[32rem] text-sm">
              <thead className="text-xs text-stone-500">
                <tr className="border-b border-stone-200">
                  <th className="py-2 text-left font-medium">Se o dinheiro estivesse…</th>
                  <th className="py-2 text-right font-medium">Valeria em 31/12/{fim}</th>
                  <th className="py-2 text-right font-medium">Retorno ao ano</th>
                </tr>
              </thead>
              <tbody>
                {terra && (
                  <tr className="border-t border-stone-100 font-medium">
                    <td className="py-1.5">no sítio, a R$ {reaisCurto(terra.valorCentavos)} porteira fechada</td>
                    <td className="num py-1.5">{reaisCurto(semSitio + terra.valorCentavos)}</td>
                    <td className={`num py-1.5 ${(tirMercado ?? 0) < 0 ? "neg" : ""}`}>{taxa(tirMercado)}</td>
                  </tr>
                )}
                <tr className="border-t border-stone-100">
                  <td className="py-1.5">no CDI</td>
                  <td className="num py-1.5">{reaisCurto(noCdi)}</td>
                  <td className="num py-1.5">{taxa(cdiPeriodo)}</td>
                </tr>
                <tr className="border-t border-stone-100 text-stone-500">
                  <td className="py-1.5">no sítio, pelo valor contábil</td>
                  <td className="num py-1.5">{reaisCurto(patrimonio.get(fim) ?? 0)}</td>
                  <td className="num py-1.5">{taxa(tirContabil)}</td>
                </tr>
              </tbody>
            </table>
            <div className="mt-3 space-y-1 text-sm text-stone-700">
              {terra && (
                <p>
                  {semSitio + terra.valorCentavos >= noCdi ? (
                    <span className="text-folha-700">O sítio vale R$ {reaisCurto(semSitio + terra.valorCentavos - noCdi)} a mais do que o mesmo dinheiro no CDI.</span>
                  ) : (
                    <span className="neg">O sítio vale R$ {reaisCurto(noCdi - semSitio - terra.valorCentavos)} a menos do que o mesmo dinheiro no CDI.</span>
                  )}
                </p>
              )}
              {empate !== null && empate > 0 && <p>Para empatar com o CDI, o sítio porteira fechada precisa valer R$ {reaisCurto(empate)}.</p>}
              {terra && (
                <p className="text-xs text-stone-500">
                  Sensibilidade ao valor do sítio:{" "}
                  {[-50_000_000, 50_000_000]
                    .map((d) => terra.valorCentavos + d)
                    .filter((v) => v > 0)
                    .map((v) => `a R$ ${reaisCurto(v)}, ${taxa(tirCom(v))} ao ano`)
                    .join("; ")}
                  .
                </p>
              )}
            </div>
          </Cartao>
        )}
        <Cartao className="overflow-x-auto p-5">
          <h2 className="mb-1 font-semibold text-stone-800">Dinheiro dos sócios por ano</h2>
          <p className="mb-3 text-xs text-stone-500">
            A conta Capital Sócio é movimentada como uma conta corrente dos sócios: aportes e retiradas são altos nos dois sentidos todo ano. O que conta é
            o líquido.
          </p>
          <table className="w-full min-w-[32rem] text-sm">
            <thead className="text-xs text-stone-500">
              <tr className="border-b border-stone-200">
                <th className="py-2 text-left font-medium">Ano</th>
                <th className="py-2 text-right font-medium">Aportes</th>
                <th className="py-2 text-right font-medium">Retiradas</th>
                <th className="py-2 text-right font-medium">Líquido aportado</th>
                <th className="py-2 text-right font-medium">Patrimônio em 31/12</th>
              </tr>
            </thead>
            <tbody>
              {[...completos, corrente].map((a, i) => (
                <tr key={a.ano} className="border-t border-stone-100">
                  <td className="py-1.5">
                    {a.ano}
                    {i === 0 && <span className="text-xs text-stone-500"> (saldos iniciais)</span>}
                    {a.ano === anoAtual && <span className="text-xs text-stone-500"> (até hoje)</span>}
                  </td>
                  <td className="num py-1.5">{reaisCurto(a.aportes)}</td>
                  <td className="num py-1.5">{reaisCurto(a.retiradas)}</td>
                  <td className={`num py-1.5 ${a.aportes - a.retiradas < 0 ? "neg" : ""}`}>{reaisCurto(a.aportes - a.retiradas)}</td>
                  <td className="num py-1.5">{reaisCurto(a.patrimonio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Cartao>
      </>
    );
  }

  // ---------------- Um cultivo ----------------
  const slug = aba as SlugProducao;
  const nome = NOME[slug];
  const def = ATIVIDADES_PRODUCAO[slug];
  const serieTodos = serieInvestimento(partidas, anosAnalise, taxas)[nome];
  // Começa no primeiro ano em que o cultivo teve algum movimento.
  const inicio = serieTodos.findIndex((a) => a.receita || a.custeio || a.investimento || a.capital);
  const serie = inicio < 0 ? [] : serieTodos.slice(inicio);
  const completos = serie.filter((a) => a.ano < anoAtual);
  const corrente = serie.find((a) => a.ano === anoAtual);
  const mercado = nome === DESTINO_INVESTIMENTO_GERAL && terra ? terra.valorCentavos : 0;
  const r = resumirCultivo(completos, mercado);
  const periodo = completos.length ? `${completos[0].ano}–${completos.at(-1)!.ano}` : "";
  // Investimento e capital vão até hoje (incluem o ano em curso); resultado e TIR só com anos fechados.
  const ateHoje = serie.length ? `${serie[0].ano}–hoje` : "";
  const investidoAteHoje = (r?.investimentoAcumulado ?? 0) + (corrente?.investimento ?? 0);
  const capitalAgora = mercado || (corrente ?? completos.at(-1))?.capital || 0;
  // Investido pelos sócios: aportes − retiradas na conta Capital Sócio desde o 1º ano de movimento (sem depreciação).
  const aportadoSocios = -partidas.filter((p) => p.categoria === "PL Capital Sócio" && Number(p.data.slice(0, 4)) > anos[0]).reduce((s, p) => s + p.valorCentavos, 0);
  const recentes = completos.slice(-3);
  const retornoAgora = capitalAgora > 0 && recentes.length ? recentes.reduce((s, a) => s + a.resultado, 0) / recentes.length / capitalAgora : null;
  const semBaseTir = r !== null && r.tir === null && r.investimentoAcumulado <= 0 && !mercado;
  // Comparação com o CDI: o dinheiro que o cultivo consumiu (ou devolveu) em cada ano, aplicado no CDI até o fim do último ano fechado.
  const fimCultivo = completos.at(-1)?.ano ?? anoAtual - 1;
  const cultivoNoCdi = r?.tir !== null && r ? valorNoCdi(completos.map((a) => ({ ano: a.ano, valor: -a.caixa })), cdi, fimCultivo) : null;
  const cdiCultivo = completos.length ? cdiMedioAnual(cdi, completos[0].ano, fimCultivo) : null;
  // Indicadores de gestão (anos fechados).
  const ind = r ? indicadoresCultivo(completos, r.capitalHoje) : null;
  // Múltiplo só com capital de verdade (investimento lançado ou valor de mercado), como a TIR.
  const multiplo = ind && !semBaseTir ? ind.multiplo : null;
  const ultimo = completos.at(-1)?.ano ?? null;
  const custosUltimo = ultimo ? custosPorConta(partidas, nome, ultimo) : new Map<string, number>();
  const custosAnterior = ultimo ? custosPorConta(partidas, nome, ultimo - 1) : new Map<string, number>();
  const totalCustosUltimo = [...custosUltimo.values()].reduce((s, v) => s + v, 0);
  const estruturaCustos = [...custosUltimo]
    .map(([conta, valor]) => ({ conta, valor, anterior: custosAnterior.get(conta) ?? 0 }))
    .filter((c) => c.valor > 0)
    .sort((a, b) => b.valor - a.valor);
  const principais = estruturaCustos.slice(0, 8);
  const outros = estruturaCustos.slice(8);
  if (outros.length) principais.push({ conta: `Outras ${outros.length} contas`, valor: outros.reduce((s, c) => s + c.valor, 0), anterior: outros.reduce((s, c) => s + c.anterior, 0) });
  const ano = (a: AnoCultivo | null | undefined) => (a ? `${a.ano} (R$ ${reaisCurto(a.resultado)})` : "—");

  // Leitura rápida: o que um analista diria olhando estes números.
  const leitura: { texto: string; tom: "bom" | "ruim" | "neutro" }[] = [];
  if (r && ind) {
    if (r.tir !== null && cdiCultivo !== null)
      leitura.push({
        texto: `Retorno de ${taxa(r.tir)} ao ano${mercado ? " (com a valorização do sítio)" : ""}, contra ${taxa(cdiCultivo)} do CDI no mesmo período.`,
        tom: r.tir >= cdiCultivo ? "bom" : "ruim",
      });
    if (retornoAgora !== null)
      leitura.push({
        texto: `Só a operação rende ${taxa(retornoAgora)} ao ano sobre o capital de hoje (média dos últimos 3 anos)${cdiCultivo !== null && retornoAgora < cdiCultivo ? (mercado ? ": abaixo do CDI, o ganho tem vindo da valorização do patrimônio" : ": abaixo do CDI") : ""}.`,
        tom: cdiCultivo !== null && retornoAgora >= cdiCultivo ? "bom" : "ruim",
      });
    leitura.push({
      texto: `Lucro em ${ind.anosComLucro} de ${ind.anos} anos. Melhor ano: ${ano(ind.melhor)}; pior: ${ano(ind.pior)}.`,
      tom: ind.anosComLucro * 2 >= ind.anos ? "neutro" : "ruim",
    });
    if (ind.crescimentoReceita !== null && ind.crescimentoCusteio !== null)
      leitura.push({
        texto: `Receita cresce ${taxa(ind.crescimentoReceita)} ao ano e o custo direto ${taxa(ind.crescimentoCusteio)} ao ano${ind.crescimentoCusteio > ind.crescimentoReceita ? ": os custos sobem mais rápido que a receita e comprimem a margem" : ": a receita cresce mais rápido que os custos"}.`,
        tom: ind.crescimentoCusteio > ind.crescimentoReceita ? "ruim" : "bom",
      });
    if (estruturaCustos[0] && totalCustosUltimo > 0)
      leitura.push({
        texto: `Maior custo em ${ultimo}: ${estruturaCustos[0].conta.replace(/^Custeio (com |em )?/, "")} (${percentual(estruturaCustos[0].valor, totalCustosUltimo)} do custo direto)${estruturaCustos[1] ? `, seguido de ${estruturaCustos[1].conta.replace(/^Custeio (com |em )?/, "")} (${percentual(estruturaCustos[1].valor, totalCustosUltimo)})` : ""}.`,
        tom: "neutro",
      });
  }

  // Qualidade dos dados para este cultivo.
  const semMovimento = completos.filter((a) => !a.receita && !a.custeio).map((a) => a.ano);
  const custeioGeral = partidas.filter((p) => p.categoria === "Custeio" && p.atividade === "Geral" && Number(p.data.slice(0, 4)) >= (completos[0]?.ano ?? anoAtual));
  const custeioGeralTotal = custeioGeral.reduce((s, p) => s + p.valorCentavos, 0);
  const area = talhoes.find((t) => t.atividade === def.chave)?._sum.areaHa ?? 0;
  const temColheita = colheitas.some((c) => c.atividade === def.chave && c._count > 0);

  return (
    <>
      {cabecalho}

      {!serie.length ? (
        <Cartao className="p-5 text-sm text-stone-600">Sem receita, custo ou investimento lançados para {nome.toLowerCase()} até agora.</Cartao>
      ) : (
        <>
          {leitura.length > 0 && (
            <Cartao className="mb-6 p-5">
              <h2 className="mb-2 font-semibold text-stone-800">Leitura rápida — {nome}</h2>
              <ul className="space-y-1.5 text-sm">
                {leitura.map((l) => (
                  <li key={l.texto} className="flex gap-2">
                    <span className={l.tom === "bom" ? "text-folha-700" : l.tom === "ruim" ? "text-red-700" : "text-stone-400"}>{l.tom === "bom" ? "▲" : l.tom === "ruim" ? "▼" : "•"}</span>
                    <span className="text-stone-700">{l.texto}</span>
                  </li>
                ))}
              </ul>
            </Cartao>
          )}

          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Rentabilidade · {periodo}</h2>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Numero
              rotulo="Resultado acumulado"
              valor={r ? `R$ ${reaisCurto(r.resultadoAcumulado)}` : "—"}
              sinal={r?.resultadoAcumulado}
              nota={r ? `margem líquida de ${taxa(r.margemMedia)} sobre R$ ${reaisCurto(r.receitaAcumulada)} de receita` : undefined}
            />
            <Numero
              rotulo="Margem direta"
              valor={taxa(ind?.margemDiretaMedia ?? null)}
              sinal={ind?.margemDiretaMedia}
              nota={r ? `R$ ${reaisCurto(r.margemDiretaAcumulada)}: receita − custo direto − depreciação, antes das despesas comuns` : undefined}
            />
            <Numero
              rotulo="EBITDA acumulado"
              valor={ind ? `R$ ${reaisCurto(ind.ebitdaAcumulado)}` : "—"}
              sinal={ind?.ebitdaAcumulado}
              nota={ind ? `margem EBITDA de ${taxa(ind.margemEbitda)}: o caixa que a operação gera antes de juros e depreciação` : undefined}
            />
            <Numero
              rotulo="EBITDA médio (últimos 3 anos)"
              valor={ind ? `R$ ${reaisCurto(ind.ebitdaMedio3)}` : "—"}
              sinal={ind?.ebitdaMedio3}
              nota={`média de ${recentes.map((a) => a.ano).join(", ")}`}
            />
          </div>

          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Retorno do capital</h2>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Numero
              rotulo={mercado ? "Valor de mercado (porteira fechada)" : "Capital investido hoje"}
              valor={`R$ ${reaisCurto(capitalAgora)}`}
              nota={
                mercado
                  ? `investido pelos sócios desde ${anos[1]} (aportes − retiradas): R$ ${reaisCurto(aportadoSocios)} · valorização de R$ ${reaisCurto(mercado - aportadoSocios)}`
                  : `investido ${ateHoje}: R$ ${reaisCurto(investidoAteHoje)} (${
                      nome === "Pecuária"
                        ? "compra de animais e bens da pecuária"
                        : CUSTEIO_COMO_INVESTIMENTO.some((c) => c.cultivo === nome)
                          ? "bens do cultivo + formação de lavoura lançada como custeio"
                          : "bens lançados para este cultivo"
                    })`
              }
            />
            <Numero
              rotulo="Retorno da operação sobre o capital"
              valor={taxa(retornoAgora)}
              sinal={retornoAgora}
              nota={
                capitalAgora > 0
                  ? `resultado médio de ${recentes.map((a) => a.ano).join(", ")} ÷ capital de hoje (sem valorização)`
                  : "sem capital investido lançado: não há base para o retorno"
              }
            />
            <Numero
              rotulo={`Retorno ao ano (TIR ${periodo})`}
              valor={taxa(r?.tir ?? null)}
              sinal={r?.tir}
              nota={
                mercado
                  ? "do dinheiro investido em cada ano até o sítio a mercado hoje: inclui a valorização"
                  : semBaseTir
                    ? `sem investimento lançado até ${completos.at(-1)!.ano}: o cultivo gerou R$ ${reaisCurto(r!.caixaAcumulado)} sem capital próprio, então a taxa não tem base${corrente?.investimento ? `; o investimento de ${anoAtual} entra quando o ano fechar` : ""}`
                    : "sobre o dinheiro investido no período, com o capital que ficou"
              }
            />
            <Numero
              rotulo="Múltiplo do capital"
              valor={multiplo !== null ? `${multiplo.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}×` : "—"}
              sinal={multiplo !== null ? multiplo - 1 : null}
              nota={
                multiplo !== null && ind
                  ? `cada R$ 1 que o cultivo consumiu virou R$ ${multiplo.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} (valor de hoje + caixa devolvido). ${
                      ind.payback ? `Caixa recuperado pela operação em ${ind.payback}.` : "A operação sozinha ainda não devolveu o caixa colocado."
                    }`
                  : semBaseTir
                    ? "sem investimento lançado no período: o múltiplo não tem base"
                    : "o cultivo não consumiu caixa no período"
              }
            />
          </div>
          {r && cultivoNoCdi !== null && (
            <Cartao className="mb-6 p-5 text-sm">
              <h2 className="mb-1 font-semibold text-stone-800">Vale a pena? {nome} comparado ao CDI</h2>
              <p className="mb-3 text-xs text-stone-500">
                O dinheiro que o cultivo consumiu em cada ano (investimentos e prejuízos, menos o que devolveu), aplicado no CDI até 31/12/{fimCultivo}. Fonte
                do CDI: Banco Central (série 4391).
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-stone-500">{mercado ? "Sítio porteira fechada hoje" : "Capital do cultivo hoje"}</p>
                  <p className="text-lg font-semibold tabular-nums">R$ {reaisCurto(r.capitalHoje)}</p>
                  <p className="text-xs text-stone-500">retorno de {taxa(r.tir)} ao ano</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500">O mesmo dinheiro no CDI</p>
                  <p className="text-lg font-semibold tabular-nums">R$ {reaisCurto(cultivoNoCdi)}</p>
                  <p className="text-xs text-stone-500">CDI de {taxa(cdiCultivo)} ao ano no período</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500">Diferença</p>
                  <p className={`text-lg font-semibold tabular-nums ${r.capitalHoje - cultivoNoCdi < 0 ? "neg" : "text-folha-700"}`}>R$ {reaisCurto(r.capitalHoje - cultivoNoCdi)}</p>
                  <p className="text-xs text-stone-500">{r.capitalHoje >= cultivoNoCdi ? "a favor do cultivo" : "a favor do CDI"}</p>
                </div>
              </div>
              {mercado > 0 && (
                <p className="mt-3 text-xs text-stone-500">
                  Para empatar com o CDI, o sítio precisa valer R$ {reaisCurto(cultivoNoCdi)}. Sensibilidade:{" "}
                  {[-50_000_000, 50_000_000]
                    .map((d) => mercado + d)
                    .filter((v) => v > 0)
                    .map((v) => `a R$ ${reaisCurto(v)}, ${taxa(resumirCultivo(completos, v)?.tir ?? null)} ao ano`)
                    .join("; ")}
                  .
                </p>
              )}
            </Cartao>
          )}

          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Crescimento e consistência · {periodo}</h2>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Numero
              rotulo="Crescimento da receita"
              valor={ind?.crescimentoReceita !== null && ind?.crescimentoReceita !== undefined ? `${taxa(ind.crescimentoReceita)} ao ano` : "—"}
              sinal={ind?.crescimentoReceita}
              nota={completos.length >= 6 ? "médias de 3 anos nas pontas (o café alterna safra cheia e fraca)" : "do primeiro ao último ano fechado"}
            />
            <Numero
              rotulo="Crescimento do custo direto"
              valor={ind?.crescimentoCusteio !== null && ind?.crescimentoCusteio !== undefined ? `${taxa(ind.crescimentoCusteio)} ao ano` : "—"}
              sinal={ind && ind.crescimentoCusteio !== null && ind.crescimentoReceita !== null ? ind.crescimentoReceita - ind.crescimentoCusteio : null}
              nota={
                ind && ind.crescimentoCusteio !== null && ind.crescimentoReceita !== null
                  ? ind.crescimentoCusteio > ind.crescimentoReceita
                    ? "acima da receita: a margem está sendo comprimida"
                    : "abaixo da receita: a margem está crescendo"
                  : undefined
              }
            />
            <Numero
              rotulo="Anos com lucro"
              valor={ind ? `${ind.anosComLucro} de ${ind.anos}` : "—"}
              sinal={ind ? ind.anosComLucro * 2 - ind.anos : null}
              nota="resultado gerencial positivo (depois das despesas comuns)"
            />
            <Numero rotulo="Melhor e pior ano" valor={ind?.melhor ? String(ind.melhor.ano) : "—"} nota={ind ? `melhor: ${ano(ind.melhor)} · pior: ${ano(ind.pior)}` : undefined} />
          </div>
          <Cartao className="mb-6 p-5">
            <h2 className="font-semibold text-stone-800">Resultado gerencial por ano — {nome}</h2>
            <p className="mb-2 text-xs text-stone-500">Depois do custo direto, da depreciação e da parte dos custos comuns. Passe o mouse para ver os valores.</p>
            <GraficoResultado anos={serie} anoAtual={anoAtual} />
          </Cartao>

          {principais.length > 0 && (
            <Cartao className="mb-6 overflow-x-auto p-5">
              <h2 className="mb-1 font-semibold text-stone-800">Para onde vai o dinheiro — custo direto de {ultimo}</h2>
              <p className="mb-3 text-xs text-stone-500">Contas de custeio do cultivo no último ano fechado, comparadas com {ultimo! - 1}.</p>
              <table className="w-full min-w-[36rem] text-sm">
                <thead className="text-xs text-stone-500">
                  <tr className="border-b border-stone-200">
                    <th className="py-2 text-left font-medium">Conta</th>
                    <th className="py-2 text-right font-medium">{ultimo}</th>
                    <th className="w-40 py-2 pl-4 text-left font-medium">% do custo direto</th>
                    <th className="py-2 text-right font-medium">{ultimo! - 1}</th>
                    <th className="py-2 text-right font-medium">Variação</th>
                  </tr>
                </thead>
                <tbody>
                  {principais.map((c) => (
                    <tr key={c.conta} className="border-t border-stone-100">
                      <td className="py-1.5">{c.conta.replace(/^Custeio (com |em )?/, "")}</td>
                      <td className="num py-1.5">{reaisCurto(c.valor)}</td>
                      <td className="py-1.5 pl-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full bg-stone-100">
                            <div className="h-2 rounded-full bg-folha-600" style={{ width: `${Math.min(100, (c.valor / totalCustosUltimo) * 100)}%` }} />
                          </div>
                          <span className="w-12 text-right text-xs tabular-nums text-stone-600">{percentual(c.valor, totalCustosUltimo)}</span>
                        </div>
                      </td>
                      <td className="num py-1.5 text-stone-500">{c.anterior ? reaisCurto(c.anterior) : "—"}</td>
                      <td className={`num py-1.5 ${c.anterior && c.valor > c.anterior ? "neg" : "text-folha-700"}`}>
                        {c.anterior > 0 ? `${c.valor >= c.anterior ? "+" : "−"}${percentual(Math.abs(c.valor - c.anterior), c.anterior)}` : "novo"}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-stone-200 font-medium">
                    <td className="py-1.5">Total</td>
                    <td className="num py-1.5">{reaisCurto(totalCustosUltimo)}</td>
                    <td />
                    <td className="num py-1.5 text-stone-500">{reaisCurto([...custosAnterior.values()].reduce((s, v) => s + v, 0))}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </Cartao>
          )}
          <Cartao className="mb-6 overflow-x-auto p-5">
            <h2 className="mb-3 font-semibold text-stone-800">Ano a ano</h2>
            <table className="w-full min-w-[68rem] text-sm">
              <thead className="text-xs text-stone-500">
                <tr className="border-b border-stone-200">
                  <th className="py-2 text-left font-medium">Ano</th>
                  <th className="py-2 text-right font-medium">Receita</th>
                  <th className="py-2 text-right font-medium">Custo direto</th>
                  <th className="py-2 text-right font-medium">Margem direta</th>
                  <th className="py-2 text-right font-medium">Margem direta %</th>
                  <th className="py-2 text-right font-medium">EBITDA</th>
                  <th className="py-2 text-right font-medium">Resultado</th>
                  <th className="py-2 text-right font-medium">Margem líquida %</th>
                  <th className="py-2 text-right font-medium">Investido</th>
                  <th className="py-2 text-right font-medium">{mercado ? "Bens 31/12 (após depreciação)" : "Capital 31/12"}</th>
                  <th className="py-2 text-right font-medium">{mercado ? `Retorno s/ R$ ${reaisCurto(mercado)}` : "Retorno s/ capital"}</th>
                </tr>
              </thead>
              <tbody>
                {serie.map((a, i) => {
                  const anterior = serie[i - 1]?.capital ?? a.capital;
                  const capitalMedio = mercado || (anterior + a.capital) / 2;
                  return (
                    <tr key={a.ano} className={`border-t border-stone-100 ${a.ano === anoAtual ? "text-stone-500" : ""}`}>
                      <td className="py-1.5">
                        {a.ano}
                        {a.ano === anoAtual && <span className="text-xs"> (até hoje)</span>}
                      </td>
                      <td className="num py-1.5">{reaisCurto(a.receita)}</td>
                      <td className="num py-1.5">{reaisCurto(a.custeio)}</td>
                      <td className={`num py-1.5 ${a.margemDireta < 0 ? "neg" : ""}`}>{reaisCurto(a.margemDireta)}</td>
                      <td className="num py-1.5">{a.receita > 0 ? percentual(a.margemDireta, a.receita) : "—"}</td>
                      <td className={`num py-1.5 ${a.ebitda < 0 ? "neg" : ""}`}>{reaisCurto(a.ebitda)}</td>
                      <td className={`num py-1.5 font-medium ${a.resultado < 0 ? "neg" : ""}`}>{reaisCurto(a.resultado)}</td>
                      <td className="num py-1.5">{a.receita > 0 ? percentual(a.resultado, a.receita) : "—"}</td>
                      <td className="num py-1.5">{a.investimento ? reaisCurto(a.investimento) : ""}</td>
                      <td className="num py-1.5">{reaisCurto(a.capital)}</td>
                      <td className={`num py-1.5 ${a.resultado < 0 ? "neg" : ""}`}>{a.ano !== anoAtual && capitalMedio > 0 ? percentual(a.resultado, capitalMedio) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {corrente && <p className="mt-2 text-xs text-stone-500">{anoAtual} está em andamento: fica fora dos acumulados e das taxas de retorno.</p>}
          </Cartao>

          {nome === DESTINO_INVESTIMENTO_GERAL && (
            <Cartao className="mb-6 p-5">
              <h2 className="mb-1 font-semibold text-stone-800">Valor de mercado do sítio</h2>
              <p className="mb-3 text-xs text-stone-500">
                Porteira fechada (terra, lavouras e máquinas) pelo valor de venda estimado hoje. É o capital do café hoje, no lugar do valor contábil desses bens
                (decisões de 23/10/2026). Na TIR, o ponto de partida é o que os sócios aportaram e o de chegada é este valor: a valorização do sítio entra no
                retorno.
                {terra && ` Último valor: R$ ${reais(terra.valorCentavos)}, estimado em ${dataBr(terra.data)}.`}
              </p>
              <FormValorTerra valor={terra ? reais(terra.valorCentavos) : ""} data={terra?.data ?? ""} hoje={hoje} />
            </Cartao>
          )}

          <Cartao className="p-5 text-sm">
            <h2 className="mb-2 font-semibold text-stone-800">Como ler e o que ainda limita esta análise</h2>
            <ul className="list-disc space-y-1 pl-5 text-stone-700">
              <li>Despesas administrativas e financeiras são divididas entre os cultivos pela receita de cada um. O custeio sem cultivo vai para o café.</li>
              <li>EBITDA = resultado + depreciação + juros: o caixa que a operação gera antes de pagar juros e repor máquinas.</li>
              {!area && (
                <li>
                  Sem área cadastrada: falta o resultado por hectare. Cadastre em{" "}
                  <Link href={`/producao/${slug}?aba=talhoes`} className="text-folha-700 hover:underline">
                    Produção e vendas → {slug === "pecuaria" ? "Pastos" : "Talhões"}
                  </Link>
                  .
                </li>
              )}
              {!temColheita && slug !== "pecuaria" && (
                <li>
                  Sem colheitas registradas: falta o custo e o resultado por {def.unidadeCurta}. Registre em{" "}
                  <Link href={`/producao/${slug}?aba=movimentos`} className="text-folha-700 hover:underline">
                    Produção e vendas → Movimentos
                  </Link>
                  .
                </li>
              )}
              {custeioGeralTotal > 0 && nome === DESTINO_CUSTEIO_GERAL && (
                <li>
                  O custo direto inclui R$ {reaisCurto(custeioGeralTotal)} de custeio lançado como “Geral” desde {completos[0]?.ano ?? anoAtual} (decisão de
                  23/10/2026: o café é praticamente o sítio todo).
                </li>
              )}
              {semMovimento.length > 0 && <li>Anos sem nenhum lançamento deste cultivo: {semMovimento.join(", ")}.</li>}
              {nome === DESTINO_INVESTIMENTO_GERAL && !terra && <li>Sem o valor de mercado do sítio, o capital do café fica só com os bens pelo valor contábil: o capital está subestimado e as taxas de retorno saem distorcidas.</li>}
              {nome !== DESTINO_INVESTIMENTO_GERAL && (
                <li>Máquinas, prédios e veículos de uso geral estão todos no café (decisão de 23/10/2026); por isso o capital próprio deste cultivo é só o que foi lançado para ele.</li>
              )}
            </ul>
          </Cartao>
        </>
      )}
    </>
  );
}

export default function AnaliseCultivoPage(props: PageProps<"/analise-cultivo">) {
  return (
    <Pagina>
      <Conteudo {...props} />
    </Pagina>
  );
}
