import { NextResponse } from "next/server";
import { backupRecente, fazerBackup } from "@/lib/backup";

/**
 * Backup diário, chamado pelo agendador da Vercel (vercel.json, às 3h de Fortaleza).
 * Não devolve dado nenhum, só "feito" ou "já feito hoje", e faz no máximo um por dia:
 * quem chamar de fora não ganha nada. Se a variável CRON_SECRET existir na Vercel, ela é exigida.
 */
export const maxDuration = 60;

export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (segredo && req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!process.env.SUPABASE_SECRET_KEY) return NextResponse.json({ ok: false, motivo: "sem chave" }, { status: 503 });
  try {
    if (await backupRecente()) return NextResponse.json({ ok: true, feito: false, motivo: "já feito nas últimas 20 horas" });
    const r = await fazerBackup("automatico");
    return NextResponse.json({ ok: true, feito: true, tabelas: r.tabelas });
  } catch (e) {
    console.error("[backup]", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
