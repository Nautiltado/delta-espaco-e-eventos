"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { obterSessao } from "@/lib/acesso";
import { criarClienteServidor } from "@/lib/supabase/server";
import { chave, consumir, limpar, mensagemDeEspera, REGRAS } from "@/lib/limite";

export type EstadoCodigo = { erro?: string };

/** Segunda etapa do login: o código de 6 números do app autenticador. */
export async function verificarCodigo(_: EstadoCodigo, form: FormData): Promise<EstadoCodigo> {
  const sessao = await obterSessao();
  if (!sessao) redirect("/entrar");
  const c = z.string().trim().regex(/^\d{6}$/).safeParse(form.get("codigo"));
  if (!c.success) return { erro: "O código tem 6 números." };
  const k = chave("codigo:usuario", sessao.authId);
  const espera = await consumir(k, REGRAS.codigoPorUsuario);
  if (espera > 0) return { erro: mensagemDeEspera(espera) };
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.mfa.listFactors();
  const fator = data?.totp?.[0];
  if (!fator) redirect("/seguranca/duas-etapas");
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fator.id, code: c.data });
  if (error) return { erro: "Código errado ou vencido. Confira a hora do celular e digite o código que aparece agora." };
  await limpar(k);
  redirect("/");
}
