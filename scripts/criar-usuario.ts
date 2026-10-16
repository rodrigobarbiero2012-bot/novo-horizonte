// Cria (ou redefine a senha de) um sócio.
//
//   npm run criar-usuario -- --nome "Rodrigo Machado" --email rodrigo@exemplo.com
//
// Sem --senha, gera uma senha forte e mostra uma única vez no terminal.
import { randomBytes } from "node:crypto";
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
  const senha = values.senha ?? randomBytes(12).toString("base64url");
  if (senha.length < 10) throw new Error("Senha precisa de pelo menos 10 caracteres.");
  const senhaHash = await bcrypt.hash(senha, 12);
  const usuario = await prisma.usuario.upsert({
    where: { email },
    create: { nome: values.nome, email, senhaHash },
    update: { nome: values.nome, senhaHash, tentativasFalhas: 0, bloqueadoAte: null },
  });
  console.log(`Usuário pronto: ${usuario.nome} <${usuario.email}>`);
  if (!values.senha) console.log(`Senha gerada (anote agora, não será mostrada de novo): ${senha}`);
}

main().finally(() => prisma.$disconnect());
