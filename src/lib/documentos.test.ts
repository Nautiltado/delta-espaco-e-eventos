import { describe, expect, it } from "vitest";
import {
  formatarDocumento,
  formatarTelefone,
  linkWhatsApp,
  normalizarTelefone,
  validaCnpj,
  validaCpf,
} from "./documentos";

describe("CPF e CNPJ", () => {
  it("aceita documentos válidos, com ou sem máscara", () => {
    expect(validaCpf("620.814.073-02")).toBe(true);
    expect(validaCpf("27829901368")).toBe(true);
    expect(validaCnpj("06.328.111/0001-08")).toBe(true);
  });
  it("recusa dígito errado e sequências repetidas", () => {
    expect(validaCpf("620.814.073-03")).toBe(false);
    expect(validaCpf("111.111.111-11")).toBe(false);
    expect(validaCnpj("06.328.111/0001-09")).toBe(false);
    expect(validaCnpj("00000000000000")).toBe(false);
  });
  it("formata", () => {
    expect(formatarDocumento("62081407302")).toBe("620.814.073-02");
    expect(formatarDocumento("06328111000108")).toBe("06.328.111/0001-08");
  });
});

describe("telefone", () => {
  it.each([
    ["(99) 98152-2414", "99981522414"],
    ["+55 99 98152-2414", "99981522414"],
    ["5599981522414", "99981522414"],
    ["099981522414", "99981522414"],
    ["99 3621-1234", "9936211234"],
  ])("%s → %s", (entrada, esperado) => {
    expect(normalizarTelefone(entrada)).toBe(esperado);
  });
  it("recusa número incompleto", () => {
    expect(normalizarTelefone("98152-2414")).toBeNull();
    expect(normalizarTelefone("")).toBeNull();
  });
  it("formata e gera link do WhatsApp", () => {
    expect(formatarTelefone("99981522414")).toBe("(99) 98152-2414");
    expect(linkWhatsApp("(99) 98152-2414")).toBe("https://wa.me/5599981522414");
  });
});
