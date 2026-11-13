"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterSessao } from "@/lib/acesso";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { chave, consumir, mensagemDeEspera, REGRAS } from "@/lib/limite";

import { regraSenha } from "@/lib/senha";

export type EstadoTroca = { erro?: string };

const esquema = z
  .object({ senha: regraSenha, confirmacao: z.string() })
  .refine((d) => d.senha === d.confirmacao, { message: "As senhas não conferem" });

export async function trocarSenha(_: EstadoTroca, form: FormData): Promise<EstadoTroca> {
  const sessao = await obterSessao();
  if (!sessao) redirect("/entrar");

  const dados = esquema.safeParse({ senha: form.get("senha"), confirmacao: form.get("confirmacao") });
  if (!dados.success) return { erro: dados.error.issues[0].message };

  const espera = await consumir(chave("troca:usuario", sessao.authId), REGRAS.trocaSenhaPorUsuario);
  if (espera > 0) return { erro: mensagemDeEspera(espera) };

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.updateUser({
    password: dados.data.senha,
    data: { trocar_senha: false },
  });
  if (error) {
    return {
      erro:
        error.code === "same_password"
          ? "A senha nova precisa ser diferente da atual."
          : "Não foi possível trocar a senha. Tente de novo.",
    };
  }
  // desliga a exigência no lugar que só o servidor altera
  if (process.env.SUPABASE_SECRET_KEY) {
    await criarClienteAdmin().auth.admin.updateUserById(sessao.authId, { app_metadata: { trocar_senha: false } });
  }
  await supabase.auth.signOut();
  redirect("/entrar?motivo=senha-trocada");
}
