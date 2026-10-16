import { ehAtividade, ehCategoria, paraCentavos, type PartidaContabil } from "../contabil/tipos";

/** Linha de data/import/lancamentos.json (gerado por scripts/extrair_planilha.py). */
export type LinhaPlanilha = {
  linha: number;
  data: string;
  contaOriginal: string;
  contaPadrao: string;
  categoria: string;
  atividade: string;
  historico: string | null;
  valor: number;
  fiscal: string | null;
  valorNominal: number | null;
  dc: string | null;
  ano: number;
};

/** Linha de data/import/plano_contas.json. */
export type ContaPlanilha = {
  linha: number;
  contaOriginal: string;
  contaPadrao: string;
  categoria: string;
  atividade: string;
  natureza: string;
};

export function paraPartida(l: LinhaPlanilha): PartidaContabil {
  if (!ehCategoria(l.categoria)) throw new Error(`linha ${l.linha}: categoria desconhecida "${l.categoria}"`);
  if (!ehAtividade(l.atividade)) throw new Error(`linha ${l.linha}: atividade desconhecida "${l.atividade}"`);
  return { data: l.data, categoria: l.categoria, atividade: l.atividade, valorCentavos: paraCentavos(l.valor) };
}

export type BlocoImportado = {
  linhas: LinhaPlanilha[];
  /** Soma em centavos; zero quando o bloco fecha em partidas dobradas. */
  saldoCentavos: number;
};

/**
 * A planilha não identifica qual linha é contrapartida de qual: as pernas de um
 * lançamento são apenas linhas consecutivas. Aqui elas são agrupadas lendo em
 * ordem até a soma voltar a zero. Na maioria dos casos isso dá o par
 * banco ↔ conta (2 linhas); nos fechamentos mensais em lote o bloco fica maior.
 * Se a planilha terminar com soma diferente de zero, o último bloco vem com
 * `saldoCentavos` ≠ 0.
 */
export function agruparEmBlocos(linhas: LinhaPlanilha[]): BlocoImportado[] {
  const blocos: BlocoImportado[] = [];
  let atual: LinhaPlanilha[] = [];
  let saldo = 0;
  for (const l of linhas) {
    atual.push(l);
    saldo += paraCentavos(l.valor);
    if (saldo === 0) {
      blocos.push({ linhas: atual, saldoCentavos: 0 });
      atual = [];
    }
  }
  if (atual.length) blocos.push({ linhas: atual, saldoCentavos: saldo });
  return blocos;
}
