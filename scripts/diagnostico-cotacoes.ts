// Mostra a última execução das cotações e a data mais recente de cada produto (só leitura).
//
//   npx tsx --env-file=.env.producao scripts/diagnostico-cotacoes.ts
import { prisma } from "../src/lib/db";

async function main() {
  const ultima = await prisma.configuracao.findUnique({ where: { chave: "cotacoes.ultimaExecucao" } });
  console.log(JSON.stringify(ultima?.valor, null, 2));
  const ultimas = await prisma.cotacao.groupBy({ by: ["produto"], _max: { data: true } });
  for (const u of ultimas) console.log(u.produto, u._max.data?.toISOString().slice(0, 10));
}

main().finally(() => prisma.$disconnect());
