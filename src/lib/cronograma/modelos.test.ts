import { describe, expect, it } from "vitest";
import { MODELOS, situacao } from "./modelos";

describe("situacao", () => {
  const hoje = { ano: 2026, mes: 10 };
  const t = (mesInicio: number, mesFim: number, concluida = false, ano = 2026) => ({ ano, mesInicio, mesFim, concluida });

  it("classifica pela posição do mês atual", () => {
    expect(situacao(t(5, 8), hoje)).toBe("atrasada");
    expect(situacao(t(9, 11), hoje)).toBe("andamento");
    expect(situacao(t(11, 12), hoje)).toBe("prevista");
    expect(situacao(t(5, 8, true), hoje)).toBe("concluida");
  });

  it("considera o ano da tarefa", () => {
    expect(situacao(t(1, 2, false, 2027), hoje)).toBe("prevista");
    expect(situacao(t(11, 12, false, 2025), hoje)).toBe("atrasada");
  });
});

describe("modelos", () => {
  it("todas as tarefas têm meses válidos (1–12, início ≤ fim)", () => {
    for (const tarefas of Object.values(MODELOS)) {
      for (const m of tarefas) {
        expect(m.mesInicio, m.titulo).toBeGreaterThanOrEqual(1);
        expect(m.mesFim, m.titulo).toBeLessThanOrEqual(12);
        expect(m.mesInicio, m.titulo).toBeLessThanOrEqual(m.mesFim);
      }
    }
  });
});
