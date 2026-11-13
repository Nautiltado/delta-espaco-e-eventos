// Unidades de cobrança (tabela `unidades`): rótulos, equivalência (1 cento = 100 unidades) e passo de arredondamento.

export type Unidade = {
  codigo: string;
  singular: string;
  plural: string;
  equivale_quantidade: number | null;
  equivale_unidade: string | null;
  passo: number;
  ativo: boolean;
  ordem: number;
};

/** As mesmas do banco ao criar a tabela; usadas onde a lista do banco não foi carregada (PDF antigo, contrato). */
export const UNIDADES_PADRAO: Unidade[] = [
  { codigo: "unidade", singular: "unidade", plural: "unidades", equivale_quantidade: null, equivale_unidade: null, passo: 1, ativo: true, ordem: 10 },
  { codigo: "cento", singular: "cento", plural: "centos", equivale_quantidade: 100, equivale_unidade: "unidade", passo: 0.5, ativo: true, ordem: 20 },
  { codigo: "pessoa", singular: "pessoa", plural: "pessoas", equivale_quantidade: null, equivale_unidade: null, passo: 1, ativo: true, ordem: 30 },
  { codigo: "evento", singular: "evento", plural: "eventos", equivale_quantidade: null, equivale_unidade: null, passo: 1, ativo: true, ordem: 40 },
  { codigo: "servico", singular: "serviço", plural: "serviços", equivale_quantidade: null, equivale_unidade: null, passo: 1, ativo: true, ordem: 50 },
  { codigo: "hora", singular: "hora", plural: "horas", equivale_quantidade: null, equivale_unidade: null, passo: 1, ativo: true, ordem: 60 },
  { codigo: "diaria", singular: "diária", plural: "diárias", equivale_quantidade: null, equivale_unidade: null, passo: 1, ativo: true, ordem: 70 },
  { codigo: "kg", singular: "kg", plural: "kg", equivale_quantidade: null, equivale_unidade: null, passo: 0.5, ativo: true, ordem: 80 },
  { codigo: "grama", singular: "g", plural: "g", equivale_quantidade: null, equivale_unidade: null, passo: 50, ativo: true, ordem: 90 },
  { codigo: "litro", singular: "litro", plural: "litros", equivale_quantidade: null, equivale_unidade: null, passo: 1, ativo: true, ordem: 100 },
  { codigo: "bandeja", singular: "bandeja", plural: "bandejas", equivale_quantidade: null, equivale_unidade: null, passo: 1, ativo: true, ordem: 110 },
  { codigo: "travessa", singular: "travessa", plural: "travessas", equivale_quantidade: null, equivale_unidade: null, passo: 1, ativo: true, ordem: 120 },
];

export type MapaUnidades = Map<string, Unidade>;

export function mapaDeUnidades(lista: Unidade[] = UNIDADES_PADRAO): MapaUnidades {
  const m = new Map(UNIDADES_PADRAO.map((u) => [u.codigo, u]));
  for (const u of lista) m.set(u.codigo, { ...u, equivale_quantidade: u.equivale_quantidade == null ? null : Number(u.equivale_quantidade), passo: Number(u.passo) });
  return m;
}

const PADRAO = mapaDeUnidades();

/** "pessoa", 90 → "pessoas"; 1 → "pessoa". Unidade desconhecida aparece pelo código. */
export function rotuloDaUnidade(codigo: string, quantidade: number, mapa: MapaUnidades = PADRAO): string {
  const u = mapa.get(codigo);
  if (!u) return codigo;
  return quantidade > 1 ? u.plural : u.singular;
}

function numero(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

/** Equivalência para o cliente e a cozinha: 2 centos → "200 unidades". Null se a unidade não tem equivalência. */
export function equivalencia(codigo: string, quantidade: number, mapa: MapaUnidades = PADRAO): string | null {
  const u = mapa.get(codigo);
  if (!u?.equivale_quantidade || !u.equivale_unidade) return null;
  const total = Math.round(quantidade * u.equivale_quantidade * 1000) / 1000;
  return `${numero(total)} ${rotuloDaUnidade(u.equivale_unidade, total, mapa)}`;
}

/** "2 centos (200 unidades)" */
export function quantidadeComUnidade(codigo: string, quantidade: number, mapa: MapaUnidades = PADRAO): string {
  const eq = equivalencia(codigo, quantidade, mapa);
  return `${numero(quantidade)} ${rotuloDaUnidade(codigo, quantidade, mapa)}${eq ? ` (${eq})` : ""}`;
}

export function passoDaUnidade(codigo: string, mapa: MapaUnidades = PADRAO): number {
  return mapa.get(codigo)?.passo ?? 1;
}
