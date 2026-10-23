import { revalidatePath } from "next/cache";
import { anosComMovimento, partidasDoRazao } from "@/lib/consultas";
import { prisma } from "@/lib/db";
import { filtroLancamentos } from "@/lib/lancamentos/filtro";
import { chaveInvestimento, ehLinhaOrcamento, matrizVazia, mesDeCorte, realizadoInvestimentos, realizadoMensal } from "@/lib/orcamento/calculo";
import { montarBackup } from "@/lib/relatorios/backup";
import { listaParaExcel, listasParaExcel, modeloImportacao, relatorioParaExcel } from "@/lib/relatorios/excel";
import { relatorioBalanco, relatorioDre, relatorioFluxo, relatorioOrcamento } from "@/lib/relatorios/tabelas";
import { exigirUsuario } from "@/lib/usuario";
import { hojeSP } from "@/lib/hoje";

// Backup completo e exportações grandes.
export const maxDuration = 60;

// Exportação para Excel (.xlsx) dos relatórios, com os mesmos filtros da tela.
//   /api/exportar/dre · /balanco · /fluxo?visao=2025 · /orcamento?ano=2026&ate=10 · /lancamentos?<filtros da lista>
//   /api/exportar/modelo-importacao (planilha modelo para importar lançamentos) · /backup (tudo, uma aba por tipo)

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
  const usuario = await exigirUsuario();
  const { relatorio } = await params;
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const hoje = hojeSP();
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
      const [partidas, itens, imobilizado] = await Promise.all([
        partidasDoRazao(),
        prisma.orcamentoItem.findMany({ where: { ano } }),
        prisma.conta.findMany({ where: { categoria: "Ativo Imobilizado", ativa: true }, orderBy: { nome: "asc" }, select: { nome: true } }),
      ]);
      const orcado = matrizVazia();
      for (const i of itens) if (ehLinhaOrcamento(i.linha)) orcado[i.linha][i.mes - 1] = i.valorCentavos;
      const realizadoInv = realizadoInvestimentos(partidas, ano, imobilizado.map((c) => c.nome));
      const investimentos = imobilizado.map((c) => {
        const chave = chaveInvestimento(c.nome);
        const o = Array(12).fill(0) as number[];
        for (const i of itens) if (i.linha === chave) o[i.mes - 1] = i.valorCentavos;
        return { rotulo: c.nome.replace(/^Imobilizado - /, ""), orcado: o, realizado: realizadoInv[chave] };
      });
      return arquivo(
        await relatorioParaExcel(relatorioOrcamento(ano, ate, orcado, realizadoMensal(partidas, ano), investimentos)),
        `Orçamento x realizado ${ano}.xlsx`,
      );
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
          atividade: true,
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
          p.atividade ?? p.conta.atividade,
          p.historico ?? p.lancamento.historico ?? "",
          p.valorCentavos > 0 ? p.valorCentavos : null,
          p.valorCentavos < 0 ? -p.valorCentavos : null,
          p.lancamento.origem.toLowerCase(),
        ]),
      });
      return arquivo(lista, `Lançamentos Novo Horizonte ${hoje}.xlsx`);
    }
    case "backup": {
      const listas = await montarBackup();
      const conteudo = await listasParaExcel(listas);
      // Registra o backup (o painel avisa quando o último tiver mais de 30 dias) só quando o pedido
      // vem do próprio site: um link de outro site não pode "apagar" o aviso sem ninguém guardar o arquivo.
      const origem = request.headers.get("sec-fetch-site");
      if (!origem || origem === "same-origin" || origem === "none") await prisma.registroAuditoria.create({
        data: { usuarioId: usuario.id, entidade: "Backup", entidadeId: hoje, acao: "EXPORTAR", depois: { abas: listas.map((l) => `${l.aba}: ${l.linhas.length}`), bytes: conteudo.length } },
      });
      revalidatePath("/"); // tira o aviso de backup do painel
      return arquivo(conteudo, `Backup Novo Horizonte ${hoje}.xlsx`);
    }
    case "modelo-importacao": {
      const contas = await prisma.conta.findMany({ where: { ativa: true }, orderBy: [{ categoria: "asc" }, { nome: "asc" }], select: { nome: true, categoria: true, atividade: true } });
      return arquivo(await modeloImportacao(contas), "Modelo de importação Novo Horizonte.xlsx");
    }
    default:
      return new Response("Relatório não encontrado.", { status: 404 });
  }
}
