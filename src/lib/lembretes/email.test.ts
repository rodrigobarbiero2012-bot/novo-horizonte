import { describe, expect, it } from "vitest";
import { deveEnviar, montarEmail, type DadosLembrete } from "./email";

const base: DadosLembrete = { hoje: "2026-10-19", semanal: false, site: "https://exemplo.test", pagar: [], receber: [], whatsappPendentes: 0 };
const titulo = (vencimento: string, valorCentavos = 10000, descricao = "Adubo") => ({ descricao, contraparte: "Agro <Ltda>", valorCentavos, vencimento });

describe("deveEnviar", () => {
  it("todo dia só com algo a fazer; na segunda sempre", () => {
    expect(deveEnviar(base)).toBe(false);
    expect(deveEnviar({ ...base, pagar: [titulo("2026-10-26")] })).toBe(false); // vence em 7 dias: só no resumo semanal
    expect(deveEnviar({ ...base, pagar: [titulo("2026-10-22")] })).toBe(true); // em 3 dias
    expect(deveEnviar({ ...base, pagar: [titulo("2026-10-10")] })).toBe(true); // vencida
    expect(deveEnviar({ ...base, receber: [titulo("2026-10-18")] })).toBe(true); // recebimento atrasado
    expect(deveEnviar({ ...base, whatsappPendentes: 1 })).toBe(true);
    expect(deveEnviar({ ...base, semanal: true })).toBe(true);
  });
});

describe("montarEmail", () => {
  it("assunto resume o que pede atenção e o corpo traz valores e prazos", () => {
    const e = montarEmail({ ...base, pagar: [titulo("2026-10-17", 50000), titulo("2026-10-19", 12345, "Energia"), titulo("2026-10-20")] });
    expect(e.assunto).toBe("Novo Horizonte — 1 conta vencida, 2 vencendo em até 3 dias");
    expect(e.html).toContain("venceu 17/10/2026 (há 2 dias)");
    expect(e.html).toContain("vence hoje");
    expect(e.html).toContain("vence amanhã");
    expect(e.html).toContain("R$ 500,00");
    expect(e.html).toContain("Agro &lt;Ltda&gt;"); // texto vindo do banco é escapado
    expect(e.texto).toContain("- Energia — Agro <Ltda>: R$ 123,45, vence hoje");
  });
  it("resumo semanal inclui a semana, o mês, cotações e o lembrete de backup", () => {
    const e = montarEmail({
      ...base,
      semanal: true,
      pagar: [titulo("2026-10-25", 99900, "Diesel")],
      mes: { receita: 1000000, gastos: 1500000, resultado: -500000 },
      cotacoes: [{ nome: "Café arábica", valor: "R$ 1.601,25/sc", data: "2026-10-16" }],
      diasDesdeBackup: null,
    });
    expect(e.assunto).toBe("Novo Horizonte — resumo da semana (19/10)");
    expect(e.html).toContain("A pagar — resto da semana");
    expect(e.html).toContain("Diesel");
    expect(e.html).toContain("Resultado R$ -5.000,00");
    expect(e.html).toContain("Café arábica");
    expect(e.html).toContain("Nenhum backup baixado ainda");
  });
});
