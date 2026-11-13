"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  CalendarCheck, CalendarPlus, ChevronLeft, ChevronRight, FileText, Lock, MapPin, Search, Truck, Users, X,
} from "lucide-react";
import {
  aplicarFiltro, classeDoItem, diasEntre, diasNoCalendario, faixaHorario, indicadoresDoMes, ocupaODia,
  ROTULO_CLASSE, ROTULO_ESTADO, situacaoDoEspaco, VISTAS,
  type EspacoAgenda, type Filtro, type ItemAgenda, type Vista,
} from "@/lib/agenda";
import { diaNaDelta, horaNaDelta, nomeDoMes, somarDias, STATUS_RESERVA, type StatusReserva } from "@/lib/reservas";
import { formatarDataComDia, formatarDataHora } from "@/lib/datas";
import { formatarCentavos } from "@/lib/dinheiro";
import { TIPOS_ORCAMENTO } from "@/lib/orcamentos";
import {
  bloquearPeriodo, consultarDisponibilidade, criarEventoRapido, removerBloqueioDoPainel, type Disponibilidade,
} from "./actions";

export type Folgas = {
  montagem: number; desmontagem: number; limpeza: number; intervalo: number; seguraHoras: number;
  porEspaco: Record<string, { montagem: number | null; desmontagem: number | null; limpeza: number | null; intervalo: number | null }>;
};

type Props = {
  vista: Vista; ancora: string; hoje: string; diaInicial: string | null; filtroInicial: Filtro;
  periodo: { inicio: string; fim: string; anterior: string; seguinte: string; primeiroDoMes: string };
  itens: ItemAgenda[]; espacos: EspacoAgenda[]; folgas: Folgas;
  clientes: { id: string; nome: string }[]; atendentes: { id: string; nome: string }[];
  usuario: { id: string; nome: string };
  permissoes: { criar: boolean; bloquear: boolean; removerBloqueio: boolean; financeiro: boolean };
};

type Modo = "resumo" | "evento" | "externo" | "bloqueio" | "consulta";

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MAX_CHIPS = 3;
const h = (n: number) => `${String(n).replace(".", ",")} h`;
const curto = (nome: string) => nome.replace(/^Espaço /i, "");
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function rotuloPeriodo(vista: Vista, ancora: string, inicio: string, fim: string) {
  const [ano, mes] = ancora.split("-").map(Number);
  if (vista === "mes" || vista === "lista") return `${maiuscula(nomeDoMes(mes))} de ${ano}`;
  if (vista === "dia") return maiuscula(formatarDataComDia(ancora));
  const ult = somarDias(fim, -1);
  const m1 = nomeDoMes(Number(inicio.slice(5, 7))).slice(0, 3), m2 = nomeDoMes(Number(ult.slice(5, 7))).slice(0, 3);
  return `${Number(inicio.slice(8))}${m1 !== m2 ? ` de ${m1}` : ""} – ${Number(ult.slice(8))} de ${m2} de ${ult.slice(0, 4)}`;
}

function tituloItem(i: ItemAgenda) {
  return i.tipo === "bloqueio_administrativo" ? `Bloqueio: ${i.motivo ?? ""}` : (i.titulo ?? i.cliente ?? "Evento");
}

function localItem(i: ItemAgenda, completo = false) {
  if (i.espacos.length) return i.espacos.map((e) => (completo ? e.nome : curto(e.nome))).join(" + ");
  return i.orcamento?.local_externo ? `Externo · ${i.orcamento.local_externo}` : "Externo";
}

// ====================================================================================== central

export function CentralAgenda(p: Props) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>(p.filtroInicial);
  const [dia, setDia] = useState<string | null>(p.diaInicial);
  const [modo, setModo] = useState<Modo>("resumo");

  const espacos = p.espacos.filter((e) => e.tipo === "espaco");
  const visiveis = useMemo(() => aplicarFiltro(p.itens, filtro), [p.itens, filtro]);
  const porDia = useMemo(() => {
    const m = new Map<string, ItemAgenda[]>();
    for (const i of visiveis) for (const d of diasNoCalendario(i)) m.set(d, [...(m.get(d) ?? []), i]);
    for (const l of m.values()) l.sort((a, b) => a.inicio.localeCompare(b.inicio));
    return m;
  }, [visiveis]);
  const ind = useMemo(() => indicadoresDoMes(p.itens, p.espacos, p.periodo.primeiroDoMes, p.hoje), [p.itens, p.espacos, p.periodo.primeiroDoMes, p.hoje]);

  const atualizarUrl = useCallback((mudar: Record<string, string | null>) => {
    const u = new URL(window.location.href);
    for (const [k, v] of Object.entries(mudar)) if (v) u.searchParams.set(k, v); else u.searchParams.delete(k);
    window.history.replaceState(null, "", u.toString());
  }, []);

  const abrir = useCallback((d: string, m: Modo = "resumo") => {
    setDia(d); setModo(m); atualizarUrl({ dia: d });
  }, [atualizarUrl]);
  const fechar = useCallback(() => { setDia(null); setModo("resumo"); atualizarUrl({ dia: null }); }, [atualizarUrl]);
  const filtrar = (f: Filtro) => { setFiltro(f); atualizarUrl({ espaco: f === "todos" ? null : f }); };

  const href = (vista: Vista, data: string) => {
    const s = new URLSearchParams({ vista, data });
    if (filtro !== "todos") s.set("espaco", filtro);
    return `/agenda?${s}`;
  };

  const f = p.folgas;
  const descricao = [
    "Os dois espaços são independentes.",
    `Cada evento ocupa o espaço também ${f.montagem ? `${h(f.montagem)} antes (montagem) e ` : ""}${h(f.desmontagem + f.limpeza + f.intervalo)} depois`,
    `(${[f.desmontagem && `desmontagem ${h(f.desmontagem)}`, `limpeza ${h(f.limpeza)}`, f.intervalo && `intervalo ${h(f.intervalo)}`].filter(Boolean).join(", ")}).`,
  ].join(" ");
  const diaAcao = dia && dia >= p.hoje ? dia : p.hoje;

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Agenda</h1>
          <p>{descricao}</p>
        </div>
        {(p.permissoes.criar || p.permissoes.bloquear) && (
          <div className="linha">
            {p.permissoes.bloquear && (
              <button type="button" className="botao secundario" onClick={() => abrir(diaAcao, "bloqueio")}>
                <Lock aria-hidden /> Bloquear data
              </button>
            )}
            {p.permissoes.criar && (
              <button type="button" className="botao" onClick={() => abrir(diaAcao, "evento")}>
                <CalendarPlus aria-hidden /> Novo evento
              </button>
            )}
          </div>
        )}
      </div>

      <section className="cartao agenda-barra">
        <div className="agenda-nav">
          <Link className="botao secundario pequeno" href={href(p.vista, p.hoje)}>Hoje</Link>
          <Link className="botao fantasma pequeno icone" href={href(p.vista, p.periodo.anterior)} aria-label="Anterior"><ChevronLeft aria-hidden /></Link>
          <Link className="botao fantasma pequeno icone" href={href(p.vista, p.periodo.seguinte)} aria-label="Seguinte"><ChevronRight aria-hidden /></Link>
          <h2>{rotuloPeriodo(p.vista, p.ancora, p.periodo.inicio, p.periodo.fim)}</h2>
        </div>
        <div className="agenda-filtros">
          <nav className="abas" aria-label="Visão">
            {(Object.keys(VISTAS) as Vista[]).map((v) => (
              <Link key={v} className="aba" href={href(v, dia ?? p.ancora)} aria-current={v === p.vista ? "page" : undefined}>{VISTAS[v]}</Link>
            ))}
          </nav>
          <div className="abas" role="group" aria-label="Filtrar por espaço">
            {[{ id: "todos", nome: "Todos" }, ...espacos, { id: "externos", nome: "Eventos externos" }].map((e) => (
              <button key={e.id} type="button" className={`aba${filtro === e.id ? " ativa" : ""}`} aria-pressed={filtro === e.id} onClick={() => filtrar(e.id)}>
                {e.nome}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="agenda-layout">
        <section className="cartao sem-respiro agenda-vista">
          {p.vista === "mes" && <VistaMes p={p} porDia={porDia} dia={dia} abrir={abrir} />}
          {p.vista === "semana" && <VistaSemana p={p} porDia={porDia} dia={dia} abrir={abrir} />}
          {p.vista === "dia" && <VistaDia p={p} itens={visiveis} espacos={filtro === "todos" ? espacos : espacos.filter((e) => e.id === filtro)} mostrarExternos={filtro === "todos" || filtro === "externos"} abrir={abrir} />}
          {p.vista === "lista" && <VistaLista p={p} itens={visiveis} abrir={abrir} />}
          <div className="legenda agenda-legenda">
            <span>Reserva confirmada</span>
            <span className="temporario">Aguardando contrato e entrada</span>
            <span className="bloqueio">Bloqueio administrativo</span>
            <span className="externo">Evento externo</span>
          </div>
        </section>

        <aside className="agenda-resumo" aria-label="Resumo do mês">
          <section className="cartao">
            <h2>{maiuscula(nomeDoMes(Number(p.periodo.primeiroDoMes.slice(5, 7))))} em números</h2>
            <dl className="resumo-numeros">
              <div><dt>Eventos confirmados</dt><dd>{ind.confirmados}</dd></div>
              <div><dt>Reservas pendentes</dt><dd className={ind.pendentes ? "alerta" : ""}>{ind.pendentes}</dd></div>
              <div><dt>Datas bloqueadas</dt><dd>{ind.diasBloqueados}</dd></div>
              <div><dt>Eventos externos</dt><dd>{ind.externos}</dd></div>
            </dl>
          </section>
          <section className="cartao">
            <h2>Espaços disponíveis</h2>
            {ind.livres.length === 0 ? <p className="mudo">Nenhum espaço cadastrado.</p> : ind.livres.map((e) => (
              <div key={e.id} className="resumo-espaco">
                <div className="linha" style={{ justifyContent: "space-between" }}>
                  <span>{e.nome}</span>
                  <strong>{e.livres} <span className="mudo">de {e.total} dias</span></strong>
                </div>
                <div className="barra-livre" aria-hidden><span style={{ width: `${e.total ? (100 * e.livres) / e.total : 0}%` }} /></div>
              </div>
            ))}
            <p className="mudo pequeno">Dias sem nada ocupando o espaço, de hoje até o fim do mês.</p>
          </section>
        </aside>
      </div>

      {dia && (
        <PainelDoDia
          p={p} dia={dia} modo={modo} setModo={setModo} fechar={fechar}
          aoMudar={() => router.refresh()}
        />
      )}
    </>
  );
}

// ====================================================================================== visões

type PropsVista = { p: Props; porDia: Map<string, ItemAgenda[]>; dia: string | null; abrir: (d: string) => void };

function Chip({ i, detalhado = false }: { i: ItemAgenda; detalhado?: boolean }) {
  const c = classeDoItem(i);
  const status = i.tipo === "evento" ? STATUS_RESERVA[i.status as StatusReserva]?.rotulo : null;
  return (
    <span className={`ocupacao${c === "confirmada" ? "" : ` ${c}`}`} title={`${tituloItem(i)} · ${ROTULO_CLASSE[c]}`}>
      <strong>{horaNaDelta(i.inicio)}</strong> {tituloItem(i)}
      <span className="chip-sub">{localItem(i)}{detalhado && status ? ` · ${c === "temporario" ? "aguardando contrato" : status.toLowerCase()}` : ""}</span>
    </span>
  );
}

function VistaMes({ p, porDia, dia, abrir }: PropsVista) {
  const dias = diasEntre(p.periodo.inicio, p.periodo.fim);
  const mes = p.periodo.primeiroDoMes.slice(0, 7);
  return (
    <div className="calendario" role="grid" aria-label={rotuloPeriodo("mes", p.ancora, "", "")}>
      {SEMANA.map((s) => <div key={s} className="dia-semana" role="columnheader">{s}</div>)}
      {dias.map((d) => {
        const lista = porDia.get(d) ?? [];
        const temp = lista.some((i) => classeDoItem(i) === "temporario");
        return (
          <div key={d} role="gridcell" data-dia={d}
            className={`dia${d.slice(0, 7) !== mes ? " fora" : ""}${d === p.hoje ? " hoje" : ""}${d === dia ? " escolhido" : ""}${d < p.hoje ? " passado" : ""}${lista.length ? "" : " vazio"}`}>
            <button type="button" className="abrir-dia" onClick={() => abrir(d)} aria-label={`${formatarDataComDia(d)}: ${lista.length ? `${lista.length} ${lista.length === 1 ? "item" : "itens"}` : "livre"}${temp ? ", com data aguardando formalização" : ""}`} />
            <span className="numero-dia">{Number(d.slice(8))}</span>
            {lista.slice(0, MAX_CHIPS).map((i) => <Chip key={i.id} i={i} />)}
            {lista.length > MAX_CHIPS && <span className="mais">+{lista.length - MAX_CHIPS}</span>}
          </div>
        );
      })}
    </div>
  );
}

function VistaSemana({ p, porDia, dia, abrir }: PropsVista) {
  const dias = diasEntre(p.periodo.inicio, p.periodo.fim);
  return (
    <div className="semana">
      {dias.map((d, n) => {
        const lista = porDia.get(d) ?? [];
        return (
          <div key={d} data-dia={d} className={`semana-dia${d === p.hoje ? " hoje" : ""}${d === dia ? " escolhido" : ""}${d < p.hoje ? " passado" : ""}`}>
            <button type="button" className="semana-topo" onClick={() => abrir(d)}>
              <span>{SEMANA[n]}</span><strong>{Number(d.slice(8))}</strong>
            </button>
            <button type="button" className="semana-corpo" onClick={() => abrir(d)} aria-label={`Abrir ${formatarDataComDia(d)}`}>
              {lista.length === 0 ? <span className="mudo pequeno">Livre</span> : lista.map((i) => <Chip key={i.id} i={i} detalhado />)}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function VistaDia({ p, itens, espacos, mostrarExternos, abrir }: {
  p: Props; itens: ItemAgenda[]; espacos: EspacoAgenda[]; mostrarExternos: boolean; abrir: (d: string) => void;
}) {
  const d = p.ancora;
  const externos = itens.filter((i) => classeDoItem(i) === "externo" && ocupaODia(i, d));
  return (
    <div className="dia-colunas">
      {espacos.map((e) => {
        const s = situacaoDoEspaco(itens, e.id, d);
        return (
          <div key={e.id} className="dia-coluna">
            <div className="dia-coluna-topo"><strong>{e.nome}</strong><SeloEstado estado={s.estado} /></div>
            {s.horarios.length === 0 ? <p className="mudo pequeno">Livre o dia todo.</p> : s.horarios.map((hr, n) => {
              const it = itens.find((x) => x.id === hr.reservaId)!;
              return (
                <button key={n} type="button" className="dia-bloco" onClick={() => abrir(d)}>
                  <Chip i={it} detalhado />
                  <span className="mudo pequeno">Ocupa {faixaHorario(hr.de, hr.ate, d)}</span>
                </button>
              );
            })}
          </div>
        );
      })}
      {mostrarExternos && (
        <div className="dia-coluna">
          <div className="dia-coluna-topo"><strong>Eventos externos</strong><span className="selo info">{externos.length}</span></div>
          {externos.length === 0 ? <p className="mudo pequeno">Nenhum.</p> : externos.map((i) => (
            <button key={i.id} type="button" className="dia-bloco" onClick={() => abrir(d)}><Chip i={i} detalhado /></button>
          ))}
        </div>
      )}
    </div>
  );
}

function VistaLista({ p, itens, abrir }: { p: Props; itens: ItemAgenda[]; abrir: (d: string) => void }) {
  const doMes = itens.filter((i) => {
    const d = diaNaDelta(i.inicio);
    return d >= p.periodo.inicio && d < p.periodo.fim;
  }).sort((a, b) => a.inicio.localeCompare(b.inicio));
  if (!doMes.length) return <div className="vazio compacto"><p>Nada marcado neste mês.</p></div>;
  return (
    <div className="tabela-rolavel">
      <table className="agenda-lista">
        <thead><tr><th>Data</th><th>Horário</th><th>Evento</th><th>Local</th><th>Situação</th>{p.permissoes.financeiro && <th className="num">Pago / total</th>}</tr></thead>
        <tbody>
          {doMes.map((i) => {
            const c = classeDoItem(i), d = diaNaDelta(i.inicio);
            return (
              <tr key={i.id} className="clicavel" onClick={() => abrir(d)}>
                <td style={{ whiteSpace: "nowrap" }}><button type="button" className="link" onClick={(e) => { e.stopPropagation(); abrir(d); }}>{d.slice(8)}/{d.slice(5, 7)}</button> <span className="mudo">{SEMANA[new Date(`${d}T12:00:00Z`).getUTCDay()]}</span></td>
                <td style={{ whiteSpace: "nowrap" }}>{faixaHorario(i.inicio, i.fim)}</td>
                <td><strong>{tituloItem(i)}</strong>{i.cliente && <div className="mudo">{i.cliente}</div>}</td>
                <td>{localItem(i)}</td>
                <td><span className={`selo ${c === "confirmada" ? "" : c === "temporario" ? "alerta" : c === "externo" ? "info" : "cinza"}`}>{i.tipo === "evento" ? STATUS_RESERVA[i.status as StatusReserva]?.rotulo : "Bloqueio"}</span></td>
                {p.permissoes.financeiro && <td className="num">{i.valor_total != null ? `${formatarCentavos(i.pago ?? 0)} / ${formatarCentavos(i.valor_total)}` : "—"}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SeloEstado({ estado }: { estado: keyof typeof ROTULO_ESTADO }) {
  const cls = { livre: "", reservado: "erro", aguardando: "alerta", bloqueado: "cinza" }[estado];
  return <span className={`selo ${cls}`}>{ROTULO_ESTADO[estado]}</span>;
}

// ====================================================================================== painel lateral do dia

function PainelDoDia({ p, dia, modo, setModo, fechar, aoMudar }: {
  p: Props; dia: string; modo: Modo; setModo: (m: Modo) => void; fechar: () => void; aoMudar: () => void;
}) {
  const fecharRef = useRef<HTMLButtonElement>(null);
  const painelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    fecharRef.current?.focus({ preventScroll: true });
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [fechar]);
  useEffect(() => { painelRef.current?.querySelector(".gaveta-corpo")?.scrollTo({ top: 0 }); }, [modo, dia]);
  useEffect(() => {
    document.documentElement.dataset.gaveta = "aberta";
    return () => { delete document.documentElement.dataset.gaveta; };
  }, []);

  // aviso de sucesso vale só para o dia em que a ação foi feita
  const [aviso, setAviso] = useState<{ dia: string; msg: string } | null>(null);
  const avisoOk = aviso?.dia === dia ? aviso.msg : "";
  const mudou = (msg?: string) => { if (msg) setAviso({ dia, msg }); aoMudar(); };
  const passado = dia < p.hoje;
  const titulos: Record<Modo, string> = {
    resumo: "", evento: "Novo evento", externo: "Registrar evento externo", bloqueio: "Bloquear data ou horário", consulta: "Consultar disponibilidade",
  };
  const semana = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" }).format(new Date(`${dia}T12:00:00Z`));

  return (
    <>
      <div className="gaveta-fundo" onClick={fechar} aria-hidden />
      <aside ref={painelRef} className="gaveta" role="dialog" aria-modal="false" aria-labelledby="gaveta-titulo">
        <header className="gaveta-topo">
          <div>
            {modo !== "resumo" && (
              <button type="button" className="link pequeno" onClick={() => setModo("resumo")}><ChevronLeft aria-hidden style={{ width: 14, height: 14, verticalAlign: -2 }} /> Voltar ao dia</button>
            )}
            <h2 id="gaveta-titulo">{modo === "resumo" ? `${Number(dia.slice(8))} de ${nomeDoMes(Number(dia.slice(5, 7)))}` : titulos[modo]}</h2>
            <p className="mudo">{modo === "resumo" ? `${maiuscula(semana)} · ${dia.slice(0, 4)}${dia === p.hoje ? " · hoje" : passado ? " · já passou" : ""}` : maiuscula(formatarDataComDia(dia))}</p>
          </div>
          <button ref={fecharRef} type="button" className="botao fantasma pequeno icone" onClick={fechar} aria-label="Fechar painel (Esc)"><X aria-hidden /></button>
        </header>
        <div className="gaveta-corpo" key={dia}>
          {modo === "resumo" && avisoOk && <p className="aviso ok" role="status">{avisoOk}</p>}
          {modo === "resumo" && <ResumoDoDia p={p} dia={dia} aoMudar={mudou} />}
          {(modo === "evento" || modo === "externo") && <FormEvento key={modo} p={p} dia={dia} externo={modo === "externo"} aoMudar={aoMudar} />}
          {modo === "bloqueio" && <FormBloqueio p={p} dia={dia} aoMudar={aoMudar} />}
          {modo === "consulta" && <FormConsulta p={p} dia={dia} />}
        </div>
        {modo === "resumo" && !passado && (p.permissoes.criar || p.permissoes.bloquear) && (
          <footer className="gaveta-acoes">
            {p.permissoes.criar && <button type="button" className="botao" onClick={() => setModo("evento")}><CalendarPlus aria-hidden /> Novo evento</button>}
            {p.permissoes.criar && <Link className="botao secundario" href={`/orcamentos/novo?data=${dia}${p.filtroInicial !== "todos" && p.filtroInicial !== "externos" ? `&espaco=${p.filtroInicial}` : ""}`}><FileText aria-hidden /> Criar orçamento</Link>}
            {p.permissoes.bloquear && <button type="button" className="botao secundario" onClick={() => setModo("bloqueio")}><Lock aria-hidden /> Bloquear data ou horário</button>}
            {p.permissoes.criar && <button type="button" className="botao secundario" onClick={() => setModo("externo")}><Truck aria-hidden /> Registrar evento externo</button>}
            <button type="button" className="botao secundario" onClick={() => setModo("consulta")}><Search aria-hidden /> Consultar disponibilidade</button>
          </footer>
        )}
        {modo === "resumo" && passado && (
          <footer className="gaveta-acoes"><p className="mudo pequeno" style={{ margin: 0 }}>Dia que já passou: não dá para marcar nem bloquear.</p></footer>
        )}
      </aside>
    </>
  );
}

function ResumoDoDia({ p, dia, aoMudar }: { p: Props; dia: string; aoMudar: (msg?: string) => void }) {
  const espacos = p.espacos.filter((e) => e.tipo === "espaco");
  const doDia = p.itens.filter((i) => ocupaODia(i, dia)).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const eventos = doDia.filter((i) => i.tipo === "evento" && i.espacos.length > 0 && diaNaDelta(i.inicio) === dia);
  const vizinhos = doDia.filter((i) => i.tipo === "evento" && i.espacos.length > 0 && diaNaDelta(i.inicio) !== dia);
  const externos = doDia.filter((i) => classeDoItem(i) === "externo");
  const bloqueios = doDia.filter((i) => i.tipo === "bloqueio_administrativo");
  const situacoes = espacos.map((e) => ({ e, s: situacaoDoEspaco(p.itens, e.id, dia) }));
  const tudoLivre = doDia.length === 0;

  return (
    <>
      <section className="gaveta-secao">
        <h3>Disponibilidade dos espaços</h3>
        <ul className="lista-espacos">
          {situacoes.map(({ e, s }) => (
            <li key={e.id} data-espaco={e.nome}>
              <div className="linha" style={{ justifyContent: "space-between" }}>
                <span><MapPin aria-hidden className="icone-inline" /> {e.nome}{e.capacidade ? <span className="mudo"> · até {e.capacidade}</span> : null}</span>
                <SeloEstado estado={s.estado} />
              </div>
              {s.horarios.map((hr, n) => (
                <div key={n} className="mudo pequeno">{faixaHorario(hr.de, hr.ate, dia)} · {hr.rotulo}</div>
              ))}
            </li>
          ))}
        </ul>
        <p className="mudo pequeno" style={{ marginBottom: 0 }}>Os horários ocupados já incluem montagem, desmontagem e limpeza.</p>
      </section>

      {tudoLivre && (
        <div className="vazio compacto"><CalendarCheck aria-hidden /><p><strong>Data livre.</strong> Nenhum evento, reserva ou bloqueio neste dia.</p></div>
      )}

      {eventos.length > 0 && (
        <section className="gaveta-secao">
          <h3>Eventos do dia <span className="conta">{eventos.length}</span></h3>
          {eventos.map((i) => <CartaoEvento key={i.id} i={i} p={p} dia={dia} />)}
        </section>
      )}
      {externos.length > 0 && (
        <section className="gaveta-secao">
          <h3>Eventos externos <span className="conta">{externos.length}</span></h3>
          {externos.map((i) => <CartaoEvento key={i.id} i={i} p={p} dia={dia} />)}
        </section>
      )}
      {vizinhos.length > 0 && (
        <section className="gaveta-secao">
          <h3>Ocupação de eventos de outro dia</h3>
          {vizinhos.map((i) => <CartaoEvento key={i.id} i={i} p={p} dia={dia} />)}
        </section>
      )}
      {bloqueios.length > 0 && (
        <section className="gaveta-secao">
          <h3>Bloqueios</h3>
          {bloqueios.map((i) => <CartaoBloqueio key={i.id} i={i} p={p} aoMudar={aoMudar} />)}
        </section>
      )}
    </>
  );
}

function CartaoEvento({ i, p, dia }: { i: ItemAgenda; p: Props; dia: string }) {
  const c = classeDoItem(i);
  const st = STATUS_RESERVA[i.status as StatusReserva];
  const tipo = i.orcamento?.tipo ? TIPOS_ORCAMENTO[i.orcamento.tipo] : null;
  return (
    <article className={`cartao-evento ${c}`} data-reserva={i.id}>
      <div className="linha" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <Link href={`/eventos/${i.id}`} className="cartao-evento-titulo">{i.titulo ?? "Evento"}</Link>
        <span className={`selo ${c === "temporario" ? "alerta" : c === "externo" ? "info" : ""}`}>{st?.rotulo ?? i.status}</span>
      </div>
      <dl className="cartao-evento-dados">
        {i.cliente && <><dt>Cliente</dt><dd>{i.cliente}</dd></>}
        <dt>Horário</dt><dd>{faixaHorario(i.inicio, i.fim, dia)}</dd>
        <dt>Local</dt><dd>{localItem(i, true)}</dd>
        {tipo && <><dt>Tipo</dt><dd>{tipo}</dd></>}
        {i.orcamento?.convidados ? <><dt>Convidados</dt><dd><Users aria-hidden className="icone-inline" /> {i.orcamento.convidados}</dd></> : null}
        {p.permissoes.financeiro && i.valor_total != null && (
          <><dt>Financeiro</dt><dd>
            {formatarCentavos(i.pago ?? 0)} de {formatarCentavos(i.valor_total)}
            {" · "}{i.entrada_paga ? <span className="texto-sucesso">entrada paga</span> : <span className="texto-alerta">entrada pendente</span>}
          </dd></>
        )}
        {i.contrato && <><dt>Contrato</dt><dd>{i.contrato}</dd></>}
        {c === "temporario" && i.expira_em && <><dt>Data segura até</dt><dd className="texto-alerta">{formatarDataHora(i.expira_em)}</dd></>}
      </dl>
      <div className="linha cartao-evento-links">
        <Link className="botao secundario pequeno" href={`/eventos/${i.id}`}>Ficha do evento</Link>
        <Link className="botao fantasma pequeno" href={`/reservas/${i.id}`}>Reserva</Link>
        {i.orcamento && <Link className="botao fantasma pequeno" href={`/orcamentos/${i.orcamento.id}`}>{i.orcamento.numero}</Link>}
      </div>
    </article>
  );
}

function CartaoBloqueio({ i, p, aoMudar }: { i: ItemAgenda; p: Props; aoMudar: (msg?: string) => void }) {
  const [confirmar, setConfirmar] = useState(false);
  const [msg, setMsg] = useState<{ erro?: string }>({});
  const [pendente, iniciar] = useTransition();
  const remover = () => iniciar(async () => {
    const r = await removerBloqueioDoPainel(i.id);
    setConfirmar(false);
    if (r.ok) aoMudar(r.ok); else setMsg(r);
  });
  return (
    <article className="cartao-evento bloqueio" data-reserva={i.id}>
      <div className="linha" style={{ justifyContent: "space-between" }}>
        <strong>{i.motivo ?? "Bloqueio"}</strong><span className="selo cinza">Bloqueado</span>
      </div>
      <dl className="cartao-evento-dados">
        <dt>Período</dt><dd>{formatarDataHora(i.inicio)} até {formatarDataHora(i.fim)}</dd>
        <dt>Espaços</dt><dd>{localItem(i, true)}</dd>
        {i.observacoes && <><dt>Observações</dt><dd>{i.observacoes}</dd></>}
        <dt>Registrado</dt><dd>{i.criado_por ?? "—"} em {formatarDataHora(i.criado_em)}</dd>
      </dl>
      {msg.erro && <p className="aviso erro" role="alert">{msg.erro}</p>}
      <div className="linha cartao-evento-links">
        <Link className="botao fantasma pequeno" href={`/reservas/${i.id}`}>Abrir</Link>
        {p.permissoes.removerBloqueio && (confirmar ? (
          <span className="confirmacao">
            <button type="button" className="botao perigo pequeno" disabled={pendente} onClick={remover}>{pendente ? "Removendo…" : "Sim, remover"}</button>
            <button type="button" className="botao fantasma pequeno" onClick={() => setConfirmar(false)}>Cancelar</button>
          </span>
        ) : (
          <button type="button" className="botao secundario pequeno" onClick={() => setConfirmar(true)}>Remover bloqueio</button>
        ))}
      </div>
    </article>
  );
}

// ====================================================================================== formulários do painel

function Mensagem({ r }: { r: { erro?: string; ok?: string; conflitos?: string[]; aviso?: string } }) {
  return (
    <>
      {r.erro && (
        <div className="aviso erro" role="alert">
          {r.erro}
          {r.conflitos?.length ? <ul>{r.conflitos.map((c, n) => <li key={n}>{c}</li>)}</ul> : null}
        </div>
      )}
      {r.aviso && <div className="aviso alerta" role="status">{r.aviso}</div>}
    </>
  );
}

function EscolhaEspacos({ espacos, marcados, setMarcados, nome }: {
  espacos: EspacoAgenda[]; marcados: string[]; setMarcados: (v: string[]) => void; nome: string;
}) {
  return (
    <div className="opcoes-espaco" role="group" aria-label={nome}>
      {espacos.map((e) => (
        <label key={e.id} className="opcao">
          <input type="checkbox" checked={marcados.includes(e.id)}
            onChange={(ev) => setMarcados(ev.target.checked ? [...marcados, e.id] : marcados.filter((x) => x !== e.id))} />
          <span>{e.nome}{e.capacidade ? <span className="mudo"> · até {e.capacidade}</span> : null}</span>
        </label>
      ))}
    </div>
  );
}

function padraoDoEspaco(f: Folgas, ids: string[], campo: "montagem" | "desmontagem") {
  const vals = ids.map((id) => f.porEspaco[id]?.[campo] ?? f[campo]);
  return vals.length ? Math.max(...vals) : f[campo];
}

function FormEvento({ p, dia, externo, aoMudar }: { p: Props; dia: string; externo: boolean; aoMudar: () => void }) {
  const espacos = p.espacos.filter((e) => e.tipo === "espaco");
  const filtroEspaco = espacos.some((e) => e.id === p.filtroInicial) ? [p.filtroInicial] : [];
  const [clienteId, setClienteId] = useState("");
  const [buscaCliente, setBuscaCliente] = useState("");
  const [novo, setNovo] = useState(p.clientes.length === 0);
  const [nc, setNc] = useState<{ nome: string; tipo: "PF" | "PJ"; telefone: string }>({ nome: "", tipo: "PF", telefone: "" });
  const [d, setD] = useState({
    titulo: "", tipo: externo ? "buffet_externo" : "espaco_buffet", data: dia, inicio: "18:00", fim: "23:00",
    montagem: "", desmontagem: "", localExterno: "", convidados: "", servicos: "", observacoes: "",
    responsavel: p.atendentes.some((a) => a.id === p.usuario.id) ? p.usuario.id : "",
  });
  const [recursos, setRecursos] = useState<string[]>(filtroEspaco);
  const [segurar, setSegurar] = useState(false);
  const [r, setR] = useState<Awaited<ReturnType<typeof criarEventoRapido>>>({});
  const [disp, setDisp] = useState<Disponibilidade[] | null>(null);
  const [pendente, iniciar] = useTransition();
  const ehExterno = d.tipo === "buffet_externo";
  const set = (k: keyof typeof d) => (e: { target: { value: string } }) => { setD({ ...d, [k]: e.target.value }); setDisp(null); };

  const clientesFiltrados = useMemo(() => {
    const t = buscaCliente.trim().toLocaleLowerCase("pt-BR");
    return t ? p.clientes.filter((c) => c.nome.toLocaleLowerCase("pt-BR").includes(t)).slice(0, 50) : p.clientes.slice(0, 50);
  }, [buscaCliente, p.clientes]);

  const verificar = () => iniciar(async () => {
    const v = await consultarDisponibilidade({ data: d.data, inicio: d.inicio, fim: d.fim, recursos, comFolga: true, montagem: d.montagem, desmontagem: d.desmontagem });
    if (v.erro) setR({ erro: v.erro }); else { setR({}); setDisp(v.resultado ?? []); }
  });

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    iniciar(async () => {
      const res = await criarEventoRapido({
        clienteId: novo ? null : clienteId || null, novoCliente: novo ? nc : null,
        ...d, recursos: ehExterno ? [] : recursos, segurar: segurar && !ehExterno,
      });
      setR(res);
      if (res.ok) aoMudar();
    });
  };

  if (r.ok && r.orcamentoId) {
    return (
      <div className="gaveta-sucesso">
        <div className="aviso ok" role="status">{r.ok}</div>
        <Mensagem r={{ aviso: r.aviso }} />
        <p>O evento entrou como <strong>orçamento {r.numero}</strong>. A reserva só é confirmada depois da proposta aprovada, do contrato e da entrada de 50%.</p>
        <div className="linha">
          <Link className="botao" href={`/orcamentos/${r.orcamentoId}`}>Abrir o orçamento e incluir itens</Link>
          {r.reservaId && <Link className="botao secundario" href={`/reservas/${r.reservaId}`}>Ver a data segura</Link>}
        </div>
      </div>
    );
  }

  return (
    <form className="form-gaveta" onSubmit={enviar}>
      <p className="aviso info"><span>Cadastrar aqui cria um <strong>orçamento em negociação</strong>: a data não fica bloqueada nem confirmada.</span></p>

      <fieldset>
        <legend>Cliente</legend>
        <div className="abas" role="group" aria-label="Cliente">
          <button type="button" className={`aba${!novo ? " ativa" : ""}`} aria-pressed={!novo} onClick={() => setNovo(false)} disabled={p.clientes.length === 0}>Já cadastrado</button>
          <button type="button" className={`aba${novo ? " ativa" : ""}`} aria-pressed={novo} onClick={() => setNovo(true)}>Novo cliente</button>
        </div>
        {!novo ? (
          <>
            <label className="campo"><span>Buscar</span><input type="text" value={buscaCliente} onChange={(e) => setBuscaCliente(e.target.value)} placeholder="Nome do cliente" /></label>
            <label className="campo"><span>Cliente</span>
              <select id="ev-cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)} required>
                <option value="">Escolha…</option>
                {clientesFiltrados.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
          </>
        ) : (
          <div className="grade-2">
            <label className="campo" style={{ gridColumn: "1 / -1" }}><span>Nome</span><input type="text" id="ev-novo-nome" value={nc.nome} onChange={(e) => setNc({ ...nc, nome: e.target.value })} required minLength={2} /></label>
            <label className="campo"><span>Pessoa</span>
              <select value={nc.tipo} onChange={(e) => setNc({ ...nc, tipo: e.target.value as "PF" | "PJ" })}><option value="PF">Física</option><option value="PJ">Jurídica</option></select>
            </label>
            <label className="campo"><span>Telefone</span><input type="text" value={nc.telefone} onChange={(e) => setNc({ ...nc, telefone: e.target.value })} inputMode="tel" placeholder="(99) 99999-9999" /></label>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>Evento</legend>
        <label className="campo"><span>Nome do evento</span><input type="text" id="ev-titulo" value={d.titulo} onChange={set("titulo")} required minLength={3} placeholder="Ex.: Aniversário da Ana" /></label>
        <label className="campo"><span>Tipo</span>
          <select id="ev-tipo" value={d.tipo} onChange={set("tipo")} disabled={externo}>
            {Object.entries(TIPOS_ORCAMENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <div className="grade-3">
          <label className="campo"><span>Data</span><input id="ev-data" type="date" min={p.hoje} value={d.data} onChange={set("data")} required /></label>
          <label className="campo"><span>Início</span><input id="ev-ini" type="time" value={d.inicio} onChange={set("inicio")} required /></label>
          <label className="campo"><span>Término</span><input id="ev-fim" type="time" value={d.fim} onChange={set("fim")} required /></label>
        </div>
        {ehExterno ? (
          <label className="campo"><span>Local do evento</span><input type="text" id="ev-local" value={d.localExterno} onChange={set("localExterno")} required minLength={3} placeholder="Endereço ou nome do local" /></label>
        ) : (
          <>
            <span className="rotulo-campo">Espaço</span>
            <EscolhaEspacos espacos={espacos} marcados={recursos} setMarcados={(v) => { setRecursos(v); setDisp(null); }} nome="Espaço do evento" />
            <div className="grade-2">
              <label className="campo"><span>Montagem (h antes)</span><input type="text" value={d.montagem} onChange={set("montagem")} inputMode="decimal" placeholder={`padrão: ${h(padraoDoEspaco(p.folgas, recursos, "montagem"))}`} /></label>
              <label className="campo"><span>Desmontagem (h depois)</span><input type="text" value={d.desmontagem} onChange={set("desmontagem")} inputMode="decimal" placeholder={`padrão: ${h(padraoDoEspaco(p.folgas, recursos, "desmontagem"))}`} /></label>
            </div>
          </>
        )}
        <div className="grade-2">
          <label className="campo"><span>Convidados</span><input type="text" id="ev-conv" value={d.convidados} onChange={set("convidados")} inputMode="numeric" /></label>
          <label className="campo"><span>Responsável</span>
            <select value={d.responsavel} onChange={set("responsavel")}>
              <option value="">Ninguém ainda</option>
              {p.atendentes.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </label>
        </div>
        <label className="campo"><span>Serviços desejados</span><textarea rows={2} value={d.servicos} onChange={set("servicos")} placeholder="Ex.: buffet, decoração, DJ" /></label>
        <label className="campo"><span>Observações</span><textarea rows={2} value={d.observacoes} onChange={set("observacoes")} /></label>
      </fieldset>

      {!ehExterno && (
        <fieldset>
          <legend>Data</legend>
          <label className="opcao">
            <input type="checkbox" checked={segurar} onChange={(e) => setSegurar(e.target.checked)} />
            <span>Segurar a data por {p.folgas.seguraHoras} h <span className="mudo">(data segura, não é reserva confirmada; expira sozinha)</span></span>
          </label>
          <button type="button" className="botao secundario pequeno" onClick={verificar} disabled={pendente || !recursos.length}><Search aria-hidden /> Verificar disponibilidade</button>
          {disp && <ResultadoDisponibilidade lista={disp} />}
        </fieldset>
      )}

      <Mensagem r={r} />
      <div className="gaveta-rodape-form">
        <button type="submit" className="botao" disabled={pendente}>{pendente ? "Salvando…" : segurar && !ehExterno ? "Criar orçamento e segurar a data" : "Criar orçamento"}</button>
      </div>
    </form>
  );
}

function ResultadoDisponibilidade({ lista }: { lista: Disponibilidade[] }) {
  if (!lista.length) return null;
  return (
    <ul className="resultado-disp" aria-live="polite">
      {lista.map((v) => (
        <li key={v.recurso_id} className={v.livre ? "livre" : "ocupado"}>
          <strong>{v.recurso_nome}:</strong> {v.livre ? "disponível" : v.conflito ?? "ocupado"}
          <div className="mudo pequeno">Período conferido: {faixaHorario(v.ocupado_de, v.ocupado_ate)}</div>
        </li>
      ))}
    </ul>
  );
}

function FormBloqueio({ p, dia, aoMudar }: { p: Props; dia: string; aoMudar: () => void }) {
  const espacos = p.espacos.filter((e) => e.tipo === "espaco");
  const outros = p.espacos.filter((e) => e.tipo !== "espaco");
  const [alvo, setAlvo] = useState<string>(espacos.some((e) => e.id === p.filtroInicial) ? p.filtroInicial : espacos.length > 1 ? "ambos" : espacos[0]?.id ?? "");
  const [outrosMarcados, setOutrosMarcados] = useState<string[]>([]);
  const [d, setD] = useState({ dataInicio: dia, horaInicio: "08:00", dataFim: dia, horaFim: "18:00", motivo: "", observacoes: "" });
  const [r, setR] = useState<Awaited<ReturnType<typeof bloquearPeriodo>>>({});
  const [disp, setDisp] = useState<Disponibilidade[] | null>(null);
  const [pendente, iniciar] = useTransition();
  const set = (k: keyof typeof d) => (e: { target: { value: string } }) => {
    const v = e.target.value;
    setD((x) => ({ ...x, [k]: v, ...(k === "dataInicio" && x.dataFim < v ? { dataFim: v } : {}) }));
    setDisp(null);
  };
  const recursos = alvo === "ambos" ? espacos.map((e) => e.id) : alvo === "outro" ? outrosMarcados : alvo ? [alvo] : [];

  const verificar = () => iniciar(async () => {
    const v = await consultarDisponibilidade({ data: d.dataInicio, inicio: d.horaInicio, fim: d.horaFim, recursos, comFolga: false });
    if (v.erro) setR({ erro: v.erro }); else { setR({}); setDisp(v.resultado ?? []); }
  });
  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    iniciar(async () => {
      const res = await bloquearPeriodo({ recursos, ...d });
      setR(res);
      if (res.ok) aoMudar();
    });
  };

  if (r.ok) return (
    <div className="gaveta-sucesso">
      <div className="aviso ok" role="status">{r.ok}</div>
      <p>Ninguém consegue reservar esse período até o bloqueio ser removido.</p>
    </div>
  );

  return (
    <form className="form-gaveta" onSubmit={enviar}>
      <fieldset>
        <legend>O que bloquear</legend>
        <div className="opcoes-espaco" role="radiogroup" aria-label="O que bloquear">
          {espacos.map((e) => (
            <label key={e.id} className="opcao"><input type="radio" name="alvo" checked={alvo === e.id} onChange={() => { setAlvo(e.id); setDisp(null); }} /><span>{e.nome}</span></label>
          ))}
          {espacos.length > 1 && <label className="opcao"><input type="radio" name="alvo" checked={alvo === "ambos"} onChange={() => { setAlvo("ambos"); setDisp(null); }} /><span>Os dois espaços</span></label>}
          {outros.length > 0 && <label className="opcao"><input type="radio" name="alvo" checked={alvo === "outro"} onChange={() => { setAlvo("outro"); setDisp(null); }} /><span>Outro recurso</span></label>}
        </div>
        {alvo === "outro" && <EscolhaEspacos espacos={outros} marcados={outrosMarcados} setMarcados={setOutrosMarcados} nome="Outros recursos" />}
      </fieldset>
      <fieldset>
        <legend>Período</legend>
        <div className="grade-2">
          <label className="campo"><span>Data inicial</span><input id="b-data" type="date" min={p.hoje} value={d.dataInicio} onChange={set("dataInicio")} required /></label>
          <label className="campo"><span>Hora inicial</span><input id="b-ini" type="time" value={d.horaInicio} onChange={set("horaInicio")} required /></label>
          <label className="campo"><span>Data final</span><input id="b-data-fim" type="date" min={d.dataInicio} value={d.dataFim} onChange={set("dataFim")} required /></label>
          <label className="campo"><span>Hora final</span><input id="b-fim" type="time" value={d.horaFim} onChange={set("horaFim")} required /></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>Motivo</legend>
        <label className="campo"><span>Motivo</span><input type="text" id="b-mot" value={d.motivo} onChange={set("motivo")} required minLength={3} maxLength={200} placeholder="Ex.: manutenção do ar-condicionado" /></label>
        <label className="campo"><span>Observações</span><textarea id="b-obs" rows={2} value={d.observacoes} onChange={set("observacoes")} maxLength={1000} /></label>
        <p className="mudo pequeno" style={{ margin: 0 }}>Responsável: <strong>{p.usuario.nome}</strong> (registrado com data e hora).</p>
      </fieldset>
      {d.dataInicio === d.dataFim && (
        <button type="button" className="botao secundario pequeno" onClick={verificar} disabled={pendente || !recursos.length}><Search aria-hidden /> Verificar conflitos</button>
      )}
      {disp && <ResultadoDisponibilidade lista={disp} />}
      <Mensagem r={r} />
      <p className="mudo pequeno">Antes de gravar, o sistema confere se há reservas no período. Um bloqueio nunca passa por cima de uma reserva.</p>
      <div className="gaveta-rodape-form">
        <button type="submit" className="botao" disabled={pendente || !recursos.length}>{pendente ? "Bloqueando…" : "Bloquear"}</button>
      </div>
    </form>
  );
}

function FormConsulta({ p, dia }: { p: Props; dia: string }) {
  const espacos = p.espacos.filter((e) => e.tipo === "espaco");
  const [d, setD] = useState({ data: dia, inicio: "18:00", fim: "23:00", montagem: "", desmontagem: "" });
  const [recursos, setRecursos] = useState<string[]>(espacos.map((e) => e.id));
  const [r, setR] = useState<{ erro?: string }>({});
  const [disp, setDisp] = useState<Disponibilidade[] | null>(null);
  const [pendente, iniciar] = useTransition();
  const set = (k: keyof typeof d) => (e: { target: { value: string } }) => { setD({ ...d, [k]: e.target.value }); setDisp(null); };
  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    iniciar(async () => {
      const v = await consultarDisponibilidade({ ...d, recursos, comFolga: true });
      if (v.erro) { setR({ erro: v.erro }); setDisp(null); } else { setR({}); setDisp(v.resultado ?? []); }
    });
  };
  return (
    <form className="form-gaveta" onSubmit={enviar}>
      <p className="mudo">Confere se o horário cabe, já contando montagem, desmontagem e limpeza. Não grava nada.</p>
      <div className="grade-3">
        <label className="campo"><span>Data</span><input id="c-data" type="date" value={d.data} onChange={set("data")} required /></label>
        <label className="campo"><span>Início</span><input id="c-ini" type="time" value={d.inicio} onChange={set("inicio")} required /></label>
        <label className="campo"><span>Término</span><input id="c-fim" type="time" value={d.fim} onChange={set("fim")} required /></label>
      </div>
      <EscolhaEspacos espacos={espacos} marcados={recursos} setMarcados={(v) => { setRecursos(v); setDisp(null); }} nome="Espaços" />
      <div className="grade-2">
        <label className="campo"><span>Montagem (h)</span><input type="text" value={d.montagem} onChange={set("montagem")} inputMode="decimal" placeholder={`padrão: ${h(padraoDoEspaco(p.folgas, recursos, "montagem"))}`} /></label>
        <label className="campo"><span>Desmontagem (h)</span><input type="text" value={d.desmontagem} onChange={set("desmontagem")} inputMode="decimal" placeholder={`padrão: ${h(padraoDoEspaco(p.folgas, recursos, "desmontagem"))}`} /></label>
      </div>
      <Mensagem r={r} />
      {disp && <ResultadoDisponibilidade lista={disp} />}
      <div className="gaveta-rodape-form">
        <button type="submit" className="botao" disabled={pendente || !recursos.length}>{pendente ? "Consultando…" : "Consultar"}</button>
      </div>
    </form>
  );
}
