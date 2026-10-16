// Importa o plano de contas e o razão da planilha (data/import/*.json, gerados
// por `npm run extrair`) para o banco, e confere o resultado a partir do banco.
//
//   npm run importar                 # recusa se a planilha já foi importada
//   npm run importar -- --substituir # apaga a importação anterior e refaz
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { carregarPartidas } from "../src/lib/contabil/repositorio";
import { paraCentavos } from "../src/lib/contabil/tipos";
import { conferir, type Referencia } from "../src/lib/importacao/conferencia";
import { agruparEmBlocos, paraPartida, type ContaPlanilha, type LinhaPlanilha } from "../src/lib/importacao/planilha";

const dir = path.join(process.cwd(), "data", "import");
const ler = <T>(nome: string): T => JSON.parse(fs.readFileSync(path.join(dir, nome), "utf-8"));
const LOTE = 1000;

function fiscal(v: string | null): boolean | null {
  const s = v?.trim().toLowerCase();
  return s === "s" ? true : s === "n" ? false : null;
}

async function main() {
  const plano = ler<ContaPlanilha[]>("plano_contas.json");
  const linhas = ler<LinhaPlanilha[]>("lancamentos.json");
  const referencia = ler<Referencia>("referencia.json");
  linhas.forEach(paraPartida); // valida categoria/atividade antes de gravar qualquer coisa

  const jaImportados = await prisma.lancamento.count({ where: { origem: "PLANILHA" } });
  if (jaImportados) {
    if (!process.argv.includes("--substituir")) {
      console.error(`A planilha já foi importada (${jaImportados} lançamentos). Use --substituir para refazer.`);
      process.exit(1);
    }
    await prisma.lancamento.deleteMany({ where: { origem: "PLANILHA" } });
    console.log(`Importação anterior removida (${jaImportados} lançamentos).`);
  }

  // Contas: uma por "Conta Padrão"; cada "Conta Original" vira um apelido.
  const contaPorPadrao = new Map<string, ContaPlanilha>();
  for (const c of plano) {
    const existente = contaPorPadrao.get(c.contaPadrao);
    if (existente && (existente.categoria !== c.categoria || existente.atividade !== c.atividade)) {
      throw new Error(`"${c.contaPadrao}" aparece com classificações diferentes nas linhas ${existente.linha} e ${c.linha}`);
    }
    contaPorPadrao.set(c.contaPadrao, c);
  }
  const idPorPadrao = new Map<string, string>();
  for (const [nome, c] of contaPorPadrao) {
    const conta = await prisma.conta.upsert({
      where: { nome },
      create: { nome, categoria: c.categoria, atividade: c.atividade, natureza: c.natureza },
      update: { categoria: c.categoria, atividade: c.atividade, natureza: c.natureza },
    });
    idPorPadrao.set(nome, conta.id);
  }
  for (const c of plano) {
    await prisma.contaApelido.upsert({
      where: { nome: c.contaOriginal },
      create: { nome: c.contaOriginal, contaId: idPorPadrao.get(c.contaPadrao)! },
      update: { contaId: idPorPadrao.get(c.contaPadrao)! },
    });
  }
  console.log(`Contas: ${idPorPadrao.size} (${plano.length} grafias da planilha)`);

  const blocos = agruparEmBlocos(linhas);
  const abertos = blocos.filter((b) => b.saldoCentavos !== 0);
  if (abertos.length) throw new Error(`${abertos.length} bloco(s) não fecham em partidas dobradas — rode npm run conferir`);

  const lancamentos = [];
  const partidas = [];
  for (const b of blocos) {
    const id = randomUUID();
    const primeira = b.linhas[0];
    const ultima = b.linhas.at(-1)!;
    lancamentos.push({
      id,
      data: new Date(primeira.data),
      historico:
        b.linhas.length <= 6
          ? (b.linhas.find((l) => l.historico)?.historico ?? null)
          : `Lote da planilha — linhas ${primeira.linha} a ${ultima.linha}`,
      origem: "PLANILHA",
      linhaPlanilhaInicio: primeira.linha,
      linhaPlanilhaFim: ultima.linha,
    });
    for (const l of b.linhas) {
      partidas.push({
        lancamentoId: id,
        contaId: idPorPadrao.get(l.contaPadrao)!,
        data: new Date(l.data),
        valorCentavos: paraCentavos(l.valor),
        historico: l.historico,
        fiscal: fiscal(l.fiscal),
        valorNominalCentavos: l.valorNominal == null ? null : paraCentavos(l.valorNominal),
        linhaPlanilha: l.linha,
      });
    }
  }
  for (let i = 0; i < lancamentos.length; i += LOTE) {
    await prisma.lancamento.createMany({ data: lancamentos.slice(i, i + LOTE) });
  }
  for (let i = 0; i < partidas.length; i += LOTE) {
    await prisma.partida.createMany({ data: partidas.slice(i, i + LOTE) });
  }
  await prisma.registroAuditoria.create({
    data: {
      entidade: "Lancamento",
      entidadeId: "planilha",
      acao: "IMPORTAR",
      depois: { lancamentos: lancamentos.length, partidas: partidas.length, fonte: "Gerencial Financeiro_2.xlsx" },
    },
  });
  console.log(`Gravados: ${lancamentos.length} lançamentos, ${partidas.length} partidas`);

  // Conferência lendo do banco, não do JSON: prova que o que foi gravado bate.
  const { anos, comparacoes, divergencias } = conferir(await carregarPartidas(prisma), referencia);
  if (divergencias.length) {
    console.error(`✘ ${divergencias.length} divergências entre o banco e a planilha:`, divergencias.slice(0, 10));
    process.exitCode = 1;
  } else {
    console.log(`✔ Banco confere com a planilha: ${comparacoes} valores de DRE e Balanço, ${anos[0]}–${anos.at(-1)}.`);
  }
}

main().finally(() => prisma.$disconnect());
