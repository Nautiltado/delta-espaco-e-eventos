import { describe, expect, it } from "vitest";
import { mascararResposta, TEXTO_OCULTO as O } from "@/lib/visitante-mascara";

describe("máscara do visitante", () => {
  it("cliente: nome, documento e contatos somem; id e cidade ficam", () => {
    const r = mascararResposta([{ id: "8b0f6a52-1d2e-4c55-9a77-0b1c2d3e4f50", nome: "Joana Silva", documento: "62081407302", telefone: "99981110101", cidade: "Bacabal" }], "clientes");
    expect(r).toEqual([{ id: "8b0f6a52-1d2e-4c55-9a77-0b1c2d3e4f50", nome: O, documento: O, telefone: O, cidade: "Bacabal" }]);
  });
  it("nome de item do catálogo e de espaço continuam visíveis", () => {
    expect(mascararResposta([{ nome: "Coxinha de frango", preco_centavos: 9000 }], "catalogo_itens")).toEqual([{ nome: "Coxinha de frango", preco_centavos: 0 }]);
    expect(mascararResposta({ espacos: [{ nome: "Espaço menor" }] }, "rpc/agenda_detalhes")).toEqual({ espacos: [{ nome: "Espaço menor" }] });
  });
  it("cliente aninhado, título e valores da agenda", () => {
    const r = mascararResposta([{ titulo: "Casamento da Joana", cliente: "Joana", criado_por: "Leonardo", valor_total: 500000, pago: 250000,
      orcamento: { numero: "ORC-2026-0003", convidados: 100 }, clientes: { nome: "Joana", tipo: "PF" } }], "rpc/agenda_detalhes");
    expect(r).toEqual([{ titulo: O, cliente: O, criado_por: O, valor_total: 0, pago: 0,
      orcamento: { numero: "ORC-2026-0003", convidados: 100 }, clientes: { nome: O, tipo: "PF" } }]);
  });
  it("ids de pessoa (uuid) não são trocados, para as telas continuarem ligando os dados", () => {
    const id = "3f2c1b0a-9e8d-4c7b-8a69-5f4e3d2c1b0a";
    expect(mascararResposta({ criado_por: id, responsavel: id }, "orcamentos")).toEqual({ criado_por: id, responsavel: id });
  });
  it("cópia enviada do orçamento e contrato: dados do cliente dentro do JSON", () => {
    const r = mascararResposta({ snapshot: { cliente: { nome: "Joana", documento: "1", telefone: "2" }, total_centavos: 63000, itens: [{ descricao: "Coxinha", total_centavos: 18000 }] } }, "orcamento_versoes");
    expect(r).toEqual({ snapshot: { cliente: { nome: O, documento: O, telefone: O }, total_centavos: 0, itens: [{ descricao: "Coxinha", total_centavos: 0 }] } });
  });
});

import { assinarVisitante, visitanteValido } from "@/lib/visitante-cookie";
describe("configurações para o visitante", () => {
  it("textos somem, prazos ficam", () => {
    expect(mascararResposta([{ chave: "contrato.signatario", valor: "Fulana de Tal" }, { chave: "orcamento.validade_dias", tipo: "dias", valor: 7 },
      { chave: "espaco.menor.preco", tipo: "faixa_centavos", valor: { min: 1 } }, { chave: "seguranca", tipo: "centavos", valor: 15000 }], "configuracoes"))
      .toEqual([{ chave: "contrato.signatario", valor: O }, { chave: "orcamento.validade_dias", tipo: "dias", valor: 7 },
        { chave: "espaco.menor.preco", tipo: "faixa_centavos", valor: 0 }, { chave: "seguranca", tipo: "centavos", valor: 0 }]);
  });
});

describe("cookie do visitante", () => {
  it("vale até expirar e não aceita falsificação", async () => {
    const agora = Date.UTC(2026, 10, 13, 12);
    const c = await assinarVisitante("segredo", agora);
    expect(await visitanteValido(c, "segredo", agora + 1000)).toBe(true);
    expect(await visitanteValido(c, "outro", agora)).toBe(false);
    expect(await visitanteValido(c.replace(/\.\d+\./, ".9999999999."), "segredo", agora)).toBe(false);
    expect(await visitanteValido(c, "segredo", agora + 9 * 3600 * 1000)).toBe(false);
  });
});
