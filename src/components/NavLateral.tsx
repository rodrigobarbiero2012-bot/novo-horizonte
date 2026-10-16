"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITENS = [
  { href: "/", rotulo: "Painel" },
  { href: "/lancamentos/novo", rotulo: "Novo lançamento" },
  { href: "/razao", rotulo: "Razão" },
  { href: "/dre", rotulo: "DRE" },
  { href: "/balanco", rotulo: "Balanço" },
  { href: "/fluxo-caixa", rotulo: "Fluxo de caixa" },
  { href: "/contas", rotulo: "Plano de contas" },
];

/** Menu sem item destacado: é o que aparece até a URL atual ser conhecida. */
export function ListaNav({ caminho }: { caminho?: string }) {
  const ativo = (href: string) => caminho !== undefined && (href === "/" ? caminho === "/" : caminho.startsWith(href));
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {ITENS.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={`whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors ${
            ativo(i.href) ? "bg-white/15 font-medium text-white" : "text-folha-100/80 hover:bg-white/10 hover:text-white"
          }`}
        >
          {i.rotulo}
        </Link>
      ))}
    </nav>
  );
}

export function NavLateral() {
  return <ListaNav caminho={usePathname()} />;
}
