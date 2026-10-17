"use client";

import { useOptimistic, useTransition } from "react";
import type { Situacao } from "@/lib/cronograma/modelos";
import { periodoTexto, SITUACOES } from "./situacoes";

export type TarefaChecklist = {
  id: string;
  etapa: string;
  titulo: string;
  mesInicio: number;
  mesFim: number;
  situacao: Situacao;
  concluida: boolean;
  concluidaPor: string | null;
  concluidaEm: string | null; // dd/mm/aaaa
};

type Props = {
  tarefas: TarefaChecklist[];
  alternar: (id: string) => Promise<void>;
  excluir: (id: string) => Promise<void>;
};

/** Checklist por etapa. A marcação aparece na hora (otimista) e o servidor confirma em seguida. */
export function Checklist({ tarefas, alternar, excluir }: Props) {
  const [, iniciar] = useTransition();
  const [otimistas, marcar] = useOptimistic(tarefas, (atuais, id: string) =>
    atuais.map((t) => (t.id === id ? { ...t, concluida: !t.concluida, situacao: t.concluida ? t.situacao : ("concluida" as const) } : t)),
  );
  const etapas = Map.groupBy(otimistas, (t) => t.etapa);

  return (
    <div className="space-y-5">
      {[...etapas].map(([etapa, lista]) => {
        const feitas = lista.filter((t) => t.concluida).length;
        return (
          <section key={etapa}>
            <h3 className="mb-1.5 flex items-baseline justify-between border-b border-stone-200 pb-1 text-xs font-semibold uppercase tracking-wide text-folha-700">
              {etapa}
              <span className="font-normal normal-case tracking-normal text-stone-500">
                {feitas} de {lista.length}
              </span>
            </h3>
            <ul>
              {lista.map((t) => {
                const s = SITUACOES[t.concluida ? "concluida" : t.situacao];
                return (
                  <li key={t.id} className="group flex items-start gap-3 rounded px-1 py-1.5 hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={t.concluida}
                      onChange={() =>
                        iniciar(async () => {
                          marcar(t.id);
                          await alternar(t.id);
                        })
                      }
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-folha-700"
                      aria-label={`Marcar "${t.titulo}" como ${t.concluida ? "não concluída" : "concluída"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${t.concluida ? "text-stone-400 line-through" : "text-stone-800"}`}>{t.titulo}</p>
                      <p className="text-xs text-stone-500">
                        {periodoTexto(t.mesInicio, t.mesFim)} ·{" "}
                        <span className={s.texto}>
                          {s.icone} {s.rotulo}
                        </span>
                        {t.concluida && t.concluidaPor && (
                          <>
                            {" "}
                            por {t.concluidaPor} em {t.concluidaEm}
                          </>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Excluir a tarefa "${t.titulo}"?`)) iniciar(() => excluir(t.id));
                      }}
                      className="rounded px-1.5 text-stone-300 opacity-0 hover:bg-red-50 hover:text-red-700 focus:opacity-100 group-hover:opacity-100"
                      aria-label={`Excluir "${t.titulo}"`}
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
