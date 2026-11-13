import { describe, expect, it } from "vitest";
import { descreverPeriodo, diaNaDelta, horaNaDelta, periodoCurto, periodoDoEvento, dataPorExtenso } from "./reservas";

describe("periodoDoEvento", () => {
  it("mesmo dia", () => {
    expect(periodoDoEvento("2028-03-15", "19:00", "23:00")).toEqual({
      ok: true, inicio: "2028-03-15T19:00:00-03:00", fim: "2028-03-15T23:00:00-03:00", virada: false,
    });
  });
  it("vira a madrugada (inclusive virada de mês e ano)", () => {
    const r = periodoDoEvento("2027-12-31", "22:00", "05:00");
    expect(r).toMatchObject({ ok: true, fim: "2028-01-01T05:00:00-03:00", virada: true });
  });
  it("recusa formatos inválidos", () => {
    expect(periodoDoEvento("", "19:00", "23:00").ok).toBe(false);
    expect(periodoDoEvento("2028-03-15", "7h", "23:00").ok).toBe(false);
    expect(periodoDoEvento("2028-03-15", "24:00", "23:00").ok).toBe(false);
  });
});

describe("descrição do período", () => {
  it("no fuso da Delta", () => {
    expect(descreverPeriodo("2028-03-15T22:00:00Z", "2028-03-16T02:00:00Z")).toBe("quarta-feira, 15/03/2028, das 19h00 às 23h00");
    expect(descreverPeriodo("2028-03-16T01:00:00Z", "2028-03-16T08:00:00Z")).toBe(
      "quarta-feira, 15/03/2028, das 22h00 às 05h00 do dia 16/03/2028",
    );
    expect(periodoCurto("2028-03-16T01:00:00Z", "2028-03-16T08:00:00Z")).toBe("15/03 22h00–05h00 (16/03)");
    expect(diaNaDelta("2028-03-16T01:00:00Z")).toBe("2028-03-15");
    expect(horaNaDelta("2028-03-16T01:00:00Z")).toBe("22:00");
    expect(dataPorExtenso("2026-11-11")).toBe("11 de novembro de 2026");
  });
});
