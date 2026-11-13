// Operação do evento (Fase 7): equipe, checklist, gastos e fechamento.
import { formatarCentavos } from "@/lib/dinheiro";
import type { Permissao } from "@/lib/permissoes";

/** Quem vê os eventos: comercial, operação, financeiro e cozinha. */
export const PERMISSOES_EVENTOS: Permissao[] = ["orcamento.ver", "escala.gerir", "evento.fechar", "producao.status", "custo.ver", "evento.ver"];

export const FUNCOES: Record<string, { um: string; varios: string }> = {
  garcom: { um: "garçom", varios: "garçons" },
  seguranca: { um: "segurança", varios: "seguranças" },
  cozinha: { um: "ajudante de cozinha", varios: "ajudantes de cozinha" },
  recepcao: { um: "recepcionista", varios: "recepcionistas" },
  limpeza: { um: "pessoa da limpeza", varios: "pessoas da limpeza" },
  outro: { um: "ajudante", varios: "ajudantes" },
};

export function nomeFuncao(funcao: string, quantidade: number): string {
  const f = FUNCOES[funcao] ?? FUNCOES.outro;
  return `${quantidade} ${quantidade === 1 ? f.um : f.varios}`;
}

export const CATEGORIAS_GASTO: Record<string, string> = {
  compras: "Compras (comida, mercado)",
  bebidas: "Bebidas",
  gas: "Gás",
  aluguel: "Aluguel de equipamento",
  transporte: "Transporte",
  decoracao: "Decoração",
  outros: "Outros",
};

export const ETAPAS: Record<string, string> = {
  montagem: "Montagem",
  conferencia: "Antes de abrir",
  desmontagem: "Desmontagem",
};

export type ItemFicha = { descricao: string; quantidade: number; unidade: string | null };
export type Ficha = {
  id: string; versao_status: string | null; titulo: string | null; status: string; inicio: string; fim: string; valor_total_centavos: number | null;
  cliente: { nome: string; telefone: string | null } | null;
  orcamento: { id: string; numero: string; tipo: string | null; convidados: number | null; horario: string | null; local_externo: string | null } | null;
  espacos: string[]; itens: ItemFicha[];
};
export type LinhaEquipe = {
  id: string; funcao: string; quantidade: number; valor_unitario_centavos: number; fornecedor: string | null;
  observacao: string | null; pago_em: string | null;
};
export type Gasto = {
  id: string; categoria: string; descricao: string; fornecedor: string | null; valor_centavos: number; data: string; pago: boolean;
};

/** O que o cliente contratou no orçamento manda; sem isso, a regra da casa (1 garçom até 30 pessoas, 2 acima). */
export function sugerirEquipe(itens: ItemFicha[], convidados: number | null, tipo: string | null): { garcom: number; seguranca: number } {
  const soma = (re: RegExp) => itens.filter((i) => re.test(i.descricao)).reduce((s, i) => s + Number(i.quantidade), 0);
  let garcom = Math.round(soma(/gar[çc]o(m|n)/i));
  const seguranca = Math.round(soma(/seguran[çc]a/i));
  if (!garcom) {
    const semGarcom = /coffee|caf[ée] da manh/i.test(tipo ?? "");
    garcom = semGarcom || !convidados ? 0 : convidados <= 30 ? 1 : 2;
  }
  return { garcom, seguranca };
}

export function totalEquipe(linhas: Pick<LinhaEquipe, "quantidade" | "valor_unitario_centavos">[]): number {
  return linhas.reduce((s, l) => s + l.quantidade * Number(l.valor_unitario_centavos), 0);
}

export function fechamento(contratado: number, equipe: LinhaEquipe[], gastos: Gasto[]) {
  const custoEquipe = totalEquipe(equipe);
  const custoGastos = gastos.reduce((s, g) => s + Number(g.valor_centavos), 0);
  const aPagar = totalEquipe(equipe.filter((l) => !l.pago_em)) + gastos.filter((g) => !g.pago).reduce((s, g) => s + Number(g.valor_centavos), 0);
  const custos = custoEquipe + custoGastos;
  const resultado = contratado - custos;
  return { custoEquipe, custoGastos, custos, aPagar, resultado, margem: contratado > 0 ? Math.round((resultado / contratado) * 100) : 0 };
}

/** Texto para mandar a quem fornece a equipe. */
export function mensagemEquipe(d: {
  responsavel: string; dia: string; chegada: string | null; horario: string; titulo: string; convidados: number | null;
  linhas: Pick<LinhaEquipe, "funcao" | "quantidade">[]; traje: string | null; observacoes: string | null; local: string;
}): string {
  const pedido = d.linhas.map((l) => nomeFuncao(l.funcao, l.quantidade)).join(", ");
  return [
    `Olá, ${d.responsavel}! Equipe para evento no Delta:`,
    `📅 ${d.dia}${d.chegada ? `, chegar às ${d.chegada}` : ""} (evento ${d.horario})`,
    `📍 ${d.local}`,
    `🎉 ${d.titulo}${d.convidados ? `, ${d.convidados} convidados` : ""}`,
    pedido ? `👥 Precisamos de: ${pedido}` : "",
    d.traje ? `👔 Traje: ${d.traje}` : "",
    d.observacoes ? `📝 ${d.observacoes}` : "",
    "Pode confirmar?",
  ].filter(Boolean).join("\n");
}

export function descreverResultado(resultado: number): string {
  return resultado >= 0 ? `Sobrou ${formatarCentavos(resultado)}` : `Faltou ${formatarCentavos(-resultado)}`;
}
