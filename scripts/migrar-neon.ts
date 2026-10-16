// Aplica as migrações de prisma/migrations no Neon pela porta 443 (WebSocket).
//
//   npx tsx --env-file=.env.producao scripts/migrar-neon.ts
//
// Por quê: a rede do escritório bloqueia a porta 5432, então `prisma migrate
// deploy` não alcança o Neon. Este script faz o mesmo trabalho pelo driver
// serverless e registra cada migração em _prisma_migrations do mesmo jeito que
// o Prisma (checksum = sha256 do migration.sql), para que um `migrate deploy`
// rodado de outra rede (ex.: na Vercel) enxergue o banco como em dia.
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const url = process.env.DATABASE_URL;
if (!url || !new URL(url).hostname.endsWith("neon.tech")) {
  console.error("DATABASE_URL precisa apontar para o Neon (rode com --env-file=.env.producao).");
  process.exit(1);
}

const pasta = path.join(process.cwd(), "prisma", "migrations");
const pool = new Pool({ connectionString: url });

async function main() {
  await pool.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) PRIMARY KEY NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
  )`);
  const { rows } = await pool.query(`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`);
  const aplicadas = new Set(rows.map((r) => r.migration_name));

  const migracoes = fs.readdirSync(pasta, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  for (const nome of migracoes) {
    if (aplicadas.has(nome)) {
      console.log(`  já aplicada: ${nome}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(pasta, nome, "migration.sql"), "utf-8");
    const cliente = await pool.connect();
    try {
      await cliente.query("BEGIN");
      await cliente.query(sql);
      await cliente.query(
        `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, applied_steps_count) VALUES ($1, $2, now(), $3, 1)`,
        [randomUUID(), createHash("sha256").update(sql).digest("hex"), nome],
      );
      await cliente.query("COMMIT");
      console.log(`✔ aplicada: ${nome}`);
    } catch (e) {
      await cliente.query("ROLLBACK");
      throw e;
    } finally {
      cliente.release();
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
