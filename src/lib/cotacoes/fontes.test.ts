import { describe, expect, it } from "vitest";
import { lerPtax, lerTabelaCepea } from "./fontes";

// Trecho no formato real da página do CEPEA (indicador principal + uma segunda tabela que deve ser ignorada).
const HTML_CEPEA = `
<table id="imagenet-indicador1" class="imagenet-table">
  <thead><tr><th class="strong">&nbsp;</th><th>Valor R$</th><th>Var./Dia</th><th>Var./Mês</th><th>Valor US$</th></tr></thead>
  <tbody>
    <tr>
      <td>16/10/2026</td>
      <td>1.601,25</td>
      <td>1,52%</td>
      <td>1,55%</td>
      <td>315,52</td>
    </tr>
    <tr><td>15/10/2026</td><td>1.577,21</td><td>0,38%</td><td>0,02%</td><td>309,38</td></tr>
    <tr class="imagenet-tbl-esconder"><td>06/10/2026</td><td>1.568,95</td><td>0,02%</td><td>-0,50%</td><td>315,05</td></tr>
  </tbody>
</table>
<table id="imagenet-indicador2"><tbody><tr><td>16/10/2026</td><td>963,28</td></tr></tbody></table>`;

describe("lerTabelaCepea", () => {
  it("lê data e valor do indicador principal, ignorando as outras tabelas", () => {
    expect(lerTabelaCepea(HTML_CEPEA)).toEqual([
      { data: "2026-10-16", valor: 1601.25 },
      { data: "2026-10-15", valor: 1577.21 },
      { data: "2026-10-06", valor: 1568.95 },
    ]);
  });

  it("falha de forma explícita se o layout mudar", () => {
    expect(() => lerTabelaCepea("<html>nada aqui</html>")).toThrow(/não encontrada/);
  });
});

describe("lerPtax", () => {
  it("fica com o último boletim de cada dia", () => {
    const json = {
      value: [
        { cotacaoVenda: 5.04, dataHoraCotacao: "2026-10-15 10:09:00.000" },
        { cotacaoVenda: 5.0521, dataHoraCotacao: "2026-10-15 13:05:33.305" },
        { cotacaoVenda: 5.0826, dataHoraCotacao: "2026-10-16 13:04:14.548" },
      ],
    };
    expect(lerPtax(json)).toEqual([
      { data: "2026-10-15", valor: 5.0521 },
      { data: "2026-10-16", valor: 5.0826 },
    ]);
  });
});
