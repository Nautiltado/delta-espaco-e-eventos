"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirAlguma, exigirPermissao } from "@/lib/acesso";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDoBanco } from "@/lib/erros";
import { lerReais } from "@/lib/dinheiro";
import { caminhoDoComprovante, TAMANHO_MAXIMO, TIPOS_COMPROVANTE } from "@/lib/comprovantes";
import { CATEGORIAS_GASTO, ETAPAS, FUNCOES } from "@/lib/eventos";

export type Estado = { erro?: string; ok?: string };

const uuid = z.uuid();
const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function recarregar(id: string) {
  revalidatePath(`/eventos/${id}`);
  revalidatePath("/eventos");
}

export async function salvarFicha(_: Estado, form: FormData): Promise<Estado> {
  await exigirAlguma(["escala.gerir", "orcamento.criar"]);
  const id = uuid.safeParse(form.get("reserva_id"));
  if (!id.success) return { erro: "Evento inválido." };
  const chegada = texto(form, "chegada");
  if (chegada && !/^([01]\d|2[0-3]):[0-5]\d$/.test(chegada)) return { erro: "Hora de chegada inválida." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("salvar_ficha_evento", {
    p_reserva: id.data, p_chegada: chegada || null, p_traje: texto(form, "traje").slice(0, 120),
    p_observacoes: texto(form, "observacoes").slice(0, 2000),
  });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar(id.data);
  return { ok: "Ficha salva." };
}

export async function adicionarEquipe(_: Estado, form: FormData): Promise<Estado> {
  await exigirPermissao("escala.gerir");
  const id = uuid.safeParse(form.get("reserva_id"));
  if (!id.success) return { erro: "Evento inválido." };
  const funcao = texto(form, "funcao");
  if (!(funcao in FUNCOES)) return { erro: "Escolha a função." };
  const quantidade = Number(texto(form, "quantidade"));
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 50) return { erro: "Quantas pessoas? (1 a 50)" };
  const valor = lerReais(texto(form, "valor"));
  if (valor === null) return { erro: "Valor da diária inválido." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("adicionar_equipe", {
    p_reserva: id.data, p_funcao: funcao, p_quantidade: quantidade, p_valor: valor,
    p_fornecedor: texto(form, "fornecedor").slice(0, 80), p_observacao: texto(form, "observacao").slice(0, 300),
  });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar(id.data);
  return { ok: "Equipe adicionada." };
}

export async function removerEquipe(_: Estado, form: FormData): Promise<Estado> {
  await exigirPermissao("escala.gerir");
  const id = uuid.safeParse(form.get("id"));
  const reserva = uuid.safeParse(form.get("reserva_id"));
  if (!id.success || !reserva.success) return { erro: "Linha inválida." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("remover_equipe", { p_id: id.data });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar(reserva.data);
  return { ok: "Removido." };
}

export async function pagarEquipe(_: Estado, form: FormData): Promise<Estado> {
  await exigirAlguma(["escala.gerir", "evento.fechar"]);
  const id = uuid.safeParse(form.get("id"));
  const reserva = uuid.safeParse(form.get("reserva_id"));
  if (!id.success || !reserva.success) return { erro: "Linha inválida." };
  const data = texto(form, "pago_em");
  if (data && !/^\d{4}-\d{2}-\d{2}$/.test(data)) return { erro: "Data inválida." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("pagar_equipe", { p_id: id.data, p_pago_em: data || null });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar(reserva.data);
  return { ok: data ? "Pagamento da equipe registrado." : "Pagamento desmarcado." };
}

export async function marcarItem(_: Estado, form: FormData): Promise<Estado> {
  const id = uuid.safeParse(form.get("id"));
  const reserva = uuid.safeParse(form.get("reserva_id"));
  if (!id.success || !reserva.success) return { erro: "Item inválido." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("marcar_checklist", { p_item: id.data, p_feito: form.get("feito") === "1" });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar(reserva.data);
  return {};
}

export async function adicionarItem(_: Estado, form: FormData): Promise<Estado> {
  const reserva = uuid.safeParse(form.get("reserva_id"));
  const etapa = texto(form, "etapa");
  if (!reserva.success || !(etapa in ETAPAS)) return { erro: "Item inválido." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("adicionar_item_checklist", { p_reserva: reserva.data, p_etapa: etapa, p_item: texto(form, "item").slice(0, 160) });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar(reserva.data);
  return { ok: "Item incluído." };
}

export async function registrarGasto(_: Estado, form: FormData): Promise<Estado & { id?: string }> {
  await exigirPermissao("evento.fechar");
  const reserva = uuid.safeParse(form.get("reserva_id"));
  if (!reserva.success) return { erro: "Evento inválido." };
  const categoria = texto(form, "categoria");
  if (!(categoria in CATEGORIAS_GASTO)) return { erro: "Escolha o tipo de gasto." };
  const valor = lerReais(texto(form, "valor"));
  if (!valor) return { erro: "Informe o valor." };
  const data = texto(form, "data");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { erro: "Informe a data." };
  const supabase = await criarClienteServidor();
  const { data: id, error } = await supabase.rpc("registrar_custo_evento", {
    p_reserva: reserva.data, p_categoria: categoria, p_descricao: texto(form, "descricao").slice(0, 200),
    p_fornecedor: texto(form, "fornecedor").slice(0, 120), p_valor: valor, p_data: data, p_pago: form.get("pago") === "on",
  });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar(reserva.data);
  return { ok: "Gasto lançado.", id: id as string };
}

export async function marcarGastoPago(_: Estado, form: FormData): Promise<Estado> {
  await exigirPermissao("evento.fechar");
  const id = uuid.safeParse(form.get("id"));
  const reserva = uuid.safeParse(form.get("reserva_id"));
  if (!id.success || !reserva.success) return { erro: "Gasto inválido." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("marcar_custo_pago", { p_custo: id.data, p_pago: form.get("pago") === "1" });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar(reserva.data);
  return { ok: "Atualizado." };
}

export async function removerGasto(_: Estado, form: FormData): Promise<Estado> {
  await exigirPermissao("evento.fechar");
  const id = uuid.safeParse(form.get("id"));
  const reserva = uuid.safeParse(form.get("reserva_id"));
  if (!id.success || !reserva.success) return { erro: "Gasto inválido." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("remover_custo_evento", { p_custo: id.data, p_motivo: texto(form, "motivo") });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar(reserva.data);
  return { ok: "Gasto tirado da conta. Fica no histórico." };
}

// ---------------------------------------------------------------- notas fiscais

export async function prepararNota(reservaId: string, tipo: string, tamanho: number): Promise<{ erro: string } | { caminho: string; token: string }> {
  await exigirPermissao("evento.fechar");
  if (!uuid.safeParse(reservaId).success) return { erro: "Evento inválido." };
  if (!(tipo in TIPOS_COMPROVANTE)) return { erro: "Envie foto (JPG, PNG, WEBP, HEIC) ou PDF." };
  if (!Number.isInteger(tamanho) || tamanho <= 0 || tamanho > TAMANHO_MAXIMO) return { erro: "Arquivo maior que 10 MB." };
  const caminho = caminhoDoComprovante(reservaId, tipo, crypto.randomUUID())!;
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.storage.from("notas").createSignedUploadUrl(caminho);
  if (error || !data) return { erro: "Não consegui preparar o envio. Tente de novo." };
  return { caminho, token: data.token };
}

export async function registrarNota(dados: {
  reservaId: string; custoId: string | null; caminho: string; nome: string; tipo: string; tamanho: number;
}): Promise<Estado> {
  await exigirPermissao("evento.fechar");
  if (!uuid.safeParse(dados.reservaId).success) return { erro: "Evento inválido." };
  const custo = dados.custoId && uuid.safeParse(dados.custoId).success ? dados.custoId : null;
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("registrar_nota", {
    p_reserva: dados.reservaId, p_custo: custo, p_caminho: dados.caminho, p_nome: dados.nome.slice(0, 200) || "nota",
    p_tipo: dados.tipo, p_tamanho: dados.tamanho,
  });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar(dados.reservaId);
  return { ok: "Nota anexada." };
}

export async function removerNota(_: Estado, form: FormData): Promise<Estado> {
  await exigirPermissao("evento.fechar");
  const id = uuid.safeParse(form.get("id"));
  const reserva = uuid.safeParse(form.get("reserva_id"));
  if (!id.success || !reserva.success) return { erro: "Nota inválida." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("remover_nota", { p_nota: id.data, p_motivo: texto(form, "motivo") });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar(reserva.data);
  return { ok: "Nota tirada da lista." };
}
