import type { Metadata } from "next";
import { Pagina } from "@/components/Pagina";
import { Abas, Cabecalho, Cartao } from "@/components/ui";
import { FormNovaVenda, LinhaContrato, type ContratoTela } from "@/components/vendas/Componentes";
import { PRODUTOS } from "@/lib/cotacoes/produtos";
import { prisma } from "@/lib/db";
import { dataBr, percentual, reais } from "@/lib/formato";
import { hojeSP } from "@/lib/hoje";
import { ATIVIDADES_PRODUCAO, ehSlugProducao, type TipoMovimento } from "@/lib/producao/atividades";
import { exigirUsuario } from "@/lib/usuario";
import { aEntregar, ehModalidade, resumoVendas, situacaoContrato } from "@/lib/vendas/calculo";

export const metadata: Metadata = { title: "Vendas" };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const qtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

function Indicador({ rotulo, valor, nota, destaque }: { rotulo: string; valor: string; nota?: React.ReactNode; destaque?: "bom" | "ruim" }) {
  return (
    <Cartao className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{rotulo}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${destaque === "ruim" ? "neg" : destaque === "bom" ? "text-folha-700" : ""}`}>{valor}</p>
      {nota && <p className="text-xs text-stone-500">{nota}</p>}
    </Cartao>
  );
}

async function Conteudo({ searchParams }: PageProps<"/vendas">) {
  await exigirUsuario();
  const pedido = (await searchParams).atividade;
  const slug = typeof pedido === "string" && ehSlugProducao(pedido) ? pedido : "cafe";
  const def = ATIVIDADES_PRODUCAO[slug];
  const hoje = hojeSP();
  const ano = Number(hoje.slice(0, 4));

  const [vendas, movimentos, contas, cotacao, aReceber, recebidoAno] = await Promise.all([
    prisma.venda.findMany({
      where: { atividade: def.chave },
      orderBy: [{ dataContrato: "desc" }, { criadoEm: "desc" }],
      include: { entregas: { orderBy: { data: "asc" }, select: { id: true, data: true, quantidade: true, valorCentavos: true, titulo: { select: { status: true } } } } },
    }),
    prisma.movimentoProducao.findMany({ where: { atividade: def.chave }, select: { data: true, tipo: true, quantidade: true } }),
    prisma.conta.findMany({ where: { categoria: "Receita", ativa: true }, select: { id: true, nome: true, atividade: true }, orderBy: { nome: "asc" } }),
    def.cotacao ? prisma.cotacao.findFirst({ where: { produto: def.cotacao }, orderBy: { data: "desc" } }) : null,
    prisma.titulo.aggregate({ where: { status: "ABERTO", venda: { atividade: def.chave } }, _sum: { valorCentavos: true }, _count: true }),
    prisma.titulo.aggregate({
      where: { status: "BAIXADO", venda: { atividade: def.chave }, baixadoEm: { gte: new Date(`${ano}-01-01`), lte: new Date(`${ano}-12-31`) } },
      _sum: { valorBaixaCentavos: true },
    }),
  ]);

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
  const r = resumoVendas(
    contratos.map((c) => ({ dataContrato: c.dataContrato, quantidade: c.quantidade, precoUnitarioCentavos: c.precoUnitarioCentavos, cancelada: c.situacao === "CANCELADA", entregue: c.entregue })),
    movimentos.map((m) => ({ data: iso(m.data), tipo: m.tipo as TipoMovimento, quantidade: m.quantidade })),
    ano,
  );
  const cotacaoCentavos = cotacao ? Math.round(cotacao.valor * 100) : null;
  const vsCotacao = r.precoMedioAno !== null && cotacaoCentavos ? (r.precoMedioAno - cotacaoCentavos) / cotacaoCentavos : null;
  const abertos = contratos.filter((c) => c.situacao === "ABERTA");
  const encerrados = contratos.filter((c) => c.situacao !== "ABERTA");
  const u = def.unidadeCurta;

  return (
    <>
      <Cabecalho
        titulo="Vendas"
        subtitulo="Contratos de venda à vista, para entrega futura ou com preço a fixar. Cada entrega dá saída no estoque da produção e gera a conta a receber."
      >
        <Abas opcoes={Object.entries(ATIVIDADES_PRODUCAO).map(([s, d]) => ({ valor: s, rotulo: d.nome, href: `/vendas?atividade=${s}` }))} atual={slug} />
      </Cabecalho>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Indicador rotulo={def.rotuloEstoque} valor={`${qtd(r.estoque)} ${u}`} nota={movimentos.length ? "pelos movimentos da produção" : "sem movimentos de produção ainda"} />
        <Indicador rotulo="Vendido a entregar" valor={`${qtd(r.comprometido)} ${u}`} nota={`${abertos.length} contrato${abertos.length === 1 ? "" : "s"} em aberto`} />
        <Indicador
          rotulo="Livre para vender"
          valor={`${qtd(r.livre)} ${u}`}
          destaque={r.livre < 0 ? "ruim" : undefined}
          nota={
            r.livre < 0
              ? "vendido além do estoque (venda antecipada da próxima colheita)"
              : cotacaoCentavos && r.livre > 0
                ? `≈ R$ ${reais(Math.round(r.livre * cotacaoCentavos))} pela cotação`
                : undefined
          }
        />
        <Indicador
          rotulo={`Vendido em ${ano}`}
          valor={`${qtd(r.vendidoAno)} ${u}`}
          nota={
            <>
              {r.precoMedioAno !== null ? `preço médio R$ ${reais(r.precoMedioAno)}/${u}` : "sem preço fixado"}
              {vsCotacao !== null && (
                <span className={vsCotacao >= 0 ? "text-folha-700" : "text-red-700"}>
                  {" "}
                  ({vsCotacao >= 0 ? "+" : ""}
                  {percentual(vsCotacao, 1)} vs cotação)
                </span>
              )}
              {r.aFixarAno > 0 && <span className="block text-amber-800">{qtd(r.aFixarAno)} {u} a fixar</span>}
            </>
          }
        />
        <Indicador
          rotulo="A receber das vendas"
          valor={`R$ ${reais(aReceber._sum.valorCentavos ?? 0)}`}
          nota={`recebido em ${ano}: R$ ${reais(recebidoAno._sum.valorBaixaCentavos ?? 0)}`}
        />
      </div>
      {cotacao && def.cotacao && (
        <p className="-mt-4 mb-6 text-xs text-stone-500">
          Cotação de referência: {PRODUTOS[def.cotacao].nome} R$ {reais(Math.round(cotacao.valor * 100))} {PRODUTOS[def.cotacao].unidade} em {dataBr(cotacao.data)} ({PRODUTOS[def.cotacao].fonte}).
        </p>
      )}

      <Cartao className="mb-6 p-5">
        <h2 className="mb-3 font-semibold text-stone-800">Nova venda de {def.nome.toLowerCase()}</h2>
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
  );
}

export default function VendasPage(props: PageProps<"/vendas">) {
  return (
    <Pagina>
      <Conteudo {...props} />
    </Pagina>
  );
}
