"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";

export type EstadoEntrada = { erro?: string; email?: string };

const esquema = z.object({
  email: z.email("E-mail inválido").transform((e) => e.trim().toLowerCase()),
  senha: z.string().min(1, "Informe a senha"),
});

export async function entrar(_: EstadoEntrada, form: FormData): Promise<EstadoEntrada> {
  const dados = esquema.safeParse({ email: form.get("email"), senha: form.get("senha") });
  const email = String(form.get("email") ?? "");
  if (!dados.success) return { erro: dados.error.issues[0].message, email };

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email: dados.data.email,
    password: dados.data.senha,
  });
  // Mensagem única para e-mail ou senha errados: não revela quais e-mails existem.
  if (error) return { erro: "E-mail ou senha incorretos.", email };

  const { data: acesso } = await supabase.rpc("meu_acesso");
  if (!acesso) {
    await supabase.auth.signOut();
    return { erro: "Seu acesso está desativado. Fale com um administrador.", email };
  }
  redirect("/");
}

export async function sair() {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/entrar");
}
