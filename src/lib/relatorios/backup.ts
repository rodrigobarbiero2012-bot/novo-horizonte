import "server-only";
import { prisma } from "../db";
import type { Lista } from "./excel";

// Backup completo em planilha: tudo o que foi lançado ou cadastrado, uma aba
// por tipo de dado, com os ids para permitir reconstruir a base se preciso.
// Os arquivos anexados (PDF/fotos) não entram — ficam no banco.

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const simNao = (b: boolean | null | undefined) => (b === null || b === undefined ? null : b ? "sim" : "não");

export async function montarBackup(): Promise<Lista[]> {
  const [contas, lancamentos, titulos, talhoes, movimentos, orcamento, tarefas, cotacoes, configuracoes, extratos, recebidos] = await Promise.all([
    prisma.conta.findMany({ orderBy: [{ categoria: "asc" }, { nome: "asc" }], include: { apelidos: { select: { nome: true } } } }),
    prisma.lancamento.findMany({
      orderBy: [{ data: "asc" }, { criadoEm: "asc" }],
      select: {
        id: true,
        data: true,
        historico: true,
        origem: true,
        criadoEm: true,
        criadoPor: { select: { nome: true } },
        partidas: {
          orderBy: [{ linhaPlanilha: "asc" }, { valorCentavos: "desc" }],
          select: {
            id: true,
            data: true,
            valorCentavos: true,
            valorNominalCentavos: true,
            historico: true,
            fiscal: true,
            linhaPlanilha: true,
            atividade: true,
            conta: { select: { nome: true } },
          },
        },
      },
    }),
    prisma.titulo.findMany({ orderBy: { vencimento: "asc" }, include: { conta: { select: { nome: true } }, contaBaixa: { select: { nome: true } } } }),
    prisma.talhao.findMany({ orderBy: [{ atividade: "asc" }, { nome: "asc" }] }),
    prisma.movimentoProducao.findMany({ orderBy: { data: "asc" }, include: { talhao: { select: { nome: true } } } }),
    prisma.orcamentoItem.findMany({ orderBy: [{ ano: "asc" }, { linha: "asc" }, { mes: "asc" }] }),
    prisma.tarefaCronograma.findMany({ orderBy: [{ atividade: "asc" }, { ano: "asc" }, { ordem: "asc" }] }),
    prisma.cotacao.findMany({ orderBy: [{ produto: "asc" }, { data: "asc" }] }),
    prisma.configuracao.findMany({ orderBy: { chave: "asc" } }),
    prisma.transacaoBancaria.findMany({
      orderBy: [{ contaId: "asc" }, { data: "asc" }],
      include: { importacao: { select: { arquivo: true, conta: { select: { nome: true } } } } },
    }),
    prisma.documentoRecebido.findMany({ orderBy: { criadoEm: "asc" }, include: { anexo: { select: { nome: true } } } }),
  ]);
  const partidas = lancamentos.reduce((s, l) => s + l.partidas.length, 0);

  return [
    {
      aba: "Lançamentos",
      titulo: "Lançamentos (uma linha por perna)",
      subtitulo: `${lancamentos.length} lançamentos, ${partidas} linhas. Cada lançamento soma zero: débitos positivos, créditos negativos.`,
      colunas: [
        { titulo: "Lançamento", tipo: "texto", largura: 28 },
        { titulo: "Data do lançamento", tipo: "data", largura: 12 },
        { titulo: "Data da linha", tipo: "data", largura: 12 },
        { titulo: "Conta", tipo: "texto", largura: 34 },
        { titulo: "Histórico", tipo: "texto", largura: 60 },
        { titulo: "Débito", tipo: "moeda" },
        { titulo: "Crédito", tipo: "moeda" },
        { titulo: "Fiscal", tipo: "texto", largura: 8 },
        { titulo: "Linha da planilha original", tipo: "numero", largura: 12 },
        { titulo: "Origem", tipo: "texto", largura: 12 },
        { titulo: "Criado por", tipo: "texto", largura: 16 },
        { titulo: "Criado em", tipo: "data", largura: 12 },
        { titulo: "Id da linha", tipo: "texto", largura: 28 },
        { titulo: "Valor nominal (planilha)", tipo: "moeda" },
        { titulo: "Cultivo marcado na linha", tipo: "texto", largura: 12 },
      ],
      linhas: lancamentos.flatMap((l) =>
        l.partidas.map((p) => [
          l.id,
          iso(l.data),
          iso(p.data),
          p.conta.nome,
          p.historico ?? l.historico ?? "",
          p.valorCentavos > 0 ? p.valorCentavos : null,
          p.valorCentavos < 0 ? -p.valorCentavos : null,
          simNao(p.fiscal),
          p.linhaPlanilha,
          l.origem.toLowerCase(),
          l.criadoPor?.nome ?? null,
          iso(l.criadoEm),
          p.id,
          p.valorNominalCentavos,
          p.atividade,
        ]),
      ),
    },
    {
      aba: "Plano de contas",
      titulo: "Plano de contas",
      colunas: [
        { titulo: "Conta", tipo: "texto", largura: 40 },
        { titulo: "Categoria", tipo: "texto", largura: 26 },
        { titulo: "Atividade", tipo: "texto", largura: 12 },
        { titulo: "Natureza", tipo: "texto", largura: 9 },
        { titulo: "Ativa", tipo: "texto", largura: 7 },
        { titulo: "Apelidos (nomes antigos da planilha)", tipo: "texto", largura: 50 },
      ],
      linhas: contas.map((c) => [c.nome, c.categoria, c.atividade, c.natureza, simNao(c.ativa), c.apelidos.map((a) => a.nome).join("; ") || null]),
    },
    {
      aba: "A pagar e receber",
      titulo: "Contas a pagar e a receber",
      colunas: [
        { titulo: "Tipo", tipo: "texto", largura: 9 },
        { titulo: "Descrição", tipo: "texto", largura: 40 },
        { titulo: "Fornecedor/cliente", tipo: "texto", largura: 26 },
        { titulo: "Valor", tipo: "moeda" },
        { titulo: "Vencimento", tipo: "data", largura: 12 },
        { titulo: "Parcela", tipo: "texto", largura: 8 },
        { titulo: "Conta", tipo: "texto", largura: 30 },
        { titulo: "Situação", tipo: "texto", largura: 10 },
        { titulo: "Pago/recebido em", tipo: "data", largura: 12 },
        { titulo: "Valor pago/recebido", tipo: "moeda" },
        { titulo: "Pago com", tipo: "texto", largura: 24 },
        { titulo: "Nº documento", tipo: "texto", largura: 14 },
        { titulo: "Linha digitável", tipo: "texto", largura: 50 },
      ],
      linhas: titulos.map((t) => [
        t.tipo === "PAGAR" ? "pagar" : "receber",
        t.descricao,
        t.contraparte,
        t.valorCentavos,
        iso(t.vencimento),
        t.parcela ? `${t.parcela}/${t.totalParcelas}` : null,
        t.conta.nome,
        t.status.toLowerCase(),
        iso(t.baixadoEm),
        t.valorBaixaCentavos,
        t.contaBaixa?.nome ?? null,
        t.numeroDocumento,
        t.linhaDigitavel,
      ]),
    },
    {
      aba: "Talhões",
      titulo: "Talhões e pastos",
      colunas: [
        { titulo: "Atividade", tipo: "texto", largura: 11 },
        { titulo: "Nome", tipo: "texto", largura: 24 },
        { titulo: "Área (ha)", tipo: "numero" },
        { titulo: "Variedade", tipo: "texto", largura: 18 },
        { titulo: "Ano de plantio", tipo: "numero" },
        { titulo: "Plantas", tipo: "numero" },
        { titulo: "Ativo", tipo: "texto", largura: 7 },
        { titulo: "Observação", tipo: "texto", largura: 40 },
      ],
      linhas: talhoes.map((t) => [t.atividade, t.nome, t.areaHa, t.variedade, t.anoPlantio, t.plantas, simNao(t.ativo), t.observacao]),
    },
    {
      aba: "Produção",
      titulo: "Movimentos de produção",
      colunas: [
        { titulo: "Atividade", tipo: "texto", largura: 11 },
        { titulo: "Data", tipo: "data", largura: 12 },
        { titulo: "Tipo", tipo: "texto", largura: 14 },
        { titulo: "Quantidade", tipo: "numero" },
        { titulo: "Talhão", tipo: "texto", largura: 20 },
        { titulo: "Valor", tipo: "moeda" },
        { titulo: "Observação", tipo: "texto", largura: 40 },
      ],
      linhas: movimentos.map((m) => [m.atividade, iso(m.data), m.tipo, m.quantidade, m.talhao?.nome ?? null, m.valorCentavos, m.observacao]),
    },
    {
      aba: "Orçamento",
      titulo: "Orçamento (sinal da DRE: receita positiva, gastos negativos)",
      colunas: [
        { titulo: "Ano", tipo: "numero", largura: 8 },
        { titulo: "Linha da DRE", tipo: "texto", largura: 26 },
        { titulo: "Mês", tipo: "numero", largura: 6 },
        { titulo: "Valor", tipo: "moeda" },
      ],
      linhas: orcamento.map((o) => [o.ano, o.linha, o.mes, o.valorCentavos]),
    },
    {
      aba: "Cronograma",
      titulo: "Cronograma de produção",
      colunas: [
        { titulo: "Atividade", tipo: "texto", largura: 11 },
        { titulo: "Ano", tipo: "numero", largura: 8 },
        { titulo: "Etapa", tipo: "texto", largura: 20 },
        { titulo: "Tarefa", tipo: "texto", largura: 50 },
        { titulo: "Mês início", tipo: "numero", largura: 8 },
        { titulo: "Mês fim", tipo: "numero", largura: 8 },
        { titulo: "Concluída", tipo: "texto", largura: 10 },
        { titulo: "Concluída em", tipo: "data", largura: 12 },
      ],
      linhas: tarefas.map((t) => [t.atividade, t.ano, t.etapa, t.titulo, t.mesInicio, t.mesFim, simNao(t.concluida), iso(t.concluidaEm)]),
    },
    {
      aba: "Cotações",
      titulo: "Cotações registradas",
      colunas: [
        { titulo: "Produto", tipo: "texto", largura: 14 },
        { titulo: "Data", tipo: "data", largura: 12 },
        { titulo: "Valor", tipo: "numero" },
        { titulo: "Origem", tipo: "texto", largura: 12 },
      ],
      linhas: cotacoes.map((c) => [c.produto, iso(c.data), c.valor, c.origem.toLowerCase()]),
    },
    {
      aba: "Extratos bancários",
      titulo: "Transações dos extratos importados (conciliação)",
      colunas: [
        { titulo: "Conta", tipo: "texto", largura: 28 },
        { titulo: "Data", tipo: "data", largura: 12 },
        { titulo: "Descrição", tipo: "texto", largura: 50 },
        { titulo: "Valor", tipo: "moeda" },
        { titulo: "Situação", tipo: "texto", largura: 11 },
        { titulo: "Id da linha conciliada", tipo: "texto", largura: 28 },
        { titulo: "FITID", tipo: "texto", largura: 24 },
        { titulo: "Arquivo", tipo: "texto", largura: 30 },
      ],
      linhas: extratos.map((t) => [t.importacao.conta.nome, iso(t.data), t.descricao, t.valorCentavos, t.status.toLowerCase(), t.partidaId, t.fitid, t.importacao.arquivo]),
    },
    {
      aba: "WhatsApp",
      titulo: "Documentos recebidos pelo WhatsApp",
      colunas: [
        { titulo: "Recebido em", tipo: "data", largura: 12 },
        { titulo: "Remetente", tipo: "texto", largura: 16 },
        { titulo: "Arquivo", tipo: "texto", largura: 30 },
        { titulo: "Legenda", tipo: "texto", largura: 30 },
        { titulo: "Situação", tipo: "texto", largura: 11 },
        { titulo: "Erro de leitura", tipo: "texto", largura: 40 },
      ],
      linhas: recebidos.map((d) => [iso(d.criadoEm), d.remetente, d.anexo?.nome ?? null, d.legenda, d.status.toLowerCase(), d.erro]),
    },
    {
      aba: "Parâmetros",
      titulo: "Parâmetros (taxas de depreciação, rateio, WhatsApp)",
      colunas: [
        { titulo: "Chave", tipo: "texto", largura: 24 },
        { titulo: "Valor (JSON)", tipo: "texto", largura: 100 },
      ],
      linhas: configuracoes.map((c) => [c.chave, JSON.stringify(c.valor)]),
    },
  ];
}
