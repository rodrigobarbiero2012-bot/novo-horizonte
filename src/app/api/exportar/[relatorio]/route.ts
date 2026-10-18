import { anosComMovimento, partidasDoRazao } from "@/lib/consultas";
import { prisma } from "@/lib/db";
import { filtroLancamentos } from "@/lib/lancamentos/filtro";
import { ehLinhaOrcamento, matrizVazia, mesDeCorte, realizadoMensal } from "@/lib/orcamento/calculo";
import { listaParaExcel, relatorioParaExcel } from "@/lib/relatorios/excel";
import { relatorioBalanco, relatorioDre, relatorioFluxo, relatorioOrcamento } from "@/lib/relatorios/tabelas";
import { exigirUsuario } from "@/lib/usuario";

// Exportação para Excel (.xlsx) dos relatórios, com os mesmos filtros da tela.
//   /api/exportar/dre · /balanco · /fluxo?visao=2025 · /orcamento?ano=2026&ate=10 · /lancamentos?<filtros da lista>

const LIMITE_LANCAMENTOS = 50_000;

function arquivo(conteudo: Buffer, nome: string) {
  return new Response(new Uint8Array(conteudo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nome)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(request: Request, { params }: RouteContext<"/api/exportar/[relatorio]">) {
  await exigirUsuario();
  const { relatorio } = await params;
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const hoje = new Date().toLocaleDateString("sv-SE");
  const anoAtual = Number(hoje.slice(0, 4));

  switch (relatorio) {
    case "dre": {
      const [partidas, anos] = await Promise.all([partidasDoRazao(), anosComMovimento()]);
      return arquivo(await relatorioParaExcel(relatorioDre(partidas, anos, anoAtual)), `DRE Novo Horizonte ${hoje}.xlsx`);
    }
    case "balanco": {
      const [partidas, anos] = await Promise.all([partidasDoRazao(), anosComMovimento()]);
      return arquivo(await relatorioParaExcel(relatorioBalanco(partidas, anos)), `Balanço Novo Horizonte ${hoje}.xlsx`);
    }
    case "fluxo": {
      const [partidas, anos] = await Promise.all([partidasDoRazao(), anosComMovimento()]);
      const anoMensal = anos.find((a) => a > anos[0] && String(a) === sp.visao);
      const nome = anoMensal ? `Fluxo de caixa ${anoMensal} Novo Horizonte.xlsx` : `Fluxo de caixa Novo Horizonte ${hoje}.xlsx`;
      return arquivo(await relatorioParaExcel(relatorioFluxo(partidas, anos, anoMensal)), nome);
    }
    case "orcamento": {
      const pedido = Number(sp.ano);
      const ano = Number.isInteger(pedido) && pedido >= 2015 && pedido <= anoAtual + 5 ? pedido : anoAtual;
      const pedidoAte = Number(sp.ate);
      const ate = Number.isInteger(pedidoAte) && pedidoAte >= 1 && pedidoAte <= 12 ? pedidoAte : mesDeCorte(ano, hoje);
      const [partidas, itens] = await Promise.all([partidasDoRazao(), prisma.orcamentoItem.findMany({ where: { ano } })]);
      const orcado = matrizVazia();
      for (const i of itens) if (ehLinhaOrcamento(i.linha)) orcado[i.linha][i.mes - 1] = i.valorCentavos;
      return arquivo(await relatorioParaExcel(relatorioOrcamento(ano, ate, orcado, realizadoMensal(partidas, ano))), `Orçamento x realizado ${ano}.xlsx`);
    }
    case "lancamentos": {
      const { filtro, orderBy, temFiltro } = filtroLancamentos(sp);
      const partidas = await prisma.partida.findMany({
        where: filtro,
        orderBy,
        take: LIMITE_LANCAMENTOS,
        select: {
          data: true,
          valorCentavos: true,
          historico: true,
          conta: { select: { nome: true, categoria: true, atividade: true } },
          lancamento: { select: { historico: true, origem: true } },
        },
      });
      const lista = await listaParaExcel({
        titulo: "Lançamentos",
        subtitulo: `Novo Horizonte · ${partidas.length} linhas${temFiltro ? " (com os filtros da tela)" : ""}${partidas.length === LIMITE_LANCAMENTOS ? " · limite atingido, filtre por período" : ""}`,
        colunas: [
          { titulo: "Data", tipo: "data", largura: 12 },
          { titulo: "Conta", tipo: "texto", largura: 34 },
          { titulo: "Categoria", tipo: "texto", largura: 24 },
          { titulo: "Atividade", tipo: "texto", largura: 11 },
          { titulo: "Histórico", tipo: "texto", largura: 60 },
          { titulo: "Débito", tipo: "moeda" },
          { titulo: "Crédito", tipo: "moeda" },
          { titulo: "Origem", tipo: "texto", largura: 11 },
        ],
        linhas: partidas.map((p) => [
          p.data.toISOString().slice(0, 10),
          p.conta.nome,
          p.conta.categoria,
          p.conta.atividade,
          p.historico ?? p.lancamento.historico ?? "",
          p.valorCentavos > 0 ? p.valorCentavos : null,
          p.valorCentavos < 0 ? -p.valorCentavos : null,
          p.lancamento.origem.toLowerCase(),
        ]),
      });
      return arquivo(lista, `Lançamentos Novo Horizonte ${hoje}.xlsx`);
    }
    default:
      return new Response("Relatório não encontrado.", { status: 404 });
  }
}
