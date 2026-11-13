import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Vazio } from "@/componentes/ui";
import { exigirAlguma } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarCentavos } from "@/lib/dinheiro";
import { hojeNaDelta, instanteAtual } from "@/lib/datas";
import { diaNaDelta, periodoCurto, STATUS_RESERVA, type StatusReserva } from "@/lib/reservas";
import { PERMISSOES_EVENTOS, totalEquipe } from "@/lib/eventos";

export const metadata: Metadata = { title: "Eventos" };

type Evento = {
  id: string; titulo: string | null; status: StatusReserva; inicio: string; fim: string; cliente: string;
  convidados: number | null; tipo_evento: string | null; espacos: string[];
};

export default async function PaginaEventos() {
  const acesso = await exigirAlguma(PERMISSOES_EVENTOS);
  const supabase = await criarClienteServidor();
  const agora = instanteAtual();
  const { data } = await supabase.rpc("lista_eventos", {
    p_desde: new Date(agora - 30 * 86400000).toISOString(), p_ate: new Date(agora + 180 * 86400000).toISOString(),
  });
  const eventos = (data ?? []) as Evento[];
  const ids = eventos.map((e) => e.id);
  const verGastos = pode(acesso, "evento.fechar") || pode(acesso, "custo.ver");
  const [{ data: eq }, { data: ck }, { data: gs }] = ids.length
    ? await Promise.all([
        supabase.from("evento_equipe").select("reserva_id, quantidade, valor_unitario_centavos, pago_em").in("reserva_id", ids),
        supabase.from("evento_checklist").select("reserva_id, feito_em").in("reserva_id", ids),
        verGastos ? supabase.from("evento_custos").select("reserva_id, valor_centavos").in("reserva_id", ids).is("removido_em", null) : Promise.resolve({ data: [] }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const equipe = (eq ?? []) as { reserva_id: string; quantidade: number; valor_unitario_centavos: number; pago_em: string | null }[];
  const checklist = (ck ?? []) as { reserva_id: string; feito_em: string | null }[];
  const gastos = (gs ?? []) as { reserva_id: string; valor_centavos: number }[];
  const hoje = hojeNaDelta();
  const agoraIso = new Date(agora).toISOString();
  const proximos = eventos.filter((e) => e.fim >= agoraIso);
  const passados = eventos.filter((e) => e.fim < agoraIso).reverse();

  function Linha({ e }: { e: Evento }) {
    const meus = equipe.filter((x) => x.reserva_id === e.id);
    const pessoas = meus.reduce((s, x) => s + x.quantidade, 0);
    const itens = checklist.filter((x) => x.reserva_id === e.id);
    const feitos = itens.filter((x) => x.feito_em).length;
    const custo = totalEquipe(meus) + gastos.filter((g) => g.reserva_id === e.id).reduce((s, g) => s + Number(g.valor_centavos), 0);
    const dia = diaNaDelta(e.inicio);
    return (
      <li>
        <div>
          <Link href={`/eventos/${e.id}`}><strong>{e.titulo ?? "Evento"}</strong></Link>
          <div className="mudo" style={{ fontSize: ".85rem" }}>
            {e.cliente}{e.convidados ? ` · ${e.convidados} convidados` : ""}{e.espacos.length ? ` · ${e.espacos.join(" e ")}` : ""}
          </div>
          <div style={{ fontSize: ".82rem", marginTop: 2 }}>
            {pessoas ? <span className="selo">{pessoas} na equipe</span> : <span className="selo dourado">Equipe a combinar</span>}{" "}
            {itens.length > 0 && <span className={feitos === itens.length ? "selo" : "selo cinza"}>Checklist {feitos}/{itens.length}</span>}{" "}
            {verGastos && custo > 0 && <span className="selo cinza">Custos {formatarCentavos(custo)}</span>}
          </div>
        </div>
        <div style={{ textAlign: "right", flex: "0 0 auto" }}>
          <div><strong>{dia === hoje ? "Hoje" : periodoCurto(e.inicio, e.fim).split(" ")[0]}</strong></div>
          <div className="mudo" style={{ fontSize: ".85rem" }}>{periodoCurto(e.inicio, e.fim).split(" ").slice(1).join(" ")}</div>
          <span className={STATUS_RESERVA[e.status].classe}>{STATUS_RESERVA[e.status].rotulo.split(" (")[0]}</span>
        </div>
      </li>
    );
  }

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Eventos</h1>
          <p>Ficha do dia, equipe, checklist{verGastos ? ", gastos e fechamento" : ""} de cada evento.</p>
        </div>
      </div>
      <section className="cartao">
        <h2>Próximos ({proximos.length})</h2>
        {proximos.length ? <ul className="pedidos-lista rola-por-dentro" style={{ maxHeight: 520 }}>{proximos.map((e) => <Linha key={e.id} e={e} />)}</ul> : <Vazio compacto icone={CalendarDays} titulo="Nenhum evento marcado" texto="Os eventos aparecem aqui quando uma data é reservada." />}
      </section>
      <section className="cartao">
        <h2>Últimos 30 dias</h2>
        {passados.length ? <ul className="pedidos-lista rola-por-dentro" style={{ maxHeight: 420 }}>{passados.map((e) => <Linha key={e.id} e={e} />)}</ul> : <Vazio compacto icone={CalendarDays} titulo="Nenhum evento nos últimos 30 dias" />}
      </section>
    </>
  );
}
