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
