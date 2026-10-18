"use client";

import { useActionState, useState } from "react";
import type { EstadoCotacao } from "@/app/(app)/acoes-cotacao";
import { useCampos } from "./useCampos";

type Props = { produto: string; acao: (e: EstadoCotacao, f: FormData) => Promise<EstadoCotacao> };

/** Formulário compacto dentro do cartão da cotação: abre ao clicar em "Registrar preço". */
export function FormularioCotacaoManual({ produto, acao }: Props) {
  const { vincular, limpar } = useCampos(() => ({ valor: "", data: new Date().toLocaleDateString("sv-SE") }));
  const [estado, acaoForm, enviando] = useActionState(async (e: EstadoCotacao, f: FormData) => {
    const r = await acao(e, f);
    if (r?.ok) limpar();
    return r;
  }, undefined);
  const [aberto, setAberto] = useState(false);
  const [ultimoOk, setUltimoOk] = useState<string | undefined>();
  // Fecha o formulário quando um registro novo dá certo; em caso de erro, continua aberto mostrando a mensagem.
  if (estado?.ok && estado.ok !== ultimoOk) {
    setUltimoOk(estado.ok);
    setAberto(false);
  }
  if (!aberto) {
    return (
      <div className="mt-2">
        <button type="button" onClick={() => setAberto(true)} className="text-xs font-medium text-folha-700 hover:underline">
          Registrar preço
        </button>
        {estado?.ok && <p className="mt-1 text-xs text-folha-700">{estado.ok}</p>}
      </div>
    );
  }
  return (
    <form action={acaoForm} className="mt-2 space-y-1.5">
      <input type="hidden" name="produto" value={produto} />
      <div className="flex gap-1.5">
        <input
          {...vincular("valor")}
          inputMode="decimal"
          placeholder="R$/kg"
          required
          autoFocus
          className="w-20 rounded border border-stone-300 px-2 py-1 text-xs outline-none focus:border-folha-600"
          aria-label="Preço em R$ por kg"
        />
        <input
          {...vincular("data")}
          type="date"
          required
          className="min-w-0 flex-1 rounded border border-stone-300 px-1.5 py-1 text-xs outline-none focus:border-folha-600"
          aria-label="Data do preço"
        />
      </div>
      <div className="flex items-center gap-2">
        <button disabled={enviando} className="rounded bg-folha-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-folha-800 disabled:opacity-50">
          Salvar
        </button>
        <button type="button" onClick={() => setAberto(false)} className="text-xs text-stone-500 hover:underline">
          Cancelar
        </button>
      </div>
      {estado?.erro && <p className="text-xs text-red-700">{estado.erro}</p>}
    </form>
  );
}
