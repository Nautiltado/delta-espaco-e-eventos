import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { pode, type Acesso, type Permissao } from "@/lib/permissoes";

export type Sessao = {
  authId: string;
  trocarSenha: boolean;
  acesso: Acesso | null;
};

/** Lê a sessão uma vez por requisição. O token é validado pelo Supabase (getClaims). */
export const obterSessao = cache(async (): Promise<Sessao | null> => {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;

  const { data: acesso } = await supabase.rpc("meu_acesso");
  const metadados = (data.claims.user_metadata ?? {}) as { trocar_senha?: boolean };
  return {
    authId: data.claims.sub,
    trocarSenha: metadados.trocar_senha === true,
    acesso: (acesso as Acesso | null) ?? null,
  };
});

/** Exige login válido de um usuário ativo. Redireciona caso contrário. */
export async function exigirAcesso(): Promise<Acesso> {
  const sessao = await obterSessao();
  if (!sessao) redirect("/entrar");
  if (!sessao.acesso) redirect("/entrar?motivo=sem-acesso");
  if (sessao.trocarSenha) redirect("/trocar-senha");
  return sessao.acesso;
}

/** Exige uma permissão. Usado em páginas e em toda ação do servidor. */
export async function exigirPermissao(permissao: Permissao): Promise<Acesso> {
  const acesso = await exigirAcesso();
  if (!pode(acesso, permissao)) redirect("/sem-permissao");
  return acesso;
}
