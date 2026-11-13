"use server";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";
import { COOKIE_VISITANTE } from "@/lib/visitante-cookie";

export type EstadoConvite = { erro?: string };

const hashDe = (token: string) => createHash("sha256").update(token).digest("hex");

/** Regras mínimas da senha (o Supabase confere de novo). */
export async function validarSenha(senha: string, email: string): Promise<string | null> {
  if (senha.length < 10) return "Use ao menos 10 caracteres.";
  if (!/[a-zA-Z]/.test(senha) || !/\d/.test(senha)) return "Misture letras e números.";
  if (senha.toLowerCase().includes(email.split("@")[0].toLowerCase())) return "Não use o seu e-mail na senha.";
  return null;
}

export async function aceitarConvite(_: EstadoConvite, form: FormData): Promise<EstadoConvite> {
  const token = String(form.get("token") ?? "");
  const senha = String(form.get("senha") ?? "");
  const confirmacao = String(form.get("confirmacao") ?? "");
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return { erro: "Link inválido." };
  if (senha !== confirmacao) return { erro: "As duas senhas não são iguais." };

  const admin = criarClienteAdmin();
  const { data: previa } = await admin.rpc("conferir_convite", { p_hash: hashDe(token) });
  const p = previa as { ok: boolean; email?: string } | null;
  if (!p?.ok || !p.email) return { erro: "Este link não vale mais. Peça um novo à administração." };
  const problema = await validarSenha(senha, p.email);
  if (problema) return { erro: problema };

  // Consome o link numa operação só (dois cliques no mesmo link não passam).
  const { data, error } = await admin.rpc("consumir_convite", { p_hash: hashDe(token) });
  const c = data as { ok: boolean; email: string; auth_user_id: string | null } | null;
  if (error || !c?.ok) return { erro: "Este link não vale mais. Peça um novo à administração." };

  const r = c.auth_user_id
    ? await admin.auth.admin.updateUserById(c.auth_user_id, { password: senha, user_metadata: { trocar_senha: false } })
    : await admin.auth.admin.createUser({ email: c.email, password: senha, email_confirm: true, user_metadata: { trocar_senha: false } });
  if (r.error) {
    const fraca = /weak|pwned|leaked|password/i.test(r.error.message);
    return { erro: fraca ? "Essa senha é fraca ou já apareceu em vazamentos. Escolha outra e peça um novo link." : "Não foi possível criar o acesso. Peça um novo link à administração." };
  }

  (await cookies()).delete(COOKIE_VISITANTE);
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  const { error: e2 } = await supabase.auth.signInWithPassword({ email: c.email, password: senha });
  if (e2) redirect("/entrar?motivo=senha-trocada");
  redirect("/");
}
