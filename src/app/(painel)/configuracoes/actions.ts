"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirPermissao } from "@/lib/acesso";
import { criarClienteServidor } from "@/lib/supabase/server";
import { lerValorDoFormulario, type TipoConfig } from "@/lib/configuracoes";
import { mensagemDoBanco } from "@/lib/erros";

export type EstadoConfig = { erro?: string; ok?: string };

export async function salvarConfiguracao(_: EstadoConfig, form: FormData): Promise<EstadoConfig> {
  await exigirPermissao("config.critica");
  const chave = z.string().regex(/^[a-z_]+(\.[a-z_]+)*$/).safeParse(form.get("chave"));
  if (!chave.success) return { erro: "Configuração inválida" };

  const supabase = await criarClienteServidor();
  // O tipo vem do banco, nunca do formulário.
  const { data: atual } = await supabase.from("configuracoes").select("tipo").eq("chave", chave.data).single();
  if (!atual) return { erro: "Configuração não encontrada" };

  const lido = lerValorDoFormulario(atual.tipo as TipoConfig, {
    valor: form.get("valor")?.toString(),
    min: form.get("min")?.toString(),
    max: form.get("max")?.toString(),
  });
  if (!lido.ok) return { erro: lido.erro };

  const { data, error } = await supabase
    .from("configuracoes")
    .update({ valor: lido.valor })
    .eq("chave", chave.data)
    .select("chave");
  if (error) return { erro: mensagemDoBanco(error) };
  if (!data?.length) return { erro: "Seu perfil não permite alterar configurações." };
  revalidatePath("/configuracoes");
  return { ok: "Salvo." };
}

// Tempos de um espaço (vazio = usa o padrão geral). O banco valida de 0 a 48 h.
export async function salvarTemposEspaco(_: EstadoConfig, form: FormData): Promise<EstadoConfig> {
  await exigirPermissao("config.critica");
  const id = z.uuid().safeParse(form.get("recurso"));
  if (!id.success) return { erro: "Espaço inválido." };
  const ler = (k: string): number | null | "x" => {
    const t = String(form.get(k) ?? "").trim().replace(",", ".");
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 && n <= 48 ? Math.round(n * 2) / 2 : "x";
  };
  const v = { m: ler("montagem"), d: ler("desmontagem"), l: ler("limpeza"), i: ler("intervalo") };
  if (Object.values(v).includes("x")) return { erro: "Use horas de 0 a 48 (ex.: 1,5)." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("definir_tempos_espaco", {
    p_recurso: id.data, p_montagem: v.m, p_desmontagem: v.d, p_limpeza: v.l, p_intervalo: v.i,
  });
  if (error) return { erro: mensagemDoBanco(error) };
  revalidatePath("/configuracoes");
  revalidatePath("/agenda");
  return { ok: "Salvo." };
}

// ---------------------------------------------------------------- backups (só administração)

export async function linkDoBackup(caminho: string): Promise<{ url?: string; erro?: string }> {
  await exigirPermissao("config.critica");
  const { linkDeDownload } = await import("@/lib/backup");
  const url = await linkDeDownload(caminho);
  return url ? { url } : { erro: "Arquivo não encontrado." };
}

export async function fazerBackupAgora(): Promise<EstadoConfig> {
  await exigirPermissao("config.critica");
  if (!process.env.SUPABASE_SECRET_KEY) return { erro: "Backup só funciona no site publicado." };
  try {
    const { fazerBackup } = await import("@/lib/backup");
    const r = await fazerBackup("manual");
    revalidatePath("/configuracoes");
    return { ok: `Backup feito: ${r.tabelas} tabelas, ${r.linhas} registros.` };
  } catch (e) {
    console.error("[backup manual]", e);
    return { erro: "Não foi possível fazer o backup agora. Tente de novo em instantes." };
  }
}
