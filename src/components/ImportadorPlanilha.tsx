"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { analisarPlanilha, importarLancamentos, type LinhaPrevia } from "@/app/(app)/lancamentos/importar/acoes";
import { dataBr, reais } from "@/lib/formato";
import { botaoPrimario, botaoSecundario, Cartao } from "./ui";

type Estado =
  | { etapa: "escolher"; erro?: string }
  | { etapa: "previa"; arquivo: string; linhas: LinhaPrevia[]; erro?: string }
  | { etapa: "feito"; criados: number };

export function ImportadorPlanilha() {
  const [estado, setEstado] = useState<Estado>({ etapa: "escolher" });
  const [incluirDuplicadas, setIncluirDuplicadas] = useState(false);
  const [ocupado, iniciar] = useTransition();

  const analisar = (arquivo: File) =>
    iniciar(async () => {
      const form = new FormData();
      form.set("arquivo", arquivo);
      try {
        const r = await analisarPlanilha(form);
        setEstado(r.ok ? { etapa: "previa", arquivo: r.arquivo, linhas: r.linhas } : { etapa: "escolher", erro: r.erro });
        setIncluirDuplicadas(false);
      } catch {
        setEstado({ etapa: "escolher", erro: "Não foi possível enviar o arquivo. Verifique a conexão e tente de novo." });
      }
    });

  if (estado.etapa === "feito") {
    return (
      <Cartao className="max-w-xl p-6">
        <p className="mb-4 font-medium text-folha-800">✓ {estado.criados} lançamento{estado.criados > 1 ? "s" : ""} importado{estado.criados > 1 ? "s" : ""}.</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/lancamentos" className={botaoPrimario}>
            Ver lançamentos
          </Link>
          <button type="button" onClick={() => setEstado({ etapa: "escolher" })} className={botaoSecundario}>
            Importar outra planilha
          </button>
        </div>
      </Cartao>
    );
  }

  if (estado.etapa === "escolher") {
    return (
      <Cartao className="max-w-2xl p-6">
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-stone-700">
          <li>
            Baixe o{" "}
            <a href="/api/exportar/modelo-importacao" download className="font-medium text-folha-700 hover:underline">
              modelo de planilha
            </a>{" "}
            — a aba “Contas” lista os nomes exatos do plano de contas.
          </li>
          <li>Preencha uma linha por lançamento: data, histórico, conta débito, conta crédito e valor.</li>
          <li>Envie aqui: o sistema mostra a prévia e só grava depois que você confirmar.</li>
        </ol>
        <label className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 px-6 py-10 text-center hover:border-folha-600 hover:bg-stone-50 ${ocupado ? "pointer-events-none opacity-60" : ""}`}>
          <span className="text-3xl" aria-hidden>
            📊
          </span>
          <span className="mt-2 font-medium text-stone-800">{ocupado ? "Lendo a planilha…" : "Escolher planilha (.xlsx)"}</span>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) analisar(f);
              e.target.value = "";
            }}
          />
        </label>
        {estado.erro && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{estado.erro}</p>}
      </Cartao>
    );
  }

  const { linhas } = estado;
  const comErro = linhas.filter((l) => l.erros.length);
  const duplicadas = linhas.filter((l) => !l.erros.length && l.duplicada);
  const aImportar = linhas.filter((l) => !l.erros.length && (incluirDuplicadas || !l.duplicada));
  const total = aImportar.reduce((s, l) => s + l.valorCentavos, 0);

  const importar = () =>
    iniciar(async () => {
      const r = await importarLancamentos(
        estado.arquivo,
        aImportar.map((l) => ({ ...l, duplicada: undefined })),
      );
      setEstado(r.ok ? { etapa: "feito", criados: r.criados } : { ...estado, erro: r.erro });
    });

  return (
    <div className="space-y-4">
      <Cartao className="p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="font-medium text-stone-800">{estado.arquivo}</span>
          <span className="text-folha-700">{aImportar.length} a importar · R$ {reais(total)}</span>
          {comErro.length > 0 && <span className="text-red-700">{comErro.length} com erro (ficam de fora)</span>}
          {duplicadas.length > 0 && (
            <label className="flex items-center gap-1.5 text-amber-800">
              <input type="checkbox" checked={incluirDuplicadas} onChange={(e) => setIncluirDuplicadas(e.target.checked)} />
              {duplicadas.length} já existe{duplicadas.length > 1 ? "m" : ""} no sistema — importar mesmo assim
            </label>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" disabled={ocupado || !aImportar.length} onClick={importar} className={botaoPrimario}>
            {ocupado ? "Importando…" : `Importar ${aImportar.length} lançamento${aImportar.length === 1 ? "" : "s"}`}
          </button>
          <button type="button" disabled={ocupado} onClick={() => setEstado({ etapa: "escolher" })} className={botaoSecundario}>
            Cancelar
          </button>
          {estado.erro && <span className="text-sm text-red-700">{estado.erro}</span>}
        </div>
      </Cartao>

      <Cartao className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-stone-500">
              <th className="px-3 py-2 font-medium">Linha</th>
              <th className="px-3 py-2 font-medium">Data</th>
              <th className="px-3 py-2 font-medium">Histórico</th>
              <th className="px-3 py-2 font-medium">Débito</th>
              <th className="px-3 py-2 font-medium">Crédito</th>
              <th className="num px-3 py-2 font-medium">Valor</th>
              <th className="px-3 py-2 font-medium">Situação</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.linha} className={`border-b border-stone-100 ${l.erros.length ? "bg-red-50/60" : l.duplicada ? "bg-amber-50/60" : ""}`}>
                <td className="px-3 py-1.5 tabular-nums text-stone-500">{l.linha}</td>
                <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{l.data ? dataBr(l.data) : "—"}</td>
                <td className="max-w-xs truncate px-3 py-1.5" title={l.historico}>
                  {l.historico}
                </td>
                <td className={`max-w-[14rem] truncate px-3 py-1.5 ${l.debitoId ? "" : "text-red-700"}`} title={l.debito}>
                  {l.debito}
                </td>
                <td className={`max-w-[14rem] truncate px-3 py-1.5 ${l.creditoId ? "" : "text-red-700"}`} title={l.credito}>
                  {l.credito}
                </td>
                <td className="num px-3 py-1.5">{l.valorCentavos ? reais(l.valorCentavos) : "—"}</td>
                <td className="px-3 py-1.5 text-xs">
                  {l.erros.length ? (
                    <span className="text-red-700">{l.erros.join("; ")}</span>
                  ) : l.duplicada ? (
                    <span className="text-amber-800">já existe</span>
                  ) : (
                    <span className="text-folha-700">ok</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Cartao>
    </div>
  );
}
