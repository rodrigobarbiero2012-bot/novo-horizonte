"use client";

import { useActionState, useRef, useTransition } from "react";
import type { EstadoProducao } from "@/app/(app)/producao/acoes";
import { botaoPrimario, campo } from "../ui";

type Acao = (e: EstadoProducao, f: FormData) => Promise<EstadoProducao>;

/** Formulário que limpa os campos depois de gravar com sucesso. */
function useFormulario(acao: Acao) {
  const form = useRef<HTMLFormElement>(null);
  const [estado, acaoForm, enviando] = useActionState(async (e: EstadoProducao, f: FormData) => {
    const r = await acao(e, f);
    if (r?.ok) form.current?.reset();
    return r;
  }, undefined);
  return { form, estado, acaoForm, enviando };
}

function Mensagem({ estado }: { estado: EstadoProducao }) {
  if (estado?.erro) return <span className="text-sm text-red-700">{estado.erro}</span>;
  if (estado?.ok) return <span className="text-sm text-folha-700">{estado.ok}</span>;
  return null;
}

export function FormTalhao({ acao, rotuloArea }: { acao: Acao; rotuloArea: string }) {
  const { form, estado, acaoForm, enviando } = useFormulario(acao);
  const rotulo = (t: string) => <span className="text-xs font-medium text-stone-600">{t}</span>;
  return (
    <form ref={form} action={acaoForm} className="grid gap-2 sm:grid-cols-[1.4fr_6rem_1fr_6rem_6rem_auto] sm:items-end">
      <label className="block">
        {rotulo(rotuloArea === "Área de pasto" ? "Pasto" : "Talhão")}
        <input name="nome" required placeholder="Ex.: Talhão 1 — Catuaí" className={`${campo} mt-1`} />
      </label>
      <label className="block">
        {rotulo("Área (ha)")}
        <input name="areaHa" required inputMode="decimal" placeholder="0,0" className={`${campo} mt-1 text-right`} />
      </label>
      <label className="block">
        {rotulo("Variedade / capim")}
        <input name="variedade" className={`${campo} mt-1`} />
      </label>
      <label className="block">
        {rotulo("Ano plantio")}
        <input name="anoPlantio" inputMode="numeric" className={`${campo} mt-1 text-right`} />
      </label>
      <label className="block">
        {rotulo("Nº plantas")}
        <input name="plantas" inputMode="numeric" className={`${campo} mt-1 text-right`} />
      </label>
      <button disabled={enviando} className={botaoPrimario}>
        Cadastrar
      </button>
      <div className="sm:col-span-6">
        <Mensagem estado={estado} />
      </div>
    </form>
  );
}

export function FormMovimento({
  acao,
  tipos,
  talhoes,
  unidade,
}: {
  acao: Acao;
  tipos: { tipo: string; rotulo: string }[];
  talhoes: { id: string; nome: string }[];
  unidade: string;
}) {
  const { form, estado, acaoForm, enviando } = useFormulario(acao);
  const rotulo = (t: string) => <span className="text-xs font-medium text-stone-600">{t}</span>;
  return (
    <form ref={form} action={acaoForm} className="grid gap-2 sm:grid-cols-[1.2fr_9.5rem_7rem_1fr_8rem] sm:items-end">
      <label className="block">
        {rotulo("Tipo")}
        <select name="tipo" required defaultValue={tipos[0].tipo} className={`${campo} mt-1`}>
          {tipos.map((t) => (
            <option key={t.tipo} value={t.tipo}>
              {t.rotulo}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        {rotulo("Data")}
        <input name="data" type="date" required defaultValue={new Date().toLocaleDateString("sv-SE")} className={`${campo} mt-1`} />
      </label>
      <label className="block">
        {rotulo(`Quantidade (${unidade})`)}
        <input name="quantidade" required inputMode="decimal" className={`${campo} mt-1 text-right`} />
      </label>
      <label className="block">
        {rotulo("Talhão (opcional)")}
        <select name="talhaoId" defaultValue="" className={`${campo} mt-1`}>
          <option value="">—</option>
          {talhoes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        {rotulo("Valor R$ (opcional)")}
        <input name="valor" inputMode="decimal" placeholder="venda/compra" className={`${campo} mt-1 text-right`} />
      </label>
      <label className="block sm:col-span-4">
        {rotulo("Observação")}
        <input name="observacao" placeholder="Ex.: comprador, lote, classificação" className={`${campo} mt-1`} />
      </label>
      <button disabled={enviando} className={botaoPrimario}>
        Registrar
      </button>
      <div className="sm:col-span-5">
        <Mensagem estado={estado} />
      </div>
    </form>
  );
}

/** Botão pequeno de ação em linha (excluir, desativar), com confirmação. */
export function BotaoLinha({ acao, confirmacao, children, perigo = false }: { acao: () => Promise<void>; confirmacao?: string; children: React.ReactNode; perigo?: boolean }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => {
        if (!confirmacao || confirm(confirmacao)) iniciar(() => acao());
      }}
      className={`text-xs hover:underline disabled:opacity-50 ${perigo ? "text-stone-400 hover:text-red-700" : "text-folha-700"}`}
    >
      {children}
    </button>
  );
}
