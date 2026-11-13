import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConteudoOrcamento } from "@/lib/pdf/orcamento";
import type { StatusOrcamento, StatusVersao } from "@/lib/orcamentos";
import { equivalencia, mapaDeUnidades, type Unidade } from "@/lib/unidades";

/** Unidades de cobrança cadastradas (ativas e inativas: itens antigos podem usar uma desativada). */
export async function carregarUnidades(supabase: SupabaseClient): Promise<Unidade[]> {
  const { data } = await supabase.from("unidades").select("*").order("ordem").order("singular");
  return ((data ?? []) as Unidade[]).map((u) => ({ ...u, passo: Number(u.passo), equivale_quantidade: u.equivale_quantidade == null ? null : Number(u.equivale_quantidade) }));
}

export type Versao = {
  id: string;
  orcamento_id: string;
  numero: number;
  status: StatusVersao;
  validade: string | null;
  condicoes: string | null;
  observacoes: string | null;
  apresentacao: string | null;
  subtotal_centavos: number;
  desconto_centavos: number;
  total_centavos: number;
  aprovacao_motivos: string[] | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  aprovacao_justificativa: string | null;
  enviada_em: string | null;
  snapshot: ConteudoOrcamento | null;
  conteudo_hash: string | null;
  aceita_em: string | null;
  criado_em: string;
};

export type ItemOrcamento = {
  id: string;
  versao_id: string;
  ordem: number;
  catalogo_item_id: string | null;
  descricao: string;
  detalhe: string | null;
  categoria: string | null;
  unidade: string;
  quantidade: number;
  /** null = preço pendente (impede o envio) */
  preco_unitario_centavos: number | null;
  desconto_centavos: number;
  bruto_centavos: number;
  total_centavos: number;
};

export type Orcamento = {
  id: string;
  numero: string;
  cliente_id: string;
  titulo: string;
  tipo: string;
  data_evento: string | null;
  horario: string | null;
  convidados: number | null;
  recurso_id: string | null;
  local_externo: string | null;
  status: StatusOrcamento;
  motivo_perda: string | null;
  responsavel: string | null;
  criado_em: string;
  clientes: {
    id: string;
    tipo: "PF" | "PJ";
    nome: string;
    nome_fantasia: string | null;
    documento: string | null;
    responsavel_nome: string | null;
    telefone: string | null;
    email: string | null;
    endereco: string | null;
    cidade: string | null;
    uf: string | null;
  };
  recursos: { nome: string } | null;
};

/** Versão em foco: a pedida, senão o rascunho, senão a mais recente. */
export function versaoEmFoco(versoes: Versao[], pedida?: number): Versao | undefined {
  if (pedida) {
    const v = versoes.find((x) => x.numero === pedida);
    if (v) return v;
  }
  return versoes.find((v) => v.status === "rascunho") ?? versoes[0];
}

/** Monta o conteúdo da prévia a partir dos dados atuais (rascunho ainda não congelado). */
export async function conteudoDaPrevia(
  supabase: SupabaseClient,
  o: Orcamento,
  v: Versao,
  itens: ItemOrcamento[],
): Promise<ConteudoOrcamento> {
  const ids = [...new Set(itens.map((i) => i.catalogo_item_id).filter((x): x is string => !!x))];
  const [{ data: empresa }, { data: cats }, unidades] = await Promise.all([
    supabase.from("configuracoes").select("chave, valor").like("chave", "empresa.%"),
    ids.length ? supabase.from("catalogo_itens").select("id, categoria").in("id", ids) : Promise.resolve({ data: [] }),
    carregarUnidades(supabase),
  ]);
  const mapa = mapaDeUnidades(unidades);
  const categoria = new Map(((cats ?? []) as { id: string; categoria: string }[]).map((c) => [c.id, c.categoria]));
  return {
    orcamento: {
      numero: o.numero,
      titulo: o.titulo,
      tipo: o.tipo,
      data_evento: o.data_evento,
      horario: o.horario,
      convidados: o.convidados,
      local_externo: o.local_externo,
      espaco: o.recursos?.nome ?? null,
    },
    versao: v.numero,
    cliente: {
      tipo: o.clientes.tipo,
      nome: o.clientes.nome,
      nome_fantasia: o.clientes.nome_fantasia,
      documento: o.clientes.documento,
      responsavel: o.clientes.responsavel_nome,
      telefone: o.clientes.telefone,
      email: o.clientes.email,
      endereco: o.clientes.endereco,
      cidade: o.clientes.cidade,
      uf: o.clientes.uf,
    },
    empresa: Object.fromEntries((empresa ?? []).map((e) => [String(e.chave).replace("empresa.", ""), String(e.valor)])),
    itens: itens.map((i) => ({
      descricao: i.descricao,
      detalhe: i.detalhe,
      unidade: i.unidade,
      unidade_singular: mapa.get(i.unidade)?.singular,
      unidade_plural: mapa.get(i.unidade)?.plural,
      quantidade: Number(i.quantidade),
      equivalencia: equivalencia(i.unidade, Number(i.quantidade), mapa),
      // a prévia mostra o pendente como zero; o envio é recusado enquanto houver pendência
      preco_unitario_centavos: i.preco_unitario_centavos ?? 0,
      preco_pendente: i.preco_unitario_centavos == null,
      bruto_centavos: i.bruto_centavos,
      desconto_centavos: i.desconto_centavos,
      total_centavos: i.total_centavos,
      catalogo_item_id: i.catalogo_item_id,
      categoria: i.categoria ?? (i.catalogo_item_id ? categoria.get(i.catalogo_item_id) ?? null : null),
    })),
    descontos_itens_centavos: itens.reduce((s, i) => s + i.desconto_centavos, 0),
    subtotal_centavos: v.subtotal_centavos,
    desconto_centavos: v.desconto_centavos,
    total_centavos: v.total_centavos,
    condicoes: v.condicoes,
    observacoes: v.observacoes,
    apresentacao: v.apresentacao,
    validade: null,
    enviada_em: null,
  };
}

export const SELECT_ORCAMENTO =
  "*, clientes(id, tipo, nome, nome_fantasia, documento, responsavel_nome, telefone, email, endereco, cidade, uf), recursos(nome)";
