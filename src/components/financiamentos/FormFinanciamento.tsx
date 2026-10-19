"use client";

import { useActionState, useState } from "react";
import { criarFinanciamento, type EstadoFinanciamento } from "@/app/(app)/financiamentos/acoes";
import { lerValorBr } from "@/lib/contabil/lancamento";
import { dataBr, reais } from "@/lib/formato";
import { ehPeriodicidade, ehSistema, gerarCronograma, PERIODICIDADES, SISTEMAS } from "@/lib/financiamentos/calculo";
import { ehDataIso, lerNumeroBr } from "@/lib/validacao";
import { botaoPrimario, campo } from "../ui";
import { cancelarReset, useCampos } from "../useCampos";

type Conta = { id: string; nome: string };

export function FormFinanciamento({ passivos, juros, pagamento, hoje }: { passivos: Conta[]; juros: Conta[]; pagamento: Conta[]; hoje: string }) {
  const { valores, vincular, limpar } = useCampos({
    credor: "",
    descricao: "",
    contaPassivoId: passivos[0]?.id ?? "",
    contaJurosId: juros[0]?.id ?? "",
    valor: "",
    taxaAnual: "",
    sistema: "SAC",
    periodicidade: "12",
    parcelas: "",
    carencia: "0",
    dataContratacao: hoje,
    primeiroVencimento: "",
    contaLiberacaoId: pagamento[0]?.id ?? "",
    observacao: "",
  });
  const [liberacao, setLiberacao] = useState(false);
  const [estado, acao, gravando] = useActionState(async (e: EstadoFinanciamento, f: FormData) => {
    const r = await criarFinanciamento(e, f);
    if (r?.ok) {
      limpar();
      setLiberacao(false);
    }
    return r;
  }, undefined);

  // Simulação com o que já foi digitado.
  const valor = lerValorBr(valores.valor);
  const taxa = lerNumeroBr(valores.taxaAnual);
  const parcelas = lerNumeroBr(valores.parcelas);
  const carencia = lerNumeroBr(valores.carencia) ?? 0;
  const periodicidade = Number(valores.periodicidade);
  const simulacao =
    valor && valor > 0 && taxa !== null && taxa >= 0 && parcelas && Number.isInteger(parcelas) && parcelas > 0 && parcelas <= 480 && ehSistema(valores.sistema) && ehPeriodicidade(periodicidade) && ehDataIso(valores.primeiroVencimento)
      ? gerarCronograma({ valorCentavos: valor, taxaAnualPct: taxa, parcelas, carencia: Math.max(0, Math.trunc(carencia)), sistema: valores.sistema, periodicidadeMeses: periodicidade, primeiroVencimento: valores.primeiroVencimento })
      : null;
  const totalJuros = simulacao?.reduce((s, p) => s + p.juros, 0) ?? 0;

  return (
    <form action={acao} onReset={cancelarReset} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="text-xs font-medium text-stone-600">Banco / credor</span>
          <input {...vincular("credor")} required placeholder="BB, Cocred, Bradesco…" className={`${campo} mt-1`} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-stone-600">Finalidade / linha</span>
          <input {...vincular("descricao")} required placeholder="Pronaf investimento, custeio café, trator…" className={`${campo} mt-1`} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-stone-600">Conta do empréstimo</span>
          <select {...vincular("contaPassivoId")} className={`${campo} mt-1`}>
            {passivos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-stone-600">Conta dos juros</span>
          <select {...vincular("contaJurosId")} className={`${campo} mt-1`}>
            {juros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-stone-600">Valor (ou saldo devedor de hoje)</span>
          <input {...vincular("valor")} required inputMode="decimal" placeholder="0,00" className={`${campo} mt-1 text-right tabular-nums`} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-stone-600">Juros ao ano (%)</span>
          <input {...vincular("taxaAnual")} required inputMode="decimal" placeholder="ex.: 8,5" className={`${campo} mt-1 text-right tabular-nums`} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-stone-600">Sistema</span>
          <select {...vincular("sistema")} className={`${campo} mt-1`}>
            {Object.entries(SISTEMAS).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-stone-600">Parcelas</span>
          <select {...vincular("periodicidade")} className={`${campo} mt-1`}>
            {Object.entries(PERIODICIDADES).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-stone-600">Nº de parcelas (que faltam)</span>
          <input {...vincular("parcelas")} required inputMode="numeric" className={`${campo} mt-1 text-right tabular-nums`} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-stone-600">Carência (períodos só de juros)</span>
          <input {...vincular("carencia")} inputMode="numeric" className={`${campo} mt-1 text-right tabular-nums`} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-stone-600">Data da contratação</span>
          <input {...vincular("dataContratacao")} type="date" required className={`${campo} mt-1`} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-stone-600">1º vencimento (que falta)</span>
          <input {...vincular("primeiroVencimento")} type="date" required className={`${campo} mt-1`} />
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" name="registrarLiberacao" checked={liberacao} onChange={(e) => setLiberacao(e.target.checked)} />
          Contrato novo: lançar a entrada do dinheiro
        </label>
        {liberacao && (
          <label className="block">
            <span className="text-xs text-stone-600">Entrou em</span>
            <select {...vincular("contaLiberacaoId")} className={`${campo} mt-0.5 w-56!`}>
              {pagamento.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block min-w-60 flex-1">
          <span className="text-xs text-stone-600">Observação</span>
          <input {...vincular("observacao")} placeholder="nº do contrato, garantia, seguro…" className={`${campo} mt-0.5`} />
        </label>
      </div>
      {!liberacao && (
        <p className="text-xs text-stone-500">
          Contrato antigo (já está na contabilidade): informe o saldo devedor de hoje, as parcelas que faltam e o próximo vencimento — a liberação não é
          lançada de novo.
        </p>
      )}

      {simulacao && (
        <div className="rounded-md bg-stone-50 p-3">
          <p className="mb-2 text-sm text-stone-700">
            Simulação: {simulacao.length} parcelas · juros totais <strong>R$ {reais(totalJuros)}</strong> · total pago R$ {reais((valor ?? 0) + totalJuros)}
          </p>
          <div className="max-h-56 overflow-y-auto">
            <table className="w-full text-xs tabular-nums">
              <thead>
                <tr className="text-left text-stone-500">
                  <th className="py-1 font-medium">#</th>
                  <th className="py-1 font-medium">Vencimento</th>
                  <th className="py-1 text-right font-medium">Amortização</th>
                  <th className="py-1 text-right font-medium">Juros</th>
                  <th className="py-1 text-right font-medium">Parcela</th>
                  <th className="py-1 text-right font-medium">Saldo depois</th>
                </tr>
              </thead>
              <tbody>
                {simulacao.map((p) => (
                  <tr key={p.numero} className={p.carencia ? "text-stone-500" : ""}>
                    <td className="py-0.5">{p.numero}</td>
                    <td className="py-0.5">{dataBr(p.vencimento)}</td>
                    <td className="py-0.5 text-right">{reais(p.amortizacao)}</td>
                    <td className="py-0.5 text-right">{reais(p.juros)}</td>
                    <td className="py-0.5 text-right font-medium">{reais(p.parcela)}</td>
                    <td className="py-0.5 text-right">{reais(p.saldoDepois)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={gravando} className={botaoPrimario}>
          {gravando ? "Gravando…" : "Cadastrar e gerar parcelas"}
        </button>
        {estado?.erro && <span className="text-sm text-red-700">{estado.erro}</span>}
        {estado?.ok && <span className="text-sm text-folha-700">{estado.ok}</span>}
      </div>
    </form>
  );
}
