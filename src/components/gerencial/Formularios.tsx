"use client";

import { useActionState, useState } from "react";
import { salvarRateio, salvarTaxas } from "@/app/(app)/resultado-atividade/acoes";
import { reaisCurto } from "@/lib/formato";
import { ATIVIDADES_RATEIO, type AtividadeRateio } from "@/lib/gerencial/rateio";
import { botaoPrimario, campo } from "../ui";

const campoCurto = `${campo.replace("w-full", "")} w-20 px-2 py-1 text-right tabular-nums`;

function Retorno({ estado }: { estado: { erro?: string; ok?: string } | undefined }) {
  if (estado?.erro) return <span className="text-sm text-red-700">{estado.erro}</span>;
  if (estado?.ok) return <span className="text-sm text-folha-700">{estado.ok}</span>;
  return null;
}

export type LinhaDepreciacao = {
  contaId: string;
  nome: string;
  atividade: string;
  taxa: number;
  definida: boolean;
  custo: number;
  doAno: number;
  acumulada: number;
  liquido: number;
};

/** Tabela de depreciação por conta, com a taxa editável. */
export function TabelaDepreciacao({ linhas, ano }: { linhas: LinhaDepreciacao[]; ano: number }) {
  const [estado, acao, gravando] = useActionState(salvarTaxas, undefined);
  // Campos controlados: o React limpa formulários não controlados depois de cada envio.
  const [taxas, setTaxas] = useState(() => Object.fromEntries(linhas.map((l) => [l.contaId, String(l.taxa).replace(".", ",")])));
  const total = (k: "custo" | "doAno" | "acumulada" | "liquido") => linhas.reduce((s, l) => s + l[k], 0);
  return (
    <form action={acao}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-stone-500">
              <th className="px-3 py-2 text-left font-medium">Conta</th>
              <th className="px-3 py-2 text-left font-medium">Atividade</th>
              <th className="num px-3 py-2 font-medium">Custo em 31/12/{ano}</th>
              <th className="num px-3 py-2 font-medium">Taxa (% a.a.)</th>
              <th className="num px-3 py-2 font-medium">Depreciação {ano}</th>
              <th className="num px-3 py-2 font-medium">Acumulada</th>
              <th className="num px-3 py-2 font-medium">Valor líquido</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.contaId} className="border-b border-stone-100">
                <td className="whitespace-nowrap px-3 py-1.5">{l.nome.replace(/^Imobilizado - /, "")}</td>
                <td className="px-3 py-1.5 text-stone-500">{l.atividade === "N/A" ? "uso geral (rateado)" : l.atividade}</td>
                <td className="num px-3 py-1.5">{reaisCurto(l.custo)}</td>
                <td className="px-3 py-1 text-right">
                  <input
                    name={`taxa:${l.contaId}`}
                    value={taxas[l.contaId] ?? ""}
                    onChange={(e) => setTaxas((t) => ({ ...t, [l.contaId]: e.target.value }))}
                    inputMode="decimal"
                    aria-label={`Taxa de ${l.nome}`}
                    className={`${campoCurto} ${l.definida ? "" : "border-amber-400 bg-amber-50"}`}
                    title={l.definida ? undefined : "Sugestão do sistema — grave para confirmar"}
                  />
                </td>
                <td className="num px-3 py-1.5 font-medium">{reaisCurto(l.doAno)}</td>
                <td className="num px-3 py-1.5">{reaisCurto(l.acumulada)}</td>
                <td className="num px-3 py-1.5">{reaisCurto(l.liquido)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="px-3 py-2" colSpan={2}>
                Total
              </td>
              <td className="num px-3 py-2">{reaisCurto(total("custo"))}</td>
              <td />
              <td className="num px-3 py-2">{reaisCurto(total("doAno"))}</td>
              <td className="num px-3 py-2">{reaisCurto(total("acumulada"))}</td>
              <td className="num px-3 py-2">{reaisCurto(total("liquido"))}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button disabled={gravando} className={botaoPrimario}>
          {gravando ? "Gravando…" : "Gravar taxas"}
        </button>
        <Retorno estado={estado} />
      </div>
    </form>
  );
}

/** Percentuais fixos de rateio por atividade (ex.: pela área de cada uma). */
export function FormRateio({ atual }: { atual: Record<AtividadeRateio, number> }) {
  const [estado, acao, gravando] = useActionState(salvarRateio, undefined);
  const [pct, setPct] = useState(() => Object.fromEntries(ATIVIDADES_RATEIO.map((a) => [a, String(atual[a]).replace(".", ",")])));
  const soma = ATIVIDADES_RATEIO.reduce((s, a) => s + (Number(pct[a].replace(",", ".")) || 0), 0);
  return (
    <form action={acao} className="flex flex-wrap items-end gap-3">
      {ATIVIDADES_RATEIO.map((a) => (
        <label key={a} className="block">
          <span className="text-xs text-stone-600">{a} (%)</span>
          <input
            name={a}
            value={pct[a]}
            onChange={(e) => setPct((p) => ({ ...p, [a]: e.target.value }))}
            inputMode="decimal"
            className={`${campoCurto} mt-0.5 block`}
          />
        </label>
      ))}
      <span className={`pb-2 text-sm tabular-nums ${Math.abs(soma - 100) < 0.01 ? "text-folha-700" : "text-amber-700"}`}>
        soma {soma.toLocaleString("pt-BR")}%
      </span>
      <button disabled={gravando} className={botaoPrimario}>
        {gravando ? "Gravando…" : "Gravar percentuais"}
      </button>
      <Retorno estado={estado} />
    </form>
  );
}
