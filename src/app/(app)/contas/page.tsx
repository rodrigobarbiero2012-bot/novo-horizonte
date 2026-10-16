import type { Metadata } from "next";
import Link from "next/link";
import { FormularioConta } from "@/components/FormularioConta";
import { Cabecalho, Cartao, Valor } from "@/components/ui";
import { CATEGORIAS } from "@/lib/contabil/tipos";
import { prisma } from "@/lib/db";
import { exigirUsuario } from "@/lib/usuario";
import { criarConta } from "./acoes";
import { Pagina } from "@/components/Pagina";

export const metadata: Metadata = { title: "Plano de contas" };

async function Conteudo() {
  await exigirUsuario();
  const [contas, somas] = await Promise.all([
    prisma.conta.findMany({ orderBy: { nome: "asc" }, include: { apelidos: { select: { nome: true } } } }),
    prisma.partida.groupBy({ by: ["contaId"], _sum: { valorCentavos: true }, _count: true }),
  ]);
  const somaPorConta = new Map(somas.map((s) => [s.contaId, s]));

  return (
    <>
      <Cabecalho
        titulo="Plano de contas"
        subtitulo="A categoria define a linha da DRE ou do Balanço; a atividade separa café, maracujá, pecuária."
      />
      <Cartao className="mb-6 p-5">
        <h2 className="mb-3 text-sm font-semibold text-stone-700">Nova conta</h2>
        <FormularioConta acao={criarConta} />
      </Cartao>
      <div className="space-y-6">
        {CATEGORIAS.map((cat) => {
          const doGrupo = contas.filter((c) => c.categoria === cat);
          if (!doGrupo.length) return null;
          return (
            <Cartao key={cat} className="overflow-x-auto">
              <h2 className="border-b border-stone-200 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-folha-700">{cat}</h2>
              <table className="w-full text-sm">
                <thead className="text-stone-500">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Conta</th>
                    <th className="px-3 py-2 text-left font-medium">Atividade</th>
                    <th className="px-3 py-2 text-right font-medium">Lançamentos</th>
                    <th className="px-4 py-2 text-right font-medium">Saldo acumulado (D+ / C−)</th>
                  </tr>
                </thead>
                <tbody>
                  {doGrupo.map((c) => {
                    const s = somaPorConta.get(c.id);
                    const grafias = c.apelidos.map((a) => a.nome).filter((n) => n !== c.nome);
                    return (
                      <tr key={c.id} className="border-t border-stone-100">
                        <td className="px-4 py-1.5">
                          <Link href={`/razao?conta=${c.id}`} className="text-stone-800 hover:underline">
                            {c.nome}
                          </Link>
                          {grafias.length > 0 && <p className="text-xs text-stone-400">na planilha: {grafias.join(" · ")}</p>}
                        </td>
                        <td className="px-3 py-1.5 text-stone-600">{c.atividade}</td>
                        <td className="num px-3 py-1.5 text-stone-600">{(s?._count ?? 0).toLocaleString("pt-BR")}</td>
                        <td className="num px-4 py-1.5">
                          <Valor centavos={s?._sum.valorCentavos ?? 0} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Cartao>
          );
        })}
      </div>
    </>
  );
}

export default function ContasPage() {
  return (
    <Pagina>
      <Conteudo />
    </Pagina>
  );
}
