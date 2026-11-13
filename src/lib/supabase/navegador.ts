"use client";

import { createClient } from "@supabase/supabase-js";

/**
 * Cliente do navegador SEM sessão: serve só para enviar arquivos com o link assinado
 * que o servidor gera (uploadToSignedUrl). Ele não lê nem guarda o login: os cookies da
 * sessão são httpOnly e todo acesso a dados passa pelo servidor.
 */
export function criarClienteNavegador() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
