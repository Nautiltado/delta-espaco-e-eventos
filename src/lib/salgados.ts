// Encomendas de salgados: rótulos e regras simples compartilhadas pelas telas.

export type StatusPedido = "aguardando_pagamento" | "pago" | "pronto" | "entregue" | "cancelado";

export const STATUS_PEDIDO: Record<StatusPedido, { rotulo: string; classe: string }> = {
  aguardando_pagamento: { rotulo: "Aguardando pagamento", classe: "selo dourado" },
  pago: { rotulo: "Pago, na fila da cozinha", classe: "selo" },
  pronto: { rotulo: "Pronto para retirar", classe: "selo" },
  entregue: { rotulo: "Entregue", classe: "selo cinza" },
  cancelado: { rotulo: "Cancelado", classe: "selo erro" },
};

export const CANAIS: Record<string, string> = {
  balcao: "Balcão",
  whatsapp: "WhatsApp",
  instadelivery: "InstaDelivery",
  telefone: "Telefone",
  outro: "Outro",
};

export type Produto = {
  id: string;
  nome: string;
  grupo: string;
  descricao: string | null;
  preco_centavos: number;
  unidades: number;
  estoque_item_id: string | null;
  sortido: boolean;
  sortido_grupo: "fritura" | "forno" | null;
  so_encomenda: boolean;
  ativo: boolean;
  ordem: number;
};

export type SaldoEstoque = { id: string; nome: string; grupo: "fritura" | "forno"; minimo: number; ativo: boolean; ordem: number; saldo: number; reservado: number };

/** Disponível = o que tem guardado menos o que já está vendido e não saiu. */
export function disponivel(s: Pick<SaldoEstoque, "saldo" | "reservado">): number {
  return s.saldo - s.reservado;
}

/** Repor quando o disponível fica abaixo do mínimo. */
export function precisaRepor(s: Pick<SaldoEstoque, "saldo" | "reservado" | "minimo">): boolean {
  return disponivel(s) < s.minimo;
}

/** Divide as unidades de um sortido entre os sabores escolhidos (igual ao banco: o resto vai para os primeiros). */
export function dividirSortido(unidades: number, sabores: string[]): { estoque_item_id: string; unidades: number }[] {
  if (!sabores.length) return [];
  const base = Math.floor(unidades / sabores.length);
  const resto = unidades - base * sabores.length;
  return sabores.map((id, i) => ({ estoque_item_id: id, unidades: base + (i < resto ? 1 : 0) }));
}

/** "2026-11-12" + "15:30" → instante no fuso da Delta. */
export function instanteRetirada(data: string, hora: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return null;
  return `${data}T${hora}:00-03:00`;
}

const fmtHora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Fortaleza" });
const fmtDia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" });

/** Instante → "15:30" no fuso da Delta. */
export function horaDaDelta(iso: string): string {
  return fmtHora.format(new Date(iso));
}

/** Instante → "2026-11-12" no fuso da Delta. */
export function diaDaDelta(iso: string): string {
  return fmtDia.format(new Date(iso));
}

/** Soma por salgado (estoque) das unidades de uma lista de pedidos. */
export function somarPorSalgado(
  pedidos: { pedido_itens: { composicao: { estoque_item_id: string; unidades: number }[] | null }[] }[],
): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of pedidos)
    for (const i of p.pedido_itens)
      for (const c of i.composicao ?? []) m.set(c.estoque_item_id, (m.get(c.estoque_item_id) ?? 0) + c.unidades);
  return m;
}

/** Regra combinada com o cliente: cancela com devolução até ficar pronto; depois de pronto, não. */
export const AVISO_CANCELAMENTO =
  "Cancelamento com devolução do valor só até o pedido ficar pronto. Depois de pronto, o salgado já foi feito e o valor não é devolvido.";
