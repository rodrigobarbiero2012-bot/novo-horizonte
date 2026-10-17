// Cadastra um sócio e libera o primeiro acesso.
//
//   npm run criar-usuario -- --nome "Rodrigo" --email rodrigo@exemplo.com
//
// Sem --senha, o usuário fica sem senha e a define ele mesmo em /primeiro-acesso.
// Rodar de novo para um e-mail existente zera a senha (libera um novo primeiro
// acesso). Com --senha, já grava a senha informada (usado para o usuário de
// teste local).
import { parseArgs } from "node:util";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";

const { values } = parseArgs({ options: { nome: { type: "string" }, email: { type: "string" }, senha: { type: "string" } } });

async function main() {
  if (!values.nome || !values.email) {
    console.error('Uso: npm run criar-usuario -- --nome "Nome" --email email@dominio [--senha ...]');
    process.exit(1);
  }
  const email = values.email.trim().toLowerCase();
  if (values.senha !== undefined && values.senha.length < 10) throw new Error("Senha precisa de pelo menos 10 caracteres.");
  const senhaHash = values.senha ? await bcrypt.hash(values.senha, 12) : null;
  const usuario = await prisma.usuario.upsert({
    where: { email },
    create: { nome: values.nome, email, senhaHash },
    update: { nome: values.nome, senhaHash, tentativasFalhas: 0, bloqueadoAte: null },
  });
  console.log(`Usuário pronto: ${usuario.nome} <${usuario.email}>`);
  if (!senhaHash) console.log("Sem senha: ele define a própria senha em /primeiro-acesso.");
}

main().finally(() => prisma.$disconnect());
