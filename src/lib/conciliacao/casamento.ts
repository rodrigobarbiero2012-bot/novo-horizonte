// Casamento automático entre transações do extrato e partidas da conta no
// razão. Regra: mesmo valor (com o mesmo sinal — saída do banco é crédito na
// conta) e data a até `tolerancia` dias; entre candidatas, a de data mais
// próxima. Cada partida casa com uma transação só.

export type TransacaoParaCasar = { id: string; data: string; valorCentavos: number };
export type PartidaParaCasar = { id: string; data: string; valorCentavos: number };

const dias = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;

export function casarAutomaticamente(
  transacoes: TransacaoParaCasar[],
  partidas: PartidaParaCasar[],
  tolerancia = 3,
): { transacaoId: string; partidaId: string }[] {
  // Todos os pares possíveis, do mais próximo ao mais distante; empate desfeito pela ordem de entrada.
  const pares = transacoes
    .flatMap((t) =>
      partidas
        .filter((p) => p.valorCentavos === t.valorCentavos && dias(p.data, t.data) <= tolerancia)
        .map((p) => ({ transacaoId: t.id, partidaId: p.id, distancia: dias(p.data, t.data) })),
    )
    .sort((a, b) => a.distancia - b.distancia);

  const usadasT = new Set<string>();
  const usadasP = new Set<string>();
  const resultado: { transacaoId: string; partidaId: string }[] = [];
  for (const par of pares) {
    if (usadasT.has(par.transacaoId) || usadasP.has(par.partidaId)) continue;
    usadasT.add(par.transacaoId);
    usadasP.add(par.partidaId);
    resultado.push({ transacaoId: par.transacaoId, partidaId: par.partidaId });
  }
  return resultado;
}

/** Candidatas para conciliar à mão: mesmo valor, até 15 dias de distância, mais próximas primeiro. */
export function candidatas<P extends PartidaParaCasar>(t: TransacaoParaCasar, partidas: P[], tolerancia = 15): P[] {
  return partidas
    .filter((p) => p.valorCentavos === t.valorCentavos && dias(p.data, t.data) <= tolerancia)
    .sort((a, b) => dias(a.data, t.data) - dias(b.data, t.data));
}
