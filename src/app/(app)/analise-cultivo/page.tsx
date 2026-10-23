import Link from "next/link";
import type { Metadata } from "next";
import { FormValorTerra } from "@/components/gerencial/Formularios";
import { Pagina } from "@/components/Pagina";
import { Abas, Cabecalho, Cartao } from "@/components/ui";
import { balancoAnual } from "@/lib/contabil/relatorios";
import { anosComMovimento, partidasDoRazao } from "@/lib/consultas";
import { prisma } from "@/lib/db";
import { dataBr, percentual, reais, reaisCurto } from "@/lib/formato";
import { hojeSP } from "@/lib/hoje";
import { DESTINO_INVESTIMENTO_GERAL, patrimonioAMercado, resumirCultivo, serieInvestimento, serieSocios, tirSocios, type AnoCultivo } from "@/lib/gerencial/investimento";
import { rateioManual, taxasDepreciacao, valorTerra } from "@/lib/gerencial/parametros";
import { CRITERIOS, ehCriterio, type AtividadeRateio, type Criterio } from "@/lib/gerencial/rateio";
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
  const criterio: Criterio = ehCriterio(busca.criterio) ? busca.criterio : "receita";
  const hoje = hojeSP();
  const anoAtual = Number(hoje.slice(0, 4));

  const [partidas, anos, taxas, manual, terra, talhoes, colheitas] = await Promise.all([
    partidasDoRazao(),
    anosComMovimento(),
    taxasDepreciacao(),
    rateioManual(),
    valorTerra(),
    prisma.talhao.groupBy({ by: ["atividade"], where: { ativo: true }, _sum: { areaHa: true } }),
    prisma.movimentoProducao.groupBy({ by: ["atividade"], where: { tipo: { in: ["COLHEITA", "NASCIMENTO"] } }, _count: true }),
  ]);
  const anosAnalise = anos.filter((a) => a > anos[0]); // o 1º ano só tem saldos iniciais
  const href = (cultivo: string, c: Criterio = criterio) => `/analise-cultivo?cultivo=${cultivo}${c === "receita" ? "" : `&criterio=${c}`}`;

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
        {aba !== "socios" && (
          <span className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
            Custos comuns divididos:
            <Abas atual={criterio} opcoes={Object.entries(CRITERIOS).map(([c, r]) => ({ valor: c, rotulo: r.replace("Proporcional ao ", "pelo ").replace("Proporcional à ", "pela "), href: href(aba, c as Criterio) }))} />
          </span>
        )}
      </div>
    </>
  );

  // ---------------- Sítio todo: o dinheiro dos sócios ----------------
  if (aba === "socios") {
    const balanco = balancoAnual(partidas, anos);
    const patrimonio = new Map([...balanco].map(([a, b]) => [a, b.totalPL]));
    const completos = serieSocios(partidas, anos.filter((a) => a < anoAtual), patrimonio);
    const corrente = serieSocios(partidas, [anoAtual], patrimonio)[0];
    const aportadoLiquido = [...completos.slice(1), corrente].reduce((s, a) => s + a.aportes - a.retiradas, 0);
    const tirContabil = tirSocios(completos);
    const aMercado = (a: number) => patrimonioAMercado(patrimonio.get(a) ?? 0, balanco.get(a)?.imobilizado ?? 0, terra?.valorCentavos ?? 0);
    const tirMercado = terra ? tirSocios(completos.map((a) => ({ ...a, patrimonio: aMercado(a.ano) }))) : null;
    const plHoje = patrimonio.get(anoAtual) ?? 0;
    return (
      <>
        {cabecalho}
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Numero rotulo={`Aportado pelos sócios desde ${anos[1]}`} valor={`R$ ${reaisCurto(aportadoLiquido)}`} nota="aportes − retiradas (conta Capital Sócio)" />
          <Numero
            rotulo="Patrimônio hoje"
            valor={`R$ ${reaisCurto(terra ? aMercado(anoAtual) : plHoje)}`}
            nota={terra ? `com o sítio porteira fechada a R$ ${reaisCurto(terra.valorCentavos)}, menos as dívidas · contábil R$ ${reaisCurto(plHoje)}` : "ativos − dívidas, pelo balanço"}
          />
          <Numero
            rotulo={`Retorno dos sócios ao ano (${anos[0]}–${anoAtual - 1})`}
            valor={taxa(tirContabil)}
            sinal={tirContabil}
            nota="TIR pelo balanço: aportes e retiradas de cada ano contra o patrimônio contábil no fim"
          />
          <Numero
            rotulo="Retorno com o sítio a mercado"
            valor={taxa(tirMercado)}
            sinal={tirMercado}
            nota={
              terra
                ? `sítio porteira fechada a R$ ${reaisCurto(terra.valorCentavos)} no início e no fim, no lugar do imobilizado contábil (sem valorização)`
                : "informe o valor de mercado na aba Café"
            }
          />
        </div>
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
  const serieTodos = serieInvestimento(partidas, anosAnalise, taxas, criterio, manual)[nome];
  // Começa no primeiro ano em que o cultivo teve algum movimento.
  const inicio = serieTodos.findIndex((a) => a.receita || a.custeio || a.investimento || a.capital);
  const serie = inicio < 0 ? [] : serieTodos.slice(inicio);
  const completos = serie.filter((a) => a.ano < anoAtual);
  const corrente = serie.find((a) => a.ano === anoAtual);
  const mercado = nome === DESTINO_INVESTIMENTO_GERAL && terra ? terra.valorCentavos : 0;
  const r = resumirCultivo(completos, mercado);
  const periodo = completos.length ? `${completos[0].ano}–${completos.at(-1)!.ano}` : "";

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
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Numero
              rotulo={`Resultado acumulado ${periodo}`}
              valor={r ? `R$ ${reaisCurto(r.resultadoAcumulado)}` : "—"}
              sinal={r?.resultadoAcumulado}
              nota={
                r ? (
                  <>
                    margem de {taxa(r.margemMedia)} sobre R$ {reaisCurto(r.receitaAcumulada)} de receita
                    <span className="block">
                      antes dos custos comuns (margem direta): <span className={r.margemDiretaAcumulada < 0 ? "neg" : "text-folha-700"}>R$ {reaisCurto(r.margemDiretaAcumulada)}</span>
                    </span>
                  </>
                ) : undefined
              }
            />
            <Numero
              rotulo={`Investido ${periodo}`}
              valor={r ? `R$ ${reaisCurto(r.investimentoAcumulado)}` : "—"}
              nota={
                nome === DESTINO_INVESTIMENTO_GERAL
                  ? "imobilizado do café + máquinas, prédios, benfeitorias e veículos de uso geral"
                  : nome === "Pecuária"
                    ? "compra de animais (estoque) e bens da pecuária"
                    : "bens lançados para este cultivo"
              }
            />
            <Numero
              rotulo="Caixa gerado − investido"
              valor={r ? `R$ ${reaisCurto(r.caixaAcumulado)}` : "—"}
              sinal={r?.caixaAcumulado}
              nota="resultado + depreciação − investimentos, somados no período"
            />
            <Numero
              rotulo="Capital investido hoje"
              valor={r ? `R$ ${reaisCurto(r.capitalHoje)}` : "—"}
              nota={
                mercado
                  ? `sítio porteira fechada (terra, lavouras e máquinas) a mercado · contábil R$ ${reaisCurto(completos.at(-1)?.capital ?? 0)}`
                  : nome === DESTINO_INVESTIMENTO_GERAL
                    ? "bens pelo valor depreciado — falta o valor de mercado do sítio (abaixo)"
                    : "bens pelo valor depreciado"
              }
            />
            <Numero
              rotulo="Retorno sobre o capital"
              valor={taxa(r?.retornoRecente ?? null)}
              sinal={r?.retornoRecente}
              nota="resultado médio dos últimos 3 anos ÷ capital investido hoje"
            />
            <Numero
              rotulo={`Retorno ao ano (TIR ${periodo})`}
              valor={taxa(r?.tir ?? null)}
              sinal={r?.tir}
              nota={mercado ? "sítio a mercado no início e no fim pelo mesmo valor; sem valorização" : "sobre o dinheiro investido no período, com o capital que ficou"}
            />
          </div>

          <Cartao className="mb-6 p-5">
            <h2 className="font-semibold text-stone-800">Resultado gerencial por ano — {nome}</h2>
            <p className="mb-2 text-xs text-stone-500">Depois do custo direto, da depreciação e da parte dos custos comuns. Passe o mouse para ver os valores.</p>
            <GraficoResultado anos={serie} anoAtual={anoAtual} />
          </Cartao>

          <Cartao className="mb-6 overflow-x-auto p-5">
            <h2 className="mb-3 font-semibold text-stone-800">Ano a ano</h2>
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="text-xs text-stone-500">
                <tr className="border-b border-stone-200">
                  <th className="py-2 text-left font-medium">Ano</th>
                  <th className="py-2 text-right font-medium">Receita</th>
                  <th className="py-2 text-right font-medium">Custo direto</th>
                  <th className="py-2 text-right font-medium">Margem direta</th>
                  <th className="py-2 text-right font-medium">Margem %</th>
                  <th className="py-2 text-right font-medium">Resultado</th>
                  <th className="py-2 text-right font-medium">Investido</th>
                  <th className="py-2 text-right font-medium">{mercado ? "Bens contábeis 31/12" : "Capital 31/12"}</th>
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
                      <td className={`num py-1.5 font-medium ${a.resultado < 0 ? "neg" : ""}`}>{reaisCurto(a.resultado)}</td>
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
                Porteira fechada (terra, lavouras e máquinas) pelo valor de venda estimado hoje. Substitui o valor contábil desses bens como capital do café
                (decisões de 23/10/2026), no início e no fim do período, para o retorno ser comparável a deixar o dinheiro aplicado.
                {terra && ` Último valor: R$ ${reais(terra.valorCentavos)}, estimado em ${dataBr(terra.data)}.`}
              </p>
              <FormValorTerra valor={terra ? reais(terra.valorCentavos) : ""} data={terra?.data ?? ""} hoje={hoje} />
            </Cartao>
          )}

          <Cartao className="p-5 text-sm">
            <h2 className="mb-2 font-semibold text-stone-800">O que ainda limita esta análise</h2>
            <ul className="list-disc space-y-1 pl-5 text-stone-700">
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
              {custeioGeralTotal > 0 && (
                <li>
                  R$ {reaisCurto(custeioGeralTotal)} de custeio desde {completos[0]?.ano ?? anoAtual} está como “Geral”, sem cultivo, e entra aqui pelo critério de
                  divisão escolhido acima. Quanto mais custeio for lançado direto no cultivo, mais precisa fica a margem.
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
