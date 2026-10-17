import type { Situacao } from "@/lib/cronograma/modelos";

// Situação sempre com ícone + texto (cor nunca sozinha). "Em andamento" usa o
// azul validado da paleta dos gráficos; as demais seguem verde/vermelho/cinza.
export const SITUACOES: Record<Situacao, { rotulo: string; icone: string; barra: string; texto: string }> = {
  concluida: { rotulo: "Concluída", icone: "✓", barra: "bg-folha-600", texto: "text-folha-700" },
  andamento: { rotulo: "Em andamento", icone: "●", barra: "bg-[#2a78d6]", texto: "text-[#1c5cab]" },
  atrasada: { rotulo: "Atrasada", icone: "⚠", barra: "bg-red-600", texto: "text-red-700" },
  prevista: { rotulo: "Prevista", icone: "○", barra: "bg-stone-300", texto: "text-stone-500" },
};

export const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export const periodoTexto = (inicio: number, fim: number) =>
  inicio === fim ? MESES_CURTOS[inicio - 1] : `${MESES_CURTOS[inicio - 1]}–${MESES_CURTOS[fim - 1]}`;
