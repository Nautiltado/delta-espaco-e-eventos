import type { Metadata } from "next";
import Link from "next/link";
import { exigirAcesso } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarDataHora, hojeNaDelta, instanteAtual } from "@/lib/datas";
import { formatarCentavos } from "@/lib/dinheiro";
import { descreverPeriodo, somarDias } from "@/lib/reservas";
import { ListaTarefas, SELECT_TAREFA, type Tarefa } from "./tarefas/lista";

export const metadata: Metadata = { title: "Início" };

function saudacao(): string {
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Fortaleza" }).format(new Date(instanteAtual())),
  );
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

type Proximo = { id: string; titulo: string | null; status: string; evento_inicio: string; evento_fim: string; expira_em: string | null; clientes: { nome: string } | null };

export default async function Inicio() {
  const acesso = await exigirAcesso();
  const primeiroNome = acesso.nome.split(" ")[0];
  const supabase = await criarClienteServidor();
  const agora = instanteAtual();
  const fimDoDia = new Date(agora + 86400000).toISOString();
  const hoje = hojeNaDelta();
  const verReservas = pode(acesso, "orcamento.ver");
  const verFinanceiro = pode(acesso, "pagamento.confirmar");

  const [{ data: tarefas }, abertos, proximos, atrasadas] = await Promise.all([
    supabase.from("tarefas").select(SELECT_TAREFA).is("concluida_em", null).eq("responsavel", acesso.id)
      .lte("vence_em", fimDoDia).order("vence_em").limit(10),
    verReservas
      ? supabase.from("orcamentos").select("status", { count: "exact", head: true }).eq("status", "enviado")
      : Promise.resolve({ count: null }),
    verReservas
      ? supabase.from("reservas").select("id, titulo, status, evento_inicio, evento_fim, expira_em, clientes(nome)")
          .eq("tipo", "evento").in("status", ["bloqueio_temporario", "confirmada", "em_preparacao"])
          .gte("evento_fim", new Date(agora).toISOString()).lt("evento_inicio", `${somarDias(hoje, 15)}T00:00:00-03:00`)
          .order("evento_inicio").limit(12)
      : Promise.resolve({ data: [] }),
    verFinanceiro
      ? supabase.from("parcelas_situacao").select("saldo_centavos, reserva_id, numero, vencimento").gt("saldo_centavos", 0).lt("vencimento", hoje).gt("numero", 1)
      : Promise.resolve({ data: [] }),
  ]);
  const eventos = (proximos.data ?? []) as unknown as Proximo[];
  const vencendo = eventos.filter((e) => e.status === "bloqueio_temporario" && e.expira_em && Date.parse(e.expira_em) - agora < 24 * 3600000);
  const emAtraso = (atrasadas.data ?? []) as { saldo_centavos: number }[];

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>{saudacao()}, {primeiroNome}</h1>
        </div>
      </div>

      <div className="atalhos">
        {pode(acesso, "orcamento.criar") && <Link className="botao" href="/orcamentos/novo">Novo orçamento</Link>}
        {verReservas && <Link className="botao secundario" href="/agenda">Agenda</Link>}
        {pode(acesso, "cliente.ver") && <Link className="botao secundario" href="/clientes">Clientes</Link>}
        {verFinanceiro && <Link className="botao secundario" href="/financeiro">Financeiro</Link>}
      </div>

      {(vencendo.length > 0 || emAtraso.length > 0) && (
        <section className="cartao" style={{ marginBottom: 18, borderColor: "var(--dourado)" }}>
          <h2>Atenção</h2>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {vencendo.map((e) => (
              <li key={e.id}>
                <Link href={`/reservas/${e.id}`}>{e.clientes?.nome ?? e.titulo}</Link>: a data segura vence {formatarDataHora(e.expira_em)}. Feche o contrato ou prorrogue.
              </li>
            ))}
            {emAtraso.length > 0 && (
              <li>
                <Link href="/financeiro">{emAtraso.length} {emAtraso.length === 1 ? "parcela atrasada" : "parcelas atrasadas"}</Link>
                {" "}somando {formatarCentavos(emAtraso.reduce((s, p) => s + Number(p.saldo_centavos), 0))}.
              </li>
            )}
          </ul>
        </section>
      )}

      <div className="grade">
        <section className="cartao">
          <h2>Para hoje</h2>
          <ListaTarefas tarefas={(tarefas ?? []) as unknown as Tarefa[]} agora={agora} />
          <p style={{ marginBottom: 0 }}>
            <Link href="/tarefas">Todas as tarefas</Link>
            {abertos.count ? <> · <Link href="/orcamentos">{abertos.count} orçamento(s) aguardando o cliente</Link></> : null}
          </p>
        </section>

        {verReservas && (
          <section className="cartao">
            <h2>Próximos 15 dias</h2>
            {eventos.length === 0 ? (
              <p className="mudo" style={{ margin: 0 }}>Nenhum evento marcado.</p>
            ) : (
              <ul className="lista-simples">
                {eventos.map((e) => (
                  <li key={e.id}>
                    <Link href={`/reservas/${e.id}`}><strong>{e.clientes?.nome ?? e.titulo}</strong></Link>
                    <span className="mudo">{descreverPeriodo(e.evento_inicio, e.evento_fim)}</span>
                    {e.status === "bloqueio_temporario" && <span className="selo dourado">aguardando contrato e entrada</span>}
                  </li>
                ))}
              </ul>
            )}
            <p style={{ marginBottom: 0 }}><Link href="/agenda">Ver a agenda</Link></p>
          </section>
        )}
      </div>
    </>
  );
}
