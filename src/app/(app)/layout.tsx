import { Suspense } from "react";
import { ListaNav, NavLateral } from "@/components/NavLateral";
import { acaoSair } from "./acoes";

// O menu é estático (não lê cookie nem banco) e aparece na hora em qualquer
// navegação. Cada página envolve seu conteúdo em <Suspense> (ver Pagina em
// components/Pagina.tsx) e chama exigirUsuario() — é ali que o login é garantido.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-folha-900 px-3 py-4 md:sticky md:top-0 md:flex md:h-screen md:w-56 md:shrink-0 md:flex-col">
        <div className="mb-4 px-3">
          <p className="text-lg font-semibold tracking-tight text-white">Novo Horizonte</p>
          <p className="text-xs text-folha-100/70">Gestão do sítio</p>
        </div>
        <Suspense fallback={<ListaNav />}>
          <NavLateral />
        </Suspense>
        <form action={acaoSair} className="mt-4 border-t border-white/10 px-3 pt-4 md:mt-auto">
          <button className="text-sm text-folha-100/70 hover:text-white">Sair</button>
        </form>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
