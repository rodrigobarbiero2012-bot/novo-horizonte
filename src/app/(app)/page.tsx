import Link from "next/link";
import { Cabecalho, Cartao } from "@/components/ui";
import { Pagina } from "@/components/Pagina";
import { CartaoCotacao } from "@/components/painel/CartaoCotacao";
import { GraficoMensal } from "@/components/painel/GraficoMensal";
import { Indicador, textoComparacao } from "@/components/painel/Indicador";
import { dividaEm, maioresCustos, mixAtividades, resumoPeriodo, ultimos12Meses, umAnoAntes, variacao } from "@/lib/contabil/painel";
import { balancoAnual, dreAnual } from "@/lib/contabil/relatorios";
import { ATIVIDADES_CRONOGRAMA, PENDENCIAS_MODELO } from "@/lib/cronograma/modelos";
import { taxasDepreciacao } from "@/lib/gerencial/parametros";
import { ATIVIDADES_PRODUCAO } from "@/lib/producao/atividades";
import { anosComMovimento, contasAtivas, partidasDoRazao, resumoCotacoes } from "@/lib/consultas";
import { prisma } from "@/lib/db";
import { dataBr, MESES, percentual, reais, reaisCurto } from "@/lib/formato";
import { ehLinhaOrcamento, matrizVazia, mesDeCorte, realizadoMensal, somaAte, totaisMensais, type Matriz } from "@/lib/orcamento/calculo";
import { exigirUsuario } from "@/lib/usuario";

async function Conteudo() {
  const usuario = await exigirUsuario();
  const [partidas, anos, cotacoes, contas, recentes, semSenha, aPagarProximos, comTalhao, comMovimento, orcamento, taxas] = await Promise.all([
    partidasDoRazao(),
    anosComMovimento(),
    resumoCotacoes(),
    contasAtivas(),
    prisma.lancamento.findMany({
      orderBy: [{ data: "desc" }, { criadoEm: "desc" }],
      take: 6,
      include: { partidas: { select: { valorCentavos: true } } },
    }),
    prisma.usuario.findMany({ where: { senhaHash: null }, select: { nome: true } }),
    prisma.titulo.findMany({
      where: { status: "ABERTO", tipo: "PAGAR", vencimento: { lte: new Date(Date.parse(new Date().toLocaleDateString("sv-SE")) + 7 * 86_400_000) } },
      select: { valorCentavos: true, vencimento: true },
    }),
    prisma.talhao.groupBy({ by: ["atividade"] }),
    prisma.movimentoProducao.groupBy({ by: ["atividade"] }),
    prisma.orcamentoItem.findMany({ where: { ano: new Date().getFullYear() } }),
    taxasDepreciacao(),
  ]);
  const taxasAConfirmar = taxas.filter((t) => !t.definida && t.confirmar);
  const comDados = new Set([...comTalhao, ...comMovimento].map((g) => g.atividade));
  const producaoPendente = Object.entries(ATIVIDADES_PRODUCAO).filter(([, def]) => !comDados.has(def.chave));

  // Período: do início do ano até o último lançamento, contra o mesmo período do ano anterior.
  const hoje = new Date().toLocaleDateString("sv-SE");
  const ano = anos.at(-1)!;
  const ultimaData = partidas.reduce((m, p) => (p.data > m ? p.data : m), "");
  const fim = ultimaData.startsWith(String(ano)) ? ultimaData : `${ano}-01-01`;
  const atual = { inicio: `${ano}-01-01`, fim };
  const anterior = { inicio: `${ano - 1}-01-01`, fim: umAnoAntes(fim) };
  const refAnterior = `01/01–${dataBr(anterior.fim).slice(0, 5)} de ${ano - 1}`;

  const r = resumoPeriodo(partidas, atual);
  const ra = resumoPeriodo(partidas, anterior);
  const mix = mixAtividades(partidas, atual);
  const custos = maioresCustos(partidas, atual, anterior);
  const meses = ultimos12Meses(partidas, fim.slice(0, 7));
  const divida = dividaEm(partidas, fim);
  const dividaFimAnoAnterior = dividaEm(partidas, `${ano - 1}-12-31`);
  // Receita dos 12 meses até `fim`: do dia seguinte a "um ano antes" até `fim`.
  const inicio12m = new Date(Date.parse(umAnoAntes(fim)) + 86_400_000).toISOString().slice(0, 10);
  const receita12m = resumoPeriodo(partidas, { inicio: inicio12m, fim }).receita;
  const idDaConta = new Map(contas.map((c) => [c.nome, c.id]));

  // Alertas
  const dre = dreAnual(partidas, anos);
  const balanco = balancoAnual(partidas, anos);
  const anosSemFechar = anos.filter((a) => balanco.get(a)!.diferenca !== 0);
  const anosSemJuros = anos.filter((a) => a > anos[0] && balanco.get(a)!.emprestimos > 0 && dre.get(a)!.despesasFinanceiras === 0);
  const vencidos = aPagarProximos.filter((t) => t.vencimento.toISOString().slice(0, 10) < hoje);
  const daSemana = aPagarProximos.filter((t) => t.vencimento.toISOString().slice(0, 10) >= hoje);
  const somaTitulos = (ts: { valorCentavos: number }[]) => reais(ts.reduce((s, t) => s + t.valorCentavos, 0));
  const totalCustos = r.custeio + r.despesas;
  const maiorCusto = Math.max(1, ...custos.map((c) => c.valor));
  const maiorAtividade = Math.max(1, ...mix.atividades.map((a) => Math.max(a.receita, a.custeio)));

  // Orçamento do ano: avisa quando os gastos até o mês atual passam 5% do orçado.
  const orcado = matrizVazia();
  for (const i of orcamento) if (ehLinhaOrcamento(i.linha)) orcado[i.linha][i.mes - 1] = i.valorCentavos;
  const corte = mesDeCorte(ano, hoje);
  const gastosDe = (m: Matriz) => {
    const t = totaisMensais(m);
    return -(somaAte(t.totalCusteio, corte) + somaAte(t.totalDespesas, corte));
  };
  const gastosOrcados = gastosDe(orcado);
  const gastosReais = gastosDe(realizadoMensal(partidas, ano));
  const estouro = orcamento.length > 0 && gastosOrcados > 0 && gastosReais > gastosOrcados * 1.05 ? (gastosReais - gastosOrcados) / gastosOrcados : null;

  return (
    <>
      <Cabecalho
        titulo={`Olá, ${usuario.nome.split(" ")[0]}`}
        subtitulo={`${ano} acumulado até ${dataBr(fim)} (último lançamento), comparado com o mesmo período de ${ano - 1}.`}
      />

      {/* 1. Como está o ano */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Indicador rotulo="Receita" centavos={r.receita} comparacao={textoComparacao(variacao(r.receita, ra.receita), refAnterior)} />
        <Indicador rotulo="Custeio + despesas" centavos={totalCustos} comparacao={textoComparacao(variacao(totalCustos, ra.custeio + ra.despesas), refAnterior)} />
        <Indicador
          rotulo="Resultado"
          centavos={r.resultado}
          comparacao={`margem ${percentual(r.resultado, r.receita)} · em ${ano - 1}: ${reaisCurto(ra.resultado)}`}
        />
        <Indicador rotulo="Aportes dos sócios" centavos={r.aportesSocio} comparacao={`em ${ano - 1} no mesmo período: ${reaisCurto(ra.aportesSocio)}`} />
        <Indicador
          rotulo="Dívida bancária"
          centavos={divida}
          comparacao={textoComparacao(variacao(divida, dividaFimAnoAnterior), `31/12/${ano - 1}`)}
          nota={`${percentual(divida, receita12m)} da receita dos últimos 12 meses`}
        />
      </div>

      {/* 5. O que pede atenção */}
      <Cartao className="mb-6 border-amber-300 bg-amber-50/60 p-4">
        <h2 className="mb-2 text-sm font-semibold text-amber-900">⚠ Pontos de atenção</h2>
        <ul className="space-y-1.5 text-sm text-amber-900">
          {(vencidos.length > 0 || daSemana.length > 0) && (
            <li>
              <strong>Contas a pagar:</strong>{" "}
              {vencidos.length > 0 && (
                <span className="font-semibold text-red-700">
                  {vencidos.length} vencida{vencidos.length > 1 ? "s" : ""} (R$ {somaTitulos(vencidos)})
                </span>
              )}
              {vencidos.length > 0 && daSemana.length > 0 && " e "}
              {daSemana.length > 0 && (
                <>
                  {daSemana.length} vencendo nos próximos 7 dias (R$ {somaTitulos(daSemana)})
                </>
              )}
              .{" "}
              <Link href="/a-pagar-receber" className="underline">
                Ver contas
              </Link>
            </li>
          )}
          {estouro !== null && (
            <li>
              <strong>Orçamento:</strong> custeio + despesas de {ano} até {MESES[corte - 1].toLowerCase()} estão{" "}
              <span className="font-semibold text-red-700">{percentual(estouro, 1)} acima do orçado</span> (R$ {reaisCurto(gastosReais)} × R$ {reaisCurto(gastosOrcados)}).{" "}
              <Link href={`/orcamento?ano=${ano}`} className="underline">
                Ver orçamento
              </Link>
            </li>
          )}
          {producaoPendente.length > 0 && (
            <li>
              <strong>Dados de produção pendentes — confirmar:</strong> área e produção de{" "}
              {producaoPendente.map(([slug, def], i) => (
                <span key={slug}>
                  {i > 0 && (i === producaoPendente.length - 1 ? " e " : ", ")}
                  <Link href={`/producao/${slug}`} className="underline">
                    {def.nome.toLowerCase()}
                  </Link>
                </span>
              ))}
              . Sem eles não há custo por saca, produtividade nem margem frente às cotações.
            </li>
          )}
          {Object.entries(PENDENCIAS_MODELO).map(([chave, texto]) => {
            const slug = Object.entries(ATIVIDADES_CRONOGRAMA).find(([, a]) => a.chave === chave)?.[0];
            return (
              <li key={chave}>
                <strong>Cronograma — pendência:</strong> {texto}{" "}
                {slug && (
                  <Link href={`/cronograma/${slug}`} className="underline">
                    Ver cronograma
                  </Link>
                )}
              </li>
            );
          })}
          {taxasAConfirmar.length > 0 && (
            <li>
              <strong>Depreciação — confirmar taxas:</strong> {taxasAConfirmar.map((t) => t.nome.replace(/^Imobilizado - /, "").toLowerCase()).join(" e ")}.{" "}
              <Link href="/resultado-atividade" className="underline">
                Ver resultado por atividade
              </Link>
            </li>
          )}
          {anosSemFechar.length > 0 && (
            <li>
              Balanço não fecha em {anosSemFechar.join(" e ")} — datas de lançamento em ano errado.{" "}
              <Link href="/balanco" className="underline">
                Ver balanço
              </Link>
            </li>
          )}
          {anosSemJuros.length > 0 && (
            <li>Nenhum juro lançado em {anosSemJuros.join(", ")}, embora houvesse dívida bancária: o resultado desses anos pode estar superestimado.</li>
          )}
          {semSenha.length > 0 && (
            <li>
              Convite pendente: {semSenha.map((u) => u.nome).join(", ")} ainda não definiu a senha.{" "}
              <Link href="/convites" className="underline">
                Convidar sócio
              </Link>
            </li>
          )}
        </ul>
      </Cartao>

      {/* 4. Cotações */}
      <h2 className="mb-2 font-semibold text-stone-800">Cotações</h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cotacoes.map((c) => (
          <CartaoCotacao key={c.produto} cotacao={c} hoje={hoje} />
        ))}
      </div>

      {/* 2. De onde vem e para onde vai */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Cartao className="p-5">
          <h2 className="mb-1 font-semibold text-stone-800">Resultado por atividade — {ano}</h2>
          <p className="mb-4 text-xs text-stone-500">Receita e custeio direto de cada atividade; a margem não inclui custos gerais.</p>
          <table className="w-full text-sm">
            <thead className="text-xs text-stone-500">
              <tr>
                <th className="pb-2 text-left font-medium">Atividade</th>
                <th className="pb-2 text-right font-medium">Receita</th>
                <th className="pb-2 text-right font-medium">Custeio</th>
                <th className="pb-2 text-right font-medium">Margem</th>
              </tr>
            </thead>
            <tbody>
              {mix.atividades.map((a) => (
                <tr key={a.atividade} className="border-t border-stone-100 align-top">
                  <td className="py-2">
                    <span className="font-medium text-stone-800">{a.atividade}</span>
                    <span className="mt-1 block h-1.5 rounded-full bg-folha-600" style={{ width: `${(a.receita / maiorAtividade) * 100}%` }} />
                    <span className="mt-0.5 block text-[11px] text-stone-500">{percentual(a.receita, r.receita)} da receita</span>
                  </td>
                  <td className="num py-2">{reaisCurto(a.receita)}</td>
                  <td className="num py-2">{reaisCurto(a.custeio)}</td>
                  <td className="num py-2 font-medium">
                    <span className={a.margem < 0 ? "neg" : ""}>{reaisCurto(a.margem)}</span>
                    <span className="block text-[11px] font-normal text-stone-500">{percentual(a.margem, a.receita)}</span>
                  </td>
                </tr>
              ))}
              <tr className="border-t border-stone-200 text-stone-600">
                <td className="py-2">Custos gerais e despesas (não alocados)</td>
                <td />
                <td className="num py-2">{reaisCurto(mix.naoAlocado)}</td>
                <td className="num py-2 neg">{reaisCurto(-mix.naoAlocado)}</td>
              </tr>
            </tbody>
          </table>
        </Cartao>

        <Cartao className="p-5">
          <h2 className="mb-1 font-semibold text-stone-800">Maiores custos — {ano}</h2>
          <p className="mb-4 text-xs text-stone-500">Contas de custeio e despesa, com a variação sobre o mesmo período de {ano - 1}.</p>
          <ul className="space-y-3 text-sm">
            {custos.map((c) => {
              const v = variacao(c.valor, c.anterior);
              return (
                <li key={c.conta}>
                  <div className="flex items-baseline justify-between gap-3">
                    <Link href={`/lancamentos?conta=${idDaConta.get(c.conta) ?? ""}&de=${atual.inicio}`} className="truncate text-stone-800 hover:underline">
                      {c.conta}
                    </Link>
                    <span className="num shrink-0 font-medium">{reaisCurto(c.valor)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-3">
                    <span className="h-1.5 rounded-full bg-folha-600" style={{ width: `${(c.valor / maiorCusto) * 100}%` }} />
                    <span className="shrink-0 text-[11px] text-stone-500">
                      {percentual(c.valor, totalCustos)} do total · {v === null ? `sem gasto em ${ano - 1}` : `${v >= 0 ? "▲" : "▼"} ${Math.abs(v).toLocaleString("pt-BR", { style: "percent", maximumFractionDigits: 0 })}`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Cartao>
      </div>

      {/* 3. Caixa mês a mês */}
      <Cartao className="mb-6 p-5">
        <h2 className="mb-1 font-semibold text-stone-800">Receitas × gastos — últimos 12 meses</h2>
        <p className="mb-4 text-xs text-stone-500">Passe o mouse sobre um mês para ver os valores.</p>
        <GraficoMensal meses={meses} />
      </Cartao>

      <Cartao className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-stone-800">Últimos lançamentos</h2>
          <Link href="/lancamentos" className="text-sm text-folha-700 hover:underline">
            Ver todos
          </Link>
        </div>
        <ul className="divide-y divide-stone-100 text-sm">
          {recentes.map((l) => {
            const valor = l.partidas.reduce((s, p) => s + Math.max(p.valorCentavos, 0), 0);
            return (
              <li key={l.id}>
                <Link href={`/lancamentos/${l.id}`} title={l.historico ?? undefined} className="flex items-start justify-between gap-3 py-2 hover:bg-folha-50/60">
                  <span className="min-w-0 flex-1">
                    <span className="block tabular-nums text-stone-500">{dataBr(l.data)}</span>
                    <span className="block truncate text-stone-700">{l.historico}</span>
                  </span>
                  <span className="num shrink-0 font-medium">{reais(valor)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Cartao>
    </>
  );
}

export default function PainelPage() {
  return (
    <Pagina>
      <Conteudo />
    </Pagina>
  );
}
