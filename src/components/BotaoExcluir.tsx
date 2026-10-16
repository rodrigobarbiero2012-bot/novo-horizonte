"use client";

import { useTransition } from "react";

export function BotaoExcluir({ acao }: { acao: () => Promise<void> }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => {
        if (confirm("Excluir este lançamento? A exclusão fica registrada no histórico.")) iniciar(() => acao());
      }}
      className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      {pendente ? "Excluindo…" : "Excluir"}
    </button>
  );
}
