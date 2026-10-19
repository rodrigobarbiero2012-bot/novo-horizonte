"use client";

import { useActionState, useState, useTransition } from "react";
import { enviarTeste, salvarDestinatarios, type EstadoLembrete } from "@/app/(app)/lembretes/acoes";
import { botaoPrimario, botaoSecundario, campo } from "../ui";

function Retorno({ estado }: { estado: EstadoLembrete }) {
  if (estado?.erro) return <span className="text-sm text-red-700">{estado.erro}</span>;
  if (estado?.ok) return <span className="text-sm text-folha-700">{estado.ok}</span>;
  return null;
}

export function FormDestinatarios({ atuais }: { atuais: string[] }) {
  const [emails, setEmails] = useState(atuais.join("\n"));
  const [estado, acao, gravando] = useActionState(salvarDestinatarios, undefined);
  return (
    <form action={acao} className="space-y-2">
      <textarea name="emails" rows={3} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="um e-mail por linha" className={`${campo} font-mono text-xs`} />
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={gravando} className={botaoPrimario}>
          {gravando ? "Gravando…" : "Gravar"}
        </button>
        <Retorno estado={estado} />
      </div>
    </form>
  );
}

export function BotaoTeste({ desabilitado }: { desabilitado: boolean }) {
  const [estado, setEstado] = useState<EstadoLembrete>();
  const [enviando, iniciar] = useTransition();
  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <button type="button" disabled={desabilitado || enviando} onClick={() => iniciar(async () => setEstado(await enviarTeste()))} className={botaoSecundario}>
        {enviando ? "Enviando…" : "Enviar um teste para mim"}
      </button>
      <Retorno estado={estado} />
    </span>
  );
}
