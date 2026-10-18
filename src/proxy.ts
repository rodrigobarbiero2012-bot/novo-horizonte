import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESSAO, verificarSessao } from "./lib/sessao";

// Tudo exige login, menos a tela de login, a de primeiro acesso, o cron e o webhook do WhatsApp
// (que se autenticam na própria rota: CRON_SECRET e assinatura da Meta). A checagem definitiva
// (usuário ainda existe no banco) fica em exigirUsuario(); aqui é só o filtro
// rápido para não renderizar página nenhuma sem cookie válido. O manifesto e os
// ícones do aplicativo ficam abertos: o celular os busca antes do login.
export async function proxy(request: NextRequest) {
  const logado = await verificarSessao(request.cookies.get(COOKIE_SESSAO)?.value);
  if (!logado) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = {
  // Cada exceção é ancorada (fim do caminho ou "/"), para uma rota futura como
  // "/login-x" ou "/api/cron-y" não escapar do filtro por prefixo.
  matcher: [
    "/((?!(?:login|primeiro-acesso|api/whatsapp|favicon\\.ico|icon\\.svg|manifest\\.webmanifest)(?:/|$)|api/cron/|_next/static/|_next/image|icons/).*)",
  ],
};
