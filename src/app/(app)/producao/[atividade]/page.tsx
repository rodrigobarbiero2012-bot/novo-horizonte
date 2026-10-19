import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pagina } from "@/components/Pagina";
import { BotaoLinha, FormMovimento, FormTalhao } from "@/components/producao/Formularios";
import { Abas, Cabecalho, Cartao } from "@/components/ui";
import { partidasDoRazao } from "@/lib/consultas";
import { prisma } from "@/lib/db";
import { dataBr, reais } from "@/lib/formato";
import { ATIVIDADES_PRODUCAO, ehSlugProducao, SINAL, type TipoMovimento } from "@/lib/producao/atividades";
import { calcularIndicadores } from "@/lib/producao/indicadores";
import { PRODUTOS } from "@/lib/cotacoes/produtos";
import { exigirUsuario } from "@/lib/usuario";
import { alternarTalhao, criarTalhao, excluirMovimento, registrarMovimento } from "../acoes";
import { hojeSP } from "@/lib/hoje";

export const metadata: Metadata = { title: "Produção" };

const num = (n: number, casas = 0) => n.toLocaleString("pt-BR", { maximumFractionDigits: casas });

function Numero({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <Cartao className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{rotulo}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${valor === "—" ? "text-stone-300" : ""}`}>{valor}</p>
      {nota && <p className="mt-0.5 text-xs text-stone-500">{nota}</p>}
    </Cartao>
  );
}

async function Conteudo({ params, searchParams }: PageProps<"/producao/[atividade]">) {
  await exigirUsuario();
  const { atividade: slug } = await params;
  if (!ehSlugProducao(slug)) notFound();
  const def = ATIVIDADES_PRODUCAO[slug];

  const hoje = hojeSP();
  const anoAtual = Number(hoje.slice(0, 4));
  const anoParam = Number((await searchParams).ano);
  const ano = Number.isInteger(anoParam) && anoParam >= 2014 && anoParam <= anoAtual ? anoParam : anoAtual;

  const [talhoes, movimentos, partidas, cotacao] = await Promise.all([
    prisma.talhao.findMany({ where: { atividade: def.chave }, orderBy: [{ ativo: "desc" }, { nome: "asc" }] }),
    prisma.movimentoProducao.findMany({ where: { atividade: def.chave }, orderBy: [{ data: "desc" }, { criadoEm: "desc" }], include: { talhao: { select: { nome: true } } } }),
    partidasDoRazao(),
    def.cotacao ? prisma.cotacao.findFirst({ where: { produto: def.cotacao }, orderBy: { data: "desc" } }) : null,
  ]);

  const doAnoContabil = partidas.filter((p) => p.data.startsWith(String(ano)) && p.atividade === def.atividadeContabil);
  const custeioDireto = doAnoContabil.filter((p) => p.categoria === "Custeio").reduce((s, p) => s + p.valorCentavos, 0);
  const receita = -doAnoContabil.filter((p) => p.categoria === "Receita").reduce((s, p) => s + p.valorCentavos, 0);
  const areaHa = talhoes.filter((t) => t.ativo).reduce((s, t) => s + t.areaHa, 0);
  const cotacaoCentavos = cotacao ? Math.round(cotacao.valor * 100) : null;

  const ind = calcularIndicadores({
    ano,
    ate: ano === anoAtual ? hoje : `${ano}-12-31`,
    producao: def.producao,
    areaHa,
    movimentos: movimentos.map((m) => ({ data: m.data.toISOString().slice(0, 10), tipo: m.tipo as TipoMovimento, quantidade: m.quantidade, valorCentavos: m.valorCentavos })),
    custeioDiretoCentavos: custeioDireto,
    receitaCentavos: receita,
    cotacaoCentavos,
  });

  const movimentosDoAno = movimentos.filter((m) => m.data.getUTCFullYear() === ano);
  const rotuloTipo = (t: string) => def.tipos.find((x) => x.tipo === t)?.rotulo ?? t;
  const u = def.unidadeCurta;
  const reaisPorUnidade = (c: number | null) => (c === null ? "—" : `R$ ${reais(c)}`);
  const anos = Array.from({ length: 4 }, (_, i) => anoAtual - 3 + i);
  const pecuaria = slug === "pecuaria";

  return (
    <>
      <Cabecalho titulo={`Produção — ${def.nome}`} subtitulo={`Quantidades em ${def.unidade}. Custos e receitas vêm da contabilidade da atividade.`}>
        <div className="flex flex-wrap items-center gap-2">
          <Abas atual={slug} opcoes={Object.entries(ATIVIDADES_PRODUCAO).map(([s, d]) => ({ valor: s, rotulo: d.nome, href: `/producao/${s}` }))} />
          <Abas atual={String(ano)} opcoes={anos.map((a) => ({ valor: String(a), rotulo: String(a), href: `/producao/${slug}${a === anoAtual ? "" : `?ano=${a}`}` }))} />
        </div>
      </Cabecalho>

      {talhoes.length === 0 && movimentos.length === 0 && (
        <div className="mb-4 max-w-3xl rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ⚠ <strong>Dados pendentes:</strong> cadastre {pecuaria ? "os pastos (área)" : "os talhões (área)"} e registre{" "}
          {pecuaria ? "a contagem do rebanho (use “Ajuste de contagem”) e as compras, vendas e nascimentos" : "as colheitas e vendas"}. Sem isso não há
          produtividade nem custo por {pecuaria ? "cabeça" : "unidade"}.
        </div>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Numero rotulo={def.rotuloArea} valor={areaHa ? `${num(areaHa, 2)} ha` : "—"} nota={`${talhoes.filter((t) => t.ativo).length} ${pecuaria ? "pasto(s)" : "talhão(ões)"} ativo(s)`} />
        <Numero
          rotulo={pecuaria ? `Nascimentos ${ano}` : `Produção ${ano}`}
          valor={ind.producaoAno ? `${num(ind.producaoAno, 1)} ${u}` : "—"}
          nota={def.produtividade && ind.produtividade !== null ? `${num(ind.produtividade, 1)} ${def.produtividade}` : undefined}
        />
        <Numero
          rotulo={`${def.rotuloEstoque} ${ano === anoAtual ? "hoje" : `em 31/12/${ano}`}`}
          valor={ind.estoqueAtual ? `${num(ind.estoqueAtual, 1)} ${u}` : "—"}
          nota={ind.valorEstoque !== null && ind.estoqueAtual ? `≈ R$ ${reais(ind.valorEstoque)} pela cotação` : undefined}
        />
        <Numero rotulo={`Vendido ${ano}`} valor={ind.vendidoAno ? `${num(ind.vendidoAno, 1)} ${u}` : "—"} nota={`receita contábil R$ ${reais(receita)}`} />
        <Numero
          rotulo={`Custo direto por ${pecuaria ? "nascimento" : u}`}
          valor={reaisPorUnidade(ind.custoPorUnidade)}
          nota={`custeio de ${def.nome.toLowerCase()} em ${ano}: R$ ${reais(custeioDireto)} (sem custos gerais)`}
        />
        <Numero rotulo={`Preço médio realizado`} valor={reaisPorUnidade(ind.precoMedioRealizado)} nota="pelos valores das vendas registradas (ou receita contábil ÷ quantidade)" />
        {def.cotacao && (
          <Numero
            rotulo="Cotação de referência"
            valor={cotacaoCentavos !== null ? `R$ ${reais(cotacaoCentavos)}` : "—"}
            nota={cotacao ? `${PRODUTOS[def.cotacao].fonte} · ${dataBr(cotacao.data)}` : "sem cotação registrada"}
          />
        )}
        {def.cotacao && (
          <Numero
            rotulo={`Margem por ${u} na cotação`}
            valor={reaisPorUnidade(ind.margemPorUnidade)}
            nota={ind.margemPorUnidade !== null ? "cotação − custo direto por unidade" : "precisa de produção e cotação"}
          />
        )}
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Cartao className="p-5">
          <h2 className="mb-3 font-semibold text-stone-800">Registrar movimento</h2>
          <FormMovimento acao={registrarMovimento.bind(null, slug)} tipos={def.tipos} talhoes={talhoes.filter((t) => t.ativo).map(({ id, nome }) => ({ id, nome }))} unidade={u} />
        </Cartao>
        <Cartao className="p-5">
          <h2 className="mb-3 font-semibold text-stone-800">{pecuaria ? "Pastos" : "Talhões"}</h2>
          {talhoes.length > 0 && (
            <table className="mb-4 w-full text-sm">
              <thead className="text-xs text-stone-500">
                <tr>
                  <th className="pb-1 text-left font-medium">Nome</th>
                  <th className="pb-1 text-right font-medium">Área (ha)</th>
                  <th className="pb-1 text-left font-medium">Variedade</th>
                  <th className="pb-1 text-right font-medium">Plantio</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {talhoes.map((t) => (
                  <tr key={t.id} className={`border-t border-stone-100 ${t.ativo ? "" : "text-stone-400"}`}>
                    <td className="py-1.5">{t.nome}</td>
                    <td className="num py-1.5">{num(t.areaHa, 2)}</td>
                    <td className="py-1.5">{t.variedade ?? "—"}</td>
                    <td className="num py-1.5">{t.anoPlantio ?? "—"}</td>
                    <td className="py-1.5 text-right">
                      <BotaoLinha acao={alternarTalhao.bind(null, slug, t.id)}>{t.ativo ? "desativar" : "reativar"}</BotaoLinha>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <FormTalhao acao={criarTalhao.bind(null, slug)} rotuloArea={def.rotuloArea} />
        </Cartao>
      </div>

      <Cartao className="overflow-x-auto p-5">
        <h2 className="mb-3 font-semibold text-stone-800">Movimentos de {ano}</h2>
        {movimentosDoAno.length === 0 ? (
          <p className="py-4 text-sm text-stone-500">Nenhum movimento registrado em {ano}.</p>
        ) : (
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="text-xs text-stone-500">
              <tr className="border-b border-stone-200">
                <th className="py-2 text-left font-medium">Data</th>
                <th className="py-2 text-left font-medium">Tipo</th>
                <th className="py-2 text-right font-medium">Quantidade ({u})</th>
                <th className="py-2 text-left font-medium">Talhão</th>
                <th className="py-2 text-right font-medium">Valor</th>
                <th className="py-2 text-left font-medium">Observação</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {movimentosDoAno.map((m) => {
                const sinal = m.tipo === "AJUSTE" ? Math.sign(m.quantidade) : SINAL[m.tipo as TipoMovimento];
                return (
                  <tr key={m.id} className="border-t border-stone-100">
                    <td className="py-1.5 tabular-nums">{dataBr(m.data)}</td>
                    <td className="py-1.5">{rotuloTipo(m.tipo)}</td>
                    <td className={`num py-1.5 ${sinal < 0 ? "neg" : ""}`}>
                      {sinal < 0 ? "−" : "+"}
                      {num(Math.abs(m.quantidade), 2)}
                    </td>
                    <td className="py-1.5 text-stone-600">{m.talhao?.nome ?? "—"}</td>
                    <td className="num py-1.5">{m.valorCentavos ? reais(m.valorCentavos) : ""}</td>
                    <td className="max-w-xs truncate py-1.5 text-stone-600" title={m.observacao ?? ""}>
                      {m.observacao}
                    </td>
                    <td className="py-1.5 text-right">
                      <BotaoLinha perigo acao={excluirMovimento.bind(null, slug, m.id)} confirmacao="Excluir este movimento?">
                        excluir
                      </BotaoLinha>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Cartao>
    </>
  );
}

export default function ProducaoPage(props: PageProps<"/producao/[atividade]">) {
  return (
    <Pagina>
      <Conteudo {...props} />
    </Pagina>
  );
}
