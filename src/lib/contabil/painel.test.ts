import { describe, expect, it } from "vitest";
import { dividaEm, maioresCustos, mixAtividades, resumoPeriodo, ultimos12Meses, umAnoAntes, variacao } from "./painel";
import type { PartidaContabil } from "./tipos";

const p = (data: string, categoria: PartidaContabil["categoria"], atividade: PartidaContabil["atividade"], reais: number, conta = "x") =>
  ({ data, categoria, atividade, valorCentavos: Math.round(reais * 100), conta }) satisfies PartidaContabil;

const razao: PartidaContabil[] = [
  // 2025
  p("2025-03-10", "Receita", "Café", -10000, "Receita Café"),
  p("2025-03-10", "Ativo Caixa/Banco", "N/A", 10000),
  p("2025-04-01", "Custeio", "Café", 3000, "Custeio Adubos"),
  p("2025-04-01", "PL Capital Sócio", "N/A", -3000, "CC ACM"),
  p("2025-11-20", "Custeio", "Café", 500, "Custeio Adubos"), // fora do período comparável (depois de 06/10)
  p("2025-11-20", "Ativo Caixa/Banco", "N/A", -500),
  // 2026
  p("2026-02-01", "Receita", "Maracujá", -4000, "Receita Maracujá"),
  p("2026-02-01", "Ativo Caixa/Banco", "N/A", 4000),
  p("2026-05-15", "Custeio", "Maracujá", 1500, "Custeio Mudas"),
  p("2026-05-15", "Custeio", "Geral", 700, "Custeio Energia"),
  p("2026-05-15", "Despesa Administrativa", "Geral", 300, "Contabilidade"),
  p("2026-05-15", "PL Capital Sócio", "N/A", -2500, "CC ACM"),
  p("2026-06-01", "Passivo Empréstimo", "N/A", -20000),
  p("2026-06-01", "Ativo Caixa/Banco", "N/A", 20000),
];
const atual = { inicio: "2026-01-01", fim: "2026-10-06" };
const anterior = { inicio: "2025-01-01", fim: umAnoAntes("2026-10-06") };

describe("painel", () => {
  it("umAnoAntes trata 29/02", () => {
    expect(umAnoAntes("2028-02-29")).toBe("2027-02-28");
    expect(umAnoAntes("2026-10-06")).toBe("2025-10-06");
  });

  it("resumo do período: receita, custos, resultado e aportes do sócio", () => {
    expect(resumoPeriodo(razao, atual)).toEqual({ receita: 400000, custeio: 220000, despesas: 30000, resultado: 150000, aportesSocio: 250000 });
    expect(resumoPeriodo(razao, anterior)).toMatchObject({ receita: 1000000, custeio: 300000, aportesSocio: 300000 });
  });

  it("mix por atividade separa o custeio Geral e as despesas como não alocados", () => {
    const { atividades, naoAlocado } = mixAtividades(razao, atual);
    expect(atividades).toEqual([{ atividade: "Maracujá", receita: 400000, custeio: 150000, margem: 250000, compraAnimais: 0 }]);
    expect(naoAlocado).toBe(100000);
  });

  it("maiores custos com o mesmo período do ano anterior", () => {
    expect(maioresCustos(razao, atual, anterior, 2)).toEqual([
      { conta: "Custeio Mudas", valor: 150000, anterior: 0 },
      { conta: "Custeio Energia", valor: 70000, anterior: 0 },
    ]);
    expect(maioresCustos(razao, atual, anterior).find((c) => c.conta === "Custeio Adubos")).toEqual({
      conta: "Custeio Adubos",
      valor: 0,
      anterior: 300000,
    });
  });

  it("12 meses terminando no mês pedido", () => {
    const meses = ultimos12Meses(razao, "2026-10");
    expect(meses.map((m) => m.mes)[0]).toBe("2025-11");
    expect(meses.at(-1)!.mes).toBe("2026-10");
    expect(meses.find((m) => m.mes === "2025-11")).toMatchObject({ gastos: 50000 });
    expect(meses.find((m) => m.mes === "2026-05")).toMatchObject({ gastos: 250000, aportesSocio: 250000 });
  });

  it("dívida e variação", () => {
    expect(dividaEm(razao, "2026-05-31")).toBe(0);
    expect(dividaEm(razao, "2026-10-06")).toBe(2000000);
    expect(variacao(150, 100)).toBeCloseTo(0.5);
    expect(variacao(10, 0)).toBeNull();
  });
});

describe("compra de animais", () => {
  it("entrada no estoque de gado aparece na Pecuária, fora da margem", () => {
    const periodo = { inicio: "2026-01-01", fim: "2026-12-31" };
    const r = mixAtividades(
      [
        p("2026-10-02", "Ativo Estoque", "N/A", 40000, "Estoque de Gado"),
        p("2026-10-02", "PL Capital Sócio", "N/A", -40000, "CC ACM"),
        p("2026-06-01", "Ativo Estoque", "N/A", 5000, "Estoques (Café/Produtos)"), // estoque de café: não é animal
        p("2026-07-01", "Receita", "Pecuária", -16000, "Receita Venda Gado"),
      ],
      periodo,
    );
    expect(r.atividades).toEqual([{ atividade: "Pecuária", receita: 1600000, custeio: 0, margem: 1600000, compraAnimais: 4000000 }]);
  });
});

