import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pagina } from "@/components/Pagina";
import { BotaoLinha, FormMovimento, FormTalhao } from "@/components/producao/Formularios";
import { Abas, Cabecalho, Cartao } from "@/components/ui";
import { FormNovaVenda, LinhaContrato, type ContratoTela } from "@/components/vendas/Componentes";
import { partidasDoRazao } from "@/lib/consultas";
import { prisma } from "@/lib/db";
import { dataBr, percentual, reais } from "@/lib/formato";
import { ATIVIDADES_PRODUCAO, ehSlugProducao, SINAL, type SlugProducao, type TipoMovimento } from "@/lib/producao/atividades";
import { calcularIndicadores } from "@/lib/producao/indicadores";
import { PRODUTOS } from "@/lib/cotacoes/produtos";
import { exigirUsuario } from "@/lib/usuario";
import { aEntregar, ehModalidade, resumoVendas, situacaoContrato } from "@/lib/vendas/calculo";
import { alternarTalhao, criarTalhao, excluirMovimento, registrarMovimento } from "../acoes";
import { hojeSP } from "@/lib/hoje";

export const metadata: Metadata = { title: "Produção e vendas" };

const num = (n: number, casas = 0) => n.toLocaleString("pt-BR", { maximumFractionDigits: casas });
const iso = (d: Date) => d.toISOString().slice(0, 10);

const ABAS = ["resumo", "movimentos", "vendas", "talhoes"] as const;
type Aba = (typeof ABAS)[number];
const ehAba = (v: unknown): v is Aba => typeof v === "string" && (ABAS as readonly string[]).includes(v);

/** Endereço da tela; a aba "resumo" e o ano corrente ficam fora da URL. */
function endereco(slug: string, aba: Aba, ano: number | null) {
  const q = new URLSearchParams();
  if (aba !== "resumo") q.set("aba", aba);
  if (ano !== null) q.set("ano", String(ano));
  const s = q.toString();
  return `/producao/${slug}${s ? `?${s}` : ""}`;
}

function Numero({ rotulo, valor, nota, destaque }: { rotulo: string; valor: string; nota?: React.ReactNode; destaque?: "bom" | "ruim" }) {
  return (
    <Cartao className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{rotulo}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${valor === "—" ? "text-stone-300" : destaque === "ruim" ? "neg" : destaque === "bom" ? "text-folha-700" : ""}`}>
        {valor}
      </p>
      {nota && <p className="mt-0.5 text-xs text-stone-500">{nota}</p>}
    </Cartao>
  );
}

async function Conteudo({ params, searchParams }: PageProps<"/producao/[atividade]">) {
  await exigirUsuario();
  const { atividade } = await params;
  if (!ehSlugProducao(atividade)) notFound();
  const slug: SlugProducao = atividade;
  const def = ATIVIDADES_PRODUCAO[slug];
  const busca = await searchParams;
  const aba: Aba = ehAba(busca.aba) ? busca.aba : "resumo";

  const hoje = hojeSP();
  const anoAtual = Number(hoje.slice(0, 4));
  const anoParam = Number(busca.ano);
  const ano = Number.isInteger(anoParam) && anoParam >= 2014 && anoParam <= anoAtual ? anoParam : anoAtual;
  const anoUrl = ano === anoAtual ? null : ano;

  const [talhoes, movimentos, partidas, cotacao, vendas, contas, aReceber, recebidoAno] = await Promise.all([
    prisma.talhao.findMany({ where: { atividade: def.chave }, orderBy: [{ ativo: "desc" }, { nome: "asc" }] }),
    prisma.movimentoProducao.findMany({ where: { atividade: def.chave }, orderBy: [{ data: "desc" }, { criadoEm: "desc" }], include: { talhao: { select: { nome: true } } } }),
    partidasDoRazao(),
    def.cotacao ? prisma.cotacao.findFirst({ where: { produto: def.cotacao }, orderBy: { data: "desc" } }) : null,
    prisma.venda.findMany({
      where: { atividade: def.chave },
      orderBy: [{ dataContrato: "desc" }, { criadoEm: "desc" }],
      include: { entregas: { orderBy: { data: "asc" }, select: { id: true, data: true, quantidade: true, valorCentavos: true, titulo: { select: { status: true } } } } },
    }),
    prisma.conta.findMany({ where: { categoria: "Receita", ativa: true }, select: { id: true, nome: true, atividade: true }, orderBy: { nome: "asc" } }),
    prisma.titulo.aggregate({ where: { status: "ABERTO", venda: { atividade: def.chave } }, _sum: { valorCentavos: true } }),
    prisma.titulo.aggregate({
      where: { status: "BAIXADO", venda: { atividade: def.chave }, baixadoEm: { gte: new Date(`${ano}-01-01`), lte: new Date(`${ano}-12-31`) } },
      _sum: { valorBaixaCentavos: true },
    }),
  ]);

  // ---- Produção (quantidades, custo, cotação) ----
  const doAnoContabil = partidas.filter((p) => p.data.startsWith(String(ano)) && p.atividade === def.atividadeContabil);
  const custeioDireto = doAnoContabil.filter((p) => p.categoria === "Custeio").reduce((s, p) => s + p.valorCentavos, 0);
  const receita = -doAnoContabil.filter((p) => p.categoria === "Receita").reduce((s, p) => s + p.valorCentavos, 0);
  const areaHa = talhoes.filter((t) => t.ativo).reduce((s, t) => s + t.areaHa, 0);
  const cotacaoCentavos = cotacao ? Math.round(cotacao.valor * 100) : null;
  const movs = movimentos.map((m) => ({ data: iso(m.data), tipo: m.tipo as TipoMovimento, quantidade: m.quantidade, valorCentavos: m.valorCentavos }));

  const ind = calcularIndicadores({
    ano,
    ate: ano === anoAtual ? hoje : `${ano}-12-31`,
    producao: def.producao,
    areaHa,
    movimentos: movs,
    custeioDiretoCentavos: custeioDireto,
    receitaCentavos: receita,
    cotacaoCentavos,
  });

  const movimentosDoAno = movimentos.filter((m) => m.data.getUTCFullYear() === ano);
  // Pecuária: compras de animais no ano (quantidade e valor total registrados no movimento).
  const compras = movimentosDoAno.filter((m) => m.tipo === "COMPRA");
  const cabecasCompradas = compras.reduce((s, m) => s + m.quantidade, 0);
  const valorCompras = compras.reduce((s, m) => s + (m.valorCentavos ?? 0), 0);

  // ---- Vendas (contratos, entregas, a receber) ----
  // Contas de receita da atividade primeiro, depois as gerais.
  const contasReceita = [...contas.filter((c) => c.atividade === def.atividadeContabil), ...contas.filter((c) => c.atividade !== def.atividadeContabil)];
  const contratos: ContratoTela[] = vendas.map((v) => {
    const entregue = v.entregas.reduce((s, e) => s + e.quantidade, 0);
    const base = { quantidade: v.quantidade, cancelada: v.cancelada, entregue };
    return {
      id: v.id,
      comprador: v.comprador,
      dataContrato: iso(v.dataContrato),
      quantidade: v.quantidade,
      precoUnitarioCentavos: v.precoUnitarioCentavos,
      modalidade: ehModalidade(v.modalidade) ? v.modalidade : "PRONTA",
      entregaPrevista: v.entregaPrevista ? iso(v.entregaPrevista) : null,
      pagamentoPrevisto: v.pagamentoPrevisto ? iso(v.pagamentoPrevisto) : null,
      observacao: v.observacao,
      situacao: situacaoContrato(base),
      entregue,
      falta: aEntregar(base),
      entregas: v.entregas.map((e) => ({
        id: e.id,
        data: iso(e.data),
        quantidade: e.quantidade,
        valorCentavos: e.valorCentavos,
        titulo: (e.titulo?.status as "ABERTO" | "BAIXADO" | undefined) ?? null,
      })),
    };
  });
  const rv = resumoVendas(
    contratos.map((c) => ({ dataContrato: c.dataContrato, quantidade: c.quantidade, precoUnitarioCentavos: c.precoUnitarioCentavos, cancelada: c.situacao === "CANCELADA", entregue: c.entregue })),
    movs,
    ano,
  );
  // Preço médio: o dos contratos fixados no ano; sem contratos, o das entregas/receita contábil.
  const precoMedio = rv.precoMedioAno ?? ind.precoMedioRealizado;
  const vsCotacao = precoMedio !== null && cotacaoCentavos ? (precoMedio - cotacaoCentavos) / cotacaoCentavos : null;
  const abertos = contratos.filter((c) => c.situacao === "ABERTA");
  const encerrados = contratos.filter((c) => c.situacao !== "ABERTA");

  const rotuloTipo = (t: string) => (t === "VENDA" ? "Entrega de venda" : (def.tipos.find((x) => x.tipo === t)?.rotulo ?? t));
  const u = def.unidadeCurta;
  const reaisPorUnidade = (c: number | null) => (c === null ? "—" : `R$ ${reais(c)}`);
  const anos = Array.from({ length: 4 }, (_, i) => anoAtual - 3 + i);
  const pecuaria = slug === "pecuaria";
  const rotuloTalhoes = pecuaria ? "Pastos" : "Talhões";

  return (
    <>
      <Cabecalho
        titulo={`Produção e vendas — ${def.nome}`}
        subtitulo={`Quantidades em ${def.unidade}. Custos e receitas vêm da contabilidade da atividade; cada entrega de venda dá saída no estoque e gera a conta a receber.`}
      >
        <Abas atual={slug} opcoes={Object.entries(ATIVIDADES_PRODUCAO).map(([s, d]) => ({ valor: s, rotulo: d.nome, href: endereco(s, aba, anoUrl) }))} />
      </Cabecalho>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Abas
          atual={aba}
          opcoes={[
            { valor: "resumo", rotulo: "Resumo", href: endereco(slug, "resumo", anoUrl) },
            { valor: "movimentos", rotulo: "Movimentos", href: endereco(slug, "movimentos", anoUrl) },
            { valor: "vendas", rotulo: abertos.length ? `Vendas (${abertos.length} em aberto)` : "Vendas", href: endereco(slug, "vendas", null) },
            { valor: "talhoes", rotulo: rotuloTalhoes, href: endereco(slug, "talhoes", null) },
          ]}
        />
        {(aba === "resumo" || aba === "movimentos") && (
          <Abas atual={String(ano)} opcoes={anos.map((a) => ({ valor: String(a), rotulo: String(a), href: endereco(slug, aba, a === anoAtual ? null : a) }))} />
        )}
      </div>

      {aba === "resumo" && (
        <>
          {talhoes.length === 0 && movimentos.length === 0 && (
            <div className="mb-4 max-w-3xl rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              ⚠ <strong>Dados pendentes:</strong> cadastre {pecuaria ? "os pastos (área)" : "os talhões (área)"} na aba{" "}
              <Link href={endereco(slug, "talhoes", null)} className="underline">
                {rotuloTalhoes}
              </Link>{" "}
              e registre em{" "}
              <Link href={endereco(slug, "movimentos", null)} className="underline">
                Movimentos
              </Link>{" "}
              {pecuaria ? "a contagem do rebanho (use “Ajuste de contagem”), as compras e os nascimentos" : "as colheitas"}. Sem isso não há produtividade nem custo por{" "}
              {pecuaria ? "cabeça" : "unidade"}.
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Numero rotulo={def.rotuloArea} valor={areaHa ? `${num(areaHa, 2)} ha` : "—"} nota={`${talhoes.filter((t) => t.ativo).length} ${pecuaria ? "pasto(s)" : "talhão(ões)"} ativo(s)`} />
            {pecuaria ? (
              <Numero
                rotulo={`Aquisição ${ano}`}
                valor={valorCompras ? `R$ ${reais(valorCompras)}` : "—"}
                nota={cabecasCompradas ? `${num(cabecasCompradas, 0)} ${u} compradas` : "nenhuma compra registrada"}
              />
            ) : (
              <Numero
                rotulo={`Colheita ${ano}`}
                valor={ind.producaoAno ? `${num(ind.producaoAno, 1)} ${u}` : "—"}
                nota={def.produtividade && ind.produtividade !== null ? `${num(ind.produtividade, 1)} ${def.produtividade}` : undefined}
              />
            )}
            <Numero
              rotulo={`${def.rotuloEstoque} ${ano === anoAtual ? "hoje" : `em 31/12/${ano}`}`}
              valor={ind.estoqueAtual ? `${num(ind.estoqueAtual, 1)} ${u}` : "—"}
              nota={ind.valorEstoque !== null && ind.estoqueAtual ? `≈ R$ ${reais(ind.valorEstoque)} pela cotação` : undefined}
            />
            <Numero
              rotulo="Vendido a entregar"
              valor={rv.comprometido ? `${num(rv.comprometido, 3)} ${u}` : "—"}
              nota={`${abertos.length} contrato${abertos.length === 1 ? "" : "s"} em aberto${ano === anoAtual ? "" : " (hoje)"}`}
            />
            <Numero
              rotulo="Livre para vender"
              valor={rv.livre || rv.estoque ? `${num(rv.livre, 3)} ${u}` : "—"}
              destaque={rv.livre < 0 ? "ruim" : undefined}
              nota={
                rv.livre < 0
                  ? "vendido além do estoque (venda antecipada da próxima colheita)"
                  : cotacaoCentavos && rv.livre > 0
                    ? `≈ R$ ${reais(Math.round(rv.livre * cotacaoCentavos))} pela cotação${ano === anoAtual ? "" : " (hoje)"}`
                    : "estoque de hoje − vendido a entregar"
              }
            />
            <Numero
              rotulo={`Vendido em ${ano}`}
              valor={rv.vendidoAno || ind.vendidoAno ? `${num(Math.max(rv.vendidoAno, ind.vendidoAno), 3)} ${u}` : "—"}
              nota={
                <>
                  {precoMedio !== null ? `preço médio R$ ${reais(precoMedio)}/${u}` : "sem preço fixado"}
                  {vsCotacao !== null && (
                    <span className={vsCotacao >= 0 ? "text-folha-700" : "text-red-700"}>
                      {" "}
                      ({vsCotacao >= 0 ? "+" : ""}
                      {percentual(vsCotacao, 1)} vs cotação)
                    </span>
                  )}
                  {rv.aFixarAno > 0 && (
                    <span className="block text-amber-800">
                      {num(rv.aFixarAno, 3)} {u} a fixar
                    </span>
                  )}
                  <span className="block">receita contábil R$ {reais(receita)}</span>
                </>
              }
            />
            {pecuaria ? (
              <Numero
                rotulo="Custo de aquisição por cabeça"
                valor={cabecasCompradas && valorCompras ? `R$ ${reais(Math.round(valorCompras / cabecasCompradas))}` : "—"}
                nota={`custeio da pecuária em ${ano}: R$ ${reais(custeioDireto)} (sal, ração, tratos — fora da compra)`}
              />
            ) : (
              <Numero
                rotulo={`Custo direto por ${u}`}
                valor={reaisPorUnidade(ind.custoPorUnidade)}
                nota={`custeio de ${def.nome.toLowerCase()} em ${ano}: R$ ${reais(custeioDireto)} (sem custos gerais)`}
              />
            )}
            {def.cotacao && (
              <Numero
                rotulo="Cotação de referência"
                valor={cotacaoCentavos !== null ? `R$ ${reais(cotacaoCentavos)}` : "—"}
                nota={
                  <>
                    {cotacao ? `${PRODUTOS[def.cotacao].fonte} · ${dataBr(cotacao.data)}` : "sem cotação registrada"}
                    {!pecuaria && ind.margemPorUnidade !== null && (
                      <span className={`block ${ind.margemPorUnidade >= 0 ? "text-folha-700" : "text-red-700"}`}>
                        margem R$ {reais(ind.margemPorUnidade)}/{u} sobre o custo direto
                      </span>
                    )}
                  </>
                }
              />
            )}
            <Numero
              rotulo="A receber das vendas"
              valor={aReceber._sum.valorCentavos ? `R$ ${reais(aReceber._sum.valorCentavos)}` : "—"}
              nota={`recebido em ${ano}: R$ ${reais(recebidoAno._sum.valorBaixaCentavos ?? 0)}`}
            />
          </div>
        </>
      )}

      {aba === "movimentos" && (
        <>
          <Cartao className="mb-6 max-w-3xl p-5">
            <h2 className="mb-1 font-semibold text-stone-800">Registrar movimento</h2>
            <p className="mb-3 text-xs text-stone-500">
              Vendas não entram aqui: registre na aba{" "}
              <Link href={endereco(slug, "vendas", null)} className="text-folha-700 hover:underline">
                Vendas
              </Link>
              , que dá a saída do estoque e cria a conta a receber.
            </p>
            <FormMovimento
              acao={registrarMovimento.bind(null, slug)}
              tipos={def.tipos}
              talhoes={talhoes.filter((t) => t.ativo).map(({ id, nome }) => ({ id, nome }))}
              unidade={u}
              comTalhao={!pecuaria}
            />
          </Cartao>

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
                    {!pecuaria && <th className="py-2 pl-4 text-left font-medium">Talhão</th>}
                    <th className="py-2 text-right font-medium">Valor total</th>
                    <th className="py-2 text-right font-medium">Unitário</th>
                    <th className="py-2 pl-4 text-left font-medium">Observação</th>
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
                        {!pecuaria && <td className="py-1.5 pl-4 text-stone-600">{m.talhao?.nome ?? "—"}</td>}
                        <td className="num py-1.5">{m.valorCentavos ? reais(m.valorCentavos) : ""}</td>
                        <td className="num py-1.5 text-stone-500">{m.valorCentavos && m.quantidade ? reais(Math.round(m.valorCentavos / Math.abs(m.quantidade))) : ""}</td>
                        <td className="max-w-xs truncate py-1.5 pl-4 text-stone-600" title={m.observacao ?? ""}>
                          {m.observacao}
                        </td>
                        <td className="py-1.5 text-right">
                          {m.vendaId || m.tipo === "VENDA" ? (
                            // Entrega de venda: corrige-se na aba Vendas (desfazer a entrega também cuida da conta a receber).
                            <Link href={endereco(slug, "vendas", null)} className="text-xs text-folha-700 hover:underline">
                              via Vendas
                            </Link>
                          ) : (
                            <BotaoLinha perigo acao={excluirMovimento.bind(null, slug, m.id)} confirmacao="Excluir este movimento?">
                              excluir
                            </BotaoLinha>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Cartao>
        </>
      )}

      {aba === "vendas" && (
        <>
          <Cartao className="mb-6 p-5">
            <h2 className="mb-1 font-semibold text-stone-800">Nova venda de {def.nome.toLowerCase()}</h2>
            <p className="mb-3 text-xs text-stone-500">
              À vista, para entrega futura ou com preço a fixar. Disponível: {num(rv.estoque, 3)} {u} em estoque, {num(rv.livre, 3)} {u} livres para vender.
              {cotacao && def.cotacao && (
                <>
                  {" "}
                  Cotação: R$ {reais(Math.round(cotacao.valor * 100))} {PRODUTOS[def.cotacao].unidade} em {dataBr(cotacao.data)} ({PRODUTOS[def.cotacao].fonte}).
                </>
              )}
            </p>
            {contasReceita.length ? (
              <FormNovaVenda slug={slug} unidade={def.unidade} unidadeCurta={u} contas={contasReceita} hoje={hoje} />
            ) : (
              <p className="text-sm text-amber-800">Cadastre uma conta de receita no Plano de contas antes de registrar vendas.</p>
            )}
          </Cartao>

          <Cartao className="mb-6 p-5">
            <h2 className="mb-1 font-semibold text-stone-800">Em aberto</h2>
            {abertos.length === 0 ? (
              <p className="py-4 text-sm text-stone-500">Nenhuma venda com entrega pendente.</p>
            ) : (
              <ul>
                {abertos.map((c) => (
                  <LinhaContrato key={c.id} c={c} unidadeCurta={u} hoje={hoje} />
                ))}
              </ul>
            )}
          </Cartao>

          {encerrados.length > 0 && (
            <Cartao className="p-5">
              <details>
                <summary className="cursor-pointer font-semibold text-stone-800">Entregues e canceladas ({encerrados.length})</summary>
                <ul className="mt-2">
                  {encerrados.map((c) => (
                    <LinhaContrato key={c.id} c={c} unidadeCurta={u} hoje={hoje} />
                  ))}
                </ul>
              </details>
            </Cartao>
          )}
        </>
      )}

      {aba === "talhoes" && (
        <Cartao className="max-w-3xl p-5">
          <h2 className="mb-3 font-semibold text-stone-800">{rotuloTalhoes}</h2>
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
      )}
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
