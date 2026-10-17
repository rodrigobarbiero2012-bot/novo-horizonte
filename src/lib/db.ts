import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Em produção o banco é Neon, acessado pelo driver serverless (WebSocket na
// porta 443) — a rede do escritório bloqueia a porta 5432. Em desenvolvimento
// local (`npx prisma dev`) o banco é um Postgres em localhost, via driver pg.
neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL não configurada — aponte para o banco Postgres.");
  }
  const adapter = new URL(url).hostname.endsWith("neon.tech")
    ? new PrismaNeon({ connectionString: url })
    : // `prisma dev` aceita uma conexão por vez; consultas em paralelo ficam na fila.
      new PrismaPg({ connectionString: url, max: 1 });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
