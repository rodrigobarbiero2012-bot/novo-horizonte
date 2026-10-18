"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Link = { href: string; rotulo: string };
type Item = Link | { grupo: string; itens: Link[] };

const ITENS: Item[] = [
  { href: "/", rotulo: "Painel" },
  { href: "/lancamentos", rotulo: "Lançamentos" },
  { href: "/a-pagar-receber", rotulo: "A pagar e receber" },
  { href: "/conciliacao", rotulo: "Conciliação bancária" },
  { href: "/dre", rotulo: "DRE" },
  { href: "/balanco", rotulo: "Balanço" },
  { href: "/fluxo-caixa", rotulo: "Fluxo de caixa" },
  { href: "/orcamento", rotulo: "Orçamento × realizado" },
  { href: "/resultado-atividade", rotulo: "Resultado por atividade" },
  {
    grupo: "Produção",
    itens: [
      { href: "/producao/cafe", rotulo: "Café" },
      { href: "/producao/maracuja", rotulo: "Maracujá" },
      { href: "/producao/milho", rotulo: "Milho" },
      { href: "/producao/pecuaria", rotulo: "Pecuária" },
    ],
  },
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

/**
 * Menu. Os grupos (Produção, Cronograma) ficam recolhidos e abrem ao clicar;
 * o grupo da página atual já vem aberto. Sem `caminho` (antes da URL ser
 * conhecida), nada aparece destacado.
 */
export function ListaNav({ caminho }: { caminho?: string }) {
  const ativo = (href: string) => caminho !== undefined && (href === "/" ? caminho === "/" : caminho.startsWith(href));
  // Escolha manual de abrir/fechar por grupo; sem escolha, abre o grupo que contém a página atual.
  const [escolha, setEscolha] = useState<Record<string, boolean>>({});

  const link = (href: string, rotulo: string, sub = false) => (
    <Link
      key={href}
      href={href}
      className={`whitespace-nowrap rounded-md py-2 text-sm transition-colors ${sub ? "pl-7 pr-3 md:py-1.5" : "px-3"} ${
        ativo(href) ? "bg-white/15 font-medium text-white" : "text-folha-100/80 hover:bg-white/10 hover:text-white"
      }`}
    >
      {rotulo}
    </Link>
  );

  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-x-visible">
      {ITENS.map((i) => {
        if (!("grupo" in i)) return link(i.href, i.rotulo);
        const temAtivo = i.itens.some((s) => ativo(s.href));
        const aberto = escolha[i.grupo] ?? temAtivo;
        return (
          <div key={i.grupo} className="flex gap-1 md:flex-col md:gap-0.5">
            <button
              type="button"
              onClick={() => setEscolha((e) => ({ ...e, [i.grupo]: !aberto }))}
              aria-expanded={aberto}
              className={`flex items-center justify-between gap-2 whitespace-nowrap rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-white/10 hover:text-white ${
                temAtivo && !aberto ? "bg-white/15 font-medium text-white" : "text-folha-100/80"
              }`}
            >
              {i.grupo}
              <span aria-hidden className={`text-xs transition-transform ${aberto ? "rotate-90" : ""}`}>
                ▸
              </span>
            </button>
            {aberto && i.itens.map((s) => link(s.href, s.rotulo, true))}
          </div>
        );
      })}
    </nav>
  );
}

export function NavLateral() {
  return <ListaNav caminho={usePathname()} />;
}
