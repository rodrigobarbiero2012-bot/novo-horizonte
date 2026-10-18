import type { Metadata } from "next";
import { BotaoExportar, Cabecalho, Cartao, LinhaSecao } from "@/components/ui";
import { balancoAnual } from "@/lib/contabil/relatorios";
import { LINHAS_BALANCO_TELA } from "@/lib/relatorios/estrutura";
import { anosComMovimento, partidasDoRazao } from "@/lib/consultas";
import { reaisCurto, reais } from "@/lib/formato";
import { exigirUsuario } from "@/lib/usuario";
import { Pagina } from "@/components/Pagina";

export const metadata: Metadata = { title: "Balanço" };

async function Conteudo() {
  await exigirUsuario();
  const [partidas, todosAnos] = await Promise.all([partidasDoRazao(), anosComMovimento()]);
  const balanco = balancoAnual(partidas, todosAnos);
  const anos = todosAnos.filter((a) => balanco.get(a)!.totalAtivo !== 0 || a > todosAnos[0]);
  const comDiferenca = anos.filter((a) => balanco.get(a)!.diferenca !== 0);

  return (
    <>
      <Cabecalho titulo="Balanço patrimonial" subtitulo="Saldos em 31 de dezembro de cada ano, em R$.">
        <BotaoExportar href="/api/exportar/balanco" />
      </Cabecalho>
      {comDiferenca.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Balanço não fecha em {comDiferenca.join(", ")}.</strong>{" "}
          {comDiferenca.map((a) => `${a}: R$ ${reais(balanco.get(a)!.diferenca)}`).join(" · ")}. Há lançamentos com pernas
          em anos diferentes (erro de data na planilha original); a diferença some quando a data for corrigida.
        </div>
      )}
      <Cartao className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-stone-500">
              <th className="sticky left-0 bg-white px-4 py-3 text-left font-medium">R$</th>
              {anos.map((a) => (
                <th key={a} className="num px-3 py-3 font-medium">
                  {a}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LINHAS_BALANCO_TELA.map((l, i) =>
              l.tipo === "secao" ? (
                <LinhaSecao key={i} rotulo={l.rotulo} colunas={anos.length} />
              ) : (
                <tr key={i} className={l.tipo === "destaque" ? "bg-folha-50 font-semibold" : l.tipo === "total" ? "border-t border-stone-200 font-medium" : ""}>
                  <td className={`sticky left-0 px-4 py-1.5 ${l.tipo === "valor" ? "pl-7" : ""} ${l.tipo === "destaque" ? "bg-folha-50" : "bg-white"}`}>
                    {l.rotulo}
                  </td>
                  {anos.map((a) => {
                    const v = balanco.get(a)![l.chave];
                    return (
                      <td key={a} className={`num px-3 py-1.5 ${v < 0 ? "neg" : ""} ${v === 0 ? "text-stone-300" : ""}`}>
                        {reaisCurto(v)}
                      </td>
                    );
                  })}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </Cartao>
      <p className="mt-3 text-xs text-stone-500">
        Caixa negativo indica conta-corrente usada no cheque especial. Imobilizado pelo custo histórico, sem depreciação
        (como na planilha).
      </p>
    </>
  );
}

export default function BalancoPage() {
  return (
    <Pagina>
      <Conteudo />
    </Pagina>
  );
}
