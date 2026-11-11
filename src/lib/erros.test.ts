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

describe("erros da fase 4", () => {
  it("data ocupada diz qual espaço e quando", () => {
    expect(mensagemDoBanco({ message: "DATA_INDISPONIVEL: Espaço maior já está ocupado de 15/03 15:00 a 16/03 03:00 (reserva confirmada)" }))
      .toBe("Data indisponível: Espaço maior já está ocupado de 15/03 15:00 a 16/03 03:00 (reserva confirmada).");
  });
  it("pagamento duplicado e entrada", () => {
    expect(mensagemDoBanco({ message: "PAGAMENTO_DUPLICADO: este identificador de pagamento já foi registrado" }))
      .toBe("Este identificador de pagamento já foi registrado.");
    expect(mensagemDoBanco({ message: "ENTRADA_NAO_CONFIRMADA: dê baixa na primeira parcela antes de confirmar" }))
      .toBe("Dê baixa na primeira parcela antes de confirmar.");
  });
});
