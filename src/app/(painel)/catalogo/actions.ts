"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirPermissao } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDoBanco } from "@/lib/erros";
import { lerReais } from "@/lib/dinheiro";
import { CATEGORIAS, UNIDADES } from "@/lib/orcamentos";

export type EstadoItem = { erro?: string };

const base = z.object({
  nome: z.string().trim().min(2, "Informe o nome").max(120),
  categoria: z.enum(Object.keys(CATEGORIAS) as [string, ...string[]]),
  unidade: z.enum(Object.keys(UNIDADES) as [string, ...string[]]),
  descricao: z.string().trim().max(500).transform((v) => v || null),
  preco_tipo: z.enum(["fixo", "faixa"]),
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
    ordem: form.get("ordem") || 0,
    ativo: form.get("ativo") === "1",
  });
  if (!b.success) return { erro: b.error.issues[0].message };

  let precos: { preco_centavos: number | null; preco_min_centavos: number | null; preco_max_centavos: number | null };
  if (b.data.preco_tipo === "fixo") {
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
