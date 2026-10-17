"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import {
  conciliarAutomatico,
  conciliarManual,
  ignorarTransacao,
  importarExtrato,
  lancarTransacao,
  reabrirTransacao,
} from "@/app/(app)/conciliacao/acoes";
import { dataBr, reais } from "@/lib/formato";
import { botaoPrimario, botaoSecundario, campo } from "../ui";

type Conta = { id: string; nome: string; categoria: string };

export function UploadExtrato({ contaId }: { contaId: string }) {
  const [estado, acao, enviando] = useActionState(importarExtrato.bind(null, contaId), undefined);
  const [, iniciar] = useTransition();
  return (
    <form action={acao} className="flex flex-wrap items-center gap-3">
      <input
        type="file"
        name="arquivo"
        accept=".ofx,.OFX,application/x-ofx,application/ofx,text/plain"
        required
        className="max-w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-folha-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-folha-800 hover:file:bg-folha-100"
      />
      <button disabled={enviando} className={botaoPrimario}>
        {enviando ? "Importando…" : "Importar extrato"}
      </button>
      <button type="button" onClick={() => iniciar(() => conciliarAutomatico(contaId))} className={botaoSecundario}>
        Conciliar automaticamente
      </button>
      {estado?.erro && <span className="text-sm text-red-700">{estado.erro}</span>}
      {estado?.ok && <span className="text-sm text-folha-700">{estado.ok}</span>}
    </form>
  );
}

export type Pendente = {
  id: string;
  data: string;
  valorCentavos: number;
  descricao: string;
  candidatas: { id: string; data: string; historico: string }[];
};

export function LinhaPendente({ t, contas, contaId }: { t: Pendente; contas: Conta[]; contaId: string }) {
  const [modo, setModo] = useState<"nada" | "lancar">("nada");
  const [escolhida, setEscolhida] = useState(t.candidatas[0]?.id ?? "");
  const [pendente, iniciar] = useTransition();
  const [estado, acao, enviando] = useActionState(lancarTransacao.bind(null, t.id), undefined);
  const porCategoria = Map.groupBy(
    contas.filter((c) => c.id !== contaId),
    (c) => c.categoria,
  );
  const entrada = t.valorCentavos > 0;

  return (
    <li className="border-b border-stone-100 py-2.5 last:border-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="w-20 shrink-0 tabular-nums text-sm text-stone-600">{dataBr(t.data)}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-stone-800" title={t.descricao}>
          {t.descricao}
        </span>
        <span className={`num w-28 text-sm font-medium ${entrada ? "text-folha-700" : "neg"}`}>
          {entrada ? "+" : ""}
          {reais(t.valorCentavos)}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-24 text-xs">
        {t.candidatas.length > 0 && (
          <>
            <select value={escolhida} onChange={(e) => setEscolhida(e.target.value)} className={`${campo} w-auto max-w-xs py-1 text-xs`}>
              {t.candidatas.map((c) => (
                <option key={c.id} value={c.id}>
                  {dataBr(c.data)} · {c.historico.slice(0, 50)}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={pendente || !escolhida}
              onClick={() => iniciar(() => conciliarManual(t.id, escolhida))}
              className="rounded-md bg-folha-700 px-2.5 py-1 font-medium text-white hover:bg-folha-800 disabled:opacity-50"
            >
              Conciliar
            </button>
            <span className="text-stone-400">ou</span>
          </>
        )}
        <button type="button" onClick={() => setModo(modo === "lancar" ? "nada" : "lancar")} className="rounded-md border border-folha-600 px-2.5 py-1 font-medium text-folha-700 hover:bg-folha-50">
          Lançar
        </button>
        <button type="button" disabled={pendente} onClick={() => iniciar(() => ignorarTransacao(t.id))} className="px-1.5 py-1 text-stone-500 hover:text-stone-800 hover:underline">
          Ignorar
        </button>
        {t.candidatas.length === 0 && <span className="text-amber-700">sem lançamento correspondente no sistema</span>}
      </div>
      {modo === "lancar" && !estado?.ok && (
        <form action={acao} className="mt-2 ml-24 flex flex-wrap items-end gap-2 rounded-md bg-stone-50 p-3">
          <label className="block">
            <span className="text-xs text-stone-600">{entrada ? "Origem do dinheiro (crédito)" : "Para onde foi (débito)"}</span>
            <select name="contaId" required defaultValue="" className={`${campo} mt-0.5 w-64`}>
              <option value="" disabled>
                Escolha a conta…
              </option>
              {[...porCategoria].map(([cat, cs]) => (
                <optgroup key={cat} label={cat}>
                  {cs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="block min-w-60 flex-1">
            <span className="text-xs text-stone-600">Histórico</span>
            <input name="historico" required defaultValue={t.descricao} className={`${campo} mt-0.5`} />
          </label>
          <button disabled={enviando} className="rounded-md bg-folha-700 px-3 py-2 text-sm font-medium text-white hover:bg-folha-800 disabled:opacity-50">
            {enviando ? "Gravando…" : "Gravar e conciliar"}
          </button>
          {estado?.erro && <span className="text-xs text-red-700">{estado.erro}</span>}
        </form>
      )}
    </li>
  );
}

export function LinhaTratada({
  t,
}: {
  t: { id: string; data: string; valorCentavos: number; descricao: string; status: string; lancamentoId: string | null };
}) {
  const [pendente, iniciar] = useTransition();
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 py-1.5 text-sm">
      <span className="w-20 tabular-nums text-stone-500">{dataBr(t.data)}</span>
      <span className="min-w-0 flex-1 truncate text-stone-700" title={t.descricao}>
        {t.descricao}
      </span>
      <span className="num w-28">{reais(t.valorCentavos)}</span>
      {t.lancamentoId ? (
        <Link href={`/lancamentos/${t.lancamentoId}`} className="text-xs text-folha-700 hover:underline">
          lançamento
        </Link>
      ) : (
        <span className="text-xs text-stone-400">{t.status === "IGNORADA" ? "ignorada" : ""}</span>
      )}
      <button type="button" disabled={pendente} onClick={() => iniciar(() => reabrirTransacao(t.id))} className="text-xs text-stone-500 hover:text-red-700 hover:underline">
        desfazer
      </button>
    </li>
  );
}
