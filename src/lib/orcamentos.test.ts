import { describe, expect, it } from "vitest";
import { lerQuantidade, margem, rotuloUnidade, totalItem } from "./orcamentos";

describe("orçamentos", () => {
  it("total do item arredonda como o banco", () => {
    expect(totalItem(90, 4550)).toBe(409500);
    expect(totalItem(1.5, 333)).toBe(500);
  });
  it("lê quantidade com vírgula", () => {
    expect(lerQuantidade("1,5")).toBe(1.5);
    expect(lerQuantidade("90")).toBe(90);
    expect(lerQuantidade("0")).toBeNull();
    expect(lerQuantidade("1,555")).toBeNull();
    expect(lerQuantidade("abc")).toBeNull();
  });
  it("margem", () => {
    expect(margem(100000, 60000)).toEqual({ valor: 40000, percentual: 40 });
    expect(margem(0, 0).percentual).toBe(0);
  });
  it("plural da unidade", () => {
    expect(rotuloUnidade("pessoa", 90)).toBe("pessoas");
    expect(rotuloUnidade("evento", 1)).toBe("evento");
    expect(rotuloUnidade("diaria", 2)).toBe("diárias");
    expect(rotuloUnidade("kg", 3)).toBe("kg");
  });
});
