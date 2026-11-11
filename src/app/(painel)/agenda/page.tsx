import type { Metadata } from "next";
import Link from "next/link";
import { exigirPermissao } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarDataComDia, hojeNaDelta } from "@/lib/datas";
import { diaNaDelta, nomeDoMes, periodoCurto, somarDias, STATUS_RESERVA, type StatusReserva } from "@/lib/reservas";
import { FormularioBloqueio } from "../reservas/componentes";

export const metadata: Metadata = { title: "Agenda" };

type Linha = {
  reserva_id: string;
  tipo: "evento" | "bloqueio_administrativo";
  status: string;
  titulo: string | null;
  motivo: string | null;
  evento_inicio: string;
  evento_fim: string;
  expira_em: string | null;
  cliente_nome: string | null;
  recurso_id: string | null;
  recurso_nome: string | null;
};

type Ocupacao = Linha & { espacos: string[] };

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function classe(o: Ocupacao) {
  if (o.tipo === "bloqueio_administrativo") return "ocupacao bloqueio";
  return o.status === "bloqueio_temporario" ? "ocupacao temporario" : "ocupacao";
}

function abreviar(espacos: string[]) {
  return espacos.map((e) => e.replace(/^Espaço /i, "")).join(" + ");
}

export default async function PaginaAgenda({ searchParams }: { searchParams: Promise<{ mes?: string; espaco?: string; dia?: string }> }) {
  const acesso = await exigirPermissao("orcamento.ver");
  const { mes, espaco, dia } = await searchParams;
  const hoje = hojeNaDelta();
  const diaEscolhido = /^\d{4}-\d{2}-\d{2}$/.test(dia ?? "") ? dia! : null;
  const [ano, m] = (/^\d{4}-\d{2}$/.test(mes ?? "") ? mes! : (diaEscolhido ?? hoje).slice(0, 7)).split("-").map(Number);
  const primeiro = `${ano}-${String(m).padStart(2, "0")}-01`;
  const proximoMes = m === 12 ? `${ano + 1}-01-01` : `${ano}-${String(m + 1).padStart(2, "0")}-01`;
  const mesAnterior = m === 1 ? `${ano - 1}-12` : `${ano}-${String(m - 1).padStart(2, "0")}`;

  // Grade de semanas completas (domingo a sábado)
  const diaSemanaPrimeiro = new Date(`${primeiro}T12:00:00Z`).getUTCDay();
  const inicioGrade = somarDias(primeiro, -diaSemanaPrimeiro);
  const dias: string[] = [];
  for (let d = inicioGrade; d < proximoMes || dias.length % 7 !== 0; d = somarDias(d, 1)) dias.push(d);
  const fimGrade = somarDias(dias[dias.length - 1], 1);

  const supabase = await criarClienteServidor();
  let consulta = supabase
    .from("agenda")
    .select("reserva_id, tipo, status, titulo, motivo, evento_inicio, evento_fim, expira_em, cliente_nome, recurso_id, recurso_nome")
    .lt("evento_inicio", `${fimGrade}T00:00:00-03:00`)
    .gt("evento_fim", `${inicioGrade}T00:00:00-03:00`)
    .order("evento_inicio");
  if (espaco) consulta = consulta.eq("recurso_id", espaco);
  const [{ data }, { data: espacos }] = await Promise.all([
    consulta,
    supabase.from("recursos").select("id, nome").eq("tipo", "espaco").eq("ativo", true).order("capacidade"),
  ]);

  // Uma ocupação por reserva, com todos os espaços dela
  const porReserva = new Map<string, Ocupacao>();
  for (const l of (data ?? []) as Linha[]) {
    const atual = porReserva.get(l.reserva_id);
    if (atual) {
      if (l.recurso_nome && !atual.espacos.includes(l.recurso_nome)) atual.espacos.push(l.recurso_nome);
    } else porReserva.set(l.reserva_id, { ...l, espacos: l.recurso_nome ? [l.recurso_nome] : [] });
  }
  const ocupacoes = [...porReserva.values()];

  // Evento aparece no dia em que começa; bloqueio da agenda em todos os dias que cobre.
  const noDia = new Map<string, Ocupacao[]>();
  for (const o of ocupacoes) {
    const ini = diaNaDelta(o.evento_inicio);
    const fim = o.tipo === "bloqueio_administrativo" ? diaNaDelta(new Date(Date.parse(o.evento_fim) - 1).toISOString()) : ini;
    for (let d = ini; d <= fim; d = somarDias(d, 1)) noDia.set(d, [...(noDia.get(d) ?? []), o]);
  }
  const doDia = diaEscolhido ? noDia.get(diaEscolhido) ?? [] : [];
  const ocupadosNoDia = new Set(doDia.flatMap((o) => o.espacos));
  const podeCriar = pode(acesso, "orcamento.criar");
  const doMes = ocupacoes.filter((o) => diaNaDelta(o.evento_inicio) >= primeiro && diaNaDelta(o.evento_inicio) < proximoMes);
  const filtro = espaco ? `&espaco=${espaco}` : "";

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Agenda</h1>
          <p>Ocupação dos espaços. Cada evento bloqueia também as 4 horas de limpeza depois do término.</p>
        </div>
      </div>

      <div className="painel-lateral">
        <div>
          <section className="cartao">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Link className="botao secundario pequeno" href={`/agenda?mes=${mesAnterior}${filtro}`} aria-label="Mês anterior">←</Link>
                <h2 style={{ margin: 0 }}>{nomeDoMes(m).charAt(0).toUpperCase() + nomeDoMes(m).slice(1)} de {ano}</h2>
                <Link className="botao secundario pequeno" href={`/agenda?mes=${proximoMes.slice(0, 7)}${filtro}`} aria-label="Próximo mês">→</Link>
              </div>
              <div className="opcoes">
                <Link href={`/agenda?mes=${primeiro.slice(0, 7)}`} className={espaco ? "" : "selo"}>Todos</Link>
                {(espacos ?? []).map((e) => (
                  <Link key={e.id} href={`/agenda?mes=${primeiro.slice(0, 7)}&espaco=${e.id}`} className={espaco === e.id ? "selo" : ""}>{e.nome}</Link>
                ))}
                {hoje.slice(0, 7) !== primeiro.slice(0, 7) && <Link href={`/agenda${espaco ? `?espaco=${espaco}` : ""}`}>Hoje</Link>}
              </div>
            </div>

            <div className="calendario" role="grid" aria-label={`Agenda de ${nomeDoMes(m)} de ${ano}`}>
              {SEMANA.map((s) => <div key={s} className="dia-semana">{s}</div>)}
              {dias.map((d) => {
                const lista = noDia.get(d) ?? [];
                const fora = d < primeiro || d >= proximoMes;
                return (
                  <div key={d} className={`dia${fora ? " fora" : ""}${d === hoje ? " hoje" : ""}${d === diaEscolhido ? " escolhido" : ""}${lista.length ? "" : " vazio"}`} data-dia={d}>
                    <Link className="abrir-dia" href={`/agenda?mes=${d.slice(0, 7)}&dia=${d}${filtro}#dia-escolhido`} aria-label={`Ver ${formatarDataComDia(d)}`} />
                    <span className="numero-dia">{Number(d.slice(8))}</span>
                    {lista.map((o) => (
                      <Link key={o.reserva_id} href={`/reservas/${o.reserva_id}`} className={classe(o)} title={o.motivo ?? o.titulo ?? ""}>
                        <strong>{periodoCurto(o.evento_inicio, o.evento_fim).slice(6)}</strong> · {abreviar(o.espacos) || "externo"}
                        <br />
                        {o.tipo === "bloqueio_administrativo" ? `Bloqueio: ${o.motivo}` : o.cliente_nome ?? o.titulo}
                      </Link>
                    ))}
                  </div>
                );
              })}
            </div>
            <div className="legenda">
              <span>Confirmada</span>
              <span className="temporario">Data segura, aguardando contrato e entrada</span>
              <span className="bloqueio">Agenda bloqueada</span>
            </div>
          </section>
        </div>

        <aside>
          {diaEscolhido && (
            <section className="cartao" id="dia-escolhido" style={{ scrollMarginTop: 16 }}>
              <h2 style={{ textTransform: "capitalize" }}>{formatarDataComDia(diaEscolhido)}</h2>
              {(espacos ?? []).map((e) => (
                <p key={e.id} style={{ margin: "0 0 4px" }}>
                  {e.nome}:{" "}
                  {ocupadosNoDia.has(e.nome) ? <span className="selo erro">ocupado</span> : <span className="selo">livre</span>}
                </p>
              ))}
              {doDia.length > 0 && (
                <ul style={{ paddingLeft: 18, margin: "8px 0" }}>
                  {doDia.map((o) => (
                    <li key={o.reserva_id}>
                      <Link href={`/reservas/${o.reserva_id}`}>
                        {o.tipo === "bloqueio_administrativo" ? `Bloqueio: ${o.motivo}` : o.cliente_nome ?? o.titulo}
                      </Link>
                      <div className="mudo">
                        {periodoCurto(o.evento_inicio, o.evento_fim).slice(6)} · {abreviar(o.espacos)}
                        {o.tipo === "evento" && ` · ${STATUS_RESERVA[o.status as StatusReserva]?.rotulo.toLowerCase() ?? o.status}`}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {podeCriar && diaEscolhido >= hoje && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                  <Link className="botao" href={`/orcamentos/novo?data=${diaEscolhido}${espaco ? `&espaco=${espaco}` : ""}`}>
                    Novo orçamento para este dia
                  </Link>
                  <span className="mudo" style={{ fontSize: ".82rem" }}>O orçamento não segura a data. Segure depois, na tela do orçamento.</span>
                </div>
              )}
              {diaEscolhido < hoje && <p className="mudo" style={{ marginBottom: 0 }}>Dia que já passou.</p>}
            </section>
          )}
          <section className="cartao">
            <h2>No mês</h2>
            {doMes.length === 0 ? (
              <p className="mudo" style={{ margin: 0 }}>Nada marcado.</p>
            ) : (
              <table>
                <tbody>
                  {doMes.map((o) => (
                    <tr key={o.reserva_id}>
                      <td style={{ whiteSpace: "nowrap" }}>{periodoCurto(o.evento_inicio, o.evento_fim).slice(0, 5)}</td>
                      <td>
                        <Link href={`/reservas/${o.reserva_id}`}>{o.tipo === "bloqueio_administrativo" ? `Bloqueio: ${o.motivo}` : o.titulo}</Link>
                        <div className="mudo">{abreviar(o.espacos)}{o.status === "bloqueio_temporario" ? " · aguardando" : ""}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mudo" style={{ marginBottom: 0 }}>Clique num dia para ver os espaços livres e começar um orçamento para ele.</p>
          </section>

          {pode(acesso, "bloqueio.criar") && (
            <section className="cartao">
              <details>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>Bloquear a agenda</summary>
                <p className="mudo">Manutenção, uso próprio ou qualquer motivo para não vender um horário.</p>
                <FormularioBloqueio key={diaEscolhido ?? ""} espacos={espacos ?? []} hoje={hoje} dataInicial={diaEscolhido && diaEscolhido >= hoje ? diaEscolhido : ""} />
              </details>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
