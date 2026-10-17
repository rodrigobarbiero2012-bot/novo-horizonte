"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { lerValorBr } from "@/lib/contabil/lancamento";
import { botaoPrimario, botaoSecundario, campo } from "./ui";
import type { EstadoFormulario } from "@/app/(app)/lancamentos/acoes";

type Conta = { id: string; nome: string; categoria: string };

export type LinhaForm = {
  contaId: string;
  debito: string;
  credito: string;
  data?: string;
  historico?: string;
  fiscal?: "s" | "n" | "";
  linhaPlanilha?: number | null;
};

type Props = {
  contas: Conta[];
  acao: (estado: EstadoFormulario, form: FormData) => Promise<EstadoFormulario>;
  inicial?: { data: string; historico: string; linhas: LinhaForm[] };
  /** Editando um lançamento existente (senão é um lançamento novo, mesmo vindo pré-preenchido). */
  edicao?: boolean;
  /** Origem gravada no lançamento novo: "MANUAL" (padrão) ou "DOCUMENTO" (lido de boleto/nota). */
  origem?: "MANUAL" | "DOCUMENTO";
  /** Chamado depois de gravar um lançamento novo, com o id criado. */
  aoGravar?: (id: string) => void;
  /** Mostra data e histórico por linha (lançamentos da planilha que têm pernas em datas diferentes). */
  detalharLinhas?: boolean;
  textoBotao?: string;
};

const linhaVazia = (): LinhaForm => ({ contaId: "", debito: "", credito: "" });
const hoje = () => new Date().toLocaleDateString("sv-SE"); // yyyy-mm-dd no fuso local

const centavos = (t: string) => {
  const v = lerValorBr(t);
  return v === null || Number.isNaN(v) ? 0 : v;
};
const formatar = (c: number) => (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function FormularioLancamento({
  contas,
  acao,
  inicial,
  edicao = false,
  origem = "MANUAL",
  aoGravar,
  detalharLinhas = false,
  textoBotao = "Gravar lançamento",
}: Props) {
  const [estado, acaoForm, enviando] = useActionState(acao, undefined);
  const [data, setData] = useState(inicial?.data ?? hoje());
  const [historico, setHistorico] = useState(inicial?.historico ?? "");
  const [linhas, setLinhas] = useState<LinhaForm[]>(inicial?.linhas ?? [linhaVazia(), linhaVazia()]);
  const [ultimoOk, setUltimoOk] = useState<string | undefined>();

  // Depois de gravar um lançamento novo, limpa o formulário para o próximo.
  if (!edicao && estado?.ok && estado.ok !== ultimoOk) {
    setUltimoOk(estado.ok);
    setHistorico("");
    setLinhas([linhaVazia(), linhaVazia()]);
  }
  useEffect(() => {
    if (!edicao && estado?.ok) aoGravar?.(estado.ok);
  }, [edicao, estado, aoGravar]);

  const totalDebito = linhas.reduce((s, l) => s + centavos(l.debito), 0);
  const totalCredito = linhas.reduce((s, l) => s + centavos(l.credito), 0);
  const diferenca = totalDebito - totalCredito;

  const alterar = (i: number, campoAlterado: Partial<LinhaForm>) =>
    setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, ...campoAlterado } : l)));

  // Com duas linhas, digitar o débito da primeira já preenche o crédito da segunda (e vice-versa).
  const completarContrapartida = (i: number) => {
    if (linhas.length !== 2) return;
    const outra = linhas[1 - i];
    if (outra.debito || outra.credito) return;
    const l = linhas[i];
    if (l.debito) alterar(1 - i, { credito: l.debito });
    else if (l.credito) alterar(1 - i, { debito: l.credito });
  };

  const porCategoria = Map.groupBy(contas, (c) => c.categoria);

  return (
    <form action={acaoForm} className="space-y-5">
      {!edicao && <input type="hidden" name="origem" value={origem} />}
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <label className="block">
          <span className="text-sm font-medium text-stone-700">Data</span>
          <input type="date" name="data" value={data} onChange={(e) => setData(e.target.value)} required className={`${campo} mt-1`} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-stone-700">Histórico</span>
          <input
            name="historico"
            value={historico}
            onChange={(e) => setHistorico(e.target.value)}
            placeholder="Ex.: pgto NF 13866 Pulvermaq — manutenção do trator"
            required
            className={`${campo} mt-1`}
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-stone-200">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-stone-500">
            <tr>
              {detalharLinhas && <th className="px-2 py-2 text-left font-medium">Data</th>}
              <th className="px-2 py-2 text-left font-medium">Conta</th>
              {detalharLinhas && <th className="px-2 py-2 text-left font-medium">Histórico da linha</th>}
              <th className="w-36 px-2 py-2 text-right font-medium">Débito</th>
              <th className="w-36 px-2 py-2 text-right font-medium">Crédito</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i} className="border-t border-stone-100">
                {detalharLinhas && (
                  <td className="px-2 py-1.5">
                    <input type="date" name="dataLinha" value={l.data ?? ""} onChange={(e) => alterar(i, { data: e.target.value })} className={campo} />
                  </td>
                )}
                <td className="px-2 py-1.5">
                  {!detalharLinhas && (
                    <>
                      <input type="hidden" name="dataLinha" value={l.data ?? ""} />
                      <input type="hidden" name="historicoLinha" value={l.historico ?? ""} />
                    </>
                  )}
                  <input type="hidden" name="fiscalLinha" value={l.fiscal ?? ""} />
                  <input type="hidden" name="linhaPlanilha" value={l.linhaPlanilha ?? ""} />
                  <select name="conta" value={l.contaId} onChange={(e) => alterar(i, { contaId: e.target.value })} className={`${campo} min-w-56`}>
                    <option value="">Escolha a conta…</option>
                    {[...porCategoria].map(([categoria, cs]) => (
                      <optgroup key={categoria} label={categoria}>
                        {cs.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </td>
                {detalharLinhas && (
                  <td className="px-2 py-1.5">
                    <input name="historicoLinha" value={l.historico ?? ""} onChange={(e) => alterar(i, { historico: e.target.value })} className={`${campo} min-w-56`} />
                  </td>
                )}
                <td className="px-2 py-1.5">
                  <input
                    name="debito"
                    inputMode="decimal"
                    value={l.debito}
                    onChange={(e) => alterar(i, { debito: e.target.value })}
                    onBlur={() => completarContrapartida(i)}
                    placeholder="0,00"
                    className={`${campo} text-right tabular-nums`}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    name="credito"
                    inputMode="decimal"
                    value={l.credito}
                    onChange={(e) => alterar(i, { credito: e.target.value })}
                    onBlur={() => completarContrapartida(i)}
                    placeholder="0,00"
                    className={`${campo} text-right tabular-nums`}
                  />
                </td>
                <td className="px-1 text-center">
                  {linhas.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== i))}
                      className="rounded px-2 text-stone-400 hover:bg-red-50 hover:text-red-700"
                      aria-label={`Remover linha ${i + 1}`}
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-stone-200 bg-stone-50 font-medium">
            <tr>
              <td className="px-2 py-2" colSpan={detalharLinhas ? 3 : 1}>
                <button type="button" onClick={() => setLinhas((ls) => [...ls, linhaVazia()])} className="text-sm text-folha-700 hover:underline">
                  + Adicionar linha
                </button>
              </td>
              <td className="num px-4 py-2">{formatar(totalDebito)}</td>
              <td className="num px-4 py-2">{formatar(totalCredito)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button disabled={enviando || diferenca !== 0 || totalDebito === 0} className={botaoPrimario}>
          {enviando ? "Gravando…" : textoBotao}
        </button>
        {diferenca !== 0 ? (
          <span className="text-sm text-amber-700">Falta equilibrar: diferença de R$ {formatar(Math.abs(diferenca))}</span>
        ) : (
          totalDebito > 0 && <span className="text-sm text-folha-700">Débito = crédito ✓</span>
        )}
        {edicao && (
          <Link href="/lancamentos" className={botaoSecundario}>
            Voltar aos lançamentos
          </Link>
        )}
      </div>

      {estado?.erros && (
        <ul className="list-inside list-disc rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {estado.erros.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {estado?.ok && (
        <p className="rounded-lg border border-folha-100 bg-folha-50 px-4 py-3 text-sm text-folha-800">
          {edicao ? "Alterações gravadas." : "Lançamento gravado. "}
          {!edicao && (
            <Link href={`/lancamentos/${estado.ok}`} className="underline">
              Ver lançamento
            </Link>
          )}
        </p>
      )}
    </form>
  );
}
