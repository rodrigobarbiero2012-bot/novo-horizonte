"use client";

import Link from "next/link";
import { useActionState } from "react";
import { acaoPrimeiroAcesso } from "./actions";

const campo =
  "mt-1 w-full rounded-md border border-stone-300 px-3 py-2 outline-none focus:border-folha-600 focus:ring-2 focus:ring-folha-100";

// Tela temporária: some depois que os dois sócios definirem a senha.
export default function PrimeiroAcessoPage() {
  const [estado, acao, enviando] = useActionState(acaoPrimeiroAcesso, undefined);

  return (
    <main className="flex min-h-screen items-center justify-center bg-folha-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center text-white">
          <h1 className="text-2xl font-semibold tracking-tight">Primeiro acesso</h1>
          <p className="mt-1 text-sm text-folha-100/80">Defina a sua senha do Novo Horizonte</p>
        </div>
        <form action={acao} className="space-y-4 rounded-xl bg-white p-6 shadow-xl">
          <label className="block">
            <span className="text-sm font-medium text-stone-700">E-mail cadastrado</span>
            <input name="email" type="email" autoComplete="username" required className={campo} />
          </label>
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
          <p className="text-center text-sm">
            <Link href="/login" className="text-folha-700 hover:underline">
              Já tenho senha
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
