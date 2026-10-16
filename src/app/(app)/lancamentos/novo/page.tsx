import type { Metadata } from "next";
import { FormularioLancamento } from "@/components/FormularioLancamento";
import { Cabecalho, Cartao } from "@/components/ui";
import { contasAtivas } from "@/lib/consultas";
import { exigirUsuario } from "@/lib/usuario";
import { criarLancamento } from "../acoes";
import { Pagina } from "@/components/Pagina";

export const metadata: Metadata = { title: "Novo lançamento" };

async function Conteudo() {
  await exigirUsuario();
  const contas = await contasAtivas();
  return (
    <>
      <Cabecalho
        titulo="Novo lançamento"
        subtitulo="Débito: para onde o valor vai (despesa, ativo comprado). Crédito: de onde sai (banco, CC ACM, financiamento)."
      />
      <Cartao className="max-w-5xl p-5">
        <FormularioLancamento contas={contas} acao={criarLancamento} />
      </Cartao>
    </>
  );
}

export default function NovoLancamentoPage() {
  return (
    <Pagina>
      <Conteudo />
    </Pagina>
  );
}
