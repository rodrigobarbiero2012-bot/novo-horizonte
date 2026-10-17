import { FormularioCotacaoManual } from "../FormularioCotacaoManual";
import { Cartao } from "../ui";
import { registrarCotacaoManual } from "@/app/(app)/acoes-cotacao";
import { PRODUTOS } from "@/lib/cotacoes/produtos";
import type { ResumoCotacao } from "@/lib/consultas";
import { dataBr } from "@/lib/formato";

const DIAS_DESATUALIZADA = 5;

/** Uma cotação: valor do dia, variação na semana, linha dos últimos 30 dias e a fonte. */
export function CartaoCotacao({ cotacao, hoje }: { cotacao: ResumoCotacao; hoje: string }) {
  const produto = PRODUTOS[cotacao.produto];
  const { atual, semanaAntes, serie } = cotacao;
  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: produto.casas, maximumFractionDigits: produto.casas });
  const variacaoSemana = atual && semanaAntes ? (atual.valor - semanaAntes) / semanaAntes : null;
  const diasSemAtualizar = atual ? Math.round((Date.parse(hoje) - Date.parse(atual.data)) / 86_400_000) : null;

  return (
    <Cartao className="flex flex-col p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{produto.nome}</p>
      {atual ? (
        <>
          <p className="mt-1 text-xl font-semibold tabular-nums">{fmt(atual.valor)}</p>
          <p className="text-xs text-stone-500">
            {produto.unidade} · {dataBr(atual.data)}
          </p>
          <p className="mt-1 text-xs text-stone-600">
            {variacaoSemana === null
              ? "sem base na semana"
              : `${variacaoSemana >= 0 ? "▲" : "▼"} ${Math.abs(variacaoSemana).toLocaleString("pt-BR", { style: "percent", maximumFractionDigits: 1 })} em 7 dias`}
          </p>
          {serie.length > 1 && <Linha serie={serie} rotulo={`${produto.nome}, últimos 30 dias`} />}
          {produto.automatica && diasSemAtualizar !== null && diasSemAtualizar > DIAS_DESATUALIZADA && (
            <p className="mt-1 text-xs text-amber-700">⚠ sem atualização há {diasSemAtualizar} dias</p>
          )}
        </>
      ) : (
        <p className="mt-1 text-sm text-stone-500">{produto.automatica ? "Aguardando a primeira coleta." : "Nenhum preço registrado."}</p>
      )}
      <div className="mt-auto pt-2 text-[11px] text-stone-400">
        {produto.url ? (
          <a href={produto.url} target="_blank" rel="noreferrer" className="hover:underline">
            Fonte: {produto.fonte}
          </a>
        ) : (
          <>Fonte: {produto.fonte}</>
        )}
      </div>
      {!produto.automatica && <FormularioCotacaoManual produto={cotacao.produto} acao={registrarCotacaoManual} />}
    </Cartao>
  );
}

/** Linha fina dos últimos 30 dias (uma série, sem eixo: mostra só a tendência). */
function Linha({ serie, rotulo }: { serie: { data: string; valor: number }[]; rotulo: string }) {
  const valores = serie.map((s) => s.valor);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const largura = 120;
  const altura = 28;
  const pontos = serie
    .map((s, i) => `${((i / (serie.length - 1)) * largura).toFixed(1)},${(altura - 2 - ((s.valor - min) / (max - min || 1)) * (altura - 4)).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${largura} ${altura}`} className="mt-2 h-7 w-full" role="img" aria-label={rotulo}>
      <title>{`${rotulo}: de ${valores[0].toLocaleString("pt-BR")} a ${valores.at(-1)!.toLocaleString("pt-BR")}`}</title>
      <polyline points={pontos} fill="none" stroke="var(--color-folha-600)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
