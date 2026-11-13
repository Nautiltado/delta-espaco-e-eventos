// Datas exibidas sempre no fuso da Delta (Bacabal-MA).
export const FUSO = "America/Fortaleza";

const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: FUSO });
const diaSemana = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" });

/** "2027-05-20" → "20/05/2027" (data sem hora, sem conversão de fuso). */
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return "";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** "2027-05-20" → "qui., 20/05/2027" */
export function formatarDataComDia(iso: string | null | undefined): string {
  if (!iso) return "";
  return `${diaSemana.format(new Date(`${iso.slice(0, 10)}T12:00:00Z`))} ${formatarData(iso)}`;
}

export function formatarDataHora(iso: string | null | undefined): string {
  return iso ? dataHora.format(new Date(iso)) : "";
}

/** Data de hoje no fuso da Delta, como "YYYY-MM-DD". */
export function hojeNaDelta(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(agora);
}

/**
 * Relógio para páginas do servidor. Todas as páginas do painel são geradas por requisição
 * (depois de ler a sessão), então o horário é o do momento do acesso.
 */
export function instanteAtual(): number {
  return Date.now();
}
