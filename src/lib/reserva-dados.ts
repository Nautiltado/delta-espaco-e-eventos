import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hojeNaDelta } from "@/lib/datas";
import { montarTextoContrato, planoDeParcelas, valoresDoContrato, type DadosContrato, type ParcelaPlano } from "@/lib/contrato";
import { SELECT_ORCAMENTO, type Orcamento } from "@/lib/orcamento-dados";
import type { ConteudoOrcamento } from "@/lib/pdf/orcamento";
import { diaNaDelta, type StatusReserva } from "@/lib/reservas";

export type Reserva = {
  id: string;
  tipo: "evento" | "bloqueio_administrativo";
  status: StatusReserva;
  titulo: string | null;
  motivo: string | null;
  cliente_id: string | null;
  orcamento_id: string | null;
  evento_inicio: string;
  evento_fim: string;
  expira_em: string | null;
  prorrogacoes: number;
  valor_total_centavos: number | null;
  confirmada_em: string | null;
  cancelada_em: string | null;
  cancelamento: Record<string, unknown> | null;
  criado_em: string;
};

export type Contrato = {
  id: string;
  reserva_id: string;
  versao: number;
  status: "rascunho" | "enviado" | "assinado" | "cancelado" | "substituido";
  modelo_versao: number | null;
  conteudo: { numero?: string; canal?: string; signatario?: string } | null;
  texto: string | null;
  conteudo_hash: string | null;
  signatario_delta: string | null;
  assinado_em: string | null;
  assinatura_forma: string | null;
  canal_venda: string | null;
  assinatura_obs: string | null;
  criado_em: string;
  cancelado_em: string | null;
};

export type ParcelaSituacao = {
  parcela_id: string;
  reserva_id: string;
  numero: number;
  valor_centavos: number;
  vencimento: string;
  pago_centavos: number;
  saldo_centavos: number;
};

export type Pagamento = {
  id: string;
  parcela_id: string;
  tipo: "recebimento" | "estorno";
  valor_centavos: number;
  forma: string;
  referencia: string | null;
  id_externo: string | null;
  recebido_em: string | null;
  confirmado_em: string;
  observacao: string | null;
  estorno_de: string | null;
};

/** Configurações como mapa chave → valor (as restritas só vêm para quem pode gerar contrato). */
export async function lerConfiguracoes(supabase: SupabaseClient, prefixos: string[]): Promise<Record<string, unknown>> {
  const { data } = await supabase
    .from("configuracoes")
    .select("chave, valor")
    .or(prefixos.map((p) => `chave.like.${p}%`).join(","));
  return Object.fromEntries((data ?? []).map((c) => [c.chave as string, c.valor]));
}

export type Signatario = "principal" | "alternativo";

/**
 * Monta o contrato da reserva: dados congelados + texto final do modelo mais recente.
 * Não grava nada: quem grava é gerar_contrato, que confere tudo de novo.
 */
export async function montarContrato(
  supabase: SupabaseClient,
  reservaId: string,
  opcoes: { signatario: Signatario; canal: "estabelecimento" | "fora_estabelecimento" },
): Promise<{ ok: true; texto: string; conteudo: DadosContrato & { modelo_versao: number }; modeloVersao: number; signatario: string } | { ok: false; erro: string }> {
  const { data: r } = await supabase.from("reservas").select("*").eq("id", reservaId).maybeSingle();
  if (!r || r.tipo !== "evento" || !r.orcamento_id) return { ok: false, erro: "Reserva não encontrada." };
  const reserva = r as Reserva;

  const [{ data: orc }, { data: versao }, { data: periodos }, { data: modelo }, { data: contratos }, { data: parcelas }, cfg] = await Promise.all([
    supabase.from("orcamentos").select(SELECT_ORCAMENTO).eq("id", reserva.orcamento_id).maybeSingle(),
    supabase.from("orcamento_versoes").select("*").eq("orcamento_id", reserva.orcamento_id).eq("status", "aprovada").maybeSingle(),
    supabase.from("reserva_periodos").select("recursos(nome, capacidade)").eq("reserva_id", reservaId).eq("ativo", true),
    supabase.from("contrato_modelos").select("versao, corpo, anexo").order("versao", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("contratos").select("versao").eq("reserva_id", reservaId).order("versao", { ascending: false }).limit(1),
    supabase.from("parcelas").select("numero, valor_centavos, vencimento").eq("reserva_id", reservaId).order("numero"),
    lerConfiguracoes(supabase, ["empresa.", "financeiro.", "contrato.signatario"]),
  ]);
  if (!orc) return { ok: false, erro: "Orçamento da reserva não encontrado." };
  const o = orc as Orcamento;
  if (o.status !== "aprovado" || !versao) return { ok: false, erro: "Registre antes, no orçamento, o aceite do cliente." };
  if (!modelo) return { ok: false, erro: "Não há modelo de contrato cadastrado." };
  const signatario = String(cfg[`contrato.signatario_${opcoes.signatario}`] ?? "").trim();
  if (!signatario) return { ok: false, erro: "Seu perfil não vê os dados de quem assina pela Delta." };

  const c = o.clientes;
  if (!c.documento || !c.endereco?.trim()) {
    return { ok: false, erro: "Complete o CPF/CNPJ e o endereço do cliente antes de gerar o contrato." };
  }
  if (c.tipo === "PJ" && !c.responsavel_nome?.trim()) {
    return { ok: false, erro: "Informe no cadastro do cliente o responsável que assina pela empresa." };
  }

  const snap = versao.snapshot as ConteudoOrcamento | null;
  let itens = snap?.itens;
  if (!itens) {
    const { data } = await supabase.from("orcamento_itens").select("*").eq("versao_id", versao.id).order("ordem");
    itens = (data ?? []).map((i) => ({ ...i, quantidade: Number(i.quantidade) }));
  }

  const hoje = hojeNaDelta();
  const existentes = (parcelas ?? []) as ParcelaPlano[];
  const plano =
    existentes.length && existentes.reduce((s, p) => s + Number(p.valor_centavos), 0) === versao.total_centavos
      ? existentes.map((p) => ({ ...p, valor_centavos: Number(p.valor_centavos) }))
      : planoDeParcelas(versao.total_centavos, diaNaDelta(reserva.evento_inicio), hoje, {
          sinalPercentual: Number(cfg["financeiro.sinal_percentual"] ?? 50),
          saldoDiasAntes: Number(cfg["financeiro.saldo_dias_antes"] ?? 7),
          integralDias: Number(cfg["financeiro.pagamento_integral_dias"] ?? 7),
        });

  const empresa = (k: string) => String(cfg[`empresa.${k}`] ?? "");
  const dados: DadosContrato = {
    numero: `${o.numero}-C${(contratos?.[0]?.versao ?? 0) + 1}`,
    hoje,
    canal: opcoes.canal,
    signatario,
    empresa: {
      razao_social: empresa("razao_social"),
      nome_fantasia: empresa("nome_fantasia"),
      cnpj: empresa("cnpj"),
      endereco: empresa("endereco"),
      cidade: empresa("cidade") || "Bacabal",
    },
    cliente: {
      tipo: c.tipo, nome: c.nome, nome_fantasia: c.nome_fantasia, documento: c.documento, responsavel_nome: c.responsavel_nome,
      endereco: c.endereco, cidade: c.cidade, uf: c.uf, telefone: c.telefone, email: c.email,
    },
    orcamento: { numero: o.numero, versao: versao.numero, titulo: o.titulo, convidados: o.convidados, local_externo: o.local_externo },
    espacos: ((periodos ?? []) as unknown as { recursos: { nome: string } | null }[]).map((p) => p.recursos?.nome ?? "").filter(Boolean),
    evento: { inicio: reserva.evento_inicio, fim: reserva.evento_fim },
    itens: itens.map((i) => ({
      descricao: i.descricao, unidade: i.unidade, quantidade: Number(i.quantidade),
      preco_unitario_centavos: i.preco_unitario_centavos, total_centavos: i.total_centavos,
    })),
    subtotal_centavos: versao.subtotal_centavos,
    desconto_centavos: versao.desconto_centavos,
    total_centavos: versao.total_centavos,
    parcelas: plano,
  };
  try {
    const texto = montarTextoContrato(modelo.corpo, modelo.anexo, valoresDoContrato(dados));
    return { ok: true, texto, conteudo: { ...dados, modelo_versao: modelo.versao }, modeloVersao: modelo.versao, signatario };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Modelo de contrato inválido." };
  }
}
