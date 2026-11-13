// Cookie assinado do modo visitante. Usado no proxy (antes da página) e no servidor; não depende de Node.
export const COOKIE_VISITANTE = "delta_visitante";
export const DURACAO_VISITANTE_S = 8 * 60 * 60;
export const EMAIL_VISITANTE = "visitante@delta-gestao.app";

const enc = new TextEncoder();

/**
 * Segredo que assina o cookie: a chave secreta do servidor. Só nos testes locais (DELTA_TESTE_LOCAL=1, que não existe
 * na Vercel) vale um segredo de teste, porque a chave secreta não fica no computador de desenvolvimento.
 */
export function segredoDoVisitante(): string | undefined {
  if (process.env.SUPABASE_SECRET_KEY) return process.env.SUPABASE_SECRET_KEY;
  return process.env.DELTA_TESTE_LOCAL === "1" ? process.env.VISITANTE_SEGREDO_TESTE : undefined;
}

async function chave(segredo: string) {
  return crypto.subtle.importKey("raw", enc.encode(`delta-visitante:${segredo}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function b64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** "v1.<expira>.<assinatura>" */
export async function assinarVisitante(segredo: string, agoraMs: number): Promise<string> {
  const msg = `v1.${Math.floor(agoraMs / 1000) + DURACAO_VISITANTE_S}`;
  return `${msg}.${b64url(await crypto.subtle.sign("HMAC", await chave(segredo), enc.encode(msg)))}`;
}

export async function visitanteValido(valor: string | undefined, segredo: string | undefined, agoraMs: number): Promise<boolean> {
  if (!valor || !segredo) return false;
  const partes = valor.split(".");
  if (partes.length !== 3 || partes[0] !== "v1") return false;
  const exp = Number(partes[1]);
  if (!Number.isFinite(exp) || exp * 1000 < agoraMs) return false;
  const esperado = b64url(await crypto.subtle.sign("HMAC", await chave(segredo), enc.encode(`v1.${partes[1]}`)));
  if (esperado.length !== partes[2].length) return false;
  let dif = 0;
  for (let i = 0; i < esperado.length; i++) dif |= esperado.charCodeAt(i) ^ partes[2].charCodeAt(i);
  return dif === 0;
}
