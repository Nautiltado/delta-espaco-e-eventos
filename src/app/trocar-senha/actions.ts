"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterSessao } from "@/lib/acesso";

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
  await supabase.auth.signOut();
  redirect("/entrar?motivo=senha-trocada");
}
