// Mão de obra: valor dos apontamentos, conta de custeio sugerida e montagem
// do fechamento (quanto pagar a cada pessoa e o lançamento contábil).

export const TIPOS_TRABALHADOR = {
  DIARISTA: "Diarista",
  FUNCIONARIO: "Funcionário",
  EMPREITA: "Empreita / colheita por produção",
} as const;
export type TipoTrabalhador = keyof typeof TIPOS_TRABALHADOR;
export const ehTipoTrabalhador = (v: unknown): v is TipoTrabalhador => typeof v === "string" && v in TIPOS_TRABALHADOR;

export const ATIVIDADES_MAO_DE_OBRA = {
  CAFE: "Café",
  MARACUJA: "Maracujá",
  MILHO: "Milho",
  PECUARIA: "Pecuária",
  GERAL: "Geral (sítio todo)",
} as const;
export type AtividadeMaoDeObra = keyof typeof ATIVIDADES_MAO_DE_OBRA;
export const ehAtividadeMaoDeObra = (v: unknown): v is AtividadeMaoDeObra => typeof v === "string" && v in ATIVIDADES_MAO_DE_OBRA;

/** Serviços mais comuns (sugestões; o campo aceita qualquer texto). */
export const SERVICOS = ["Colheita", "Capina / carpa", "Desbrota", "Adubação", "Pulverização", "Arruação / varrição", "Terreiro / secagem", "Plantio", "Poda / recepa", "Trato do gado", "Manutenção"];

/** Valor do apontamento: dias × diária + quantidade colhida × preço por unidade, em centavos. */
export function valorApontamento(dias: number, diariaCentavos: number | null, quantidade: number | null, precoUnidadeCentavos: number | null): number {
  return Math.round(dias * (diariaCentavos ?? 0) + (quantidade ?? 0) * (precoUnidadeCentavos ?? 0));
}

type ContaCusteio = { id: string; nome: string; atividade: string };

/**
 * Conta de custeio sugerida para o serviço: no café, colheita, carpa e
 * desbrota têm contas próprias; o resto vai para pessoal da atividade; sem
 * conta de pessoal, custeio geral.
 */
export function contaSugerida(atividade: AtividadeMaoDeObra, servico: string, contas: ContaCusteio[]): string | null {
  const s = servico.toLowerCase();
  const nomeAtividade = ATIVIDADES_MAO_DE_OBRA[atividade];
  const da = contas.filter((c) => c.atividade === nomeAtividade);
  const achar = (lista: ContaCusteio[], re: RegExp) => lista.find((c) => re.test(c.nome))?.id ?? null;
  const porServico =
    (/colheita|panha|derri/.test(s) && achar(da, /colheita.*m[ãa]o de obra/i)) ||
    (/capina|carpa|ro[çc]ad|limpeza/.test(s) && achar(da, /carpa|limpeza/i)) ||
    (/desbrota/.test(s) && achar(da, /desbrota/i));
  // "Pessoal" antes de "mão de obra": no café, "Colheita - Mão de Obra" só vale para colheita.
  return porServico || achar(da, /pessoal/i) || achar(da, /m[ãa]o de obra/i) || achar(contas.filter((c) => c.atividade === "Geral"), /em geral/i) || contas[0]?.id || null;
}

export type ApontamentoAberto = { trabalhadorId: string; nome: string; contaId: string; dias: number; quantidade: number | null; valorCentavos: number };

export type ResumoFechamento = {
  porPessoa: { trabalhadorId: string; nome: string; dias: number; quantidade: number; valorCentavos: number }[];
  porConta: { contaId: string; valorCentavos: number }[];
  totalCentavos: number;
};

/** Quanto pagar a cada pessoa e quanto lançar em cada conta de custeio. */
export function resumirFechamento(apontamentos: ApontamentoAberto[]): ResumoFechamento {
  const pessoas = new Map<string, ResumoFechamento["porPessoa"][number]>();
  const contas = new Map<string, number>();
  for (const a of apontamentos) {
    const p = pessoas.get(a.trabalhadorId) ?? { trabalhadorId: a.trabalhadorId, nome: a.nome, dias: 0, quantidade: 0, valorCentavos: 0 };
    p.dias += a.dias;
    p.quantidade += a.quantidade ?? 0;
    p.valorCentavos += a.valorCentavos;
    pessoas.set(a.trabalhadorId, p);
    contas.set(a.contaId, (contas.get(a.contaId) ?? 0) + a.valorCentavos);
  }
  return {
    porPessoa: [...pessoas.values()].sort((x, y) => y.valorCentavos - x.valorCentavos),
    porConta: [...contas].map(([contaId, valorCentavos]) => ({ contaId, valorCentavos })),
    totalCentavos: apontamentos.reduce((s, a) => s + a.valorCentavos, 0),
  };
}

/** Pernas do lançamento do fechamento: débito em cada custeio, crédito total na conta que pagou. */
export function partidasDoFechamento(r: ResumoFechamento, contaPagamentoId: string) {
  return [
    ...r.porConta.filter((c) => c.valorCentavos !== 0).map((c) => ({ contaId: c.contaId, valorCentavos: c.valorCentavos })),
    { contaId: contaPagamentoId, valorCentavos: -r.totalCentavos },
  ];
}
