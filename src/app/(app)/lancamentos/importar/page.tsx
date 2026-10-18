import type { Metadata } from "next";
import { ImportadorPlanilha } from "@/components/ImportadorPlanilha";
import { Pagina } from "@/components/Pagina";
import { Cabecalho } from "@/components/ui";
import { exigirUsuario } from "@/lib/usuario";

// Importação de até 2.000 lançamentos.
export const maxDuration = 60;

export const metadata: Metadata = { title: "Importar planilha" };

async function Conteudo() {
  await exigirUsuario();
  return (
    <>
      <Cabecalho
        titulo="Importar planilha"
        subtitulo="Lançamentos em lote a partir de um Excel no modelo do sistema. Você confere a prévia antes de gravar; linhas repetidas são detectadas."
      />
      <ImportadorPlanilha />
    </>
  );
}

export default function ImportarPage() {
  return (
    <Pagina>
      <Conteudo />
    </Pagina>
  );
}
