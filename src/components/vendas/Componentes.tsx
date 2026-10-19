"use client";

import { useActionState, useState } from "react";
import {
  alternarCancelamento,
  criarVenda,
  desfazerEntrega,
  excluirVenda,
  fixarPreco,
  registrarEntrega,
  type EstadoVenda,
} from "@/app/(app)/vendas/acoes";
import { dataBr, reais } from "@/lib/formato";
import { MODALIDADES } from "@/lib/vendas/calculo";
import { BotaoLinha } from "../producao/Formularios";
import { botaoPrimario, campo } from "../ui";
import { cancelarReset, useCampos } from "../useCampos";

type Conta = { id: string; nome: string };
const qtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

function Retorno({ estado }: { estado: EstadoVenda }) {
  if (estado?.erro) return <span className="text-sm text-red-700">{estado.erro}</span>;
  if (estado?.ok) return <span className="text-sm text-folha-700">{estado.ok}</span>;
  return null;
}

export function FormNovaVenda({ slug, unidade, unidadeCurta, contas, hoje }: { slug: string; unidade: string; unidadeCurta: string; contas: Conta[]; hoje: string }) {
  const iniciais = {
    comprador: "",
    dataContrato: hoje,
    quantidade: "",
    modalidade: "PRONTA",
    preco: "",
    entregaPrevista: "",
    pagamentoPrevisto: "",
    contaReceitaId: contas[0]?.id ?? "",
    observacao: "",
  };
  const { valores, vincular, limpar } = useCampos(iniciais);
  const [entregueAgora, setEntregueAgora] = useState(false);
  const [estado, acao, gravando] = useActionState(async (e: EstadoVenda, f: FormData) => {
    const r = await criarVenda(slug, e, f);
    if (r?.ok) {
      limpar();
      setEntregueAgora(false);
    }
    return r;
  }, undefined);
  const aFixar = valores.modalidade === "A_FIXAR";

  return (
    <form action={acao} onReset={cancelarReset} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-stone-600">Comprador</span>
          <input {...vincular("comprador")} required placeholder="Ex.: Cooxupé, Cocapec, exportadora…" className={`${campo} mt-1`} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-stone-600">Data da venda</span>
          <input {...vincular("dataContrato")} type="date" required className={`${campo} mt-1`} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-stone-600">Modalidade</span>
          <select {...vincular("modalidade")} className={`${campo} mt-1`}>
            {Object.entries(MODALIDADES).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-stone-600">Quantidade ({unidade})</span>
          <input {...vincular("quantidade")} required inputMode="decimal" className={`${campo} mt-1 text-right tabular-nums`} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-stone-600">Preço por {unidadeCurta} (R$)</span>
          <input
            {...vincular("preco")}
            disabled={aFixar}
            required={!aFixar}
            inputMode="decimal"
            placeholder={aFixar ? "a fixar depois" : "0,00"}
            className={`${campo} mt-1 text-right tabular-nums disabled:bg-stone-100`}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-stone-600">Entrega prevista</span>
          <input {...vincular("entregaPrevista")} type="date" className={`${campo} mt-1`} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-stone-600">Pagamento previsto</span>
          <input {...vincular("pagamentoPrevisto")} type="date" className={`${campo} mt-1`} />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-stone-600">Conta de receita</span>
          <select {...vincular("contaReceitaId")} required className={`${campo} mt-1`}>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-stone-600">Observação</span>
          <input {...vincular("observacao")} placeholder="Ex.: tipo 6, bebida dura, peneira 17/18" className={`${campo} mt-1`} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" name="entregueAgora" checked={entregueAgora} onChange={(e) => setEntregueAgora(e.target.checked)} />
          Já entregue (dá saída do estoque{aFixar ? "" : " e lança a conta a receber"})
        </label>
        <button disabled={gravando} className={botaoPrimario}>
          {gravando ? "Gravando…" : "Registrar venda"}
        </button>
        <Retorno estado={estado} />
      </div>
    </form>
  );
}

export type EntregaTela = { id: string; data: string; quantidade: number; valorCentavos: number | null; titulo: "ABERTO" | "BAIXADO" | null };
export type ContratoTela = {
  id: string;
  comprador: string;
  dataContrato: string;
  quantidade: number;
  precoUnitarioCentavos: number | null;
  modalidade: keyof typeof MODALIDADES;
  entregaPrevista: string | null;
  pagamentoPrevisto: string | null;
  observacao: string | null;
  situacao: "ABERTA" | "CONCLUIDA" | "CANCELADA";
  entregue: number;
  falta: number;
  entregas: EntregaTela[];
};

export function LinhaContrato({ c, unidadeCurta, hoje }: { c: ContratoTela; unidadeCurta: string; hoje: string }) {
  const [aberto, setAberto] = useState<"nada" | "entrega" | "preco">("nada");
  const entregaForm = useCampos({ data: hoje, quantidade: String(c.falta).replace(".", ","), vencimento: c.pagamentoPrevisto ?? "" });
  const precoForm = useCampos({ preco: "", vencimento: c.pagamentoPrevisto ?? "" });
  const [estadoEntrega, acaoEntrega, entregando] = useActionState(async (e: EstadoVenda, f: FormData) => {
    const r = await registrarEntrega(c.id, e, f);
    if (r?.ok) setAberto("nada");
    return r;
  }, undefined);
  const [estadoPreco, acaoPreco, fixando] = useActionState(async (e: EstadoVenda, f: FormData) => {
    const r = await fixarPreco(c.id, e, f);
    if (r?.ok) setAberto("nada");
    return r;
  }, undefined);
  const pct = c.quantidade > 0 ? Math.min(100, (c.entregue / c.quantidade) * 100) : 0;
  const valor = c.precoUnitarioCentavos === null ? null : Math.round(c.quantidade * c.precoUnitarioCentavos);

  return (
    <li className={`border-b border-stone-100 py-3 last:border-0 ${c.situacao === "CANCELADA" ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
        <span className="w-20 shrink-0 tabular-nums text-sm text-stone-600">{dataBr(c.dataContrato)}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-stone-800">
            {c.comprador}
            <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-[11px] font-normal text-stone-600">{MODALIDADES[c.modalidade]}</span>
            {c.situacao === "CANCELADA" && <span className="ml-1 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-normal text-red-700">cancelada</span>}
            {c.situacao === "CONCLUIDA" && <span className="ml-1 rounded bg-folha-50 px-1.5 py-0.5 text-[11px] font-normal text-folha-700">entregue</span>}
          </span>
          <span className="mt-1 flex items-center gap-2 text-xs text-stone-500">
            <span className="h-1.5 w-28 overflow-hidden rounded-full bg-stone-100">
              <span className="block h-full rounded-full bg-folha-600" style={{ width: `${pct}%` }} />
            </span>
            {qtd(c.entregue)} de {qtd(c.quantidade)} {unidadeCurta} entregues
            {c.entregaPrevista && c.falta > 0 && c.situacao === "ABERTA" ? ` · entrega prevista ${dataBr(c.entregaPrevista)}` : ""}
          </span>
          {c.observacao && <span className="block text-xs text-stone-500">{c.observacao}</span>}
        </span>
        <span className="text-right text-sm">
          <span className="block font-medium tabular-nums">
            {c.precoUnitarioCentavos === null ? <span className="text-amber-700">preço a fixar</span> : `R$ ${reais(c.precoUnitarioCentavos)}/${unidadeCurta}`}
          </span>
          {valor !== null && <span className="block text-xs text-stone-500 tabular-nums">total R$ {reais(valor)}</span>}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 pl-24 text-xs">
        {c.situacao === "ABERTA" && (
          <button type="button" onClick={() => setAberto(aberto === "entrega" ? "nada" : "entrega")} className="rounded-md border border-folha-600 px-2.5 py-1 font-medium text-folha-700 hover:bg-folha-50">
            Registrar entrega
          </button>
        )}
        {c.precoUnitarioCentavos === null && c.situacao !== "CANCELADA" && (
          <button type="button" onClick={() => setAberto(aberto === "preco" ? "nada" : "preco")} className="rounded-md border border-amber-500 px-2.5 py-1 font-medium text-amber-800 hover:bg-amber-50">
            Fixar preço
          </button>
        )}
        {c.situacao !== "CONCLUIDA" && (
          <BotaoLinha
            perigo={c.situacao === "ABERTA"}
            acao={alternarCancelamento.bind(null, c.id)}
            confirmacao={c.situacao === "CANCELADA" ? "Reativar esta venda?" : "Cancelar o que falta entregar desta venda? As entregas feitas continuam valendo."}
          >
            {c.situacao === "CANCELADA" ? "reativar" : "cancelar saldo"}
          </BotaoLinha>
        )}
        {c.entregas.length === 0 && (
          <BotaoLinha perigo acao={excluirVenda.bind(null, c.id)} confirmacao="Excluir esta venda (lançada por engano)?">
            excluir
          </BotaoLinha>
        )}
      </div>

      {aberto === "entrega" && (
        <form action={acaoEntrega} onReset={cancelarReset} className="mt-2 ml-24 flex flex-wrap items-end gap-2 rounded-md bg-stone-50 p-3">
          <label className="block">
            <span className="text-xs text-stone-600">Data da entrega</span>
            <input {...entregaForm.vincular("data")} type="date" required className={`${campo} mt-0.5 w-40!`} />
          </label>
          <label className="block">
            <span className="text-xs text-stone-600">Quantidade ({unidadeCurta})</span>
            <input {...entregaForm.vincular("quantidade")} required inputMode="decimal" className={`${campo} mt-0.5 w-28! text-right tabular-nums`} />
          </label>
          {c.precoUnitarioCentavos !== null && (
            <label className="block">
              <span className="text-xs text-stone-600">Vencimento do recebimento</span>
              <input {...entregaForm.vincular("vencimento")} type="date" className={`${campo} mt-0.5 w-40!`} />
            </label>
          )}
          <button disabled={entregando} className="rounded-md bg-folha-700 px-3 py-2 text-sm font-medium text-white hover:bg-folha-800 disabled:opacity-50">
            {entregando ? "Gravando…" : "Confirmar entrega"}
          </button>
          <Retorno estado={estadoEntrega} />
          {c.precoUnitarioCentavos === null && <p className="w-full text-xs text-amber-800">Preço a fixar: a conta a receber é criada quando o preço for fixado.</p>}
        </form>
      )}

      {aberto === "preco" && (
        <form action={acaoPreco} onReset={cancelarReset} className="mt-2 ml-24 flex flex-wrap items-end gap-2 rounded-md bg-amber-50/60 p-3">
          <label className="block">
            <span className="text-xs text-stone-600">Preço fixado por {unidadeCurta} (R$)</span>
            <input {...precoForm.vincular("preco")} required inputMode="decimal" className={`${campo} mt-0.5 w-36! text-right tabular-nums`} />
          </label>
          <label className="block">
            <span className="text-xs text-stone-600">Vencimento do recebimento</span>
            <input {...precoForm.vincular("vencimento")} type="date" className={`${campo} mt-0.5 w-40!`} />
          </label>
          <button disabled={fixando} className="rounded-md bg-folha-700 px-3 py-2 text-sm font-medium text-white hover:bg-folha-800 disabled:opacity-50">
            {fixando ? "Gravando…" : "Fixar"}
          </button>
          <Retorno estado={estadoPreco} />
        </form>
      )}

      {c.entregas.length > 0 && (
        <ul className="mt-2 ml-24 space-y-0.5 text-xs text-stone-600">
          {c.entregas.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-x-3">
              <span className="tabular-nums">{dataBr(e.data)}</span>
              <span className="tabular-nums">
                {qtd(e.quantidade)} {unidadeCurta}
              </span>
              <span className="tabular-nums">{e.valorCentavos === null ? "sem preço" : `R$ ${reais(e.valorCentavos)}`}</span>
              <span className={e.titulo === "BAIXADO" ? "text-folha-700" : e.titulo === "ABERTO" ? "text-amber-800" : "text-stone-400"}>
                {e.titulo === "BAIXADO" ? "recebido" : e.titulo === "ABERTO" ? "a receber" : "aguardando preço"}
              </span>
              <BotaoLinha perigo acao={desfazerEntrega.bind(null, e.id)} confirmacao="Desfazer esta entrega? A saída do estoque e a conta a receber são apagadas.">
                desfazer
              </BotaoLinha>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
