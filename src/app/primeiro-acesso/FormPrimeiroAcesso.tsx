"use client";

import { useActionState } from "react";
import { acaoPrimeiroAcesso } from "./actions";

const campo =
  "mt-1 w-full rounded-md border border-stone-300 px-3 py-2 outline-none focus:border-folha-600 focus:ring-2 focus:ring-folha-100";

export function FormPrimeiroAcesso({ convite }: { convite: string }) {
  const [estado, acao, enviando] = useActionState(acaoPrimeiroAcesso, undefined);
  return (
    <form action={acao} className="space-y-4 rounded-xl bg-white p-6 shadow-xl">
      <input type="hidden" name="convite" value={convite} />
      <label className="block">
        <span className="text-sm font-medium text-stone-700">Nova senha</span>
        <input name="senha" type="password" autoComplete="new-password" minLength={10} required className={campo} />
        <span className="mt-1 block text-xs text-stone-500">Mínimo de 10 caracteres.</span>
      </label>
      <label className="block">
        <span className="text-sm font-medium text-stone-700">Repita a senha</span>
        <input name="confirmacao" type="password" autoComplete="new-password" minLength={10} required className={campo} />
      </label>
      {estado?.erro && <p className="text-sm text-red-700">{estado.erro}</p>}
      <button
        disabled={enviando}
        className="w-full rounded-md bg-folha-700 py-2 font-medium text-white hover:bg-folha-800 disabled:opacity-60"
      >
        {enviando ? "Salvando…" : "Definir senha e entrar"}
      </button>
    </form>
  );
}
