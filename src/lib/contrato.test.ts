import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MARCADORES_CONHECIDOS, marcadoresDesconhecidos, montarTextoContrato, planoDeParcelas, qualificacaoDoCliente, valoresDoContrato,
  type DadosContrato,
} from "./contrato";

const cfg = { sinalPercentual: 50, saldoDiasAntes: 7, integralDias: 7 };

describe("planoDeParcelas (igual ao banco)", () => {
  it("50/50 com entrada arredondada para cima e saldo 7 dias antes", () => {
    expect(planoDeParcelas(100001, "2027-05-20", "2026-11-11", cfg)).toEqual([
      { numero: 1, valor_centavos: 50001, vencimento: "2026-11-11" },
      { numero: 2, valor_centavos: 50000, vencimento: "2027-05-13" },
    ]);
  });
  it("integral com menos de 7 dias", () => {
    expect(planoDeParcelas(500000, "2026-11-17", "2026-11-11", cfg)).toEqual([{ numero: 1, valor_centavos: 500000, vencimento: "2026-11-11" }]);
    expect(planoDeParcelas(500000, "2026-11-18", "2026-11-11", cfg)).toHaveLength(2);
  });
});

const base: DadosContrato = {
  numero: "2026-0001-C1",
  hoje: "2026-11-11",
  canal: "estabelecimento",
  signatario: "Fulana de Tal, CPF 000",
  empresa: { razao_social: "M C Melo Santos", nome_fantasia: "Delta Espaço e Eventos", cnpj: "06.328.111/0001-08", endereco: "Rua Rui Barbosa, 373, Centro, Bacabal-MA", cidade: "Bacabal" },
  cliente: { tipo: "PF", nome: "Ana Souza", nome_fantasia: null, documento: "52998224725", responsavel_nome: null, endereco: "Rua A, 10, Centro", cidade: "Bacabal", uf: "MA", telefone: "99981522414", email: "ana@x.com" },
  orcamento: { numero: "2026-0001", versao: 2, titulo: "Aniversário da Ana", convidados: 120, local_externo: null },
  espacos: ["Espaço maior"],
  evento: { inicio: "2027-05-20T22:00:00Z", fim: "2027-05-21T03:00:00Z" },
  itens: [{ descricao: "Locação do espaço", unidade: "evento", quantidade: 1, preco_unitario_centavos: 300000, total_centavos: 300000 }],
  subtotal_centavos: 300000, desconto_centavos: 0, total_centavos: 300000,
  parcelas: planoDeParcelas(300000, "2027-05-20", "2026-11-11", cfg),
};

describe("contrato", () => {
  const modelo = readFileSync("supabase/modelos/contrato_v1.txt", "utf8");
  const anexo = readFileSync("supabase/modelos/anexo_politica_v1.txt", "utf8");

  it("o modelo v1 só usa marcadores que o sistema preenche", () => {
    expect(marcadoresDesconhecidos(modelo, MARCADORES_CONHECIDOS)).toEqual([]);
    expect(Object.keys(valoresDoContrato(base)).sort()).toEqual([...MARCADORES_CONHECIDOS].sort());
  });

  it("preenche tudo e junta o anexo", () => {
    const t = montarTextoContrato(modelo, anexo, valoresDoContrato(base));
    expect(t).not.toMatch(/\{\{/);
    expect(t).toContain("Ana Souza, inscrito(a) no CPF sob o nº 529.982.247-25, residente e domiciliado(a) na Rua A, 10, Centro, Bacabal-MA");
    expect(t).toContain("R$ 3.000,00 (três mil reais)");
    expect(t).toContain("a) 1ª parcela (entrada): R$ 1.500,00, na assinatura deste contrato;\nb) 2ª parcela (saldo): R$ 1.500,00, até 13/05/2027.");
    expect(t).toContain("Data e horário: quinta-feira, 20/05/2027, das 19h00 às 00h00 do dia 21/05/2027");
    expect(t).toContain("Local: Espaço maior da Delta Espaço e Eventos, Rua Rui Barbosa");
    expect(t).toContain("Bacabal-MA, 11 de novembro de 2026.");
    expect(t).toContain("celebrado no estabelecimento da CONTRATADA.\n");
    expect(t).toContain("\nANEXO I\n\nDELTA ESPAÇO E EVENTOS");
  });

  it("fora do estabelecimento menciona o arrependimento", () => {
    const t = montarTextoContrato(modelo, null, valoresDoContrato({ ...base, canal: "fora_estabelecimento" }));
    expect(t).toContain("fora do estabelecimento da CONTRATADA. Por isso, o CONTRATANTE pode desistir em até 7 (sete) dias");
  });

  it("PJ é representada pelo responsável", () => {
    const q = qualificacaoDoCliente({ ...base.cliente, tipo: "PJ", nome: "Empresa X Ltda", documento: "06328111000108", responsavel_nome: "João" });
    expect(q).toMatch(/^Empresa X Ltda, pessoa jurídica inscrita no CNPJ sob o nº 06\.328\.111\/0001-08, com sede na .* neste ato representada por João\.$/);
  });

  it("recusa modelo com marcador desconhecido", () => {
    expect(() => montarTextoContrato("Olá {{cliente.cpf}}", null, valoresDoContrato(base))).toThrow(/cliente\.cpf/);
  });
});
