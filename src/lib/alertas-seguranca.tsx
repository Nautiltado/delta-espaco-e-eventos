import "server-only";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { backupRecenteQualquer } from "@/lib/backup";

type Alerta = { texto: React.ReactNode; tom: "erro" | "alerta" };

/**
 * Avisos de segurança para a administração na Visão geral:
 * bloqueios por excesso de tentativas e acessos negados nos últimos 7 dias, e backup atrasado.
 */
export async function alertasDeSeguranca(supabase: SupabaseClient, agora: number): Promise<Alerta[]> {
  const desde = new Date(agora - 7 * 86400000).toISOString();
  const [bloqueios, negados, backupOk] = await Promise.all([
    supabase.from("auditoria").select("id", { count: "exact", head: true }).eq("acao", "BLOQUEIO_TENTATIVAS").gte("em", desde),
    supabase.from("auditoria").select("id", { count: "exact", head: true }).eq("acao", "ACESSO_NEGADO").gte("em", desde),
    process.env.SUPABASE_SECRET_KEY ? backupRecenteQualquer(30).catch(() => true) : Promise.resolve(true),
  ]);
  const lista: Alerta[] = [];
  const b = bloqueios.count ?? 0;
  const n = negados.count ?? 0;
  if (b) lista.push({ tom: "erro", texto: <><Link href="/auditoria?tabela=acessos">{b} {b === 1 ? "bloqueio" : "bloqueios"} por excesso de tentativas de entrar</Link> nos últimos 7 dias. Se não foi alguém da equipe errando a senha, pode ser alguém tentando adivinhar.</> });
  if (n >= 5) lista.push({ tom: "alerta", texto: <><Link href="/auditoria?tabela=acessos">{n} tentativas de abrir telas sem permissão</Link> nos últimos 7 dias.</> });
  if (!backupOk) lista.push({ tom: "erro", texto: <><Link href="/configuracoes?secao=backups">O backup diário não rodou</Link> nas últimas 30 horas. Faça um agora e confira.</> });
  return lista;
}
