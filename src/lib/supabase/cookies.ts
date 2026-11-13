import type { CookieOptions } from "@supabase/ssr";

/**
 * Cookies da sessão: httpOnly (código no navegador não lê o token, nem um script malicioso),
 * seguros em produção (só HTTPS) e sem viajar em requisições de outros sites (sameSite lax).
 * O navegador não precisa da sessão: todo acesso aos dados passa pelo servidor.
 */
export function protegerCookie(options: CookieOptions = {}): CookieOptions {
  return { ...options, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: options.path ?? "/" };
}
