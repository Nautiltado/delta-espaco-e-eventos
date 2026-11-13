"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirAlguma, exigirPermissao } from "@/lib/acesso";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDoBanco } from "@/lib/erros";
import { lerReais } from "@/lib/dinheiro";
import { CANAIS, instanteRetirada } from "@/lib/salgados";

export type Estado = { erro?: string; ok?: string };

const uuid = z.uuid();
const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function recarregar(id?: string) {
  revalidatePath("/salgados");
  revalidatePath("/salgados/cozinha");
  revalidatePath("/salgados/estoque");
  if (id) revalidatePath(`/salgados/${id}`);
}

const itemPedido = z.object({
  produto_id: z.uuid(),
  quantidade: z.number().int().positive().max(1000),
  sortido: z.array(z.uuid()).max(20).optional(),   // misto: um sabor por bloco, com repetição
});

export async function criarPedido(dados: {
  nome: string; telefone: string; canal: string; data: string; hora: string; observacao: string; itens: unknown;
}): Promise<Estado> {
  await exigirPermissao("salgados.criar");
  if (dados.nome.trim().length < 2) return { erro: "Informe o nome de quem vai retirar." };
  const retirada = instanteRetirada(dados.data, dados.hora);
  if (!retirada) return { erro: "Informe o dia e a hora da retirada." };
  if (!(dados.canal in CANAIS)) return { erro: "Escolha por onde o pedido chegou." };
  const tel = dados.telefone.replace(/\D/g, "");
  if (tel && !/^\d{10,11}$/.test(tel)) return { erro: "Telefone com DDD, ex.: (99) 98111-2233." };
  const itens = z.array(itemPedido).min(1, "Inclua ao menos um item.").safeParse(dados.itens);
  if (!itens.success) return { erro: itens.error.issues[0].message };

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("criar_pedido", {
    p_nome: dados.nome, p_telefone: tel || null, p_canal: dados.canal, p_retirada: retirada,
    p_observacao: dados.observacao.slice(0, 500), p_itens: itens.data,
  });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar();
  redirect(`/salgados/${data}?aviso=criado`);
}

export async function pagarPedido(_: Estado, form: FormData): Promise<Estado> {
  await exigirAlguma(["salgados.criar", "pagamento.confirmar"]);
  const id = uuid.safeParse(form.get("pedido_id"));
  if (!id.success) return { erro: "Pedido inválido." };
  const forma = texto(form, "forma");
  const recebido = texto(form, "recebido_em");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(recebido)) return { erro: "Informe a data do pagamento." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("pagar_pedido", {
    p_pedido: id.data, p_forma: forma, p_recebido_em: recebido, p_id_externo: texto(form, "id_externo") || null,
  });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar(id.data);
  redirect(`/salgados/${id.data}?aviso=pago`);
}

export async function marcarPronto(_: Estado, form: FormData): Promise<Estado> {
  await exigirPermissao("producao.status");
  const id = uuid.safeParse(form.get("pedido_id"));
  if (!id.success) return { erro: "Pedido inválido." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("marcar_pedido_pronto", { p_pedido: id.data });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar(id.data);
  return { ok: "Pronto." };
}

export async function entregarPedido(_: Estado, form: FormData): Promise<Estado> {
  await exigirPermissao("retirada.registrar");
  const id = uuid.safeParse(form.get("pedido_id"));
  if (!id.success) return { erro: "Pedido inválido." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("entregar_pedido", { p_pedido: id.data });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar(id.data);
  return { ok: "Entregue. Estoque atualizado." };
}

export async function cancelarPedido(_: Estado, form: FormData): Promise<Estado> {
  await exigirAlguma(["salgados.criar", "pagamento.estornar"]);
  const id = uuid.safeParse(form.get("pedido_id"));
  if (!id.success) return { erro: "Pedido inválido." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("cancelar_pedido", {
    p_pedido: id.data, p_motivo: texto(form, "motivo"), p_devolver_mesmo_pronto: form.get("devolver") === "on",
  });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar(id.data);
  revalidatePath("/tarefas");
  redirect(`/salgados/${id.data}?aviso=cancelado`);
}

// ---------------------------------------------------------------- estoque

export async function movimentarEstoque(_: Estado, form: FormData): Promise<Estado> {
  await exigirAlguma(["estoque.movimentar", "producao.status"]);
  const item = uuid.safeParse(form.get("estoque_item_id"));
  if (!item.success) return { erro: "Escolha o salgado." };
  const tipo = texto(form, "tipo") || "producao";
  const quantidade = Number(texto(form, "quantidade").replace(/\D/g, "") || 0) * (texto(form, "sinal") === "-" ? -1 : 1);
  if (!quantidade) return { erro: "Informe a quantidade em unidades." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("movimentar_estoque", {
    p_item: item.data, p_tipo: tipo, p_quantidade: quantidade, p_observacao: texto(form, "observacao"),
  });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar();
  const nome = texto(form, "nome");
  return {
    ok: tipo === "producao" ? `+${Math.abs(quantidade)} ${nome} no estoque.` : `Estoque de ${nome} ajustado.`,
  };
}

export async function definirMinimo(_: Estado, form: FormData): Promise<Estado> {
  await exigirPermissao("estoque.movimentar");
  const item = uuid.safeParse(form.get("estoque_item_id"));
  const minimo = Number(texto(form, "minimo"));
  if (!item.success || !Number.isInteger(minimo) || minimo < 0) return { erro: "Mínimo inválido." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("definir_minimo_estoque", { p_item: item.data, p_minimo: minimo });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar();
  return { ok: "Mínimo salvo." };
}

export async function definirPreco(_: Estado, form: FormData): Promise<Estado> {
  await exigirPermissao("catalogo.alterar");
  const id = uuid.safeParse(form.get("produto_id"));
  const preco = lerReais(texto(form, "preco"));
  if (!id.success || !preco) return { erro: "Preço inválido." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("definir_preco_encomenda", { p_produto: id.data, p_preco: preco, p_ativo: form.get("ativo") === "on" });
  if (error) return { erro: mensagemDoBanco(error) };
  recarregar();
  revalidatePath("/salgados/novo");
  return { ok: "Salvo." };
}
