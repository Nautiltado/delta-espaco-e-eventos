import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Produto, SaldoEstoque } from "@/lib/salgados";

export async function cardapioEEstoque(supabase: SupabaseClient, { incluirInativos = false } = {}) {
  let q = supabase.from("cardapio_encomenda").select("*").order("ordem");
  if (!incluirInativos) q = q.eq("ativo", true);
  const [{ data: produtos }, { data: estoque }] = await Promise.all([q, supabase.from("estoque_saldo").select("*").order("ordem")]);
  return {
    produtos: ((produtos ?? []) as Produto[]).map((p) => ({ ...p, preco_centavos: Number(p.preco_centavos) })),
    estoque: (estoque ?? []) as SaldoEstoque[],
  };
}

export type PedidoResumo = {
  id: string; numero: string; cliente_nome: string; cliente_telefone: string | null; canal: string; retirada_em: string;
  status: import("@/lib/salgados").StatusPedido; total_centavos: number; observacao: string | null; criado_em: string;
  pedido_itens: { descricao: string; quantidade: number; composicao: { estoque_item_id: string; unidades: number }[] | null }[];
};

export const SELECT_PEDIDO =
  "id, numero, cliente_nome, cliente_telefone, canal, retirada_em, status, total_centavos, observacao, criado_em, pedido_itens(descricao, quantidade, composicao)";
