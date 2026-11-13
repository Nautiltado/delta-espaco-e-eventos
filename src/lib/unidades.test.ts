import { describe, expect, it } from "vitest";
import { equivalencia, mapaDeUnidades, quantidadeComUnidade, rotuloDaUnidade } from "@/lib/unidades";

describe("unidades", () => {
  it("cento equivale a 100 unidades", () => {
    expect(equivalencia("cento", 2)).toBe("200 unidades");
    expect(equivalencia("cento", 0.5)).toBe("50 unidades");
    expect(equivalencia("cento", 0.01)).toBe("1 unidade");
    expect(quantidadeComUnidade("cento", 2.5)).toBe("2,5 centos (250 unidades)");
  });
  it("unidades sem equivalência não inventam conversão", () => {
    expect(equivalencia("pessoa", 100)).toBeNull();
    expect(quantidadeComUnidade("pessoa", 100)).toBe("100 pessoas");
    expect(rotuloDaUnidade("servico", 1)).toBe("serviço");
  });
  it("usa a lista do banco quando há unidade nova", () => {
    const m = mapaDeUnidades([{ codigo: "duzia", singular: "dúzia", plural: "dúzias", equivale_quantidade: 12, equivale_unidade: "unidade", passo: 1, ativo: true, ordem: 200 }]);
    expect(quantidadeComUnidade("duzia", 3, m)).toBe("3 dúzias (36 unidades)");
    expect(rotuloDaUnidade("cento", 1, m)).toBe("cento");
  });
});
