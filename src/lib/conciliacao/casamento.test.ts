import { describe, expect, it } from "vitest";
import { candidatas, casarAutomaticamente } from "./casamento";

describe("casarAutomaticamente", () => {
  it("casa por valor e data próxima, sem reutilizar partida", () => {
    const transacoes = [
      { id: "t1", data: "2026-10-05", valorCentavos: -54800 },
      { id: "t2", data: "2026-10-12", valorCentavos: -1000 },
      { id: "t3", data: "2026-10-13", valorCentavos: -1000 },
      { id: "t4", data: "2026-10-20", valorCentavos: -9999 }, // sem par
    ];
    const partidas = [
      { id: "p1", data: "2026-10-04", valorCentavos: -54800 },
      { id: "p2", data: "2026-10-13", valorCentavos: -1000 },
      { id: "p3", data: "2026-10-30", valorCentavos: -1000 }, // longe demais
      { id: "p4", data: "2026-10-05", valorCentavos: 54800 }, // sinal trocado
    ];
    expect(casarAutomaticamente(transacoes, partidas)).toEqual([
      { transacaoId: "t3", partidaId: "p2" }, // distância 0 vence
      { transacaoId: "t1", partidaId: "p1" },
    ]);
  });
});

describe("candidatas", () => {
  it("ordena pela proximidade da data", () => {
    const t = { id: "t", data: "2026-10-10", valorCentavos: -500 };
    const ps = [
      { id: "a", data: "2026-10-20", valorCentavos: -500 },
      { id: "b", data: "2026-10-09", valorCentavos: -500 },
      { id: "c", data: "2026-10-10", valorCentavos: -600 },
    ];
    expect(candidatas(t, ps).map((p) => p.id)).toEqual(["b", "a"]);
  });
});
