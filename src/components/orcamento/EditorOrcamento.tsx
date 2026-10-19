"use client";

import { useState, useTransition } from "react";
import { salvarOrcamento, type EstadoOrcamento } from "@/app/(app)/orcamento/acoes";
import { lerValorBr } from "@/lib/contabil/lancamento";
import { MESES, reais, reaisCurto } from "@/lib/formato";
import { ajustar, distribuir, ehLinhaInvestimento, sinalDaLinha, somaLinhas, totaisMensais, type Matriz } from "@/lib/orcamento/calculo";
import { botaoPrimario, botaoSecundario, campo } from "../ui";

/** Linhas do editor: as da DRE (ex.: "custeioCafe") e as de investimento ("inv:<conta>"). */
export type GrupoEditor = { rotulo: string; linhas: { chave: string; rotulo: string }[] };
type Valores = Record<string, number[]>;

// Na tela o sócio digita receitas, gastos e investimentos positivos; a matriz guarda o sinal (gasto negativo).
const paraTexto = (centavos: number, linha: string) => {
  const v = centavos * sinalDaLinha(linha);
  if (v === 0) return "";
  return v % 100 === 0 ? reaisCurto(v) : reais(v);
};
const zeros = () => Array(12).fill(0) as number[];

/** Centavos com o sinal guardado; null se o texto for inválido. */
function lerCelula(texto: string, linha: string): number | null {
  const v = lerValorBr(texto);
  if (v === null) return 0;
  return Number.isNaN(v) ? null : v * sinalDaLinha(linha);
}

export function EditorOrcamento({
  ano,
  inicial,
  anoAnterior,
  grupos,
}: {
  ano: number;
  inicial: Valores;
  anoAnterior: Valores;
  grupos: GrupoEditor[];
}) {
  const linhas = grupos.flatMap((g) => g.linhas.map((l) => l.chave));
  const investimentos = linhas.filter(ehLinhaInvestimento);
  const textos = (m: Valores) => Object.fromEntries(linhas.map((l) => [l, (m[l] ?? zeros()).map((v) => paraTexto(v, l))])) as Record<string, string[]>;
  const [celulas, setCelulas] = useState(() => textos(inicial));
  const [ajustePct, setAjustePct] = useState("0");
  const [estado, setEstado] = useState<EstadoOrcamento>();
  const [alterado, setAlterado] = useState(false);
  const [gravando, iniciar] = useTransition();

  const matriz = Object.fromEntries(linhas.map((l) => [l, celulas[l].map((t) => lerCelula(t, l))])) as Record<string, (number | null)[]>;
  const invalido = linhas.some((l) => matriz[l].includes(null));
  const numerica = Object.fromEntries(linhas.map((l) => [l, matriz[l].map((v) => v ?? 0)])) as Valores;
  const resultado = totaisMensais(numerica as Matriz).resultado;
  const totalInvestimentos = somaLinhas(numerica, investimentos);
  const totalLinha = (l: string) => numerica[l].reduce((s, v) => s + v, 0);

  const mudar = (novo: Record<string, string[]>) => {
    setCelulas(novo);
    setAlterado(true);
    setEstado(undefined);
  };
  const mudarCelula = (l: string, mes: number, texto: string) => mudar({ ...celulas, [l]: celulas[l].map((t, i) => (i === mes ? texto : t)) });
  const distribuirTotal = (l: string, texto: string) => {
    const total = lerCelula(texto, l);
    if (total === null || total === totalLinha(l)) return;
    mudar({ ...celulas, [l]: distribuir(total).map((v) => paraTexto(v, l)) });
  };
  const preencherAnoAnterior = () => {
    const pct = Number(ajustePct.replace(",", "."));
    if (!Number.isFinite(pct)) return setEstado({ erro: "Ajuste inválido." });
    mudar(textos(ajustar(anoAnterior, pct)));
  };
  const gravar = () =>
    iniciar(async () => {
      const r = await salvarOrcamento(ano, numerica);
      setEstado(r);
      if (r?.ok) setAlterado(false);
    });

  // `campo` traz w-full, que numa tabela espremeria as células.
  const celula = `${campo.replace("w-full", "")} w-24 px-2 py-1 text-right tabular-nums`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-3 text-sm">
        <div className="flex items-end gap-2">
          <label className="block">
            <span className="text-xs text-stone-600">Ajuste sobre {ano - 1} (%)</span>
            <input value={ajustePct} onChange={(e) => setAjustePct(e.target.value)} inputMode="decimal" className={`${campo} mt-0.5 w-24!`} />
          </label>
          <button type="button" onClick={preencherAnoAnterior} className={botaoSecundario}>
            Preencher com o realizado de {ano - 1}
          </button>
        </div>
        <button type="button" onClick={() => mudar(textos({}))} className="px-2 py-2 text-stone-500 hover:text-red-700 hover:underline">
          Zerar
        </button>
        <span className="flex-1" />
        {estado?.erro && <span className="text-red-700">{estado.erro}</span>}
        {estado?.ok && <span className="text-folha-700">{estado.ok}</span>}
        {invalido && <span className="text-red-700">Há valores inválidos (em vermelho).</span>}
        <button type="button" disabled={gravando || invalido || !alterado} onClick={gravar} className={botaoPrimario}>
          {gravando ? "Gravando…" : "Gravar orçamento"}
        </button>
      </div>
      <p className="mb-3 text-xs text-stone-500">
        Digite receitas, gastos e investimentos em R$, sem sinal. Na coluna <strong>Total do ano</strong>, digite um valor e saia do campo para dividir igualmente nos 12
        meses. Preencher pelo ano anterior mantém a sazonalidade (colheita, adubação, etc.).
      </p>

      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-stone-500">
              <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-medium">R$</th>
              <th className="whitespace-nowrap px-1 py-2 text-right font-medium">Total do ano</th>
              {MESES.map((m) => (
                <th key={m} className="px-1 py-2 text-right font-medium">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => [
              <tr key={g.rotulo}>
                <td className="sticky left-0 z-10 bg-white px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-folha-700">{g.rotulo}</td>
                <td colSpan={13} />
              </tr>,
              ...g.linhas.map(({ chave, rotulo }) => {
                const total = paraTexto(totalLinha(chave), chave);
                return (
                  <tr key={chave}>
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white py-0.5 pl-6 pr-3">{rotulo}</td>
                    <td className="px-1 py-0.5">
                      <input
                        key={total}
                        defaultValue={total}
                        onBlur={(e) => distribuirTotal(chave, e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                        inputMode="decimal"
                        aria-label={`${rotulo} — total do ano`}
                        className={`${celula} w-28! bg-stone-50 font-medium`}
                      />
                    </td>
                    {celulas[chave].map((t, i) => (
                      <td key={i} className="px-1 py-0.5">
                        <input
                          value={t}
                          onChange={(e) => mudarCelula(chave, i, e.target.value)}
                          inputMode="decimal"
                          aria-label={`${rotulo} — ${MESES[i]}`}
                          className={`${celula} ${matriz[chave][i] === null ? "border-red-500 text-red-700" : ""}`}
                        />
                      </td>
                    ))}
                  </tr>
                );
              }),
            ])}
            <tr className="border-t border-stone-200 bg-folha-50 font-semibold">
              <td className="sticky left-0 z-10 bg-folha-50 px-3 py-2">Resultado orçado</td>
              <td className={`num px-3 py-2 ${resultado.reduce((s, v) => s + v, 0) < 0 ? "neg" : ""}`}>{reaisCurto(resultado.reduce((s, v) => s + v, 0))}</td>
              {resultado.map((v, i) => (
                <td key={i} className={`num px-3 py-2 ${v < 0 ? "neg" : ""}`}>
                  {reaisCurto(v)}
                </td>
              ))}
            </tr>
            {investimentos.length > 0 && (
              <tr className="font-medium text-stone-600">
                <td className="sticky left-0 z-10 bg-white px-3 py-2">Investimentos orçados</td>
                <td className="num px-3 py-2">{reaisCurto(-totalInvestimentos.reduce((s, v) => s + v, 0))}</td>
                {totalInvestimentos.map((v, i) => (
                  <td key={i} className="num px-3 py-2">
                    {reaisCurto(-v)}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
