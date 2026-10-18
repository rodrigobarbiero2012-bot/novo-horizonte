import type { Metadata } from "next";
import { FormRateio, TabelaDepreciacao, type LinhaDepreciacao } from "@/components/gerencial/Formularios";
import { Pagina } from "@/components/Pagina";
import { Abas, Cabecalho, Cartao, LinhaSecao, botaoSecundario, campo } from "@/components/ui";
import { dreAnual } from "@/lib/contabil/relatorios";
import type { Atividade } from "@/lib/contabil/tipos";
import { anosComMovimento, partidasDoRazao } from "@/lib/consultas";
import { percentual, reaisCurto } from "@/lib/formato";
import { depreciacaoNoAno, type Camada } from "@/lib/gerencial/depreciacao";
import { rateioManual, taxasDepreciacao } from "@/lib/gerencial/parametros";
import { ATIVIDADES_RATEIO, CRITERIOS, ehCriterio, resultadoPorAtividade, type AtividadeRateio, type Comuns } from "@/lib/gerencial/rateio";
import { exigirUsuario } from "@/lib/usuario";

export const metadata: Metadata = { title: "Resultado por atividade" };

type Por = Record<AtividadeRateio, number>;
const soma = (v: Por) => ATIVIDADES_RATEIO.reduce((s, a) => s + v[a], 0);

async function Conteudo({ searchParams }: PageProps<"/resultado-atividade">) {
  await exigirUsuario();
  const params = await searchParams;
  const [partidas, anos, taxas, manual] = await Promise.all([partidasDoRazao(), anosComMovimento(), taxasDepreciacao(), rateioManual()]);
  const anosValidos = anos.filter((a) => a > anos[0]); // o 1º ano só tem saldos iniciais
  const pedido = Number(params.ano);
  const ano = anosValidos.includes(pedido) ? pedido : anosValidos.at(-1)!;
  const criterio = ehCriterio(params.criterio) ? params.criterio : "receita";

  // Depreciação gerencial de cada conta de imobilizado no ano.
  const camadas = new Map<string, Camada[]>();
  for (const p of partidas) {
    if (p.categoria !== "Ativo Imobilizado" || !p.conta) continue;
    camadas.set(p.conta, [...(camadas.get(p.conta) ?? []), { data: p.data, valorCentavos: p.valorCentavos }]);
  }
  const depreciacao: LinhaDepreciacao[] = taxas.map((t) => ({ ...t, ...depreciacaoNoAno(camadas.get(t.nome) ?? [], t.taxa, ano) }));
  const r = resultadoPorAtividade(
    partidas,
    ano,
    criterio,
    manual,
    depreciacao.map((d) => ({ atividade: d.atividade as Atividade, valor: d.doAno })),
  );
  const depreciacaoTotal = depreciacao.reduce((s, d) => s + d.doAno, 0);
  const dre = dreAnual(partidas, anos).get(ano)!;
  const aConfirmar = taxas.filter((t) => !t.definida && t.confirmar);

  const comuns: { chave: keyof Comuns; rotulo: string; sinal: 1 | -1 }[] = [
    { chave: "custeioGeral", rotulo: "Custeio geral", sinal: -1 },
    { chave: "despesasAdministrativas", rotulo: "Despesas administrativas", sinal: -1 },
    { chave: "despesasFinanceiras", rotulo: "Despesas financeiras", sinal: -1 },
    { chave: "depreciacaoGeral", rotulo: "Depreciação de bens de uso geral", sinal: -1 },
    { chave: "outrasReceitas", rotulo: "Outras receitas (diversas/financeiras)", sinal: 1 },
  ];
  // Total pelo razão (igual à soma das atividades quando há rateio; sem rateio, inclui os custos comuns).
  const c = r.comuns;
  const resultadoTotal = soma(r.margemDireta) - c.custeioGeral - c.despesasAdministrativas - c.despesasFinanceiras - c.depreciacaoGeral + c.outrasReceitas;

  const celula = (v: number, forte = false) => (
    <td className={`num px-3 py-1.5 ${v < 0 ? "neg" : v === 0 ? "text-stone-300" : ""} ${forte ? "font-semibold" : ""}`}>{reaisCurto(v)}</td>
  );
  const linha = (rotulo: string, v: Por, total: number, estilo = "") => (
    <tr className={estilo}>
      <td className={`sticky left-0 whitespace-nowrap px-4 py-1.5 ${estilo.includes("bg-folha-50") ? "bg-folha-50" : "bg-white"} ${estilo ? "" : "pl-7"}`}>{rotulo}</td>
      {ATIVIDADES_RATEIO.map((a) => (
        <td key={a} className={`num px-3 py-1.5 ${v[a] < 0 ? "neg" : v[a] === 0 ? "text-stone-300" : ""}`}>
          {reaisCurto(v[a])}
        </td>
      ))}
      {celula(total, true)}
    </tr>
  );
  const neg = (v: Por) => Object.fromEntries(ATIVIDADES_RATEIO.map((a) => [a, -v[a]])) as Por;

  return (
    <>
      <Cabecalho
        titulo="Resultado por atividade"
        subtitulo="Visão gerencial: custos comuns distribuídos entre as atividades e depreciação dos bens. Não altera a DRE e o Balanço oficiais."
      >
        <form className="flex items-center gap-2">
          <input type="hidden" name="criterio" value={criterio} />
          <select name="ano" defaultValue={ano} className={`${campo} w-28`} aria-label="Ano">
            {[...anosValidos].reverse().map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <button className={botaoSecundario}>Ver</button>
        </form>
      </Cabecalho>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-stone-600">Rateio dos custos comuns:</span>
        <Abas
          opcoes={Object.entries(CRITERIOS).map(([valor, rotulo]) => ({ valor, rotulo, href: `/resultado-atividade?ano=${ano}&criterio=${valor}` }))}
          atual={criterio}
        />
      </div>

      {criterio === "manual" && (
        <Cartao className="mb-4 p-4">
          <p className="mb-3 text-sm text-stone-600">
            Percentuais fixos para dividir os custos comuns — por exemplo, pela área ocupada ou pelo tempo de máquina e de pessoal de cada atividade.
            Precisam somar 100%.
          </p>
          <FormRateio atual={manual} />
        </Cartao>
      )}

      {!r.pesos && (
        <Cartao className="mb-4 border-amber-300 bg-amber-50/60 p-4 text-sm text-amber-900">
          {criterio === "manual"
            ? "Defina os percentuais acima para ratear os custos comuns."
            : `Sem ${criterio === "receita" ? "receita" : "custeio direto"} por atividade em ${ano}: não há base para ratear. Escolha outro critério.`}{" "}
          Os custos comuns ficam de fora do resultado por atividade até lá.
        </Cartao>
      )}

      <Cartao className="mb-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-stone-500">
              <th className="sticky left-0 bg-white px-4 py-3 text-left font-medium">R$ — {ano}</th>
              {ATIVIDADES_RATEIO.map((a) => (
                <th key={a} className="num px-3 py-3 font-medium">
                  {a}
                </th>
              ))}
              <th className="num px-3 py-3 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {linha("Receita", r.receita, soma(r.receita))}
            {linha("Custeio direto", neg(r.custeio), -soma(r.custeio))}
            {soma(r.depreciacaoDireta) !== 0 && linha("Depreciação de bens da atividade", neg(r.depreciacaoDireta), -soma(r.depreciacaoDireta))}
            {linha("Margem direta", r.margemDireta, soma(r.margemDireta), "border-t border-stone-200 font-medium")}
            <tr className="text-stone-500 italic">
              <td className="sticky left-0 bg-white px-4 py-1.5 pl-7">Margem direta %</td>
              {ATIVIDADES_RATEIO.map((a) => (
                <td key={a} className="num px-3 py-1.5">
                  {percentual(r.margemDireta[a], r.receita[a])}
                </td>
              ))}
              <td className="num px-3 py-1.5">{percentual(soma(r.margemDireta), soma(r.receita))}</td>
            </tr>
            <LinhaSecao rotulo="Custos comuns rateados" colunas={ATIVIDADES_RATEIO.length + 1} />
            {comuns.map((c) => (
              <tr key={c.chave}>
                <td className="sticky left-0 whitespace-nowrap bg-white px-4 py-1.5 pl-7">{c.rotulo}</td>
                {ATIVIDADES_RATEIO.map((a) => {
                  const v = c.sinal * r.rateado[c.chave][a];
                  return (
                    <td key={a} className={`num px-3 py-1.5 ${v < 0 ? "neg" : v === 0 ? "text-stone-300" : ""}`}>
                      {reaisCurto(v)}
                    </td>
                  );
                })}
                {celula(c.sinal * r.comuns[c.chave], true)}
              </tr>
            ))}
            {linha("Resultado gerencial", r.resultado, resultadoTotal, "bg-folha-50 font-semibold")}
            <tr className="text-stone-500 italic">
              <td className="sticky left-0 bg-white px-4 py-1.5 pl-7">Margem %</td>
              {ATIVIDADES_RATEIO.map((a) => (
                <td key={a} className="num px-3 py-1.5">
                  {percentual(r.resultado[a], r.receita[a])}
                </td>
              ))}
              <td />
            </tr>
            {soma(r.compraAnimais) > 0 && (
              <>
                {linha("Compra de animais (vai para o estoque de gado)", neg(r.compraAnimais), -soma(r.compraAnimais), "text-amber-800")}
                {linha(
                  "Resultado após compra de animais",
                  Object.fromEntries(ATIVIDADES_RATEIO.map((a) => [a, r.resultado[a] - r.compraAnimais[a]])) as Por,
                  resultadoTotal - soma(r.compraAnimais),
                  "font-medium",
                )}
              </>
            )}
            {r.pesos && (
              <tr className="text-xs text-stone-500">
                <td className="sticky left-0 bg-white px-4 py-1.5 pl-7">Peso no rateio</td>
                {ATIVIDADES_RATEIO.map((a) => (
                  <td key={a} className="num px-3 py-1.5">
                    {percentual(r.pesos![a], 1)}
                  </td>
                ))}
                <td className="num px-3 py-1.5">100%</td>
              </tr>
            )}
          </tbody>
        </table>
      </Cartao>

      <p className="-mt-4 mb-6 text-xs text-stone-500">
        Conferência: resultado da DRE de {ano} R$ {reaisCurto(dre.resultado)}
        {dre.resultadoNaoOperacional !== 0 && ` − não operacional R$ ${reaisCurto(dre.resultadoNaoOperacional)}`} − depreciação gerencial R${" "}
        {reaisCurto(depreciacaoTotal)} = R$ {reaisCurto(dre.resultado - dre.resultadoNaoOperacional - depreciacaoTotal)} (total do resultado gerencial).
      </p>

      <Cartao className="p-5">
        <h2 className="mb-1 font-semibold text-stone-800">Depreciação do imobilizado — {ano}</h2>
        <p className="mb-3 text-xs text-stone-500">
          Linha reta, a partir do mês seguinte a cada compra, sobre os valores lançados nas contas de imobilizado. Campos em amarelo são sugestões
          ainda não confirmadas: ajuste se precisar e grave.
        </p>
        {aConfirmar.length > 0 && (
          <ul className="mb-3 space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {aConfirmar.map((t) => (
              <li key={t.contaId}>
                <strong>{t.nome.replace(/^Imobilizado - /, "")}:</strong> {t.confirmar}
              </li>
            ))}
          </ul>
        )}
        <TabelaDepreciacao linhas={depreciacao} ano={ano} />
      </Cartao>
    </>
  );
}

export default function ResultadoAtividadePage(props: PageProps<"/resultado-atividade">) {
  return (
    <Pagina>
      <Conteudo {...props} />
    </Pagina>
  );
}
