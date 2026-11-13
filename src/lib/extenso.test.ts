import { describe, expect, it } from "vitest";
import { inteiroPorExtenso, reaisPorExtenso } from "./extenso";

describe("inteiroPorExtenso", () => {
  it.each([
    [0, "zero"], [1, "um"], [14, "catorze"], [21, "vinte e um"], [100, "cem"], [101, "cento e um"],
    [110, "cento e dez"], [999, "novecentos e noventa e nove"], [1000, "mil"], [1001, "mil e um"],
    [1100, "mil e cem"], [1500, "mil e quinhentos"], [1234, "mil duzentos e trinta e quatro"],
    [2000, "dois mil"], [21000, "vinte e um mil"], [100000, "cem mil"], [101500, "cento e um mil e quinhentos"],
    [1000000, "um milhão"], [2500000, "dois milhões e quinhentos mil"], [1000001, "um milhão e um"],
  ])("%i → %s", (n, t) => expect(inteiroPorExtenso(n)).toBe(t));
});

describe("reaisPorExtenso", () => {
  it.each([
    [100, "um real"], [1, "um centavo"], [50, "cinquenta centavos"], [150050, "mil e quinhentos reais e cinquenta centavos"],
    [1200000, "doze mil reais"], [100000000, "um milhão de reais"], [100000100, "um milhão e um reais"], [0, "zero real"],
    [1234567, "doze mil trezentos e quarenta e cinco reais e sessenta e sete centavos"],
  ])("%i → %s", (c, t) => expect(reaisPorExtenso(c)).toBe(t));
  it("recusa valor inválido", () => expect(() => reaisPorExtenso(-1)).toThrow());
});
