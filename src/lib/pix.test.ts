import { describe, expect, it } from "vitest";
import { crc16, payloadPix } from "./pix";

describe("Pix copia e cola", () => {
  it("CRC do exemplo do manual do BR Code", () => {
    const exemplo =
      "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304";
    expect(crc16(exemplo)).toBe("1D3D");
  });

  it("monta o payload com valor, nome sem acento e identificador", () => {
    const p = payloadPix({
      chave: "06328111000108", nome: "M C Melo Santos", cidade: "Bacabal", valorCentavos: 150050, identificador: "ORC-2026-0001-P1",
    });
    expect(p).toContain("0014br.gov.bcb.pix011406328111000108");
    expect(p).toContain("5407" + "1500.50");
    expect(p).toContain("5915M C MELO SANTOS");
    expect(p).toContain("6007BACABAL");
    expect(p).toContain("62170513ORC20260001P1");
    expect(p.slice(-8, -4)).toBe("6304");
    expect(crc16(p.slice(0, -4))).toBe(p.slice(-4));
  });

  it("corta nome e cidade nos limites e tira acentos", () => {
    const p = payloadPix({ chave: "a@b.co", nome: "Delta Espaço e Eventos Ltda Filial", cidade: "São José de Ribamar", valorCentavos: 1, identificador: "" });
    expect(p).toContain("5925DELTA ESPACO E EVENTOS LT");
    expect(p).toContain("6015SAO JOSE DE RIB");
    expect(p).toContain("540" + "40.01");
    expect(p).toContain("62070503***");
  });

  it("exige chave e valor", () => {
    expect(() => payloadPix({ chave: " ", nome: "x", cidade: "y", valorCentavos: 1, identificador: "a" })).toThrow();
    expect(() => payloadPix({ chave: "k", nome: "x", cidade: "y", valorCentavos: 0, identificador: "a" })).toThrow();
  });
});
