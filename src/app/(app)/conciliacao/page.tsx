import type { Metadata } from "next";
import { LinhaPendente, LinhaTratada, UploadExtrato, type Pendente } from "@/components/conciliacao/Componentes";
import { Pagina } from "@/components/Pagina";
import { Cabecalho, Cartao, campo, botaoSecundario } from "@/components/ui";
import { candidatas } from "@/lib/conciliacao/casamento";
import { contasAtivas } from "@/lib/consultas";
import { prisma } from "@/lib/db";
import { dataBr, reais } from "@/lib/formato";
import { CATEGORIAS_BAIXA } from "@/lib/titulos/categorias";
import { exigirUsuario } from "@/lib/usuario";

export const metadata: Metadata = { title: "Conciliação bancária" };

const iso = (d: Date) => d.toISOString().slice(0, 10);

async function Conteudo({ searchParams }: PageProps<"/conciliacao">) {
  await exigirUsuario();
  const contas = await contasAtivas();
  const conciliaveis = contas.filter((c) => CATEGORIAS_BAIXA.includes(c.categoria));
  const pedida = (await searchParams).conta;
  // Sem escolha: a última conta que teve extrato importado; senão, a primeira conta bancária.
  const ultimaImportacao = await prisma.importacaoExtrato.findFirst({ orderBy: { criadoEm: "desc" }, select: { contaId: true } });
  const conta =
    conciliaveis.find((c) => c.id === pedida) ??
    conciliaveis.find((c) => c.id === ultimaImportacao?.contaId) ??
    conciliaveis.find((c) => c.categoria === "Ativo Caixa/Banco")!;
  const ehSocio = conta.categoria === "PL Capital Sócio";

  const [importacoes, pendentes, tratadas] = await Promise.all([
    prisma.importacaoExtrato.findMany({ where: { contaId: conta.id }, orderBy: { criadoEm: "desc" }, take: 5 }),
    prisma.transacaoBancaria.findMany({ where: { contaId: conta.id, status: "PENDENTE" }, orderBy: { data: "asc" } }),
    prisma.transacaoBancaria.findMany({
      where: { contaId: conta.id, status: { in: ["CONCILIADA", "IGNORADA"] } },
      orderBy: { data: "desc" },
      take: 100,
      include: { partida: { select: { lancamentoId: true } } },
    }),
  ]);

  // Candidatas: partidas da conta, ainda não conciliadas, no período das pendentes (±15 dias).
  let linhas: Pendente[] = [];
  if (pendentes.length) {
    const datas = pendentes.map((t) => t.data.getTime());
    const partidas = await prisma.partida.findMany({
      where: {
        contaId: conta.id,
        transacaoBancaria: null,
        data: { gte: new Date(Math.min(...datas) - 15 * 86_400_000), lte: new Date(Math.max(...datas) + 15 * 86_400_000) },
      },
      include: { lancamento: { select: { historico: true } } },
    });
    const simples = partidas.map((p) => ({ id: p.id, data: iso(p.data), valorCentavos: p.valorCentavos, historico: p.historico ?? p.lancamento.historico ?? "" }));
    linhas = pendentes.map((t) => {
      const base = { id: t.id, data: iso(t.data), valorCentavos: t.valorCentavos };
      return { ...base, descricao: t.descricao, candidatas: candidatas(base, simples).slice(0, 5).map(({ id, data, historico }) => ({ id, data, historico })) };
    });
  }

  // Saldo do extrato × saldo contábil (só faz sentido para conta do sítio).
  const comSaldo = importacoes.find((i) => i.saldoFinalCentavos !== null && i.dataSaldo);
  const saldoContabil = comSaldo
    ? ((await prisma.partida.aggregate({ where: { contaId: conta.id, data: { lte: comSaldo.dataSaldo! } }, _sum: { valorCentavos: true } }))._sum.valorCentavos ?? 0)
    : null;
  const diferenca = comSaldo && saldoContabil !== null ? comSaldo.saldoFinalCentavos! - saldoContabil : null;
  const conciliadas = tratadas.filter((t) => t.status === "CONCILIADA").length;

  return (
    <>
      <Cabecalho
        titulo="Conciliação bancária"
        subtitulo="Importe o extrato (OFX) e confira com os lançamentos: o que bate é conciliado sozinho; o resto você concilia, lança ou ignora."
      >
        <form className="flex items-center gap-2">
          <select name="conta" defaultValue={conta.id} className={`${campo} w-64`} aria-label="Conta">
            {conciliaveis.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          <button className={botaoSecundario}>Abrir</button>
        </form>
      </Cabecalho>

      {ehSocio && (
        <div className="mb-4 max-w-4xl rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
          Extrato da conta pessoal do sócio: as transações do sítio devem casar com a CC ACM; marque como <strong>Ignorar</strong> o que for pessoal. As que
          sobrarem são despesas do sítio pagas e ainda não lançadas.
        </div>
      )}

      <Cartao className="mb-6 p-5">
        <h2 className="mb-3 font-semibold text-stone-800">Importar extrato — {conta.nome}</h2>
        <UploadExtrato contaId={conta.id} />
        <p className="mt-2 text-xs text-stone-500">
          No internet banking: Extrato → período → exportar em <strong>OFX</strong> (às vezes aparece como “Money” ou “Quicken”). Reimportar o mesmo
          período não duplica nada.
        </p>
        {importacoes.length > 0 && (
          <ul className="mt-3 space-y-0.5 text-xs text-stone-500">
            {importacoes.map((i) => (
              <li key={i.id}>
                {dataBr(i.criadoEm)} · {i.arquivo}
                {i.inicio && i.fim && ` · ${dataBr(i.inicio)} a ${dataBr(i.fim)}`} · {i.novas} novas{i.repetidas ? `, ${i.repetidas} repetidas` : ""}
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Cartao className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Pendentes</p>
          <p className={`mt-1 text-xl font-semibold tabular-nums ${pendentes.length ? "text-amber-700" : ""}`}>{pendentes.length}</p>
        </Cartao>
        <Cartao className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Conciliadas</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{conciliadas}</p>
        </Cartao>
        <Cartao className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Extrato × contabilidade</p>
          {!ehSocio && comSaldo && diferenca !== null ? (
            <>
              <p className={`mt-1 text-xl font-semibold tabular-nums ${diferenca === 0 ? "text-folha-700" : "neg"}`}>
                {diferenca === 0 ? "✓ batendo" : `R$ ${reais(diferenca)}`}
              </p>
              <p className="text-xs text-stone-500">
                em {dataBr(comSaldo.dataSaldo!)}: extrato R$ {reais(comSaldo.saldoFinalCentavos!)} · sistema R$ {reais(saldoContabil!)}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-stone-400">{ehSocio ? "não se aplica à conta do sócio" : "importe um extrato com saldo"}</p>
          )}
        </Cartao>
      </div>

      <Cartao className="mb-6 p-5">
        <h2 className="mb-2 font-semibold text-stone-800">Pendentes</h2>
        {linhas.length === 0 ? (
          <p className="py-4 text-sm text-stone-500">Nada pendente nesta conta.</p>
        ) : (
          <ul>
            {linhas.map((t) => (
              <LinhaPendente key={t.id} t={t} contas={contas} contaId={conta.id} />
            ))}
          </ul>
        )}
      </Cartao>

      {tratadas.length > 0 && (
        <Cartao className="p-5">
          <details>
            <summary className="cursor-pointer font-semibold text-stone-800">Conciliadas e ignoradas ({tratadas.length})</summary>
            <ul className="mt-2 divide-y divide-stone-100">
              {tratadas.map((t) => (
                <LinhaTratada
                  key={t.id}
                  t={{ id: t.id, data: iso(t.data), valorCentavos: t.valorCentavos, descricao: t.descricao, status: t.status, lancamentoId: t.partida?.lancamentoId ?? null }}
                />
              ))}
            </ul>
          </details>
        </Cartao>
      )}
    </>
  );
}

export default function ConciliacaoPage(props: PageProps<"/conciliacao">) {
  return (
    <Pagina>
      <Conteudo {...props} />
    </Pagina>
  );
}
