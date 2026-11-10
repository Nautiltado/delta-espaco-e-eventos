"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirPermissao } from "@/lib/acesso";
import { criarClienteServidor } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { mensagemDoBanco } from "@/lib/erros";
import { NOMES_PERFIS } from "@/lib/permissoes";

export type EstadoUsuario = { erro?: string; ok?: string; senhaProvisoria?: string; para?: string };

const perfisValidos = z
  .array(z.enum(Object.keys(NOMES_PERFIS) as [string, ...string[]]))
  .min(1, "Escolha ao menos um perfil");

/** Senha provisória legível (sem 0/O, 1/l), mostrada uma única vez ao administrador. */
function gerarSenhaProvisoria(): string {
  const letras = "abcdefghjkmnpqrstuvwxyz";
  const numeros = "23456789";
  const bloco = (n: number) =>
    Array.from({ length: n }, () => letras[randomInt(letras.length)]).join("");
  return `${bloco(4)}-${bloco(4)}-${numeros[randomInt(8)]}${numeros[randomInt(8)]}${numeros[randomInt(8)]}`;
}

async function criarOuRedefinirLogin(email: string, authId: string | null) {
  const admin = criarClienteAdmin();
  const senha = gerarSenhaProvisoria();
  if (authId) {
    const { error } = await admin.auth.admin.updateUserById(authId, {
      password: senha,
      user_metadata: { trocar_senha: true },
    });
    if (error) return { erro: "Não foi possível redefinir a senha." } as const;
  } else {
    const { error } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { trocar_senha: true },
    });
    if (error) return { erro: `Cadastro salvo, mas o acesso não foi criado: ${error.message}` } as const;
  }
  return { senha } as const;
}

const esquemaNovo = z.object({
  nome: z.string().trim().min(2, "Informe o nome"),
  email: z.email("E-mail inválido").transform((e) => e.trim().toLowerCase()),
  perfis: perfisValidos,
});

export async function criarUsuario(_: EstadoUsuario, form: FormData): Promise<EstadoUsuario> {
  await exigirPermissao("config.critica");
  const dados = esquemaNovo.safeParse({
    nome: form.get("nome"),
    email: form.get("email"),
    perfis: form.getAll("perfis"),
  });
  if (!dados.success) return { erro: dados.error.issues[0].message };

  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("criar_usuario", {
    p_nome: dados.data.nome,
    p_email: dados.data.email,
    p_perfis: dados.data.perfis,
  });
  if (error) return { erro: mensagemDoBanco(error) };

  const login = await criarOuRedefinirLogin(dados.data.email, null);
  revalidatePath("/usuarios");
  if ("erro" in login) return { erro: login.erro };
  return { ok: `${dados.data.nome} cadastrado.`, senhaProvisoria: login.senha, para: dados.data.email };
}

export async function alterarPerfis(_: EstadoUsuario, form: FormData): Promise<EstadoUsuario> {
  await exigirPermissao("config.critica");
  const id = z.uuid().safeParse(form.get("id"));
  const perfis = perfisValidos.safeParse(form.getAll("perfis"));
  if (!id.success) return { erro: "Usuário inválido" };
  if (!perfis.success) return { erro: perfis.error.issues[0].message };

  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("definir_perfis", { p_usuario: id.data, p_perfis: perfis.data });
  if (error) return { erro: mensagemDoBanco(error) };
  revalidatePath("/usuarios");
  return { ok: "Perfis atualizados." };
}

export async function alternarAtivo(_: EstadoUsuario, form: FormData): Promise<EstadoUsuario> {
  const acesso = await exigirPermissao("config.critica");
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { erro: "Usuário inválido" };
  const ativar = form.get("ativar") === "1";
  if (!ativar && id.data === acesso.id) return { erro: "Você não pode desativar a sua própria conta." };

  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("usuarios")
    .update({ ativo: ativar, atualizado_em: new Date().toISOString() })
    .eq("id", id.data);
  if (error) return { erro: mensagemDoBanco(error) };
  revalidatePath("/usuarios");
  return { ok: ativar ? "Usuário reativado." : "Usuário desativado. O acesso foi cortado na hora." };
}

export async function redefinirSenha(_: EstadoUsuario, form: FormData): Promise<EstadoUsuario> {
  await exigirPermissao("config.critica");
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { erro: "Usuário inválido" };

  const supabase = await criarClienteServidor();
  const { data: usuario, error } = await supabase
    .from("usuarios")
    .select("email, ativo, auth_user_id")
    .eq("id", id.data)
    .single();
  if (error || !usuario) return { erro: "Usuário não encontrado." };
  if (!usuario.ativo) return { erro: "Reative o usuário antes de gerar uma senha." };

  const login = await criarOuRedefinirLogin(usuario.email, usuario.auth_user_id);
  if ("erro" in login) return { erro: login.erro };
  revalidatePath("/usuarios");
  return { ok: "Senha provisória gerada.", senhaProvisoria: login.senha, para: usuario.email };
}
