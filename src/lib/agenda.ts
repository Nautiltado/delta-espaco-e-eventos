// Agenda: tipos e cálculos puros (sem banco), usados pela página e testados à parte.
import { diaNaDelta, horaNaDelta, somarDias } from "@/lib/reservas";

export type Vista = "mes" | "semana" | "dia" | "lista";
export const VISTAS: Record<Vista, string> = { mes: "Mês", semana: "Semana", dia: "Dia", lista: "Lista" };

/** "todos", o id de um espaço ou "externos". */
export type Filtro = string;

export type EspacoAgenda = { id: string; nome: string; tipo: string; capacidade: number | null };

export type ItemAgenda = {
  id: string;
  tipo: "evento" | "bloqueio_administrativo";
  status: "bloqueio_temporario" | "confirmada" | "em_preparacao" | "realizada";
  titulo: string | null;
  motivo: string | null;
  observacoes: string | null;
  inicio: string;
  fim: string;
  expira_em: string | null;
  criado_em: string;
  criado_por: string | null;
  cliente: string | null;
  orcamento: { id: string; numero: string; tipo: string | null; convidados: number | null; local_externo: string | null } | null;
  /** Espaços ocupados, com o período real ocupado (inclui montagem, desmontagem e limpeza). */
  espacos: { id: string; nome: string; de: string; ate: string }[];
  valor_total: number | null;
  pago: number | null;
  entrada_paga: boolean | null;
  contrato: string | null;
};

export type Classe = "confirmada" | "temporario" | "bloqueio" | "externo";

export function classeDoItem(i: Pick<ItemAgenda, "tipo" | "status" | "espacos">): Classe {
  if (i.tipo === "bloqueio_administrativo") return "bloqueio";
  if (i.espacos.length === 0) return "externo";
  return i.status === "bloqueio_temporario" ? "temporario" : "confirmada";
}

export const ROTULO_CLASSE: Record<Classe, string> = {
  confirmada: "Reserva confirmada",
  temporario: "Aguardando contrato e entrada",
  bloqueio: "Bloqueio administrativo",
  externo: "Evento externo",
};

export const inicioDoDia = (d: string) => `${d}T00:00:00-03:00`;
const ms = (iso: string) => Date.parse(iso);

/** O item cobre algum momento do dia (pelo evento em si ou, num espaço, pelo período ocupado). */
export function ocupaODia(i: ItemAgenda, dia: string): boolean {
  const a = ms(inicioDoDia(dia)), b = ms(inicioDoDia(somarDias(dia, 1)));
  if (ms(i.inicio) < b && ms(i.fim) > a) return true;
  return i.espacos.some((e) => ms(e.de) < b && ms(e.ate) > a);
}

/** Dias em que o item aparece no calendário: evento no dia em que começa; bloqueio em todos os dias que cobre. */
export function diasNoCalendario(i: ItemAgenda): string[] {
  const ini = diaNaDelta(i.inicio);
  if (i.tipo !== "bloqueio_administrativo") return [ini];
  const fim = diaNaDelta(new Date(ms(i.fim) - 1).toISOString());
  const dias: string[] = [];
  for (let d = ini; d <= fim && dias.length < 400; d = somarDias(d, 1)) dias.push(d);
  return dias;
}

export function aplicarFiltro(itens: ItemAgenda[], filtro: Filtro): ItemAgenda[] {
  if (filtro === "todos") return itens;
  if (filtro === "externos") return itens.filter((i) => i.tipo === "evento" && i.espacos.length === 0);
  return itens.filter((i) => i.espacos.some((e) => e.id === filtro));
}

export type SituacaoEspaco = {
  estado: "livre" | "reservado" | "aguardando" | "bloqueado";
  horarios: { de: string; ate: string; rotulo: string; reservaId: string }[];
};

export const ROTULO_ESTADO: Record<SituacaoEspaco["estado"], string> = {
  livre: "Disponível",
  reservado: "Reservado",
  aguardando: "Aguardando formalização",
  bloqueado: "Bloqueado",
};

/** Situação de um espaço num dia: o mais restritivo entre o que o ocupa, e os horários ocupados (com folgas). */
export function situacaoDoEspaco(itens: ItemAgenda[], espacoId: string, dia: string): SituacaoEspaco {
  const a = ms(inicioDoDia(dia)), b = ms(inicioDoDia(somarDias(dia, 1)));
  const horarios: SituacaoEspaco["horarios"] = [];
  let estado: SituacaoEspaco["estado"] = "livre";
  const peso = { livre: 0, aguardando: 1, reservado: 2, bloqueado: 3 } as const;
  for (const i of itens) {
    for (const e of i.espacos) {
      if (e.id !== espacoId || !(ms(e.de) < b && ms(e.ate) > a)) continue;
      const este = i.tipo === "bloqueio_administrativo" ? "bloqueado" : i.status === "bloqueio_temporario" ? "aguardando" : "reservado";
      if (peso[este] > peso[estado]) estado = este;
      horarios.push({
        de: e.de, ate: e.ate, reservaId: i.id,
        rotulo: i.tipo === "bloqueio_administrativo" ? `Bloqueio: ${i.motivo ?? ""}` : (i.titulo ?? "Evento"),
      });
    }
  }
  horarios.sort((x, y) => x.de.localeCompare(y.de));
  return { estado, horarios };
}

/** "18:00 – 03:00 (dia 21)" no fuso da Delta. */
export function faixaHorario(deIso: string, ateIso: string, dia?: string): string {
  const fimDia = diaNaDelta(ateIso), iniDia = diaNaDelta(deIso);
  const sufixoFim = fimDia !== (dia ?? iniDia) ? ` (dia ${fimDia.slice(8)})` : "";
  const sufixoIni = dia && iniDia !== dia ? ` (dia ${iniDia.slice(8)})` : "";
  return `${horaNaDelta(deIso)}${sufixoIni} – ${horaNaDelta(ateIso)}${sufixoFim}`;
}

/** Indicadores do mês, só com o que está no banco (nada estimado). */
export function indicadoresDoMes(itens: ItemAgenda[], espacos: EspacoAgenda[], primeiroDoMes: string, hoje: string) {
  const fimMes = somarDias(primeiroDoMes, 40).slice(0, 8) + "01";
  const doMes = itens.filter((i) => {
    const d = diaNaDelta(i.inicio);
    return (d >= primeiroDoMes && d < fimMes) || (i.tipo === "bloqueio_administrativo" && diasNoCalendario(i).some((x) => x >= primeiroDoMes && x < fimMes));
  });
  const eventos = doMes.filter((i) => i.tipo === "evento");
  const diasBloqueados = new Set(doMes.filter((i) => i.tipo === "bloqueio_administrativo").flatMap(diasNoCalendario).filter((d) => d >= primeiroDoMes && d < fimMes));
  const desde = hoje > primeiroDoMes ? hoje : primeiroDoMes;
  const livres = espacos.filter((e) => e.tipo === "espaco").map((e) => {
    let n = 0, total = 0;
    for (let d = desde; d < fimMes; d = somarDias(d, 1)) {
      total++;
      if (situacaoDoEspaco(itens, e.id, d).estado === "livre") n++;
    }
    return { id: e.id, nome: e.nome, livres: n, total };
  });
  return {
    confirmados: eventos.filter((i) => i.status !== "bloqueio_temporario").length,
    pendentes: eventos.filter((i) => i.status === "bloqueio_temporario").length,
    externos: eventos.filter((i) => i.espacos.length === 0).length,
    diasBloqueados: diasBloqueados.size,
    livres,
  };
}

/** Período carregado e navegação de cada visão. */
export function periodoDaVista(vista: Vista, ancora: string) {
  const [ano, mes] = ancora.split("-").map(Number);
  const primeiro = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const proximo = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
  const anteriorMes = mes === 1 ? `${ano - 1}-12-01` : `${ano}-${String(mes - 1).padStart(2, "0")}-01`;
  const dow = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();
  if (vista === "semana") {
    const ini = somarDias(ancora, -dow(ancora));
    return { inicio: ini, fim: somarDias(ini, 7), anterior: somarDias(ini, -7), seguinte: somarDias(ini, 7), primeiroDoMes: primeiro };
  }
  if (vista === "dia") return { inicio: ancora, fim: somarDias(ancora, 1), anterior: somarDias(ancora, -1), seguinte: somarDias(ancora, 1), primeiroDoMes: primeiro };
  if (vista === "lista") return { inicio: primeiro, fim: proximo, anterior: anteriorMes, seguinte: proximo, primeiroDoMes: primeiro };
  // mês: semanas completas, de domingo a sábado
  const ini = somarDias(primeiro, -dow(primeiro));
  let fim = proximo;
  while (dow(fim) !== 0) fim = somarDias(fim, 1);
  return { inicio: ini, fim, anterior: anteriorMes, seguinte: proximo, primeiroDoMes: primeiro };
}

export function diasEntre(inicio: string, fim: string): string[] {
  const out: string[] = [];
  for (let d = inicio; d < fim && out.length < 62; d = somarDias(d, 1)) out.push(d);
  return out;
}
