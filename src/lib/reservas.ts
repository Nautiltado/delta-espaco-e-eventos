// Reservas: horários no fuso da Delta (UTC-3, sem horário de verão) e rótulos de situação.

export type StatusReserva = "bloqueio_temporario" | "confirmada" | "em_preparacao" | "realizada" | "cancelada" | "expirada";

export const STATUS_RESERVA: Record<StatusReserva, { rotulo: string; classe: string }> = {
  bloqueio_temporario: { rotulo: "Data segura (aguardando contrato e entrada)", classe: "selo dourado" },
  confirmada: { rotulo: "Confirmada", classe: "selo" },
  em_preparacao: { rotulo: "Em preparação", classe: "selo" },
  realizada: { rotulo: "Realizada", classe: "selo cinza" },
  cancelada: { rotulo: "Cancelada", classe: "selo erro" },
  expirada: { rotulo: "Bloqueio expirado", classe: "selo erro" },
};

export const STATUS_CONTRATO: Record<string, { rotulo: string; classe: string }> = {
  rascunho: { rotulo: "Rascunho", classe: "selo cinza" },
  enviado: { rotulo: "Gerado, aguardando assinatura", classe: "selo dourado" },
  assinado: { rotulo: "Assinado", classe: "selo" },
  cancelado: { rotulo: "Cancelado", classe: "selo erro" },
  substituido: { rotulo: "Substituído", classe: "selo cinza" },
};

export const FORMAS_PAGAMENTO: Record<string, string> = {
  pix: "Pix",
  transferencia: "Transferência",
  dinheiro: "Dinheiro",
  debito: "Cartão de débito",
  credito: "Cartão de crédito",
  outra: "Outra",
};

export const FORMAS_ASSINATURA: Record<string, string> = {
  presencial: "Presencial, em papel",
  gov_br: "Assinatura gov.br",
  eletronica: "Outra assinatura eletrônica",
  outra: "Outra",
};

export const INICIATIVAS: Record<string, string> = {
  cliente: "Desistência do cliente",
  delta: "Cancelamento pela Delta",
  arrependimento: "Arrependimento (até 7 dias, contrato fora do estabelecimento)",
  forca_maior: "Força maior",
};

const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Soma dias a uma data "YYYY-MM-DD". */
export function somarDias(data: string, dias: number): string {
  return new Date(Date.parse(`${data}T12:00:00Z`) + dias * 86400000).toISOString().slice(0, 10);
}

/**
 * Data + hora de início e de término (como digitadas) → instantes ISO no fuso da Delta.
 * Término igual ou antes do início é no dia seguinte (festa que entra pela madrugada).
 */
export function periodoDoEvento(
  data: string,
  inicio: string,
  fim: string,
): { ok: true; inicio: string; fim: string; virada: boolean } | { ok: false; erro: string } {
  if (!DATA.test(data) || Number.isNaN(Date.parse(`${data}T12:00:00Z`))) return { ok: false, erro: "Informe a data do evento." };
  if (!HORA.test(inicio) || !HORA.test(fim)) return { ok: false, erro: "Informe os horários no formato 19:00." };
  const virada = fim <= inicio;
  const diaFim = virada ? somarDias(data, 1) : data;
  return { ok: true, inicio: `${data}T${inicio}:00-03:00`, fim: `${diaFim}T${fim}:00-03:00`, virada };
}

const partes = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Fortaleza",
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function pedacos(iso: string) {
  const p = Object.fromEntries(partes.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { semana: p.weekday, data: `${p.day}/${p.month}/${p.year}`, hora: `${p.hour}h${p.minute}`, iso: `${p.year}-${p.month}-${p.day}` };
}

/** Data (YYYY-MM-DD) de um instante no fuso da Delta. */
export function diaNaDelta(iso: string): string {
  return pedacos(iso).iso;
}

/** Hora "19:00" de um instante no fuso da Delta. */
export function horaNaDelta(iso: string): string {
  return pedacos(iso).hora.replace("h", ":");
}

/** "sábado, 15/03/2028, das 19h00 às 23h00" ou, virando a noite, "… das 22h00 às 02h00 do dia 16/03/2028". */
export function descreverPeriodo(inicioIso: string, fimIso: string): string {
  const a = pedacos(inicioIso);
  const b = pedacos(fimIso);
  if (a.data === b.data) return `${a.semana}, ${a.data}, das ${a.hora} às ${b.hora}`;
  return `${a.semana}, ${a.data}, das ${a.hora} às ${b.hora} do dia ${b.data}`;
}

/** Versão curta para listas: "15/03 19h00–23h00". */
export function periodoCurto(inicioIso: string, fimIso: string): string {
  const a = pedacos(inicioIso);
  const b = pedacos(fimIso);
  return `${a.data.slice(0, 5)} ${a.hora}–${b.hora}${a.data === b.data ? "" : ` (${b.data.slice(0, 5)})`}`;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-11-11" → "11 de novembro de 2026" */
export function dataPorExtenso(data: string): string {
  const [a, m, d] = data.split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

export function nomeDoMes(mes: number): string {
  return MESES[mes - 1];
}
