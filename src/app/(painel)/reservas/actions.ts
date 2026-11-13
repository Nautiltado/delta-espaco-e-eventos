"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirPermissao } from "@/lib/acesso";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDoBanco } from "@/lib/erros";
import { lerReais } from "@/lib/dinheiro";
import { marcadoresDesconhecidos, MARCADORES_CONHECIDOS } from "@/lib/contrato";
import { montarContrato } from "@/lib/reserva-dados";
import { FORMAS_ASSINATURA, FORMAS_PAGAMENTO, INICIATIVAS, periodoDoEvento } from "@/lib/reservas";
import { caminhoDoComprovante, TAMANHO_MAXIMO, TIPOS_COMPROVANTE } from "@/lib/comprovantes";

export type Estado = { erro?: string; ok?: string };

const uuid = z.uuid();
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Depois de mudar a situação, volta para a reserva com o aviso (o formulário que agiu pode sumir da tela). */
function voltar(reservaId: string, aviso: string): never {
  redirect(`/reservas/${reservaId}?aviso=${aviso}`);
}

function recarregar(reservaId?: string | null, orcamentoId?: string | null) {
  if (reservaId) revalidatePath(`/reservas/${reservaId}`);
  if (orcamentoId) revalidatePath(`/orcamentos/${orcamentoId}`);
  revalidatePath("/agenda");
  revalidatePath("/financeiro");
}

async function reservaDoFormulario(form: FormData) {
  const id = uuid.safeParse(form.get("reserva_id"));
  if (!id.success) return null;
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("reservas").select("id, orcamento_id").eq("id", id.data).maybeSingle();
  return data;
}

// ---------------------------------------------------------------- data

export async function reservarData(_: Estado, form: FormData): Promise<Estado> {
  await exigirPermissao("orcamento.criar");
  const orcamento = uuid.safeParse(form.get("orcamento_id"));
  if (!orcamento.success) return { erro: "Orçamento inválido." };
  const p = periodoDoEvento(texto(form, "data"), texto(form, "inicio"), texto(form, "fim"));
  if (!p.ok) return { erro: p.erro };
  const recursos = form.getAll("recursos").map(String).filter((r) => uuid.safeParse(r).success);

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("reservar_data", {
    p_orcamento: orcamento.data, p_inicio: p.inicio, p_fim: p.fim, p_recursos: recursos,
  });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar(data as string, orcamento.data);
  redirect(`/reservas/${data}?segura=1`);
}

export async function prorrogarBloqueio(_: Estado, form: FormData): Promise<Estado> {
  await exigirPermissao("reserva.confirmar");
  const r = await reservaDoFormulario(form);
  if (!r) return { erro: "Reserva inválida." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("prorrogar_bloqueio", { p_reserva: r.id });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar(r.id, r.orcamento_id);
  voltar(r.id, "prorrogada");
}

export async function liberarBloqueio(_: Estado, form: FormData): Promise<Estado> {
  await exigirPermissao("orcamento.criar");
  const r = await reservaDoFormulario(form);
  if (!r) return { erro: "Reserva inválida." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("liberar_bloqueio", { p_reserva: r.id });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar(r.id, r.orcamento_id);
  voltar(r.id, "liberada");
}

// ---------------------------------------------------------------- contrato

export async function gerarContrato(_: Estado, form: FormData): Promise<Estado> {
  await exigirPermissao("contrato.gerar");
  const r = await reservaDoFormulario(form);
  if (!r) return { erro: "Reserva inválida." };
  const signatario = texto(form, "signatario") === "alternativo" ? "alternativo" : "principal";
  const canal = texto(form, "canal") === "fora_estabelecimento" ? "fora_estabelecimento" : "estabelecimento";

  const supabase = await criarClienteServidor();
  const m = await montarContrato(supabase, r.id, { signatario, canal });
  if (!m.ok) return { erro: m.erro };
  const { error } = await supabase.rpc("gerar_contrato", {
    p_reserva: r.id, p_modelo_versao: m.modeloVersao, p_signatario: m.signatario, p_texto: m.texto, p_conteudo: m.conteudo,
  });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar(r.id, r.orcamento_id);
  voltar(r.id, "contrato");
}

export async function registrarAssinatura(_: Estado, form: FormData): Promise<Estado> {
  await exigirPermissao("contrato.gerar");
  const id = uuid.safeParse(form.get("contrato_id"));
  if (!id.success) return { erro: "Contrato inválido." };
  const data = texto(form, "data");
  const forma = texto(form, "forma");
  if (!DATA.test(data)) return { erro: "Informe a data da assinatura." };
  if (!(forma in FORMAS_ASSINATURA)) return { erro: "Escolha como foi assinado." };

  const supabase = await criarClienteServidor();
  const { data: c } = await supabase.from("contratos").select("reserva_id, conteudo").eq("id", id.data).maybeSingle();
  if (!c) return { erro: "Contrato não encontrado." };
  // O canal foi escolhido ao gerar e está escrito no próprio contrato.
  const canal = (c.conteudo as { canal?: string } | null)?.canal === "fora_estabelecimento" ? "fora_estabelecimento" : "estabelecimento";
  const { error } = await supabase.rpc("registrar_assinatura", {
    p_contrato: id.data, p_data: data, p_forma: forma, p_canal: canal, p_obs: texto(form, "obs"),
  });
  if (error) return { erro: mensagemDoBanco(error) };
  const { data: r } = await supabase.from("reservas").select("orcamento_id").eq("id", c.reserva_id).maybeSingle();
  recarregar(c.reserva_id, r?.orcamento_id);
  voltar(c.reserva_id, "assinatura");
}

// ---------------------------------------------------------------- pagamentos

export async function registrarPagamento(_: Estado, form: FormData): Promise<Estado> {
  await exigirPermissao("pagamento.confirmar");
  const parcela = uuid.safeParse(form.get("parcela_id"));
  if (!parcela.success) return { erro: "Parcela inválida." };
  const valor = lerReais(texto(form, "valor"));
  const forma = texto(form, "forma");
  const recebido = texto(form, "recebido_em");
  const idExterno = texto(form, "id_externo");
  if (!valor) return { erro: "Informe o valor recebido." };
  if (!(forma in FORMAS_PAGAMENTO)) return { erro: "Escolha a forma de pagamento." };
  if (!DATA.test(recebido)) return { erro: "Informe a data em que o dinheiro entrou." };

  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("registrar_pagamento", {
    p_parcela: parcela.data, p_valor: valor, p_forma: forma, p_recebido_em: recebido,
    p_referencia: texto(form, "referencia") || null,
    p_provedor: idExterno ? forma : null,
    p_id_externo: idExterno || null,
  });
  if (error) return { erro: mensagemDoBanco(error) };
  const { data: p } = await supabase.from("parcelas").select("reserva_id, reservas(orcamento_id)").eq("id", parcela.data).maybeSingle();
  recarregar(p?.reserva_id, (p?.reservas as unknown as { orcamento_id: string } | null)?.orcamento_id);
  if (p?.reserva_id) voltar(p.reserva_id, "pagamento");
  return { ok: "Pagamento registrado." };
}

export async function estornarPagamento(_: Estado, form: FormData): Promise<Estado> {
  await exigirPermissao("pagamento.estornar");
  const pagamento = uuid.safeParse(form.get("pagamento_id"));
  if (!pagamento.success) return { erro: "Pagamento inválido." };
  const valor = lerReais(texto(form, "valor"));
  if (!valor) return { erro: "Informe o valor do estorno." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("estornar_pagamento", { p_pagamento: pagamento.data, p_valor: valor, p_motivo: texto(form, "motivo") });
  if (error) return { erro: mensagemDoBanco(error) };
  const { data: g } = await supabase.from("pagamentos").select("parcelas(reserva_id)").eq("id", pagamento.data).maybeSingle();
  const reservaId = (g?.parcelas as unknown as { reserva_id: string } | null)?.reserva_id;
  recarregar(reservaId);
  if (reservaId) voltar(reservaId, "estorno");
  return { ok: "Estorno registrado." };
}

// ---------------------------------------------------------------- confirmação e cancelamento

export async function confirmarReserva(_: Estado, form: FormData): Promise<Estado> {
  await exigirPermissao("reserva.confirmar");
  const r = await reservaDoFormulario(form);
  if (!r) return { erro: "Reserva inválida." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("confirmar_reserva", { p_reserva: r.id });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar(r.id, r.orcamento_id);
  revalidatePath("/tarefas");
  voltar(r.id, "confirmada");
}

export async function cancelarReserva(_: Estado, form: FormData): Promise<Estado> {
  await exigirPermissao("reserva.cancelar");
  const r = await reservaDoFormulario(form);
  if (!r) return { erro: "Reserva inválida." };
  const iniciativa = texto(form, "iniciativa");
  if (!(iniciativa in INICIATIVAS)) return { erro: "Escolha quem pediu o cancelamento." };
  if (form.get("ciente") !== "sim") return { erro: "Confirme que conferiu os valores." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("cancelar_reserva", { p_reserva: r.id, p_iniciativa: iniciativa, p_motivo: texto(form, "motivo") });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar(r.id, r.orcamento_id);
  revalidatePath("/tarefas");
  voltar(r.id, "cancelada");
}

// ---------------------------------------------------------------- agenda

export async function bloquearAgenda(_: Estado, form: FormData): Promise<Estado> {
  await exigirPermissao("bloqueio.criar");
  const recursos = form.getAll("recursos").map(String).filter((r) => uuid.safeParse(r).success);
  if (!recursos.length) return { erro: "Escolha ao menos um espaço." };
  const p = periodoDoEvento(texto(form, "data"), texto(form, "inicio"), texto(form, "fim"));
  if (!p.ok) return { erro: p.erro };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("bloquear_agenda", { p_recursos: recursos, p_inicio: p.inicio, p_fim: p.fim, p_motivo: texto(form, "motivo") });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar();
  return { ok: "Agenda bloqueada." };
}

export async function removerBloqueio(_: Estado, form: FormData): Promise<Estado> {
  await exigirPermissao("bloqueio.remover");
  const r = await reservaDoFormulario(form);
  if (!r) return { erro: "Bloqueio inválido." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("remover_bloqueio_agenda", { p_reserva: r.id });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar();
  voltar(r.id, "bloqueio_removido");
}

// ---------------------------------------------------------------- modelo de contrato

export async function salvarModeloContrato(_: Estado, form: FormData): Promise<Estado> {
  await exigirPermissao("contrato.editar");
  const titulo = texto(form, "titulo");
  const corpo = String(form.get("corpo") ?? "").replace(/\r\n/g, "\n");
  const anexo = String(form.get("anexo") ?? "").replace(/\r\n/g, "\n");
  const obs = texto(form, "observacao");
  if (titulo.length < 3) return { erro: "Dê um título ao modelo." };
  if (corpo.trim().length < 500) return { erro: "O texto do contrato está curto demais." };
  if (obs.length < 3) return { erro: "Descreva o que mudou nesta versão." };
  const desconhecidos = marcadoresDesconhecidos(corpo, MARCADORES_CONHECIDOS);
  if (desconhecidos.length) return { erro: `Marcadores que o sistema não conhece: ${desconhecidos.map((d) => `{{${d}}}`).join(", ")}.` };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("criar_modelo_contrato", { p_titulo: titulo, p_corpo: corpo, p_anexo: anexo, p_observacao: obs });
  if (error) return { erro: mensagemDoBanco(error) };
  revalidatePath("/contratos");
  revalidatePath("/contratos/modelo");
  return { ok: `Versão ${data} do modelo salva. Os próximos contratos usam esta versão; os já gerados não mudam.` };
}

// ---------------------------------------------------------------- comprovantes

/** 1º passo: o servidor confere a permissão e devolve um endereço de envio de uso único. */
export async function prepararComprovante(reservaId: string, tipo: string, tamanho: number): Promise<{ erro: string } | { caminho: string; token: string }> {
  await exigirPermissao("pagamento.confirmar");
  if (!uuid.safeParse(reservaId).success) return { erro: "Reserva inválida." };
  if (!(tipo in TIPOS_COMPROVANTE)) return { erro: "Envie foto (JPG, PNG, WEBP, HEIC) ou PDF." };
  if (!Number.isInteger(tamanho) || tamanho <= 0 || tamanho > TAMANHO_MAXIMO) return { erro: "Arquivo maior que 10 MB." };
  const caminho = caminhoDoComprovante(reservaId, tipo, crypto.randomUUID())!;
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.storage.from("comprovantes").createSignedUploadUrl(caminho);
  if (error || !data) return { erro: "Não consegui preparar o envio. Tente de novo." };
  return { caminho, token: data.token };
}

/** 2º passo: depois do arquivo enviado, registra o comprovante na reserva. */
export async function registrarComprovante(dados: {
  reservaId: string; caminho: string; nome: string; tipo: string; tamanho: number; pagamentoId: string | null; descricao: string;
}): Promise<Estado> {
  await exigirPermissao("pagamento.confirmar");
  if (!uuid.safeParse(dados.reservaId).success) return { erro: "Reserva inválida." };
  const pagamento = dados.pagamentoId && uuid.safeParse(dados.pagamentoId).success ? dados.pagamentoId : null;
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("registrar_comprovante", {
    p_reserva: dados.reservaId, p_caminho: dados.caminho, p_nome: dados.nome.slice(0, 200) || "comprovante",
    p_tipo: dados.tipo, p_tamanho: dados.tamanho, p_pagamento: pagamento, p_descricao: dados.descricao.slice(0, 300),
  });
  if (error) return { erro: mensagemDoBanco(error) };
  revalidatePath(`/reservas/${dados.reservaId}`);
  revalidatePath("/financeiro");
  return { ok: "Comprovante anexado." };
}

export async function removerComprovante(_: Estado, form: FormData): Promise<Estado> {
  await exigirPermissao("pagamento.estornar");
  const id = uuid.safeParse(form.get("comprovante_id"));
  if (!id.success) return { erro: "Comprovante inválido." };
  const supabase = await criarClienteServidor();
  const { data: c } = await supabase.from("comprovantes").select("reserva_id").eq("id", id.data).maybeSingle();
  const { error } = await supabase.rpc("remover_comprovante", { p_comprovante: id.data, p_motivo: texto(form, "motivo") });
  if (error) return { erro: mensagemDoBanco(error) };
  if (c) revalidatePath(`/reservas/${c.reserva_id}`);
  revalidatePath("/financeiro");
  return { ok: "Comprovante tirado da lista. O arquivo continua guardado no histórico." };
}
