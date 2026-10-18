import { prisma } from "@/lib/db";
import { exigirUsuario } from "@/lib/usuario";

/** Abre (ou baixa, com ?baixar=1) o arquivo anexado. Só para quem está logado. */
export async function GET(request: Request, { params }: RouteContext<"/api/anexos/[id]">) {
  await exigirUsuario();
  const { id } = await params;
  const anexo = await prisma.anexo.findUnique({ where: { id }, select: { nome: true, tipo: true, conteudo: true } });
  if (!anexo) return new Response("Arquivo não encontrado.", { status: 404 });
  const baixar = new URL(request.url).searchParams.has("baixar");
  const nome = encodeURIComponent(anexo.nome);
  return new Response(new Uint8Array(anexo.conteudo), {
    headers: {
      "Content-Type": anexo.tipo,
      "Content-Disposition": `${baixar ? "attachment" : "inline"}; filename*=UTF-8''${nome}`,
      "Cache-Control": "private, no-store", // documento financeiro: não fica no cache do navegador
      // O envio só aceita PDF e imagens (sem SVG), e o tipo gravado é um desses; nosniff impede o
      // navegador de "adivinhar" outro tipo. (CSP sandbox quebraria o leitor de PDF do Chrome.)
      "X-Content-Type-Options": "nosniff",
    },
  });
}
