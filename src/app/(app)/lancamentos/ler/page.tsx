import type { Metadata } from "next";
import Link from "next/link";
import { LeitorDocumento } from "@/components/LeitorDocumento";
import { Pagina } from "@/components/Pagina";
import { BotaoDescartar } from "@/components/whatsapp/Componentes";
import { Cabecalho, Cartao } from "@/components/ui";
import { contasAtivas } from "@/lib/consultas";
import { prisma } from "@/lib/db";
import type { Analise } from "@/lib/documentos/analise";
import type { DocumentoLido } from "@/lib/documentos/esquema";
import { dataBr } from "@/lib/formato";
import { exigirUsuario } from "@/lib/usuario";
import { formatarNumero, mesmoNumero } from "@/lib/whatsapp/meta";
import { numerosAutorizados } from "@/lib/whatsapp/processar";
import { criarLancamento } from "../acoes";
import { lerDocumentoAcao, type ResultadoLeitura } from "./acoes";

// A ação de leitura do documento roda nesta função e leva de 10 a 30 s.
export const maxDuration = 60;

export const metadata: Metadata = { title: "Ler boleto ou nota" };

/** Sem leitura nem erro depois de 3 minutos: a função caiu no meio (a leitura leva no máximo ~45 s). */
const leituraTravada = (recebidoEm: Date) => Date.now() - recebidoEm.getTime() > 3 * 60_000;

/** Documento que a IA não conseguiu ler: abre a revisão em branco, para preencher à mão. */
const documentoVazio = (erro: string): DocumentoLido => ({
  tipo: "outro",
  fornecedor: null,
  cnpjCpf: null,
  valor: null,
  vencimento: null,
  dataEmissao: null,
  numeroDocumento: null,
  linhaDigitavel: null,
  descricao: "",
  contaSugerida: null,
  justificativaConta: "",
  confianca: "baixa",
  observacoes: `Não foi lido automaticamente (${erro.replace(/\.$/, "")}). Preencha a partir do arquivo ao lado.`,
});

async function Conteudo({ searchParams }: PageProps<"/lancamentos/ler">) {
  await exigirUsuario();
  const pedido = (await searchParams).documento;
  const [contas, recebidos, numeros, aberto] = await Promise.all([
    contasAtivas(),
    prisma.documentoRecebido.findMany({
      where: { status: "PENDENTE" },
      orderBy: { criadoEm: "desc" },
      select: { id: true, remetente: true, legenda: true, leitura: true, erro: true, criadoEm: true, anexo: { select: { nome: true } } },
    }),
    numerosAutorizados(),
    typeof pedido === "string"
      ? prisma.documentoRecebido.findUnique({ where: { id: pedido }, include: { anexo: { select: { id: true, nome: true, tipo: true } } } })
      : null,
  ]);
  const nomeDe = (numero: string) => numeros.find((n) => mesmoNumero(n.numero, numero))?.nome ?? formatarNumero(numero);

  // Documento do WhatsApp aberto para conferência.
  let inicial: Parameters<typeof LeitorDocumento>[0]["inicial"];
  if (aberto?.status === "PENDENTE" && aberto.anexo) {
    const lida = aberto.leitura as Extract<Analise, { ok: true }> | null;
    const leitura: Extract<ResultadoLeitura, { ok: true }> = lida
      ? { ...lida, anexoId: aberto.anexo.id }
      : {
          ok: true,
          documento: documentoVazio(aberto.erro ?? "sem leitura"),
          contaDebitoId: null,
          origemConta: null,
          vezesNoHistorico: 0,
          contaCreditoId: null,
          anexoId: aberto.anexo.id,
        };
    inicial = {
      previa: { url: `/api/anexos/${aberto.anexo.id}`, pdf: aberto.anexo.tipo === "application/pdf", nome: aberto.anexo.nome },
      leitura,
    };
  }

  return (
    <>
      <Cabecalho
        titulo="Ler boleto ou nota"
        subtitulo="Envie o PDF ou a foto, aqui ou pelo WhatsApp: a IA lê fornecedor, valor e vencimento e já sugere as contas. Você confere e grava."
      />

      {aberto && !inicial && (
        <p className="mb-4 max-w-2xl rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
          Esse documento já foi {aberto.status === "GRAVADO" ? "gravado" : "descartado"}.
        </p>
      )}

      {!inicial && recebidos.length > 0 && (
        <Cartao className="mb-6 max-w-2xl p-5">
          <h2 className="mb-2 font-semibold text-stone-800">Recebidos pelo WhatsApp — a conferir ({recebidos.length})</h2>
          <ul className="divide-y divide-stone-100 text-sm">
            {recebidos.map((r) => {
              const d = (r.leitura as Extract<Analise, { ok: true }> | null)?.documento;
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <span className="w-20 shrink-0 tabular-nums text-stone-500">{dataBr(r.criadoEm)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-stone-800">
                      {d ? [d.fornecedor ?? "fornecedor não lido", d.valor !== null ? `R$ ${d.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : null, d.vencimento ? `vence ${dataBr(d.vencimento)}` : null].filter(Boolean).join(" · ") : (r.anexo?.nome ?? "arquivo")}
                    </span>
                    <span className="block truncate text-xs text-stone-500">
                      de {nomeDe(r.remetente)}
                      {r.legenda ? ` — “${r.legenda}”` : ""}
                      {r.erro ? (
                        <span className="text-amber-700"> · não lido: {r.erro}</span>
                      ) : !r.leitura && leituraTravada(r.criadoEm) ? (
                        <span className="text-amber-700"> · leitura não concluída — confira à mão</span>
                      ) : null}
                    </span>
                  </span>
                  <Link href={`/lancamentos/ler?documento=${r.id}`} className="rounded-md border border-folha-600 px-2.5 py-1 text-xs font-medium text-folha-700 hover:bg-folha-50">
                    Conferir
                  </Link>
                  <BotaoDescartar id={r.id} />
                </li>
              );
            })}
          </ul>
        </Cartao>
      )}

      <LeitorDocumento key={aberto?.id ?? "novo"} contas={contas} ler={lerDocumentoAcao} criar={criarLancamento} inicial={inicial} />

      {!inicial && (
        <p className="mt-4 max-w-2xl text-xs text-stone-500">
          Para mandar pelo celular: <Link href="/whatsapp" className="text-folha-700 hover:underline">configurar o WhatsApp</Link>.
        </p>
      )}
    </>
  );
}

export default function LerDocumentoPage(props: PageProps<"/lancamentos/ler">) {
  return (
    <Pagina>
      <Conteudo {...props} />
    </Pagina>
  );
}
