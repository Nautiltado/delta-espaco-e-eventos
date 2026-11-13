import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle, CalendarDays, ChefHat, CircleDollarSign, ClipboardList, FileText, Plus, ShoppingBag, Wallet,
} from "lucide-react";
import { exigirAcesso } from "@/lib/acesso";
import { alertasDeSeguranca } from "@/lib/alertas-seguranca";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarDataHora, hojeNaDelta, instanteAtual } from "@/lib/datas";
import { formatarCentavos } from "@/lib/dinheiro";
import { descreverPeriodo, diaNaDelta, horaNaDelta, somarDias, STATUS_RESERVA, type StatusReserva } from "@/lib/reservas";
import { diaDaDelta, disponivel, horaDaDelta, precisaRepor, STATUS_PEDIDO, type SaldoEstoque, type StatusPedido } from "@/lib/salgados";
import { Indicador, TituloCartao, Vazio } from "@/componentes/ui";
import { ListaTarefas, SELECT_TAREFA, type Tarefa } from "./tarefas/lista";

export const metadata: Metadata = { title: "Visão geral" };

function saudacao(): string {
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Fortaleza" }).format(new Date(instanteAtual())),
  );
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

type Evento = {
  id: string; titulo: string | null; status: StatusReserva; evento_inicio: string; evento_fim: string; expira_em: string | null;
  valor_total_centavos: number; clientes: { nome: string } | null;
};
type Pedido = { id: string; numero: string; cliente_nome: string; retirada_em: string; status: StatusPedido; total_centavos: number };
type Atividade = { quando: string; texto: React.ReactNode; tom?: string };

const vazioQ = Promise.resolve({ data: [] as never[], count: 0 });
const mesAtual = (hoje: string) => `${hoje.slice(0, 7)}-01`;

export default async function VisaoGeral() {
  const acesso = await exigirAcesso();
  const primeiroNome = acesso.nome.split(" ")[0];
  const supabase = await criarClienteServidor();
  const agora = instanteAtual();
  const agoraIso = new Date(agora).toISOString();
  const hoje = hojeNaDelta();
  const fimDoDia = new Date(agora + 86400000).toISOString();

  const verComercial = pode(acesso, "orcamento.ver");
  const verFinanceiro = pode(acesso, "pagamento.confirmar");
  const verEncomendas = pode(acesso, "salgados.criar") || pode(acesso, "producao.status");
  const verEstoque = pode(acesso, "estoque.movimentar") || pode(acesso, "producao.status");

  const [tarefasQ, eventosQ, enviadosQ, rascunhosQ, parcelasQ, pagosMesQ, encomendasMesQ, pedidosQ, estoqueQ, orcRecentesQ, pagRecentesQ] = await Promise.all([
    supabase.from("tarefas").select(SELECT_TAREFA).is("concluida_em", null).eq("responsavel", acesso.id).lte("vence_em", fimDoDia).order("vence_em").limit(8),
    verComercial
      ? supabase.from("reservas").select("id, titulo, status, evento_inicio, evento_fim, expira_em, valor_total_centavos, clientes(nome)")
          .eq("tipo", "evento").in("status", ["bloqueio_temporario", "confirmada", "em_preparacao"])
          .gte("evento_fim", agoraIso).lt("evento_inicio", `${somarDias(hoje, 30)}T00:00:00-03:00`).order("evento_inicio").limit(20)
      : vazioQ,
    verComercial ? supabase.from("orcamentos").select("id", { count: "exact", head: true }).eq("status", "enviado") : vazioQ,
    verComercial ? supabase.from("orcamentos").select("id", { count: "exact", head: true }).eq("status", "rascunho") : vazioQ,
    verFinanceiro ? supabase.from("parcelas_situacao").select("saldo_centavos, vencimento, numero").gt("saldo_centavos", 0) : vazioQ,
    verFinanceiro ? supabase.from("pagamentos").select("tipo, valor_centavos").gte("recebido_em", mesAtual(hoje)) : vazioQ,
    verFinanceiro || pode(acesso, "salgados.criar") ? supabase.from("pedido_pagamentos").select("valor_centavos").gte("recebido_em", mesAtual(hoje)) : vazioQ,
    verEncomendas
      ? supabase.from("pedidos").select("id, numero, cliente_nome, retirada_em, status, total_centavos")
          .in("status", ["aguardando_pagamento", "pago", "pronto"]).lt("retirada_em", `${somarDias(hoje, 1)}T00:00:00-03:00`).order("retirada_em").limit(12)
      : vazioQ,
    verEstoque ? supabase.from("estoque_saldo").select("*").eq("ativo", true) : vazioQ,
    verComercial ? supabase.from("orcamentos").select("id, numero, status, criado_em, clientes(nome)").order("criado_em", { ascending: false }).limit(5) : vazioQ,
    verFinanceiro ? supabase.from("pagamentos").select("id, tipo, valor_centavos, confirmado_em, parcelas(reserva_id)").order("confirmado_em", { ascending: false }).limit(5) : vazioQ,
  ]);

  const tarefas = (tarefasQ.data ?? []) as unknown as Tarefa[];
  const eventos = (eventosQ.data ?? []) as unknown as Evento[];
  const parcelas = (parcelasQ.data ?? []) as { saldo_centavos: number; vencimento: string; numero: number }[];
  const aReceber = parcelas.reduce((s, p) => s + Number(p.saldo_centavos), 0);
  const atrasadas = parcelas.filter((p) => p.vencimento < hoje && p.numero > 1);
  const vencido = atrasadas.reduce((s, p) => s + Number(p.saldo_centavos), 0);
  const recebidoEventos = ((pagosMesQ.data ?? []) as { tipo: string; valor_centavos: number }[])
    .reduce((s, p) => s + (p.tipo === "estorno" ? -1 : 1) * Number(p.valor_centavos), 0);
  const recebidoEncomendas = ((encomendasMesQ.data ?? []) as { valor_centavos: number }[]).reduce((s, p) => s + Number(p.valor_centavos), 0);
  const pedidos = (pedidosQ.data ?? []) as Pedido[];
  const pedidosHoje = pedidos.filter((p) => diaDaDelta(p.retirada_em) <= hoje);
  const aguardandoPagamento = pedidos.filter((p) => p.status === "aguardando_pagamento").length;
  const repor = ((estoqueQ.data ?? []) as SaldoEstoque[]).filter(precisaRepor);
  const vencendo = eventos.filter((e) => e.status === "bloqueio_temporario" && e.expira_em && Date.parse(e.expira_em) - agora < 24 * 3600000);
  const tarefasAtrasadas = tarefas.filter((t) => t.vence_em && Date.parse(t.vence_em) < agora).length;

  // atividades recentes: o que entrou de novo no comercial e no financeiro
  const atividades: Atividade[] = [];
  for (const o of (orcRecentesQ.data ?? []) as unknown as { id: string; numero: string; status: string; criado_em: string; clientes: { nome: string } | null }[]) {
    atividades.push({ quando: o.criado_em, texto: <>Orçamento <Link href={`/orcamentos/${o.id}`}>{o.numero}</Link> criado{o.clientes ? ` para ${o.clientes.nome}` : ""}</> });
  }
  for (const p of (pagRecentesQ.data ?? []) as unknown as { id: string; tipo: string; valor_centavos: number; confirmado_em: string; parcelas: { reserva_id: string } | null }[]) {
    atividades.push({
      quando: p.confirmado_em, tom: p.tipo === "estorno" ? "erro" : "ok",
      texto: <>{p.tipo === "estorno" ? "Estorno" : "Pagamento confirmado"} de {formatarCentavos(Number(p.valor_centavos))}{p.parcelas && <> · <Link href={`/reservas/${p.parcelas.reserva_id}`}>ver reserva</Link></>}</>,
    });
  }
  atividades.sort((a, b) => b.quando.localeCompare(a.quando));

  const seguranca = pode(acesso, "config.critica") ? await alertasDeSeguranca(supabase, agora) : [];
  const alertas: { texto: React.ReactNode; tom: "erro" | "alerta" }[] = [
    ...seguranca,
    ...vencendo.map((e) => ({ tom: "alerta" as const, texto: <><Link href={`/reservas/${e.id}`}>{e.clientes?.nome ?? e.titulo}</Link>: a data segura vence {formatarDataHora(e.expira_em)}. Feche o contrato ou prorrogue.</> })),
    ...(atrasadas.length ? [{ tom: "erro" as const, texto: <><Link href="/financeiro">{atrasadas.length} {atrasadas.length === 1 ? "parcela atrasada" : "parcelas atrasadas"}</Link> somando {formatarCentavos(vencido)}.</> }] : []),
    ...(aguardandoPagamento ? [{ tom: "alerta" as const, texto: <><Link href="/salgados">{aguardandoPagamento} {aguardandoPagamento === 1 ? "encomenda aguardando" : "encomendas aguardando"} pagamento</Link>: a cozinha só recebe depois de pago.</> }] : []),
    ...(repor.length ? [{ tom: "alerta" as const, texto: <><Link href="/salgados/cozinha">Repor estoque</Link>: {repor.map((r) => `${r.nome.toLowerCase()} (${Math.max(0, disponivel(r))})`).join(", ")}.</> }] : []),
    ...(tarefasAtrasadas ? [{ tom: "erro" as const, texto: <><Link href="/tarefas">{tarefasAtrasadas} {tarefasAtrasadas === 1 ? "tarefa atrasada" : "tarefas atrasadas"}</Link> com você.</> }] : []),
  ];

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>{saudacao()}, {primeiroNome}</h1>
          <p>Resumo do dia: eventos, dinheiro, encomendas e o que precisa da sua atenção.</p>
        </div>
        <div className="linha">
          {pode(acesso, "salgados.criar") && <Link className="botao secundario" href="/salgados/novo"><ShoppingBag aria-hidden />Novo pedido</Link>}
          {pode(acesso, "orcamento.criar") && <Link className="botao" href="/orcamentos/novo"><Plus aria-hidden />Novo orçamento</Link>}
        </div>
      </div>

      <div className="kpis">
        {verComercial && (
          <Indicador rotulo="Eventos nos próximos 30 dias" valor={eventos.length} icone={CalendarDays} href="/eventos"
            detalhe={eventos.length ? `Próximo: ${descreverPeriodo(eventos[0].evento_inicio, eventos[0].evento_fim).split(",")[0]}` : "Nenhum marcado"} />
        )}
        {verFinanceiro && (
          <Indicador rotulo="Recebido no mês" valor={formatarCentavos(recebidoEventos + recebidoEncomendas)} icone={CircleDollarSign} tom="marca" href="/financeiro"
            detalhe={`Eventos ${formatarCentavos(recebidoEventos)} · Encomendas ${formatarCentavos(recebidoEncomendas)}`} />
        )}
        {verFinanceiro && (
          <Indicador rotulo="A receber" valor={formatarCentavos(aReceber)} icone={Wallet} tom={vencido ? "erro" : "padrao"} href="/financeiro"
            detalhe={vencido ? <span className="atrasada">{formatarCentavos(vencido)} vencido</span> : `${parcelas.length} ${parcelas.length === 1 ? "parcela em aberto" : "parcelas em aberto"}`} />
        )}
        {verComercial && (
          <Indicador rotulo="Orçamentos em aberto" valor={(enviadosQ.count ?? 0) + (rascunhosQ.count ?? 0)} icone={FileText} tom="info" href="/orcamentos"
            detalhe={`${enviadosQ.count ?? 0} com o cliente · ${rascunhosQ.count ?? 0} em rascunho`} />
        )}
        {verEncomendas && (
          <Indicador rotulo="Encomendas para hoje" valor={pedidosHoje.length} icone={ChefHat} tom={aguardandoPagamento ? "alerta" : "padrao"} href="/salgados"
            detalhe={aguardandoPagamento ? `${aguardandoPagamento} aguardando pagamento` : "Todas pagas"} />
        )}
        {!verComercial && !verFinanceiro && (
          <Indicador rotulo="Suas tarefas para hoje" valor={tarefas.length} icone={ClipboardList} tom={tarefasAtrasadas ? "erro" : "padrao"} href="/tarefas"
            detalhe={tarefasAtrasadas ? `${tarefasAtrasadas} atrasada(s)` : "Em dia"} />
        )}
      </div>

      {alertas.length > 0 && (
        <section className="cartao" style={{ marginTop: 16 }} aria-labelledby="t-alertas">
          <h2 id="t-alertas"><AlertTriangle aria-hidden size={17} color="var(--alerta)" /> Precisa de atenção <span className="conta">{alertas.length}</span></h2>
          <ul className="lista-atividade">
            {alertas.map((a, i) => (
              <li key={i}><span className="ponto" style={{ background: a.tom === "erro" ? "var(--erro)" : "#d29a1d" }} aria-hidden /><span>{a.texto}</span></li>
            ))}
          </ul>
        </section>
      )}

      <div className="painel-lateral" style={{ marginTop: 16 }}>
        <div style={{ display: "grid", gap: 16 }}>
          {verComercial && (
            <section className="cartao sem-respiro">
              <TituloCartao titulo="Próximos eventos" conta={eventos.length} acao={<Link className="botao fantasma pequeno" href="/agenda">Abrir agenda</Link>} />
              {eventos.length === 0 ? (
                <Vazio icone={CalendarDays} titulo="Nenhum evento nos próximos 30 dias" texto="Quando uma data for reservada, ela aparece aqui." />
              ) : (
                <table className="empilhar">
                  <thead><tr><th>Data</th><th>Evento</th><th>Situação</th>{verFinanceiro && <th className="numero">Valor</th>}</tr></thead>
                  <tbody>
                    {eventos.slice(0, 8).map((e) => (
                      <tr key={e.id}>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <strong>{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Fortaleza" }).format(new Date(e.evento_inicio)).replace(".", "")}</strong>
                          <div className="mudo">{diaNaDelta(e.evento_inicio) === hoje ? "hoje · " : ""}{horaNaDelta(e.evento_inicio)}</div>
                        </td>
                        <td>
                          <Link href={`/eventos/${e.id}`}><strong>{e.titulo ?? "Evento"}</strong></Link>
                          <div className="mudo">{e.clientes?.nome}</div>
                        </td>
                        <td data-rotulo="Situação"><span className={STATUS_RESERVA[e.status].classe}>{e.status === "bloqueio_temporario" ? "Data segura" : STATUS_RESERVA[e.status].rotulo}</span></td>
                        {verFinanceiro && <td className="numero" data-rotulo="Valor">{formatarCentavos(Number(e.valor_total_centavos))}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}

          {verEncomendas && (
            <section className="cartao sem-respiro">
              <TituloCartao titulo="Encomendas de hoje" conta={pedidosHoje.length}
                acao={pode(acesso, "producao.status") ? <Link className="botao fantasma pequeno" href="/salgados/cozinha">Tela da cozinha</Link> : <Link className="botao fantasma pequeno" href="/salgados">Ver encomendas</Link>} />
              {pedidosHoje.length === 0 ? (
                <Vazio icone={ShoppingBag} titulo="Nenhuma retirada hoje" />
              ) : (
                <table className="empilhar">
                  <thead><tr><th>Retirada</th><th>Cliente</th><th>Situação</th><th className="numero">Total</th></tr></thead>
                  <tbody>
                    {pedidosHoje.map((p) => (
                      <tr key={p.id}>
                        <td><strong>{horaDaDelta(p.retirada_em)}</strong></td>
                        <td><Link href={`/salgados/${p.id}`}>{p.cliente_nome}</Link><div className="mudo">{p.numero}</div></td>
                        <td data-rotulo="Situação"><span className={STATUS_PEDIDO[p.status].classe}>{STATUS_PEDIDO[p.status].rotulo}</span></td>
                        <td className="numero" data-rotulo="Total">{formatarCentavos(p.total_centavos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}
        </div>

        <aside style={{ display: "grid", gap: 16 }}>
          <section className="cartao">
            <h2>Suas tarefas <span className="conta">{tarefas.length}</span></h2>
            {tarefas.length ? <ListaTarefas tarefas={tarefas} agora={agora} /> : <Vazio icone={ClipboardList} titulo="Nada para hoje" texto="Tarefas com prazo até amanhã aparecem aqui." />}
            <p style={{ margin: "10px 0 0", fontSize: ".85rem" }}><Link href="/tarefas">Todas as tarefas</Link></p>
          </section>
          {atividades.length > 0 && (
            <section className="cartao">
              <h2>Atividade recente</h2>
              <ul className="lista-atividade">
                {atividades.slice(0, 7).map((a, i) => (
                  <li key={i}>
                    <span className="ponto" aria-hidden style={a.tom === "ok" ? { background: "var(--sucesso)" } : a.tom === "erro" ? { background: "var(--erro)" } : undefined} />
                    <span>{a.texto}<div className="mudo" style={{ fontSize: ".76rem" }}>{formatarDataHora(a.quando)}</div></span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
