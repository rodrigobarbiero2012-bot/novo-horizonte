import type { Metadata } from "next";
import { BotaoTeste, FormDestinatarios } from "@/components/lembretes/Componentes";
import { Pagina } from "@/components/Pagina";
import { Cabecalho, Cartao } from "@/components/ui";
import { prisma } from "@/lib/db";
import { montarEmail } from "@/lib/lembretes/email";
import { CHAVE_DESTINATARIOS, coletarDados, destinatarios, emailFaltando, VARIAVEIS_EMAIL } from "@/lib/lembretes/enviar";
import { exigirUsuario } from "@/lib/usuario";

export const metadata: Metadata = { title: "Lembretes por e-mail" };

async function Conteudo() {
  await exigirUsuario();
  const [lista, configurada, dados] = await Promise.all([
    destinatarios(),
    prisma.configuracao.findUnique({ where: { chave: CHAVE_DESTINATARIOS } }),
    coletarDados(true),
  ]);
  const faltando = emailFaltando();
  const previa = montarEmail(dados);

  return (
    <>
      <Cabecalho
        titulo="Lembretes por e-mail"
        subtitulo="Todo dia às 7h, só se houver conta vencida ou vencendo em até 3 dias, recebimento atrasado ou documento do WhatsApp a conferir. Na segunda, resumo da semana."
      />
      <div className="grid max-w-6xl gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Cartao className="p-5">
            <h2 className="mb-2 font-semibold text-stone-800">Situação</h2>
            <ul className="space-y-1 text-sm">
              {VARIAVEIS_EMAIL.map((v) => (
                <li key={v} className={faltando.includes(v) ? "text-amber-800" : "text-stone-600"}>
                  {faltando.includes(v) ? "✗" : "✓"} <code className="text-xs">{v}</code> {faltando.includes(v) ? "— cadastrar na Vercel" : "configurada"}
                </li>
              ))}
              <li className="text-stone-600">Destinatários: {lista.length ? lista.join(", ") : "nenhum"}</li>
            </ul>
            <div className="mt-4">
              <BotaoTeste desabilitado={faltando.length > 0} />
            </div>
          </Cartao>

          <Cartao className="p-5">
            <h2 className="mb-1 font-semibold text-stone-800">Quem recebe</h2>
            <p className="mb-2 text-xs text-stone-500">Em branco: os sócios cadastrados no sistema.</p>
            <FormDestinatarios atuais={Array.isArray(configurada?.valor) ? (configurada.valor as string[]) : []} />
          </Cartao>

          <Cartao className="p-5">
            <h2 className="mb-2 font-semibold text-stone-800">Como configurar o envio pelo Gmail (uma vez só)</h2>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-stone-700">
              <li>
                Na conta Google que vai enviar (pode ser a sua), ative a <strong>verificação em duas etapas</strong> (myaccount.google.com → Segurança).
              </li>
              <li>
                Em <strong>myaccount.google.com/apppasswords</strong>, crie uma senha de app chamada “Novo Horizonte”. O Google mostra 16 letras: essa é a{" "}
                <code className="text-xs">SMTP_SENHA</code> (não é a senha normal da conta).
              </li>
              <li>
                Na Vercel (Settings → Environment Variables), cadastre <code className="text-xs">SMTP_USUARIO</code> (o e-mail Gmail) e{" "}
                <code className="text-xs">SMTP_SENHA</code>, e faça o redeploy.
              </li>
              <li>Volte aqui e clique em “Enviar um teste para mim”.</li>
            </ol>
            <p className="mt-3 text-xs text-stone-500">O agendamento diário usa o mesmo CRON_SECRET das cotações.</p>
          </Cartao>
        </div>

        <Cartao className="overflow-hidden">
          <div className="border-b border-stone-200 px-4 py-2 text-xs text-stone-500">
            Prévia do resumo de segunda, com os dados de hoje · <strong className="text-stone-700">{previa.assunto}</strong>
          </div>
          <iframe title="Prévia do e-mail" srcDoc={previa.html} sandbox="" className="h-[640px] w-full bg-white" />
        </Cartao>
      </div>
    </>
  );
}

export default function LembretesPage() {
  return (
    <Pagina>
      <Conteudo />
    </Pagina>
  );
}
