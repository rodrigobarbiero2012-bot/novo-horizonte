// Ações do servidor recebem os argumentos como JSON vindo do navegador: um
// "id" pode chegar como objeto (ex.: {"not": ""}) e virar um filtro do Prisma
// que pega vários registros. Toda ação que recebe id confere o tipo antes.

/** Id de registro (cuid/uuid): texto curto, só letras, números, "-" e "_". */
export const ehId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v);

/**
 * Data "aaaa-mm-dd" que existe no calendário. Date.parse aceita "2026-02-31"
 * (vira 03/03), por isso a conferência de ida e volta.
 */
export function ehDataIso(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/**
 * Número digitado em formato brasileiro: "1.234,5", "1234,5", "1234.5" ou
 * "1.500" (ponto seguido de grupos de 3 dígitos é separador de milhar).
 * null se vazio ou inválido.
 */
export function lerNumeroBr(texto: unknown): number | null {
  const t = String(texto ?? "").trim().replace(/\s/g, "");
  if (!t) return null;
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : /^-?\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, "") : t;
  if (!/^-?\d+(\.\d+)?$/.test(normal)) return null;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

