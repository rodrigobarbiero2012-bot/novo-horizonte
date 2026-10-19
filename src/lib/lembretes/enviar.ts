import "server-only";
import nodemailer from "nodemailer";
import { carregarPartidas } from "../contabil/repositorio";
import { resumoPeriodo } from "../contabil/painel";
import { PRODUTOS, type ChaveProduto } from "../cotacoes/produtos";
import { prisma } from "../db";
import { hojeSP, somarDias } from "../hoje";
import { enderecoSite } from "../whatsapp/processar";
import { deveEnviar, montarEmail, type DadosLembrete } from "./email";

// Envio dos lembretes por SMTP (pensado para Gmail com "senha de app").
// Variáveis na Vercel:
//   SMTP_USUARIO  e-mail que envia (ex.: a conta Gmail)
//   SMTP_SENHA    senha de app de 16 letras gerada no Google (não é a senha normal)
//   SMTP_SERVIDOR opcional, padrão smtp.gmail.com (porta 465)
// Destinatários: tabela Configuracao, chave abaixo; sem configuração, os usuários com senha.

export const CHAVE_DESTINATARIOS = "lembretes.destinatarios"; // string[]
export const VARIAVEIS_EMAIL = ["SMTP_USUARIO", "SMTP_SENHA"] as const;
export const emailFaltando = () => VARIAVEIS_EMAIL.filter((v) => !process.env[v]);

export async function destinatarios(): Promise<string[]> {
  const c = await prisma.configuracao.findUnique({ where: { chave: CHAVE_DESTINATARIOS } });
  if (Array.isArray(c?.valor) && c.valor.length) return c.valor as string[];
  return (await prisma.usuario.findMany({ where: { senhaHash: { not: null } }, select: { email: true } })).map((u) => u.email);
}

const COTACOES_NO_RESUMO: ChaveProduto[] = ["CAFE_ARABICA", "VACA_GORDA", "MARACUJA", "DOLAR"];

/** Junta o que vai no e-mail. `semanal` = resumo de segunda (ou envio de teste). */
export async function coletarDados(semanal: boolean): Promise<DadosLembrete> {
  const hoje = hojeSP();
  const ate = new Date(somarDias(hoje, 7));
  const [titulos, whatsappPendentes, cotacoes, ultimoBackup] = await Promise.all([
    prisma.titulo.findMany({ where: { status: "ABERTO", vencimento: { lte: ate } }, select: { tipo: true, descricao: true, contraparte: true, valorCentavos: true, vencimento: true } }),
    prisma.documentoRecebido.count({ where: { status: "PENDENTE" } }),
    semanal ? Promise.all(COTACOES_NO_RESUMO.map((produto) => prisma.cotacao.findFirst({ where: { produto }, orderBy: { data: "desc" } }))) : [],
    semanal ? prisma.registroAuditoria.findFirst({ where: { entidade: "Backup" }, orderBy: { em: "desc" }, select: { em: true } }) : null,
  ]);
  const paraLembrete = (t: (typeof titulos)[number]) => ({ descricao: t.descricao, contraparte: t.contraparte, valorCentavos: t.valorCentavos, vencimento: t.vencimento.toISOString().slice(0, 10) });
  const dados: DadosLembrete = {
    hoje,
    semanal,
    site: enderecoSite(),
    pagar: titulos.filter((t) => t.tipo === "PAGAR").map(paraLembrete),
    receber: titulos.filter((t) => t.tipo === "RECEBER").map(paraLembrete),
    whatsappPendentes,
  };
  if (semanal) {
    const r = resumoPeriodo(await carregarPartidas(prisma), { inicio: `${hoje.slice(0, 7)}-01`, fim: hoje });
    dados.mes = { receita: r.receita, gastos: r.custeio + r.despesas, resultado: r.resultado };
    dados.cotacoes = cotacoes.flatMap((c) => {
      if (!c) return [];
      const p = PRODUTOS[c.produto as ChaveProduto];
      return p ? [{ nome: p.nome, valor: `${c.valor.toLocaleString("pt-BR", { minimumFractionDigits: p.casas, maximumFractionDigits: p.casas })} ${p.unidade}`, data: c.data.toISOString().slice(0, 10) }] : [];
    });
    dados.diasDesdeBackup = ultimoBackup ? Math.round((Date.parse(hoje) - Date.parse(hojeSP(ultimoBackup.em))) / 86_400_000) : null;
  }
  return dados;
}

/**
 * Monta e envia. Devolve o que aconteceu (para o log do cron e a tela).
 * `para` restringe os destinatários (envio de teste só para quem pediu).
 */
export async function enviarLembrete(opcoes: { semanal: boolean; forcar?: boolean; para?: string[] }): Promise<{ enviado: boolean; motivo: string }> {
  const faltando = emailFaltando();
  if (faltando.length) return { enviado: false, motivo: `faltam variáveis: ${faltando.join(", ")}` };
  const dados = await coletarDados(opcoes.semanal);
  if (!opcoes.forcar && !deveEnviar(dados)) return { enviado: false, motivo: "nada a avisar hoje" };
  const para = opcoes.para ?? (await destinatarios());
  if (!para.length) return { enviado: false, motivo: "nenhum destinatário" };
  const { assunto, html, texto } = montarEmail(dados);
  const transporte = nodemailer.createTransport({
    host: process.env.SMTP_SERVIDOR || "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: process.env.SMTP_USUARIO, pass: process.env.SMTP_SENHA },
    connectionTimeout: 15_000,
  });
  await transporte.sendMail({ from: `"Novo Horizonte" <${process.env.SMTP_USUARIO}>`, to: para, subject: assunto, html, text: texto });
  return { enviado: true, motivo: `enviado para ${para.length} destinatário(s)` };
}
