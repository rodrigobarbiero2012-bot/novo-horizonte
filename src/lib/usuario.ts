import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { assinarSessao, COOKIE_SESSAO, DURACAO_SESSAO_SEGUNDOS, verificarSessao } from "./sessao";

export const hashSenha = (senha: string) => bcrypt.hash(senha, 12);

/** Usuário logado, ou redireciona para /login. Memoizado por requisição. */
export const exigirUsuario = cache(async () => {
  const sessao = await verificarSessao((await cookies()).get(COOKIE_SESSAO)?.value);
  const usuario = sessao
    ? await prisma.usuario.findUnique({ where: { id: sessao.usuarioId }, select: { id: true, nome: true, email: true, sessaoVersao: true } })
    : null;
  // Versão diferente: o usuário mandou "sair de todos os aparelhos" depois que este cookie foi emitido.
  if (!usuario || usuario.sessaoVersao !== sessao!.versao) redirect("/login");
  return { id: usuario.id, nome: usuario.nome, email: usuario.email };
});

const MAX_TENTATIVAS = 5;
const MINUTOS_BLOQUEIO = 15;

export type ResultadoLogin = "ok" | "invalido" | "bloqueado";

// Hash de uma senha qualquer: com e-mail inexistente a resposta leva o mesmo
// tempo do bcrypt, para não revelar quais e-mails têm conta.
const HASH_FICTICIO = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO6gXqTQ5Bkf5f9c3T3h0n5dJ7w1bq3Xu";

/**
 * Confere e-mail e senha e abre a sessão. Depois de MAX_TENTATIVAS senhas
 * erradas seguidas a conta fica bloqueada por MINUTOS_BLOQUEIO. A tentativa é
 * contada (incremento atômico) antes de conferir a senha: várias tentativas
 * simultâneas não conseguem testar mais de MAX_TENTATIVAS senhas.
 */
export async function entrar(email: string, senha: string): Promise<ResultadoLogin> {
  const usuario = await prisma.usuario.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!usuario?.senhaHash) {
    await bcrypt.compare(senha, HASH_FICTICIO);
    return "invalido";
  }
  if (usuario.bloqueadoAte && usuario.bloqueadoAte > new Date()) return "bloqueado";

  const { tentativasFalhas } = await prisma.usuario.update({
    where: { id: usuario.id },
    data: { tentativasFalhas: { increment: 1 } },
    select: { tentativasFalhas: true },
  });
  const bloquear = () =>
    prisma.usuario.update({
      where: { id: usuario.id },
      data: { tentativasFalhas: 0, bloqueadoAte: new Date(Date.now() + MINUTOS_BLOQUEIO * 60_000) },
    });
  if (tentativasFalhas > MAX_TENTATIVAS) {
    await bloquear();
    return "bloqueado";
  }
  if (!(await bcrypt.compare(senha, usuario.senhaHash))) {
    if (tentativasFalhas >= MAX_TENTATIVAS) {
      await bloquear();
      return "bloqueado";
    }
    return "invalido";
  }

  await prisma.usuario.update({ where: { id: usuario.id }, data: { tentativasFalhas: 0, bloqueadoAte: null } });
  await abrirSessao(usuario.id, usuario.sessaoVersao);
  return "ok";
}

async function abrirSessao(usuarioId: string, versao: number) {
  (await cookies()).set(COOKIE_SESSAO, await assinarSessao(usuarioId, versao), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_SESSAO_SEGUNDOS,
  });
}

export const TAMANHO_MINIMO_SENHA = 10;
const HORAS_VALIDADE_CONVITE = 72;

const sha256 = (texto: string) => createHash("sha256").update(texto).digest("hex");

/**
 * Convite de primeiro acesso, gerado por um sócio já logado. Devolve o token
 * (vai no link e não é guardado); o banco fica só com o hash. Recusa e-mail
 * que já tem senha.
 */
export async function criarConvite(nome: string, email: string, convidadoPor: string): Promise<string | null> {
  const emailNormal = email.trim().toLowerCase();
  const existente = await prisma.usuario.findUnique({ where: { email: emailNormal } });
  if (existente?.senhaHash) return null;
  const token = randomBytes(32).toString("base64url");
  const convite = { conviteHash: sha256(token), conviteExpiraEm: new Date(Date.now() + HORAS_VALIDADE_CONVITE * 3_600_000) };
  const usuario = await prisma.usuario.upsert({
    where: { email: emailNormal },
    create: { nome: nome.trim(), email: emailNormal, ...convite },
    update: { nome: nome.trim(), ...convite },
  });
  await prisma.registroAuditoria.create({
    data: { usuarioId: convidadoPor, entidade: "Usuario", entidadeId: usuario.id, acao: "CONVIDAR", depois: { nome: usuario.nome, email: emailNormal } },
  });
  return token;
}

/**
 * Primeiro acesso pelo link de convite: grava a senha e abre a sessão. A troca
 * é atômica (convite válido, não expirado e usuário ainda sem senha), então o
 * link só funciona uma vez.
 */
export async function definirPrimeiraSenha(token: string, senha: string): Promise<boolean> {
  const conviteHash = sha256(token);
  const usuario = await prisma.usuario.findUnique({ where: { conviteHash } });
  if (!usuario) return false;
  const { count } = await prisma.usuario.updateMany({
    where: { id: usuario.id, conviteHash, conviteExpiraEm: { gt: new Date() }, senhaHash: null },
    data: { senhaHash: await hashSenha(senha), conviteHash: null, conviteExpiraEm: null, tentativasFalhas: 0, bloqueadoAte: null },
  });
  if (count !== 1) return false;
  await prisma.registroAuditoria.create({
    data: { usuarioId: usuario.id, entidade: "Usuario", entidadeId: usuario.id, acao: "DEFINIR_SENHA" },
  });
  await abrirSessao(usuario.id, usuario.sessaoVersao);
  return true;
}

export async function sair() {
  (await cookies()).delete(COOKIE_SESSAO);
}

/** Derruba todas as sessões do usuário (outros celulares e computadores) e sai deste. */
export async function sairDeTodos() {
  const sessao = await verificarSessao((await cookies()).get(COOKIE_SESSAO)?.value);
  if (sessao) {
    await prisma.usuario.updateMany({ where: { id: sessao.usuarioId }, data: { sessaoVersao: { increment: 1 } } });
    await prisma.registroAuditoria.create({ data: { usuarioId: sessao.usuarioId, entidade: "Usuario", entidadeId: sessao.usuarioId, acao: "SAIR_DE_TODOS" } });
  }
  await sair();
}
