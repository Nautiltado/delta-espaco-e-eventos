import { describe, expect, it } from "vitest";
import { composicaoDoProduto, composicaoMisto } from "@/lib/salgados";

describe("cento misto", () => {
  it("conta 25 por bloco e junta o sabor repetido", () => {
    expect(composicaoMisto(["cox", "qui", "cox", "ris"], 25)).toEqual([
      { estoque_item_id: "cox", unidades: 50 }, { estoque_item_id: "qui", unidades: 25 }, { estoque_item_id: "ris", unidades: 25 },
    ]);
  });
  it("um sabor só ocupa os 4 blocos", () => {
    expect(composicaoMisto(["cox", "cox", "cox", "cox"], 25)).toEqual([{ estoque_item_id: "cox", unidades: 100 }]);
  });
  it("sortido continua dividindo igual e produto simples consome o próprio salgado", () => {
    expect(composicaoDoProduto({ estoque_item_id: null, unidades: 100, bloco_unidades: null }, ["a", "b", "c"]).map((x) => x.unidades)).toEqual([34, 33, 33]);
    expect(composicaoDoProduto({ estoque_item_id: "x", unidades: 100, bloco_unidades: null }, [])).toEqual([{ estoque_item_id: "x", unidades: 100 }]);
  });
});
