import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESSAO, verificarSessao } from "./lib/sessao";

// Tudo exige login, menos a própria tela de login. A checagem definitiva
// (usuário ainda existe no banco) fica em exigirUsuario(); aqui é só o filtro
// rápido para não renderizar página nenhuma sem cookie válido.
export async function proxy(request: NextRequest) {
  const logado = await verificarSessao(request.cookies.get(COOKIE_SESSAO)?.value);
  if (!logado) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
