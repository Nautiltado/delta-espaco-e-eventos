import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { env } from "@/lib/env";
import { protegerCookie } from "@/lib/supabase/cookies";
import { clienteDoVisitante, ehVisitante } from "@/lib/visitante";

/**
 * Cliente com a sessão do usuário logado. Tudo o que ele faz passa pelas
 * políticas de acesso (RLS) do banco: a tela não decide permissão sozinha.
 */
export async function criarClienteServidor() {
  // Sempre por requisição: a biblioteca usa o relógio para validar o token.
  await connection();
  // Modo visitante: consultas feitas pelo servidor, só leitura e com dados pessoais e valores ocultos.
  if (await ehVisitante()) return clienteDoVisitante() as unknown as ReturnType<typeof criarClienteDeUsuario>;
  return criarClienteDeUsuario(await cookies());
}

function criarClienteDeUsuario(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, protegerCookie(options)),
          );
        } catch {
          // Chamado de um Server Component: o proxy renova a sessão.
        }
      },
    },
  });
}
