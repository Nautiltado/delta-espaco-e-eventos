import { describe, expect, it } from "vitest";
import { disponivel, dividirSortido, instanteRetirada, precisaRepor } from "./salgados";

describe("salgados", () => {
  it("divide o sortido como o banco (34/33/33)", () => {
    expect(dividirSortido(100, ["a", "b", "c"])).toEqual([
      { estoque_item_id: "a", unidades: 34 }, { estoque_item_id: "b", unidades: 33 }, { estoque_item_id: "c", unidades: 33 },
    ]);
    expect(dividirSortido(50, ["a", "b"]).map((x) => x.unidades)).toEqual([25, 25]);
    expect(dividirSortido(100, [])).toEqual([]);
  });
  it("disponível e reposição", () => {
    expect(disponivel({ saldo: 300, reservado: 234 })).toBe(66);
    expect(precisaRepor({ saldo: 300, reservado: 234, minimo: 100 })).toBe(true);
    expect(precisaRepor({ saldo: 300, reservado: 0, minimo: 100 })).toBe(false);
  });
  it("horário de retirada no fuso da Delta", () => {
    expect(instanteRetirada("2026-11-12", "15:30")).toBe("2026-11-12T15:30:00-03:00");
    expect(instanteRetirada("2026-11-12", "25:00")).toBeNull();
  });
});

describe("datas e somas da cozinha", () => {
  it("converte o instante para o fuso da Delta", async () => {
    const { horaDaDelta, diaDaDelta } = await import("./salgados");
    expect(horaDaDelta("2026-11-12T02:30:00Z")).toBe("23:30");
    expect(diaDaDelta("2026-11-12T02:30:00Z")).toBe("2026-11-11");
  });
  it("soma as unidades por salgado", async () => {
    const { somarPorSalgado } = await import("./salgados");
    const m = somarPorSalgado([
      { pedido_itens: [{ composicao: [{ estoque_item_id: "a", unidades: 50 }, { estoque_item_id: "b", unidades: 50 }] }] },
      { pedido_itens: [{ composicao: [{ estoque_item_id: "a", unidades: 25 }] }, { composicao: null }] },
    ]);
    expect(m.get("a")).toBe(75);
    expect(m.get("b")).toBe(50);
  });
});
