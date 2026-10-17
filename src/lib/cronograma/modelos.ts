// Modelos iniciais do cronograma: calendário agronômico típico do Sudeste.
// São um ponto de partida — épocas e manejos variam com região, variedade,
// idade da lavoura e clima do ano. Cada ano é copiado do modelo e ajustado
// pelos sócios (com o agrônomo/veterinário) direto na tela.

export const ATIVIDADES_CRONOGRAMA = {
  cafe: { chave: "CAFE", nome: "Café" },
  maracuja: { chave: "MARACUJA", nome: "Maracujá" },
  milho: { chave: "MILHO", nome: "Milho" },
  pecuaria: { chave: "PECUARIA", nome: "Pecuária" },
} as const;

export type SlugAtividade = keyof typeof ATIVIDADES_CRONOGRAMA;
export type ChaveAtividade = (typeof ATIVIDADES_CRONOGRAMA)[SlugAtividade]["chave"];

export const ehSlugAtividade = (s: string): s is SlugAtividade => s in ATIVIDADES_CRONOGRAMA;

export type TarefaModelo = { etapa: string; titulo: string; mesInicio: number; mesFim: number };

const CAFE: TarefaModelo[] = [
  // Ano agrícola visto no calendário civil: começa com a lavoura em granação e termina na florada da safra seguinte.
  { etapa: "Granação e maturação", titulo: "Acompanhar granação e enchimento dos grãos", mesInicio: 1, mesFim: 3 },
  { etapa: "Granação e maturação", titulo: "Estimativa de safra (contagem por amostragem)", mesInicio: 3, mesFim: 4 },
  { etapa: "Pré-colheita", titulo: "Manutenção de colheitadeira, secador e tulha", mesInicio: 3, mesFim: 4 },
  { etapa: "Pré-colheita", titulo: "Limpeza e preparo dos terreiros", mesInicio: 4, mesFim: 4 },
  { etapa: "Pré-colheita", titulo: "Arruação / limpeza da saia dos cafeeiros", mesInicio: 4, mesFim: 5 },
  { etapa: "Pré-colheita", titulo: "Contratação da mão de obra e materiais de colheita", mesInicio: 3, mesFim: 4 },
  { etapa: "Colheita", titulo: "Colheita (mecanizada e manual)", mesInicio: 5, mesFim: 8 },
  { etapa: "Colheita", titulo: "Varrição e recolhimento do café de chão", mesInicio: 7, mesFim: 9 },
  { etapa: "Pós-colheita", titulo: "Secagem em terreiro e secador", mesInicio: 5, mesFim: 9 },
  { etapa: "Pós-colheita", titulo: "Armazenamento, beneficiamento e classificação", mesInicio: 6, mesFim: 10 },
  { etapa: "Pós-colheita", titulo: "Comercialização da safra", mesInicio: 6, mesFim: 12 },
  { etapa: "Tratos culturais", titulo: "Podas (esqueletamento, decote, recepa) e desbrotas", mesInicio: 8, mesFim: 10 },
  { etapa: "Tratos culturais", titulo: "Análise de solo e foliar", mesInicio: 8, mesFim: 9 },
  { etapa: "Tratos culturais", titulo: "Calagem e gessagem", mesInicio: 9, mesFim: 10 },
  { etapa: "Tratos culturais", titulo: "Controle do mato (roçada, capina, herbicida)", mesInicio: 10, mesFim: 12 },
  { etapa: "Florada e adubação", titulo: "Acompanhar a florada", mesInicio: 9, mesFim: 10 },
  { etapa: "Florada e adubação", titulo: "1ª adubação de solo (NPK)", mesInicio: 10, mesFim: 11 },
  { etapa: "Florada e adubação", titulo: "2ª adubação de solo", mesInicio: 12, mesFim: 12 },
  { etapa: "Florada e adubação", titulo: "3ª adubação de solo", mesInicio: 2, mesFim: 3 },
  { etapa: "Florada e adubação", titulo: "Adubação foliar (micronutrientes)", mesInicio: 11, mesFim: 12 },
  { etapa: "Fitossanidade", titulo: "Controle de ferrugem e cercosporiose", mesInicio: 11, mesFim: 12 },
  { etapa: "Fitossanidade", titulo: "Controle de ferrugem e cercosporiose (2ª aplicação)", mesInicio: 1, mesFim: 3 },
  { etapa: "Fitossanidade", titulo: "Monitorar bicho-mineiro", mesInicio: 9, mesFim: 12 },
  { etapa: "Fitossanidade", titulo: "Monitorar e controlar a broca-do-café", mesInicio: 1, mesFim: 3 },
];

const MARACUJA: TarefaModelo[] = [
  { etapa: "Colheita", titulo: "Colheita e classificação dos frutos", mesInicio: 1, mesFim: 7 },
  { etapa: "Colheita", titulo: "Comercialização (Ceasa, atacadistas, indústria)", mesInicio: 1, mesFim: 7 },
  { etapa: "Colheita", titulo: "Início da colheita da nova safra", mesInicio: 12, mesFim: 12 },
  { etapa: "Florada e polinização", titulo: "Polinização manual (à tarde, nas flores abertas)", mesInicio: 1, mesFim: 4 },
  { etapa: "Florada e polinização", titulo: "Polinização manual — nova florada", mesInicio: 10, mesFim: 12 },
  { etapa: "Nutrição e irrigação", titulo: "Adubação de cobertura (parcelada)", mesInicio: 1, mesFim: 3 },
  { etapa: "Nutrição e irrigação", titulo: "Adubação de cobertura (parcelada) — novo ciclo", mesInicio: 10, mesFim: 12 },
  { etapa: "Nutrição e irrigação", titulo: "Irrigação no período seco", mesInicio: 7, mesFim: 10 },
  { etapa: "Fitossanidade", titulo: "Monitorar viroses e eliminar plantas com sintoma", mesInicio: 1, mesFim: 12 },
  { etapa: "Fitossanidade", titulo: "Controle de antracnose, verrugose e bacteriose", mesInicio: 10, mesFim: 12 },
  { etapa: "Fitossanidade", titulo: "Controle de antracnose, verrugose e bacteriose (continuação)", mesInicio: 1, mesFim: 3 },
  { etapa: "Fitossanidade", titulo: "Monitorar lagartas e mosca-das-frutas", mesInicio: 1, mesFim: 4 },
  { etapa: "Renovação e plantio", titulo: "Poda de limpeza / erradicação do pomar velho", mesInicio: 6, mesFim: 7 },
  { etapa: "Renovação e plantio", titulo: "Análise de solo, calagem e preparo da área", mesInicio: 6, mesFim: 8 },
  { etapa: "Renovação e plantio", titulo: "Produção ou compra de mudas", mesInicio: 6, mesFim: 8 },
  { etapa: "Renovação e plantio", titulo: "Montagem da espaldeira (postes e arames)", mesInicio: 8, mesFim: 9 },
  { etapa: "Renovação e plantio", titulo: "Plantio das mudas", mesInicio: 9, mesFim: 10 },
  { etapa: "Renovação e plantio", titulo: "Condução: desbrota e poda de formação", mesInicio: 10, mesFim: 12 },
];

// Milho de verão (safra), plantado na primavera e colhido no outono; a
// silagem, se houver, sai antes da colheita de grãos.
const MILHO: TarefaModelo[] = [
  { etapa: "Colheita e pós-colheita", titulo: "Corte para silagem (se for o destino)", mesInicio: 1, mesFim: 2 },
  { etapa: "Colheita e pós-colheita", titulo: "Colheita de grãos", mesInicio: 3, mesFim: 4 },
  { etapa: "Colheita e pós-colheita", titulo: "Secagem e armazenamento", mesInicio: 3, mesFim: 4 },
  { etapa: "Colheita e pós-colheita", titulo: "Comercialização ou uso no trato do gado", mesInicio: 4, mesFim: 6 },
  { etapa: "Planejamento e preparo", titulo: "Análise de solo", mesInicio: 7, mesFim: 8 },
  { etapa: "Planejamento e preparo", titulo: "Compra de sementes, adubos e defensivos", mesInicio: 8, mesFim: 9 },
  { etapa: "Planejamento e preparo", titulo: "Calagem e gessagem", mesInicio: 8, mesFim: 9 },
  { etapa: "Planejamento e preparo", titulo: "Preparo do solo / dessecação para plantio direto", mesInicio: 9, mesFim: 10 },
  { etapa: "Plantio", titulo: "Tratamento de sementes", mesInicio: 10, mesFim: 10 },
  { etapa: "Plantio", titulo: "Plantio com adubação de base", mesInicio: 10, mesFim: 11 },
  { etapa: "Tratos culturais", titulo: "Adubação de cobertura (nitrogênio, entre V4 e V6)", mesInicio: 11, mesFim: 12 },
  { etapa: "Tratos culturais", titulo: "Controle de plantas daninhas (pós-emergente)", mesInicio: 11, mesFim: 12 },
  { etapa: "Tratos culturais", titulo: "Monitorar lagarta-do-cartucho e cigarrinha", mesInicio: 11, mesFim: 12 },
  { etapa: "Tratos culturais", titulo: "Monitorar pragas e doenças foliares (continuação)", mesInicio: 1, mesFim: 2 },
];

const PECUARIA: TarefaModelo[] = [
  { etapa: "Sanidade", titulo: "Vacinar bezerras contra brucelose (3 a 8 meses de idade)", mesInicio: 1, mesFim: 12 },
  { etapa: "Sanidade", titulo: "Demais vacinas conforme calendário do órgão estadual e do veterinário", mesInicio: 5, mesFim: 5 },
  { etapa: "Sanidade", titulo: "Vermifugação estratégica — maio", mesInicio: 5, mesFim: 5 },
  { etapa: "Sanidade", titulo: "Vermifugação estratégica — julho", mesInicio: 7, mesFim: 7 },
  { etapa: "Sanidade", titulo: "Vermifugação estratégica — setembro", mesInicio: 9, mesFim: 9 },
  { etapa: "Sanidade", titulo: "Controle de carrapato e mosca-dos-chifres", mesInicio: 10, mesFim: 12 },
  { etapa: "Sanidade", titulo: "Controle de carrapato e mosca-dos-chifres (continuação)", mesInicio: 1, mesFim: 3 },
  { etapa: "Nutrição", titulo: "Sal mineral à vontade (repor cochos)", mesInicio: 1, mesFim: 12 },
  { etapa: "Nutrição", titulo: "Suplementação na seca (sal proteinado / volumoso)", mesInicio: 5, mesFim: 10 },
  { etapa: "Pastagens", titulo: "Vedação de pastos para a seca", mesInicio: 2, mesFim: 3 },
  { etapa: "Pastagens", titulo: "Análise de solo das pastagens", mesInicio: 8, mesFim: 9 },
  { etapa: "Pastagens", titulo: "Calagem, adubação e reforma de pastagens", mesInicio: 10, mesFim: 12 },
  { etapa: "Pastagens", titulo: "Manutenção de cercas, aguadas e cochos", mesInicio: 6, mesFim: 8 },
  { etapa: "Rebanho", titulo: "Pesagem e contagem do rebanho", mesInicio: 3, mesFim: 3 },
  { etapa: "Rebanho", titulo: "Pesagem e contagem do rebanho", mesInicio: 6, mesFim: 6 },
  { etapa: "Rebanho", titulo: "Pesagem e contagem do rebanho", mesInicio: 9, mesFim: 9 },
  { etapa: "Rebanho", titulo: "Pesagem e contagem do rebanho", mesInicio: 12, mesFim: 12 },
  { etapa: "Rebanho", titulo: "Planejar compra e venda de animais", mesInicio: 4, mesFim: 6 },
];

export const MODELOS: Record<ChaveAtividade, TarefaModelo[]> = { CAFE, MARACUJA, MILHO, PECUARIA };

export type Situacao = "concluida" | "atrasada" | "andamento" | "prevista";

/** Situação de uma tarefa em relação a hoje (mês/ano de referência). */
export function situacao(t: { ano: number; mesInicio: number; mesFim: number; concluida: boolean }, hoje: { ano: number; mes: number }): Situacao {
  if (t.concluida) return "concluida";
  const inicio = t.ano * 12 + t.mesInicio;
  const fim = t.ano * 12 + t.mesFim;
  const agora = hoje.ano * 12 + hoje.mes;
  if (agora > fim) return "atrasada";
  if (agora >= inicio) return "andamento";
  return "prevista";
}
