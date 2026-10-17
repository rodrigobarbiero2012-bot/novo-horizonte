import { Cartao, Valor } from "../ui";

type Props = {
  rotulo: string;
  centavos: number;
  /** Texto curto de comparação, ex.: "▲ 12% vs mesmo período de 2025". */
  comparacao?: string;
  nota?: string;
};

/** Número-chave do painel (stat tile): rótulo, valor e uma linha de contexto. */
export function Indicador({ rotulo, centavos, comparacao, nota }: Props) {
  return (
    <Cartao className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{rotulo}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">
        <Valor centavos={centavos} />
      </p>
      {comparacao && <p className="mt-0.5 text-xs text-stone-500">{comparacao}</p>}
      {nota && <p className="mt-0.5 text-xs text-stone-500">{nota}</p>}
    </Cartao>
  );
}

/** "▲ 12% vs …" / "▼ 8% vs …"; sem base de comparação, "sem base em …". */
export function textoComparacao(v: number | null, referencia: string) {
  if (v === null) return `sem base em ${referencia}`;
  const pct = Math.abs(v).toLocaleString("pt-BR", { style: "percent", maximumFractionDigits: 0 });
  return `${v >= 0 ? "▲" : "▼"} ${pct} vs ${referencia}`;
}
