"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirAcesso } from "@/lib/acesso";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDoBanco } from "@/lib/erros";

export type EstadoTarefa = { erro?: string; ok?: string; seq?: number };

const esquema = z.object({
  titulo: z.string().trim().min(3, "Descreva a tarefa").max(200),
  descricao: z.string().trim().max(2000).transform((v) => v || null),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data").nullable(),
  hora: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  cliente_id: z.uuid().nullable(),
  orcamento_id: z.uuid().nullable(),
});

const nulo = (v: FormDataEntryValue | null) => (String(v ?? "").trim() === "" ? null : String(v));

export async function criarTarefa(_: EstadoTarefa, form: FormData): Promise<EstadoTarefa> {
  await exigirAcesso();
  const d = esquema.safeParse({
    titulo: form.get("titulo"),
    descricao: String(form.get("descricao") ?? ""),
    data: nulo(form.get("data")),
    hora: nulo(form.get("hora")),
    cliente_id: nulo(form.get("cliente_id")),
    orcamento_id: nulo(form.get("orcamento_id")),
  });
  if (!d.success) return { erro: d.error.issues[0].message };
  // Horário digitado é o de Bacabal (UTC-3, sem horário de verão).
  const vence_em = d.data.data ? `${d.data.data}T${d.data.hora ?? "18:00"}:00-03:00` : null;
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("tarefas").insert({
    titulo: d.data.titulo,
    descricao: d.data.descricao,
    vence_em,
    cliente_id: d.data.cliente_id,
    orcamento_id: d.data.orcamento_id,
  });
  if (error) return { erro: mensagemDoBanco(error) };
  revalidatePath("/tarefas");
  revalidatePath("/");
  return { ok: "Tarefa criada.", seq: Date.now() };
}

export async function concluirTarefa(form: FormData) {
  const acesso = await exigirAcesso();
  const id = z.uuid().parse(form.get("id"));
  const reabrir = form.get("reabrir") === "1";
  const supabase = await criarClienteServidor();
  await supabase
    .from("tarefas")
    .update(reabrir ? { concluida_em: null, concluida_por: null } : { concluida_em: new Date().toISOString(), concluida_por: acesso.id })
    .eq("id", id);
  revalidatePath("/tarefas");
  revalidatePath("/");
}
