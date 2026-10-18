"use client";

import { useActionState, useEffect, useRef } from "react";
import { criarTitulo, type EstadoTitulo } from "@/app/(app)/a-pagar-receber/acoes";
import type { TipoTitulo } from "@/lib/titulos/regras";
import { botaoPrimario, campo } from "../ui";

type Conta = { id: string; nome: string; categoria: string };

export type InicialTitulo = {
  descricao?: string;
  contraparte?: string;
  valor?: string;
  vencimento?: string;
  contaId?: string;
  numeroDocumento?: string;
  linhaDigitavel?: string;
};

type Props = {
  tipo: TipoTitulo;
  contas: Conta[]; // já filtradas para o tipo
  inicial?: InicialTitulo;
  origem?: "MANUAL" | "DOCUMENTO";
  /** Arquivo do documento lido, ligado ao título ao gravar. */
  anexoId?: string;
  aoGravar?: () => void;
};

export function FormTitulo({ tipo, contas, inicial, origem = "MANUAL", anexoId, aoGravar }: Props) {
  const form = useRef<HTMLFormElement>(null);
  const [estado, acao, enviando] = useActionState(async (e: EstadoTitulo, f: FormData) => {
    const r = await criarTitulo(e, f);
    if (r?.ok && !inicial) form.current?.reset();
    return r;
  }, undefined);
  useEffect(() => {
    if (estado?.ok) aoGravar?.();
  }, [estado, aoGravar]);

  const porCategoria = Map.groupBy(contas, (c) => c.categoria);
  const pagar = tipo === "PAGAR";

  return (
    <form ref={form} action={acao} className="space-y-3">
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="origem" value={origem} />
      {anexoId && <input type="hidden" name="anexoId" value={anexoId} />}
      <input type="hidden" name="numeroDocumento" value={inicial?.numeroDocumento ?? ""} />
      <input type="hidden" name="linhaDigitavel" value={inicial?.linhaDigitavel ?? ""} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-stone-600">Descrição</span>
          <input
            name="descricao"
            required
            defaultValue={inicial?.descricao}
            placeholder={pagar ? "Ex.: Adubo 20-05-20 — NF 1234" : "Ex.: Venda de 100 sacas — Cooxupé"}
            className={`${campo} mt-1`}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-stone-600">{pagar ? "Fornecedor" : "Cliente"}</span>
          <input name="contraparte" defaultValue={inicial?.contraparte} className={`${campo} mt-1`} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-[8rem_10rem_1fr_6rem]">
        <label className="block">
          <span className="text-xs font-medium text-stone-600">Valor total</span>
          <input name="valor" required inputMode="decimal" placeholder="0,00" defaultValue={inicial?.valor} className={`${campo} mt-1 text-right tabular-nums`} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-stone-600">{pagar ? "Vencimento" : "Previsão"} (1ª parcela)</span>
          <input name="vencimento" type="date" required defaultValue={inicial?.vencimento} className={`${campo} mt-1`} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-stone-600">Conta</span>
          <select name="contaId" required defaultValue={inicial?.contaId ?? ""} className={`${campo} mt-1`}>
            <option value="" disabled>
              Escolha…
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
        <label className="block">
          <span className="text-xs font-medium text-stone-600">Parcelas</span>
          <input name="parcelas" type="number" min={1} max={60} defaultValue={1} className={`${campo} mt-1 text-right`} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={enviando} className={botaoPrimario}>
          {enviando ? "Gravando…" : pagar ? "Criar conta a pagar" : "Criar conta a receber"}
        </button>
        {estado?.erro && <span className="text-sm text-red-700">{estado.erro}</span>}
        {estado?.ok && <span className="text-sm text-folha-700">{estado.ok}</span>}
      </div>
    </form>
  );
}
