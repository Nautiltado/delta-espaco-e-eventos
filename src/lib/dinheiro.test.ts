import { describe, expect, it } from "vitest";
import { centavosParaCampo, formatarCentavos, lerReais } from "./dinheiro";

describe("lerReais", () => {
  it.each([
    ["600", 60000],
    ["1.500", 150000],
    ["1.500,50", 150050],
    ["R$ 2.000,00", 200000],
    ["600,5", 60050],
    ["0,99", 99],
    ["1500", 150000],
  ])("%s → %d centavos", (texto, esperado) => {
    expect(lerReais(texto)).toBe(esperado);
  });

  it.each(["", "abc", "-10", "1,999", "1.50", "12.34.5", "1500.00"])("recusa %j", (texto) => {
    expect(lerReais(texto)).toBeNull();
  });
});

describe("formatarCentavos", () => {
  it("formata em reais", () => {
    expect(formatarCentavos(150050)).toBe("R$ 1.500,50");
    expect(centavosParaCampo(60000)).toBe("600,00");
  });
  it("recusa valor não inteiro", () => {
    expect(() => formatarCentavos(10.5)).toThrow();
  });
});
