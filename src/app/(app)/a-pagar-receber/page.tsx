import type { Metadata } from "next";
import Link from "next/link";
import { Pagina } from "@/components/Pagina";
import { Indicador } from "@/components/painel/Indicador";
import { FormTitulo } from "@/components/titulos/FormTitulo";
import { ListaTitulos, type TituloBaixado, type TituloLinha } from "@/components/titulos/ListaTitulos";
import { Abas, Cabecalho, Cartao } from "@/components/ui";
import { prisma } from "@/lib/db";
import { contasAtivas } from "@/lib/consultas";
import { dataBr, reais } from "@/lib/formato";
import { contaMaisUsada } from "@/lib/documentos/sugestoes";
import { CATEGORIAS_BAIXA, categoriasDoTitulo } from "@/lib/titulos/categorias";
import { faixaDoVencimento, projecaoSemanal, type TipoTitulo } from "@/lib/titulos/regras";
import { exigirUsuario } from "@/lib/usuario";

export const metadata: Metadata = { title: "A pagar e receber" };

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Datas de referência da requisição (hoje e as janelas usadas na página). */
function referencias() {
  const agora = Date.now();
  const dia = 86_400_000;
  return {
    hoje: new Date(agora).toLocaleDateString("sv-SE"),
    em30: new Date(agora + 30 * dia).toLocaleDateString("sv-SE"),
    desde60: new Date(agora - 60 * dia),
    desde120: new Date(agora - 120 * dia),
  };
}

async function Conteudo({ searchParams }: PageProps<"/a-pagar-receber">) {
  await exigirUsuario();
  const tipo: TipoTitulo = (await searchParams).tipo === "receber" ? "RECEBER" : "PAGAR";
  const { hoje, em30, desde60, desde120 } = referencias();

  const [contas, abertos, baixados, saldoCaixa, pagamentos] = await Promise.all([
    contasAtivas(),
    prisma.titulo.findMany({ where: { status: "ABERTO" }, orderBy: [{ vencimento: "asc" }, { criadoEm: "asc" }], include: { conta: { select: { nome: true } } } }),
    prisma.titulo.findMany({
      where: { status: "BAIXADO", tipo, baixadoEm: { gte: desde60 } },
      orderBy: { baixadoEm: "desc" },
      include: { contaBaixa: { select: { nome: true } } },
    }),
    prisma.partida.aggregate({
      where: { conta: { categoria: { in: ["Ativo Caixa/Banco", "Ativo Aplicação Financeira"] } } },
      _sum: { valorCentavos: true },
    }),
    prisma.partida.findMany({
      where: { valorCentavos: { lt: 0 }, data: { gte: desde120 }, conta: { categoria: { in: CATEGORIAS_BAIXA } } },
      select: { contaId: true },
    }),
  ]);

  const contasTitulo = contas.filter((c) => categoriasDoTitulo(tipo).includes(c.categoria));
  const contasBaixa = contas.filter((c) => CATEGORIAS_BAIXA.includes(c.categoria)).map(({ id, nome }) => ({ id, nome }));
  const contaBaixaPadrao = contaMaisUsada(pagamentos)?.contaId ?? null;

  const doTipo = abertos.filter((t) => t.tipo === tipo);
  const linhas: TituloLinha[] = doTipo.map((t) => ({
    id: t.id,
    descricao: t.descricao,
    contraparte: t.contraparte,
    valorCentavos: t.valorCentavos,
    vencimento: iso(t.vencimento),
    conta: t.conta.nome,
    parcela: t.parcela ? `${t.parcela}/${t.totalParcelas}` : null,
    faixa: faixaDoVencimento(iso(t.vencimento), hoje),
  }));
  const linhasBaixadas: TituloBaixado[] = baixados.map((b) => ({
    id: b.id,
    descricao: b.descricao,
    contraparte: b.contraparte,
    valorBaixaCentavos: b.valorBaixaCentavos ?? b.valorCentavos,
    baixadoEm: iso(b.baixadoEm!),
    contaBaixa: b.contaBaixa?.nome ?? "—",
    lancamentoId: b.lancamentoId,
  }));

  // Resumo e projeção usam os dois tipos.
  const comFaixa = abertos.map((t) => ({ tipo: t.tipo as TipoTitulo, valorCentavos: t.valorCentavos, vencimento: iso(t.vencimento) }));
  const soma = (f: (t: (typeof comFaixa)[number]) => boolean) => comFaixa.filter(f).reduce((s, t) => s + t.valorCentavos, 0);
  const vencidoPagar = soma((t) => t.tipo === "PAGAR" && t.vencimento < hoje);
  const pagar30 = soma((t) => t.tipo === "PAGAR" && t.vencimento >= hoje && t.vencimento <= em30);
  const receber30 = soma((t) => t.tipo === "RECEBER" && t.vencimento >= hoje && t.vencimento <= em30);
  const saldoInicial = saldoCaixa._sum.valorCentavos ?? 0;
  const projecao = projecaoSemanal(comFaixa, saldoInicial, hoje, 12);
  const menorSaldo = Math.min(...projecao.map((s) => s.saldoFinal));

  return (
    <>
      <Cabecalho titulo="A pagar e receber" subtitulo="Títulos em aberto por vencimento. A baixa gera o lançamento automaticamente.">
        <Abas
          atual={tipo}
          opcoes={[
            { valor: "PAGAR", rotulo: "A pagar", href: "/a-pagar-receber" },
            { valor: "RECEBER", rotulo: "A receber", href: "/a-pagar-receber?tipo=receber" },
          ]}
        />
      </Cabecalho>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador rotulo="Vencido a pagar" centavos={vencidoPagar} comparacao={vencidoPagar ? "⚠ pagar ou atualizar a data" : "nada vencido"} />
        <Indicador rotulo="A pagar em 30 dias" centavos={pagar30} />
        <Indicador rotulo="A receber em 30 dias" centavos={receber30} />
        <Indicador
          rotulo="Menor saldo projetado (12 sem.)"
          centavos={menorSaldo}
          comparacao={menorSaldo < 0 ? "negativo: aporte dos sócios necessário" : "bancos + aplicações"}
        />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Cartao className="p-5">
          <h2 className="mb-3 font-semibold text-stone-800">{tipo === "PAGAR" ? "Contas a pagar" : "Contas a receber"}</h2>
          <ListaTitulos tipo={tipo} abertos={linhas} baixados={linhasBaixadas} contasBaixa={contasBaixa} contaBaixaPadrao={contaBaixaPadrao} hoje={hoje} />
        </Cartao>
        <Cartao className="h-fit p-5">
          <h2 className="mb-3 font-semibold text-stone-800">{tipo === "PAGAR" ? "Nova conta a pagar" : "Nova conta a receber"}</h2>
          <FormTitulo key={tipo} tipo={tipo} contas={contasTitulo} />
          <p className="mt-3 text-xs text-stone-500">
            Boletos e notas também podem entrar por{" "}
            <Link href="/lancamentos/ler" className="text-folha-700 hover:underline">
              Ler boleto ou nota
            </Link>
            .
          </p>
        </Cartao>
      </div>

      <Cartao className="overflow-x-auto p-5">
        <h2 className="mb-1 font-semibold text-stone-800">Caixa projetado — próximas 12 semanas</h2>
        <p className="mb-3 text-xs text-stone-500">
          Começa no saldo de bancos + aplicações hoje (R$ {reais(saldoInicial)}) e soma o que está a receber e a pagar. Títulos vencidos entram na
          primeira semana. Saldo negativo é o quanto os sócios precisariam aportar.
        </p>
        <table className="w-full min-w-[32rem] text-sm">
          <thead className="text-xs text-stone-500">
            <tr className="border-b border-stone-200">
              <th className="py-2 text-left font-medium">Semana</th>
              <th className="py-2 text-right font-medium">Entradas</th>
              <th className="py-2 text-right font-medium">Saídas</th>
              <th className="py-2 text-right font-medium">Saldo no fim da semana</th>
            </tr>
          </thead>
          <tbody>
            {projecao.map((s) => (
              <tr key={s.inicio} className="border-t border-stone-100">
                <td className="py-1.5 tabular-nums text-stone-600">
                  {dataBr(s.inicio).slice(0, 5)} a {dataBr(s.fim).slice(0, 5)}
                </td>
                <td className={`num py-1.5 ${s.entradas ? "" : "text-stone-300"}`}>{reais(s.entradas)}</td>
                <td className={`num py-1.5 ${s.saidas ? "" : "text-stone-300"}`}>{reais(s.saidas)}</td>
                <td className={`num py-1.5 font-medium ${s.saldoFinal < 0 ? "neg" : ""}`}>{reais(s.saldoFinal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Cartao>
    </>
  );
}

export default function APagarReceberPage(props: PageProps<"/a-pagar-receber">) {
  return (
    <Pagina>
      <Conteudo {...props} />
    </Pagina>
  );
}
