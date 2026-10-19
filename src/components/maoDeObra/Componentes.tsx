"use client";

import { useActionState, useState } from "react";
import { fecharPeriodo, registrarDia, salvarTrabalhador, type EstadoMaoDeObra } from "@/app/(app)/mao-de-obra/acoes";
import { lerValorBr } from "@/lib/contabil/lancamento";
import { dataBr, reais } from "@/lib/formato";
import { ATIVIDADES_MAO_DE_OBRA, contaSugerida, resumirFechamento, SERVICOS, TIPOS_TRABALHADOR, valorApontamento, type AtividadeMaoDeObra } from "@/lib/maoDeObra/calculo";
import { lerNumeroBr } from "@/lib/validacao";
import { botaoPrimario, campo } from "../ui";
import { cancelarReset, useCampos } from "../useCampos";

const qtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const curto = `${campo.replace("w-full", "")} px-2 py-1 text-right tabular-nums`;

function Retorno({ estado }: { estado: EstadoMaoDeObra }) {
  if (estado?.erro) return <span className="text-sm text-red-700">{estado.erro}</span>;
  if (estado?.ok) return <span className="text-sm text-folha-700">{estado.ok}</span>;
  return null;
}

export type Pessoa = { id: string; nome: string; tipo: string; diariaCentavos: number | null; precoUnidadeCentavos: number | null };
type ContaCusteio = { id: string; nome: string; atividade: string };

export function FormTrabalhador() {
  const { vincular, limpar } = useCampos({ nome: "", tipo: "DIARISTA", diaria: "", precoUnidade: "", observacao: "" });
  const [estado, acao, gravando] = useActionState(async (e: EstadoMaoDeObra, f: FormData) => {
    const r = await salvarTrabalhador(e, f);
    if (r?.ok) limpar();
    return r;
  }, undefined);
  return (
    <form action={acao} onReset={cancelarReset} className="flex flex-wrap items-end gap-2">
      <label className="block">
        <span className="text-xs text-stone-600">Nome</span>
        <input {...vincular("nome")} required className={`${campo} mt-0.5 w-48!`} />
      </label>
      <label className="block">
        <span className="text-xs text-stone-600">Tipo</span>
        <select {...vincular("tipo")} className={`${campo} mt-0.5 w-56!`}>
          {Object.entries(TIPOS_TRABALHADOR).map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-xs text-stone-600">Diária (R$)</span>
        <input {...vincular("diaria")} inputMode="decimal" placeholder="0,00" className={`${curto} mt-0.5 w-28 py-2`} />
      </label>
      <label className="block">
        <span className="text-xs text-stone-600">Por lata/caixa (R$)</span>
        <input {...vincular("precoUnidade")} inputMode="decimal" placeholder="0,00" className={`${curto} mt-0.5 w-28 py-2`} />
      </label>
      <label className="block">
        <span className="text-xs text-stone-600">Observação</span>
        <input {...vincular("observacao")} placeholder="PIX, telefone…" className={`${campo} mt-0.5 w-56!`} />
      </label>
      <button disabled={gravando} className={botaoPrimario}>
        {gravando ? "Gravando…" : "Cadastrar"}
      </button>
      <Retorno estado={estado} />
    </form>
  );
}

/** Apontamento de um dia para a turma: marca quem trabalhou, dias e o que colheu. */
export function FormDia({ equipe, contas, hoje }: { equipe: Pessoa[]; contas: ContaCusteio[]; hoje: string }) {
  const [comum, setComum] = useState({ data: hoje, atividade: "CAFE" as AtividadeMaoDeObra, servico: "Colheita" });
  const [contaEscolhida, setContaEscolhida] = useState<string | null>(null);
  const contaId = contaEscolhida ?? contaSugerida(comum.atividade, comum.servico, contas) ?? "";
  const linhaInicial = (p: Pessoa) => ({ marcado: false, dias: p.tipo === "EMPREITA" ? "" : "1", qtd: "", valor: "" });
  const [linhas, setLinhas] = useState(() => Object.fromEntries(equipe.map((p) => [p.id, linhaInicial(p)])));
  const [estado, acao, gravando] = useActionState(async (e: EstadoMaoDeObra, f: FormData) => {
    const r = await registrarDia(e, f);
    if (r?.ok) setLinhas(Object.fromEntries(equipe.map((p) => [p.id, linhaInicial(p)])));
    return r;
  }, undefined);
  // Pessoa cadastrada depois que a tela abriu ainda não tem linha no estado: usa a inicial.
  const linhaDe = (p: Pessoa) => linhas[p.id] ?? linhaInicial(p);
  const mudar = (p: Pessoa, campoAlterado: Partial<ReturnType<typeof linhaInicial>>) => setLinhas((l) => ({ ...l, [p.id]: { ...(l[p.id] ?? linhaInicial(p)), ...campoAlterado } }));

  const valorDe = (p: Pessoa) => {
    const l = linhaDe(p);
    const digitado = lerValorBr(l.valor);
    if (digitado !== null && !Number.isNaN(digitado)) return digitado;
    return valorApontamento(lerNumeroBr(l.dias) ?? 0, p.diariaCentavos, lerNumeroBr(l.qtd), p.precoUnidadeCentavos);
  };
  const total = equipe.filter((p) => linhaDe(p).marcado).reduce((s, p) => s + valorDe(p), 0);

  if (!equipe.length) return <p className="text-sm text-stone-500">Cadastre a equipe (abaixo) para começar os apontamentos.</p>;

  return (
    <form action={acao} onReset={cancelarReset} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="text-xs font-medium text-stone-600">Data</span>
          <input name="data" type="date" required value={comum.data} onChange={(e) => setComum({ ...comum, data: e.target.value })} className={`${campo} mt-1`} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-stone-600">Atividade</span>
          <select name="atividade" value={comum.atividade} onChange={(e) => setComum({ ...comum, atividade: e.target.value as AtividadeMaoDeObra })} className={`${campo} mt-1`}>
            {Object.entries(ATIVIDADES_MAO_DE_OBRA).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-stone-600">Serviço</span>
          <input name="servico" list="servicos" required value={comum.servico} onChange={(e) => setComum({ ...comum, servico: e.target.value })} className={`${campo} mt-1`} />
          <datalist id="servicos">
            {SERVICOS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-stone-600">Conta de custeio</span>
          <select name="contaId" required value={contaId} onChange={(e) => setContaEscolhida(e.target.value)} className={`${campo} mt-1`}>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs text-stone-500">
              <th className="py-1.5 pr-2 font-medium">Quem trabalhou</th>
              <th className="px-2 py-1.5 text-right font-medium">Dias</th>
              <th className="px-2 py-1.5 text-right font-medium">Colhido (latas/cx)</th>
              <th className="px-2 py-1.5 text-right font-medium">Valor (R$)</th>
            </tr>
          </thead>
          <tbody>
            {equipe.map((p) => {
              const l = linhaDe(p);
              return (
                <tr key={p.id} className={`border-b border-stone-100 ${l.marcado ? "" : "text-stone-400"}`}>
                  <td className="py-1 pr-2">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="pessoa" value={p.id} checked={l.marcado} onChange={(e) => mudar(p, { marcado: e.target.checked })} />
                      <span className={l.marcado ? "text-stone-800" : ""}>{p.nome}</span>
                      <span className="text-[11px] text-stone-400">
                        {p.diariaCentavos ? `diária ${reais(p.diariaCentavos)}` : ""}
                        {p.diariaCentavos && p.precoUnidadeCentavos ? " · " : ""}
                        {p.precoUnidadeCentavos ? `${reais(p.precoUnidadeCentavos)}/lata` : ""}
                      </span>
                    </label>
                  </td>
                  <td className="px-2 py-1 text-right">
                    <input name={`dias:${p.id}`} value={l.dias} onChange={(e) => mudar(p, { dias: e.target.value, marcado: true })} inputMode="decimal" className={`${curto} w-16`} />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <input name={`qtd:${p.id}`} value={l.qtd} onChange={(e) => mudar(p, { qtd: e.target.value, marcado: true })} inputMode="decimal" className={`${curto} w-20`} />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <input
                      name={`valor:${p.id}`}
                      value={l.valor}
                      onChange={(e) => mudar(p, { valor: e.target.value, marcado: true })}
                      inputMode="decimal"
                      placeholder={reais(valorDe(p))}
                      className={`${curto} w-28`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button disabled={gravando} className={botaoPrimario}>
          {gravando ? "Gravando…" : "Registrar dia"}
        </button>
        <span className="text-sm text-stone-600 tabular-nums">Total do dia: R$ {reais(total)}</span>
        <Retorno estado={estado} />
      </div>
      <p className="text-xs text-stone-500">
        O valor é calculado pela diária e pelo preço por lata cadastrados; digite no campo “Valor” para usar outro.
      </p>
    </form>
  );
}

export type AbertoTela = { id: string; trabalhadorId: string; nome: string; data: string; contaId: string; dias: number; quantidade: number | null; valorCentavos: number };

/** Fechamento do período com prévia de quanto pagar a cada pessoa. */
export function FormFechamento({ abertos, contasPagamento, contaPadrao, hoje }: { abertos: AbertoTela[]; contasPagamento: { id: string; nome: string }[]; contaPadrao: string | null; hoje: string }) {
  const maisAntigo = abertos.reduce((m, a) => (a.data < m ? a.data : m), hoje);
  const { valores, vincular } = useCampos({ inicio: maisAntigo, fim: hoje, dataPagamento: hoje, contaPagamentoId: contaPadrao ?? contasPagamento[0]?.id ?? "" });
  const [estado, acao, gravando] = useActionState(fecharPeriodo, undefined);
  const noPeriodo = abertos.filter((a) => a.data >= valores.inicio && a.data <= valores.fim);
  const r = resumirFechamento(noPeriodo);

  return (
    <form action={acao} onReset={cancelarReset} className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="text-xs text-stone-600">De</span>
          <input {...vincular("inicio")} type="date" required className={`${campo} mt-0.5 w-40!`} />
        </label>
        <label className="block">
          <span className="text-xs text-stone-600">Até</span>
          <input {...vincular("fim")} type="date" required className={`${campo} mt-0.5 w-40!`} />
        </label>
        <label className="block">
          <span className="text-xs text-stone-600">Pago em</span>
          <input {...vincular("dataPagamento")} type="date" required className={`${campo} mt-0.5 w-40!`} />
        </label>
        <label className="block">
          <span className="text-xs text-stone-600">Pago com</span>
          <select {...vincular("contaPagamentoId")} required className={`${campo} mt-0.5 w-56!`}>
            {contasPagamento.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <button disabled={gravando || !noPeriodo.length} className={botaoPrimario}>
          {gravando ? "Lançando…" : `Fechar e lançar R$ ${reais(r.totalCentavos)}`}
        </button>
        <Retorno estado={estado} />
      </div>
      {noPeriodo.length > 0 ? (
        <table className="w-full max-w-xl text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs text-stone-500">
              <th className="py-1.5 font-medium">Pagar a</th>
              <th className="py-1.5 text-right font-medium">Dias</th>
              <th className="py-1.5 text-right font-medium">Colhido</th>
              <th className="py-1.5 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            {r.porPessoa.map((p) => (
              <tr key={p.trabalhadorId} className="border-b border-stone-100">
                <td className="py-1">{p.nome}</td>
                <td className="num py-1">{p.dias ? qtd(p.dias) : ""}</td>
                <td className="num py-1">{p.quantidade ? qtd(p.quantidade) : ""}</td>
                <td className="num py-1 font-medium">{reais(p.valorCentavos)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-stone-500">Nada em aberto entre {dataBr(valores.inicio)} e {dataBr(valores.fim)}.</p>
      )}
    </form>
  );
}
