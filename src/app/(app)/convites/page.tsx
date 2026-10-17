import type { Metadata } from "next";
import { FormularioConvite } from "@/components/FormularioConvite";
import { Pagina } from "@/components/Pagina";
import { Cabecalho, Cartao } from "@/components/ui";
import { prisma } from "@/lib/db";
import { exigirUsuario } from "@/lib/usuario";
import { acaoConvidar } from "./acoes";

export const metadata: Metadata = { title: "Convidar sócio" };

// Tela temporária: some junto com /primeiro-acesso depois que os dois sócios tiverem senha.
async function Conteudo() {
  await exigirUsuario();
  const usuarios = await prisma.usuario.findMany({
    orderBy: { criadoEm: "asc" },
    select: { id: true, nome: true, email: true, senhaHash: true, conviteExpiraEm: true },
  });
  const agora = new Date();
  return (
    <>
      <Cabecalho titulo="Convidar sócio" subtitulo="Gera um link para a pessoa definir a própria senha." />
      <Cartao className="mb-6 max-w-3xl p-5">
        <FormularioConvite acao={acaoConvidar} />
      </Cartao>
      <Cartao className="max-w-3xl">
        <table className="w-full text-sm">
          <thead className="border-b border-stone-200 text-stone-500">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Usuário</th>
              <th className="px-4 py-2 text-left font-medium">Situação</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-t border-stone-100">
                <td className="px-4 py-2">
                  {u.nome} <span className="text-stone-400">· {u.email}</span>
                </td>
                <td className="px-4 py-2">
                  {u.senhaHash
                    ? "Senha definida"
                    : u.conviteExpiraEm && u.conviteExpiraEm > agora
                      ? "Convite pendente"
                      : "Convite expirado — gere outro"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Cartao>
    </>
  );
}

export default function ConvitesPage() {
  return (
    <Pagina>
      <Conteudo />
    </Pagina>
  );
}
