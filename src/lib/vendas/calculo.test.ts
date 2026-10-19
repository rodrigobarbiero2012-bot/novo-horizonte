import { describe, expect, it } from "vitest";
import { aEntregar, resumoVendas, situacaoContrato, valorContrato, type Contrato } from "./calculo";

const contrato = (c: Partial<Contrato>): Contrato => ({ dataContrato: "2026-05-10", quantidade: 100, precoUnitarioCentavos: 150000, cancelada: false, entregue: 0, ...c });

describe("contratos", () => {
  it("situação e saldo a entregar", () => {
    expect(situacaoContrato(contrato({ entregue: 40 }))).toBe("ABERTA");
    expect(situacaoContrato(contrato({ entregue: 100 }))).toBe("CONCLUIDA");
    expect(situacaoContrato(contrato({ entregue: 40, cancelada: true }))).toBe("CANCELADA");
    expect(aEntregar(contrato({ entregue: 40 }))).toBe(60);
    expect(aEntregar(contrato({ entregue: 40, cancelada: true }))).toBe(0);
    expect(aEntregar(contrato({ entregue: 120 }))).toBe(0); // entregou a mais: não fica negativo
  });
  it("valor só existe com preço fixado", () => {
    expect(valorContrato(contrato({ quantidade: 10.5, precoUnitarioCentavos: 160050 }))).toBe(1680525);
    expect(valorContrato(contrato({ precoUnitarioCentavos: null }))).toBeNull();
  });
});

describe("resumoVendas", () => {
  it("cruza estoque físico com o vendido e calcula o preço médio ponderado dos fixados", () => {
    const movimentos = [
      { data: "2026-06-01", tipo: "COLHEITA" as const, quantidade: 400 },
      { data: "2026-08-01", tipo: "VENDA" as const, quantidade: 100 },
    ];
    const contratos = [
      contrato({ quantidade: 100, entregue: 100, precoUnitarioCentavos: 150000 }), // entregue
      contrato({ quantidade: 200, entregue: 0, precoUnitarioCentavos: 180000 }), // a entregar
      contrato({ quantidade: 50, entregue: 0, precoUnitarioCentavos: null }), // a fixar
      contrato({ quantidade: 80, entregue: 30, cancelada: true, precoUnitarioCentavos: 170000 }), // cancelado após 30
      contrato({ dataContrato: "2025-11-01", quantidade: 999, entregue: 999 }), // outro ano
    ];
    const r = resumoVendas(contratos, movimentos, 2026);
    expect(r.estoque).toBe(300);
    expect(r.comprometido).toBe(250); // 200 + 50
    expect(r.livre).toBe(50);
    expect(r.vendidoAno).toBe(380); // 100 + 200 + 50 + 30
    expect(r.fixadoAno).toBe(330);
    expect(r.aFixarAno).toBe(50);
    expect(r.valorFixadoAno).toBe(100 * 150000 + 200 * 180000 + 30 * 170000);
    expect(r.precoMedioAno).toBe(Math.round((100 * 150000 + 200 * 180000 + 30 * 170000) / 330));
  });
  it("venda antecipada maior que o estoque deixa o livre negativo", () => {
    const r = resumoVendas([contrato({ quantidade: 500 })], [{ data: "2026-06-01", tipo: "COLHEITA", quantidade: 300 }], 2026);
    expect(r.livre).toBe(-200);
    expect(resumoVendas([], [], 2026).precoMedioAno).toBeNull();
  });
});
