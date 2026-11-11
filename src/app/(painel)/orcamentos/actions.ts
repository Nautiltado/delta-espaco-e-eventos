"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirPermissao } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDoBanco } from "@/lib/erros";
import { lerReais } from "@/lib/dinheiro";
import { lerQuantidade, TIPOS_ORCAMENTO, UNIDADES } from "@/lib/orcamentos";

export type Estado = { erro?: string; ok?: string };

const uuid = z.uuid();
const vazioNulo = (v: FormDataEntryValue | null) => {
  const t = String(v ?? "").trim();
  return t === "" ? null : t;
};

function recarregar(orcamentoId: string) {
  revalidatePath(`/orcamentos/${orcamentoId}`);
  revalidatePath("/orcamentos");
}

async function orcamentoDaVersao(versaoId: string): Promise<string | null> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("orcamento_versoes").select("orcamento_id").eq("id", versaoId).maybeSingle();
  return data?.orcamento_id ?? null;
}

// ---------------------------------------------------------------- cabeçalho

const cabecalho = z.object({
  titulo: z.string().trim().min(3, "Descreva o evento (ex.: Casamento de Ana e João)").max(160),
  tipo: z.enum(Object.keys(TIPOS_ORCAMENTO) as [string, ...string[]]),
  data_evento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  horario: z.string().max(80).nullable(),
  convidados: z.coerce.number().int().positive("Convidados precisa ser maior que zero").max(5000).nullable(),
  recurso_id: z.uuid().nullable(),
  local_externo: z.string().max(250).nullable(),
});

function lerCabecalho(form: FormData) {
  return cabecalho.safeParse({
    titulo: form.get("titulo"),
    tipo: form.get("tipo"),
    data_evento: vazioNulo(form.get("data_evento")),
    horario: vazioNulo(form.get("horario")),
    convidados: vazioNulo(form.get("convidados")),
    recurso_id: vazioNulo(form.get("recurso_id")),
    local_externo: vazioNulo(form.get("local_externo")),
  });
}

export async function criarOrcamento(_: Estado, form: FormData): Promise<Estado> {
  await exigirPermissao("orcamento.criar");
  const cliente = uuid.safeParse(form.get("cliente_id"));
  if (!cliente.success) return { erro: "Escolha o cliente." };
  const d = lerCabecalho(form);
  if (!d.success) return { erro: d.error.issues[0].message };

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("criar_orcamento", {
    p_cliente: cliente.data,
    p_titulo: d.data.titulo,
    p_tipo: d.data.tipo,
    p_data: d.data.data_evento,
    p_horario: d.data.horario,
    p_convidados: d.data.convidados,
    p_recurso: d.data.recurso_id,
    p_local_externo: d.data.local_externo,
  });
  if (error) return { erro: mensagemDoBanco(error) };
  revalidatePath("/orcamentos");
  redirect(`/orcamentos/${data}`);
}

export async function salvarCabecalho(_: Estado, form: FormData): Promise<Estado> {
  await exigirPermissao("orcamento.criar");
  const id = uuid.safeParse(form.get("id"));
  if (!id.success) return { erro: "Orçamento inválido." };
  const d = lerCabecalho(form);
  if (!d.success) return { erro: d.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("orcamentos").update(d.data).eq("id", id.data).select("id");
  if (error) return { erro: mensagemDoBanco(error) };
  if (!data?.length) return { erro: "Orçamento encerrado: os dados do evento não mudam mais." };
  recarregar(id.data);
  return { ok: "Dados do evento salvos. Eles entram no PDF da próxima versão enviada." };
}

// ---------------------------------------------------------------- itens

export async function adicionarItem(_: Estado, form: FormData): Promise<Estado> {
  await exigirPermissao("orcamento.criar");
  const versao = uuid.safeParse(form.get("versao_id"));
  if (!versao.success) return { erro: "Versão inválida." };
  const catalogo = vazioNulo(form.get("catalogo_item_id"));
  const descricao = String(form.get("descricao") ?? "").trim();
  const unidade = String(form.get("unidade") ?? "");
  const quantidade = lerQuantidade(String(form.get("quantidade") ?? ""));
  const preco = lerReais(String(form.get("preco") ?? ""));
  if (descricao.length < 2) return { erro: "Descreva o item." };
  if (!(unidade in UNIDADES)) return { erro: "Unidade inválida." };
  if (quantidade === null) return { erro: "Quantidade inválida (use até 2 casas decimais)." };
  if (preco === null) return { erro: "Preço inválido." };

  const supabase = await criarClienteServidor();
  const { data: ultimo } = await supabase
    .from("orcamento_itens").select("ordem").eq("versao_id", versao.data).order("ordem", { ascending: false }).limit(1);
  const { error } = await supabase.from("orcamento_itens").insert({
    versao_id: versao.data,
    ordem: (ultimo?.[0]?.ordem ?? 0) + 1,
    catalogo_item_id: catalogo && uuid.safeParse(catalogo).success ? catalogo : null,
    descricao,
    unidade,
    quantidade,
    preco_unitario_centavos: preco,
  });
  if (error) return { erro: mensagemDoBanco(error) };
  const orc = await orcamentoDaVersao(versao.data);
  if (orc) recarregar(orc);
  return { ok: "Item incluído." };
}

export async function salvarItem(_: Estado, form: FormData): Promise<Estado> {
  await exigirPermissao("orcamento.criar");
  const id = uuid.safeParse(form.get("id"));
  if (!id.success) return { erro: "Item inválido." };
  const supabase = await criarClienteServidor();

  if (form.get("remover") === "1") {
    const { data: item } = await supabase.from("orcamento_itens").select("versao_id").eq("id", id.data).maybeSingle();
    const { error } = await supabase.from("orcamento_itens").delete().eq("id", id.data);
    if (error) return { erro: mensagemDoBanco(error) };
    const orc = item ? await orcamentoDaVersao(item.versao_id) : null;
    if (orc) recarregar(orc);
    return {};
  }

  const descricao = String(form.get("descricao") ?? "").trim();
  const quantidade = lerQuantidade(String(form.get("quantidade") ?? ""));
  const preco = lerReais(String(form.get("preco") ?? ""));
  if (descricao.length < 2) return { erro: "Descreva o item." };
  if (quantidade === null) return { erro: "Quantidade inválida." };
  if (preco === null) return { erro: "Preço inválido." };
  const { data, error } = await supabase
    .from("orcamento_itens")
    .update({ descricao, quantidade, preco_unitario_centavos: preco })
    .eq("id", id.data)
    .select("versao_id");
  if (error) return { erro: mensagemDoBanco(error) };
  const orc = data?.[0] ? await orcamentoDaVersao(data[0].versao_id) : null;
  if (orc) recarregar(orc);
  return { ok: "Salvo." };
}

// ---------------------------------------------------------------- condições, desconto, aprovação, envio

export async function salvarCondicoes(_: Estado, form: FormData): Promise<Estado> {
  const acesso = await exigirPermissao("orcamento.criar");
  const versao = uuid.safeParse(form.get("versao_id"));
  if (!versao.success) return { erro: "Versão inválida." };
  const desconto = form.has("desconto") ? lerReais(String(form.get("desconto") ?? "") || "0") : 0;
  if (desconto === null) return { erro: "Desconto inválido." };
  if (desconto > 0 && !pode(acesso, "desconto.dar") && !pode(acesso, "desconto.aprovar")) {
    return { erro: "Seu perfil não dá desconto." };
  }
  const supabase = await criarClienteServidor();
  const { data: v } = await supabase.from("orcamento_versoes").select("subtotal_centavos, orcamento_id").eq("id", versao.data).maybeSingle();
  if (!v) return { erro: "Versão não encontrada." };
  if (desconto > v.subtotal_centavos) return { erro: "O desconto não pode passar do subtotal." };

  const { data, error } = await supabase
    .from("orcamento_versoes")
    .update({
      desconto_centavos: desconto,
      condicoes: vazioNulo(form.get("condicoes")),
      observacoes: vazioNulo(form.get("observacoes")),
    })
    .eq("id", versao.data)
    .select("id");
  if (error) return { erro: mensagemDoBanco(error) };
  if (!data?.length) return { erro: "Esta versão já foi enviada e não muda mais." };
  recarregar(v.orcamento_id);
  return { ok: "Condições salvas." };
}

export async function aprovarCondicoes(_: Estado, form: FormData): Promise<Estado> {
  await exigirPermissao("desconto.aprovar");
  const versao = uuid.safeParse(form.get("versao_id"));
  if (!versao.success) return { erro: "Versão inválida." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("aprovar_condicoes", {
    p_versao: versao.data,
    p_justificativa: String(form.get("justificativa") ?? ""),
  });
  if (error) return { erro: mensagemDoBanco(error) };
  const orc = await orcamentoDaVersao(versao.data);
  if (orc) recarregar(orc);
  return { ok: "Condições aprovadas." };
}

export async function enviarVersao(_: Estado, form: FormData): Promise<Estado> {
  await exigirPermissao("orcamento.criar");
  const versao = uuid.safeParse(form.get("versao_id"));
  if (!versao.success) return { erro: "Versão inválida." };
  const validade = vazioNulo(form.get("validade"));
  if (validade && !/^\d{4}-\d{2}-\d{2}$/.test(validade)) return { erro: "Validade inválida." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("enviar_versao", { p_versao: versao.data, p_validade: validade });
  if (error) return { erro: mensagemDoBanco(error) };
  const orc = await orcamentoDaVersao(versao.data);
  if (orc) {
    recarregar(orc);
    revalidatePath("/tarefas");
    redirect(`/orcamentos/${orc}?enviado=1`);
  }
  return { ok: "Enviado." };
}

// ---------------------------------------------------------------- ciclo de vida

export async function criarNovaVersao(form: FormData) {
  await exigirPermissao("orcamento.criar");
  const id = uuid.parse(form.get("orcamento_id"));
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("nova_versao", { p_orcamento: id });
  if (error) redirect(`/orcamentos/${id}?erro=${encodeURIComponent(mensagemDoBanco(error))}`);
  recarregar(id);
  redirect(`/orcamentos/${id}`);
}

export async function registrarAceite(_: Estado, form: FormData): Promise<Estado> {
  await exigirPermissao("orcamento.criar");
  const versao = uuid.safeParse(form.get("versao_id"));
  if (!versao.success) return { erro: "Versão inválida." };
  if (form.get("confirmo") !== "1") return { erro: "Confirme que o cliente aceitou esta versão." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("registrar_aceite", { p_versao: versao.data });
  if (error) return { erro: mensagemDoBanco(error) };
  const orc = await orcamentoDaVersao(versao.data);
  if (orc) recarregar(orc);
  revalidatePath("/tarefas");
  return { ok: "Aceite registrado. Na Fase 4, daqui sai o contrato." };
}

export async function marcarPerdido(_: Estado, form: FormData): Promise<Estado> {
  await exigirPermissao("orcamento.criar");
  const id = uuid.safeParse(form.get("orcamento_id"));
  if (!id.success) return { erro: "Orçamento inválido." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("marcar_perdido", {
    p_orcamento: id.data,
    p_motivo: String(form.get("motivo") ?? ""),
  });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar(id.data);
  revalidatePath("/tarefas");
  return { ok: "Orçamento marcado como perdido." };
}

// ---------------------------------------------------------------- orçamento rápido

const itemLote = z.object({
  catalogo_item_id: z.uuid(),
  descricao: z.string().trim().min(2).max(300),
  unidade: z.enum(Object.keys(UNIDADES) as [string, ...string[]]),
  quantidade: z.number().positive().max(1_000_000).refine((q) => Math.round(q * 100) === q * 100, "Quantidade com até 2 casas"),
  preco_centavos: z.number().int().min(0).max(1_000_000_000),
});

/** Inclui vários itens de uma vez (do modelo ou da busca), num único comando: entram todos ou nenhum. */
export async function adicionarItensEmLote(versaoId: string, itens: unknown): Promise<Estado> {
  await exigirPermissao("orcamento.criar");
  if (!uuid.safeParse(versaoId).success) return { erro: "Versão inválida." };
  const lista = z.array(itemLote).min(1, "Marque ao menos um item.").max(200).safeParse(itens);
  if (!lista.success) {
    const p = lista.error.issues[0];
    return { erro: p.path.includes("preco_centavos") ? "Falta o preço de algum item marcado." : p.message };
  }
  const supabase = await criarClienteServidor();
  const { data: ultimo } = await supabase
    .from("orcamento_itens").select("ordem").eq("versao_id", versaoId).order("ordem", { ascending: false }).limit(1);
  const base = ultimo?.[0]?.ordem ?? 0;
  const { error } = await supabase.from("orcamento_itens").insert(
    lista.data.map((i, n) => ({
      versao_id: versaoId,
      ordem: base + n + 1,
      catalogo_item_id: i.catalogo_item_id,
      descricao: i.descricao,
      unidade: i.unidade,
      quantidade: i.quantidade,
      preco_unitario_centavos: i.preco_centavos,
    })),
  );
  if (error) return { erro: mensagemDoBanco(error) };
  const orc = await orcamentoDaVersao(versaoId);
  if (orc) recarregar(orc);
  return { ok: lista.data.length === 1 ? "1 item incluído." : `${lista.data.length} itens incluídos.` };
}

// ---------------------------------------------------------------- modelos de orçamento

const itemModelo = z.object({
  catalogo_item_id: z.uuid(),
  regra: z.enum(["fixa", "por_pessoa", "a_cada"]),
  fator: z.number().positive("Informe a quantidade de cada item").max(100000),
  minimo: z.number().min(0).max(100000),
  opcional: z.boolean(),
  preco_centavos: z.number().int().min(0).nullable(),
});

export async function salvarModelo(dados: { id: string | null; nome: string; descricao: string; ativo: boolean; itens: unknown }): Promise<Estado & { id?: string }> {
  await exigirPermissao("catalogo.alterar");
  const nome = dados.nome.trim();
  if (nome.length < 2) return { erro: "Dê um nome ao modelo (ex.: Jantar, Coffee break)." };
  const itens = z.array(itemModelo).min(1, "Inclua ao menos um item no modelo.").safeParse(dados.itens);
  if (!itens.success) return { erro: itens.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("salvar_modelo_orcamento", {
    p_id: dados.id && uuid.safeParse(dados.id).success ? dados.id : null,
    p_nome: nome, p_descricao: dados.descricao.trim().slice(0, 300), p_ativo: dados.ativo, p_itens: itens.data,
  });
  if (error) return { erro: mensagemDoBanco(error) };
  revalidatePath("/orcamentos/modelos");
  return { ok: "Modelo salvo.", id: data as string };
}
