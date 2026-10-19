"use client";

import { useActionState, useTransition } from "react";
import type { EstadoProducao } from "@/app/(app)/producao/acoes";
import { botaoPrimario, campo } from "../ui";
import { cancelarReset, useCampos } from "../useCampos";

type Acao = (e: EstadoProducao, f: FormData) => Promise<EstadoProducao>;

/** Formulário com campos controlados que só limpa depois de gravar com sucesso (com erro, mantém o digitado). */
function useFormulario<T extends Record<string, string>>(acao: Acao, iniciais: T | (() => T)) {
  const { vincular, limpar } = useCampos(iniciais);
  const [estado, acaoForm, enviando] = useActionState(async (e: EstadoProducao, f: FormData) => {
    const r = await acao(e, f);
    if (r?.ok) limpar();
    return r;
  }, undefined);
  return { vincular, estado, acaoForm, enviando };
}

function Mensagem({ estado }: { estado: EstadoProducao }) {
  if (estado?.erro) return <span className="text-sm text-red-700">{estado.erro}</span>;
  if (estado?.ok) return <span className="text-sm text-folha-700">{estado.ok}</span>;
  return null;
}

export function FormTalhao({ acao, rotuloArea }: { acao: Acao; rotuloArea: string }) {
  const { vincular, estado, acaoForm, enviando } = useFormulario(acao, { nome: "", areaHa: "", variedade: "", anoPlantio: "", plantas: "" });
  const rotulo = (t: string) => <span className="text-xs font-medium text-stone-600">{t}</span>;
  return (
    <form action={acaoForm} className="grid gap-2 sm:grid-cols-[1.4fr_6rem_1fr_6rem_6rem_auto] sm:items-end">
      <label className="block">
        {rotulo(rotuloArea === "Área de pasto" ? "Pasto" : "Talhão")}
        <input {...vincular("nome")} required placeholder="Ex.: Talhão 1 — Catuaí" className={`${campo} mt-1`} />
      </label>
      <label className="block">
        {rotulo("Área (ha)")}
        <input {...vincular("areaHa")} required inputMode="decimal" placeholder="0,0" className={`${campo} mt-1 text-right`} />
      </label>
      <label className="block">
        {rotulo("Variedade / capim")}
        <input {...vincular("variedade")} className={`${campo} mt-1`} />
      </label>
      <label className="block">
        {rotulo("Ano plantio")}
        <input {...vincular("anoPlantio")} inputMode="numeric" className={`${campo} mt-1 text-right`} />
      </label>
      <label className="block">
        {rotulo("Nº plantas")}
        <input {...vincular("plantas")} inputMode="numeric" className={`${campo} mt-1 text-right`} />
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
  const { vincular, estado, acaoForm, enviando } = useFormulario(acao, () => ({
    tipo: tipos[0].tipo,
    data: new Date().toLocaleDateString("sv-SE"),
    quantidade: "",
    talhaoId: "",
    valor: "",
    observacao: "",
  }));
  const rotulo = (t: string) => <span className="text-xs font-medium text-stone-600">{t}</span>;
  return (
    <form action={acaoForm} onReset={cancelarReset} className="grid gap-2 sm:grid-cols-[1.2fr_9.5rem_7rem_1fr_8rem] sm:items-end">
      <label className="block">
        {rotulo("Tipo")}
        <select {...vincular("tipo")} required className={`${campo} mt-1`}>
          {tipos.map((t) => (
            <option key={t.tipo} value={t.tipo}>
              {t.rotulo}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        {rotulo("Data")}
        <input {...vincular("data")} type="date" required className={`${campo} mt-1`} />
      </label>
      <label className="block">
        {rotulo(`Quantidade (${unidade})`)}
        <input {...vincular("quantidade")} required inputMode="decimal" className={`${campo} mt-1 text-right`} />
      </label>
      <label className="block">
        {rotulo("Talhão (opcional)")}
        <select {...vincular("talhaoId")} className={`${campo} mt-1`}>
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
        <input {...vincular("valor")} inputMode="decimal" placeholder="venda/compra" className={`${campo} mt-1 text-right`} />
      </label>
      <label className="block sm:col-span-4">
        {rotulo("Observação")}
        <input {...vincular("observacao")} placeholder="Ex.: comprador, lote, classificação" className={`${campo} mt-1`} />
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
/** Botão de ação numa linha de tabela. Se a ação devolver um texto, é um aviso de que não foi feita. */
export function BotaoLinha({
  acao,
  confirmacao,
  children,
  perigo = false,
}: {
  acao: () => Promise<string | undefined | void>;
  confirmacao?: string;
  children: React.ReactNode;
  perigo?: boolean;
}) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => {
        if (!confirmacao || confirm(confirmacao))
          iniciar(async () => {
            const aviso = await acao();
            if (aviso) alert(aviso);
          });
      }}
      className={`text-xs hover:underline disabled:opacity-50 ${perigo ? "text-stone-400 hover:text-red-700" : "text-folha-700"}`}
    >
      {children}
    </button>
  );
}
