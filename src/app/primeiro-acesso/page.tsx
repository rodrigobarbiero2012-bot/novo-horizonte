import { Suspense } from "react";
import Link from "next/link";
import { FormPrimeiroAcesso } from "./FormPrimeiroAcesso";

// Primeiro acesso por link de convite (gerado em /convites por um sócio logado).
// Tela temporária: some depois que os dois sócios definirem a senha.
export default function PrimeiroAcessoPage(props: PageProps<"/primeiro-acesso">) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-folha-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center text-white">
          <h1 className="text-2xl font-semibold tracking-tight">Primeiro acesso</h1>
          <p className="mt-1 text-sm text-folha-100/80">Defina a sua senha do Novo Horizonte</p>
        </div>
        <Suspense fallback={<div className="h-64 rounded-xl bg-white/10" />}>
          <Conteudo {...props} />
        </Suspense>
        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="text-folha-100/80 hover:text-white hover:underline">
            Já tenho senha
          </Link>
        </p>
      </div>
    </main>
  );
}

async function Conteudo({ searchParams }: PageProps<"/primeiro-acesso">) {
  const { convite } = await searchParams;
  if (typeof convite !== "string" || !convite) {
    return (
      <p className="rounded-xl bg-white p-6 text-sm text-stone-700 shadow-xl">
        O primeiro acesso é feito pelo link de convite que o outro sócio gera no sistema. Abra o link que você recebeu.
      </p>
    );
  }
  return <FormPrimeiroAcesso convite={convite} />;
}
