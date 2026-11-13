"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirPermissao } from "@/lib/acesso";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDoBanco } from "@/lib/erros";
import { normalizarTelefone, somenteDigitos, validaCnpj, validaCpf } from "@/lib/documentos";

export type Duplicado = { id: string; nome: string; telefone: string | null; documento: string | null; motivo: string };
export type EstadoCliente = { erro?: string; campos?: Record<string, string> };

const texto = (max: number) =>
  z.string().trim().max(max).transform((v) => (v === "" ? null : v)).nullable();

const esquema = z
  .object({
    tipo: z.enum(["PF", "PJ"]),
    nome: z.string().trim().min(2, "Informe o nome").max(160),
    nome_fantasia: texto(160),
    responsavel_nome: texto(160),
    documento: z.string().transform((v) => somenteDigitos(v) || null),
    telefone: z.string(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .transform((v) => (v === "" ? null : v))
      .pipe(z.email("E-mail inválido").nullable()),
    endereco: texto(250),
    cidade: texto(80),
    uf: z
      .string()
      .trim()
      .toUpperCase()
      .transform((v) => (v === "" ? null : v))
      .pipe(z.string().regex(/^[A-Z]{2}$/, "UF com 2 letras").nullable()),
    origem: z
      .string()
      .transform((v) => (v === "" ? null : v))
      .pipe(z.enum(["whatsapp", "instagram", "indicacao", "balcao", "telefone", "outro"]).nullable()),
    observacoes: texto(2000),
  })
  .superRefine((d, ctx) => {
    if (d.documento) {
      const ok = d.tipo === "PF" ? validaCpf(d.documento) : validaCnpj(d.documento);
      if (!ok) ctx.addIssue({ code: "custom", path: ["documento"], message: d.tipo === "PF" ? "CPF inválido" : "CNPJ inválido" });
    }
    if (d.telefone.trim() && !normalizarTelefone(d.telefone)) {
      ctx.addIssue({ code: "custom", path: ["telefone"], message: "Telefone inválido: use DDD e número" });
    }
  })
  .transform((d) => ({ ...d, telefone: normalizarTelefone(d.telefone) }));

function lerFormulario(form: FormData) {
  const campos: Record<string, string> = {};
  for (const k of ["tipo", "nome", "nome_fantasia", "responsavel_nome", "documento", "telefone", "email",
    "endereco", "cidade", "uf", "origem", "observacoes"]) {
    campos[k] = String(form.get(k) ?? "");
  }
  return campos;
}

export async function verificarDuplicados(dados: {
  id?: string;
  nome: string;
  telefone: string;
  documento: string;
}): Promise<Duplicado[]> {
  await exigirPermissao("cliente.ver");
  const supabase = await criarClienteServidor();
  const { data } = await supabase.rpc("buscar_duplicados", {
    p_nome: dados.nome.trim() || null,
    p_telefone: normalizarTelefone(dados.telefone),
    p_documento: somenteDigitos(dados.documento) || null,
    p_ignorar: dados.id ?? null,
  });
  return (data ?? []) as Duplicado[];
}

export async function salvarCliente(_: EstadoCliente, form: FormData): Promise<EstadoCliente> {
  await exigirPermissao("cliente.editar");
  const campos = lerFormulario(form);
  const id = String(form.get("id") ?? "") || null;
  const dados = esquema.safeParse(campos);
  if (!dados.success) return { erro: dados.error.issues[0].message, campos };

  const registro = {
    ...dados.data,
    // PF não tem nome fantasia nem responsável
    nome_fantasia: dados.data.tipo === "PJ" ? dados.data.nome_fantasia : null,
    responsavel_nome: dados.data.tipo === "PJ" ? dados.data.responsavel_nome : null,
  };

  const supabase = await criarClienteServidor();
  let clienteId = id;
  if (id) {
    const { data, error } = await supabase.from("clientes").update(registro).eq("id", id).select("id");
    if (error) return { erro: mensagemDoBanco(error), campos };
    if (!data?.length) return { erro: "Seu perfil não permite editar este cliente.", campos };
  } else {
    const { data, error } = await supabase.from("clientes").insert(registro).select("id").single();
    if (error) return { erro: mensagemDoBanco(error), campos };
    clienteId = data.id;
  }
  revalidatePath("/clientes");
  redirect(`/clientes/${clienteId}`);
}

export async function alternarAtivoCliente(form: FormData) {
  await exigirPermissao("cliente.editar");
  const id = z.uuid().parse(form.get("id"));
  const ativar = form.get("ativar") === "1";
  const supabase = await criarClienteServidor();
  await supabase.from("clientes").update({ ativo: ativar }).eq("id", id);
  revalidatePath(`/clientes/${id}`);
}

export type EstadoMesclagem = { erro?: string };

export async function mesclarClientes(_: EstadoMesclagem, form: FormData): Promise<EstadoMesclagem> {
  await exigirPermissao("cliente.mesclar");
  const destino = z.uuid().safeParse(form.get("destino"));
  const origem = z.uuid().safeParse(form.get("origem"));
  if (!destino.success || !origem.success) return { erro: "Escolha o cadastro repetido." };
  if (form.get("confirmo") !== "1") return { erro: "Marque a confirmação antes de mesclar." };

  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("mesclar_clientes", { p_origem: origem.data, p_destino: destino.data });
  if (error) return { erro: mensagemDoBanco(error) };
  revalidatePath("/clientes");
  redirect(`/clientes/${destino.data}?mesclado=1`);
}
