import { ehDataIso } from "../validacao";
// Leitor de OFX (Open Financial Exchange), nas duas variantes que os bancos
// brasileiros exportam: OFX 1.x em SGML (tags sem fechamento) e OFX 2.x em
// XML. Só lê o que a conciliação usa: transações e saldo final.

export type TransacaoOfx = {
  fitid: string; // id da transação no banco (para não importar duas vezes)
  data: string; // ISO yyyy-mm-dd
  valorCentavos: number; // positivo = entrou na conta, negativo = saiu
  descricao: string;
  tipo: string; // TRNTYPE: DEBIT, CREDIT, PAYMENT, XFER...
};

export type ExtratoOfx = {
  banco: string | null;
  inicio: string | null;
  fim: string | null;
  saldoFinalCentavos: number | null;
  dataSaldo: string | null;
  transacoes: TransacaoOfx[];
};

/** Decodifica os bytes respeitando o cabeçalho (muitos bancos gravam em Windows-1252). */
export function decodificarOfx(bytes: Uint8Array): string {
  const inicio = new TextDecoder("latin1").decode(bytes.slice(0, 600));
  const latin = /CHARSET:\s*(1252|ISO-8859-1|8859-1)/i.test(inicio) || /encoding="(windows-1252|iso-8859-1)"/i.test(inicio);
  return new TextDecoder(latin ? "windows-1252" : "utf-8").decode(bytes);
}

/** Valor de uma tag: em SGML vai até a quebra de linha ou a próxima tag; em XML até </TAG>. */
function tag(bloco: string, nome: string): string | null {
  const m = bloco.match(new RegExp(`<${nome}>([^<\\r\\n]*)`, "i"));
  const v = m?.[1].trim();
  return v ? v.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">") : null;
}

/** "20261015120000[-3:BRT]" → "2026-10-15"; data impossível (ex.: mês 13) → null. */
function dataOfx(v: string | null): string | null {
  const m = v?.match(/^(\d{4})(\d{2})(\d{2})/);
  const iso = m ? `${m[1]}-${m[2]}-${m[3]}` : null;
  return ehDataIso(iso) ? iso : null;
}

/** "-548.00", "-548,00", "1.234,56" → centavos */
function valorOfx(v: string | null): number | null {
  if (!v) return null;
  const t = v.replace(/\s/g, "");
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(normal);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export function lerOfx(texto: string): ExtratoOfx {
  if (!/<OFX>/i.test(texto)) throw new Error("O arquivo não parece ser um OFX (falta a tag <OFX>).");

  const blocos = texto.split(/<STMTTRN>/i).slice(1).map((b) => b.split(/<\/STMTTRN>|<\/BANKTRANLIST>/i)[0]);
  const vistos = new Map<string, number>();
  const transacoes: TransacaoOfx[] = [];
  for (const bloco of blocos) {
    const data = dataOfx(tag(bloco, "DTPOSTED"));
    const valorCentavos = valorOfx(tag(bloco, "TRNAMT"));
    if (!data || valorCentavos === null || valorCentavos === 0) continue;
    const descricao = [tag(bloco, "NAME"), tag(bloco, "MEMO")].filter(Boolean).join(" — ") || "(sem descrição)";
    // Alguns bancos repetem ou omitem o FITID; nesse caso a chave é data+valor+descrição (+ ordem).
    const base = tag(bloco, "FITID") ?? `${data}|${valorCentavos}|${descricao}`;
    const repeticao = vistos.get(base) ?? 0;
    vistos.set(base, repeticao + 1);
    transacoes.push({
      fitid: repeticao ? `${base}#${repeticao + 1}` : base,
      data,
      valorCentavos,
      descricao: descricao.slice(0, 300),
      tipo: tag(bloco, "TRNTYPE") ?? "",
    });
  }

  const saldo = texto.match(/<LEDGERBAL>([\s\S]*?)(<\/LEDGERBAL>|<AVAILBAL>|<\/STMTRS>)/i)?.[1] ?? "";
  return {
    banco: tag(texto, "ORG") ?? tag(texto, "BANKID"),
    inicio: dataOfx(tag(texto, "DTSTART")),
    fim: dataOfx(tag(texto, "DTEND")),
    saldoFinalCentavos: valorOfx(tag(saldo, "BALAMT")),
    dataSaldo: dataOfx(tag(saldo, "DTASOF")),
    transacoes,
  };
}
