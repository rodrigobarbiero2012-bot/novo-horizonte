import path from "node:path";
import fs from "node:fs";
import { defineConfig, env } from "prisma/config";

if (fs.existsSync(".env")) {
  process.loadEnvFile(".env");
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: env("DATABASE_URL"),
  },
});
