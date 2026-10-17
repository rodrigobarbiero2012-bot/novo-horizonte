import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { assinarSessao, COOKIE_SESSAO, DURACAO_SESSAO_SEGUNDOS, verificarSessao } from "./sessao";

export const hashSenha = (senha: string) => bcrypt.hash(senha, 12);

/** Usuário logado, ou redireciona para /login. Memoizado por requisição. */
export const exigirUsuario = cache(async () => {
  const id = await verificarSessao((await cookies()).get(COOKIE_SESSAO)?.value);
  const usuario = id ? await prisma.usuario.findUnique({ where: { id }, select: { id: true, nome: true, email: true } }) : null;
  if (!usuario) redirect("/login");
  return usuario;
});

const MAX_TENTATIVAS = 5;
const MINUTOS_BLOQUEIO = 15;

export type ResultadoLogin = "ok" | "invalido" | "bloqueado";

/**
 * Confere e-mail e senha e abre a sessão. Depois de MAX_TENTATIVAS senhas
 * erradas seguidas a conta fica bloqueada por MINUTOS_BLOQUEIO.
 */
export async function entrar(email: string, senha: string): Promise<ResultadoLogin> {
  const usuario = await prisma.usuario.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!usuario?.senhaHash) return "invalido";
  if (usuario.bloqueadoAte && usuario.bloqueadoAte > new Date()) return "bloqueado";

  if (!(await bcrypt.compare(senha, usuario.senhaHash))) {
    const tentativas = usuario.tentativasFalhas + 1;
    const bloquear = tentativas >= MAX_TENTATIVAS;
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: bloquear
        ? { tentativasFalhas: 0, bloqueadoAte: new Date(Date.now() + MINUTOS_BLOQUEIO * 60_000) }
        : { tentativasFalhas: tentativas },
    });
    return bloquear ? "bloqueado" : "invalido";
  }

  if (usuario.tentativasFalhas || usuario.bloqueadoAte) {
    await prisma.usuario.update({ where: { id: usuario.id }, data: { tentativasFalhas: 0, bloqueadoAte: null } });
  }
  await abrirSessao(usuario.id);
  return "ok";
}

async function abrirSessao(usuarioId: string) {
  (await cookies()).set(COOKIE_SESSAO, await assinarSessao(usuarioId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_SESSAO_SEGUNDOS,
  });
}

export const TAMANHO_MINIMO_SENHA = 10;

/**
 * Primeiro acesso: o sócio define a própria senha. Só vale para e-mail já
 * cadastrado (scripts/criar-usuario.ts sem --senha) e ainda sem senha — a
 * troca é atômica (updateMany com senhaHash = null), então cada convite só
 * pode ser usado uma vez. Recurso temporário, a remover depois que os dois
 * sócios tiverem senha.
 */
export async function definirPrimeiraSenha(email: string, senha: string): Promise<boolean> {
  const emailNormal = email.trim().toLowerCase();
  const { count } = await prisma.usuario.updateMany({
    where: { email: emailNormal, senhaHash: null },
    data: { senhaHash: await hashSenha(senha), tentativasFalhas: 0, bloqueadoAte: null },
  });
  if (count !== 1) return false;
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { email: emailNormal } });
  await prisma.registroAuditoria.create({
    data: { usuarioId: usuario.id, entidade: "Usuario", entidadeId: usuario.id, acao: "DEFINIR_SENHA" },
  });
  await abrirSessao(usuario.id);
  return true;
}

export async function sair() {
  (await cookies()).delete(COOKIE_SESSAO);
}
