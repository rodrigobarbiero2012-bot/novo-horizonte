import { hojeSP } from "@/lib/hoje";
import { enviarLembrete } from "@/lib/lembretes/enviar";

export const maxDuration = 60;

// Chamado todo dia às 7h de Brasília pelo Cron da Vercel (vercel.json), com
// "Authorization: Bearer <CRON_SECRET>". Na segunda manda o resumo da semana;
// nos outros dias, só se houver conta vencida/vencendo ou documento a conferir.
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return new Response("Não autorizado", { status: 401 });
  }
  const segunda = new Date(`${hojeSP()}T12:00:00Z`).getUTCDay() === 1;
  try {
    const r = await enviarLembrete({ semanal: segunda });
    console.log("lembretes:", JSON.stringify(r));
    return Response.json(r);
  } catch (e) {
    console.error("lembretes: falha no envio", e);
    return Response.json({ enviado: false, motivo: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
