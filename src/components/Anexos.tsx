"use client";

import { useState, useTransition } from "react";
import { anexarArquivo, removerAnexo, type DestinoAnexo, type EstadoAnexo } from "@/app/(app)/acoes-anexo";
import { dataBr } from "@/lib/formato";
import { comprimirImagem } from "@/lib/imagem";

export type AnexoResumo = { id: string; nome: string; tipo: string; tamanho: number; criadoEm: string };

const tamanho = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`);

/** Link para abrir o arquivo numa aba nova. */
export function LinkAnexo({ anexo, children }: { anexo: Pick<AnexoResumo, "id" | "nome">; children?: React.ReactNode }) {
  return (
    <a href={`/api/anexos/${anexo.id}`} target="_blank" rel="noopener" title={anexo.nome} className="text-folha-700 hover:underline">
      {children ?? anexo.nome}
    </a>
  );
}

/** Botão "Anexar arquivo": envia assim que o arquivo é escolhido. */
export function BotaoAnexar({ destino, rotulo = "📎 Anexar arquivo", className = "" }: { destino: DestinoAnexo; rotulo?: string; className?: string }) {
  const [estado, setEstado] = useState<EstadoAnexo>();
  const [enviando, iniciar] = useTransition();
  const enviar = (original: File) =>
    iniciar(async () => {
      try {
        const form = new FormData();
        form.set("arquivo", await comprimirImagem(original));
        setEstado(await anexarArquivo(destino, undefined, form));
      } catch {
        setEstado({ erro: "Não foi possível enviar o arquivo. Verifique a conexão e tente de novo." });
      }
    });
  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <label className={`cursor-pointer text-folha-700 hover:underline ${enviando ? "pointer-events-none opacity-50" : ""}`}>
        {enviando ? "Enviando…" : rotulo}
        <input
          type="file"
          accept="application/pdf,image/*"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) enviar(f);
            e.target.value = "";
          }}
        />
      </label>
      {estado?.erro && <span className="text-red-700">{estado.erro}</span>}
    </span>
  );
}

/** Lista de arquivos de um lançamento ou título, com anexar e remover. */
export function ListaAnexos({ anexos, destino, vazio = "Nenhum arquivo anexado." }: { anexos: AnexoResumo[]; destino?: DestinoAnexo; vazio?: string }) {
  const [removendo, iniciar] = useTransition();
  return (
    <div className="text-sm">
      {anexos.length === 0 ? (
        <p className="text-stone-500">{vazio}</p>
      ) : (
        <ul className="space-y-1">
          {anexos.map((a) => (
            <li key={a.id} className="flex flex-wrap items-baseline gap-x-3">
              <span aria-hidden>{a.tipo === "application/pdf" ? "📄" : "🖼"}</span>
              <LinkAnexo anexo={a} />
              <span className="text-xs text-stone-500">
                {tamanho(a.tamanho)} · {dataBr(a.criadoEm)}
              </span>
              <a href={`/api/anexos/${a.id}?baixar=1`} className="text-xs text-stone-500 hover:underline">
                baixar
              </a>
              {destino && (
                <button
                  type="button"
                  disabled={removendo}
                  onClick={() => confirm(`Remover "${a.nome}"?`) && iniciar(() => removerAnexo(a.id))}
                  className="text-xs text-stone-400 hover:text-red-700 hover:underline"
                >
                  remover
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {destino && <BotaoAnexar destino={destino} className="mt-2 text-sm" />}
    </div>
  );
}
