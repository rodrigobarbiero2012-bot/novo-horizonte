import type { Metadata } from "next";
import { LeitorDocumento } from "@/components/LeitorDocumento";
import { Pagina } from "@/components/Pagina";
import { Cabecalho } from "@/components/ui";
import { contasAtivas } from "@/lib/consultas";
import { exigirUsuario } from "@/lib/usuario";
import { criarLancamento } from "../acoes";
import { lerDocumentoAcao } from "./acoes";

export const metadata: Metadata = { title: "Ler boleto ou nota" };

async function Conteudo() {
  await exigirUsuario();
  const contas = await contasAtivas();
  return (
    <>
      <Cabecalho
        titulo="Ler boleto ou nota"
        subtitulo="Envie o PDF ou a foto: a IA lê fornecedor, valor e vencimento e já sugere as contas. Você confere e grava."
      />
      <LeitorDocumento contas={contas} ler={lerDocumentoAcao} criar={criarLancamento} />
    </>
  );
}

export default function LerDocumentoPage() {
  return (
    <Pagina>
      <Conteudo />
    </Pagina>
  );
}
