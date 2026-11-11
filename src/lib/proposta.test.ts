import { describe, expect, it } from "vitest";
import { apresentacaoPadrao, condicoesGerais, dadosDoCabecalho, dataDoServico, descricaoDoServico, listaNatural, montarCardapio, pluralizar, valorPorPessoa } from "./proposta";

const it_ = (descricao: string, categoria: string | null, unidade: string, quantidade: number) =>
  ({ descricao, categoria, unidade, quantidade, preco_unitario_centavos: 100, total_centavos: 100 });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const base: any = {
  orcamento: { numero: "ORC-1", titulo: "Café da manhã completo", tipo: "buffet_externo", data_evento: "2026-11-12", horario: "08h30", convidados: 30, local_externo: null, espaco: null },
  itens: [
    it_("Coxinha de frango", "salgado_frito", "cento", 1), it_("Bolinha de queijo", "salgado_frito", "cento", 0.5),
    it_("Mini quiche Lorraine", "salgado_assado", "cento", 0.5),
    it_("Café com leite", "bebida", "litro", 3), it_("Garçom", "equipe", "evento", 2), it_("Locação do espaço menor", "espaco", "evento", 1),
    it_("Bolo de milho", "confeitaria", "unidade", 1), it_("Decoração com balões", null, "evento", 1),
  ],
  total_centavos: 120000, condicoes: "50% na contratação\n- restante 7 dias antes", observacoes: null, validade: "2026-11-18",
};

describe("proposta comercial", () => {
  it("data por extenso com dia da semana", () => expect(dataDoServico("2026-11-12")).toBe("Quinta-feira, 12 de novembro de 2026"));
  it("lista natural", () => expect(listaNatural(["a", "b", "c"])).toBe("a, b e c"));
  it("plural da equipe", () => {
    expect(pluralizar("Garçom")).toBe("garçons");
    expect(pluralizar("Auxiliar de cozinha")).toBe("auxiliares de cozinha");
    expect(pluralizar("Segurança")).toBe("seguranças");
  });
  it("cardápio por categoria, na ordem do catálogo, com quantidades úteis", () => {
    expect(montarCardapio(base.itens)).toEqual([
      { categoria: "Salgados fritos", composicao: "Coxinha de frango (100 un.) e bolinha de queijo (50 un.)." },
      { categoria: "Salgados assados", composicao: "Mini quiche Lorraine (50 un.)." },
      { categoria: "Bolos e confeitaria", composicao: "Bolo de milho." },
      { categoria: "Bebidas", composicao: "Café com leite (3 litros)." },
      { categoria: "Estrutura e equipe", composicao: "2 garçons e locação do espaço menor." },
      { categoria: "Outros", composicao: "Decoração com balões." },
    ]);
  });
  it("versão antiga sem categoria procura pelo nome", () => {
    const c = montarCardapio([it_("Coxinha de frango", null, "cento", 1)], new Map([["coxinha de frango", "salgado_frito"]]));
    expect(c[0].categoria).toBe("Salgados fritos");
  });
  it("textos automáticos", () => {
    expect(apresentacaoPadrao(base)).toBe(
      "A Delta Espaço e Eventos apresenta esta proposta de café da manhã completo para 30 convidados, com salgados fritos, salgados assados, bolos e confeitaria e bebidas. O serviço está previsto para quinta-feira, 12 de novembro de 2026, às 08h30.",
    );
    expect(descricaoDoServico(base)).toBe("Café da manhã completo para 30 convidados, incluindo alimentação, bebidas e estrutura e equipe");
    expect(valorPorPessoa(base)).toBe("R$ 40,00");
  });
  it("local vem da locação incluída nos itens", () => {
    expect(dadosDoCabecalho(base).local).toBe("Espaço menor · Delta Espaço e Eventos");
  });
  it("condições gerais", () => {
    const semEspaco = { ...base, itens: base.itens.filter((i: { categoria: string | null }) => i.categoria !== "espaco") };
    expect(condicoesGerais(semEspaco, 10)).toEqual([
      "Proposta válida até 18/11/2026.",
      "50% na contratação",
      "restante 7 dias antes",
      "O local de execução deverá ser confirmado pelo contratante para validação da logística.",
      "O cardápio e a quantidade de convidados deverão ser confirmados até 10 dias antes do evento.",
    ]);
  });
});
