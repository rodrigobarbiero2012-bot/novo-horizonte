import Link from "next/link";
import { Cabecalho, Cartao, Valor, botaoPrimario } from "@/components/ui";
import { balancoAnual, dreAnual } from "@/lib/contabil/relatorios";
import { anosComMovimento, partidasDoRazao } from "@/lib/consultas";
import { prisma } from "@/lib/db";
import { dataBr, percentual, reais, reaisCurto } from "@/lib/formato";
import { exigirUsuario } from "@/lib/usuario";
import { Pagina } from "@/components/Pagina";

async function Conteudo() {
  const usuario = await exigirUsuario();
  const [partidas, anos, recentes] = await Promise.all([
    partidasDoRazao(),
    anosComMovimento(),
    prisma.lancamento.findMany({
      orderBy: [{ data: "desc" }, { criadoEm: "desc" }],
      take: 8,
      include: { partidas: { select: { valorCentavos: true } }, criadoPor: { select: { nome: true } } },
    }),
  ]);
  const dre = dreAnual(partidas, anos);
  const balanco = balancoAnual(partidas, anos);
  const anoAtual = anos.at(-1)!;
  const d = dre.get(anoAtual)!;
  const b = balanco.get(anoAtual)!;
  const ultimosAnos = anos.slice(-6);
  const maiorReceita = Math.max(...ultimosAnos.map((a) => Math.max(dre.get(a)!.totalReceita, -dre.get(a)!.totalCusteio)), 1);
  const anosQueNaoFecham = anos.filter((a) => balanco.get(a)!.diferenca !== 0);

  const indicadores = [
    { rotulo: `Receita ${anoAtual}`, valor: d.totalReceita },
    { rotulo: `Custeio ${anoAtual}`, valor: d.totalCusteio },
    { rotulo: `Resultado ${anoAtual}`, valor: d.resultado, nota: `margem ${percentual(d.resultado, d.totalReceita)}` },
    { rotulo: "Dívida bancária", valor: b.emprestimos },
    { rotulo: "Bancos + aplicações", valor: b.caixaBancos + b.aplicacoes },
  ];

  return (
    <>
      <Cabecalho titulo={`Olá, ${usuario.nome.split(" ")[0]}`} subtitulo={`Situação do sítio em ${anoAtual} (parcial, até o último lançamento).`}>
        <Link href="/lancamentos/novo" className={botaoPrimario}>
          Novo lançamento
        </Link>
      </Cabecalho>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {indicadores.map((i) => (
          <Cartao key={i.rotulo} className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{i.rotulo}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              <Valor centavos={i.valor} />
            </p>
            {i.nota && <p className="text-xs text-stone-500">{i.nota}</p>}
          </Cartao>
        ))}
      </div>

      {anosQueNaoFecham.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Pendência na base histórica: o balanço não fecha em {anosQueNaoFecham.join(" e ")} (datas de lançamento em ano
          errado). <Link href="/balanco" className="underline">Ver balanço</Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao className="p-5">
          <h2 className="mb-4 font-semibold text-stone-800">Receita × custeio — últimos anos</h2>
          <div className="space-y-3">
            {ultimosAnos.map((a) => {
              const x = dre.get(a)!;
              return (
                <div key={a} className="grid grid-cols-[3rem_1fr_6rem] items-center gap-3 text-sm">
                  <span className="tabular-nums text-stone-500">{a}</span>
                  <div className="space-y-1">
                    <div className="h-2.5 rounded-full bg-folha-600" style={{ width: `${(x.totalReceita / maiorReceita) * 100}%` }} title={`Receita R$ ${reais(x.totalReceita)}`} />
                    <div className="h-2.5 rounded-full bg-terra-500" style={{ width: `${(-x.totalCusteio / maiorReceita) * 100}%` }} title={`Custeio R$ ${reais(-x.totalCusteio)}`} />
                  </div>
                  <span className={`num text-sm font-medium ${x.resultado < 0 ? "neg" : "text-folha-700"}`}>{reaisCurto(x.resultado)}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex gap-4 text-xs text-stone-500">
            <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-full bg-folha-600" />Receita</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-full bg-terra-500" />Custeio</span>
            <span>À direita: resultado do ano</span>
          </div>
        </Cartao>

        <Cartao className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-stone-800">Últimos lançamentos</h2>
            <Link href="/lancamentos" className="text-sm text-folha-700 hover:underline">Ver todos</Link>
          </div>
          <ul className="divide-y divide-stone-100 text-sm">
            {recentes.map((l) => {
              const valor = l.partidas.reduce((s, p) => s + Math.max(p.valorCentavos, 0), 0);
              return (
                <li key={l.id}>
                  <Link
                    href={`/lancamentos/${l.id}`}
                    title={l.historico ?? undefined}
                    className="flex items-start justify-between gap-3 py-2 hover:bg-folha-50/60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block tabular-nums text-stone-500">{dataBr(l.data)}</span>
                      <span className="block truncate text-stone-700">{l.historico}</span>
                    </span>
                    <span className="num shrink-0 font-medium">{reais(valor)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Cartao>
      </div>
    </>
  );
}

export default function PainelPage() {
  return (
    <Pagina>
      <Conteudo />
    </Pagina>
  );
}
