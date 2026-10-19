import type { Metadata } from "next";
import { FormFinanciamento } from "@/components/financiamentos/FormFinanciamento";
import { Pagina } from "@/components/Pagina";
import { BotaoLinha } from "@/components/producao/Formularios";
import { Cabecalho, Cartao } from "@/components/ui";
import { contasAtivas } from "@/lib/consultas";
import { prisma } from "@/lib/db";
import { PERIODICIDADES, SISTEMAS, type Periodicidade, type Sistema } from "@/lib/financiamentos/calculo";
import { dataBr, reais } from "@/lib/formato";
import { hojeSP } from "@/lib/hoje";
import { CATEGORIAS_BAIXA } from "@/lib/titulos/categorias";
import { exigirUsuario } from "@/lib/usuario";
import { excluirFinanciamento } from "./acoes";

export const metadata: Metadata = { title: "Financiamentos" };

const iso = (d: Date) => d.toISOString().slice(0, 10);

async function Conteudo() {
  await exigirUsuario();
  const hoje = hojeSP();
  const [contas, financiamentos, saldosPassivo] = await Promise.all([
    contasAtivas(),
    prisma.financiamento.findMany({
      orderBy: { dataContratacao: "desc" },
      include: {
        contaPassivo: { select: { nome: true } },
        titulos: { orderBy: { vencimento: "asc" }, select: { id: true, vencimento: true, valorCentavos: true, jurosCentavos: true, status: true, baixadoEm: true, valorBaixaCentavos: true, parcela: true } },
      },
    }),
    prisma.partida.groupBy({ by: ["contaId"], where: { conta: { categoria: "Passivo Empréstimo" } }, _sum: { valorCentavos: true } }),
  ]);
  const passivos = contas.filter((c) => c.categoria === "Passivo Empréstimo");
  const juros = contas.filter((c) => c.categoria === "Despesa Financeira");
  const pagamento = contas.filter((c) => CATEGORIAS_BAIXA.includes(c.categoria));

  // Por contrato: o que falta pagar (amortização = saldo devedor; juros a pagar) e a próxima parcela.
  const resumo = financiamentos.map((f) => {
    const abertas = f.titulos.filter((t) => t.status === "ABERTO");
    const saldo = abertas.reduce((s, t) => s + t.valorCentavos - (t.jurosCentavos ?? 0), 0);
    const jurosFuturos = abertas.reduce((s, t) => s + (t.jurosCentavos ?? 0), 0);
    return { f, abertas, saldo, jurosFuturos, proxima: abertas[0] ?? null, pagas: f.titulos.length - abertas.length };
  });
  // Dívida no balanço × cadastrada em cronograma, por conta de empréstimo.
  const conferencia = passivos.map((c) => ({
    nome: c.nome,
    contabil: -(saldosPassivo.find((s) => s.contaId === c.id)?._sum.valorCentavos ?? 0),
    cronograma: resumo.filter((r) => r.f.contaPassivoId === c.id).reduce((s, r) => s + r.saldo, 0),
  }));

  return (
    <>
      <Cabecalho
        titulo="Financiamentos e empréstimos"
        subtitulo="Cada parcela vira uma conta a pagar com amortização e juros separados. No pagamento, a amortização abate a dívida e os juros entram como despesa financeira."
      />

      <Cartao className="mb-6 p-5">
        <h2 className="mb-1 font-semibold text-stone-800">Dívida no balanço × cronogramas cadastrados</h2>
        <p className="mb-3 text-xs text-stone-500">Diferença grande indica financiamento que ainda não foi cadastrado aqui (ou saldo a conferir com o banco).</p>
        <table className="w-full max-w-3xl text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs text-stone-500">
              <th className="py-1.5 font-medium">Conta</th>
              <th className="py-1.5 text-right font-medium">Saldo na contabilidade</th>
              <th className="py-1.5 text-right font-medium">Saldo pelos cronogramas</th>
              <th className="py-1.5 text-right font-medium">Diferença</th>
            </tr>
          </thead>
          <tbody>
            {conferencia.map((c) => (
              <tr key={c.nome} className="border-b border-stone-100">
                <td className="py-1.5">{c.nome}</td>
                <td className="num py-1.5">{reais(c.contabil)}</td>
                <td className="num py-1.5">{reais(c.cronograma)}</td>
                <td className={`num py-1.5 ${c.contabil - c.cronograma !== 0 ? "text-amber-700" : "text-folha-700"}`}>
                  {c.contabil - c.cronograma === 0 ? "✓" : reais(c.contabil - c.cronograma)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Cartao>

      <Cartao className="mb-6 p-5">
        <h2 className="mb-3 font-semibold text-stone-800">Cadastrar financiamento</h2>
        {passivos.length && juros.length ? (
          <FormFinanciamento passivos={passivos} juros={juros} pagamento={pagamento} hoje={hoje} />
        ) : (
          <p className="text-sm text-amber-800">Cadastre no Plano de contas uma conta “Passivo Empréstimo” e uma “Despesa Financeira”.</p>
        )}
      </Cartao>

      {resumo.length > 0 && (
        <Cartao className="p-5">
          <h2 className="mb-2 font-semibold text-stone-800">Contratos</h2>
          <ul className="divide-y divide-stone-100">
            {resumo.map(({ f, saldo, jurosFuturos, proxima, pagas }) => (
              <li key={f.id} className="py-3">
                <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-stone-800">
                      {f.descricao} — {f.credor}
                    </span>
                    <span className="block text-xs text-stone-500">
                      R$ {reais(f.valorCentavos)} · {f.taxaAnualPct.toLocaleString("pt-BR")}% a.a. · {SISTEMAS[f.sistema as Sistema] ?? f.sistema} ·{" "}
                      {PERIODICIDADES[f.periodicidadeMeses as Periodicidade] ?? `${f.periodicidadeMeses} meses`} · {f.contaPassivo.nome}
                      {f.observacao ? ` · ${f.observacao}` : ""}
                    </span>
                  </span>
                  <span className="text-right text-sm">
                    <span className="block tabular-nums">
                      saldo devedor <strong>R$ {reais(saldo)}</strong>
                    </span>
                    <span className="block text-xs text-stone-500 tabular-nums">juros a pagar R$ {reais(jurosFuturos)}</span>
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600">
                  <span>
                    {pagas} de {f.titulos.length} parcelas pagas
                  </span>
                  {proxima && (
                    <span className={iso(proxima.vencimento) < hoje ? "font-medium text-red-700" : ""}>
                      próxima: {dataBr(proxima.vencimento)} · R$ {reais(proxima.valorCentavos)}
                      {iso(proxima.vencimento) < hoje ? " (vencida)" : ""}
                    </span>
                  )}
                  <BotaoLinha perigo acao={excluirFinanciamento.bind(null, f.id)} confirmacao="Excluir este financiamento e as parcelas em aberto?">
                    excluir
                  </BotaoLinha>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-folha-700">Cronograma ({f.titulos.length} parcelas)</summary>
                  <table className="mt-1 w-full max-w-3xl text-xs tabular-nums">
                    <thead>
                      <tr className="text-left text-stone-500">
                        <th className="py-1 font-medium">#</th>
                        <th className="py-1 font-medium">Vencimento</th>
                        <th className="py-1 text-right font-medium">Amortização</th>
                        <th className="py-1 text-right font-medium">Juros</th>
                        <th className="py-1 text-right font-medium">Parcela</th>
                        <th className="py-1 font-medium">Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {f.titulos.map((t) => (
                        <tr key={t.id} className={t.status === "BAIXADO" ? "text-stone-400" : ""}>
                          <td className="py-0.5">{t.parcela}</td>
                          <td className="py-0.5">{dataBr(t.vencimento)}</td>
                          <td className="py-0.5 text-right">{reais(t.valorCentavos - (t.jurosCentavos ?? 0))}</td>
                          <td className="py-0.5 text-right">{reais(t.jurosCentavos ?? 0)}</td>
                          <td className="py-0.5 text-right">{reais(t.valorCentavos)}</td>
                          <td className="py-0.5">
                            {t.status === "BAIXADO" ? `paga ${t.baixadoEm ? dataBr(t.baixadoEm) : ""}${t.valorBaixaCentavos && t.valorBaixaCentavos !== t.valorCentavos ? ` (R$ ${reais(t.valorBaixaCentavos)})` : ""}` : iso(t.vencimento) < hoje ? "vencida" : "a pagar"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </li>
            ))}
          </ul>
          {resumo.some((r) => r.abertas.length) && (
            <p className="mt-3 text-xs text-stone-500">O pagamento das parcelas é feito em “A pagar e receber”, como qualquer conta.</p>
          )}
        </Cartao>
      )}
    </>
  );
}

export default function FinanciamentosPage() {
  return (
    <Pagina>
      <Conteudo />
    </Pagina>
  );
}
