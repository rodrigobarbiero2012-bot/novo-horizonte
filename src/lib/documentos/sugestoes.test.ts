import { describe, expect, it } from "vitest";
import { contaMaisUsada, termosDoFornecedor } from "./sugestoes";

describe("termosDoFornecedor", () => {
  it("descarta palavras genéricas e curtas, sem acento", () => {
    expect(termosDoFornecedor("MG AGRO COMÉRCIO DE PRODUTOS AGROPECUÁRIOS LTDA")).toEqual([]);
    expect(termosDoFornecedor("Pulvermaq Máquinas Agrícolas Ltda")).toEqual(["pulvermaq", "maquinas"]);
    expect(termosDoFornecedor("Sul Brasil Embalagens")).toEqual(["embalagens"]);
  });
});

describe("contaMaisUsada", () => {
  it("escolhe a conta que mais aparece", () => {
    expect(contaMaisUsada([{ contaId: "a" }, { contaId: "b" }, { contaId: "b" }])).toEqual({ contaId: "b", vezes: 2 });
    expect(contaMaisUsada([])).toBeNull();
  });
});
