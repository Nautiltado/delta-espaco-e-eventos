import { describe, expect, it } from "vitest";
import { exibirValor, lerValorDoFormulario } from "./configuracoes";

describe("lerValorDoFormulario", () => {
  it("horas inteiras", () => {
    expect(lerValorDoFormulario("horas", { valor: "24" })).toEqual({ ok: true, valor: 24 });
    expect(lerValorDoFormulario("horas", { valor: "2,5" }).ok).toBe(false);
    expect(lerValorDoFormulario("horas", { valor: "-1" }).ok).toBe(false);
  });
  it("percentual até 100", () => {
    expect(lerValorDoFormulario("percentual", { valor: "50" })).toEqual({ ok: true, valor: 50 });
    expect(lerValorDoFormulario("percentual", { valor: "150" }).ok).toBe(false);
  });
  it("valor em reais vira centavos", () => {
    expect(lerValorDoFormulario("centavos", { valor: "180,00" })).toEqual({ ok: true, valor: 18000 });
  });
  it("faixa exige mínimo até o máximo", () => {
    expect(lerValorDoFormulario("faixa_centavos", { min: "600", max: "1.500" })).toEqual({
      ok: true,
      valor: { min: 60000, max: 150000 },
    });
    expect(lerValorDoFormulario("faixa_centavos", { min: "2.000", max: "1.500" }).ok).toBe(false);
  });
  it("texto não vazio", () => {
    expect(lerValorDoFormulario("texto", { valor: "   " }).ok).toBe(false);
  });
});

describe("exibirValor", () => {
  it("mostra faixa e percentuais legíveis", () => {
    expect(exibirValor("faixa_centavos", { min: 60000, max: 150000 })).toBe("R$ 600,00 a R$ 1.500,00");
    expect(exibirValor("percentual", 50)).toBe("50%");
  });
});
