import "server-only";
import { checkBotId } from "botid/server";

/**
 * Proteção contra robôs (Vercel BotID, nível básico e gratuito): um desafio invisível no navegador,
 * conferido aqui no servidor. Só vale na Vercel; no computador de testes sempre deixa passar.
 * As rotas protegidas estão em instrumentation-client.ts.
 */
export async function pareceRobo(): Promise<boolean> {
  if (!process.env.VERCEL) return false;
  try {
    const r = await checkBotId();
    const robo = r.isBot && !r.isVerifiedBot;
    // Por ora só registra (modo observação): bloquear só depois de confirmar que pessoas reais passam.
    if (robo) console.warn("[botid] requisição marcada como robô", JSON.stringify(r).slice(0, 300));
    return robo && process.env.BOTID_BLOQUEAR === "1";
  } catch (e) {
    console.error("[botid]", e);
    return false;
  }
}

export const MENSAGEM_ROBO = "Não conseguimos confirmar que é uma pessoa usando o navegador. Atualize a página e tente de novo.";
