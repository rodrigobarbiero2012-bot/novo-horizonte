import type { Situacao } from "@/lib/cronograma/modelos";
import { MESES_CURTOS, periodoTexto, SITUACOES } from "./situacoes";

export type TarefaTimeline = { id: string; etapa: string; titulo: string; mesInicio: number; mesFim: number; situacao: Situacao };

const COLUNAS = "grid-cols-[minmax(13rem,1.3fr)_repeat(12,minmax(2.25rem,1fr))]";

/** Gráfico de Gantt anual: uma linha por tarefa, agrupada por etapa, barra do mês inicial ao final. */
export function Timeline({ tarefas, mesAtual }: { tarefas: TarefaTimeline[]; mesAtual: number | null }) {
  const etapas = Map.groupBy(tarefas, (t) => t.etapa);
  const destaqueMes = (m: number) => (m === mesAtual ? "bg-folha-50" : "");

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[46rem] text-sm">
        <div className={`grid ${COLUNAS} border-b border-stone-200 text-xs text-stone-500`}>
          <div className="sticky left-0 z-10 bg-white py-2 pl-1">Tarefa</div>
          {MESES_CURTOS.map((m, i) => (
            <div key={m} className={`py-2 text-center ${destaqueMes(i + 1)} ${i + 1 === mesAtual ? "font-semibold text-folha-700" : ""}`}>
              {m}
            </div>
          ))}
        </div>
        {[...etapas].map(([etapa, lista]) => (
          <div key={etapa}>
            <div className={`grid ${COLUNAS}`}>
              <div className="sticky left-0 z-10 bg-white pb-1 pl-1 pt-3 text-xs font-semibold uppercase tracking-wide text-folha-700">{etapa}</div>
              {MESES_CURTOS.map((m, i) => (
                <div key={m} className={destaqueMes(i + 1)} />
              ))}
            </div>
            {lista.map((t) => {
              const s = SITUACOES[t.situacao];
              return (
                <div key={t.id} className={`grid ${COLUNAS} items-center hover:bg-stone-50`}>
                  <div className="sticky left-0 z-10 truncate bg-white py-1 pl-1 pr-2 text-stone-700" title={t.titulo}>
                    <span className={`mr-1.5 ${s.texto}`} aria-label={s.rotulo}>
                      {s.icone}
                    </span>
                    {t.titulo}
                  </div>
                  {/* fundo dos meses (destaca o mês atual) + a barra posicionada por coluna */}
                  <div className="relative col-span-12 grid h-7 grid-cols-12">
                    {MESES_CURTOS.map((m, i) => (
                      <div key={m} className={destaqueMes(i + 1)} />
                    ))}
                    <div
                      className={`absolute inset-y-1.5 rounded ${s.barra}`}
                      style={{ left: `calc(${((t.mesInicio - 1) / 12) * 100}% + 2px)`, width: `calc(${((t.mesFim - t.mesInicio + 1) / 12) * 100}% - 4px)` }}
                      title={`${t.titulo} · ${periodoTexto(t.mesInicio, t.mesFim)} · ${s.rotulo}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div className="mt-4 flex flex-wrap gap-4 border-t border-stone-100 pt-3 text-xs text-stone-600">
          {Object.values(SITUACOES).map((s) => (
            <span key={s.rotulo} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-4 rounded-sm ${s.barra}`} />
              <span className={s.texto}>{s.icone}</span> {s.rotulo}
            </span>
          ))}
          {mesAtual && (
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-sm border border-folha-100 bg-folha-50" /> Mês atual
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
