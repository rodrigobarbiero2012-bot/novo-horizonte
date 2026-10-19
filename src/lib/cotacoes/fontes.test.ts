import { describe, expect, it } from "vitest";
import { lerIndicadorVaca, lerMaracujaCeasa, lerPtax, lerTabelaCepea } from "./fontes";

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

// Trecho no formato real da página "Indicador da Vaca" (Notícias Agrícolas / Datagro): um bloco por dia.
const bloco = (data: string, sp: string) => `
<div class="cotacao"><div class="info"><div class="text-infos"><div class="title-descricao">
  <div class="fechamento">Fechamento: ${data}</div>
</div><div class="fonte"><span>Fonte: Datagro</span></div></div></div>
<div class="table-content"><table class="cot-fisicas">
  <thead class="head-box"><tr><th>Estado</th><th>R$/@</th><th>Variação (%)</th><th>U$/@</th></tr></thead>
  <tbody class="body-box">
    <tr><td>Goiás</td><td>349,93</td><td>+0,23</td><td>68,80</td></tr>
    <tr>
      <td>São Paulo</td>
      <td>${sp}</td>
      <td>+1,53</td>
      <td>69,33</td>
    </tr>
  </tbody>
</table></div></div>`;

describe("lerIndicadorVaca", () => {
  it("lê o valor de São Paulo em cada dia publicado", () => {
    expect(lerIndicadorVaca(bloco("15/10/2026", "352,59") + bloco("14/10/2026", "1.347,30"))).toEqual([
      { data: "2026-10-15", valor: 352.59 },
      { data: "2026-10-14", valor: 1347.3 },
    ]);
  });
  it("lê outro estado quando pedido e acusa layout desconhecido", () => {
    expect(lerIndicadorVaca(bloco("15/10/2026", "352,59"), "Goiás")).toEqual([{ data: "2026-10-15", valor: 349.93 }]);
    expect(() => lerIndicadorVaca("<html></html>")).toThrow(/Indicador da Vaca/);
  });
});

// Trecho no formato real da página "Maracujá - Ceasas": várias centrais na mesma tabela.
const diaMaracuja = (data: string, ceagesp: string) => `
<div class="cotacao"><div class="info"><div class="text-infos"><div class="title-descricao">
<div class="fechamento">Fechamento: ${data}</div></div></div></div>
<div class="table-content"><table class="cot-fisicas">
<thead class="head-box"><tr><th>Tipo</th><th>Preço (R$/Kg)</th><th>Variação (%)</th></tr></thead>
<tbody class="body-box">
<tr><td>Ceasa Campinas/SP</td><td>***</td><td>***</td></tr>
<tr><td>Azedo-Extra</td><td>11,82</td><td>+8,34</td></tr>
<tr><td>Doce (T 06-15)</td><td>18,33</td><td>0,00</td></tr>
<tr><td>Ceagesp/SP</td><td>***</td><td>***</td></tr>
<tr>
  <td>Azedo 4A</td>
  <td>${ceagesp}</td>
  <td>0,00</td>
</tr>
<tr><td>Doce (10 a 15 frutos)</td><td>16,47</td><td>0,00</td></tr>
</tbody></table></div></div>`;

describe("lerMaracujaCeasa", () => {
  it("pega o azedo da Ceagesp em cada dia, ignorando as outras centrais", () => {
    expect(lerMaracujaCeasa(diaMaracuja("16/10/2026", "9,34") + diaMaracuja("15/10/2026", "10,26"))).toEqual([
      { data: "2026-10-16", valor: 9.34 },
      { data: "2026-10-15", valor: 10.26 },
    ]);
  });
  it("lê outra central quando pedido e acusa layout desconhecido", () => {
    expect(lerMaracujaCeasa(diaMaracuja("16/10/2026", "9,34"), "Ceasa Campinas/SP")).toEqual([{ data: "2026-10-16", valor: 11.82 }]);
    expect(() => lerMaracujaCeasa("<html></html>")).toThrow(/Maracujá/);
  });
});

