import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { pode, type Acesso, type Permissao } from "@/lib/permissoes";
import { ehVisitante } from "@/lib/visitante";
import { precisaTrocarSenha } from "@/lib/senha-flag";
import { exigeDuasEtapas } from "@/lib/duas-etapas";

export type Sessao = {
  authId: string;
  trocarSenha: boolean;
  acesso: Acesso | null;
  /** aal2 = entrou com senha e com o código do app autenticador */
  nivel: "aal1" | "aal2";
  /** já tem app autenticador cadastrado */
  temDuasEtapas: boolean;
};

/** Lê a sessão uma vez por requisição. O token é validado pelo Supabase (getClaims). */
export const obterSessao = cache(async (): Promise<Sessao | null> => {
  const supabase = await criarClienteServidor();
  if (await ehVisitante()) {
    const { data: acesso } = await supabase.rpc("meu_acesso");
    return { authId: "visitante", trocarSenha: false, acesso: (acesso as Acesso | null) ?? null, nivel: "aal1", temDuasEtapas: false };
  }
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;

  const [{ data: acesso }, { data: nivel }] = await Promise.all([
    supabase.rpc("meu_acesso"),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  return {
    nivel: nivel?.currentLevel === "aal2" ? "aal2" : "aal1",
    temDuasEtapas: nivel?.nextLevel === "aal2",
    authId: data.claims.sub,
    trocarSenha: precisaTrocarSenha(data.claims as Parameters<typeof precisaTrocarSenha>[0]),
    acesso: (acesso as Acesso | null) ?? null,
  };
});

/**
 * Para rotas (PDF, dados da agenda): a sessão está completa? Login, acesso ativo, senha já trocada
 * e, quando exigido, o código do app autenticador. As páginas usam exigirAcesso, que redireciona.
 */
export function sessaoCompleta(sessao: Sessao | null): sessao is Sessao & { acesso: Acesso } {
  if (!sessao?.acesso || sessao.trocarSenha) return false;
  if (sessao.authId === "visitante") return true;
  if (sessao.temDuasEtapas && sessao.nivel !== "aal2") return false;
  if (!sessao.temDuasEtapas && exigeDuasEtapas(sessao.acesso.perfis)) return false;
  return true;
}

/** Exige login válido de um usuário ativo. Redireciona caso contrário. */
export async function exigirAcesso(): Promise<Acesso> {
  const sessao = await obterSessao();
  if (!sessao) redirect("/entrar");
  if (!sessao.acesso) redirect("/entrar?motivo=sem-acesso");
  if (sessao.trocarSenha) redirect("/trocar-senha");
  if (sessao.authId !== "visitante") {
    // quem tem o app autenticador sempre confirma o código; Administração e Financeiro são obrigados a ter
    if (sessao.temDuasEtapas && sessao.nivel !== "aal2") redirect("/entrar/codigo");
    if (!sessao.temDuasEtapas && exigeDuasEtapas(sessao.acesso.perfis)) redirect("/seguranca/duas-etapas");
  }
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
