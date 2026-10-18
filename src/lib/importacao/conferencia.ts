import { balancoAnual, dreAnual, LINHAS_DRE, type BalancoAno, type DreAno } from "../contabil/relatorios";
import type { PartidaContabil } from "../contabil/tipos";

/** Formato de data/import/referencia.json: rótulo da linha → ano → valor em reais. */
export type Referencia = {
  dre: Record<string, Record<string, number | null>>;
  balanco: Record<string, Record<string, number | null>>;
};

export type Divergencia = {
  relatorio: "DRE" | "Balanço";
  linha: string;
  ano: number;
  sistemaCentavos: number;
  planilhaCentavos: number;
};

const ROTULOS_DRE_TOTAIS: Record<string, keyof DreAno> = {
  "Total Receita Operacional": "totalReceita",
  "Total Custeio": "totalCusteio",
  "Margem de Contribuição": "margemContribuicao",
  "Total Despesas Operacionais": "totalDespesas",
  "RESULTADO DO PERÍODO": "resultado",
  "Resultado Acumulado (desde 2014)": "resultadoAcumulado",
};

const ROTULOS_BALANCO: Record<string, keyof BalancoAno> = {
  "Caixa e Bancos": "caixaBancos",
  "Aplicações Financeiras": "aplicacoes",
  Estoques: "estoques",
  Imobilizado: "imobilizado",
  "Total Ativo": "totalAtivo",
  "Empréstimos e Financiamentos": "emprestimos",
  "Fornecedores / Contas a Pagar Parcerias": "fornecedores",
  "Total Passivo": "totalPassivo",
  "Capital do Sócio (CC ACM + Implantação de Saldos)": "capitalSocio",
  "Resultado Acumulado (vínculo com a DRE Anual)": "resultadoAcumulado",
  "Total Patrimônio Líquido": "totalPL",
  "Total Passivo + Patrimônio Líquido": "totalPassivoPL",
  "Diferença não reconciliada (Ativo − Passivo − PL)": "diferenca",
};

/**
 * Compara DRE e Balanço calculados a partir das partidas com os valores que o
 * Excel calculou. A planilha guarda alguns valores com fração de centavo; o
 * sistema arredonda cada linha para centavos, então a tolerância é de 1 centavo
 * por linha do relatório.
 */
const LINHAS_SO_NO_SISTEMA = new Set(["Receita Milho"]);

export function conferir(partidas: PartidaContabil[], ref: Referencia, toleranciaCentavos = 1): {
  anos: number[];
  comparacoes: number;
  divergencias: Divergencia[];
} {
  const anos = Object.keys(ref.dre["Receita Café"] ?? {}).map(Number).sort((a, b) => a - b);
  const dre = dreAnual(partidas, anos);
  const balanco = balancoAnual(partidas, anos);
  const divergencias: Divergencia[] = [];
  let comparacoes = 0;

  const rotulosDre: Record<string, keyof DreAno> = { ...ROTULOS_DRE_TOTAIS };
  for (const [chave, { rotulo }] of Object.entries(LINHAS_DRE)) rotulosDre[rotulo] = chave as keyof DreAno;

  const comparar = <T>(
    relatorio: Divergencia["relatorio"],
    tabela: Record<string, Record<string, number | null>>,
    rotulos: Record<string, keyof T>,
    calculado: Map<number, T>,
  ) => {
    for (const [rotulo, chave] of Object.entries(rotulos)) {
      // Linhas criadas depois da planilha (ex.: Receita Milho) não existem nela: valem zero em todo o histórico.
      const valores = tabela[rotulo] ?? (LINHAS_SO_NO_SISTEMA.has(rotulo) ? Object.fromEntries(anos.map((a) => [String(a), 0])) : undefined);
      if (!valores) throw new Error(`${relatorio}: linha "${rotulo}" não encontrada na referência`);
      for (const a of anos) {
        const planilha = valores[String(a)];
        if (planilha == null) continue;
        const sistemaCentavos = calculado.get(a)![chave] as number;
        const planilhaCentavos = Math.round(planilha * 100);
        comparacoes++;
        if (Math.abs(sistemaCentavos - planilhaCentavos) > toleranciaCentavos) {
          divergencias.push({ relatorio, linha: rotulo, ano: a, sistemaCentavos, planilhaCentavos });
        }
      }
    }
  };

  comparar("DRE", ref.dre, rotulosDre, dre);
  comparar("Balanço", ref.balanco, ROTULOS_BALANCO, balanco);
  return { anos, comparacoes, divergencias };
}
