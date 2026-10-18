"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { baixarTitulo, estornarBaixa, excluirTitulo } from "@/app/(app)/a-pagar-receber/acoes";
import { dataBr, reais } from "@/lib/formato";
import { BotaoAnexar, LinkAnexo } from "../Anexos";
import { FAIXAS, type Faixa, type TipoTitulo } from "@/lib/titulos/regras";
import { campo } from "../ui";

export type TituloLinha = {
  id: string;
  descricao: string;
  contraparte: string | null;
  valorCentavos: number;
  vencimento: string; // ISO
  conta: string;
  parcela: string | null; // "2/10"
  faixa: Faixa;
  anexos: { id: string; nome: string }[];
};

export type TituloBaixado = {
  id: string;
  descricao: string;
  contraparte: string | null;
  valorBaixaCentavos: number;
  baixadoEm: string;
  contaBaixa: string;
  lancamentoId: string | null;
  anexos: { id: string; nome: string }[];
};

type ContaBaixa = { id: string; nome: string };

const valorTexto = (c: number) => (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ListaTitulos(props: {
  tipo: TipoTitulo;
  abertos: TituloLinha[];
  baixados: TituloBaixado[];
  contasBaixa: ContaBaixa[];
  contaBaixaPadrao: string | null;
  hoje: string;
}) {
  const { tipo, abertos, baixados } = props;
  const verbo = tipo === "PAGAR" ? "Pagar" : "Receber";

  return (
    <div className="space-y-6">
      {FAIXAS.map(({ faixa, rotulo }) => {
        const lista = abertos.filter((t) => t.faixa === faixa);
        if (!lista.length) return null;
        const total = lista.reduce((s, t) => s + t.valorCentavos, 0);
        return (
          <section key={faixa}>
            <h3
              className={`mb-1.5 flex items-baseline justify-between border-b pb-1 text-xs font-semibold uppercase tracking-wide ${
                faixa === "vencido" ? "border-red-200 text-red-700" : "border-stone-200 text-folha-700"
              }`}
            >
              <span>
                {faixa === "vencido" && "⚠ "}
                {rotulo} · {lista.length}
              </span>
              <span className="num normal-case tracking-normal">R$ {reais(total)}</span>
            </h3>
            <ul>
              {lista.map((t) => (
                <LinhaAberta key={t.id} titulo={t} verbo={verbo} {...props} />
              ))}
            </ul>
          </section>
        );
      })}
      {abertos.length === 0 && <p className="py-6 text-center text-sm text-stone-500">Nada em aberto.</p>}

      {baixados.length > 0 && (
        <details className="rounded-lg border border-stone-200 px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-stone-700">
            {tipo === "PAGAR" ? "Pagos" : "Recebidos"} nos últimos 60 dias ({baixados.length})
          </summary>
          <ul className="mt-2 divide-y divide-stone-100 text-sm">
            {baixados.map((b) => (
              <LinhaBaixada key={b.id} titulo={b} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function LinhaAberta({
  titulo: t,
  verbo,
  contasBaixa,
  contaBaixaPadrao,
  hoje,
}: {
  titulo: TituloLinha;
  verbo: string;
  contasBaixa: ContaBaixa[];
  contaBaixaPadrao: string | null;
  hoje: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao, enviando] = useActionState(baixarTitulo.bind(null, t.id), undefined);
  const [, iniciar] = useTransition();

  return (
    <li className="group border-b border-stone-100 py-2 last:border-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className={`w-20 shrink-0 tabular-nums text-sm ${t.faixa === "vencido" ? "font-medium text-red-700" : "text-stone-600"}`}>
          {dataBr(t.vencimento)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-stone-800">
            {t.descricao}
            {t.parcela && <span className="ml-1.5 text-xs text-stone-500">parcela {t.parcela}</span>}
          </span>
          <span className="block truncate text-xs text-stone-500">
            {t.contraparte ? `${t.contraparte} · ` : ""}
            {t.conta}
            {t.anexos.map((a) => (
              <span key={a.id}>
                {" · "}
                <LinkAnexo anexo={a}>📎 {a.nome}</LinkAnexo>
              </span>
            ))}
          </span>
        </span>
        <span className="num w-28 text-sm font-medium">{reais(t.valorCentavos)}</span>
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAberto((a) => !a)}
            className="rounded-md border border-folha-600 px-2.5 py-1 text-xs font-medium text-folha-700 hover:bg-folha-50"
          >
            {verbo}
          </button>
          {t.anexos.length === 0 && (
            <span className="text-xs opacity-0 focus-within:opacity-100 group-hover:opacity-100">
              <BotaoAnexar destino={{ tituloId: t.id }} rotulo="📎" />
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              if (confirm(`Excluir "${t.descricao}"${t.parcela ? ` (parcela ${t.parcela})` : ""}?`)) iniciar(() => excluirTitulo(t.id));
            }}
            className="rounded px-1.5 text-stone-300 opacity-0 hover:bg-red-50 hover:text-red-700 focus:opacity-100 group-hover:opacity-100"
            aria-label={`Excluir ${t.descricao}`}
          >
            ×
          </button>
        </span>
      </div>
      {aberto && !estado?.ok && (
        <form action={acao} className="mt-2 flex flex-wrap items-end gap-2 rounded-md bg-stone-50 p-3">
          <label className="block">
            <span className="text-xs text-stone-600">Data</span>
            <input name="data" type="date" required defaultValue={hoje} className={`${campo} mt-0.5 w-40`} />
          </label>
          <label className="block">
            <span className="text-xs text-stone-600">{verbo === "Pagar" ? "Pago com" : "Recebido em"}</span>
            <select name="contaBaixaId" required defaultValue={contaBaixaPadrao ?? ""} className={`${campo} mt-0.5 w-56`}>
              <option value="" disabled>
                Escolha…
              </option>
              {contasBaixa.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-stone-600">Valor</span>
            <input name="valor" required inputMode="decimal" defaultValue={valorTexto(t.valorCentavos)} className={`${campo} mt-0.5 w-32 text-right tabular-nums`} />
          </label>
          <button disabled={enviando} className="rounded-md bg-folha-700 px-3 py-2 text-sm font-medium text-white hover:bg-folha-800 disabled:opacity-50">
            {enviando ? "Gravando…" : `Confirmar`}
          </button>
          {estado?.erro && <span className="text-xs text-red-700">{estado.erro}</span>}
        </form>
      )}
    </li>
  );
}

function LinhaBaixada({ titulo: b }: { titulo: TituloBaixado }) {
  const [pendente, iniciar] = useTransition();
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 py-1.5">
      <span className="w-20 tabular-nums text-stone-500">{dataBr(b.baixadoEm)}</span>
      <span className="min-w-0 flex-1 truncate text-stone-700">
        {b.descricao}
        {b.contraparte ? ` — ${b.contraparte}` : ""} <span className="text-xs text-stone-400">({b.contaBaixa})</span>
      </span>
      <span className="num w-28">{reais(b.valorBaixaCentavos)}</span>
      {b.anexos.map((a) => (
        <LinkAnexo key={a.id} anexo={a}>
          📎
        </LinkAnexo>
      ))}
      {b.lancamentoId && (
        <Link href={`/lancamentos/${b.lancamentoId}`} className="text-xs text-folha-700 hover:underline">
          lançamento
        </Link>
      )}
      <button
        type="button"
        disabled={pendente}
        onClick={() => {
          if (confirm("Desfazer a baixa? O lançamento gerado será excluído e o título volta a ficar em aberto.")) iniciar(() => estornarBaixa(b.id));
        }}
        className="text-xs text-stone-500 hover:text-red-700 hover:underline"
      >
        desfazer
      </button>
    </li>
  );
}
