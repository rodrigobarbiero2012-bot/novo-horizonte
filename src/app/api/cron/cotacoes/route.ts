import { atualizarCotacoes } from "@/lib/cotacoes/atualizar";

// Chamado uma vez por dia pelo Cron da Vercel (vercel.json). A Vercel envia
// "Authorization: Bearer <CRON_SECRET>"; sem o segredo certo a rota recusa.
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return new Response("Não autorizado", { status: 401 });
  }
  const resultado = await atualizarCotacoes();
  console.log("cotações:", JSON.stringify(resultado));
  const falhou = Object.values(resultado).some((r) => "erro" in r);
  return Response.json(resultado, { status: falhou ? 207 : 200 });
}
