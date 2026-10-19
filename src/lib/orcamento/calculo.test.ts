import { describe, expect, it } from "vitest";
import { dreAnual } from "../contabil/relatorios";
import type { PartidaContabil } from "../contabil/tipos";
import { ajustar, chaveInvestimento, comparar, distribuir, matrizVazia, mesDeCorte, realizadoInvestimentos, realizadoMensal, SINAL, sinalDaLinha, somaAte, somaLinhas, totaisMensais } from "./calculo";

const p = (data: string, categoria: PartidaContabil["categoria"], atividade: PartidaContabil["atividade"], reais: number) =>
  ({ data, categoria, atividade, valorCentavos: Math.round(reais * 100) }) satisfies PartidaContabil;

const razao: PartidaContabil[] = [
  p("2025-05-10", "Receita", "Café", -5000),
  p("2025-05-10", "Ativo Caixa/Banco", "N/A", 5000),
  p("2025-06-01", "Custeio", "Café", 1200),
  p("2025-06-20", "Custeio", "Geral", 300),
  p("2025-06-01", "Ativo Caixa/Banco", "N/A", -1500),
  p("2025-11-03", "Despesa Financeira", "N/A", 250),
  p("2025-11-03", "Ativo Caixa/Banco", "N/A", -250),
  p("2024-12-31", "Custeio", "Café", 999), // outro ano: fica de fora
];

describe("realizadoMensal", () => {
  it("separa por mês no sinal da DRE e fecha com dreAnual", () => {
    const m = realizadoMensal(razao, 2025);
    expect(m.receitaCafe[4]).toBe(500000);
    expect(m.custeioCafe[5]).toBe(-120000);
    expect(m.custeioGeral[5]).toBe(-30000);
    expect(m.despesasFinanceiras[10]).toBe(-25000);
    expect(m.custeioCafe[11]).toBe(0);
    const t = totaisMensais(m);
    const dre = dreAnual(razao, [2024, 2025]).get(2025)!;
    expect(somaAte(t.resultado, 12)).toBe(dre.resultado);
    expect(somaAte(t.totalCusteio, 12)).toBe(dre.totalCusteio);
    expect(somaAte(t.resultado, 5)).toBe(500000);
  });
});

describe("distribuir", () => {
  it("divide em 12 parcelas inteiras que somam o total", () => {
    for (const total of [1200000, 100, 7, -100001, 0]) {
      const partes = distribuir(total);
      expect(partes).toHaveLength(12);
      expect(partes.reduce((s, v) => s + v, 0)).toBe(total);
      expect(Math.max(...partes) - Math.min(...partes)).toBeLessThanOrEqual(1);
    }
  });
});

describe("ajustar e comparar", () => {
  it("aplica o percentual e arredonda ao real", () => {
    const m = matrizVazia();
    m.custeioCafe[0] = -100050;
    expect(ajustar(m, 10).custeioCafe[0]).toBe(-110100);
  });
  it("desvio positivo é favorável para receita e para gasto", () => {
    expect(comparar(100000, 120000)).toMatchObject({ desvio: 20000, pct: 0.2 }); // receita acima
    expect(comparar(-100000, -80000)).toMatchObject({ desvio: 20000, pct: 0.2 }); // gasto abaixo
    expect(comparar(-100000, -130000).desvio).toBe(-30000); // gasto acima
    expect(comparar(0, -5000).pct).toBeNull();
  });
  it("sinal de digitação: receitas positivas, gastos negativos", () => {
    expect(SINAL.receitaCafe).toBe(1);
    expect(SINAL.outrasReceitas).toBe(1);
    expect(SINAL.custeioMilho).toBe(-1);
    expect(SINAL.despesasAdministrativas).toBe(-1);
  });
});

describe("mesDeCorte", () => {
  it("compara o ano inteiro no passado, até o mês atual no ano corrente e nada no futuro", () => {
    expect(mesDeCorte(2025, "2026-10-18")).toBe(12);
    expect(mesDeCorte(2026, "2026-10-18")).toBe(10);
    expect(mesDeCorte(2027, "2026-10-18")).toBe(0);
  });
});

describe("investimentos", () => {
  it("compras de imobilizado por conta e mês, negativas; vendas (créditos) não contam", () => {
    const partidas = [
      { data: "2026-03-10", categoria: "Ativo Imobilizado" as const, atividade: "N/A" as const, valorCentavos: 12_000_000, conta: "Imobilizado - Máquinas e Equipamentos" },
      { data: "2026-03-10", categoria: "PL Capital Sócio" as const, atividade: "N/A" as const, valorCentavos: -12_000_000, conta: "CC ACM" },
      { data: "2026-07-01", categoria: "Ativo Imobilizado" as const, atividade: "N/A" as const, valorCentavos: -2_000_000, conta: "Imobilizado - Veículos" }, // venda
      { data: "2025-12-01", categoria: "Ativo Imobilizado" as const, atividade: "N/A" as const, valorCentavos: 999, conta: "Imobilizado - Prédios" },
    ];
    const m = realizadoInvestimentos(partidas, 2026, ["Imobilizado - Máquinas e Equipamentos", "Imobilizado - Veículos"]);
    expect(m[chaveInvestimento("Imobilizado - Máquinas e Equipamentos")][2]).toBe(-12_000_000);
    expect(somaAte(m[chaveInvestimento("Imobilizado - Veículos")], 12)).toBe(0);
    expect(somaAte(somaLinhas(m, Object.keys(m)), 12)).toBe(-12_000_000);
    expect(sinalDaLinha(chaveInvestimento("x"))).toBe(-1);
    expect(sinalDaLinha("receitaCafe")).toBe(1);
  });
});

