import { describe, expect, it } from "vitest";
import type { PartidaContabil } from "../contabil/tipos";
import { depreciacaoNoAno, taxaSugerida } from "./depreciacao";
import { pesos, ratear, resultadoPorAtividade } from "./rateio";

describe("depreciacaoNoAno", () => {
  it("deprecia em linha reta a partir do mês seguinte à compra", () => {
    // Trator de R$ 120.000 em 15/06/2024, 10% ao ano = R$ 1.000/mês.
    const trator = [{ data: "2024-06-15", valorCentavos: 12_000_000 }];
    expect(depreciacaoNoAno(trator, 10, 2024)).toEqual({ custo: 12_000_000, doAno: 600_000, acumulada: 600_000, liquido: 11_400_000 });
    expect(depreciacaoNoAno(trator, 10, 2025).doAno).toBe(1_200_000);
    expect(depreciacaoNoAno(trator, 10, 2023)).toEqual({ custo: 0, doAno: 0, acumulada: 0, liquido: 0 });
  });
  it("para quando o bem fica totalmente depreciado", () => {
    const carro = [{ data: "2016-01-10", valorCentavos: 5_000_000 }];
    expect(depreciacaoNoAno(carro, 20, 2020).doAno).toBe(1_000_000);
    expect(depreciacaoNoAno(carro, 20, 2021)).toMatchObject({ doAno: 83_333, liquido: 0 }); // fecha em jan/2021
    expect(depreciacaoNoAno(carro, 20, 2022)).toMatchObject({ doAno: 0, acumulada: 5_000_000, liquido: 0 });
  });
  it("baixa reduz custo e depreciação, sem deixar o acumulado passar do custo", () => {
    const camadas = [
      { data: "2020-12-01", valorCentavos: 1_200_000 },
      { data: "2022-12-01", valorCentavos: -1_200_000 }, // vendido
    ];
    const r = depreciacaoNoAno(camadas, 10, 2023);
    expect(r.custo).toBe(0);
    expect(r.acumulada).toBe(0);
  });
  it("sugere taxas pelo nome da conta e pede confirmação nas duvidosas", () => {
    expect(taxaSugerida("Imobilizado - Máquinas e Equipamentos").taxa).toBe(10);
    expect(taxaSugerida("Imobilizado - Veículos").taxa).toBe(20);
    expect(taxaSugerida("Imobilizado - Prédios").taxa).toBe(4);
    expect(taxaSugerida("Imobilizado - Terra Nua e Benfeitorias")).toMatchObject({ taxa: 0, confirmar: expect.any(String) });
    expect(taxaSugerida("Imobilizado - Reforma Cafezal").confirmar).toBeDefined();
  });
});

const p = (data: string, categoria: PartidaContabil["categoria"], atividade: PartidaContabil["atividade"], reais: number) =>
  ({ data, categoria, atividade, valorCentavos: Math.round(reais * 100) }) satisfies PartidaContabil;

describe("rateio", () => {
  it("divide em centavos inteiros sem perder a sobra", () => {
    const r = ratear(100, { Café: 1 / 3, Maracujá: 1 / 3, Milho: 1 / 3, Pecuária: 0 });
    expect(r.Café + r.Maracujá + r.Milho + r.Pecuária).toBe(100);
  });
  it("sem base proporcional não rateia", () => {
    const z = { Café: 0, Maracujá: 0, Milho: 0, Pecuária: 0 };
    expect(pesos("receita", z, z, z)).toBeNull();
  });
  it("monta o resultado por atividade e fecha com o total", () => {
    const razao = [
      p("2025-05-01", "Receita", "Café", -8000),
      p("2025-05-01", "Receita", "Maracujá", -2000),
      p("2025-05-01", "Receita", "Geral", -100),
      p("2025-06-01", "Custeio", "Café", 3000),
      p("2025-06-01", "Custeio", "Maracujá", 1500),
      p("2025-06-01", "Custeio", "Geral", 1000),
      p("2025-06-01", "Despesa Administrativa", "Geral", 500),
      p("2025-06-01", "Despesa Financeira", "N/A", 300),
      p("2024-06-01", "Custeio", "Café", 999), // outro ano
    ];
    const r = resultadoPorAtividade(razao, 2025, "receita", { Café: 0, Maracujá: 0, Milho: 0, Pecuária: 0 }, [
      { atividade: "Café", valor: 20000 },
      { atividade: "N/A", valor: 10000 },
    ]);
    expect(r.pesos).toEqual({ Café: 0.8, Maracujá: 0.2, Milho: 0, Pecuária: 0 });
    expect(r.margemDireta.Café).toBe(800000 - 300000 - 20000);
    expect(r.rateado.custeioGeral).toEqual({ Café: 80000, Maracujá: 20000, Milho: 0, Pecuária: 0 });
    // Soma das atividades = receitas − custos − depreciação.
    const total = Object.values(r.resultado).reduce((s, v) => s + v, 0);
    expect(total).toBe((8000 + 2000 + 100 - 3000 - 1500 - 1000 - 500 - 300) * 100 - 30000);
  });
  it("percentuais definidos usam os pesos informados", () => {
    const z = { Café: 0, Maracujá: 0, Milho: 0, Pecuária: 0 };
    expect(pesos("manual", z, z, { Café: 60, Maracujá: 20, Milho: 10, Pecuária: 10 })).toEqual({ Café: 0.6, Maracujá: 0.2, Milho: 0.1, Pecuária: 0.1 });
  });
});
