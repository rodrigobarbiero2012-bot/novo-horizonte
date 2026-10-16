import { SignJWT, jwtVerify } from "jose";

// Sessão em cookie assinado (JWT HS256). Sem estado no servidor: só dois
// usuários, e o cookie carrega apenas o id. Módulo sem Prisma/bcrypt para poder
// ser usado também no proxy.

export const COOKIE_SESSAO = "nh_sessao";
export const DURACAO_SESSAO_SEGUNDOS = 60 * 60 * 24 * 30;

function chave() {
  const segredo = process.env.AUTH_SECRET;
  if (!segredo || segredo.length < 32) {
    throw new Error("AUTH_SECRET ausente ou curto (mínimo 32 caracteres).");
  }
  return new TextEncoder().encode(segredo);
}

export async function assinarSessao(usuarioId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(usuarioId)
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_SESSAO_SEGUNDOS}s`)
    .sign(chave());
}

/** Id do usuário se o token for válido e não expirado; senão null. */
export async function verificarSessao(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chave(), { algorithms: ["HS256"] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
