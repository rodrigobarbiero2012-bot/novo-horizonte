import { describe, expect, it } from "vitest";
import type { PartidaContabil } from "../contabil/tipos";
import { resumirCultivo, serieInvestimento, serieSocios, tir, tirSocios, type AnoCultivo } from "./investimento";

const p = (data: string, categoria: PartidaContabil["categoria"], atividade: PartidaContabil["atividade"], valorCentavos: number, conta?: string): PartidaContabil => ({
  data,
  categoria,
  atividade,
  valorCentavos,
  conta,
});
const zero = { Café: 0, Maracujá: 0, Milho: 0, Pecuária: 0 };

describe("tir", () => {
  it("acha a taxa de fluxos simples", () => {
    expect(tir([-100, 110])).toBeCloseTo(0.1, 6);
    expect(tir([-100, 0, 121])).toBeCloseTo(0.1, 6);
  });
  it("devolve null sem troca de sinal", () => {
    expect(tir([100, 50])).toBeNull();
    expect(tir([-100, -50])).toBeNull();
  });
});

describe("serieInvestimento", () => {
  const partidas = [
    p("2024-01-10", "Ativo Imobilizado", "N/A", 120_000, "Imobilizado - Máquinas"),
    p("2024-01-10", "Ativo Caixa/Banco", "N/A", -120_000),
    p("2024-05-01", "Receita", "Café", -100_000),
    p("2024-05-01", "Receita", "Maracujá", -50_000),
    p("2024-03-01", "Custeio", "Café", 40_000),
    p("2024-03-01", "Custeio", "Maracujá", 20_000),
    p("2024-06-01", "Despesa Administrativa", "Geral", 15_000),
  ];
  const taxas = [{ nome: "Imobilizado - Máquinas", atividade: "N/A", taxa: 10 }];
  const s = serieInvestimento(partidas, [2024], taxas, "receita", zero);

  it("põe o bem de uso geral e a depreciação dele no café", () => {
    const cafe = s.Café[0];
    expect(cafe.investimento).toBe(120_000);
    expect(cafe.depreciacao).toBe(11_000); // 11 meses de 10% a.a.
    expect(cafe.capital).toBe(109_000);
    expect(s.Maracujá[0].investimento).toBe(0);
    expect(s.Maracujá[0].depreciacao).toBe(0);
  });

  it("rateia só os custos comuns e fecha com o total", () => {
    // Despesa de 15.000 pela receita: 2/3 café, 1/3 maracujá.
    expect(s.Café[0].resultado).toBe(100_000 - 40_000 - 11_000 - 10_000);
    expect(s.Maracujá[0].resultado).toBe(50_000 - 20_000 - 5_000);
    expect(s.Café[0].caixa).toBe(s.Café[0].resultado + 11_000 - 120_000);
  });
});

describe("custeio reclassificado como investimento", () => {
  it("o Custeio Geral - Maracujá de 2026 sai do resultado e vira capital do maracujá", () => {
    const partidas = [
      p("2026-03-17", "Custeio", "Maracujá", 27_000, "Custeio Geral - Maracujá"),
      p("2025-03-17", "Custeio", "Maracujá", 1_000, "Custeio Geral - Maracujá"),
      p("2026-05-01", "Receita", "Maracujá", -50_000, "Receita Venda Maracujá"),
    ];
    const s = serieInvestimento(partidas, [2025, 2026], [], "receita", zero).Maracujá;
    expect(s[0]).toMatchObject({ ano: 2025, custeio: 1_000, investimento: 0, capital: 0 }); // 2025 continua custeio
    expect(s[1]).toMatchObject({ ano: 2026, custeio: 0, resultado: 50_000, investimento: 27_000, capital: 27_000, caixa: 23_000 });
  });
});

describe("resumirCultivo", () => {
  const ano = (a: number, resultado: number, investimento: number, capital: number): AnoCultivo => ({
    ano: a,
    receita: 100,
    custeio: 0,
    margemDireta: resultado,
    resultado,
    depreciacao: 0,
    investimento,
    capital,
    caixa: resultado - investimento,
  });

  it("sem terra: TIR do investimento feito no período", () => {
    const r = resumirCultivo([ano(2024, 0, 100, 100), ano(2025, 10, 0, 100)])!;
    expect(r.resultadoAcumulado).toBe(10);
    expect(r.capitalHoje).toBe(100);
    expect(r.tir).toBeCloseTo(0.1, 6); // −100, depois 10 + 100
  });

  it("com valor de mercado: começa no investido e termina a mercado (valorização entra)", () => {
    const r = resumirCultivo([ano(2024, 0, 100, 100), ano(2025, 10, 0, 100)], 210)!;
    expect(r.capitalHoje).toBe(210);
    expect(r.retornoRecente).toBeCloseTo(5 / 210, 6);
    expect(r.tir).toBeCloseTo(1.2, 6); // −100, depois 10 + 210 (o bem de 100 vale 210)
  });
});

describe("sócios", () => {
  it("separa aportes e retiradas e calcula a TIR com o patrimônio final", () => {
    const partidas = [p("2025-02-01", "PL Capital Sócio", "N/A", -500), p("2025-08-01", "PL Capital Sócio", "N/A", 100)];
    const serie = serieSocios(partidas, [2024, 2025], new Map([[2024, 1000], [2025, 1500]]));
    expect(serie[1]).toEqual({ ano: 2025, aportes: 500, retiradas: 100, patrimonio: 1500 });
    // −1000 no início; em 2025: retirou 100, aportou 500, ficou com 1500 → +1100.
    expect(tirSocios(serie)).toBeCloseTo(0.1, 6);
  });
});
