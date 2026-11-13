import { describe, expect, it } from "vitest";
import { aplicarFiltro, classeDoItem, diasNoCalendario, indicadoresDoMes, periodoDaVista, situacaoDoEspaco, type ItemAgenda } from "./agenda";

const MENOR = "menor", MAIOR = "maior";
const base = { titulo: "Evento", motivo: null, observacoes: null, expira_em: null, criado_em: "2026-11-01T10:00:00Z", criado_por: null, cliente: "Ana", orcamento: null,
  valor_total: null, pago: null, entrada_paga: null, contrato: null };
const evento = (id: string, status: ItemAgenda["status"], espaco: string | null, ini: string, fim: string, ate?: string): ItemAgenda => ({
  ...base, id, tipo: "evento", status, inicio: ini, fim,
  espacos: espaco ? [{ id: espaco, nome: espaco, de: ini, ate: ate ?? fim }] : [],
});
const bloqueio = (id: string, espaco: string, ini: string, fim: string): ItemAgenda => ({
  ...base, id, tipo: "bloqueio_administrativo", status: "confirmada", motivo: "Reforma", inicio: ini, fim, espacos: [{ id: espaco, nome: espaco, de: ini, ate: fim }],
});

// 20/11 19h–23h no menor, ocupado até 03h do dia 21 (limpeza de 4 h)
const festa = evento("f", "confirmada", MENOR, "2026-11-20T19:00:00-03:00", "2026-11-20T23:00:00-03:00", "2026-11-21T03:00:00-03:00");
const segura = evento("s", "bloqueio_temporario", MAIOR, "2026-11-20T18:00:00-03:00", "2026-11-20T22:00:00-03:00");
const externo = evento("e", "confirmada", null, "2026-11-20T12:00:00-03:00", "2026-11-20T16:00:00-03:00");
const reforma = bloqueio("b", MAIOR, "2026-11-24T00:00:00-03:00", "2026-11-27T00:00:00-03:00");
const todos = [festa, segura, externo, reforma];

describe("agenda", () => {
  it("espaços são independentes e a limpeza conta no dia seguinte", () => {
    expect(situacaoDoEspaco(todos, MENOR, "2026-11-20").estado).toBe("reservado");
    expect(situacaoDoEspaco(todos, MAIOR, "2026-11-20").estado).toBe("aguardando");
    expect(situacaoDoEspaco(todos, MENOR, "2026-11-21").estado).toBe("reservado");
    expect(situacaoDoEspaco(todos, MENOR, "2026-11-22").estado).toBe("livre");
    expect(situacaoDoEspaco(todos, MAIOR, "2026-11-25").estado).toBe("bloqueado");
  });
  it("classes visuais distintas", () => {
    expect([festa, segura, externo, reforma].map(classeDoItem)).toEqual(["confirmada", "temporario", "externo", "bloqueio"]);
  });
  it("filtros: espaço e eventos externos", () => {
    expect(aplicarFiltro(todos, MENOR).map((i) => i.id)).toEqual(["f"]);
    expect(aplicarFiltro(todos, "externos").map((i) => i.id)).toEqual(["e"]);
    expect(aplicarFiltro(todos, MAIOR).map((i) => i.id)).toEqual(["s", "b"]);
  });
  it("bloqueio aparece em todos os dias que cobre", () => {
    expect(diasNoCalendario(reforma)).toEqual(["2026-11-24", "2026-11-25", "2026-11-26"]);
    expect(diasNoCalendario(festa)).toEqual(["2026-11-20"]);
  });
  it("indicadores do mês vêm só dos dados", () => {
    const k = indicadoresDoMes(todos, [{ id: MENOR, nome: "Espaço menor", tipo: "espaco", capacidade: 100 }, { id: MAIOR, nome: "Espaço maior", tipo: "espaco", capacidade: 500 }], "2026-11-01", "2026-11-20");
    expect(k.confirmados).toBe(2);
    expect(k.pendentes).toBe(1);
    expect(k.externos).toBe(1);
    expect(k.diasBloqueados).toBe(3);
    expect(k.livres.find((l) => l.id === MENOR)).toMatchObject({ livres: 9, total: 11 });
    expect(k.livres.find((l) => l.id === MAIOR)).toMatchObject({ livres: 7, total: 11 });
  });
  it("período de cada visão", () => {
    expect(periodoDaVista("mes", "2026-11-12")).toMatchObject({ inicio: "2026-11-01", fim: "2026-12-06" });
    expect(periodoDaVista("semana", "2026-11-12")).toMatchObject({ inicio: "2026-11-08", fim: "2026-11-15", anterior: "2026-11-01" });
    expect(periodoDaVista("dia", "2026-11-30")).toMatchObject({ inicio: "2026-11-30", fim: "2026-12-01", seguinte: "2026-12-01" });
    expect(periodoDaVista("lista", "2026-12-15")).toMatchObject({ inicio: "2026-12-01", fim: "2027-01-01", anterior: "2026-11-01" });
  });
});
