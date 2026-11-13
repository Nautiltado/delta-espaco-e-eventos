"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { cookies } from "next/headers";
import { criarClienteServidor } from "@/lib/supabase/server";
import { assinarVisitante, COOKIE_VISITANTE, DURACAO_VISITANTE_S, segredoDoVisitante } from "@/lib/visitante-cookie";
import { visitanteLigado } from "@/lib/visitante";
import { chave, consumir, ipDaRequisicao, limpar, mensagemDeEspera, REGRAS } from "@/lib/limite";
import { MENSAGEM_ROBO, pareceRobo } from "@/lib/robo";
import { precisaTrocarSenha } from "@/lib/senha-flag";
import { exigeDuasEtapas } from "@/lib/duas-etapas";

export type EstadoEntrada = { erro?: string; email?: string };

const esquema = z.object({
  email: z.email("E-mail inválido").transform((e) => e.trim().toLowerCase()),
  senha: z.string().min(1, "Informe a senha"),
});

export async function entrar(_: EstadoEntrada, form: FormData): Promise<EstadoEntrada> {
  (await cookies()).delete(COOKIE_VISITANTE);
  const dados = esquema.safeParse({ email: form.get("email"), senha: form.get("senha") });
  const email = String(form.get("email") ?? "");
  if (!dados.success) return { erro: dados.error.issues[0].message, email };
  if (await pareceRobo()) return { erro: MENSAGEM_ROBO, email };

  // Limite por endereço de internet e por e-mail: barra quem fica chutando senhas.
  const kIp = chave("login:ip", await ipDaRequisicao());
  const kEmail = chave("login:email", dados.data.email);
  const espera = Math.max(await consumir(kIp, REGRAS.loginPorIp), await consumir(kEmail, REGRAS.loginPorEmail));
  if (espera > 0) return { erro: mensagemDeEspera(espera), email };

  const supabase = await criarClienteServidor();
  const { data: login, error } = await supabase.auth.signInWithPassword({
    email: dados.data.email,
    password: dados.data.senha,
  });
  // Mensagem única para e-mail ou senha errados: não revela quais e-mails existem.
  if (error) {
    const credenciais = error.code === "invalid_credentials" || error.status === 400;
    return {
      erro: credenciais
        ? "E-mail ou senha incorretos."
        : "Não foi possível conectar ao servidor de login. Tente de novo em instantes.",
      email,
    };
  }

  await limpar(kEmail);
  const { data: acesso } = await supabase.rpc("meu_acesso");
  if (!acesso) {
    await supabase.auth.signOut();
    return { erro: "Seu acesso está desativado. Fale com um administrador.", email };
  }
  if (precisaTrocarSenha(login.user)) redirect("/trocar-senha");
  const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (nivel?.nextLevel === "aal2") redirect("/entrar/codigo");
  if (exigeDuasEtapas((acesso as { perfis?: string[] }).perfis ?? [])) redirect("/seguranca/duas-etapas");
  redirect("/");
}

export async function sair() {
  const jar = await cookies();
  if (jar.get(COOKIE_VISITANTE)) {
    jar.delete(COOKIE_VISITANTE);
    redirect("/entrar");
  }
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/entrar");
}

/** Visitante: só leitura, sem login. Fecha qualquer sessão aberta e entra com o cookie assinado. */
export async function entrarComoVisitante(): Promise<void> {
  if (!(await visitanteLigado())) redirect("/entrar?motivo=visitante-desligado");
  if (await pareceRobo()) redirect("/entrar?motivo=robo");
  if (await consumir(chave("visitante:ip", await ipDaRequisicao()), REGRAS.visitantePorIp)) redirect("/entrar?motivo=muitas-tentativas");
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  (await cookies()).set(COOKIE_VISITANTE, await assinarVisitante(segredoDoVisitante()!, Date.now()), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: DURACAO_VISITANTE_S,
  });
  redirect("/");
}
