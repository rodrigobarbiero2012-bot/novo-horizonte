import type { Metadata } from "next";
import { Pagina } from "@/components/Pagina";
import { Cabecalho, Cartao } from "@/components/ui";
import { FormNumeros } from "@/components/whatsapp/Componentes";
import { exigirUsuario } from "@/lib/usuario";
import { enderecoSite, numerosAutorizados, VARIAVEIS_WHATSAPP, variaveisFaltando } from "@/lib/whatsapp/processar";

export const metadata: Metadata = { title: "WhatsApp" };

async function Conteudo() {
  await exigirUsuario();
  const numeros = await numerosAutorizados();
  const faltando = variaveisFaltando();
  const pronto = faltando.length === 0 && numeros.length > 0;
  const webhook = `${enderecoSite()}/api/whatsapp`;

  return (
    <>
      <Cabecalho
        titulo="Receber documentos pelo WhatsApp"
        subtitulo="Mande a foto ou o PDF do boleto para o número do sítio: o sistema lê, guarda o arquivo e responde com o link para você conferir e gravar."
      />

      <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
        <Cartao className="p-5">
          <h2 className="mb-2 font-semibold text-stone-800">Situação</h2>
          <p className={`mb-3 text-sm font-medium ${pronto ? "text-folha-700" : "text-amber-700"}`}>
            {pronto ? "✓ Pronto para receber." : "Ainda não está funcionando — falta o que está marcado abaixo."}
          </p>
          <ul className="space-y-1 text-sm">
            {VARIAVEIS_WHATSAPP.map((v) => (
              <li key={v} className={faltando.includes(v) ? "text-amber-800" : "text-stone-600"}>
                {faltando.includes(v) ? "✗" : "✓"} <code className="text-xs">{v}</code> {faltando.includes(v) ? "— cadastrar na Vercel" : "configurada"}
              </li>
            ))}
            <li className={numeros.length ? "text-stone-600" : "text-amber-800"}>
              {numeros.length ? "✓" : "✗"} Números autorizados {numeros.length ? `(${numeros.length})` : "— cadastrar ao lado"}
            </li>
          </ul>
          <p className="mt-4 text-xs text-stone-500">
            Endereço do webhook, para colar na Meta: <code className="break-all rounded bg-stone-100 px-1 py-0.5 text-stone-700">{webhook}</code>
          </p>
        </Cartao>

        <Cartao className="p-5">
          <h2 className="mb-1 font-semibold text-stone-800">Quem pode enviar</h2>
          <p className="mb-3 text-xs text-stone-500">Mensagens de outros números são ignoradas, sem resposta.</p>
          <FormNumeros atuais={numeros} />
        </Cartao>

        <Cartao className="p-5 lg:col-span-2">
          <h2 className="mb-2 font-semibold text-stone-800">Como configurar (uma vez só)</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-stone-700">
            <li>
              <strong>Um número para o sítio</strong>: um chip que <em>não</em> esteja em uso no WhatsApp do celular (pode ser um chip pré-pago novo). É
              para ele que vocês vão mandar os boletos.
            </li>
            <li>
              Em <strong>developers.facebook.com</strong>, crie um app do tipo <em>Empresa</em> e adicione o produto <strong>WhatsApp</strong>. Na tela
              “Configuração da API”, adicione o número do sítio e confirme pelo código SMS. Anote o <strong>ID do número de telefone</strong> (
              <code className="text-xs">WHATSAPP_PHONE_NUMBER_ID</code>).
            </li>
            <li>
              No <strong>Business Manager</strong> (business.facebook.com → Configurações → Usuários do sistema), crie um usuário do sistema com acesso ao
              app e gere um <strong>token permanente</strong> com as permissões <code className="text-xs">whatsapp_business_messaging</code> e{" "}
              <code className="text-xs">whatsapp_business_management</code> (<code className="text-xs">WHATSAPP_TOKEN</code>).
            </li>
            <li>
              No app, em Configurações → Básico, copie a <strong>Chave secreta do app</strong> (<code className="text-xs">WHATSAPP_APP_SECRET</code>).
              Invente também uma senha qualquer para o webhook (<code className="text-xs">WHATSAPP_VERIFY_TOKEN</code>).
            </li>
            <li>
              Na Vercel (projeto novo-horizonte → Settings → Environment Variables), cadastre as quatro variáveis e faça o redeploy.
            </li>
            <li>
              De volta ao app da Meta, em WhatsApp → Configuração → Webhook, cole o endereço acima e o mesmo <em>verify token</em>; depois assine o campo{" "}
              <strong>messages</strong>.
            </li>
            <li>Cadastre aqui os celulares de vocês e mande uma foto de boleto para o número do sítio.</li>
          </ol>
          <p className="mt-3 text-xs text-stone-500">
            Custo: pela regra atual da Meta, receber mensagens e responder dentro de 24 horas da mensagem de vocês (que é o caso aqui) não é cobrado — vale conferir na página de preços do WhatsApp Business antes de ativar. A
            leitura usa a mesma chave da Anthropic da tela “Ler boleto ou nota”.
          </p>
        </Cartao>
      </div>
    </>
  );
}

export default function WhatsappPage() {
  return (
    <Pagina>
      <Conteudo />
    </Pagina>
  );
}
