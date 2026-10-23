"use client";

import { useActionState, useState } from "react";
import { salvarRateio, salvarTaxas, salvarValorTerra } from "@/app/(app)/resultado-atividade/acoes";
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

/** Tabela de depreciaÃ§Ã£o por conta, com a taxa editÃ¡vel. */
export function TabelaDepreciacao({ linhas, ano }: { linhas: LinhaDepreciacao[]; ano: number }) {
  const [estado, acao, gravando] = useActionState(salvarTaxas, undefined);
  // Campos controlados: o React limpa formulÃ¡rios nÃ£o controlados depois de cada envio.
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
              <th className="num px-3 py-2 font-medium">DepreciaÃ§Ã£o {ano}</th>
              <th className="num px-3 py-2 font-medium">Acumulada</th>
              <th className="num px-3 py-2 font-medium">Valor lÃ­quido</th>
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
                    title={l.definida ? undefined : "SugestÃ£o do sistema â€” grave para confirmar"}
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
          {gravando ? "Gravandoâ€¦" : "Gravar taxas"}
        </button>
        <Retorno estado={estado} />
      </div>
    </form>
  );
}

/** Percentuais fixos de rateio por atividade (ex.: pela Ã¡rea de cada uma). */
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
        {gravando ? "Gravandoâ€¦" : "Gravar percentuais"}
      </button>
      <Retorno estado={estado} />
    </form>
  );
}

/** Valor de mercado do sítio (terra e benfeitorias), usado como capital do café na análise por cultivo. */
export function FormValorTerra({ valor, data, hoje }: { valor: string; data: string; hoje: string }) {
  const [estado, acao, gravando] = useActionState(salvarValorTerra, undefined);
  const [campos, setCampos] = useState({ valor, data: data || hoje });
  return (
    <form action={acao} className="flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="text-xs text-stone-600">Valor de mercado do sítio (R$)</span>
        <input
          name="valor"
          value={campos.valor}
          onChange={(e) => setCampos((c) => ({ ...c, valor: e.target.value }))}
          inputMode="decimal"
          placeholder="0,00"
          className={`${campo} mt-0.5 w-48! text-right tabular-nums`}
        />
      </label>
      <label className="block">
        <span className="text-xs text-stone-600">Estimado em</span>
        <input
          name="data"
          type="date"
          value={campos.data}
          onChange={(e) => setCampos((c) => ({ ...c, data: e.target.value }))}
          className={`${campo} mt-0.5 w-40!`}
        />
      </label>
      <button disabled={gravando} className={botaoPrimario}>
        {gravando ? "Gravando…" : "Gravar"}
      </button>
      <Retorno estado={estado} />
    </form>
  );
}