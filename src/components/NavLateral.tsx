"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; rotulo: string } | { grupo: string; itens: { href: string; rotulo: string }[] };

const ITENS: Item[] = [
  { href: "/", rotulo: "Painel" },
  { href: "/lancamentos", rotulo: "Lançamentos" },
  { href: "/dre", rotulo: "DRE" },
  { href: "/balanco", rotulo: "Balanço" },
  { href: "/fluxo-caixa", rotulo: "Fluxo de caixa" },
  {
    grupo: "Cronograma",
    itens: [
      { href: "/cronograma/cafe", rotulo: "Café" },
      { href: "/cronograma/maracuja", rotulo: "Maracujá" },
      { href: "/cronograma/milho", rotulo: "Milho" },
      { href: "/cronograma/pecuaria", rotulo: "Pecuária" },
    ],
  },
  { href: "/contas", rotulo: "Plano de contas" },
  { href: "/convites", rotulo: "Convidar sócio" }, // temporário
];

/** Menu sem item destacado: é o que aparece até a URL atual ser conhecida. */
export function ListaNav({ caminho }: { caminho?: string }) {
  const ativo = (href: string) => caminho !== undefined && (href === "/" ? caminho === "/" : caminho.startsWith(href));
  const link = (href: string, rotulo: string, sub = false) => (
    <Link
      key={href}
      href={href}
      className={`whitespace-nowrap rounded-md py-2 text-sm transition-colors ${sub ? "pl-6 pr-3 md:py-1.5" : "px-3"} ${
        ativo(href) ? "bg-white/15 font-medium text-white" : "text-folha-100/80 hover:bg-white/10 hover:text-white"
      }`}
    >
      {rotulo}
    </Link>
  );
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {ITENS.map((i) =>
        "grupo" in i ? (
          <div key={i.grupo} className="flex gap-1 md:flex-col md:gap-0.5">
            <span className="whitespace-nowrap px-3 pb-0.5 pt-2 text-xs font-semibold uppercase tracking-wide text-folha-100/60">
              {i.grupo}
            </span>
            {i.itens.map((s) => link(s.href, s.rotulo, true))}
          </div>
        ) : (
          link(i.href, i.rotulo)
        ),
      )}
    </nav>
  );
}

export function NavLateral() {
  return <ListaNav caminho={usePathname()} />;
}
