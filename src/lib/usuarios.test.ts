import { describe, expect, it } from "vitest";
import { agruparPorModulo, moduloDa, permissoesDosPerfis } from "@/lib/usuarios";

describe("permissões combinadas", () => {
  const matriz = [{ codigo: "ATD", permissoes: ["cliente.ver", "orcamento.criar"] }, { codigo: "COZ", permissoes: ["producao.status", "cliente.ver"] }];
  it("vários perfis somam (união sem repetir)", () => {
    expect(permissoesDosPerfis(["ATD", "COZ"], matriz)).toEqual(["cliente.ver", "orcamento.criar", "producao.status"]);
    expect(permissoesDosPerfis([], matriz)).toEqual([]);
  });
  it("agrupa por módulo na ordem do menu", () => {
    expect(moduloDa("financeiro.ver")).toBe("Financeiro");
    expect(agruparPorModulo(["producao.status", "cliente.ver"]).map(([m]) => m)).toEqual(["Clientes", "Encomendas e cozinha"]);
  });
});
