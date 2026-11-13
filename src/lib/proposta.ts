// Proposta comercial (modelo da Delta): cardápio por categoria, valor total e condições.
// Funções puras: recebem o conteúdo congelado do orçamento e devolvem os textos da proposta.

import type { ConteudoOrcamento } from "@/lib/pdf/orcamento";
import { formatarCentavos } from "@/lib/dinheiro";
import { formatarData } from "@/lib/datas";
import { CATEGORIAS, formatarQuantidade, ordemCategoria, rotuloUnidade } from "@/lib/orcamentos";
import { dataPorExtenso } from "@/lib/reservas";

type Item = ConteudoOrcamento["itens"][number];

/** Categorias de estrutura (espaço, equipe, serviços) viram uma linha só no cardápio. */
const ESTRUTURA = new Set(["espaco", "equipe", "servico", "equipamento"]);
const ROTULO_ESTRUTURA = "Estrutura e equipe";

const SEMANA = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

/** "2026-11-12" → "Quinta-feira, 12 de novembro de 2026" */
export function dataDoServico(data: string | null): string {
  if (!data) return "A definir";
  const dia = SEMANA[new Date(`${data}T12:00:00Z`).getUTCDay()];
  return `${dia}, ${dataPorExtenso(data)}`;
}

function minusculaInicial(t: string): string {
  // mantém siglas e nomes próprios no meio ("Lorraine", "Banoffee"); só a primeira letra do item muda
  return t.length > 1 && t[1] === t[1].toUpperCase() && /[A-Z]/.test(t[1]) ? t : t.charAt(0).toLowerCase() + t.slice(1);
}

/** "a, b e c" */
export function listaNatural(partes: string[]): string {
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}

/** Quantidade que ajuda o cliente: salgados em unidades, kg, litros e equipe; "por pessoa" e "evento" ficam implícitos. */
function quantidadeVisivel(i: Item): string | null {
  const q = Number(i.quantidade);
  if (i.unidade === "cento") return `${formatarQuantidade(q * 100)} un.`;
  if (i.unidade === "unidade" && q <= 1) return null;
  if (["kg", "litro", "unidade", "hora", "diaria"].includes(i.unidade)) return `${formatarQuantidade(q)} ${rotuloUnidade(i.unidade, q)}`;
  return null;
}

/** Plural simples da primeira palavra: "Garçom" → "garçons", "Auxiliar de cozinha" → "auxiliares de cozinha". */
export function pluralizar(nome: string): string {
  const [primeira, ...resto] = nome.trim().split(" ");
  const p = primeira.toLowerCase();
  const plural = /m$/.test(p) ? p.replace(/m$/, "ns")
    : /ão$/.test(p) ? p.replace(/ão$/, "ões")
    : /[rz]$/.test(p) ? `${p}es`
    : /l$/.test(p) ? p.replace(/l$/, "is")
    : /[aeiouáéíóúâêô]$/.test(p) ? `${p}s`
    : p;
  return [plural, ...resto].join(" ");
}

function nomeComQuantidade(i: Item, estrutura: boolean): string {
  const q = Number(i.quantidade);
  if (estrutura && i.unidade === "evento" && q > 1 && Number.isInteger(q)) return `${formatarQuantidade(q)} ${pluralizar(i.descricao)}`;
  const visivel = quantidadeVisivel(i);
  return visivel ? `${i.descricao.trim()} (${visivel})` : i.descricao.trim();
}

export type LinhaCardapio = { categoria: string; composicao: string };

/** Cardápio agrupado na ordem do catálogo; itens sem categoria (item livre) vão para "Outros". */
export function montarCardapio(itens: Item[], categoriaPorNome?: Map<string, string>): LinhaCardapio[] {
  const grupos = new Map<string, Item[]>();
  for (const i of itens) {
    const cat = i.categoria ?? categoriaPorNome?.get(i.descricao.trim().toLowerCase()) ?? "outro";
    const chave = ESTRUTURA.has(cat) ? "__estrutura" : cat;
    grupos.set(chave, [...(grupos.get(chave) ?? []), i]);
  }
  const ordem = (k: string) => (k === "__estrutura" ? 900 : k === "outro" ? 950 : ordemCategoria(k));
  return [...grupos.entries()]
    .sort(([a], [b]) => ordem(a) - ordem(b))
    .map(([k, lista]) => {
      const estrutura = k === "__estrutura";
      const nomes = lista.map((i, n) => {
        const t = nomeComQuantidade(i, estrutura);
        return n === 0 ? t : minusculaInicial(t);
      });
      return {
        categoria: estrutura ? ROTULO_ESTRUTURA : k === "material" ? "Material de apoio" : CATEGORIAS[k] ?? "Outros",
        composicao: `${listaNatural(nomes)}.`,
      };
    });
}

/** Espaço do evento: o escolhido no orçamento ou, na falta, a locação incluída nos itens. */
function espacoDoEvento(c: ConteudoOrcamento): string | null {
  if (c.orcamento.espaco) return c.orcamento.espaco;
  const locacao = c.itens.find((i) => i.categoria === "espaco");
  if (!locacao) return null;
  const nome = locacao.descricao.trim().replace(/^loca[çc][ãa]o d[oa]\s+/i, "");
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

function local(c: ConteudoOrcamento): string {
  if (c.orcamento.local_externo?.trim()) return c.orcamento.local_externo.trim();
  const espaco = espacoDoEvento(c);
  if (espaco) return `${espaco} · Delta Espaço e Eventos`;
  return "A definir pelo contratante";
}

export function dadosDoCabecalho(c: ConteudoOrcamento) {
  return {
    data: dataDoServico(c.orcamento.data_evento),
    horario: c.orcamento.horario?.trim() || "A definir",
    publico: c.orcamento.convidados ? `${c.orcamento.convidados} pessoas` : "A definir",
    local: local(c),
  };
}

/** Texto de apresentação automático (usado quando a versão não tem um escrito à mão). */
export function apresentacaoPadrao(c: ConteudoOrcamento, cardapio = montarCardapio(c.itens)): string {
  const titulo = c.orcamento.titulo.trim();
  const para = c.orcamento.convidados ? ` para ${c.orcamento.convidados} convidados` : "";
  const comidas = cardapio.filter((l) => l.categoria !== ROTULO_ESTRUTURA && l.categoria !== "Material de apoio" && l.categoria !== "Outros");
  const com = comidas.length ? `, com ${listaNatural(comidas.map((l) => l.categoria.toLowerCase()))}` : "";
  const quando = c.orcamento.data_evento
    ? ` O serviço está previsto para ${dataDoServico(c.orcamento.data_evento).toLowerCase()}${c.orcamento.horario ? `, às ${c.orcamento.horario.trim()}` : ""}.`
    : "";
  return `A Delta Espaço e Eventos apresenta esta proposta de ${minusculaInicial(titulo)}${para}${com}.${quando}`;
}

/** Descrição do serviço na tabela de valores. */
export function descricaoDoServico(c: ConteudoOrcamento, cardapio = montarCardapio(c.itens)): string {
  const partes: string[] = [];
  const temComida = cardapio.some((l) => !["Bebidas", "Material de apoio", ROTULO_ESTRUTURA, "Outros"].includes(l.categoria));
  if (temComida) partes.push("alimentação");
  if (cardapio.some((l) => l.categoria === "Bebidas")) partes.push("bebidas");
  if (cardapio.some((l) => l.categoria === "Material de apoio")) partes.push("materiais de apoio");
  if (cardapio.some((l) => l.categoria === ROTULO_ESTRUTURA)) partes.push("estrutura e equipe");
  const para = c.orcamento.convidados ? ` para ${c.orcamento.convidados} convidados` : "";
  return `${c.orcamento.titulo.trim()}${para}${partes.length ? `, incluindo ${listaNatural(partes)}` : ""}`;
}

export function valorPorPessoa(c: ConteudoOrcamento): string | null {
  if (!c.orcamento.convidados) return null;
  return formatarCentavos(Math.round(c.total_centavos / c.orcamento.convidados));
}

/** Itens das condições gerais: validade, pagamento, observações e as regras de confirmação. */
export function condicoesGerais(c: ConteudoOrcamento, confirmacaoDias = 10): string[] {
  const linhas = (t: string | null | undefined) => (t ?? "").split(/\n+/).map((x) => x.trim().replace(/^[-•]\s*/, "")).filter(Boolean);
  const r: string[] = [];
  if (c.validade) r.push(`Proposta válida até ${formatarData(c.validade)}.`);
  r.push(...linhas(c.condicoes));
  if (!espacoDoEvento(c) && !c.orcamento.local_externo?.trim()) r.push("O local de execução deverá ser confirmado pelo contratante para validação da logística.");
  r.push(`O cardápio e a quantidade de convidados deverão ser confirmados até ${confirmacaoDias} dias antes do evento.`);
  r.push(...linhas(c.observacoes));
  return r;
}
