"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirPermissao } from "@/lib/acesso";
import { criarClienteServidor } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { mensagemDoBanco } from "@/lib/erros";
import { NOMES_PERFIS } from "@/lib/permissoes";

export type EstadoUsuario = { erro?: string; ok?: string; link?: string; conviteId?: string; para?: string; usuarioId?: string };

const uuid = z.uuid();
const perfisValidos = z.array(z.enum(Object.keys(NOMES_PERFIS) as [string, ...string[]])).min(1, "Escolha ao menos um perfil");
const HORAS_CONVITE = 72;
const HORAS_REDEFINICAO = 24;

function recarregar() {
  revalidatePath("/usuarios");
}

async function origem(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "delta-gestao-tan.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Link de uso único. O banco guarda só o hash; o link aparece uma vez para quem gerou. */
async function gerarLink(usuarioId: string, tipo: "convite" | "redefinicao"): Promise<EstadoUsuario> {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("registrar_convite", {
    p_usuario: usuarioId, p_tipo: tipo, p_hash: hash, p_horas: tipo === "convite" ? HORAS_CONVITE : HORAS_REDEFINICAO,
  });
  if (error) return { erro: mensagemDoBanco(error) };
  return { link: `${await origem()}/convite/${token}`, conviteId: data as string };
}

// ---------------------------------------------------------------- cadastro

const dadosPessoa = z.object({
  nome: z.string().trim().min(2, "Informe o nome completo").max(120),
  telefone: z.string().trim().max(20).transform((t) => t.replace(/\D/g, "")).refine((t) => !t || /^\d{10,11}$/.test(t), "Telefone com DDD, ex.: (99) 98111-2233"),
  cargo: z.string().trim().max(80),
  inicio: z.string().trim().refine((d) => !d || /^\d{4}-\d{2}-\d{2}$/.test(d), "Data de início inválida"),
  observacoes: z.string().trim().max(1000),
});

export async function criarUsuario(_: EstadoUsuario, form: FormData): Promise<EstadoUsuario> {
  await exigirPermissao("config.critica");
  const pessoa = dadosPessoa.safeParse({
    nome: form.get("nome"), telefone: form.get("telefone") ?? "", cargo: form.get("cargo") ?? "",
    inicio: form.get("inicio") ?? "", observacoes: form.get("observacoes") ?? "",
  });
  if (!pessoa.success) return { erro: pessoa.error.issues[0].message };
  const email = z.email("E-mail inválido").safeParse(String(form.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { erro: "E-mail inválido." };
  const perfis = perfisValidos.safeParse(form.getAll("perfis"));
  if (!perfis.success) return { erro: perfis.error.issues[0].message };

  const supabase = await criarClienteServidor();
  const p = pessoa.data;
  const { data: id, error } = await supabase.rpc("criar_usuario", {
    p_nome: p.nome, p_email: email.data, p_perfis: perfis.data, p_telefone: p.telefone || null,
    p_cargo: p.cargo || null, p_inicio: p.inicio || null, p_observacoes: p.observacoes || null,
  });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar();
  const link = await gerarLink(id as string, "convite");
  if (link.erro) return { ok: `${p.nome} cadastrado, mas o convite não foi gerado: ${link.erro}`, usuarioId: id as string };
  return { ...link, ok: `${p.nome} cadastrado. Envie o convite abaixo: ele vale ${HORAS_CONVITE} horas e só pode ser usado uma vez.`, para: email.data, usuarioId: id as string };
}

export async function atualizarDados(_: EstadoUsuario, form: FormData): Promise<EstadoUsuario> {
  await exigirPermissao("config.critica");
  const id = uuid.safeParse(form.get("id"));
  if (!id.success) return { erro: "Usuário inválido." };
  const pessoa = dadosPessoa.safeParse({
    nome: form.get("nome"), telefone: form.get("telefone") ?? "", cargo: form.get("cargo") ?? "",
    inicio: form.get("inicio") ?? "", observacoes: form.get("observacoes") ?? "",
  });
  if (!pessoa.success) return { erro: pessoa.error.issues[0].message };
  const p = pessoa.data;
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("atualizar_usuario", {
    p_usuario: id.data, p_nome: p.nome, p_telefone: p.telefone || null, p_cargo: p.cargo || null, p_inicio: p.inicio || null, p_observacoes: p.observacoes || null,
  });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar();
  return { ok: "Dados salvos." };
}

export async function alterarPerfis(_: EstadoUsuario, form: FormData): Promise<EstadoUsuario> {
  await exigirPermissao("config.critica");
  const id = uuid.safeParse(form.get("id"));
  const perfis = perfisValidos.safeParse(form.getAll("perfis"));
  if (!id.success) return { erro: "Usuário inválido." };
  if (!perfis.success) return { erro: perfis.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("definir_perfis", { p_usuario: id.data, p_perfis: perfis.data });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar();
  return { ok: "Perfis salvos. As permissões valem a partir da próxima página que a pessoa abrir." };
}

// ---------------------------------------------------------------- convites, senha e sessões

export async function gerarConvite(_: EstadoUsuario, form: FormData): Promise<EstadoUsuario> {
  await exigirPermissao("config.critica");
  const id = uuid.safeParse(form.get("id"));
  if (!id.success) return { erro: "Usuário inválido." };
  const tipo = form.get("tipo") === "redefinicao" ? "redefinicao" : "convite";
  const r = await gerarLink(id.data, tipo);
  if (r.erro) return r;
  recarregar();
  return {
    ...r,
    ok: tipo === "convite"
      ? `Convite gerado. Vale ${HORAS_CONVITE} horas, uma vez só. O anterior, se havia, foi cancelado.`
      : `Link de redefinição gerado. Vale ${HORAS_REDEFINICAO} horas, uma vez só.`,
  };
}

export async function marcarConviteEnviado(conviteId: string): Promise<void> {
  await exigirPermissao("config.critica");
  if (!uuid.safeParse(conviteId).success) return;
  const supabase = await criarClienteServidor();
  await supabase.rpc("marcar_convite_enviado", { p_convite: conviteId });
  recarregar();
}

export async function revogarConvite(_: EstadoUsuario, form: FormData): Promise<EstadoUsuario> {
  await exigirPermissao("config.critica");
  const id = uuid.safeParse(form.get("id"));
  if (!id.success) return { erro: "Usuário inválido." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("revogar_convite", { p_usuario: id.data });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar();
  return { ok: "Links em aberto cancelados." };
}

export async function revogarSessoes(_: EstadoUsuario, form: FormData): Promise<EstadoUsuario> {
  const acesso = await exigirPermissao("config.critica");
  const id = uuid.safeParse(form.get("id"));
  if (!id.success) return { erro: "Usuário inválido." };
  if (id.data === acesso.id) return { erro: "Para sair dos seus aparelhos, use Sair. Encerrar aqui derrubaria esta tela também." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("revogar_sessoes", { p_usuario: id.data, p_motivo: String(form.get("motivo") ?? "").trim() || null });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar();
  return { ok: "Sessões encerradas: a pessoa precisa entrar de novo em todos os aparelhos." };
}

/** Obriga a escolher uma senha nova no próximo acesso e encerra as sessões abertas. */
export async function forcarTrocaSenha(_: EstadoUsuario, form: FormData): Promise<EstadoUsuario> {
  const acesso = await exigirPermissao("config.critica");
  const id = uuid.safeParse(form.get("id"));
  if (!id.success) return { erro: "Usuário inválido." };
  if (id.data === acesso.id) return { erro: "Troque a sua própria senha pela tela de troca de senha." };
  const supabase = await criarClienteServidor();
  const { data: u } = await supabase.from("usuarios").select("auth_user_id, ativo").eq("id", id.data).maybeSingle();
  if (!u?.ativo) return { erro: "Usuário desativado." };
  if (!u.auth_user_id) return { erro: "Esta pessoa ainda não criou a senha: envie o convite." };
  // app_metadata: só o servidor altera (a pessoa não consegue desligar a exigência sozinha)
  const { error } = await criarClienteAdmin().auth.admin.updateUserById(u.auth_user_id, { app_metadata: { trocar_senha: true } });
  if (error) return { erro: "Não foi possível marcar a troca de senha." };
  await supabase.rpc("revogar_sessoes", { p_usuario: id.data, p_motivo: "troca de senha obrigatória" });
  await supabase.rpc("registrar_troca_senha_forcada", { p_usuario: id.data });
  recarregar();
  return { ok: "No próximo acesso a pessoa vai escolher uma senha nova. As sessões abertas foram encerradas." };
}

// ---------------------------------------------------------------- desativar e reativar

export async function desativar(_: EstadoUsuario, form: FormData): Promise<EstadoUsuario> {
  await exigirPermissao("config.critica");
  const id = uuid.safeParse(form.get("id"));
  if (!id.success) return { erro: "Usuário inválido." };
  const motivo = String(form.get("motivo") ?? "").trim();
  const para = String(form.get("transferir_para") ?? "");
  if (motivo.length < 5) return { erro: "Escreva o motivo da desativação." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("desativar_usuario", {
    p_usuario: id.data, p_motivo: motivo, p_transferir_para: uuid.safeParse(para).success ? para : null,
  });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar();
  const r = data as { tarefas: number; orcamentos: number };
  const transf = r.tarefas || r.orcamentos ? ` ${r.tarefas} tarefa(s) e ${r.orcamentos} orçamento(s) transferidos.` : "";
  return { ok: `Usuário desativado e sessões encerradas. O histórico continua com o nome dele.${transf}` };
}

export async function reativar(_: EstadoUsuario, form: FormData): Promise<EstadoUsuario> {
  await exigirPermissao("config.critica");
  const id = uuid.safeParse(form.get("id"));
  if (!id.success) return { erro: "Usuário inválido." };
  const motivo = String(form.get("motivo") ?? "").trim();
  if (motivo.length < 5) return { erro: "Escreva o motivo da reativação." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("reativar_usuario", { p_usuario: id.data, p_motivo: motivo });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar();
  return { ok: "Usuário reativado. Se ele não lembrar a senha, gere um link de redefinição." };
}

// ---------------------------------------------------------------- histórico (painel lateral)

export type ItemHistorico = { em: string; acao: string; por: string | null; info: Record<string, unknown> };

export async function carregarHistorico(usuarioId: string): Promise<ItemHistorico[]> {
  await exigirPermissao("config.critica");
  if (!uuid.safeParse(usuarioId).success) return [];
  const supabase = await criarClienteServidor();
  const { data } = await supabase.rpc("historico_acesso", { p_usuario: usuarioId });
  return (data ?? []) as ItemHistorico[];
}

// ---------------------------------------------------------------- verificação em duas etapas

/** Trocou ou perdeu o celular: a administração remove o app autenticador; a pessoa cadastra de novo ao entrar. */
export async function removerDuasEtapas(_: EstadoUsuario, form: FormData): Promise<EstadoUsuario> {
  const acesso = await exigirPermissao("config.critica");
  const id = uuid.safeParse(form.get("id"));
  if (!id.success) return { erro: "Usuário inválido." };
  if (id.data === acesso.id) return { erro: "Peça a outro administrador para remover a sua." };
  const supabase = await criarClienteServidor();
  const { data: u } = await supabase.from("usuarios").select("auth_user_id").eq("id", id.data).maybeSingle();
  if (!u?.auth_user_id) return { erro: "Esta pessoa não tem login." };
  const admin = criarClienteAdmin();
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId: u.auth_user_id });
  if (error) return { erro: "Não foi possível consultar a verificação." };
  for (const f of data?.factors ?? []) {
    const { error: e } = await admin.auth.admin.mfa.deleteFactor({ userId: u.auth_user_id, id: f.id });
    if (e) return { erro: "Não foi possível remover a verificação." };
  }
  await supabase.rpc("revogar_sessoes", { p_usuario: id.data, p_motivo: "verificação em duas etapas removida" });
  await supabase.rpc("registrar_evento_mfa", { p_usuario: id.data, p_acao: "MFA_REMOVIDA" });
  recarregar();
  return { ok: "Verificação removida e sessões encerradas. No próximo acesso a pessoa cadastra o app de novo." };
}
