import { dataBr, reais } from "../formato";

// Conteúdo dos lembretes por e-mail. Todo dia: só se houver algo a fazer
// (contas vencidas ou vencendo em até 3 dias, recebimentos atrasados,
// documentos do WhatsApp a conferir). Na segunda: resumo da semana, sempre.

export type TituloLembrete = { descricao: string; contraparte: string | null; valorCentavos: number; vencimento: string };

export type DadosLembrete = {
  hoje: string; // aaaa-mm-dd (São Paulo)
  semanal: boolean;
  site: string;
  pagar: TituloLembrete[]; // em aberto, vencidos e dos próximos 7 dias
  receber: TituloLembrete[];
  whatsappPendentes: number;
  mes?: { receita: number; gastos: number; resultado: number }; // centavos, do 1º dia do mês até hoje
  cotacoes?: { nome: string; valor: string; data: string }[];
  diasDesdeBackup?: number | null;
};

const dias = (de: string, ate: string) => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
const DIAS_ALERTA = 3;

/** Separa em vencidos, que vencem em até 3 dias e o resto da semana. */
function faixas(titulos: TituloLembrete[], hoje: string) {
  const ordenados = [...titulos].sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  return {
    vencidos: ordenados.filter((t) => t.vencimento < hoje),
    proximos: ordenados.filter((t) => t.vencimento >= hoje && dias(hoje, t.vencimento) <= DIAS_ALERTA),
    semana: ordenados.filter((t) => dias(hoje, t.vencimento) > DIAS_ALERTA && dias(hoje, t.vencimento) <= 7),
  };
}

/** Todo dia só manda se houver algo a fazer; na segunda, sempre. */
export function deveEnviar(d: DadosLembrete): boolean {
  if (d.semanal) return true;
  const p = faixas(d.pagar, d.hoje);
  const r = faixas(d.receber, d.hoje);
  return p.vencidos.length + p.proximos.length + r.vencidos.length + d.whatsappPendentes > 0;
}

const soma = (ts: TituloLembrete[]) => ts.reduce((s, t) => s + t.valorCentavos, 0);
const escapar = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function quando(hoje: string, venc: string) {
  const n = dias(hoje, venc);
  if (n < 0) return `venceu ${dataBr(venc)} (há ${-n} dia${n === -1 ? "" : "s"})`;
  if (n === 0) return "vence hoje";
  if (n === 1) return "vence amanhã";
  return `vence ${dataBr(venc)}`;
}

export function montarEmail(d: DadosLembrete): { assunto: string; html: string; texto: string } {
  const p = faixas(d.pagar, d.hoje);
  const r = faixas(d.receber, d.hoje);
  const partes: string[] = [];
  if (p.vencidos.length) partes.push(`${p.vencidos.length} conta${p.vencidos.length > 1 ? "s" : ""} vencida${p.vencidos.length > 1 ? "s" : ""}`);
  if (p.proximos.length) partes.push(`${p.proximos.length} vencendo em até ${DIAS_ALERTA} dias`);
  if (r.vencidos.length) partes.push(`${r.vencidos.length} recebimento${r.vencidos.length > 1 ? "s" : ""} atrasado${r.vencidos.length > 1 ? "s" : ""}`);
  if (d.whatsappPendentes) partes.push(`${d.whatsappPendentes} documento${d.whatsappPendentes > 1 ? "s" : ""} do WhatsApp a conferir`);
  const assunto = d.semanal
    ? `Novo Horizonte — resumo da semana (${dataBr(d.hoje).slice(0, 5)})${partes.length ? `: ${partes.join(", ")}` : ""}`
    : `Novo Horizonte — ${partes.join(", ") || "nada pendente"}`;

  // Seções (texto e HTML montados juntos para não divergirem).
  const html: string[] = [];
  const texto: string[] = [];
  const secao = (titulo: string, cor: string, itens: TituloLembrete[]) => {
    if (!itens.length) return;
    html.push(
      `<h3 style="margin:20px 0 6px;font-size:15px;color:${cor}">${escapar(titulo)} — R$ ${reais(soma(itens))}</h3><table style="border-collapse:collapse;width:100%;font-size:14px">` +
        itens
          .map(
            (t) =>
              `<tr><td style="padding:4px 8px 4px 0;border-bottom:1px solid #eee">${escapar(t.descricao)}${t.contraparte ? ` <span style="color:#78716c">— ${escapar(t.contraparte)}</span>` : ""}<br><span style="color:#78716c;font-size:12px">${quando(d.hoje, t.vencimento)}</span></td><td style="padding:4px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">R$ ${reais(t.valorCentavos)}</td></tr>`,
          )
          .join("") +
        `</table>`,
    );
    texto.push(`\n${titulo} (R$ ${reais(soma(itens))}):`, ...itens.map((t) => `- ${t.descricao}${t.contraparte ? ` — ${t.contraparte}` : ""}: R$ ${reais(t.valorCentavos)}, ${quando(d.hoje, t.vencimento)}`));
  };
  secao("A pagar — vencidas", "#b91c1c", p.vencidos);
  secao(`A pagar — vencem em até ${DIAS_ALERTA} dias`, "#b45309", p.proximos);
  if (d.semanal) secao("A pagar — resto da semana", "#1c4332", p.semana);
  secao("A receber — atrasadas", "#b91c1c", r.vencidos);
  if (d.semanal) secao("A receber — próximos 7 dias", "#1c4332", [...r.proximos, ...r.semana]);

  if (d.whatsappPendentes) {
    html.push(`<p style="margin:16px 0 0">📄 ${d.whatsappPendentes} documento(s) recebido(s) pelo WhatsApp aguardando conferência.</p>`);
    texto.push(`\n${d.whatsappPendentes} documento(s) do WhatsApp aguardando conferência.`);
  }
  if (d.semanal && d.mes) {
    const corRes = d.mes.resultado < 0 ? "#b91c1c" : "#1c4332";
    html.push(
      `<h3 style="margin:20px 0 6px;font-size:15px;color:#1c4332">Mês até hoje</h3><p style="margin:0;font-size:14px">Receita R$ ${reais(d.mes.receita)} · Custeio e despesas R$ ${reais(d.mes.gastos)} · <strong style="color:${corRes}">Resultado R$ ${reais(d.mes.resultado)}</strong></p>`,
    );
    texto.push(`\nMês até hoje: receita R$ ${reais(d.mes.receita)}, gastos R$ ${reais(d.mes.gastos)}, resultado R$ ${reais(d.mes.resultado)}.`);
  }
  if (d.semanal && d.cotacoes?.length) {
    html.push(
      `<h3 style="margin:20px 0 6px;font-size:15px;color:#1c4332">Cotações</h3><p style="margin:0;font-size:14px">${d.cotacoes.map((c) => `${escapar(c.nome)}: <strong>${escapar(c.valor)}</strong> <span style="color:#78716c">(${dataBr(c.data)})</span>`).join("<br>")}</p>`,
    );
    texto.push(`\nCotações: ${d.cotacoes.map((c) => `${c.nome} ${c.valor} (${dataBr(c.data)})`).join("; ")}.`);
  }
  if (d.semanal && (d.diasDesdeBackup === null || (d.diasDesdeBackup ?? 0) > 30)) {
    const msg = d.diasDesdeBackup === null ? "Nenhum backup baixado ainda." : `Último backup há ${d.diasDesdeBackup} dias.`;
    html.push(`<p style="margin:16px 0 0;color:#b45309">💾 ${msg} Baixe em Plano de contas → Backup completo.</p>`);
    texto.push(`\n${msg} Baixe em Plano de contas → Backup completo.`);
  }
  if (!html.length) {
    html.push(`<p style="margin:12px 0 0">Nada vencido nem vencendo nos próximos dias. 👍</p>`);
    texto.push("\nNada vencido nem vencendo nos próximos dias.");
  }

  const corpo = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;color:#1c1917">
<p style="margin:0 0 4px;font-size:18px;font-weight:bold;color:#1c4332">Novo Horizonte</p>
<p style="margin:0;color:#78716c;font-size:13px">${d.semanal ? "Resumo da semana" : "Lembrete do dia"} · ${dataBr(d.hoje)}</p>
${html.join("\n")}
<p style="margin:24px 0 0;font-size:13px"><a href="${escapar(d.site)}/a-pagar-receber" style="color:#1c4332">Abrir contas a pagar e receber</a> · <a href="${escapar(d.site)}" style="color:#1c4332">Painel</a></p>
<p style="margin:16px 0 0;font-size:11px;color:#a8a29e">E-mail automático do sistema Novo Horizonte. Para mudar quem recebe, acesse Lembretes no sistema.</p>
</div>`;
  return { assunto, html: corpo, texto: `Novo Horizonte — ${d.semanal ? "resumo da semana" : "lembrete do dia"} (${dataBr(d.hoje)})${texto.join("\n")}\n\n${d.site}/a-pagar-receber` };
}
