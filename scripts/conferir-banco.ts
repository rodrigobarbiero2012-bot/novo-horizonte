// Confere o banco atual contra o gabarito da planilha (data/import/referencia.json).
//
//   npm run conferir:banco
//
// Útil depois de correções: diferenças esperadas (ex.: ao corrigir a data da
// linha 8847) aparecem listadas, e o resto deve continuar batendo.
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/db";
import { carregarPartidas } from "../src/lib/contabil/repositorio";
import { conferir, type Referencia } from "../src/lib/importacao/conferencia";

async function main() {
  const referencia: Referencia = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "import", "referencia.json"), "utf-8"));
  const { anos, comparacoes, divergencias } = conferir(await carregarPartidas(prisma), referencia);
  const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (!divergencias.length) {
    console.log(`✔ Banco confere com a planilha: ${comparacoes} valores de DRE e Balanço, ${anos[0]}–${anos.at(-1)}.`);
    return;
  }
  console.log(`${divergencias.length} diferença(s) em relação à planilha original:`);
  for (const d of divergencias) {
    console.log(`  ${d.relatorio} · ${d.linha} · ${d.ano}: banco ${brl(d.sistemaCentavos)} × planilha ${brl(d.planilhaCentavos)}`);
  }
  process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
