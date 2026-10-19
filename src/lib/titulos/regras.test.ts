import { describe, expect, it } from "vitest";
import { faixaDoVencimento, gerarParcelas, partidasDaBaixa, projecaoSemanal, somarMeses } from "./regras";

describe("somarMeses", () => {
  it("mantém o dia e usa o último dia quando o mês é mais curto", () => {
    expect(somarMeses("2026-01-15", 1)).toBe("2026-02-15");
    expect(somarMeses("2026-01-31", 1)).toBe("2026-02-28");
    expect(somarMeses("2026-11-30", 3)).toBe("2027-02-28");
  });
});

describe("gerarParcelas", () => {
  it("divide em parcelas mensais e joga a sobra de centavos na primeira", () => {
    expect(gerarParcelas(100000, 3, "2026-10-31")).toEqual([
      { parcela: 1, valorCentavos: 33334, vencimento: "2026-10-31" },
      { parcela: 2, valorCentavos: 33333, vencimento: "2026-11-30" },
      { parcela: 3, valorCentavos: 33333, vencimento: "2026-12-31" },
    ]);
  });
});

describe("faixaDoVencimento", () => {
  const hoje = "2026-10-18";
  it.each([
    ["2026-10-17", "vencido"],
    ["2026-10-18", "semana"],
    ["2026-10-25", "semana"],
    ["2026-10-26", "mes"],
    ["2026-11-17", "mes"],
    ["2026-11-18", "depois"],
  ])("%s → %s", (venc, faixa) => expect(faixaDoVencimento(venc, hoje)).toBe(faixa));
});

describe("partidasDaBaixa", () => {
  it("a pagar debita a despesa e credita o pagamento; a receber faz o contrário", () => {
    expect(partidasDaBaixa("PAGAR", "adubo", "banco", 500)).toEqual([
      { contaId: "adubo", valorCentavos: 500 },
      { contaId: "banco", valorCentavos: -500 },
    ]);
    expect(partidasDaBaixa("RECEBER", "venda", "banco", 500)).toEqual([
      { contaId: "banco", valorCentavos: 500 },
      { contaId: "venda", valorCentavos: -500 },
    ]);
  });
});

describe("projecaoSemanal", () => {
  it("agrupa por semana (segunda a domingo) e leva os vencidos para a primeira", () => {
    // 2026-10-18 é domingo: a primeira semana é 12 a 18/10
    const semanas = projecaoSemanal(
      [
        { tipo: "PAGAR", valorCentavos: 300, vencimento: "2026-10-01" }, // vencido
        { tipo: "PAGAR", valorCentavos: 200, vencimento: "2026-10-20" },
        { tipo: "RECEBER", valorCentavos: 1000, vencimento: "2026-10-22" },
      ],
      1000,
      "2026-10-18",
      3,
    );
    expect(semanas.map((s) => [s.inicio, s.entradas, s.saidas, s.saldoFinal])).toEqual([
      ["2026-10-12", 0, 300, 700],
      ["2026-10-19", 1000, 200, 1500],
      ["2026-10-26", 0, 0, 1500],
    ]);
  });
});

describe("partidasDaBaixa de financiamento", () => {
  it("separa amortização (passivo) e juros (despesa financeira)", () => {
    expect(partidasDaBaixa("PAGAR", "emprestimo", "banco", 888_488, { contaJurosId: "juros", jurosCentavos: 100_000 })).toEqual([
      { contaId: "emprestimo", valorCentavos: 788_488 },
      { contaId: "juros", valorCentavos: 100_000 },
      { contaId: "banco", valorCentavos: -888_488 },
    ]);
    // carência: só juros
    expect(partidasDaBaixa("PAGAR", "emprestimo", "banco", 1_800_000, { contaJurosId: "juros", jurosCentavos: 1_800_000 })).toEqual([
      { contaId: "juros", valorCentavos: 1_800_000 },
      { contaId: "banco", valorCentavos: -1_800_000 },
    ]);
  });
});

