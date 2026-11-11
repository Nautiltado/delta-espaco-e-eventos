import { formatarCentavos } from "@/lib/dinheiro";

export type ItemCatalogo = {
  id: string;
  nome: string;
  categoria: string;
  unidade: string;
  descricao: string | null;
  preco_tipo: "fixo" | "faixa" | "a_combinar";
  subgrupo?: string | null;
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
  if (i.preco_tipo === "a_combinar") return "A combinar";
  return i.preco_tipo === "fixo"
    ? formatarCentavos(i.preco_centavos ?? 0)
    : `${formatarCentavos(i.preco_min_centavos ?? 0)} a ${formatarCentavos(i.preco_max_centavos ?? 0)}`;
}

/** Preço sugerido ao incluir o item num orçamento: o fixo, o mínimo da faixa, ou nenhum (a combinar). */
export function precoSugerido(i: Pick<ItemCatalogo, "preco_tipo" | "preco_centavos" | "preco_min_centavos">): number | null {
  if (i.preco_tipo === "a_combinar") return null;
  return (i.preco_tipo === "fixo" ? i.preco_centavos : i.preco_min_centavos) ?? 0;
}

/** Itens ordenados como no cardápio: categoria, subgrupo (na ordem em que aparece), ordem, nome. */
export function ordenarCatalogo<T extends Pick<ItemCatalogo, "categoria" | "ordem" | "nome">>(itens: T[], ordemCategoria: (c: string) => number): T[] {
  return [...itens].sort(
    (a, b) => ordemCategoria(a.categoria) - ordemCategoria(b.categoria) || a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"),
  );
}
