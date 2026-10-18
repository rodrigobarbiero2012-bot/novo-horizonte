// "Hoje" no horário de Brasília. O servidor da Vercel roda em UTC: depois das
// 21h, new Date().toLocaleDateString() já seria o dia seguinte (título do dia
// aparecendo como vencido, virada de mês/ano antecipada nos relatórios).

const formato = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" });

/** Data de hoje em São Paulo, "aaaa-mm-dd". */
export const hojeSP = (agora = new Date()) => formato.format(agora);

/** Ano corrente em São Paulo. */
export const anoSP = () => Number(hojeSP().slice(0, 4));

/** Soma (ou subtrai) dias de uma data "aaaa-mm-dd". */
export const somarDias = (iso: string, dias: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
