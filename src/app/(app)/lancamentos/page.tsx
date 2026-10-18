import type { Metadata } from "next";
import Link from "next/link";
import { BotaoExportar, Cabecalho, Cartao, Valor, botaoPrimario, botaoSecundario } from "@/components/ui";
import { prisma } from "@/lib/db";
import { contasAtivas } from "@/lib/consultas";
import { filtroLancamentos, ORDENS, type Ordem } from "@/lib/lancamentos/filtro";
import { dataBr, reais } from "@/lib/formato";
import { exigirUsuario } from "@/lib/usuario";
import { Pagina } from "@/components/Pagina";

export const metadata: Metadata = { title: "Lançamentos" };

const POR_PAGINA = 100;
const campoFiltro =
  "w-full rounded border border-stone-300 bg-white px-2 py-1 text-xs font-normal text-stone-700 outline-none focus:border-folha-600";

async function Conteudo({ searchParams }: PageProps<"/lancamentos">) {
  await exigirUsuario();
  const sp = await searchParams;

  const { conta, categoria, contaId, busca, de, ate, tipo, minTxt, maxTxt, ordem, dir, filtro, orderBy, temFiltro } = filtroLancamentos(sp);
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const pular = (pagina - 1) * POR_PAGINA;

  // Saldo corrido: uma conta só, ordem por data decrescente e sem filtros que tirem linhas do meio.
  const comSaldo = Boolean(contaId) && !busca && !tipo && !minTxt && !maxTxt && ordem === "data" && dir === "desc";

  const [contas, total, somaFiltro, partidas, saldoAte, somaPaginasAnteriores] = await Promise.all([
    contasAtivas(),
    prisma.partida.count({ where: filtro }),
    prisma.partida.aggregate({ where: filtro, _sum: { valorCentavos: true } }),
    prisma.partida.findMany({
      where: filtro,
      orderBy,
      skip: pular,
      take: POR_PAGINA,
      include: { conta: { select: { nome: true } }, lancamento: { select: { id: true, historico: true, _count: { select: { anexos: true } } } } },
    }),
    comSaldo
      ? prisma.partida.aggregate({ where: { contaId, ...(ate && { data: { lte: new Date(ate) } }) }, _sum: { valorCentavos: true } })
      : null,
    comSaldo && pular > 0 ? prisma.partida.aggregate({ where: filtro, orderBy, take: pular, _sum: { valorCentavos: true } }) : null,
  ]);

  // Lista em ordem decrescente: o saldo depois de cada linha é o saldo final
  // menos tudo o que veio depois dela (as linhas acima, inclusive de páginas anteriores).
  const saldoNoTopo = (saldoAte?._sum.valorCentavos ?? 0) - (somaPaginasAnteriores?._sum.valorCentavos ?? 0);
  const linhas: (typeof partidas[number] & { saldo: number })[] = [];
  for (const p of partidas) {
    const anterior = linhas.at(-1);
    linhas.push({ ...p, saldo: anterior ? anterior.saldo - anterior.valorCentavos : saldoNoTopo });
  }

  // Links preservando filtros e ordem atuais.
  const atuais: Record<string, string> = Object.fromEntries(
    Object.entries({ conta, busca, de, ate, tipo, min: minTxt, max: maxTxt, ordem: ordem === "data" ? "" : ordem, dir: dir === ORDENS[ordem] ? "" : dir }).filter(
      ([, v]) => v,
    ),
  );
  const url = (mudancas: Record<string, string>) => {
    const q = new URLSearchParams(Object.entries({ ...atuais, ...mudancas }).filter(([, v]) => v));
    return `/lancamentos${q.size ? `?${q}` : ""}`;
  };
  const linkOrdem = (col: Ordem) => {
    const novaDir = ordem === col ? (dir === "asc" ? "desc" : "asc") : ORDENS[col];
    return url({ ordem: col === "data" ? "" : col, dir: novaDir === ORDENS[col] ? "" : novaDir, pagina: "" });
  };
  const seta = (col: Ordem) => (ordem === col ? (dir === "asc" ? " ▲" : " ▼") : "");

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const porCategoria = Map.groupBy(contas, (c) => c.categoria);
  const nomeFiltroConta = categoria ? `categoria ${categoria}` : contas.find((c) => c.id === contaId)?.nome;
  const th = "px-3 pt-2.5 pb-1 font-medium";
  const tituloOrdenavel = (col: Ordem, rotulo: string, alinhamento: "left" | "right") => (
    <Link
      href={linkOrdem(col)}
      className={`inline-flex items-center gap-0.5 hover:text-folha-700 ${ordem === col ? "text-folha-700" : ""} ${alinhamento === "right" ? "justify-end" : ""}`}
      title="Clique para ordenar"
    >
      {rotulo}
      <span className="text-[10px]">{seta(col) || " ↕"}</span>
    </Link>
  );

  return (
    <>
      <Cabecalho
        titulo="Lançamentos"
        subtitulo="Clique no título de uma coluna para ordenar; use a linha de filtros logo abaixo. Clique na data para abrir, editar ou excluir."
      >
        <div className="flex flex-wrap gap-2">
          <Link href="/lancamentos/ler" className={botaoPrimario}>
            Ler boleto ou nota
          </Link>
          <Link href="/lancamentos/novo" className={botaoSecundario}>
            Novo lançamento
          </Link>
          <BotaoExportar href={`/api/exportar/lancamentos${url({}).replace("/lancamentos", "")}`} />
        </div>
      </Cabecalho>

      {/* Os campos de filtro ficam dentro da tabela e se ligam a este form pelo atributo form="filtros". */}
      <form id="filtros" action="/lancamentos">
        {/* Mantém a ordenação atual ao filtrar. */}
        {atuais.ordem && <input type="hidden" name="ordem" value={atuais.ordem} />}
        {atuais.dir && <input type="hidden" name="dir" value={atuais.dir} />}
      </form>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-stone-500">
          {total.toLocaleString("pt-BR")} linhas
          {nomeFiltroConta && <> em <strong className="text-stone-700">{nomeFiltroConta}</strong></>}
          {temFiltro && <> · movimento líquido no filtro: R$ {reais(somaFiltro._sum.valorCentavos ?? 0)}</>}
        </p>
        <div className="flex gap-2">
          <button form="filtros" className={`${botaoPrimario} py-1.5`}>
            Filtrar
          </button>
          {temFiltro && (
            <Link href={url({ conta: "", busca: "", de: "", ate: "", tipo: "", min: "", max: "", pagina: "" })} className={`${botaoSecundario} py-1.5`}>
              Limpar filtros
            </Link>
          )}
        </div>
      </div>

      <Cartao className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-stone-200 text-stone-500">
            <tr>
              <th className={`${th} pl-4 text-left`}>{tituloOrdenavel("data", "Data", "left")}</th>
              <th className={`${th} text-left`}>{tituloOrdenavel("conta", "Conta", "left")}</th>
              <th className={`${th} text-left`}>{tituloOrdenavel("historico", "Histórico", "left")}</th>
              <th className={`${th} text-right`}>{tituloOrdenavel("debito", "Débito", "right")}</th>
              <th className={`${th} text-right`}>{tituloOrdenavel("credito", "Crédito", "right")}</th>
              {comSaldo && <th className={`${th} pr-4 text-right`}>Saldo</th>}
            </tr>
            <tr className="align-top">
              <th className="px-3 pb-2.5 pl-4">
                <div className="flex w-32 flex-col gap-1">
                  <input form="filtros" type="date" name="de" defaultValue={de} className={campoFiltro} aria-label="Data de" title="De" />
                  <input form="filtros" type="date" name="ate" defaultValue={ate} className={campoFiltro} aria-label="Data até" title="Até" />
                </div>
              </th>
              <th className="px-3 pb-2.5">
                <select form="filtros" name="conta" defaultValue={conta} className={`${campoFiltro} min-w-44`} aria-label="Filtrar conta">
                  <option value="">Todas</option>
                  {[...porCategoria].map(([cat, cs]) => (
                    <optgroup key={cat} label={cat}>
                      <option value={`cat:${cat}`}>▸ Toda a categoria {cat}</option>
                      {cs.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </th>
              <th className="px-3 pb-2.5">
                <input form="filtros" name="busca" defaultValue={busca} placeholder="Contém…" className={`${campoFiltro} min-w-40`} aria-label="Filtrar histórico" />
              </th>
              <th colSpan={2} className="px-3 pb-2.5">
                <div className="ml-auto flex w-56 flex-col gap-1">
                  <select form="filtros" name="tipo" defaultValue={tipo} className={campoFiltro} aria-label="Débito ou crédito">
                    <option value="">Débitos e créditos</option>
                    <option value="D">Só débitos</option>
                    <option value="C">Só créditos</option>
                  </select>
                  <div className="flex gap-1">
                    <input form="filtros" name="min" defaultValue={minTxt} inputMode="decimal" placeholder="Valor de" className={`${campoFiltro} text-right`} aria-label="Valor mínimo" />
                    <input form="filtros" name="max" defaultValue={maxTxt} inputMode="decimal" placeholder="até" className={`${campoFiltro} text-right`} aria-label="Valor máximo" />
                  </div>
                </div>
              </th>
              {comSaldo && <th />}
            </tr>
          </thead>
          <tbody>
            {linhas.map((p) => (
              <tr key={p.id} className="border-t border-stone-100 hover:bg-folha-50/60">
                <td className="whitespace-nowrap px-3 py-1.5 pl-4 tabular-nums">
                  <Link href={`/lancamentos/${p.lancamento.id}`} className="hover:underline">
                    {dataBr(p.data)}
                  </Link>
                </td>
                <td className="px-3 py-1.5 text-stone-700">{p.conta.nome}</td>
                <td className="max-w-md truncate px-3 py-1.5 text-stone-600" title={p.historico ?? p.lancamento.historico ?? ""}>
                  {p.lancamento._count.anexos > 0 && (
                    <span className="mr-1" title="Tem documento anexado">
                      📎
                    </span>
                  )}
                  {p.historico ?? p.lancamento.historico}
                </td>
                <td className="num px-3 py-1.5">{p.valorCentavos > 0 ? reais(p.valorCentavos) : ""}</td>
                <td className="num px-3 py-1.5">{p.valorCentavos < 0 ? reais(-p.valorCentavos) : ""}</td>
                {comSaldo && (
                  <td className="num px-3 py-1.5 pr-4 font-medium">
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
              <Link href={url({ pagina: String(pagina - 1) })} className={botaoSecundario}>
                ← Anterior
              </Link>
            )}
            {pagina < paginas && (
              <Link href={url({ pagina: String(pagina + 1) })} className={botaoSecundario}>
                Próxima →
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function LancamentosPage(props: PageProps<"/lancamentos">) {
  return (
    <Pagina>
      <Conteudo {...props} />
    </Pagina>
  );
}
