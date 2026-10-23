import { describe, expect, it } from "vitest";
import { chaveDuplicata, lerData, lerPlanilhaLancamentos, valorCelula } from "./lancamentosExcel";

const contas = [
  { id: "adubo", nome: "Custeio Adubos" },
  { id: "acm", nome: "CC ACM (Capital Sócio)" },
];

describe("lerPlanilhaLancamentos", () => {
  it("lê o modelo, aceita colunas em outra ordem, nomes sem acento e datas/valores em vários formatos", () => {
    const r = lerPlanilhaLancamentos(
      [
        ["Modelo de importação"],
        [],
        ["Valor", "Data", "Historico", "Conta debito", "Conta crédito"],
        [1234.5, new Date(Date.UTC(2026, 9, 2)), "Adubo NPK", "custeio adubos", "CC ACM (Capital Sócio)"],
        ["1.234,56", "05/10/2026", { richText: [{ text: "Adubo " }, { text: "foliar" }] }, "Custeio Adubos", "CC ACM (Capital Socio)"],
        [null, "", "", "", ""], // linha vazia é ignorada
      ],
      contas,
    );
    expect(r.erro).toBeUndefined();
    expect(r.linhas).toEqual([
      { linha: 4, data: "2026-10-02", historico: "Adubo NPK", debito: "custeio adubos", credito: "CC ACM (Capital Sócio)", debitoId: "adubo", creditoId: "acm", valorCentavos: 123450, cultivo: null, erros: [] },
      { linha: 5, data: "2026-10-05", historico: "Adubo foliar", debito: "Custeio Adubos", credito: "CC ACM (Capital Socio)", debitoId: "adubo", creditoId: "acm", valorCentavos: 123456, cultivo: null, erros: [] },
    ]);
  });

  it("lê a coluna opcional Cultivo (sem acento e em qualquer caixa) e recusa cultivo desconhecido", () => {
    const r = lerPlanilhaLancamentos(
      [
        ["Data", "Histórico", "Conta débito", "Conta crédito", "Valor", "Cultivo"],
        ["01/03/2026", "diárias colheita maracujá", "Custeio Adubos", "CC ACM (Capital Sócio)", 10, "maracuja"],
        ["01/03/2026", "adubo", "Custeio Adubos", "CC ACM (Capital Sócio)", 10, ""],
        ["01/03/2026", "x", "Custeio Adubos", "CC ACM (Capital Sócio)", 10, "Soja"],
      ],
      contas,
    );
    expect(r.linhas.map((l) => l.cultivo)).toEqual(["Maracujá", null, null]);
    expect(r.linhas[2].erros).toEqual(['cultivo "Soja" não existe (use Café, Maracujá, Milho, Pecuária ou deixe vazio)']);
  });

  it("aponta os erros de cada linha", () => {
    const r = lerPlanilhaLancamentos(
      [
        ["Data", "Histórico", "Conta débito", "Conta crédito", "Valor"],
        ["31/02/2026", "", "Conta inexistente", "Custeio Adubos", -10],
        ["01/03/2026", "x", "Custeio Adubos", "Custeio Adubos", 10],
      ],
      contas,
    );
    expect(r.linhas[0].erros).toEqual(["data inválida", "histórico vazio", 'conta "Conta inexistente" não existe', "valor inválido (use número positivo)"]);
    expect(r.linhas[1].erros).toEqual(["débito e crédito na mesma conta"]);
  });

  it("recusa planilha sem os títulos do modelo", () => {
    expect(lerPlanilhaLancamentos([["a", "b"]], contas).erro).toMatch(/linha de títulos/);
    expect(lerPlanilhaLancamentos([["Data", "Conta débito"]], contas).erro).toMatch(/Faltam as colunas: Histórico, Conta crédito, Valor/);
  });
});

describe("células e datas", () => {
  it("lê fórmula pelo resultado e número de série de data do Excel", () => {
    expect(valorCelula({ formula: "A1*2", result: 42 })).toBe(42);
    expect(lerData(46297)).toBe("2026-10-02");
    expect(lerData("2026-10-02")).toBe("2026-10-02");
    expect(lerData("2026-13-02")).toBeNull();
  });
  it("chave de duplicata ignora acento e maiúsculas do histórico", () => {
    const base = { data: "2026-10-02", valorCentavos: 100, debitoId: "a", creditoId: "b" };
    expect(chaveDuplicata({ ...base, historico: "Adubo Café" })).toBe(chaveDuplicata({ ...base, historico: "adubo cafe" }));
  });
});
