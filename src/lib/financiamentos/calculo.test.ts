import { describe, expect, it } from "vitest";
import { dividirPagamento, gerarCronograma, taxaDoPeriodo } from "./calculo";

const soma = (xs: number[]) => xs.reduce((s, v) => s + v, 0);

describe("taxaDoPeriodo", () => {
  it("converte a taxa anual efetiva para o período", () => {
    expect(taxaDoPeriodo(12, 12)).toBeCloseTo(0.12, 10);
    expect(taxaDoPeriodo(12.682503, 1)).toBeCloseTo(0.01, 6); // 1% a.m. ≈ 12,68% a.a.
    expect(taxaDoPeriodo(0, 6)).toBe(0);
  });
});

describe("gerarCronograma", () => {
  it("Price: parcelas iguais, saldo zera e a soma das amortizações é o valor", () => {
    const c = gerarCronograma({ valorCentavos: 10_000_000, taxaAnualPct: 12.682503, parcelas: 12, carencia: 0, sistema: "PRICE", periodicidadeMeses: 1, primeiroVencimento: "2026-11-10" });
    expect(c).toHaveLength(12);
    expect(c[0].juros).toBe(100_000); // 1% de R$ 100.000
    expect(c[0].parcela).toBe(888_488); // PMT de R$ 100.000, 1% a.m., 12x = R$ 8.884,88
    expect(new Set(c.slice(0, 11).map((p) => p.parcela)).size).toBe(1);
    expect(Math.abs(c[11].parcela - c[0].parcela)).toBeLessThanOrEqual(12); // a última absorve o arredondamento acumulado (até 1 centavo por parcela)
    expect(soma(c.map((p) => p.amortizacao))).toBe(10_000_000);
    expect(c.at(-1)!.saldoDepois).toBe(0);
    expect(c[1].vencimento).toBe("2026-12-10");
  });
  it("SAC anual com carência: só juros na carência, depois amortização constante", () => {
    const c = gerarCronograma({ valorCentavos: 30_000_000, taxaAnualPct: 6, parcelas: 3, carencia: 2, sistema: "SAC", periodicidadeMeses: 12, primeiroVencimento: "2027-07-15" });
    expect(c.map((p) => p.carencia)).toEqual([true, true, false, false, false]);
    expect(c[0]).toMatchObject({ amortizacao: 0, juros: 1_800_000, saldoDepois: 30_000_000 });
    expect(c[2]).toMatchObject({ amortizacao: 10_000_000, juros: 1_800_000, parcela: 11_800_000 });
    expect(c[3].juros).toBe(1_200_000);
    expect(c[4]).toMatchObject({ amortizacao: 10_000_000, juros: 600_000, saldoDepois: 0 });
    expect(c.map((p) => p.vencimento)).toEqual(["2027-07-15", "2028-07-15", "2029-07-15", "2030-07-15", "2031-07-15"]);
  });
  it("sem juros: só divide o valor", () => {
    const c = gerarCronograma({ valorCentavos: 1000, taxaAnualPct: 0, parcelas: 3, carencia: 0, sistema: "PRICE", periodicidadeMeses: 6, primeiroVencimento: "2026-01-31" });
    expect(c.map((p) => p.parcela)).toEqual([333, 333, 334]);
    expect(c[1].vencimento).toBe("2026-07-31");
  });
});

describe("dividirPagamento", () => {
  it("amortização prevista abate a dívida; o resto é juros (inclusive multa)", () => {
    expect(dividirPagamento(888_488, 888_488, 100_000)).toEqual({ amortizacao: 788_488, juros: 100_000 });
    expect(dividirPagamento(900_000, 888_488, 100_000)).toEqual({ amortizacao: 788_488, juros: 111_512 }); // pagou com atraso
    expect(dividirPagamento(500_000, 888_488, 100_000)).toEqual({ amortizacao: 500_000, juros: 0 }); // pagou menos
  });
});
