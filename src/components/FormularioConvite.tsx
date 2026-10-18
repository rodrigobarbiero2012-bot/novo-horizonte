"use client";

import { useActionState, useState } from "react";
import { botaoPrimario, botaoSecundario, campo } from "./ui";
import { useCampos } from "./useCampos";
import type { EstadoConvite } from "@/app/(app)/convites/acoes";

export function FormularioConvite({ acao }: { acao: (e: EstadoConvite, f: FormData) => Promise<EstadoConvite> }) {
  const { vincular, limpar } = useCampos({ nome: "", email: "" });
  const [estado, acaoForm, enviando] = useActionState(async (e: EstadoConvite, f: FormData) => {
    const r = await acao(e, f);
    if (r?.link) limpar();
    return r;
  }, undefined);
  const [copiado, setCopiado] = useState(false);

  return (
    <div className="space-y-4">
      <form action={acaoForm} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block">
          <span className="text-xs font-medium text-stone-600">Nome</span>
          <input {...vincular("nome")} required className={`${campo} mt-1`} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-stone-600">E-mail</span>
          <input {...vincular("email")} type="email" required className={`${campo} mt-1`} />
        </label>
        <button disabled={enviando} className={botaoPrimario}>
          {enviando ? "Gerando…" : "Gerar link de convite"}
        </button>
      </form>
      {estado?.erro && <p className="text-sm text-red-700">{estado.erro}</p>}
      {estado?.link && (
        <div className="rounded-lg border border-folha-100 bg-folha-50 p-4 text-sm">
          <p className="mb-2 font-medium text-folha-800">Link de convite para {estado.nome} — vale por 72 horas e funciona uma vez:</p>
          <p className="break-all rounded bg-white px-3 py-2 font-mono text-xs text-stone-700">{estado.link}</p>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(estado.link!).then(() => setCopiado(true))}
            className={`${botaoSecundario} mt-3`}
          >
            {copiado ? "Copiado ✓" : "Copiar link"}
          </button>
          <p className="mt-2 text-xs text-stone-500">
            Envie direto para a pessoa. Este link não aparece de novo; se perder, gere outro (o anterior deixa de valer).
          </p>
        </div>
      )}
    </div>
  );
}
