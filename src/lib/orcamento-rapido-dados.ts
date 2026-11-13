import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ordenarCatalogo, precoSugerido, type ItemCatalogo } from "@/lib/catalogo";
import { CATEGORIAS, ordemCategoria } from "@/lib/orcamentos";
import type { ItemModelo, OpcaoRapida } from "@/lib/orcamento-rapido";

export type ModeloRapido = { id: string; nome: string; descricao: string | null; ativo: boolean; itens: ItemModelo[] };

/** Catálogo com último preço praticado e capacidade dos espaços, e os modelos de orçamento. */
export async function dadosOrcamentoRapido(supabase: SupabaseClient, { incluirInativos = false } = {}) {
  const [{ data: cat }, { data: ultimos }, { data: recursos }, { data: modelos }] = await Promise.all([
    supabase.from("catalogo_itens").select("*").eq("ativo", true),
    supabase.from("ultimo_preco_catalogo").select("catalogo_item_id, preco_unitario_centavos"),
    supabase.from("recursos").select("id, capacidade"),
    supabase
      .from("orcamento_modelos")
      .select("id, nome, descricao, ativo, ordem, orcamento_modelo_itens(catalogo_item_id, regra, fator, minimo, opcional, preco_centavos, ordem)")
      .order("ordem").order("nome"),
  ]);
  const ultimo = new Map((ultimos ?? []).map((u) => [u.catalogo_item_id as string, Number(u.preco_unitario_centavos)]));
  const capacidade = new Map((recursos ?? []).map((r) => [r.id as string, r.capacidade as number | null]));
  const opcoes: OpcaoRapida[] = ordenarCatalogo((cat ?? []) as ItemCatalogo[], ordemCategoria).map((c) => ({
    id: c.id,
    nome: c.nome,
    grupo: (CATEGORIAS[c.categoria] ?? c.categoria) + (c.subgrupo ? ` · ${c.subgrupo}` : ""),
    unidade: c.unidade,
    preco_catalogo: precoSugerido(c),
    preco_ultimo: ultimo.get(c.id) ?? null,
    recurso_id: c.recurso_id ?? null,
    capacidade: c.recurso_id ? capacidade.get(c.recurso_id) ?? null : null,
  }));
  const lista: ModeloRapido[] = ((modelos ?? []) as unknown as (Omit<ModeloRapido, "itens"> & { orcamento_modelo_itens: ItemModelo[] })[])
    .filter((m) => incluirInativos || m.ativo)
    .map((m) => ({
      id: m.id, nome: m.nome, descricao: m.descricao, ativo: m.ativo,
      itens: m.orcamento_modelo_itens.map((i) => ({ ...i, fator: Number(i.fator), minimo: Number(i.minimo), preco_centavos: i.preco_centavos == null ? null : Number(i.preco_centavos) })),
    }));
  return { opcoes, modelos: lista };
}
