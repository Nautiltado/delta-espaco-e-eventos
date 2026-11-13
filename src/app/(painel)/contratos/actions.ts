"use server";

import { z } from "zod";
import { exigirAlguma } from "@/lib/acesso";
import { criarClienteServidor } from "@/lib/supabase/server";

/** Texto final de um contrato já gerado (só leitura; o banco aplica as regras de quem pode ver). */
export async function carregarTextoContrato(id: string): Promise<{ texto?: string; erro?: string }> {
  await exigirAlguma(["contrato.editar", "contrato.ver"]);
  const ok = z.string().uuid().safeParse(id);
  if (!ok.success) return { erro: "Contrato inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("contratos").select("texto").eq("id", ok.data).maybeSingle();
  if (error || !data) return { erro: "Não foi possível abrir o contrato." };
  return { texto: (data.texto as string | null) ?? "Contrato sem texto (rascunho)." };
}
