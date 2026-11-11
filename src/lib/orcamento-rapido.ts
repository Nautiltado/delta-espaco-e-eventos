// Orçamento rápido: transforma um modelo (itens + regras) em linhas prontas para marcar e incluir.

export type Regra = "fixa" | "por_pessoa" | "a_cada";

export type ItemModelo = {
  catalogo_item_id: string;
  regra: Regra;
  fator: number;
  minimo: number;
  opcional: boolean;
  preco_centavos: number | null;
  ordem: number;
};

export type OpcaoRapida = {
  id: string;
  nome: string;
  grupo: string;
  unidade: string;
  /** Preço de referência do catálogo (fixo ou mínimo da faixa); null quando é "a combinar". */
  preco_catalogo: number | null;
  /** Último preço praticado em orçamentos anteriores. */
  preco_ultimo: number | null;
  /** Para itens de locação: o espaço e a capacidade dele. */
  recurso_id: string | null;
  capacidade: number | null;
};

export type Linha = {
  chave: string;
  catalogo_item_id: string;
  nome: string;
  grupo: string;
  unidade: string;
  marcado: boolean;
  quantidade: number;
  preco_centavos: number | null;
  origem_preco: "modelo" | "ultimo" | "catalogo" | null;
  regra_texto: string | null;
};

/** Passo de arredondamento (sempre para cima) de cada unidade. */
export const PASSO: Record<string, number> = { cento: 0.5, kg: 0.5, litro: 1, pessoa: 1, unidade: 1, evento: 1, hora: 1, diaria: 1 };

function arredondarParaCima(valor: number, passo: number): number {
  return Math.round(Math.ceil(valor / passo - 1e-9) * passo * 100) / 100;
}

export function calcularQuantidade(regra: Regra, fator: number, minimo: number, convidados: number | null, unidade: string): number {
  const passo = PASSO[unidade] ?? 1;
  let q: number;
  if (regra === "fixa") q = fator;
  else if (!convidados || convidados <= 0) q = Math.max(minimo, passo);
  else if (regra === "por_pessoa") q = convidados * fator;
  else q = Math.ceil(convidados / fator - 1e-9);
  return Math.max(arredondarParaCima(q, regra === "fixa" ? 0.01 : passo), minimo, regra === "fixa" ? 0 : passo);
}

export function descreverRegra(regra: Regra, fator: number, minimo: number, unidade: string): string {
  const num = (n: number) => String(n).replace(".", ",");
  if (regra === "fixa") return `${num(fator)} fixo`;
  if (regra === "a_cada") return `1 a cada ${num(fator)} convidados${minimo ? `, mínimo ${num(minimo)}` : ""}`;
  const porPessoa = unidade === "cento" ? `${num(Math.round(fator * 100 * 100) / 100)} un. por convidado` : `${num(fator)} por convidado`;
  return `${porPessoa}${minimo ? `, mínimo ${num(minimo)}` : ""}`;
}

/** Entre os itens de locação do modelo, só o espaço certo vem marcado. */
function espacoEscolhido(opcoes: OpcaoRapida[], convidados: number | null, recursoDoOrcamento: string | null, externo: boolean): string | null {
  if (externo) return null;
  const espacos = opcoes.filter((o) => o.recurso_id);
  if (!espacos.length) return null;
  const doOrcamento = espacos.find((o) => o.recurso_id === recursoDoOrcamento);
  if (doOrcamento) return doOrcamento.id;
  const ordenados = [...espacos].sort((a, b) => (a.capacidade ?? 0) - (b.capacidade ?? 0));
  const cabe = ordenados.find((o) => !convidados || (o.capacidade ?? Infinity) >= convidados);
  return (cabe ?? ordenados[ordenados.length - 1]).id;
}

export function precoPadrao(preco_modelo: number | null, o: OpcaoRapida): { preco: number | null; origem: Linha["origem_preco"] } {
  if (preco_modelo != null) return { preco: preco_modelo, origem: "modelo" };
  if (o.preco_ultimo != null) return { preco: o.preco_ultimo, origem: "ultimo" };
  if (o.preco_catalogo != null) return { preco: o.preco_catalogo, origem: "catalogo" };
  return { preco: null, origem: null };
}

export function linhasDoModelo(
  itens: ItemModelo[],
  catalogo: Map<string, OpcaoRapida>,
  ctx: { convidados: number | null; recurso_id: string | null; externo: boolean },
): Linha[] {
  const opcoes = itens.map((i) => catalogo.get(i.catalogo_item_id)).filter((o): o is OpcaoRapida => !!o);
  const espaco = espacoEscolhido(opcoes, ctx.convidados, ctx.recurso_id, ctx.externo);
  return [...itens]
    .sort((a, b) => a.ordem - b.ordem)
    .flatMap((i) => {
      const o = catalogo.get(i.catalogo_item_id);
      if (!o) return [];
      const { preco, origem } = precoPadrao(i.preco_centavos, o);
      const marcado = o.recurso_id ? o.id === espaco : !i.opcional;
      return [{
        chave: o.id,
        catalogo_item_id: o.id,
        nome: o.nome,
        grupo: o.grupo,
        unidade: o.unidade,
        marcado,
        quantidade: calcularQuantidade(i.regra, Number(i.fator), Number(i.minimo), ctx.convidados, o.unidade),
        preco_centavos: preco,
        origem_preco: origem,
        regra_texto: descreverRegra(i.regra, Number(i.fator), Number(i.minimo), o.unidade),
      }];
    });
}

/** Linha avulsa, escolhida na busca do catálogo. */
export function linhaAvulsa(o: OpcaoRapida, convidados: number | null): Linha {
  const { preco, origem } = precoPadrao(null, o);
  const porPessoa = o.unidade === "pessoa";
  return {
    chave: o.id, catalogo_item_id: o.id, nome: o.nome, grupo: o.grupo, unidade: o.unidade, marcado: true,
    quantidade: porPessoa && convidados ? convidados : 1, preco_centavos: preco, origem_preco: origem, regra_texto: null,
  };
}

/** Busca sem acento e por pedaços de palavra: "mini piz" acha "Mini pizza". */
export function buscarNoCatalogo(opcoes: OpcaoRapida[], termo: string, limite = 12): OpcaoRapida[] {
  const n = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const partes = n(termo).split(/\s+/).filter(Boolean);
  if (!partes.length) return [];
  return opcoes.filter((o) => partes.every((p) => n(`${o.nome} ${o.grupo}`).includes(p))).slice(0, limite);
}
