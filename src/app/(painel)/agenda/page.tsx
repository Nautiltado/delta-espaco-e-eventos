import type { Metadata } from "next";
import { exigirPermissao } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { hojeNaDelta } from "@/lib/datas";
import { inicioDoDia, periodoDaVista, VISTAS, type EspacoAgenda, type ItemAgenda, type Vista } from "@/lib/agenda";
import { CentralAgenda, type Folgas } from "./central";

export const metadata: Metadata = { title: "Agenda" };

const DATA = /^\d{4}-\d{2}-\d{2}$/;

export default async function PaginaAgenda({
  searchParams,
}: { searchParams: Promise<{ vista?: string; data?: string; mes?: string; dia?: string; espaco?: string }> }) {
  const acesso = await exigirPermissao("orcamento.ver");
  const q = await searchParams;
  const hoje = hojeNaDelta();
  const vista: Vista = q.vista && q.vista in VISTAS ? (q.vista as Vista) : "mes";
  // ?data= (âncora), ?dia= (dia aberto no painel) e o antigo ?mes=AAAA-MM continuam valendo.
  const dia = DATA.test(q.dia ?? "") ? q.dia! : null;
  const ancora = DATA.test(q.data ?? "") ? q.data! : dia ?? (/^\d{4}-\d{2}$/.test(q.mes ?? "") ? `${q.mes}-01` : hoje);
  const periodo = periodoDaVista(vista, ancora);
  // Carrega sempre o mês inteiro (para os indicadores) e o que a visão mostrar além dele.
  const grade = periodoDaVista("mes", ancora);
  const de = periodo.inicio < grade.inicio ? periodo.inicio : grade.inicio;
  const ate = periodo.fim > grade.fim ? periodo.fim : grade.fim;

  const supabase = await criarClienteServidor();
  const podeCriar = pode(acesso, "orcamento.criar");
  const [{ data: itens, error }, { data: recursos }, { data: cfg }, { data: clientes }, { data: atendentes }] = await Promise.all([
    supabase.rpc("agenda_detalhes", { p_inicio: inicioDoDia(de), p_fim: inicioDoDia(ate) }),
    supabase.from("recursos").select("id, nome, tipo, capacidade, montagem_horas, desmontagem_horas, limpeza_horas, intervalo_horas")
      .eq("ativo", true).order("tipo").order("capacidade"),
    supabase.from("configuracoes").select("chave, valor")
      .in("chave", ["espaco.montagem_horas", "espaco.desmontagem_horas", "espaco.limpeza_horas", "espaco.intervalo_horas", "reserva.bloqueio_horas"]),
    podeCriar ? supabase.rpc("buscar_clientes", { p_texto: null, p_inativos: false, p_limite: 500 }) : Promise.resolve({ data: [] }),
    podeCriar ? supabase.rpc("usuarios_atendimento") : Promise.resolve({ data: [] }),
  ]);
  if (error) throw new Error(error.message);

  const valor = (k: string, padrao: number) => {
    const v = (cfg ?? []).find((c) => c.chave === k)?.valor;
    const n = Number(v);
    return Number.isFinite(n) ? n : padrao;
  };
  const folgas: Folgas = {
    montagem: valor("espaco.montagem_horas", 0),
    desmontagem: valor("espaco.desmontagem_horas", 0),
    limpeza: valor("espaco.limpeza_horas", 4),
    intervalo: valor("espaco.intervalo_horas", 0),
    seguraHoras: valor("reserva.bloqueio_horas", 24),
    porEspaco: Object.fromEntries((recursos ?? []).map((r) => [r.id, {
      montagem: r.montagem_horas === null ? null : Number(r.montagem_horas),
      desmontagem: r.desmontagem_horas === null ? null : Number(r.desmontagem_horas),
      limpeza: r.limpeza_horas === null ? null : Number(r.limpeza_horas),
      intervalo: r.intervalo_horas === null ? null : Number(r.intervalo_horas),
    }])),
  };
  const espacos: EspacoAgenda[] = (recursos ?? []).map((r) => ({ id: r.id, nome: r.nome, tipo: r.tipo, capacidade: r.capacidade }));
  const filtro = q.espaco === "externos" || espacos.some((e) => e.id === q.espaco) ? q.espaco! : "todos";

  return (
    <CentralAgenda
      key={`${vista}-${ancora}`}
      vista={vista}
      ancora={ancora}
      periodo={periodo}
      hoje={hoje}
      diaInicial={dia}
      filtroInicial={filtro}
      itens={(itens ?? []) as ItemAgenda[]}
      espacos={espacos}
      folgas={folgas}
      clientes={((clientes ?? []) as { id: string; nome: string; telefone?: string | null }[]).map((c) => ({ id: c.id, nome: c.nome }))}
      atendentes={(atendentes ?? []) as { id: string; nome: string }[]}
      usuario={{ id: acesso.id, nome: acesso.nome }}
      permissoes={{
        criar: podeCriar,
        bloquear: pode(acesso, "bloqueio.criar"),
        removerBloqueio: pode(acesso, "bloqueio.remover"),
        financeiro: pode(acesso, "orcamento.ver") || pode(acesso, "pagamento.confirmar"),
      }}
    />
  );
}
