const moeda = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moedaCurta = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

// `|| 0` troca −0 por 0: negar uma soma vazia dá −0, que o Intl formata como "-0".

/** 123456 → "1.234,56"; negativos com sinal de menos. */
export const reais = (centavos: number) => moeda.format(centavos / 100 || 0);

/** 123456 → "1.235" (relatórios largos, sem centavos). */
export const reaisCurto = (centavos: number) => moedaCurta.format(Math.round(centavos / 100) || 0);

export const percentual = (parte: number, todo: number) => (todo === 0 ? "–" : pct.format(parte / todo));

/** "2026-02-06" ou Date → "06/02/2026", sem conversão de fuso. */
export function dataBr(d: string | Date) {
  const iso = typeof d === "string" ? d : d.toISOString().slice(0, 10);
  const [a, m, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${m}/${a}`;
}

export const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
