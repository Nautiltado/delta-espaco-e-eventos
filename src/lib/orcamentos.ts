export type StatusOrcamento = "rascunho" | "enviado" | "aprovado" | "perdido";
export type StatusVersao = "rascunho" | "enviada" | "aprovada" | "substituida";

export const STATUS_ORCAMENTO: Record<StatusOrcamento, { rotulo: string; classe: string }> = {
  rascunho: { rotulo: "Em elaboração", classe: "selo cinza" },
  enviado: { rotulo: "Enviado", classe: "selo dourado" },
  aprovado: { rotulo: "Aprovado", classe: "selo" },
  perdido: { rotulo: "Perdido", classe: "selo erro" },
};

export const STATUS_VERSAO: Record<StatusVersao, { rotulo: string; classe: string }> = {
  rascunho: { rotulo: "Rascunho", classe: "selo cinza" },
  enviada: { rotulo: "Enviada", classe: "selo dourado" },
  aprovada: { rotulo: "Aceita pelo cliente", classe: "selo" },
  substituida: { rotulo: "Substituída", classe: "selo cinza" },
};

export const TIPOS_ORCAMENTO: Record<string, string> = {
  espaco: "Locação de espaço",
  espaco_buffet: "Espaço com buffet",
  buffet_externo: "Buffet em local externo",
  outro: "Outro",
};

export const UNIDADES: Record<string, string> = {
  evento: "evento",
  pessoa: "pessoa",
  unidade: "unidade",
  cento: "cento",
  hora: "hora",
  diaria: "diária",
  kg: "kg",
  litro: "litro",
};

const PLURAIS: Record<string, string> = {
  evento: "eventos", pessoa: "pessoas", unidade: "unidades", cento: "centos", hora: "horas", diaria: "diárias", litro: "litros",
};

/** "pessoa", 90 → "pessoas"; "kg" não muda. */
export function rotuloUnidade(unidade: string, quantidade: number): string {
  return quantidade > 1 ? (PLURAIS[unidade] ?? UNIDADES[unidade] ?? unidade) : (UNIDADES[unidade] ?? unidade);
}

export const CATEGORIAS: Record<string, string> = {
  espaco: "Espaços",
  salgado_frito: "Salgados fritos",
  salgado_assado: "Salgados assados",
  lanche: "Lanches e finger foods",
  confeitaria: "Bolos e confeitaria",
  doce: "Docinhos e sobremesas",
  entrada: "Entradas, caldos e acompanhamentos",
  prato: "Pratos principais",
  salada: "Saladas",
  bebida: "Bebidas",
  material: "Materiais de apoio",
  equipe: "Equipe",
  servico: "Serviços",
  equipamento: "Equipamentos",
  alimentacao: "Alimentação (outros)",
  salgado: "Salgados (outros)",
  outro: "Outros",
};

/** Ordem das categorias como no cardápio (a ordem do objeto acima). */
export function ordemCategoria(categoria: string): number {
  const i = Object.keys(CATEGORIAS).indexOf(categoria);
  return i < 0 ? 999 : i;
}

/** Quantidade como o banco calcula: round(quantidade × preço). */
export function totalItem(quantidade: number, precoCentavos: number): number {
  return Math.round(quantidade * precoCentavos);
}

/** Margem bruta em centavos e percentual sobre o total vendido. */
export function margem(totalCentavos: number, custoCentavos: number) {
  const valor = totalCentavos - custoCentavos;
  return { valor, percentual: totalCentavos > 0 ? (valor * 100) / totalCentavos : 0 };
}

/** "1,5" ou "2" → número com até 2 casas; null se inválido ou ≤ 0. */
export function lerQuantidade(texto: string): number | null {
  const limpo = texto.trim().replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return null;
  const n = Number(limpo);
  return n > 0 ? n : null;
}

export function formatarQuantidade(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}
