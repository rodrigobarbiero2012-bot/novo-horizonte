import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Cabecalho, Cartao, Valor, botaoPrimario, botaoSecundario, campo } from "@/components/ui";
import { prisma } from "@/lib/db";
import { contasAtivas } from "@/lib/consultas";
import { dataBr, reais } from "@/lib/formato";
import { exigirUsuario } from "@/lib/usuario";
import { Pagina } from "@/components/Pagina";

export const metadata: Metadata = { title: "Razão" };

const POR_PAGINA = 100;
const dataValida = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

async function Conteudo({ searchParams }: PageProps<"/razao">) {
  await exigirUsuario();
  const sp = await searchParams;
  const conta = typeof sp.conta === "string" ? sp.conta : "";
  const busca = typeof sp.busca === "string" ? sp.busca.trim() : "";
  const de = dataValida(sp.de) ? sp.de : "";
  const ate = dataValida(sp.ate) ? sp.ate : "";
  const pagina = Math.max(1, Number(sp.pagina) || 1);

  const filtro: Prisma.PartidaWhereInput = {
    ...(conta && { contaId: conta }),
    ...((de || ate) && { data: { ...(de && { gte: new Date(de) }), ...(ate && { lte: new Date(ate) }) } }),
    ...(busca && {
      OR: [
        { historico: { contains: busca, mode: "insensitive" } },
        { lancamento: { historico: { contains: busca, mode: "insensitive" } } },
      ],
    }),
  };
  const ordem: Prisma.PartidaOrderByWithRelationInput[] = [{ data: "desc" }, { linhaPlanilha: "desc" }, { id: "desc" }];
  const pular = (pagina - 1) * POR_PAGINA;

  // Saldo corrido só faz sentido com uma conta escolhida e sem busca por texto.
  const comSaldo = Boolean(conta) && !busca;

  const [contas, total, somaPeriodo, partidas, saldoAte, somaPaginasAnteriores] = await Promise.all([
    contasAtivas(),
    prisma.partida.count({ where: filtro }),
    prisma.partida.aggregate({ where: filtro, _sum: { valorCentavos: true } }),
    prisma.partida.findMany({
      where: filtro,
      orderBy: ordem,
      skip: pular,
      take: POR_PAGINA,
      include: { conta: { select: { nome: true } }, lancamento: { select: { id: true, historico: true } } },
    }),
    comSaldo
      ? prisma.partida.aggregate({ where: { contaId: conta, ...(ate && { data: { lte: new Date(ate) } }) }, _sum: { valorCentavos: true } })
      : null,
    comSaldo && pular > 0
      ? prisma.partida.aggregate({ where: filtro, orderBy: ordem, take: pular, _sum: { valorCentavos: true } })
      : null,
  ]);

  // Lista em ordem decrescente: o saldo depois de cada linha é o saldo final
  // menos tudo o que veio depois dela (as linhas acima, inclusive de páginas anteriores).
  const saldoNoTopo = (saldoAte?._sum.valorCentavos ?? 0) - (somaPaginasAnteriores?._sum.valorCentavos ?? 0);
  const linhas: (typeof partidas[number] & { saldo: number })[] = [];
  for (const p of partidas) {
    const anterior = linhas.at(-1);
    linhas.push({ ...p, saldo: anterior ? anterior.saldo - anterior.valorCentavos : saldoNoTopo });
  }

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const link = (n: number) => {
    const q = new URLSearchParams({ ...(conta && { conta }), ...(busca && { busca }), ...(de && { de }), ...(ate && { ate }), pagina: String(n) });
    return `/razao?${q}`;
  };
  const contaEscolhida = contas.find((c) => c.id === conta);
  const porCategoria = Map.groupBy(contas, (c) => c.categoria);

  return (
    <>
      <Cabecalho titulo="Razão" subtitulo="Todas as linhas lançadas, das mais recentes para as mais antigas.">
        <Link href="/lancamentos/novo" className={botaoPrimario}>
          Novo lançamento
        </Link>
      </Cabecalho>

      <form className="mb-4 grid gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_9.5rem_9.5rem_auto]">
        <select name="conta" defaultValue={conta} className={campo} aria-label="Conta">
          <option value="">Todas as contas</option>
          {[...porCategoria].map(([cat, cs]) => (
            <optgroup key={cat} label={cat}>
              {cs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <input name="busca" defaultValue={busca} placeholder="Buscar no histórico" className={campo} aria-label="Buscar no histórico" />
        <input type="date" name="de" defaultValue={de} className={campo} aria-label="De" />
        <input type="date" name="ate" defaultValue={ate} className={campo} aria-label="Até" />
        <div className="flex gap-2">
          <button className={botaoPrimario}>Filtrar</button>
          <Link href="/razao" className={botaoSecundario}>
            Limpar
          </Link>
        </div>
      </form>

      <p className="mb-2 text-sm text-stone-500">
        {total.toLocaleString("pt-BR")} linhas
        {contaEscolhida && <> em <strong className="text-stone-700">{contaEscolhida.nome}</strong></>}
        {(de || ate || busca || conta) && <> · movimento líquido no filtro: R$ {reais(somaPeriodo._sum.valorCentavos ?? 0)}</>}
      </p>

      <Cartao className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-stone-200 text-stone-500">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Data</th>
              {!conta && <th className="px-3 py-2.5 text-left font-medium">Conta</th>}
              <th className="px-3 py-2.5 text-left font-medium">Histórico</th>
              <th className="px-3 py-2.5 text-right font-medium">Débito</th>
              <th className="px-3 py-2.5 text-right font-medium">Crédito</th>
              {comSaldo && <th className="px-4 py-2.5 text-right font-medium">Saldo</th>}
            </tr>
          </thead>
          <tbody>
            {linhas.map((p) => (
              <tr key={p.id} className="border-t border-stone-100 hover:bg-folha-50/60">
                <td className="whitespace-nowrap px-4 py-1.5 tabular-nums">
                  <Link href={`/lancamentos/${p.lancamento.id}`} className="hover:underline">
                    {dataBr(p.data)}
                  </Link>
                </td>
                {!conta && <td className="px-3 py-1.5 text-stone-700">{p.conta.nome}</td>}
                <td className="max-w-md truncate px-3 py-1.5 text-stone-600" title={p.historico ?? p.lancamento.historico ?? ""}>
                  {p.historico ?? p.lancamento.historico}
                </td>
                <td className="num px-3 py-1.5">{p.valorCentavos > 0 ? reais(p.valorCentavos) : ""}</td>
                <td className="num px-3 py-1.5">{p.valorCentavos < 0 ? reais(-p.valorCentavos) : ""}</td>
                {comSaldo && (
                  <td className="num px-4 py-1.5 font-medium">
                    <Valor centavos={p.saldo} />
                  </td>
                )}
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-stone-500">
                  Nenhuma linha encontrada com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Cartao>

      {paginas > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-stone-600">
          <span>
            Página {pagina} de {paginas}
          </span>
          <div className="flex gap-2">
            {pagina > 1 && (
              <Link href={link(pagina - 1)} className={botaoSecundario}>
                ← Mais recentes
              </Link>
            )}
            {pagina < paginas && (
              <Link href={link(pagina + 1)} className={botaoSecundario}>
                Mais antigas →
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function RazaoPage(props: PageProps<"/razao">) {
  return (
    <Pagina>
      <Conteudo {...props} />
    </Pagina>
  );
}
