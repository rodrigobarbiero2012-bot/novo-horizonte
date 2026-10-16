// Confere a base importada contra a planilha: recalcula DRE e Balanço a
// partir dos lançamentos e compara com o que o Excel calculou.
//
//   npm run conferir
//
// Sai com código 1 se houver divergência acima de 1 centavo.
import fs from "node:fs";
import path from "node:path";
import { conferir, type Referencia } from "../src/lib/importacao/conferencia";
import { agruparEmBlocos, paraPartida, type LinhaPlanilha } from "../src/lib/importacao/planilha";

const dir = path.join(process.cwd(), "data", "import");
const ler = <T>(nome: string): T => JSON.parse(fs.readFileSync(path.join(dir, nome), "utf-8"));

const linhas = ler<LinhaPlanilha[]>("lancamentos.json");
const referencia = ler<Referencia>("referencia.json");
const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const blocos = agruparEmBlocos(linhas);
const porTamanho = new Map<string, number>();
for (const b of blocos) {
  const k = b.linhas.length > 6 ? "7+" : String(b.linhas.length);
  porTamanho.set(k, (porTamanho.get(k) ?? 0) + 1);
}
console.log(`Linhas: ${linhas.length} → ${blocos.length} lançamentos em partidas dobradas`);
console.log(`  por nº de pernas: ${[...porTamanho].map(([k, v]) => `${k}: ${v}`).join(" · ")}`);
const abertos = blocos.filter((b) => b.saldoCentavos !== 0);
if (abertos.length) {
  for (const b of abertos) console.log(`  ⚠ bloco sem fechamento a partir da linha ${b.linhas[0].linha}: ${brl(b.saldoCentavos)}`);
}

// Blocos que atravessam a virada de ano explicam diferença no balanço de 31/dez.
const viradas = blocos.filter((b) => new Set(b.linhas.map((l) => l.data.slice(0, 4))).size > 1);
for (const b of viradas) {
  const porAno = new Map<string, number>();
  for (const l of b.linhas) porAno.set(l.data.slice(0, 4), (porAno.get(l.data.slice(0, 4)) ?? 0) + Math.round(l.valor * 100));
  const desc = [...porAno].map(([a, c]) => `${a}: ${brl(c)}`).join(", ");
  console.log(`  ↳ lançamento das linhas ${b.linhas[0].linha}–${b.linhas.at(-1)!.linha} atravessa anos (${desc})`);
}

const { anos, comparacoes, divergencias } = conferir(linhas.map(paraPartida), referencia);
console.log(`\nConferência DRE + Balanço ${anos[0]}–${anos.at(-1)}: ${comparacoes} valores comparados`);
if (!divergencias.length) {
  console.log("✔ Tudo bate com a planilha (tolerância de 1 centavo).");
} else {
  console.log(`✘ ${divergencias.length} divergências:`);
  for (const d of divergencias) {
    console.log(
      `  ${d.relatorio} · ${d.linha} · ${d.ano}: sistema ${brl(d.sistemaCentavos)} × planilha ${brl(d.planilhaCentavos)}`,
    );
  }
  process.exitCode = 1;
}
