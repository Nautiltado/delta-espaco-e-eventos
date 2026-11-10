import { describe, expect, it } from "vitest";
import { mensagemDoBanco } from "./erros";

describe("mensagemDoBanco", () => {
  it("usa o detalhe das regras de negócio", () => {
    expect(
      mensagemDoBanco({ message: "APROVACAO_NECESSARIA: Desconto de 18.6% acima do limite de 5%" }),
    ).toBe("Precisa de aprovação de um administrador: Desconto de 18.6% acima do limite de 5%.");
    expect(mensagemDoBanco({ message: "CONFIG_INVALIDA: financeiro precisa ser um percentual" })).toBe(
      "Financeiro precisa ser um percentual.",
    );
  });
  it("traduz restrições conhecidas", () => {
    expect(
      mensagemDoBanco({ code: "23505", message: 'duplicate key value violates unique constraint "uq_clientes_documento"' }),
    ).toMatch(/Já existe um cliente/);
    expect(mensagemDoBanco({ code: "42501", message: "new row violates row-level security policy" })).toBe(
      "Seu perfil não permite esta ação.",
    );
  });
  it("nunca mostra o erro técnico cru", () => {
    expect(mensagemDoBanco({ message: "relation x does not exist" })).toBe("Não foi possível concluir. Tente de novo.");
  });
});
