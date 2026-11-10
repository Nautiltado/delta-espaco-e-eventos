import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { env } from "@/lib/env";

/**
 * Cliente com a sessão do usuário logado. Tudo o que ele faz passa pelas
 * políticas de acesso (RLS) do banco: a tela não decide permissão sozinha.
 */
export async function criarClienteServidor() {
  // Sempre por requisição: a biblioteca usa o relógio para validar o token.
  await connection();
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Chamado de um Server Component: o proxy renova a sessão.
        }
      },
    },
  });
}
