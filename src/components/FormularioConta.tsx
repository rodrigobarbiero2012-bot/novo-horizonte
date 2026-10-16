"use client";

import { useActionState } from "react";
import { ATIVIDADES, CATEGORIAS } from "@/lib/contabil/tipos";
import { botaoPrimario, campo } from "./ui";
import type { EstadoConta } from "@/app/(app)/contas/acoes";

export function FormularioConta({ acao }: { acao: (e: EstadoConta, f: FormData) => Promise<EstadoConta> }) {
  const [estado, acaoForm, enviando] = useActionState(acao, undefined);
  return (
    <form action={acaoForm} className="grid gap-3 sm:grid-cols-[2fr_1.5fr_1fr_auto] sm:items-end">
      <label className="block">
        <span className="text-xs font-medium text-stone-600">Nome</span>
        <input name="nome" required placeholder="Ex.: Custeio Adubos - Maracujá" className={`${campo} mt-1`} />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-stone-600">Categoria</span>
        <select name="categoria" required defaultValue="" className={`${campo} mt-1`}>
          <option value="" disabled>
            Escolha…
          </option>
          {CATEGORIAS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-xs font-medium text-stone-600">Atividade</span>
        <select name="atividade" required defaultValue="" className={`${campo} mt-1`}>
          <option value="" disabled>
            Escolha…
          </option>
          {ATIVIDADES.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </label>
      <button disabled={enviando} className={botaoPrimario}>
        Criar conta
      </button>
      {estado?.erro && <p className="text-sm text-red-700 sm:col-span-4">{estado.erro}</p>}
      {estado?.ok && <p className="text-sm text-folha-700 sm:col-span-4">{estado.ok}</p>}
    </form>
  );
}
