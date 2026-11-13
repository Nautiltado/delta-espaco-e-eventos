import { describe, expect, it } from "vitest";
import { fechamento, mensagemEquipe, nomeFuncao, sugerirEquipe } from "./eventos";

describe("equipe do evento", () => {
  it("usa o que foi contratado no orçamento", () => {
    expect(sugerirEquipe([{ descricao: "Garçom", quantidade: 4, unidade: "diaria" }, { descricao: "Segurança", quantidade: 1, unidade: "diaria" }], 150, "jantar"))
      .toEqual({ garcom: 4, seguranca: 1 });
  });
  it("sem garçom no orçamento: 1 até 30 pessoas, 2 acima; coffee break sem garçom", () => {
    expect(sugerirEquipe([], 30, "almoço").garcom).toBe(1);
    expect(sugerirEquipe([], 31, "jantar").garcom).toBe(2);
    expect(sugerirEquipe([], 80, "Coffee break").garcom).toBe(0);
  });
  it("plural certo", () => {
    expect(nomeFuncao("garcom", 1)).toBe("1 garçom");
    expect(nomeFuncao("garcom", 3)).toBe("3 garçons");
  });
});

describe("fechamento", () => {
  it("soma equipe e gastos e separa o que falta pagar", () => {
    const f = fechamento(500000,
      [{ id: "1", funcao: "garcom", quantidade: 3, valor_unitario_centavos: 18000, fornecedor: "Kaká", observacao: null, pago_em: null }],
      [{ id: "a", categoria: "compras", descricao: "Carne", fornecedor: null, valor_centavos: 100000, data: "2026-11-11", pago: true }]);
    expect(f.custos).toBe(154000);
    expect(f.aPagar).toBe(54000);
    expect(f.resultado).toBe(346000);
    expect(f.margem).toBe(69);
  });
});

it("mensagem para o Kaká", () => {
  const m = mensagemEquipe({ responsavel: "Kaká", dia: "sáb., 30/11", chegada: "17:30", horario: "19:00 às 23:00", titulo: "Aniversário",
    convidados: 80, linhas: [{ funcao: "garcom", quantidade: 3 }], traje: "Camisa preta", observacoes: null, local: "Salão principal" });
  expect(m).toContain("Precisamos de: 3 garçons");
  expect(m).toContain("chegar às 17:30");
});
