import Link from "next/link";
import { reais } from "@/lib/formato";

export function Cabecalho({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-stone-500">{subtitulo}</p>}
      </div>
      {children}
    </div>
  );
}

export function Cartao({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-stone-200 bg-white ${className}`}>{children}</section>;
}

/** Valor em reais, vermelho quando negativo. */
export function Valor({ centavos, className = "" }: { centavos: number; className?: string }) {
  return <span className={`${centavos < 0 ? "neg" : ""} ${className}`}>{reais(centavos)}</span>;
}

/**
 * Título de seção numa tabela de relatório com rolagem horizontal. O título
 * fica só na primeira coluna (fixa à esquerda); uma célula que ocupasse a
 * linha inteira não teria como ficar presa e sumiria ao rolar para o lado.
 */
export function LinhaSecao({ rotulo, colunas }: { rotulo: string; colunas: number }) {
  return (
    <tr>
      <td className="sticky left-0 z-10 bg-white px-4 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-folha-700">
        {rotulo}
      </td>
      <td colSpan={colunas} className="bg-white" />
    </tr>
  );
}

/** Seletor de opções como links (mantém tudo server-side, sem JS). */
export function Abas({ opcoes, atual }: { opcoes: { valor: string; rotulo: string; href: string }[]; atual: string }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-stone-200 bg-white p-1">
      {opcoes.map((o) => (
        <Link
          key={o.valor}
          href={o.href}
          className={`rounded-md px-3 py-1 text-sm ${
            o.valor === atual ? "bg-folha-700 text-white" : "text-stone-600 hover:bg-stone-100"
          }`}
        >
          {o.rotulo}
        </Link>
      ))}
    </div>
  );
}

export const botaoPrimario =
  "inline-flex items-center rounded-md bg-folha-700 px-4 py-2 text-sm font-medium text-white hover:bg-folha-800 disabled:opacity-50";
export const botaoSecundario =
  "inline-flex items-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50";
export const campo =
  "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-folha-600 focus:ring-2 focus:ring-folha-100";

/** Baixa o relatório da tela em Excel (.xlsx), com os mesmos filtros. */
export function BotaoExportar({ href }: { href: string }) {
  return (
    <a href={href} download className={botaoSecundario} title="Baixar em Excel (.xlsx)">
      ⬇ Excel
    </a>
  );
}
