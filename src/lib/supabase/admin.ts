import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Cliente com a chave secreta, usado APENAS para administrar contas de login
 * (criar acesso, redefinir senha). Toda chamada a ele deve vir depois de
 * conferir a permissão config.critica do usuário logado.
 */
export function criarClienteAdmin() {
  return createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
