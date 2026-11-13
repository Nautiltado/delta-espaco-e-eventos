"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirPermissao } from "@/lib/acesso";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDoBanco } from "@/lib/erros";
import { normalizarTelefone } from "@/lib/documentos";
import { periodoDoEvento } from "@/lib/reservas";
import { TIPOS_ORCAMENTO } from "@/lib/orcamentos";

const uuid = z.uuid();
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function recarregar() {
  revalidatePath("/agenda");
  revalidatePath("/orcamentos");
  revalidatePath("/");
}

function horas(v: unknown): number | null | "invalido" {
  const t = String(v ?? "").trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= 48 ? Math.round(n * 2) / 2 : "invalido";
}

// ---------------------------------------------------------------- consultar disponibilidade (não grava)

export type Disponibilidade = { recurso_id: string; recurso_nome: string; livre: boolean; conflito: string | null; ocupado_de: string; ocupado_ate: string };

export async function consultarDisponibilidade(d: {
  data: string; inicio: string; fim: string; recursos: string[]; comFolga: boolean; montagem?: string; desmontagem?: string;
}): Promise<{ erro?: string; resultado?: Disponibilidade[] }> {
  await exigirPermissao("orcamento.ver");
  const p = periodoDoEvento(d.data, d.inicio, d.fim);
  if (!p.ok) return { erro: p.erro };
  const recursos = d.recursos.filter((r) => uuid.safeParse(r).success);
  if (!recursos.length) return { erro: "Escolha ao menos um espaço." };
  const m = horas(d.montagem), dm = horas(d.desmontagem);
  if (m === "invalido" || dm === "invalido") return { erro: "Montagem e desmontagem entre 0 e 48 horas." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("verificar_disponibilidade", {
    p_recursos: recursos, p_inicio: p.inicio, p_fim: p.fim, p_com_folga: d.comFolga, p_montagem_horas: m, p_desmontagem_horas: dm,
  });
  if (error) return { erro: mensagemDoBanco(error) };
  return { resultado: (data ?? []) as Disponibilidade[] };
}

// ---------------------------------------------------------------- bloqueio com período, motivo e observações

export async function bloquearPeriodo(d: {
  recursos: string[]; dataInicio: string; horaInicio: string; dataFim: string; horaFim: string; motivo: string; observacoes: string;
}): Promise<{ erro?: string; ok?: string; conflitos?: string[] }> {
  await exigirPermissao("bloqueio.criar");
  const recursos = d.recursos.filter((r) => uuid.safeParse(r).success);
  if (!recursos.length) return { erro: "Escolha o que bloquear." };
  if (!DATA.test(d.dataInicio) || !DATA.test(d.dataFim)) return { erro: "Informe as datas." };
  if (!HORA.test(d.horaInicio) || !HORA.test(d.horaFim)) return { erro: "Informe os horários no formato 08:00." };
  const inicio = `${d.dataInicio}T${d.horaInicio}:00-03:00`, fim = `${d.dataFim}T${d.horaFim}:00-03:00`;
  if (Date.parse(fim) <= Date.parse(inicio)) return { erro: "O fim precisa ser depois do início." };
  if (d.motivo.trim().length < 3) return { erro: "Informe o motivo do bloqueio." };
  const supabase = await criarClienteServidor();
  // conflitos antes de gravar (o banco confere de novo ao gravar)
  const { data: verif, error: e1 } = await supabase.rpc("verificar_disponibilidade", {
    p_recursos: recursos, p_inicio: inicio, p_fim: fim, p_com_folga: false,
  });
  if (e1) return { erro: mensagemDoBanco(e1) };
  const conflitos = ((verif ?? []) as Disponibilidade[]).filter((v) => !v.livre).map((v) => v.conflito ?? `${v.recurso_nome} está ocupado`);
  if (conflitos.length) return { erro: "Há reservas nesse período: o bloqueio não pode passar por cima delas.", conflitos };
  const { error } = await supabase.rpc("bloquear_agenda", {
    p_recursos: recursos, p_inicio: inicio, p_fim: fim, p_motivo: d.motivo.trim().slice(0, 200), p_observacoes: d.observacoes.trim().slice(0, 1000) || null,
  });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar();
  return { ok: "Agenda bloqueada." };
}

// ---------------------------------------------------------------- cadastro rápido de evento (negociação)

export type EventoRapido = {
  clienteId: string | null;
  novoCliente: { nome: string; tipo: "PF" | "PJ"; telefone: string } | null;
  titulo: string; tipo: string; data: string; inicio: string; fim: string;
  montagem: string; desmontagem: string; recursos: string[]; localExterno: string;
  convidados: string; servicos: string; observacoes: string; responsavel: string; segurar: boolean;
};

export async function criarEventoRapido(d: EventoRapido): Promise<{
  erro?: string; ok?: string; orcamentoId?: string; numero?: string; reservaId?: string; aviso?: string;
}> {
  await exigirPermissao("orcamento.criar");
  const titulo = d.titulo.trim();
  if (titulo.length < 3) return { erro: "Dê um nome ao evento (ex.: Aniversário da Ana)." };
  if (!(d.tipo in TIPOS_ORCAMENTO)) return { erro: "Escolha o tipo de evento." };
  const externo = d.tipo === "buffet_externo";
  const p = periodoDoEvento(d.data, d.inicio, d.fim);
  if (!p.ok) return { erro: p.erro };
  const recursos = externo ? [] : d.recursos.filter((r) => uuid.safeParse(r).success);
  if (!externo && !recursos.length) return { erro: "Escolha o espaço." };
  if (externo && d.localExterno.trim().length < 3) return { erro: "Informe o local do evento externo." };
  const convidados = d.convidados.trim() ? Number(d.convidados) : null;
  if (convidados !== null && (!Number.isInteger(convidados) || convidados < 1 || convidados > 5000)) return { erro: "Convidados: um número de 1 a 5000." };
  const m = horas(d.montagem), dm = horas(d.desmontagem);
  if (m === "invalido" || dm === "invalido") return { erro: "Montagem e desmontagem: de 0 a 48 horas." };

  const supabase = await criarClienteServidor();
  let clienteId = d.clienteId && uuid.safeParse(d.clienteId).success ? d.clienteId : null;
  if (!clienteId) {
    const n = d.novoCliente;
    if (!n || n.nome.trim().length < 2) return { erro: "Escolha um cliente ou cadastre um novo." };
    const telefone = n.telefone.trim() ? normalizarTelefone(n.telefone) : null;
    if (n.telefone.trim() && !telefone) return { erro: "Telefone do cliente inválido: use DDD e número." };
    const { data: c, error } = await supabase.from("clientes").insert({ tipo: n.tipo, nome: n.nome.trim().slice(0, 160), telefone }).select("id").single();
    if (error) return { erro: mensagemDoBanco(error) };
    clienteId = c.id as string;
  }

  const horario = [`${d.inicio} às ${d.fim}${p.virada ? " (termina no dia seguinte)" : ""}`,
    m ? `montagem ${String(m).replace(".", ",")} h antes` : "", dm ? `desmontagem ${String(dm).replace(".", ",")} h depois` : ""]
    .filter(Boolean).join(" · ").slice(0, 80);
  const { data: orcId, error: e2 } = await supabase.rpc("criar_orcamento", {
    p_cliente: clienteId, p_titulo: titulo.slice(0, 160), p_tipo: d.tipo, p_data: d.data, p_horario: horario,
    p_convidados: convidados, p_recurso: recursos.length === 1 ? recursos[0] : null, p_local_externo: externo ? d.localExterno.trim().slice(0, 250) : null,
  });
  if (e2) return { erro: mensagemDoBanco(e2) };
  const orcamentoId = orcId as string;

  const extras: Record<string, unknown> = {};
  if (uuid.safeParse(d.responsavel).success) extras.responsavel = d.responsavel;
  if (Object.keys(extras).length) await supabase.from("orcamentos").update(extras).eq("id", orcamentoId);
  const notas = [d.servicos.trim() && `Serviços desejados: ${d.servicos.trim()}`, d.observacoes.trim() && `Observações: ${d.observacoes.trim()}`]
    .filter(Boolean).join("\n");
  if (notas) await supabase.from("orcamento_versoes").update({ observacoes: notas.slice(0, 2000) }).eq("orcamento_id", orcamentoId).eq("numero", 1);
  const { data: o } = await supabase.from("orcamentos").select("numero").eq("id", orcamentoId).single();

  let reservaId: string | undefined, aviso: string | undefined;
  if (d.segurar) {
    const { data: r, error: e3 } = await supabase.rpc("reservar_data", {
      p_orcamento: orcamentoId, p_inicio: p.inicio, p_fim: p.fim, p_recursos: recursos, p_montagem_horas: m, p_desmontagem_horas: dm,
    });
    if (e3) aviso = `O orçamento foi criado, mas a data não foi segurada: ${mensagemDoBanco(e3)}`;
    else reservaId = r as string;
  }
  recarregar();
  return {
    ok: reservaId ? "Orçamento criado e data segura (ainda não é reserva confirmada)."
      : externo ? "Orçamento do evento externo criado." : "Orçamento criado. A data continua livre até ser segurada.",
    orcamentoId, numero: o?.numero as string | undefined, reservaId, aviso,
  };
}

// ---------------------------------------------------------------- remover bloqueio direto do painel do dia

export async function removerBloqueioDoPainel(id: string): Promise<{ erro?: string; ok?: string }> {
  await exigirPermissao("bloqueio.remover");
  if (!uuid.safeParse(id).success) return { erro: "Bloqueio inválido." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("remover_bloqueio_agenda", { p_reserva: id });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar();
  return { ok: "Bloqueio removido." };
}
