import { describe, expect, it } from "vitest";
import { ordenarCatalogo, precoDoItem, precoSugerido } from "./catalogo";
import { ordemCategoria } from "./orcamentos";

describe("catálogo", () => {
  it("a combinar não sugere preço", () => {
    const i = { preco_tipo: "a_combinar" as const, preco_centavos: null, preco_min_centavos: null, preco_max_centavos: null };
    expect(precoDoItem(i)).toBe("A combinar");
    expect(precoSugerido(i)).toBeNull();
    expect(precoSugerido({ preco_tipo: "faixa", preco_centavos: null, preco_min_centavos: 500 })).toBe(500);
  });
  it("ordena como o cardápio", () => {
    const r = ordenarCatalogo(
      [
        { categoria: "bebida", ordem: 10, nome: "Suco" },
        { categoria: "salgado_frito", ordem: 20, nome: "Quibe" },
        { categoria: "espaco", ordem: 1, nome: "Locação" },
        { categoria: "salgado_frito", ordem: 10, nome: "Coxinha" },
      ],
      ordemCategoria,
    );
    expect(r.map((x) => x.nome)).toEqual(["Locação", "Coxinha", "Quibe", "Suco"]);
  });
});
