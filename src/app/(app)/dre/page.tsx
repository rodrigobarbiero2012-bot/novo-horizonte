import type { Metadata } from "next";
import { BotaoExportar, Cabecalho, Cartao, LinhaSecao } from "@/components/ui";
import { dreAnual } from "@/lib/contabil/relatorios";
import { LINHAS_DRE_TELA } from "@/lib/relatorios/estrutura";
import { anosComMovimento, partidasDoRazao } from "@/lib/consultas";
import { percentual, reaisCurto } from "@/lib/formato";
import { exigirUsuario } from "@/lib/usuario";
import { Pagina } from "@/components/Pagina";

export const metadata: Metadata = { title: "DRE" };

async function Conteudo() {
  await exigirUsuario();
  const [partidas, todosAnos] = await Promise.all([partidasDoRazao(), anosComMovimento()]);
  const dre = dreAnual(partidas, todosAnos);
  // Anos sem receita nem custeio (ex.: 2014, só saldos iniciais) ficam de fora.
  const anos = todosAnos.filter((a) => dre.get(a)!.totalReceita !== 0 || dre.get(a)!.totalCusteio !== 0);
  const anoAtual = new Date().getFullYear();

  return (
    <>
      <Cabecalho
        titulo="DRE — Demonstração do Resultado"
        subtitulo={`Valores em R$ por ano. ${anoAtual} é parcial, até o último lançamento.`}
      >
        <BotaoExportar href="/api/exportar/dre" />
      </Cabecalho>
      <Cartao className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-stone-500">
              <th className="sticky left-0 bg-white px-4 py-3 text-left font-medium">R$</th>
              {anos.map((a) => (
                <th key={a} className="num px-3 py-3 font-medium">
                  {a}
                  {a === anoAtual && "*"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LINHAS_DRE_TELA.map((l, i) => {
              if (l.tipo === "secao") {
                return <LinhaSecao key={i} rotulo={l.rotulo} colunas={anos.length} />;
              }
              const estilo =
                l.tipo === "destaque"
                  ? "bg-folha-50 font-semibold"
                  : l.tipo === "total"
                    ? "border-t border-stone-200 font-medium"
                    : l.tipo === "pct"
                      ? "text-stone-500 italic"
                      : "";
              return (
                <tr key={i} className={estilo}>
                  <td className={`sticky left-0 px-4 py-1.5 ${l.tipo === "valor" ? "pl-7" : ""} ${l.tipo === "destaque" ? "bg-folha-50" : "bg-white"}`}>
                    {l.rotulo}
                  </td>
                  {anos.map((a) => {
                    const d = dre.get(a)!;
                    if (l.tipo === "pct") {
                      return (
                        <td key={a} className="num px-3 py-1.5">
                          {percentual(d[l.de], d.totalReceita)}
                        </td>
                      );
                    }
                    const v = d[l.chave];
                    return (
                      <td key={a} className={`num px-3 py-1.5 ${v < 0 ? "neg" : ""} ${v === 0 ? "text-stone-300" : ""}`}>
                        {reaisCurto(v)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Cartao>
    </>
  );
}

export default function DrePage() {
  return (
    <Pagina>
      <Conteudo />
    </Pagina>
  );
}
