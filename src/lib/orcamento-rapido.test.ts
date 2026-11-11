import { describe, expect, it } from "vitest";
import { buscarNoCatalogo, calcularQuantidade, descreverRegra, linhasDoModelo, type OpcaoRapida } from "./orcamento-rapido";

describe("quantidades", () => {
  it("garçom: 1 até 30 convidados, 2 a partir de 31", () => {
    expect(calcularQuantidade("a_cada", 30, 1, 25, "evento")).toBe(1);
    expect(calcularQuantidade("a_cada", 30, 1, 30, "evento")).toBe(1);
    expect(calcularQuantidade("a_cada", 30, 1, 31, "evento")).toBe(2);
    expect(calcularQuantidade("a_cada", 30, 1, 120, "evento")).toBe(4);
  });
  it("salgado por pessoa em centos, arredonda para cima em meio cento", () => {
    expect(calcularQuantidade("por_pessoa", 0.03, 0.5, 80, "cento")).toBe(2.5); // 240 salgados
    expect(calcularQuantidade("por_pessoa", 0.03, 0.5, 10, "cento")).toBe(0.5); // mínimo
  });
  it("prato por pessoa e item fixo", () => {
    expect(calcularQuantidade("por_pessoa", 1, 0, 73, "pessoa")).toBe(73);
    expect(calcularQuantidade("fixa", 2, 0, 500, "unidade")).toBe(2);
  });
  it("sem convidados usa o mínimo", () => {
    expect(calcularQuantidade("por_pessoa", 0.03, 0.5, null, "cento")).toBe(0.5);
    expect(calcularQuantidade("a_cada", 30, 1, null, "evento")).toBe(1);
  });
  it("descreve a regra", () => {
    expect(descreverRegra("por_pessoa", 0.03, 0.5, "cento")).toBe("3 un. por convidado, mínimo 0,5");
    expect(descreverRegra("a_cada", 30, 1, "evento")).toBe("1 a cada 30 convidados, mínimo 1");
  });
});

const op = (id: string, nome: string, extra: Partial<OpcaoRapida> = {}): OpcaoRapida => ({
  id, nome, grupo: "g", unidade: "evento", preco_catalogo: null, preco_ultimo: null, recurso_id: null, capacidade: null, ...extra,
});

describe("linhas do modelo", () => {
  const cat = new Map([
    ["m", op("m", "Locação do espaço menor", { recurso_id: "rm", capacidade: 100, preco_catalogo: 60000 })],
    ["M", op("M", "Locação do espaço maior", { recurso_id: "rM", capacidade: 500, preco_catalogo: 200000 })],
    ["s", op("s", "Segurança", { preco_catalogo: 15000 })],
    ["c", op("c", "Coxinha", { unidade: "cento", preco_ultimo: 9000 })],
  ]);
  const itens = [
    { catalogo_item_id: "m", regra: "fixa" as const, fator: 1, minimo: 0, opcional: false, preco_centavos: null, ordem: 1 },
    { catalogo_item_id: "M", regra: "fixa" as const, fator: 1, minimo: 0, opcional: false, preco_centavos: null, ordem: 2 },
    { catalogo_item_id: "c", regra: "por_pessoa" as const, fator: 0.03, minimo: 0.5, opcional: false, preco_centavos: null, ordem: 3 },
    { catalogo_item_id: "s", regra: "fixa" as const, fator: 1, minimo: 0, opcional: true, preco_centavos: 20000, ordem: 4 },
  ];
  it("marca só o espaço que comporta os convidados e deixa opcionais desmarcados", () => {
    const l = linhasDoModelo(itens, cat, { convidados: 150, recurso_id: null, externo: false });
    expect(l.map((x) => [x.nome, x.marcado])).toEqual([
      ["Locação do espaço menor", false], ["Locação do espaço maior", true], ["Coxinha", true], ["Segurança", false],
    ]);
    expect(l[2]).toMatchObject({ quantidade: 4.5, preco_centavos: 9000, origem_preco: "ultimo" });
    expect(l[3]).toMatchObject({ preco_centavos: 20000, origem_preco: "modelo" });
  });
  it("usa o espaço já escolhido no orçamento; evento externo não leva locação", () => {
    expect(linhasDoModelo(itens, cat, { convidados: 50, recurso_id: "rM", externo: false }).filter((x) => x.marcado).map((x) => x.nome))
      .toContain("Locação do espaço maior");
    expect(linhasDoModelo(itens, cat, { convidados: 50, recurso_id: null, externo: true }).slice(0, 2).every((x) => !x.marcado)).toBe(true);
  });
  it("busca sem acento", () => {
    expect(buscarNoCatalogo([...cat.values()], "locacao mai").map((x) => x.nome)).toEqual(["Locação do espaço maior"]);
  });
});
