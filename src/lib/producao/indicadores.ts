import { SINAL, type TipoMovimento } from "./atividades";

// Indicadores de produção de uma atividade num ano. Custos e receitas vêm da
// contabilidade (centavos); quantidades, dos movimentos físicos.

export type Movimento = { data: string; tipo: TipoMovimento; quantidade: number; valorCentavos?: number | null };

export type Indicadores = {
  areaHa: number;
  producaoAno: number;
  vendidoAno: number;
  produtividade: number | null; // por ha
  estoqueAtual: number; // saldo físico até `ate`
  custoPorUnidade: number | null; // centavos por unidade produzida no ano
  precoMedioRealizado: number | null; // centavos por unidade vendida no ano
  valorEstoque: number | null; // centavos, pela cotação
  margemPorUnidade: number | null; // cotação − custo por unidade, em centavos
};

export function quantidadeComSinal(m: Movimento) {
  return SINAL[m.tipo] * m.quantidade;
}

export function calcularIndicadores(p: {
  ano: number;
  ate: string; // data de referência do estoque (ISO)
  producao: TipoMovimento; // COLHEITA nas lavouras, NASCIMENTO no gado
  areaHa: number;
  movimentos: Movimento[];
  custeioDiretoCentavos: number;
  receitaCentavos: number;
  cotacaoCentavos: number | null; // por unidade
}): Indicadores {
  const doAno = p.movimentos.filter((m) => m.data.startsWith(String(p.ano)));
  const producaoAno = doAno.filter((m) => m.tipo === p.producao).reduce((s, m) => s + m.quantidade, 0);
  const vendidoAno = doAno.filter((m) => m.tipo === "VENDA").reduce((s, m) => s + m.quantidade, 0);
  const estoqueAtual = p.movimentos.filter((m) => m.data <= p.ate).reduce((s, m) => s + quantidadeComSinal(m), 0);
  const custoPorUnidade = producaoAno > 0 ? Math.round(p.custeioDiretoCentavos / producaoAno) : null;
  // Preço médio: pelas vendas que têm valor informado; sem nenhuma, pela receita contábil do ano.
  const vendasComValor = doAno.filter((m) => m.tipo === "VENDA" && m.valorCentavos);
  const qtdComValor = vendasComValor.reduce((s, m) => s + m.quantidade, 0);
  const precoMedioRealizado =
    qtdComValor > 0
      ? Math.round(vendasComValor.reduce((s, m) => s + m.valorCentavos!, 0) / qtdComValor)
      : vendidoAno > 0
        ? Math.round(p.receitaCentavos / vendidoAno)
        : null;
  return {
    areaHa: p.areaHa,
    producaoAno,
    vendidoAno,
    produtividade: p.areaHa > 0 && producaoAno > 0 ? producaoAno / p.areaHa : null,
    estoqueAtual,
    custoPorUnidade,
    precoMedioRealizado,
    valorEstoque: p.cotacaoCentavos !== null ? Math.round(estoqueAtual * p.cotacaoCentavos) : null,
    margemPorUnidade: p.cotacaoCentavos !== null && custoPorUnidade !== null ? p.cotacaoCentavos - custoPorUnidade : null,
  };
}
