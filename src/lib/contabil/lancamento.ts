// Validação de um lançamento digitado na tela, antes de ir para o banco.

export type PartidaDigitada = {
  contaId: string;
  valorCentavos: number;
  /** Só quando a perna tem data própria (lotes da planilha); senão vale a data do lançamento. */
  data?: string | null;
  historico?: string | null;
  fiscal?: boolean | null;
  linhaPlanilha?: number | null;
};
export type LancamentoDigitado = { data: string; historico: string; partidas: PartidaDigitada[] };

/** "1.234,56" / "1234.56" / "1234" → centavos; null se vazio; NaN se inválido. */
export function lerValorBr(texto: string): number | null {
  const t = texto.trim().replace(/\s|R\$/g, "");
  if (!t) return null;
  // Com vírgula, ponto é separador de milhar. Sem vírgula, pontos seguidos de
  // grupos de 3 dígitos também são milhar ("10.000", "1.234.567"); caso
  // contrário o ponto é decimal ("1234.56").
  const normal = t.includes(",")
    ? t.replace(/\./g, "").replace(",", ".")
    : /^-?\d{1,3}(\.\d{3})+$/.test(t)
      ? t.replace(/\./g, "")
      : t;
  if (!/^-?\d+(\.\d{1,2})?$/.test(normal)) return NaN;
  return Math.round(Number(normal) * 100);
}

/** Lista de erros; vazia quando o lançamento pode ser gravado. */
export function validarLancamento(l: LancamentoDigitado, contasValidas: Set<string>): string[] {
  const erros: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(l.data) || Number.isNaN(Date.parse(l.data))) erros.push("Data inválida.");
  if (!l.historico.trim()) erros.push("Informe o histórico.");
  if (l.partidas.length < 2) erros.push("Um lançamento precisa de pelo menos duas contas (débito e crédito).");
  l.partidas.forEach((p, i) => {
    if (!contasValidas.has(p.contaId)) erros.push(`Linha ${i + 1}: escolha uma conta.`);
    if (!Number.isInteger(p.valorCentavos) || p.valorCentavos === 0) erros.push(`Linha ${i + 1}: valor inválido.`);
    if (p.data && (!/^\d{4}-\d{2}-\d{2}$/.test(p.data) || Number.isNaN(Date.parse(p.data)))) {
      erros.push(`Linha ${i + 1}: data inválida.`);
    }
  });
  const soma = l.partidas.reduce((s, p) => s + p.valorCentavos, 0);
  if (soma !== 0) erros.push(`Débitos e créditos não batem (diferença de R$ ${(Math.abs(soma) / 100).toFixed(2).replace(".", ",")}).`);
  return erros;
}
