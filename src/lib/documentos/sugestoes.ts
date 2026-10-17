// Sugestões de conta a partir do histórico: se o fornecedor já apareceu em
// lançamentos anteriores, a conta mais usada com ele vence a sugestão da IA.

const PALAVRAS_GENERICAS = new Set([
  "ltda", "eireli", "me", "epp", "sa", "s/a", "comercio", "comércio", "industria", "indústria", "servicos", "serviços",
  "produtos", "agropecuarios", "agropecuários", "agricolas", "agrícolas", "distribuidora", "cia", "companhia", "de", "da",
  "do", "das", "dos", "e", "brasil", "banco", "cooperativa", "agro",
]);

/** Palavras do nome do fornecedor que servem de busca no histórico ("MG AGRO COMERCIO LTDA" → ["mg"] não; ≥ 4 letras). */
export function termosDoFornecedor(fornecedor: string): string[] {
  return fornecedor
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 4 && !PALAVRAS_GENERICAS.has(p))
    .slice(0, 3);
}

/** Conta mais frequente entre os usos anteriores; null se não houver histórico. */
export function contaMaisUsada(usos: { contaId: string }[]): { contaId: string; vezes: number } | null {
  const contagem = new Map<string, number>();
  for (const u of usos) contagem.set(u.contaId, (contagem.get(u.contaId) ?? 0) + 1);
  let melhor: { contaId: string; vezes: number } | null = null;
  for (const [contaId, vezes] of contagem) if (!melhor || vezes > melhor.vezes) melhor = { contaId, vezes };
  return melhor;
}
