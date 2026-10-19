import { describe, expect, it } from "vitest";
import { contaSugerida, partidasDoFechamento, resumirFechamento, valorApontamento } from "./calculo";

const contas = [
  { id: "colheita", nome: "Custeio Colheita - Mão de Obra", atividade: "Café" },
  { id: "carpa", nome: "Custeio Carpas e Limpeza", atividade: "Café" },
  { id: "desbrota", nome: "Custeio Desbrotas", atividade: "Café" },
  { id: "pessoal", nome: "Custeio com Pessoal e Encargos", atividade: "Café" },
  { id: "maracuja", nome: "Custeio Pessoal - Maracujá", atividade: "Maracujá" },
  { id: "geral", nome: "Custeio em Geral", atividade: "Geral" },
];

describe("valorApontamento", () => {
  it("soma diária e produção", () => {
    expect(valorApontamento(1, 12000, null, null)).toBe(12000);
    expect(valorApontamento(0.5, 12000, null, null)).toBe(6000);
    expect(valorApontamento(0, null, 37, 1050)).toBe(38850); // 37 latas a R$ 10,50
    expect(valorApontamento(1, 5000, 10, 800)).toBe(13000);
  });
});

describe("contaSugerida", () => {
  it("usa a conta do serviço no café e a de pessoal nos outros casos", () => {
    expect(contaSugerida("CAFE", "Colheita", contas)).toBe("colheita");
    expect(contaSugerida("CAFE", "Capina / carpa", contas)).toBe("carpa");
    expect(contaSugerida("CAFE", "Desbrota", contas)).toBe("desbrota");
    expect(contaSugerida("CAFE", "Adubação", contas)).toBe("pessoal");
    expect(contaSugerida("MARACUJA", "Colheita", contas)).toBe("maracuja");
    expect(contaSugerida("PECUARIA", "Trato do gado", contas)).toBe("geral"); // sem conta de pessoal na pecuária
    expect(contaSugerida("GERAL", "Manutenção", contas)).toBe("geral");
  });
});

describe("fechamento", () => {
  it("soma por pessoa e por conta, e o lançamento fecha em zero", () => {
    const r = resumirFechamento([
      { trabalhadorId: "a", nome: "Ana", contaId: "colheita", dias: 0, quantidade: 30, valorCentavos: 31500 },
      { trabalhadorId: "a", nome: "Ana", contaId: "colheita", dias: 0, quantidade: 25, valorCentavos: 26250 },
      { trabalhadorId: "b", nome: "Beto", contaId: "carpa", dias: 1, quantidade: null, valorCentavos: 12000 },
      { trabalhadorId: "b", nome: "Beto", contaId: "colheita", dias: 0, quantidade: 10, valorCentavos: 10500 },
    ]);
    expect(r.porPessoa).toEqual([
      { trabalhadorId: "a", nome: "Ana", dias: 0, quantidade: 55, valorCentavos: 57750 },
      { trabalhadorId: "b", nome: "Beto", dias: 1, quantidade: 10, valorCentavos: 22500 },
    ]);
    expect(r.totalCentavos).toBe(80250);
    const pernas = partidasDoFechamento(r, "acm");
    expect(pernas).toEqual([
      { contaId: "colheita", valorCentavos: 68250 },
      { contaId: "carpa", valorCentavos: 12000 },
      { contaId: "acm", valorCentavos: -80250 },
    ]);
    expect(pernas.reduce((s, p) => s + p.valorCentavos, 0)).toBe(0);
  });
});
