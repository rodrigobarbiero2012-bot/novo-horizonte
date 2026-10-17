import type { Mes } from "@/lib/contabil/painel";
import { MESES, reais } from "@/lib/formato";

// Paleta validada (scripts/validate_palette.js da skill de dataviz): azul e
// laranja passam no teste de daltonismo; o verde/terra do tema não passava.
const COR_RECEITAS = "#2a78d6";
const COR_GASTOS = "#eb6834";

/** Centavos → R$ mil com uma casa: 5465638 → "54,7". */
const emMil = (centavos: number) => (centavos / 100_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

const rotuloMes = (mes: string) => `${MESES[Number(mes.slice(5)) - 1]}/${mes.slice(2, 4)}`;

/**
 * Receitas × gastos operacionais por mês (barras agrupadas, um eixo em R$).
 * Os aportes do sócio vão numa linha de números embaixo, não num segundo eixo.
 */
export function GraficoMensal({ meses }: { meses: Mes[] }) {
  const maior = Math.max(1, ...meses.flatMap((m) => [m.receitas, m.gastos]));
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-stone-600">
        <Legenda cor={COR_RECEITAS} rotulo="Receitas" />
        <Legenda cor={COR_GASTOS} rotulo="Gastos (custeio + despesas)" />
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[36rem]">
          <div className="flex h-40 items-end gap-1 border-b border-stone-300">
            {meses.map((m) => (
              <div
                key={m.mes}
                className="flex h-full flex-1 items-end justify-center gap-[2px] rounded-sm px-0.5 hover:bg-stone-100"
                title={`${rotuloMes(m.mes)}\nReceitas: R$ ${reais(m.receitas)}\nGastos: R$ ${reais(m.gastos)}\nAportes do sócio: R$ ${reais(m.aportesSocio)}`}
              >
                <Barra valor={m.receitas} maior={maior} cor={COR_RECEITAS} />
                <Barra valor={m.gastos} maior={maior} cor={COR_GASTOS} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-1 text-center text-[11px] text-stone-500">
            {meses.map((m) => (
              <span key={m.mes} className="flex-1">
                {rotuloMes(m.mes)}
              </span>
            ))}
          </div>
          <div className="mt-2 flex items-baseline gap-1 border-t border-stone-100 pt-2 text-center text-[11px] tabular-nums text-stone-600">
            {meses.map((m) => (
              <span key={m.mes} className={`flex-1 ${m.aportesSocio < 0 ? "neg" : ""}`}>
                {m.aportesSocio === 0 ? "–" : emMil(m.aportesSocio)}
              </span>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-stone-500">Linha de baixo: aportes líquidos do sócio no mês, em R$ mil.</p>
        </div>
      </div>
      <details className="mt-3 text-xs text-stone-600">
        <summary className="cursor-pointer text-folha-700">Ver em tabela</summary>
        <table className="mt-2 w-full">
          <thead className="text-stone-500">
            <tr>
              <th className="py-1 text-left font-medium">Mês</th>
              <th className="py-1 text-right font-medium">Receitas</th>
              <th className="py-1 text-right font-medium">Gastos</th>
              <th className="py-1 text-right font-medium">Aportes do sócio</th>
            </tr>
          </thead>
          <tbody>
            {meses.map((m) => (
              <tr key={m.mes} className="border-t border-stone-100">
                <td className="py-1">{rotuloMes(m.mes)}</td>
                <td className="num py-1">{reais(m.receitas)}</td>
                <td className="num py-1">{reais(m.gastos)}</td>
                <td className="num py-1">{reais(m.aportesSocio)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function Barra({ valor, maior, cor }: { valor: number; maior: number; cor: string }) {
  const altura = Math.max(0, valor) / maior;
  return <div className="w-1/3 max-w-4 rounded-t" style={{ height: `${altura * 100}%`, minHeight: valor > 0 ? 2 : 0, background: cor }} />;
}

function Legenda({ cor, rotulo }: { cor: string; rotulo: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: cor }} />
      {rotulo}
    </span>
  );
}
