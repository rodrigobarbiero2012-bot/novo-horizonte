import { describe, expect, it } from "vitest";
import { hojeSP, somarDias } from "./hoje";

describe("hojeSP", () => {
  it("usa o horário de Brasília, não o UTC do servidor", () => {
    // 18/10/2026 às 21h30 em São Paulo = 19/10 às 00h30 UTC.
    expect(hojeSP(new Date("2026-10-19T00:30:00Z"))).toBe("2026-10-18");
    expect(hojeSP(new Date("2026-10-19T03:30:00Z"))).toBe("2026-10-19");
    // Réveillon: 31/12 às 22h em SP ainda é o ano velho.
    expect(hojeSP(new Date("2027-01-01T01:00:00Z"))).toBe("2026-12-31");
  });
  it("soma dias atravessando mês e ano", () => {
    expect(somarDias("2026-12-28", 7)).toBe("2027-01-04");
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
  });
});
