import type { Prisma } from "@prisma/client";
import { ehCultivoLinha, lerValorBr } from "../contabil/lancamento";
import { ehCategoria } from "../contabil/tipos";

// Filtros e ordenação da lista de lançamentos, lidos da URL. Usados pela tela
// e pela exportação para Excel (que exporta exatamente o que está filtrado).

const dataValida = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// Colunas ordenáveis e a direção usada no primeiro clique.
export const ORDENS = {
  data: "desc",
  conta: "asc",
  historico: "asc",
  debito: "desc", // maiores débitos primeiro
  credito: "desc", // maiores créditos primeiro
} as const;
export type Ordem = keyof typeof ORDENS;
export type Direcao = "asc" | "desc";

function ordenacao(ordem: Ordem, dir: Direcao): Prisma.PartidaOrderByWithRelationInput[] {
  const desempate: Prisma.PartidaOrderByWithRelationInput[] = [{ data: "desc" }, { linhaPlanilha: "desc" }, { id: "desc" }];
  switch (ordem) {
    case "data":
      return [{ data: dir }, { linhaPlanilha: dir }, { id: dir }];
    case "conta":
      return [{ conta: { nome: dir } }, ...desempate];
    case "historico":
      return [{ historico: { sort: dir, nulls: "last" } }, ...desempate];
    case "debito":
      return [{ valorCentavos: dir }, ...desempate];
    case "credito": // créditos são negativos: "maiores primeiro" = mais negativos primeiro
      return [{ valorCentavos: dir === "desc" ? "asc" : "desc" }, ...desempate];
  }
}


type Parametros = Record<string, string | string[] | undefined>;

export function filtroLancamentos(sp: Parametros) {
  // Filtros
  const conta = texto(sp.conta); // id da conta ou "cat:<Categoria>"
  const categoria = conta.startsWith("cat:") && ehCategoria(conta.slice(4)) ? conta.slice(4) : "";
  const contaId = conta && !conta.startsWith("cat:") ? conta : "";
  const busca = texto(sp.busca);
  const de = dataValida(sp.de) ? sp.de : "";
  const ate = dataValida(sp.ate) ? sp.ate : "";
  const tipo = sp.tipo === "D" || sp.tipo === "C" ? sp.tipo : "";
  const minTxt = texto(sp.min);
  const maxTxt = texto(sp.max);
  const cultivo = ehCultivoLinha(sp.cultivo) ? sp.cultivo : ""; // cultivo da linha (marcado nela ou o da conta)
  const min = lerValorBr(minTxt);
  const max = lerValorBr(maxTxt);
  const valorMin = min !== null && !Number.isNaN(min) ? Math.abs(min) : undefined;
  const valorMax = max !== null && !Number.isNaN(max) ? Math.abs(max) : undefined;

  // Ordenação
  const ordem: Ordem = typeof sp.ordem === "string" && sp.ordem in ORDENS ? (sp.ordem as Ordem) : "data";
  const dir: Direcao = sp.dir === "asc" || sp.dir === "desc" ? sp.dir : ORDENS[ordem];

  // Faixa de valor sobre o valor absoluto; débitos são positivos e créditos negativos.
  const debitos: Prisma.PartidaWhereInput = { valorCentavos: { gt: 0, gte: valorMin, lte: valorMax } };
  const creditos: Prisma.PartidaWhereInput = {
    valorCentavos: { lt: 0, lte: valorMin !== undefined ? -valorMin : undefined, gte: valorMax !== undefined ? -valorMax : undefined },
  };
  const filtroValor = tipo === "D" ? debitos : tipo === "C" ? creditos : valorMin !== undefined || valorMax !== undefined ? { OR: [debitos, creditos] } : {};

  const filtro: Prisma.PartidaWhereInput = {
    AND: [
      contaId ? { contaId } : {},
      categoria ? { conta: { categoria } } : {},
      de || ate ? { data: { ...(de && { gte: new Date(de) }), ...(ate && { lte: new Date(ate) }) } } : {},
      busca
        ? {
            OR: [
              { historico: { contains: busca, mode: "insensitive" } },
              { lancamento: { historico: { contains: busca, mode: "insensitive" } } },
            ],
          }
        : {},
      filtroValor,
      cultivo ? { OR: [{ atividade: cultivo }, { atividade: null, conta: { atividade: cultivo } }] } : {},
    ],
  };
  const orderBy = ordenacao(ordem, dir);
  const temFiltro = Boolean(conta || busca || de || ate || tipo || minTxt || maxTxt || cultivo);
  return { conta, categoria, contaId, busca, de, ate, tipo, minTxt, maxTxt, cultivo, ordem, dir, filtro, orderBy, temFiltro };
}
