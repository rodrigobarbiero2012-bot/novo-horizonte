"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import type { ResultadoLeitura } from "@/app/(app)/lancamentos/ler/acoes";
import type { EstadoFormulario } from "@/app/(app)/lancamentos/acoes";
import { TIPOS_DOCUMENTO, type DocumentoLido } from "@/lib/documentos/esquema";
import { dataBr } from "@/lib/formato";
import { comprimirImagem } from "@/lib/imagem";
import { categoriasDoTitulo } from "@/lib/titulos/categorias";
import { FormularioLancamento, type LinhaForm } from "./FormularioLancamento";
import { FormTitulo } from "./titulos/FormTitulo";
import { botaoPrimario, botaoSecundario, Cartao } from "./ui";

type Conta = { id: string; nome: string; categoria: string };
type Props = {
  contas: Conta[];
  ler: (form: FormData) => Promise<ResultadoLeitura>;
  criar: (estado: EstadoFormulario, form: FormData) => Promise<EstadoFormulario>;
  /** Documento já lido (recebido pelo WhatsApp): abre direto na revisão. */
  inicial?: { previa: Previa; leitura: Extract<ResultadoLeitura, { ok: true }> };
};

type Etapa =
  | { tipo: "escolher"; erro?: string }
  | { tipo: "lendo"; previa: Previa }
  | { tipo: "revisar"; previa: Previa; leitura: Extract<ResultadoLeitura, { ok: true }>; chave: number }
  | { tipo: "gravado"; id?: string; comoTitulo?: boolean };

export type Previa = { url: string; pdf: boolean; nome: string };

const valorTexto = (reais: number) => reais.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function historicoSugerido(d: DocumentoLido) {
  const doc = d.tipo === "nota_fiscal" && d.numeroDocumento ? `nf ${d.numeroDocumento} ` : d.tipo === "boleto" ? "boleto " : "";
  return `pgto ${doc}${d.fornecedor ?? ""}${d.descricao ? ` — ${d.descricao}` : ""}`.replace(/\s+/g, " ").trim();
}

export function LeitorDocumento({ contas, ler, criar, inicial }: Props) {
  const [etapa, setEtapa] = useState<Etapa>(inicial ? { tipo: "revisar", ...inicial, chave: 0 } : { tipo: "escolher" });
  const [arrastando, setArrastando] = useState(false);
  const [, iniciar] = useTransition();
  const [contador, setContador] = useState(0);

  const processar = (original: File) =>
    iniciar(async () => {
      const previa = { url: URL.createObjectURL(original), pdf: original.type === "application/pdf", nome: original.name };
      setEtapa({ tipo: "lendo", previa });
      try {
        const arquivo = await comprimirImagem(original);
        const form = new FormData();
        form.set("arquivo", arquivo);
        const resultado = await ler(form);
        if (!resultado.ok) {
          setEtapa({ tipo: "escolher", erro: resultado.erro });
          return;
        }
        setContador((c) => c + 1);
        setEtapa({ tipo: "revisar", previa, leitura: resultado, chave: contador + 1 });
      } catch {
        setEtapa({ tipo: "escolher", erro: "Não foi possível enviar o arquivo. Verifique a conexão e tente de novo." });
      }
    });

  const aoGravar = useCallback((id: string) => setEtapa({ tipo: "gravado", id }), []);
  const aoCriarTitulo = useCallback(() => setEtapa({ tipo: "gravado", comoTitulo: true }), []);

  if (etapa.tipo === "gravado") {
    return (
      <Cartao className="max-w-xl p-6">
        <p className="mb-4 font-medium text-folha-800">{etapa.comoTitulo ? "✓ Conta a pagar criada." : "✓ Lançamento gravado."}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setEtapa({ tipo: "escolher" })} className={botaoPrimario}>
            Ler outro documento
          </button>
          {etapa.comoTitulo ? (
            <Link href="/a-pagar-receber" className={botaoSecundario}>
              Ver contas a pagar
            </Link>
          ) : (
            <Link href={`/lancamentos/${etapa.id}`} className={botaoSecundario}>
              Ver lançamento
            </Link>
          )}
        </div>
      </Cartao>
    );
  }

  if (etapa.tipo === "escolher") {
    return (
      <Cartao className="max-w-2xl p-6">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            const f = e.dataTransfer.files[0];
            if (f) processar(f);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
            arrastando ? "border-folha-600 bg-folha-50" : "border-stone-300 hover:border-folha-600 hover:bg-stone-50"
          }`}
        >
          <span className="text-3xl" aria-hidden>
            📄
          </span>
          <span className="mt-3 font-medium text-stone-800">Envie o boleto, a nota fiscal ou o recibo</span>
          <span className="mt-1 text-sm text-stone-500">PDF ou foto · arraste aqui ou clique para escolher (no celular, abre a câmera)</span>
          <input
            type="file"
            accept="application/pdf,image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) processar(f);
              e.target.value = "";
            }}
          />
        </label>
        {etapa.erro && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{etapa.erro}</p>}
        <p className="mt-4 text-xs text-stone-500">
          A IA lê o documento e sugere o lançamento; nada é gravado sem você conferir e confirmar. O arquivo fica guardado junto do
          lançamento ou da conta a pagar.
        </p>
      </Cartao>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Cartao className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-2 text-xs text-stone-500">
          <span className="truncate">{etapa.previa.nome}</span>
          {etapa.tipo === "revisar" && (
            <button type="button" onClick={() => setEtapa({ tipo: "escolher" })} className="shrink-0 text-folha-700 hover:underline">
              Trocar arquivo
            </button>
          )}
        </div>
        {etapa.previa.pdf ? (
          <iframe src={etapa.previa.url} title="Documento enviado" className="h-[70vh] w-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:), sem otimização de imagem
          <img src={etapa.previa.url} alt="Documento enviado" className="max-h-[70vh] w-full object-contain" />
        )}
      </Cartao>

      {etapa.tipo === "lendo" ? (
        <Cartao className="flex flex-col items-center justify-center p-10 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-folha-100 border-t-folha-700" />
          <p className="mt-4 font-medium text-stone-800">Lendo o documento…</p>
          <p className="mt-1 text-sm text-stone-500">Costuma levar de 10 a 30 segundos.</p>
        </Cartao>
      ) : (
        <div className="space-y-4">
          <Resumo leitura={etapa.leitura} contas={contas} />
          <Destino key={etapa.chave} leitura={etapa.leitura} contas={contas} criar={criar} aoGravar={aoGravar} aoCriarTitulo={aoCriarTitulo} />
        </div>
      )}
    </div>
  );
}

/**
 * Boleto com vencimento a partir de hoje começa como "a pagar"; o resto
 * (recibo, comprovante, boleto vencido) como "já pago". O sócio pode trocar.
 */
function Destino({
  leitura,
  contas,
  criar,
  aoGravar,
  aoCriarTitulo,
}: {
  leitura: Extract<ResultadoLeitura, { ok: true }>;
  contas: Conta[];
  criar: Props["criar"];
  aoGravar: (id: string) => void;
  aoCriarTitulo: () => void;
}) {
  const d = leitura.documento;
  const hoje = new Date().toLocaleDateString("sv-SE");
  const [modo, setModo] = useState<"apagar" | "pago">(
    (d.tipo === "boleto" || d.tipo === "nota_fiscal") && d.vencimento && d.vencimento >= hoje ? "apagar" : "pago",
  );
  const contasPagar = contas.filter((c) => categoriasDoTitulo("PAGAR").includes(c.categoria));

  return (
    <Cartao className="p-5">
      <div className="mb-4 inline-flex rounded-lg border border-stone-200 bg-white p-1 text-sm">
        {(
          [
            ["apagar", "A pagar no vencimento"],
            ["pago", "Já foi pago"],
          ] as const
        ).map(([valor, rotulo]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setModo(valor)}
            className={`rounded-md px-3 py-1 ${modo === valor ? "bg-folha-700 text-white" : "text-stone-600 hover:bg-stone-100"}`}
          >
            {rotulo}
          </button>
        ))}
      </div>
      {modo === "apagar" ? (
        <>
          <p className="mb-3 text-sm text-stone-600">Entra em “A pagar e receber”; o lançamento é gerado quando você der baixa no pagamento.</p>
          <FormTitulo
            tipo="PAGAR"
            contas={contasPagar}
            origem="DOCUMENTO"
            anexoId={leitura.anexoId}
            aoGravar={aoCriarTitulo}
            inicial={{
              descricao: (d.descricao || TIPOS_DOCUMENTO[d.tipo]) + (d.numeroDocumento ? ` — doc. ${d.numeroDocumento}` : ""),
              contraparte: d.fornecedor ?? undefined,
              valor: d.valor ? valorTexto(d.valor) : undefined,
              vencimento: d.vencimento ?? undefined,
              contaId: contasPagar.some((c) => c.id === leitura.contaDebitoId) ? (leitura.contaDebitoId ?? undefined) : undefined,
              numeroDocumento: d.numeroDocumento ?? undefined,
              linhaDigitavel: d.linhaDigitavel ?? undefined,
            }}
          />
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-stone-600">Grava o lançamento do pagamento agora.</p>
          <FormularioLancamento contas={contas} acao={criar} origem="DOCUMENTO" anexoId={leitura.anexoId} aoGravar={aoGravar} inicial={montarInicial(leitura)} />
        </>
      )}
    </Cartao>
  );
}

function montarInicial(l: Extract<ResultadoLeitura, { ok: true }>) {
  const d = l.documento;
  const valor = d.valor ? valorTexto(d.valor) : "";
  const linhas: LinhaForm[] = [
    { contaId: l.contaDebitoId ?? "", debito: valor, credito: "" },
    { contaId: l.contaCreditoId ?? "", debito: "", credito: valor },
  ];
  return {
    data: d.vencimento ?? d.dataEmissao ?? new Date().toLocaleDateString("sv-SE"),
    historico: historicoSugerido(d),
    linhas,
  };
}

function Resumo({ leitura, contas }: { leitura: Extract<ResultadoLeitura, { ok: true }>; contas: Conta[] }) {
  const d = leitura.documento;
  const conta = contas.find((c) => c.id === leitura.contaDebitoId);
  const confianca = { alta: "text-folha-700", media: "text-amber-700", baixa: "text-red-700" }[d.confianca];
  const campos: [string, string | null][] = [
    ["Fornecedor", d.fornecedor],
    ["CNPJ/CPF", d.cnpjCpf],
    ["Valor", d.valor !== null ? `R$ ${valorTexto(d.valor)}` : null],
    ["Vencimento", d.vencimento ? dataBr(d.vencimento) : null],
    ["Emissão", d.dataEmissao ? dataBr(d.dataEmissao) : null],
    ["Número", d.numeroDocumento],
    ["Linha digitável", d.linhaDigitavel],
  ];
  return (
    <Cartao className="p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-stone-800">{TIPOS_DOCUMENTO[d.tipo]} lido</h2>
        <span className={`text-xs font-medium ${confianca}`}>
          {d.confianca === "alta" ? "✓" : "⚠"} Confiança {d.confianca === "media" ? "média" : d.confianca}
        </span>
      </div>
      <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-sm">
        {campos.map(([rotulo, valor]) => (
          <div key={rotulo} className="contents">
            <dt className="text-stone-500">{rotulo}</dt>
            <dd className={`break-words ${valor ? "text-stone-800" : "text-stone-400"}`}>{valor ?? "não encontrado"}</dd>
          </div>
        ))}
      </dl>
      {d.descricao && <p className="mt-3 text-sm text-stone-600">{d.descricao}</p>}
      <p className="mt-3 rounded-md bg-stone-50 px-3 py-2 text-xs text-stone-600">
        <strong>Conta sugerida:</strong> {conta?.nome ?? "nenhuma — escolha no formulário"}
        {leitura.origemConta === "historico" && ` (usada ${leitura.vezesNoHistorico}× com este fornecedor)`}
        {leitura.origemConta === "ia" && ` — ${d.justificativaConta}`}
      </p>
      {d.observacoes && <p className="mt-2 text-xs text-amber-800">⚠ {d.observacoes}</p>}
    </Cartao>
  );
}
