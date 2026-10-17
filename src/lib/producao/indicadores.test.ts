import { describe, expect, it } from "vitest";
import { calcularIndicadores, type Movimento } from "./indicadores";

const m = (data: string, tipo: Movimento["tipo"], quantidade: number): Movimento => ({ data, tipo, quantidade });

describe("calcularIndicadores — café", () => {
  const movimentos = [
    m("2025-07-10", "COLHEITA", 300),
    m("2025-11-05", "VENDA", 250),
    m("2026-06-20", "COLHEITA", 400),
    m("2026-08-15", "VENDA", 300),
    m("2026-09-01", "PERDA", 5),
    m("2026-09-30", "AJUSTE", -2),
  ];
  const r = calcularIndicadores({
    ano: 2026,
    ate: "2026-10-18",
    producao: "COLHEITA",
    areaHa: 20,
    movimentos,
    custeioDiretoCentavos: 32_000_000, // R$ 320 mil
    receitaCentavos: 48_000_000, // R$ 480 mil
    cotacaoCentavos: 160_125, // R$ 1.601,25 / saca
  });

  it("produção, produtividade e estoque", () => {
    expect(r.producaoAno).toBe(400);
    expect(r.produtividade).toBe(20);
    expect(r.estoqueAtual).toBe(300 - 250 + 400 - 300 - 5 - 2);
  });

  it("custo por saca, preço médio e margem pela cotação", () => {
    expect(r.custoPorUnidade).toBe(80_000); // R$ 800/saca
    expect(r.precoMedioRealizado).toBe(160_000); // R$ 1.600/saca
    expect(r.margemPorUnidade).toBe(80_125);
    expect(r.valorEstoque).toBe(143 * 160_125);
  });

  it("preço médio usa o valor informado nas vendas quando existe", () => {
    const comValor = calcularIndicadores({
      ano: 2026,
      ate: "2026-10-18",
      producao: "COLHEITA",
      areaHa: 20,
      movimentos: [m("2026-06-20", "COLHEITA", 400), { ...m("2026-08-15", "VENDA", 300), valorCentavos: 54_000_000 }],
      custeioDiretoCentavos: 0,
      receitaCentavos: 1, // ignorada
      cotacaoCentavos: null,
    });
    expect(comValor.precoMedioRealizado).toBe(180_000);
  });
});

describe("calcularIndicadores — sem dados", () => {
  it("não divide por zero", () => {
    const r = calcularIndicadores({
      ano: 2026,
      ate: "2026-10-18",
      producao: "NASCIMENTO",
      areaHa: 0,
      movimentos: [m("2026-10-02", "COMPRA", 14)],
      custeioDiretoCentavos: 77_250,
      receitaCentavos: 0,
      cotacaoCentavos: null,
    });
    expect(r).toMatchObject({ producaoAno: 0, produtividade: null, custoPorUnidade: null, precoMedioRealizado: null, estoqueAtual: 14, valorEstoque: null });
  });
});
