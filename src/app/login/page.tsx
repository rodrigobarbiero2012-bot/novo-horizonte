"use client";

import { useActionState } from "react";
import { acaoEntrar } from "./actions";

export default function LoginPage() {
  const [estado, acao, enviando] = useActionState(acaoEntrar, undefined);

  return (
    <main className="flex min-h-screen items-center justify-center bg-folha-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center text-white">
          <Marca />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Novo Horizonte</h1>
          <p className="mt-1 text-sm text-folha-100/80">Gestão do sítio</p>
        </div>
        <form action={acao} className="space-y-4 rounded-xl bg-white p-6 shadow-xl">
          <label className="block">
            <span className="text-sm font-medium text-stone-700">E-mail</span>
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 outline-none focus:border-folha-600 focus:ring-2 focus:ring-folha-100"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-stone-700">Senha</span>
            <input
              name="senha"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 outline-none focus:border-folha-600 focus:ring-2 focus:ring-folha-100"
            />
          </label>
          {estado?.erro && <p className="text-sm text-red-700">{estado.erro}</p>}
          <button
            disabled={enviando}
            className="w-full rounded-md bg-folha-700 py-2 font-medium text-white hover:bg-folha-800 disabled:opacity-60"
          >
            {enviando ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}

function Marca() {
  // Ramo de café estilizado: duas folhas e um grão.
  return (
    <svg viewBox="0 0 48 48" className="mx-auto h-12 w-12" aria-hidden>
      <path d="M24 42c0-12 4-22 14-30" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M30 22c-8-1-13 3-14 10 8 1 13-3 14-10z" fill="#7fb895" />
      <path d="M36 13c-7-2-12 1-14 7 7 2 12-1 14-7z" fill="#a8d1b4" />
      <ellipse cx="17" cy="16" rx="5" ry="6.5" fill="#c0703a" transform="rotate(-25 17 16)" />
      <path d="M15 11.5c2.5 2.5 2.5 6.5 0 9" stroke="#7a3f17" strokeWidth="1.2" fill="none" transform="rotate(-25 17 16)" />
    </svg>
  );
}
