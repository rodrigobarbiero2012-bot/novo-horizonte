import type { Metadata } from "next";
import { Abas, Cabecalho, Cartao, LinhaSecao } from "@/components/ui";
import { fluxoAnual, fluxoMensal, LINHAS_FLUXO, type FluxoMes } from "@/lib/contabil/fluxo";
import { anosComMovimento, partidasDoRazao } from "@/lib/consultas";
import { MESES, reaisCurto } from "@/lib/formato";
import { exigirUsuario } from "@/lib/usuario";
import { Pagina } from "@/components/Pagina";

export const metadata: Metadata = { title: "Fluxo de caixa" };

const GRUPOS = [
  { grupo: "operacional", rotulo: "Atividades operacionais", total: "operacional" },
  { grupo: "investimento", rotulo: "Investimentos", total: "investimento" },
  { grupo: "financiamento", rotulo: "Financiamentos e sócio", total: "financiamento" },
] as const;

async function Conteudo({ searchParams }: PageProps<"/fluxo-caixa">) {
  await exigirUsuario();
  const { visao } = await searchParams;
  const [partidas, todosAnos] = await Promise.all([partidasDoRazao(), anosComMovimento()]);
  const anos = todosAnos.filter((a) => a > todosAnos[0]); // o primeiro ano só tem saldos iniciais
  const anoMensal = anos.find((a) => String(a) === visao);

  const fluxo = anoMensal ? fluxoMensal(partidas, anoMensal) : fluxoAnual(partidas, anos);
  const colunas = [...fluxo.keys()];
  const rotuloColuna = (c: string) => (anoMensal ? MESES[Number(c) - 1] : c);
  const temAConciliar = colunas.some((c) => fluxo.get(c)!.aConciliar !== 0);

  // A coluna fixa precisa de fundo opaco (o da linha, ou branco) para os números não aparecerem por trás ao rolar.
  const linha = (rotulo: string, chave: keyof FluxoMes, estilo = "", recuo = true) => (
    <tr key={rotulo} className={estilo}>
      <td className={`sticky left-0 z-10 px-4 py-1.5 ${estilo.match(/\bbg-\S+/)?.[0] ?? "bg-white"} ${recuo ? "pl-7" : ""}`}>
        {rotulo}
      </td>
      {colunas.map((c) => {
        const v = fluxo.get(c)![chave];
        return (
          <td key={c} className={`num px-3 py-1.5 ${v < 0 ? "neg" : ""} ${v === 0 ? "text-stone-300" : ""}`}>
            {reaisCurto(v)}
          </td>
        );
      })}
    </tr>
  );

  return (
    <>
      <Cabecalho
        titulo="Fluxo de caixa realizado"
        subtitulo="Entradas positivas, saídas negativas. Caixa = bancos + aplicações."
      >
        <Abas
          atual={anoMensal ? String(anoMensal) : "anual"}
          opcoes={[
            { valor: "anual", rotulo: "Por ano", href: "/fluxo-caixa" },
            ...anos.slice(-4).map((a) => ({ valor: String(a), rotulo: `${a} mês a mês`, href: `/fluxo-caixa?visao=${a}` })),
          ]}
        />
      </Cabecalho>
      <Cartao className="overflow-x-auto">
        <table className="w-full bg-white text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-stone-500">
              <th className="sticky left-0 bg-white px-4 py-3 text-left font-medium">R$</th>
              {colunas.map((c) => (
                <th key={c} className="num px-3 py-3 font-medium">
                  {rotuloColuna(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linha("Saldo inicial", "saldoInicial", "text-stone-500", false)}
            {GRUPOS.map((g) => [
              <LinhaSecao key={g.grupo} rotulo={g.rotulo} colunas={colunas.length} />,
              ...LINHAS_FLUXO.filter((l) => l.grupo === g.grupo).map((l) => linha(l.rotulo, l.chave)),
              linha(`Total ${g.rotulo.toLowerCase()}`, g.total, "border-t border-stone-200 font-medium bg-white", false),
            ])}
            <tr>
              <td colSpan={colunas.length + 1} className="h-3 bg-white" />
            </tr>
            {linha("Ajustes de estoque sem efeito caixa", "semEfeitoCaixa", "text-stone-500 bg-white", false)}
            {temAConciliar && linha("Diferença de data entre pernas (a conciliar)", "aConciliar", "text-amber-700 bg-amber-50", false)}
            {linha("Variação do caixa", "variacaoCaixa", "bg-folha-50 font-semibold", false)}
            {linha("Saldo final", "saldoFinal", "font-semibold bg-white", false)}
          </tbody>
        </table>
      </Cartao>
      <div className="mt-3 space-y-1 text-xs text-stone-500">
        <p>
          Despesas pagas direto pelo sócio (CC ACM) aparecem como saída na linha da despesa e como entrada em “Aportes do
          sócio” — quem financiou fica visível.
        </p>
        {temAConciliar && (
          <p className="text-amber-700">
            “A conciliar”: lançamentos cujas pernas caem em períodos diferentes. Na base histórica isso vem dos lotes da
            planilha (despesas com a data de cada nota, pagamento total numa data só) e dos erros de ano de 2021 e 2025.
            Lançamentos novos feitos pelo sistema não geram diferença.
          </p>
        )}
      </div>
    </>
  );
}

export default function FluxoCaixaPage(props: PageProps<"/fluxo-caixa">) {
  return (
    <Pagina>
      <Conteudo {...props} />
    </Pagina>
  );
}
