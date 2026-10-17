import { z } from "zod";

// O que a IA devolve ao ler um boleto, nota fiscal, recibo ou comprovante.
// Campos que não aparecem no documento vêm null — nunca inventados.
export const DocumentoLido = z.object({
  tipo: z.enum(["boleto", "nota_fiscal", "recibo", "comprovante_pagamento", "outro"]),
  fornecedor: z.string().nullable().describe("Beneficiário do boleto ou emitente da nota, como aparece no documento"),
  cnpjCpf: z.string().nullable().describe("CNPJ ou CPF do fornecedor, só dígitos e pontuação do documento"),
  valor: z.number().nullable().describe("Valor a pagar em reais (ex.: 1234.56). No boleto, o valor do documento"),
  vencimento: z.string().nullable().describe("Data de vencimento no formato AAAA-MM-DD"),
  dataEmissao: z.string().nullable().describe("Data de emissão no formato AAAA-MM-DD"),
  numeroDocumento: z.string().nullable().describe("Número da nota fiscal ou do documento"),
  linhaDigitavel: z.string().nullable().describe("Linha digitável do boleto, se houver"),
  descricao: z.string().describe("Resumo curto do que foi comprado ou do serviço, em português (até 80 caracteres)"),
  contaSugerida: z.string().nullable().describe("Nome EXATO de uma conta da lista fornecida, ou null se nenhuma servir"),
  justificativaConta: z.string().describe("Uma frase dizendo por que essa conta"),
  confianca: z.enum(["alta", "media", "baixa"]).describe("Confiança geral na leitura (baixa se a imagem estiver ruim ou cortada)"),
  observacoes: z.string().nullable().describe("Alertas: campos ilegíveis, documento cortado, valores divergentes etc."),
});

export type DocumentoLido = z.infer<typeof DocumentoLido>;

export const TIPOS_DOCUMENTO: Record<DocumentoLido["tipo"], string> = {
  boleto: "Boleto",
  nota_fiscal: "Nota fiscal",
  recibo: "Recibo",
  comprovante_pagamento: "Comprovante de pagamento",
  outro: "Documento",
};

export const TIPOS_ACEITOS = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type TipoAceito = (typeof TIPOS_ACEITOS)[number];
export const ehTipoAceito = (t: string): t is TipoAceito => (TIPOS_ACEITOS as readonly string[]).includes(t);
