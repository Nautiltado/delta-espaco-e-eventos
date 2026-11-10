import { formatarCentavos } from "@/lib/dinheiro";

export type ItemCatalogo = {
  id: string;
  nome: string;
  categoria: string;
  unidade: string;
  descricao: string | null;
  preco_tipo: "fixo" | "faixa";
  preco_centavos: number | null;
  preco_min_centavos: number | null;
  preco_max_centavos: number | null;
  recurso_id?: string | null;
  ativo: boolean;
  ordem: number;
};

export function precoDoItem(
  i: Pick<ItemCatalogo, "preco_tipo" | "preco_centavos" | "preco_min_centavos" | "preco_max_centavos">,
): string {
  return i.preco_tipo === "fixo"
    ? formatarCentavos(i.preco_centavos ?? 0)
    : `${formatarCentavos(i.preco_min_centavos ?? 0)} a ${formatarCentavos(i.preco_max_centavos ?? 0)}`;
}

/** Preço sugerido ao incluir o item num orçamento: o fixo, ou o mínimo da faixa. */
export function precoSugerido(i: Pick<ItemCatalogo, "preco_tipo" | "preco_centavos" | "preco_min_centavos">): number {
  return (i.preco_tipo === "fixo" ? i.preco_centavos : i.preco_min_centavos) ?? 0;
}
