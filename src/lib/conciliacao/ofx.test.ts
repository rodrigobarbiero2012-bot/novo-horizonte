import { describe, expect, it } from "vitest";
import { decodificarOfx, lerOfx } from "./ofx";

const SGML = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
CHARSET:1252

<OFX>
<SIGNONMSGSRSV1><SONRS><FI><ORG>SICOOB</ORG></FI></SONRS></SIGNONMSGSRSV1>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKTRANLIST>
<DTSTART>20261001
<DTEND>20261015
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261005120000[-3:BRT]
<TRNAMT>-548.00
<FITID>2026100501
<MEMO>PAGTO BOLETO PULVERMAQ
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261010
<TRNAMT>1500,50
<FITID>2026101002
<NAME>PIX RECEBIDO
<MEMO>COFFEA LTDA
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261012
<TRNAMT>-10.00
<MEMO>TARIFA
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261012
<TRNAMT>-10.00
<MEMO>TARIFA
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>932.50<DTASOF>20261015</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200" VERSION="211"?>
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKTRANLIST><DTSTART>20261001000000</DTSTART><DTEND>20261031000000</DTEND>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261020</DTPOSTED><TRNAMT>-80.99</TRNAMT><FITID>X1</FITID><MEMO>VIVO &amp; CIA</MEMO></STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>-80.99</BALAMT><DTASOF>20261031</DTASOF></LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

describe("lerOfx", () => {
  it("lê OFX 1.x (SGML): transações, saldo, período e banco", () => {
    const e = lerOfx(SGML);
    expect(e).toMatchObject({ banco: "SICOOB", inicio: "2026-10-01", fim: "2026-10-15", saldoFinalCentavos: 93250, dataSaldo: "2026-10-15" });
    expect(e.transacoes.slice(0, 2)).toEqual([
      { fitid: "2026100501", data: "2026-10-05", valorCentavos: -54800, descricao: "PAGTO BOLETO PULVERMAQ", tipo: "DEBIT" },
      { fitid: "2026101002", data: "2026-10-10", valorCentavos: 150050, descricao: "PIX RECEBIDO — COFFEA LTDA", tipo: "CREDIT" },
    ]);
  });

  it("transações sem FITID e repetidas ganham chaves distintas", () => {
    const [, , a, b] = lerOfx(SGML).transacoes;
    expect(a.fitid).not.toBe(b.fitid);
    expect(b.fitid.endsWith("#2")).toBe(true);
  });

  it("lê OFX 2.x (XML) e decodifica entidades", () => {
    const e = lerOfx(XML);
    expect(e.transacoes).toEqual([{ fitid: "X1", data: "2026-10-20", valorCentavos: -8099, descricao: "VIVO & CIA", tipo: "DEBIT" }]);
    expect(e.saldoFinalCentavos).toBe(-8099);
  });

  it("recusa arquivo que não é OFX", () => {
    expect(() => lerOfx("data;valor\n01/10;10")).toThrow(/OFX/);
  });
});

describe("decodificarOfx", () => {
  it("respeita CHARSET:1252 (acentos de bancos brasileiros)", () => {
    const bytes = new Uint8Array([...new TextEncoder().encode("CHARSET:1252\n<OFX><MEMO>"), 0xc7, 0xc3, 0x4f]); // "ÇÃO" em 1252
    expect(decodificarOfx(bytes)).toContain("ÇÃO");
  });
});
