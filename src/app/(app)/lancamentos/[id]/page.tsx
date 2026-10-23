import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormularioLancamento, type LinhaForm } from "@/components/FormularioLancamento";
import { ListaAnexos } from "@/components/Anexos";
import { Cabecalho, Cartao } from "@/components/ui";
import { CAMPOS_ANEXO } from "@/lib/anexos";
import { BotaoExcluir } from "@/components/BotaoExcluir";
import { prisma } from "@/lib/db";
import { contasAtivas } from "@/lib/consultas";
import { dataBr } from "@/lib/formato";
import { exigirUsuario } from "@/lib/usuario";
import { atualizarLancamento, excluirLancamento } from "../acoes";
import { Pagina } from "@/components/Pagina";

export const metadata: Metadata = { title: "Lançamento" };

const valorTexto = (c: number) => (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const iso = (d: Date) => d.toISOString().slice(0, 10);

async function Conteudo({ params }: PageProps<"/lancamentos/[id]">) {
  await exigirUsuario();
  const { id } = await params;
  const [lancamento, contas, historicoAlteracoes] = await Promise.all([
    prisma.lancamento.findUnique({
      where: { id },
      include: {
        partidas: { orderBy: [{ linhaPlanilha: "asc" }, { valorCentavos: "desc" }] },
        criadoPor: { select: { nome: true } },
        atualizadoPor: { select: { nome: true } },
        anexos: { select: CAMPOS_ANEXO, orderBy: { criadoEm: "asc" } },
        titulo: { select: { id: true, descricao: true, grupoParcelasId: true } },
      },
    }),
    contasAtivas(),
    prisma.registroAuditoria.findMany({
      where: { entidade: "Lancamento", entidadeId: id },
      orderBy: { em: "desc" },
      include: { usuario: { select: { nome: true } } },
    }),
  ]);
  if (!lancamento) notFound();

  // Arquivos da conta a pagar/receber que gerou o lançamento (no parcelamento, ficam na 1ª parcela).
  const t = lancamento.titulo;
  const anexosDoTitulo = t
    ? await prisma.anexo.findMany({
        where: t.grupoParcelasId ? { titulo: { grupoParcelasId: t.grupoParcelasId } } : { tituloId: t.id },
        select: CAMPOS_ANEXO,
        orderBy: { criadoEm: "asc" },
      })
    : [];
  const resumo = (a: { id: string; nome: string; tipo: string; tamanho: number; criadoEm: Date }) => ({ ...a, criadoEm: iso(a.criadoEm) });

  const data = iso(lancamento.data);
  // Pernas com data ou histórico próprios (lotes da planilha) pedem a edição detalhada.
  const detalhar = lancamento.partidas.some((p) => iso(p.data) !== data || (p.historico && p.historico !== lancamento.historico));
  const linhas: LinhaForm[] = lancamento.partidas.map((p) => ({
    contaId: p.contaId,
    debito: p.valorCentavos > 0 ? valorTexto(p.valorCentavos) : "",
    credito: p.valorCentavos < 0 ? valorTexto(-p.valorCentavos) : "",
    data: detalhar ? iso(p.data) : "",
    historico: p.historico ?? "",
    fiscal: p.fiscal === true ? "s" : p.fiscal === false ? "n" : "",
    linhaPlanilha: p.linhaPlanilha,
    atividade: p.atividade ?? "",
  }));

  const origem =
    lancamento.origem === "PLANILHA"
      ? `Importado da planilha (linhas ${lancamento.linhaPlanilhaInicio}–${lancamento.linhaPlanilhaFim})`
      : `Lançado por ${lancamento.criadoPor?.nome ?? "—"}`;

  return (
    <>
      <Cabecalho titulo="Lançamento" subtitulo={`${origem} · ${lancamento.partidas.length} linhas`}>
        <BotaoExcluir acao={excluirLancamento.bind(null, id)} />
      </Cabecalho>
      {lancamento.titulo && (
        <p className="mb-4 max-w-6xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Gerado pela baixa da conta “{lancamento.titulo.descricao}”. Para alterar valor, data ou conta, desfaça a baixa em{" "}
          <Link href="/a-pagar-receber" className="underline">
            A pagar e receber
          </Link>{" "}
          e registre de novo.
        </p>
      )}
      <Cartao className="max-w-6xl p-5">
        <FormularioLancamento
          contas={contas}
          acao={atualizarLancamento.bind(null, id)}
          inicial={{ data, historico: lancamento.historico ?? "", linhas }}
          edicao
          detalharLinhas={detalhar}
          textoBotao="Gravar alterações"
        />
      </Cartao>
      <Cartao className="mt-6 max-w-6xl p-5">
        <h2 className="mb-2 font-semibold text-stone-800">Documentos</h2>
        <ListaAnexos anexos={lancamento.anexos.map(resumo)} destino={{ lancamentoId: id }} vazio="Nenhum boleto, nota ou comprovante anexado." />
        {anexosDoTitulo.length > 0 && (
          <div className="mt-4 border-t border-stone-100 pt-3">
            <p className="mb-1 text-xs text-stone-500">Da conta a pagar/receber “{t!.descricao}”:</p>
            <ListaAnexos anexos={anexosDoTitulo.map(resumo)} />
          </div>
        )}
      </Cartao>
      {historicoAlteracoes.length > 0 && (
        <div className="mt-6 max-w-6xl">
          <h2 className="mb-2 text-sm font-semibold text-stone-700">Histórico de alterações</h2>
          <ul className="space-y-1 text-sm text-stone-600">
            {historicoAlteracoes.map((r) => (
              <li key={r.id}>
                {dataBr(r.em)} {r.em.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })} ·{" "}
                {r.usuario?.nome ?? "sistema"} · {r.acao.toLowerCase()}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

export default function LancamentoPage(props: PageProps<"/lancamentos/[id]">) {
  return (
    <Pagina>
      <Conteudo {...props} />
    </Pagina>
  );
}
