"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { obterSessao } from "@/lib/acesso";
import { criarClienteServidor } from "@/lib/supabase/server";
import { chave, consumir, mensagemDeEspera, REGRAS } from "@/lib/limite";

export type Cadastro = { erro?: string; fatorId?: string; qr?: string; segredo?: string };
export type EstadoCodigo = { erro?: string };

const codigo = z.string().trim().regex(/^\d{6}$/, "O código tem 6 números.");

/** Gera o QR code do app autenticador (o cadastro só vale depois de digitar um código certo). */
export async function iniciarCadastro(): Promise<Cadastro> {
  const sessao = await obterSessao();
  if (!sessao?.acesso || sessao.authId === "visitante") return { erro: "Entre de novo para continuar." };
  const supabase = await criarClienteServidor();
  // cadastros começados e não terminados são descartados
  const { data: fatores } = await supabase.auth.mfa.listFactors();
  for (const f of fatores?.all ?? []) {
    if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  if ((fatores?.totp ?? []).length) return { erro: "Você já tem um app autenticador cadastrado." };
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Delta ${Date.now()}`, issuer: "Delta Gestão" });
  if (error || !data) return { erro: "Não foi possível começar o cadastro. Tente de novo." };
  return { fatorId: data.id, qr: data.totp.qr_code, segredo: data.totp.secret };
}

export async function confirmarCadastro(fatorId: string, form: FormData): Promise<EstadoCodigo> {
  const sessao = await obterSessao();
  if (!sessao?.acesso) redirect("/entrar");
  const c = codigo.safeParse(form.get("codigo"));
  if (!c.success) return { erro: c.error.issues[0].message };
  if (!z.uuid().safeParse(fatorId).success) return { erro: "Cadastro inválido. Comece de novo." };
  const espera = await consumir(chave("codigo:usuario", sessao.authId), REGRAS.codigoPorUsuario);
  if (espera > 0) return { erro: mensagemDeEspera(espera) };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fatorId, code: c.data });
  if (error) return { erro: "Código errado ou vencido. Confira a hora do celular e digite o código que aparece agora." };
  await supabase.rpc("registrar_evento_mfa", { p_usuario: sessao.acesso.id, p_acao: "MFA_ATIVADA" });
  redirect("/");
}
