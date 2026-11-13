import { NextResponse } from "next/server";
import { obterSessao } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDoBanco } from "@/lib/erros";
import { inicioDoDia, periodoDaVista, VISTAS, type ItemAgenda, type Vista } from "@/lib/agenda";

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Dados de outro período da agenda (para trocar de mês/semana/dia sem esperar a página inteira).
 * É uma rota comum, e não uma ação do servidor, para rodar em paralelo: ações rodam em fila e
 * a pré-carga dos meses vizinhos atrasaria o salvar.
 * Mesmo recorte da página: o mês inteiro (para os números) mais o que a visão mostrar além dele.
 */
export async function GET(req: Request) {
  const sessao = await obterSessao();
  if (!sessao?.acesso || sessao.trocarSenha || !pode(sessao.acesso, "orcamento.ver")) {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const u = new URL(req.url);
  const vista = u.searchParams.get("vista") ?? "";
  const ancora = u.searchParams.get("data") ?? "";
  if (!(vista in VISTAS) || !DATA.test(ancora)) return NextResponse.json({ erro: "Período inválido." }, { status: 400 });
  const v = vista as Vista;
  const periodo = periodoDaVista(v, ancora);
  const grade = periodoDaVista("mes", ancora);
  const de = periodo.inicio < grade.inicio ? periodo.inicio : grade.inicio;
  const ate = periodo.fim > grade.fim ? periodo.fim : grade.fim;
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("agenda_detalhes", { p_inicio: inicioDoDia(de), p_fim: inicioDoDia(ate) });
  if (error) return NextResponse.json({ erro: mensagemDoBanco(error) }, { status: 500 });
  return NextResponse.json(
    { vista: v, ancora, periodo, itens: (data ?? []) as ItemAgenda[] },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
