// Busca as cotações agora (o mesmo que o cron diário faz).
//
//   npm run cotacoes              # banco local
//   npm run producao:cotacoes     # Neon
import { prisma } from "../src/lib/db";
import { atualizarCotacoes } from "../src/lib/cotacoes/atualizar";

atualizarCotacoes()
  .then((r) => {
    console.log(r);
    if (Object.values(r).some((x) => "erro" in x)) process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
