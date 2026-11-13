import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { criarClienteAdmin } from "@/lib/supabase/admin";

/**
 * Limite de tentativas (login, convite, visitante, troca de senha), contado no banco.
 * As chaves guardam só um resumo cifrado do IP ou do e-mail, nunca o valor em texto.
 */
export type Regra = { maximo: number; janelaS: number; castigoS: number };

export const REGRAS = {
  loginPorIp: { maximo: 20, janelaS: 600, castigoS: 900 },
  loginPorEmail: { maximo: 6, janelaS: 900, castigoS: 900 },
  visitantePorIp: { maximo: 10, janelaS: 600, castigoS: 600 },
  convitePorIp: { maximo: 10, janelaS: 900, castigoS: 900 },
  trocaSenhaPorUsuario: { maximo: 6, janelaS: 900, castigoS: 900 },
  codigoPorUsuario: { maximo: 6, janelaS: 900, castigoS: 900 },
} satisfies Record<string, Regra>;

/** IP de quem fez a requisição (na Vercel vem de cabeçalho que ela mesma preenche). */
export async function ipDaRequisicao(): Promise<string> {
  const h = await headers();
  return (h.get("x-vercel-forwarded-for") ?? h.get("x-real-ip") ?? h.get("x-forwarded-for") ?? "local").split(",")[0].trim();
}

function resumo(valor: string): string {
  const segredo = process.env.SUPABASE_SECRET_KEY || "delta-local";
  return createHmac("sha256", segredo).update(valor.toLowerCase()).digest("base64url").slice(0, 32);
}

export const chave = (tipo: string, valor: string) => `${tipo}:${resumo(valor)}`;

/**
 * Conta uma tentativa. Devolve os segundos de espera (0 = pode seguir).
 * Sem a chave secreta (só no computador de testes) ou com o banco fora do ar, deixa passar:
 * melhor não trancar a equipe por falha do contador. O Supabase tem o próprio limite de login.
 */
export async function consumir(k: string, r: Regra): Promise<number> {
  if (!process.env.SUPABASE_SECRET_KEY) return 0;
  try {
    const { data, error } = await criarClienteAdmin().rpc("consumir_tentativa", {
      p_chave: k, p_maximo: r.maximo, p_janela_s: r.janelaS, p_castigo_s: r.castigoS,
    });
    if (error) { console.error("[limite]", error.message); return 0; }
    return Number(data) || 0;
  } catch (e) {
    console.error("[limite]", e);
    return 0;
  }
}

export async function limpar(k: string): Promise<void> {
  if (!process.env.SUPABASE_SECRET_KEY) return;
  try { await criarClienteAdmin().rpc("limpar_tentativas", { p_chave: k }); } catch { /* sem problema */ }
}

export function mensagemDeEspera(segundos: number): string {
  const min = Math.max(1, Math.ceil(segundos / 60));
  return `Muitas tentativas seguidas. Por segurança, espere ${min} ${min === 1 ? "minuto" : "minutos"} e tente de novo.`;
}
