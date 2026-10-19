import type { Metadata } from "next";
import Link from "next/link";
import { FormDia, FormFechamento, FormTrabalhador, type AbertoTela } from "@/components/maoDeObra/Componentes";
import { Pagina } from "@/components/Pagina";
import { BotaoLinha } from "@/components/producao/Formularios";
import { Cabecalho, Cartao } from "@/components/ui";
import { contasAtivas } from "@/lib/consultas";
import { contaMaisUsada } from "@/lib/documentos/sugestoes";
import { prisma } from "@/lib/db";
import { dataBr, reais } from "@/lib/formato";
import { hojeSP } from "@/lib/hoje";
import { ATIVIDADES_MAO_DE_OBRA, TIPOS_TRABALHADOR, type AtividadeMaoDeObra, type TipoTrabalhador } from "@/lib/maoDeObra/calculo";
import { CATEGORIAS_BAIXA } from "@/lib/titulos/categorias";
import { exigirUsuario } from "@/lib/usuario";
import { alternarTrabalhador, desfazerFechamento, excluirApontamento } from "./acoes";

export const metadata: Metadata = { title: "Mão de obra" };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const qtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
/** Janela para achar a conta que costuma pagar (a mais usada nos últimos 120 dias). */
const desde120Dias = () => new Date(Date.now() - 120 * 86_400_000);

function Indicador({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <Cartao className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{rotulo}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{valor}</p>
      {nota && <p className="text-xs text-stone-500">{nota}</p>}
    </Cartao>
  );
}

async function Conteudo() {
  await exigirUsuario();
  const hoje = hojeSP();
  const ano = hoje.slice(0, 4);
  const inicioMes = `${hoje.slice(0, 7)}-01`;

  const [equipe, contas, abertos, fechamentos, doAno, pagamentos] = await Promise.all([
    prisma.trabalhador.findMany({ orderBy: [{ ativo: "desc" }, { nome: "asc" }] }),
    contasAtivas(),
    prisma.apontamento.findMany({
      where: { fechamentoId: null },
      orderBy: [{ data: "desc" }, { criadoEm: "desc" }],
      include: { trabalhador: { select: { nome: true } }, conta: { select: { nome: true } } },
    }),
    prisma.fechamentoMaoDeObra.findMany({ orderBy: { dataPagamento: "desc" }, take: 24, include: { _count: { select: { apontamentos: true } } } }),
    prisma.apontamento.findMany({
      where: { data: { gte: new Date(`${ano}-01-01`), lte: new Date(`${ano}-12-31`) } },
      select: { trabalhadorId: true, data: true, atividade: true, servico: true, quantidade: true, valorCentavos: true, dias: true },
    }),
    prisma.partida.findMany({
      where: { valorCentavos: { lt: 0 }, data: { gte: desde120Dias() }, conta: { categoria: { in: CATEGORIAS_BAIXA } } },
      select: { contaId: true },
    }),
  ]);

  const ativos = equipe.filter((t) => t.ativo);
  const nomes = new Map(equipe.map((t) => [t.id, t.nome]));
  const contasCusteio = contas.filter((c) => c.categoria === "Custeio");
  const contasPagamento = contas.filter((c) => CATEGORIAS_BAIXA.includes(c.categoria)).map(({ id, nome }) => ({ id, nome }));
  const nomeConta = new Map(contas.map((c) => [c.id, c.nome]));

  const emAberto = abertos.reduce((s, a) => s + a.valorCentavos, 0);
  const custoMes = doAno.filter((a) => iso(a.data) >= inicioMes).reduce((s, a) => s + a.valorCentavos, 0);
  const custoAno = doAno.reduce((s, a) => s + a.valorCentavos, 0);
  const colheitaAno = doAno.filter((a) => a.atividade === "CAFE" && /colheita/i.test(a.servico));
  const latasAno = colheitaAno.reduce((s, a) => s + (a.quantidade ?? 0), 0);
  const porPessoa = new Map<string, { latas: number; valor: number; dias: number }>();
  for (const a of doAno) {
    const p = porPessoa.get(a.trabalhadorId) ?? { latas: 0, valor: 0, dias: 0 };
    p.valor += a.valorCentavos;
    p.dias += a.dias;
    if (a.atividade === "CAFE" && /colheita/i.test(a.servico)) p.latas += a.quantidade ?? 0;
    porPessoa.set(a.trabalhadorId, p);
  }

  const abertosTela: AbertoTela[] = abertos.map((a) => ({
    id: a.id,
    trabalhadorId: a.trabalhadorId,
    nome: a.trabalhador.nome,
    data: iso(a.data),
    contaId: a.contaId,
    dias: a.dias,
    quantidade: a.quantidade,
    valorCentavos: a.valorCentavos,
  }));

  return (
    <>
      <Cabecalho
        titulo="Mão de obra"
        subtitulo="Apontamento diário da equipe (diárias e colheita por lata), e fechamento do período que gera o lançamento no custeio de cada atividade."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador rotulo="A pagar (em aberto)" valor={`R$ ${reais(emAberto)}`} nota={`${abertos.length} apontamento${abertos.length === 1 ? "" : "s"} sem fechamento`} />
        <Indicador rotulo="Custo no mês" valor={`R$ ${reais(custoMes)}`} nota="apontado, pago ou não" />
        <Indicador rotulo={`Custo em ${ano}`} valor={`R$ ${reais(custoAno)}`} nota={`${ativos.length} pessoa${ativos.length === 1 ? "" : "s"} na equipe`} />
        <Indicador rotulo={`Café colhido em ${ano}`} valor={`${qtd(latasAno)} latas`} nota="pelos apontamentos de colheita" />
      </div>

      <Cartao className="mb-6 p-5">
        <h2 className="mb-3 font-semibold text-stone-800">Apontar um dia de serviço</h2>
        <FormDia
          equipe={ativos.map((t) => ({ id: t.id, nome: t.nome, tipo: t.tipo, diariaCentavos: t.diariaCentavos, precoUnidadeCentavos: t.precoUnidadeCentavos }))}
          contas={contasCusteio}
          hoje={hoje}
        />
      </Cartao>

      <Cartao className="mb-6 p-5">
        <h2 className="mb-1 font-semibold text-stone-800">Em aberto (ainda não pago)</h2>
        {abertos.length === 0 ? (
          <p className="py-3 text-sm text-stone-500">Nada em aberto.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs text-stone-500">
                  <th className="py-1.5 font-medium">Data</th>
                  <th className="py-1.5 font-medium">Pessoa</th>
                  <th className="py-1.5 font-medium">Serviço</th>
                  <th className="py-1.5 text-right font-medium">Dias</th>
                  <th className="py-1.5 text-right font-medium">Colhido</th>
                  <th className="py-1.5 text-right font-medium">Valor</th>
                  <th className="py-1.5 font-medium">Conta</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {abertos.map((a) => (
                  <tr key={a.id} className="border-b border-stone-100">
                    <td className="py-1 tabular-nums text-stone-600">{dataBr(a.data)}</td>
                    <td className="py-1">{a.trabalhador.nome}</td>
                    <td className="py-1 text-stone-600">
                      {a.servico} <span className="text-xs text-stone-400">({ATIVIDADES_MAO_DE_OBRA[a.atividade as AtividadeMaoDeObra] ?? a.atividade})</span>
                    </td>
                    <td className="num py-1">{a.dias ? qtd(a.dias) : ""}</td>
                    <td className="num py-1">{a.quantidade ? qtd(a.quantidade) : ""}</td>
                    <td className="num py-1 font-medium">{reais(a.valorCentavos)}</td>
                    <td className="max-w-[12rem] truncate py-1 text-xs text-stone-500">{a.conta.nome}</td>
                    <td className="py-1 text-right">
                      <BotaoLinha perigo acao={excluirApontamento.bind(null, a.id)} confirmacao="Excluir este apontamento?">
                        excluir
                      </BotaoLinha>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>

      <Cartao className="mb-6 p-5">
        <h2 className="mb-1 font-semibold text-stone-800">Fechar e pagar</h2>
        <p className="mb-3 text-xs text-stone-500">
          Junta o que está em aberto no período, mostra quanto pagar a cada pessoa e gera um lançamento: débito no custeio de cada atividade, crédito na
          conta que pagou.
        </p>
        <FormFechamento abertos={abertosTela} contasPagamento={contasPagamento} contaPadrao={contaMaisUsada(pagamentos)?.contaId ?? null} hoje={hoje} />
        {fechamentos.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-stone-700">Fechamentos anteriores ({fechamentos.length})</summary>
            <ul className="mt-2 divide-y divide-stone-100 text-sm">
              {fechamentos.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-1.5">
                  <span className="tabular-nums text-stone-600">
                    {dataBr(f.inicio)} a {dataBr(f.fim)}
                  </span>
                  <span className="text-xs text-stone-500">
                    pago em {dataBr(f.dataPagamento)} · {nomeConta.get(f.contaPagamentoId) ?? ""} · {f._count.apontamentos} apontamentos
                  </span>
                  <span className="num ml-auto font-medium">R$ {reais(f.totalCentavos)}</span>
                  <Link href={`/lancamentos/${f.lancamentoId}`} className="text-xs text-folha-700 hover:underline">
                    lançamento
                  </Link>
                  <BotaoLinha perigo acao={desfazerFechamento.bind(null, f.id)} confirmacao="Desfazer este fechamento? O lançamento é apagado e os apontamentos voltam a ficar em aberto.">
                    desfazer
                  </BotaoLinha>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Cartao>

      <Cartao className="p-5">
        <h2 className="mb-3 font-semibold text-stone-800">Equipe</h2>
        <FormTrabalhador />
        {equipe.length > 0 && (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs text-stone-500">
                <th className="py-1.5 font-medium">Nome</th>
                <th className="py-1.5 font-medium">Tipo</th>
                <th className="py-1.5 text-right font-medium">Diária</th>
                <th className="py-1.5 text-right font-medium">Por lata</th>
                <th className="py-1.5 text-right font-medium">Dias em {ano}</th>
                <th className="py-1.5 text-right font-medium">Latas em {ano}</th>
                <th className="py-1.5 text-right font-medium">Pago/apontado em {ano}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {equipe.map((t) => {
                const p = porPessoa.get(t.id);
                return (
                  <tr key={t.id} className={`border-b border-stone-100 ${t.ativo ? "" : "text-stone-400"}`}>
                    <td className="py-1">
                      {t.nome}
                      {t.observacao && <span className="block text-xs text-stone-400">{t.observacao}</span>}
                    </td>
                    <td className="py-1 text-stone-600">{TIPOS_TRABALHADOR[t.tipo as TipoTrabalhador] ?? t.tipo}</td>
                    <td className="num py-1">{t.diariaCentavos ? reais(t.diariaCentavos) : "–"}</td>
                    <td className="num py-1">{t.precoUnidadeCentavos ? reais(t.precoUnidadeCentavos) : "–"}</td>
                    <td className="num py-1">{p?.dias ? qtd(p.dias) : ""}</td>
                    <td className="num py-1">{p?.latas ? qtd(p.latas) : ""}</td>
                    <td className="num py-1">{p ? reais(p.valor) : ""}</td>
                    <td className="py-1 text-right">
                      <BotaoLinha perigo={t.ativo} acao={alternarTrabalhador.bind(null, t.id)}>
                        {t.ativo ? "desativar" : "reativar"}
                      </BotaoLinha>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {nomes.size === 0 && <p className="mt-3 text-sm text-stone-500">Ninguém cadastrado ainda.</p>}
      </Cartao>
    </>
  );
}

export default function MaoDeObraPage() {
  return (
    <Pagina>
      <Conteudo />
    </Pagina>
  );
}
