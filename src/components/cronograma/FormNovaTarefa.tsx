"use client";

import { useActionState } from "react";
import type { EstadoTarefa } from "@/app/(app)/cronograma/acoes";
import { botaoPrimario, campo } from "../ui";
import { cancelarReset, useCampos } from "../useCampos";
import { MESES_CURTOS } from "./situacoes";

type Props = { etapas: string[]; acao: (e: EstadoTarefa, f: FormData) => Promise<EstadoTarefa> };

export function FormNovaTarefa({ etapas, acao }: Props) {
  const { vincular, limpar } = useCampos(() => {
    const mes = String(new Date().getMonth() + 1);
    return { titulo: "", etapa: "", mesInicio: mes, mesFim: mes };
  });
  const [estado, acaoForm, enviando] = useActionState(async (e: EstadoTarefa, f: FormData) => {
    const r = await acao(e, f);
    if (r?.ok) limpar();
    return r;
  }, undefined);

  return (
    <form action={acaoForm} onReset={cancelarReset} className="grid gap-2 sm:grid-cols-[2fr_1.2fr_5.5rem_5.5rem_auto] sm:items-end">
      <label className="block">
        <span className="text-xs font-medium text-stone-600">Nova tarefa</span>
        <input {...vincular("titulo")} required placeholder="Ex.: Aplicação de boro via foliar" className={`${campo} mt-1`} />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-stone-600">Etapa</span>
        <input {...vincular("etapa")} required list="etapas-cronograma" placeholder="Escolha ou digite" className={`${campo} mt-1`} />
        <datalist id="etapas-cronograma">
          {etapas.map((e) => (
            <option key={e} value={e} />
          ))}
        </datalist>
      </label>
      <label className="block">
        <span className="text-xs font-medium text-stone-600">De</span>
        <select {...vincular("mesInicio")} className={`${campo} mt-1`}>
          {MESES_CURTOS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-xs font-medium text-stone-600">Até</span>
        <select {...vincular("mesFim")} className={`${campo} mt-1`}>
          {MESES_CURTOS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <button disabled={enviando} className={botaoPrimario}>
        Adicionar
      </button>
      {estado?.erro && <p className="text-sm text-red-700 sm:col-span-5">{estado.erro}</p>}
      {estado?.ok && <p className="text-sm text-folha-700 sm:col-span-5">{estado.ok}</p>}
    </form>
  );
}
