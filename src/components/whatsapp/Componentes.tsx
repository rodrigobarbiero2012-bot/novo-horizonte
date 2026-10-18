"use client";

import { useActionState, useState, useTransition } from "react";
import { descartarDocumento, salvarNumeros } from "@/app/(app)/whatsapp/acoes";
import { botaoPrimario, campo } from "../ui";

type Numero = { nome: string; numero: string };

const exibir = (n: string) => {
  const m = n.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : n;
};

/** Até 4 números que podem enviar documentos. Campos controlados (o React limpa o form depois do envio). */
export function FormNumeros({ atuais }: { atuais: Numero[] }) {
  const [estado, acao, gravando] = useActionState(salvarNumeros, undefined);
  const [linhas, setLinhas] = useState(() =>
    Array.from({ length: 4 }, (_, i) => ({ nome: atuais[i]?.nome ?? "", numero: atuais[i] ? exibir(atuais[i].numero) : "" })),
  );
  const mudar = (i: number, campoAlterado: Partial<Numero>) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, ...campoAlterado } : l)));
  return (
    <form action={acao} className="space-y-2">
      {linhas.map((l, i) => (
        <div key={i} className="flex flex-wrap gap-2">
          <input name={`nome${i}`} value={l.nome} onChange={(e) => mudar(i, { nome: e.target.value })} placeholder="Nome" aria-label={`Nome ${i + 1}`} className={`${campo} w-44!`} />
          <input
            name={`numero${i}`}
            value={l.numero}
            onChange={(e) => mudar(i, { numero: e.target.value })}
            placeholder="(11) 98765-4321"
            inputMode="tel"
            aria-label={`Celular ${i + 1}`}
            className={`${campo} w-48!`}
          />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button disabled={gravando} className={botaoPrimario}>
          {gravando ? "Gravando…" : "Gravar números"}
        </button>
        {estado?.erro && <span className="text-sm text-red-700">{estado.erro}</span>}
        {estado?.ok && <span className="text-sm text-folha-700">{estado.ok}</span>}
      </div>
    </form>
  );
}

export function BotaoDescartar({ id }: { id: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => confirm("Descartar este documento? O arquivo será apagado.") && iniciar(() => descartarDocumento(id))}
      className="text-xs text-stone-500 hover:text-red-700 hover:underline"
    >
      descartar
    </button>
  );
}
