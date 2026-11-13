import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { pode, type Acesso, type Permissao } from "@/lib/permissoes";
import { ehVisitante } from "@/lib/visitante";
import { precisaTrocarSenha } from "@/lib/senha-flag";

export type Sessao = {
  authId: string;
  trocarSenha: boolean;
  acesso: Acesso | null;
};

/** Lê a sessão uma vez por requisição. O token é validado pelo Supabase (getClaims). */
export const obterSessao = cache(async (): Promise<Sessao | null> => {
  const supabase = await criarClienteServidor();
  if (await ehVisitante()) {
    const { data: acesso } = await supabase.rpc("meu_acesso");
    return { authId: "visitante", trocarSenha: false, acesso: (acesso as Acesso | null) ?? null };
  }
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;

  const { data: acesso } = await supabase.rpc("meu_acesso");
  return {
    authId: data.claims.sub,
    trocarSenha: precisaTrocarSenha(data.claims as Parameters<typeof precisaTrocarSenha>[0]),
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
/** Basta ter uma das permissões (ex.: a página do pedido serve ao atendimento, à cozinha e ao financeiro). */
export async function exigirAlguma(permissoes: Permissao[]): Promise<Acesso> {
  const acesso = await exigirAcesso();
  if (!permissoes.some((p) => pode(acesso, p))) await negar(permissoes.join(" ou "));
  return acesso;
}

export async function exigirPermissao(permissao: Permissao): Promise<Acesso> {
  const acesso = await exigirAcesso();
  if (!pode(acesso, permissao)) await negar(permissao);
  return acesso;
}

/** Registra a tentativa na auditoria (quem, o quê, quando) e manda para a tela de sem permissão. */
async function negar(recurso: string): Promise<never> {
  try {
    const supabase = await criarClienteServidor();
    await supabase.rpc("registrar_acesso_negado", { p_recurso: recurso });
  } catch {
    // registrar não pode impedir a negação
  }
  redirect("/sem-permissao");
}
