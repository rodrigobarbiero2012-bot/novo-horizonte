import { describe, expect, it } from "vitest";
import { lerValorBr, validarLancamento } from "./lancamento";

describe("lerValorBr", () => {
  it.each([
    ["1.234,56", 123456],
    ["1234,5", 123450],
    ["1234.56", 123456],
    ["R$ 800", 80000],
    ["10.000", 1000000],
    ["1.234.567", 123456700],
    ["12.5", 1250],
    ["", null],
  ])("%s → %s", (txt, esperado) => expect(lerValorBr(txt)).toBe(esperado));

  it("rejeita texto que não é número", () => expect(lerValorBr("12a")).toBeNaN());
});

describe("validarLancamento", () => {
  const contas = new Set(["banco", "adubo"]);
  const base = { data: "2026-10-16", historico: "NF 123 adubo" };

  it("aceita débito e crédito iguais", () => {
    const partidas = [
      { contaId: "adubo", valorCentavos: 50000 },
      { contaId: "banco", valorCentavos: -50000 },
    ];
    expect(validarLancamento({ ...base, partidas }, contas)).toEqual([]);
  });

  it("aponta diferença entre débito e crédito e conta não escolhida", () => {
    const partidas = [
      { contaId: "adubo", valorCentavos: 50000 },
      { contaId: "", valorCentavos: -40000 },
    ];
    const erros = validarLancamento({ ...base, partidas }, contas);
    expect(erros).toContain("Linha 2: escolha uma conta.");
    expect(erros.some((e) => e.includes("R$ 100,00"))).toBe(true);
  });
});
