// Depreciação gerencial do imobilizado, em linha reta, mês a mês: cada
// aquisição (partida positiva na conta do bem) começa a depreciar no mês
// seguinte; baixas (partidas negativas) entram como camadas negativas. Não é
// lançada na contabilidade — a DRE e o Balanço oficiais seguem a planilha.

export type Camada = { data: string; valorCentavos: number };

/** Taxas anuais usuais da Receita Federal para cada tipo de bem, pelo nome da conta. */
export function taxaSugerida(nomeConta: string): { taxa: number; confirmar?: string } {
  const n = nomeConta.toLowerCase();
  if (n.includes("veícul") || n.includes("veicul")) return { taxa: 20 };
  if (n.includes("máquina") || n.includes("maquina") || n.includes("equipamento")) return { taxa: 10 };
  if (n.includes("prédio") || n.includes("predio") || n.includes("edifica")) return { taxa: 4 };
  if (n.includes("cafezal") || n.includes("lavoura"))
    return { taxa: 5, confirmar: "Vida útil do cafezal reformado: 5% ao ano supõe 20 anos de produção. Confirmar." };
  if (n.includes("terra"))
    return {
      taxa: 0,
      confirmar: "A terra nua não deprecia, mas benfeitorias (cercas, currais, açudes) sim. A conta mistura as duas: informar a taxa das benfeitorias, se quiser.",
    };
  return { taxa: 10, confirmar: "Taxa padrão de 10% ao ano. Confirmar." };
}

/** Meses de depreciação de uma camada até 31/12 do ano (começa no mês seguinte ao da compra). */
function mesesAte(data: string, ano: number) {
  const a = Number(data.slice(0, 4));
  const m = Number(data.slice(5, 7));
  return Math.max(0, (ano - a) * 12 + (12 - m));
}

/** Custo e depreciação acumulada até 31/12 do ano (acumulada limitada ao custo, nunca negativa). */
function acumuladoAte(camadas: Camada[], taxaAnualPct: number, ano: number) {
  let custo = 0;
  let acumulada = 0;
  for (const c of camadas) {
    if (Number(c.data.slice(0, 4)) > ano) continue;
    custo += c.valorCentavos;
    const total = (Math.abs(c.valorCentavos) * taxaAnualPct * mesesAte(c.data, ano)) / 1200;
    acumulada += Math.sign(c.valorCentavos) * Math.min(Math.abs(c.valorCentavos), total);
  }
  return { custo, acumulada: Math.round(Math.min(Math.max(acumulada, 0), Math.max(custo, 0))) };
}

export type DepreciacaoAno = { custo: number; doAno: number; acumulada: number; liquido: number };

/** Depreciação de uma conta de imobilizado no ano, em centavos (valores positivos). */
export function depreciacaoNoAno(camadas: Camada[], taxaAnualPct: number, ano: number): DepreciacaoAno {
  const atual = acumuladoAte(camadas, taxaAnualPct, ano);
  const anterior = acumuladoAte(camadas, taxaAnualPct, ano - 1);
  return { custo: atual.custo, doAno: atual.acumulada - anterior.acumulada, acumulada: atual.acumulada, liquido: atual.custo - atual.acumulada };
}
