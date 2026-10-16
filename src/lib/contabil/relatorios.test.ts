import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { conferir, type Referencia } from "../importacao/conferencia";
import { agruparEmBlocos, paraPartida, type LinhaPlanilha } from "../importacao/planilha";
import { fluxoMensal } from "./fluxo";
import { balancoAnual, dreAnual } from "./relatorios";
import type { PartidaContabil } from "./tipos";

const p = (data: string, categoria: PartidaContabil["categoria"], atividade: PartidaContabil["atividade"], reais: number) =>
  ({ data, categoria, atividade, valorCentavos: Math.round(reais * 100) }) satisfies PartidaContabil;

// Mini-razão: aporte do sócio, venda de café, compra de adubo e um trator financiado.
const razao: PartidaContabil[] = [
  p("2014-12-31", "Ativo Caixa/Banco", "N/A", 1000),
  p("2014-12-31", "PL Capital Sócio", "N/A", -1000),
  p("2015-05-10", "Ativo Caixa/Banco", "N/A", 5000),
  p("2015-05-10", "Receita", "Café", -5000),
  p("2015-06-01", "Custeio", "Café", 1200),
  p("2015-06-01", "Ativo Caixa/Banco", "N/A", -1200),
  p("2016-02-01", "Ativo Imobilizado", "N/A", 80000),
  p("2016-02-01", "Passivo Empréstimo", "N/A", -80000),
  p("2016-03-01", "Despesa Financeira", "N/A", 300),
  p("2016-03-01", "Ativo Caixa/Banco", "N/A", -300),
];

describe("dreAnual", () => {
  it("separa receita, custeio e despesas por ano e acumula o resultado", () => {
    const dre = dreAnual(razao, [2015, 2016]);
    expect(dre.get(2015)).toMatchObject({ receitaCafe: 500000, custeioCafe: -120000, resultado: 380000 });
    expect(dre.get(2016)).toMatchObject({ despesasFinanceiras: -30000, resultado: -30000, resultadoAcumulado: 350000 });
  });
});

describe("balancoAnual", () => {
  it("fecha Ativo = Passivo + PL quando todos os lançamentos somam zero", () => {
    const b = balancoAnual(razao, [2015, 2016]).get(2016)!;
    expect(b.caixaBancos).toBe(450000);
    expect(b.imobilizado).toBe(8000000);
    expect(b.emprestimos).toBe(8000000);
    expect(b.capitalSocio).toBe(100000);
    expect(b.diferenca).toBe(0);
  });
});

describe("fluxoMensal", () => {
  it("classifica as pernas fora do caixa e fecha com a variação de bancos + aplicações", () => {
    const pagoPeloSocio = [p("2015-07-03", "Custeio", "Café", 900), p("2015-07-03", "PL Capital Sócio", "N/A", -900)];
    const fluxo = fluxoMensal([...razao, ...pagoPeloSocio], 2015);
    expect(fluxo.get("01")!.saldoInicial).toBe(100000);
    expect(fluxo.get("05")).toMatchObject({ receitas: 500000, variacaoCaixa: 500000 });
    expect(fluxo.get("07")).toMatchObject({ custeio: -90000, socio: 90000, variacaoCaixa: 0 });
    expect(fluxo.get("12")!.saldoFinal).toBe(480000);
  });
});

describe("agruparEmBlocos", () => {
  const linha = (n: number, valor: number): LinhaPlanilha => ({
    linha: n, data: "2020-01-01", contaOriginal: "x", contaPadrao: "x", categoria: "Custeio", atividade: "Café",
    historico: null, valor, fiscal: null, valorNominal: null, dc: null, ano: 2020,
  });

  it("fecha o bloco quando a soma volta a zero, arredondando para centavos", () => {
    const blocos = agruparEmBlocos([linha(2, -25.18), linha(3, 25.178), linha(4, 10), linha(5, -4), linha(6, -6)]);
    expect(blocos.map((b) => b.linhas.map((l) => l.linha))).toEqual([[2, 3], [4, 5, 6]]);
  });

  it("devolve o resto sem fechamento com o saldo pendente", () => {
    const blocos = agruparEmBlocos([linha(2, 10), linha(3, -7)]);
    expect(blocos).toEqual([expect.objectContaining({ saldoCentavos: 300 })]);
  });
});

// Conferência com a base real: só roda quando data/import foi gerado
// (npm run extrair), porque os dados são confidenciais e não vão para o git.
const dir = path.join(process.cwd(), "data", "import");
const temBaseReal = fs.existsSync(path.join(dir, "lancamentos.json"));

describe.skipIf(!temBaseReal)("base real da planilha Gerencial Financeiro", () => {
  it("DRE e Balanço recalculados batem com o Excel em todos os anos", () => {
    const linhas: LinhaPlanilha[] = JSON.parse(fs.readFileSync(path.join(dir, "lancamentos.json"), "utf-8"));
    const ref: Referencia = JSON.parse(fs.readFileSync(path.join(dir, "referencia.json"), "utf-8"));
    const { comparacoes, divergencias } = conferir(linhas.map(paraPartida), ref);
    expect(comparacoes).toBeGreaterThan(300);
    expect(divergencias).toEqual([]);
  });

  it("saldo final de dezembro do fluxo = caixa + aplicações do balanço, todo ano", () => {
    const linhas: LinhaPlanilha[] = JSON.parse(fs.readFileSync(path.join(dir, "lancamentos.json"), "utf-8"));
    const partidas = linhas.map((l) => ({ ...paraPartida(l), conta: l.contaPadrao }));
    const anos = Array.from({ length: 12 }, (_, i) => 2015 + i);
    const balanco = balancoAnual(partidas, anos);
    for (const ano of anos) {
      const b = balanco.get(ano)!;
      expect(fluxoMensal(partidas, ano).get("12")!.saldoFinal, String(ano)).toBe(b.caixaBancos + b.aplicacoes);
    }
  });
});
