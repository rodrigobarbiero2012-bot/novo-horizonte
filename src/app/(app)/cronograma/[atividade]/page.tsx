import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Checklist, type TarefaChecklist } from "@/components/cronograma/Checklist";
import { FormNovaTarefa } from "@/components/cronograma/FormNovaTarefa";
import { SITUACOES } from "@/components/cronograma/situacoes";
import { Timeline } from "@/components/cronograma/Timeline";
import { Pagina } from "@/components/Pagina";
import { Abas, Cabecalho, Cartao, botaoPrimario } from "@/components/ui";
import { ATIVIDADES_CRONOGRAMA, ehSlugAtividade, MODELOS, PENDENCIAS_MODELO, situacao } from "@/lib/cronograma/modelos";
import { prisma } from "@/lib/db";
import { dataBr } from "@/lib/formato";
import { exigirUsuario } from "@/lib/usuario";
import { adicionarTarefa, alternarTarefa, criarDoModelo, excluirTarefa } from "../acoes";
import { hojeSP } from "@/lib/hoje";

export const metadata: Metadata = { title: "Cronograma" };

async function Conteudo({ params, searchParams }: PageProps<"/cronograma/[atividade]">) {
  await exigirUsuario();
  const { atividade: slug } = await params;
  if (!ehSlugAtividade(slug)) notFound();
  const { chave, nome } = ATIVIDADES_CRONOGRAMA[slug];

  const dataHoje = hojeSP();
  const hoje = { ano: Number(dataHoje.slice(0, 4)), mes: Number(dataHoje.slice(5, 7)) };
  const anoParam = Number((await searchParams).ano);
  const ano = Number.isInteger(anoParam) && anoParam > 2000 && anoParam < 2100 ? anoParam : hoje.ano;

  const tarefas = await prisma.tarefaCronograma.findMany({
    where: { atividade: chave, ano },
    orderBy: [{ ordem: "asc" }],
    include: { concluidaPor: { select: { nome: true } } },
  });
  // Etapas na ordem em que aparecem no modelo; as criadas à mão vêm depois.
  const ordemEtapas = [...new Set([...MODELOS[chave].map((m) => m.etapa), ...tarefas.map((t) => t.etapa)])];
  const ordenadas = [...tarefas].sort(
    (a, b) => ordemEtapas.indexOf(a.etapa) - ordemEtapas.indexOf(b.etapa) || a.mesInicio - b.mesInicio || a.ordem - b.ordem,
  );
  const comSituacao = ordenadas.map((t) => ({ ...t, situacao: situacao(t, hoje) }));
  const contagem = Object.fromEntries(Object.keys(SITUACOES).map((s) => [s, comSituacao.filter((t) => t.situacao === s).length]));

  const anos = [hoje.ano - 1, hoje.ano, hoje.ano + 1];
  const checklist: TarefaChecklist[] = comSituacao.map((t) => ({
    id: t.id,
    etapa: t.etapa,
    titulo: t.titulo,
    mesInicio: t.mesInicio,
    mesFim: t.mesFim,
    situacao: t.situacao,
    concluida: t.concluida,
    concluidaPor: t.concluidaPor?.nome ?? null,
    concluidaEm: t.concluidaEm ? dataBr(t.concluidaEm) : null,
  }));

  return (
    <>
      <Cabecalho
        titulo={`Cronograma — ${nome}`}
        subtitulo="Etapas do ano em linha do tempo e checklist. Modelo inicial pelo calendário típico do Sudeste — ajuste com o agrônomo/veterinário."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Abas atual={slug} opcoes={Object.entries(ATIVIDADES_CRONOGRAMA).map(([s, a]) => ({ valor: s, rotulo: a.nome, href: `/cronograma/${s}` }))} />
          <Abas
            atual={String(ano)}
            opcoes={anos.map((a) => ({ valor: String(a), rotulo: String(a), href: `/cronograma/${slug}${a === hoje.ano ? "" : `?ano=${a}`}` }))}
          />
        </div>
      </Cabecalho>

      {PENDENCIAS_MODELO[chave] && (
        <div className="mb-4 max-w-3xl rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ⚠ <strong>Pendência:</strong> {PENDENCIAS_MODELO[chave]}
        </div>
      )}

      {tarefas.length === 0 ? (
        <Cartao className="max-w-2xl p-6">
          <p className="mb-1 font-medium text-stone-800">Ainda não há cronograma de {nome.toLowerCase()} para {ano}.</p>
          <p className="mb-4 text-sm text-stone-600">
            Comece pelo modelo com {MODELOS[chave].length} tarefas típicas da atividade. Depois é só ajustar: marcar, excluir ou incluir tarefas.
          </p>
          <form action={criarDoModelo.bind(null, slug, ano)}>
            <button className={botaoPrimario}>Criar cronograma de {ano} a partir do modelo</button>
          </form>
        </Cartao>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <span className="font-medium text-stone-800">
              {contagem.concluida} de {tarefas.length} concluídas
            </span>
            {(
              [
                ["andamento", "em andamento", "em andamento"],
                ["atrasada", "atrasada", "atrasadas"],
                ["prevista", "prevista", "previstas"],
              ] as const
            ).map(([s, singular, plural]) => (
              <span key={s} className={SITUACOES[s].texto}>
                {SITUACOES[s].icone} {contagem[s]} {contagem[s] === 1 ? singular : plural}
              </span>
            ))}
          </div>

          <Cartao className="mb-6 p-5">
            <h2 className="mb-3 font-semibold text-stone-800">Linha do tempo {ano}</h2>
            <Timeline tarefas={comSituacao} mesAtual={ano === hoje.ano ? hoje.mes : null} />
          </Cartao>

          <Cartao className="p-5">
            <h2 className="mb-3 font-semibold text-stone-800">Checklist {ano}</h2>
            <Checklist tarefas={checklist} alternar={alternarTarefa.bind(null, slug)} excluir={excluirTarefa.bind(null, slug)} />
            <div className="mt-6 border-t border-stone-200 pt-4">
              <FormNovaTarefa etapas={ordemEtapas} acao={adicionarTarefa.bind(null, slug, ano)} />
            </div>
          </Cartao>
        </>
      )}
    </>
  );
}

export default function CronogramaPage(props: PageProps<"/cronograma/[atividade]">) {
  return (
    <Pagina>
      <Conteudo {...props} />
    </Pagina>
  );
}
