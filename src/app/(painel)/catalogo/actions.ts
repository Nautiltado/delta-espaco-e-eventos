"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirPermissao } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDoBanco } from "@/lib/erros";
import { lerReais } from "@/lib/dinheiro";
import { CATEGORIAS } from "@/lib/orcamentos";

export type EstadoItem = { erro?: string };

const base = z.object({
  nome: z.string().trim().min(2, "Informe o nome").max(120),
  categoria: z.enum(Object.keys(CATEGORIAS) as [string, ...string[]]),
  unidade: z.string().regex(/^[a-z_]{2,20}$/, "Unidade inválida"),
  descricao: z.string().trim().max(500).transform((v) => v || null),
  preco_tipo: z.enum(["fixo", "faixa", "a_combinar"]),
  subgrupo: z.string().trim().max(60).transform((v) => v || null),
  ordem: z.coerce.number().int().min(0).max(9999).default(0),
  ativo: z.boolean(),
});

export async function salvarItem(_: EstadoItem, form: FormData): Promise<EstadoItem> {
  const acesso = await exigirPermissao("catalogo.alterar");
  const id = String(form.get("id") ?? "") || null;
  const b = base.safeParse({
    nome: form.get("nome"),
    categoria: form.get("categoria"),
    unidade: form.get("unidade"),
    descricao: String(form.get("descricao") ?? ""),
    preco_tipo: form.get("preco_tipo"),
    subgrupo: String(form.get("subgrupo") ?? ""),
    ordem: form.get("ordem") || 0,
    ativo: form.get("ativo") === "1",
  });
  if (!b.success) return { erro: b.error.issues[0].message };

  let precos: { preco_centavos: number | null; preco_min_centavos: number | null; preco_max_centavos: number | null };
  if (b.data.preco_tipo === "a_combinar") {
    precos = { preco_centavos: null, preco_min_centavos: null, preco_max_centavos: null };
  } else if (b.data.preco_tipo === "fixo") {
    const p = lerReais(String(form.get("preco") ?? ""));
    if (p === null) return { erro: "Preço inválido" };
    precos = { preco_centavos: p, preco_min_centavos: null, preco_max_centavos: null };
  } else {
    const min = lerReais(String(form.get("preco_min") ?? ""));
    const max = lerReais(String(form.get("preco_max") ?? ""));
    if (min === null || max === null) return { erro: "Informe mínimo e máximo da faixa" };
    if (min > max) return { erro: "O mínimo não pode ser maior que o máximo" };
    precos = { preco_centavos: null, preco_min_centavos: min, preco_max_centavos: max };
  }

  const supabase = await criarClienteServidor();
  const registro = { ...b.data, ...precos };
  let itemId = id;
  if (id) {
    const { data, error } = await supabase.from("catalogo_itens").update(registro).eq("id", id).select("id");
    if (error) return { erro: mensagemDoBanco(error) };
    if (!data?.length) return { erro: "Seu perfil não permite alterar o catálogo." };
  } else {
    const { data, error } = await supabase.from("catalogo_itens").insert(registro).select("id").single();
    if (error) return { erro: mensagemDoBanco(error) };
    itemId = data.id;
  }

  // Custo interno: só quem também pode ver custos grava.
  const custoTexto = String(form.get("custo") ?? "").trim();
  if (pode(acesso, "custo.ver") && form.has("custo")) {
    if (custoTexto === "") {
      await supabase.from("catalogo_custos").delete().eq("item_id", itemId!);
    } else {
      const custo = lerReais(custoTexto);
      if (custo === null) return { erro: "Custo inválido" };
      const { error } = await supabase
        .from("catalogo_custos")
        .upsert({ item_id: itemId, custo_centavos: custo, atualizado_em: new Date().toISOString() });
      if (error) return { erro: mensagemDoBanco(error) };
    }
  }
  revalidatePath("/catalogo");
  redirect(`/catalogo/${itemId}?salvo=1`);
}

// ---------------------------------------------------------------- unidades de cobrança

const unidadeForm = z.object({
  codigo: z.string().trim().toLowerCase().regex(/^[a-z_]{2,20}$/, "Código: só letras minúsculas e _, de 2 a 20 (ex.: duzia)"),
  singular: z.string().trim().min(1, "Informe o nome no singular").max(30),
  plural: z.string().trim().min(1, "Informe o plural").max(30),
  equivale_quantidade: z.number().positive().max(1_000_000).nullable(),
  equivale_unidade: z.string().regex(/^[a-z_]{2,20}$/).nullable(),
  passo: z.number().positive("O passo precisa ser maior que zero").max(1000),
  ativo: z.boolean(),
  ordem: z.number().int().min(0).max(9999),
});

function numeroOpcional(v: FormDataEntryValue | null): number | null {
  const t = String(v ?? "").trim().replace(/\./g, "").replace(",", ".");
  return t ? Number(t) : null;
}

export async function salvarUnidade(_: EstadoItem & { ok?: string }, form: FormData): Promise<EstadoItem & { ok?: string }> {
  await exigirPermissao("catalogo.alterar");
  const novo = form.get("novo") === "1";
  const p = unidadeForm.safeParse({
    codigo: form.get("codigo"),
    singular: form.get("singular"),
    plural: form.get("plural"),
    equivale_quantidade: numeroOpcional(form.get("equivale_quantidade")),
    equivale_unidade: String(form.get("equivale_unidade") ?? "").trim() || null,
    passo: numeroOpcional(form.get("passo")) ?? 1,
    ativo: form.get("ativo") === "1",
    ordem: Number(form.get("ordem") || 0),
  });
  if (!p.success) return { erro: p.error.issues[0].message };
  const d = p.data;
  if ((d.equivale_quantidade == null) !== (d.equivale_unidade == null)) return { erro: "Para a equivalência, informe a quantidade e a unidade (ex.: 1 cento = 100 unidades)." };
  if (d.equivale_unidade === d.codigo) return { erro: "Uma unidade não pode equivaler a ela mesma." };
  const supabase = await criarClienteServidor();
  const { codigo, ...resto } = d;
  const { error } = novo
    ? await supabase.from("unidades").insert(d)
    : await supabase.from("unidades").update(resto).eq("codigo", codigo);
  if (error) return { erro: error.code === "23505" ? "Já existe uma unidade com este código." : mensagemDoBanco(error) };
  revalidatePath("/catalogo/unidades");
  revalidatePath("/catalogo");
  return { ok: novo ? "Unidade criada." : "Unidade salva." };
}
