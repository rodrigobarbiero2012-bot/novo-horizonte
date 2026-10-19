import type { Metadata } from "next";
import { EditorOrcamento, type GrupoEditor } from "@/components/orcamento/EditorOrcamento";
import { Pagina } from "@/components/Pagina";
import { Abas, BotaoExportar, Cabecalho, Cartao, LinhaSecao, botaoSecundario, campo } from "@/components/ui";
import type { LinhaDre } from "@/lib/contabil/relatorios";
import { partidasDoRazao } from "@/lib/consultas";
import { prisma } from "@/lib/db";
import { MESES, reaisCurto } from "@/lib/formato";
import {
  chaveInvestimento,
  comparar,
  ehLinhaInvestimento,
  ehLinhaOrcamento,
  matrizVazia,
  mesDeCorte,
  realizadoInvestimentos,
  realizadoMensal,
  somaAte,
  somaLinhas,
  totaisMensais,
  type Comparacao,
  type Matriz,
  type Total,
} from "@/lib/orcamento/calculo";
import { exigirUsuario } from "@/lib/usuario";
import { hojeSP } from "@/lib/hoje";

export const metadata: Metadata = { title: "Orçamento × realizado" };

const GRUPOS: { rotulo: string; linhas: { chave: LinhaDre; rotulo: string }[]; total: { chave: Total; rotulo: string } | null }[] = [
  {
    rotulo: "Receita operacional",
    linhas: [
      { chave: "receitaCafe", rotulo: "Café" },
      { chave: "receitaMaracuja", rotulo: "Maracujá" },
      { chave: "receitaMilho", rotulo: "Milho" },
      { chave: "receitaPecuaria", rotulo: "Pecuária" },
      { chave: "outrasReceitas", rotulo: "Outras (diversas/financeiras)" },
    ],
    total: { chave: "totalReceita", rotulo: "Total receita" },
  },
  {
    rotulo: "Custeio",
    linhas: [
      { chave: "custeioCafe", rotulo: "Café" },
      { chave: "custeioMaracuja", rotulo: "Maracujá" },
      { chave: "custeioMilho", rotulo: "Milho" },
      { chave: "custeioPecuaria", rotulo: "Pecuária" },
      { chave: "custeioGeral", rotulo: "Geral (não alocado)" },
    ],
    total: { chave: "totalCusteio", rotulo: "Total custeio" },
  },
  {
    rotulo: "Despesas operacionais",
    linhas: [
      { chave: "despesasAdministrativas", rotulo: "Administrativas" },
      { chave: "despesasFinanceiras", rotulo: "Financeiras" },
    ],
    total: { chave: "totalDespesas", rotulo: "Total despesas" },
  },
  { rotulo: "Não operacional", linhas: [{ chave: "resultadoNaoOperacional", rotulo: "Venda/baixa de imobilizado" }], total: null },
];

const hojeIso = () => hojeSP();

const pct = (v: number | null) => (v === null ? "–" : v.toLocaleString("pt-BR", { style: "percent", maximumFractionDigits: 0 }));

/** Verde quando favorável, vermelho quando desfavorável. */
/** Quanto do orçado para o ano já foi realizado; sem sentido quando os sinais diferem (ex.: lucro orçado, prejuízo real). */
const execucao = (realizado: number, anual: number) => (anual === 0 || realizado * anual < 0 ? null : realizado / anual);

const corDesvio =(d: number) => (d > 0 ? "text-folha-700" : d < 0 ? "neg" : "text-stone-400");

async function Conteudo({ searchParams }: PageProps<"/orcamento">) {
  await exigirUsuario();
  const hoje = hojeIso();
  const anoHoje = Number(hoje.slice(0, 4));
  const params = await searchParams;
  const pedido = Number(params.ano);
  const ano = Number.isInteger(pedido) && pedido >= 2015 && pedido <= anoHoje + 5 ? pedido : anoHoje;
  const pedidoAte = Number(params.ate);
  const ate = Number.isInteger(pedidoAte) && pedidoAte >= 1 && pedidoAte <= 12 ? pedidoAte : mesDeCorte(ano, hoje);

  const [partidas, itens, anosComOrcamento, contasImobilizado] = await Promise.all([
    partidasDoRazao(),
    prisma.orcamentoItem.findMany({ where: { ano } }),
    prisma.orcamentoItem.findMany({ distinct: ["ano"], select: { ano: true }, orderBy: { ano: "asc" } }),
    prisma.conta.findMany({ where: { categoria: "Ativo Imobilizado", ativa: true }, orderBy: { nome: "asc" }, select: { nome: true } }),
  ]);
  const orcado: Matriz = matrizVazia();
  for (const i of itens) if (ehLinhaOrcamento(i.linha)) orcado[i.linha][i.mes - 1] = i.valorCentavos;
  const realizado = realizadoMensal(partidas, ano);
  const anterior = realizadoMensal(partidas, ano - 1);
  const totOrc = totaisMensais(orcado);
  const totReal = totaisMensais(realizado);
  const temOrcamento = itens.length > 0;

  // Investimentos (compra de imobilizado): uma linha por conta, fora do resultado.
  const nomesImobilizado = contasImobilizado.map((c) => c.nome);
  const linhasInvestimento = nomesImobilizado.map((n) => ({ chave: chaveInvestimento(n), rotulo: n.replace(/^Imobilizado - /, "") }));
  const orcadoInv: Record<string, number[]> = Object.fromEntries(linhasInvestimento.map((l) => [l.chave, Array(12).fill(0)]));
  for (const i of itens) if (ehLinhaInvestimento(i.linha) && orcadoInv[i.linha]) orcadoInv[i.linha][i.mes - 1] = i.valorCentavos;
  const realizadoInv = realizadoInvestimentos(partidas, ano, nomesImobilizado);
  const anteriorInv = realizadoInvestimentos(partidas, ano - 1, nomesImobilizado);
  const chavesInv = linhasInvestimento.map((l) => l.chave);
  const totInvOrc = somaLinhas(orcadoInv, chavesInv);
  const totInvReal = somaLinhas(realizadoInv, chavesInv);
  const linhaInv = (o: number[], r: number[]) => ({ ano: somaAte(o, 12), ...comparar(somaAte(o, ate), somaAte(r, ate)) });
  const investimentos = linhaInv(totInvOrc, totInvReal);
  const gruposEditor: GrupoEditor[] = [...GRUPOS, { rotulo: "Investimentos (imobilizado)", linhas: linhasInvestimento }];

  const linha = (chave: LinhaDre | Total) => {
    const o = chave in orcado ? orcado[chave as LinhaDre] : totOrc[chave as Total];
    const r = chave in realizado ? realizado[chave as LinhaDre] : totReal[chave as Total];
    return { ano: somaAte(o, 12), ...comparar(somaAte(o, ate), somaAte(r, ate)) };
  };
  const receita = linha("totalReceita");
  const gastosOrcAno = somaAte(totOrc.totalCusteio, 12) + somaAte(totOrc.totalDespesas, 12);
  const gastos = comparar(somaAte(totOrc.totalCusteio, ate) + somaAte(totOrc.totalDespesas, ate), somaAte(totReal.totalCusteio, ate) + somaAte(totReal.totalDespesas, ate));
  const resultado = linha("resultado");

  const anos = [...new Set([anoHoje - 1, anoHoje, anoHoje + 1, ...anosComOrcamento.map((a) => a.ano)])].sort();
  const periodo = ate === 0 ? "nenhum mês realizado ainda" : ate === 12 ? `jan–dez/${ano}` : `jan–${MESES[ate - 1].toLowerCase()}/${ano}`;

  return (
    <>
      <Cabecalho titulo="Orçamento × realizado" subtitulo={`Comparação de ${periodo}. Desvio positivo (verde) é favorável: receita acima ou gasto abaixo do orçado.`}>
        <div className="flex flex-wrap items-center gap-3">
          <Abas opcoes={anos.map((a) => ({ valor: String(a), rotulo: String(a), href: `/orcamento?ano=${a}` }))} atual={String(ano)} />
          <form className="flex items-center gap-2">
            <input type="hidden" name="ano" value={ano} />
            <select name="ate" defaultValue={ate || 1} className={`${campo} w-36`} aria-label="Comparar até">
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>
                  até {m.toLowerCase()}
                </option>
              ))}
            </select>
            <button className={botaoSecundario}>Ver</button>
          </form>
          {temOrcamento && <BotaoExportar href={`/api/exportar/orcamento?ano=${ano}&ate=${ate}`} />}
        </div>
      </Cabecalho>

      {!temOrcamento ? (
        <Cartao className="mb-6 border-amber-300 bg-amber-50/60 p-4 text-sm text-amber-900">
          Ainda não há orçamento para {ano}. Preencha abaixo — o jeito mais rápido é <strong>Preencher com o realizado de {ano - 1}</strong> e ajustar o que mudar.
        </Cartao>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Resumo rotulo="Receita" c={receita} anual={receita.ano} />
            <Resumo rotulo="Custeio + despesas" c={{ ...gastos, orcado: -gastos.orcado, realizado: -gastos.realizado }} anual={-gastosOrcAno} gasto />
            <Resumo rotulo="Resultado" c={resultado} anual={resultado.ano} />
            <Resumo
              rotulo="Investimentos"
              c={{ ...investimentos, orcado: -investimentos.orcado, realizado: -investimentos.realizado }}
              anual={-investimentos.ano}
              gasto
            />
          </div>

          <Cartao className="mb-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500">
                  <th className="sticky left-0 bg-white px-4 py-3 text-left font-medium">R$</th>
                  <th className="num px-3 py-3 font-medium">Orçado {ano}</th>
                  <th className="num px-3 py-3 font-medium">Orçado até {MESES[Math.max(ate, 1) - 1].toLowerCase()}</th>
                  <th className="num px-3 py-3 font-medium">Realizado</th>
                  <th className="num px-3 py-3 font-medium">Desvio</th>
                  <th className="num px-3 py-3 font-medium">Desvio %</th>
                  <th className="num px-3 py-3 font-medium">Executado do ano</th>
                </tr>
              </thead>
              <tbody>
                {GRUPOS.map((g) => [
                  <LinhaSecao key={g.rotulo} rotulo={g.rotulo} colunas={6} />,
                  ...g.linhas.map((l) => <LinhaComparacao key={l.chave} rotulo={l.rotulo} d={linha(l.chave)} />),
                  g.total && <LinhaComparacao key={g.total.chave} rotulo={g.total.rotulo} d={linha(g.total.chave)} estilo="total" />,
                ])}
                <LinhaComparacao rotulo="Resultado do período" d={resultado} estilo="destaque" />
                {/* Investimentos: compra de bens (viram ativo), por isso fora do resultado. */}
                <LinhaSecao rotulo="Investimentos (imobilizado)" colunas={6} />
                {linhasInvestimento.map((l) => (
                  <LinhaComparacao key={l.chave} rotulo={l.rotulo} d={linhaInv(orcadoInv[l.chave], realizadoInv[l.chave] ?? Array(12).fill(0))} />
                ))}
                <LinhaComparacao rotulo="Total investimentos" d={investimentos} estilo="total" />
              </tbody>
            </table>
          </Cartao>

          <Cartao className="mb-6 p-5">
            <details>
              <summary className="cursor-pointer font-semibold text-stone-800">Mês a mês</summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500">
                      <th className="sticky left-0 bg-white px-3 py-2 text-left font-medium">R$</th>
                      {MESES.map((m) => (
                        <th key={m} className="num px-2 py-2 font-medium">
                          {m}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        ["Receita", "totalReceita"],
                        ["Custeio", "totalCusteio"],
                        ["Despesas", "totalDespesas"],
                        ["Resultado", "resultado"],
                      ] as const
                    ).map(([rotulo, chave]) => [
                      <tr key={`${chave}-o`} className="border-t border-stone-100 text-stone-500">
                        <td className="sticky left-0 whitespace-nowrap bg-white px-3 pt-2">{rotulo} orçado</td>
                        {totOrc[chave].map((v, i) => (
                          <td key={i} className="num px-2 pt-2">
                            {reaisCurto(v)}
                          </td>
                        ))}
                      </tr>,
                      <tr key={`${chave}-r`} className="font-medium">
                        <td className="sticky left-0 whitespace-nowrap bg-white px-3 pb-2">{rotulo} realizado</td>
                        {totReal[chave].map((v, i) => (
                          <td key={i} className={`num px-2 pb-2 ${i >= ate ? "text-stone-300" : corDesvio(v - totOrc[chave][i])}`}>
                            {i >= ate && v === 0 ? "" : reaisCurto(v)}
                          </td>
                        ))}
                      </tr>,
                    ])}
                    <tr className="border-t border-stone-100 text-stone-500">
                      <td className="sticky left-0 whitespace-nowrap bg-white px-3 pt-2">Investimentos orçados</td>
                      {totInvOrc.map((v, i) => (
                        <td key={i} className="num px-2 pt-2">
                          {reaisCurto(v)}
                        </td>
                      ))}
                    </tr>
                    <tr className="font-medium">
                      <td className="sticky left-0 whitespace-nowrap bg-white px-3 pb-2">Investimentos realizados</td>
                      {totInvReal.map((v, i) => (
                        <td key={i} className={`num px-2 pb-2 ${i >= ate ? "text-stone-300" : corDesvio(v - totInvOrc[i])}`}>
                          {i >= ate && v === 0 ? "" : reaisCurto(v)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </details>
          </Cartao>
        </>
      )}

      <Cartao className="p-5">
        <details open={!temOrcamento}>
          <summary className="cursor-pointer font-semibold text-stone-800">{temOrcamento ? `Editar orçamento de ${ano}` : `Orçamento de ${ano}`}</summary>
          <div className="mt-4">
            <EditorOrcamento
              key={`${ano}-${itens.length}`}
              ano={ano}
              inicial={{ ...orcado, ...orcadoInv }}
              anoAnterior={{ ...anterior, ...anteriorInv }}
              grupos={gruposEditor}
            />
          </div>
        </details>
      </Cartao>
    </>
  );
}

function Resumo({ rotulo, c, anual, gasto = false }: { rotulo: string; c: Comparacao; anual: number; gasto?: boolean }) {
  // Nos gastos os valores chegam positivos; o desvio continua no sinal da DRE (positivo = gastou menos).
  return (
    <Cartao className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{rotulo}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">R$ {reaisCurto(c.realizado)}</p>
      <p className="text-xs text-stone-500">
        orçado R$ {reaisCurto(c.orcado)} ·{" "}
        <span className={`font-medium ${corDesvio(c.desvio)}`}>
          {c.desvio === 0 ? "no orçado" : `${c.desvio > 0 ? (gasto ? "abaixo" : "acima") : gasto ? "acima" : "abaixo"} ${pct(c.pct === null ? null : Math.abs(c.pct))}`}
        </span>
      </p>
      <p className="text-xs text-stone-400">
        {execucao(c.realizado, anual) === null ? "orçado para o ano: " : `${pct(execucao(c.realizado, anual))} do orçado para o ano, `}R$ {reaisCurto(anual)}
      </p>
    </Cartao>
  );
}

function LinhaComparacao({ rotulo, d, estilo }: { rotulo: string; d: Comparacao & { ano: number }; estilo?: "total" | "destaque" }) {
  const fundo = estilo === "destaque" ? "bg-folha-50" : "bg-white";
  const cls = estilo === "destaque" ? "bg-folha-50 font-semibold" : estilo === "total" ? "border-t border-stone-200 font-medium" : "";
  const vazio = d.ano === 0 && d.realizado === 0;
  const neg = (v: number) => (v < 0 ? "neg" : v === 0 ? "text-stone-300" : "");
  return (
    <tr className={cls}>
      <td className={`sticky left-0 px-4 py-1.5 ${estilo ? "" : "pl-7"} ${fundo}`}>{rotulo}</td>
      <td className={`num px-3 py-1.5 ${neg(d.ano)}`}>{reaisCurto(d.ano)}</td>
      <td className={`num px-3 py-1.5 ${neg(d.orcado)}`}>{reaisCurto(d.orcado)}</td>
      <td className={`num px-3 py-1.5 ${neg(d.realizado)}`}>{reaisCurto(d.realizado)}</td>
      <td className={`num px-3 py-1.5 ${vazio ? "text-stone-300" : corDesvio(d.desvio)}`}>
        {d.desvio > 0 ? "+" : ""}
        {reaisCurto(d.desvio)}
      </td>
      <td className={`num px-3 py-1.5 ${vazio ? "text-stone-300" : corDesvio(d.desvio)}`}>{pct(d.pct)}</td>
      <td className="num px-3 py-1.5 text-stone-500">{pct(execucao(d.realizado, d.ano))}</td>
    </tr>
  );
}

export default function OrcamentoPage(props: PageProps<"/orcamento">) {
  return (
    <Pagina>
      <Conteudo {...props} />
    </Pagina>
  );
}
