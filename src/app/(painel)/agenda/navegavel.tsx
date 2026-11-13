"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Filtro, Vista } from "@/lib/agenda";
import { avisar } from "@/componentes/avisos";
import type { ItemAgenda } from "@/lib/agenda";
import { periodoDaVista } from "@/lib/agenda";

export type DadosPeriodo = { vista: Vista; ancora: string; periodo: ReturnType<typeof periodoDaVista>; itens: ItemAgenda[] };

async function carregarPeriodo(vista: Vista, ancora: string): Promise<DadosPeriodo | { erro: string }> {
  try {
    const r = await fetch(`/agenda/periodo?vista=${vista}&data=${ancora}`, { cache: "no-store" });
    return (await r.json()) as DadosPeriodo | { erro: string };
  } catch {
    return { erro: "Sem conexão. Tente de novo." };
  }
}
import { CentralAgenda, type PropsFixas } from "./central";

type Atual = DadosPeriodo & { diaInicial: string | null; filtroInicial: Filtro; entrada: "esq" | "dir" | null };

const VALIDADE_MS = 60_000;
const chave = (vista: string, ancora: string) => `${vista}|${ancora}`;

/**
 * Agenda que troca de mês, semana ou dia sem esperar o servidor: os períodos vizinhos já ficam
 * carregados em segundo plano, então o deslize começa no mesmo instante do clique.
 * O endereço acompanha (dá para recarregar, voltar e compartilhar o link).
 */
export function AgendaNavegavel({ inicial, fixas }: {
  inicial: DadosPeriodo & { diaInicial: string | null; filtroInicial: Filtro };
  fixas: PropsFixas;
}) {
  const [atual, setAtual] = useState<Atual>({ ...inicial, entrada: null });
  // o servidor mandou dados novos (depois de salvar algo, por exemplo): eles valem mais que o guardado
  const [base, setBase] = useState(inicial);
  const cache = useRef(new Map<string, { dados: Promise<DadosPeriodo>; em: number }>());
  const [carregando, setCarregando] = useState(false);
  if (base !== inicial) {
    setBase(inicial);
    setAtual({ ...inicial, entrada: null });
  }
  useEffect(() => { cache.current.clear(); pronto.current.clear(); }, [inicial]);

  /** Uma busca por período: quem pede de novo enquanto ela anda espera a mesma resposta. */
  const buscar = useCallback((vista: Vista, ancora: string) => {
    const k = chave(vista, ancora);
    const c = cache.current.get(k);
    if (c && Date.now() - c.em < VALIDADE_MS) return c.dados;
    const dados = carregarPeriodo(vista, ancora).then((r) => {
      if ("erro" in r) { cache.current.delete(k); throw new Error(r.erro); }
      return r;
    });
    cache.current.set(k, { dados, em: Date.now() });
    return dados;
  }, []);
  const pronto = useRef(new Set<string>());

  // deixa prontos dois períodos de cada lado (dá para clicar várias vezes seguidas sem esperar)
  useEffect(() => {
    const k = chave(atual.vista, atual.ancora);
    cache.current.set(k, { dados: Promise.resolve(atual), em: Date.now() });
    pronto.current.add(k);
    const ant = atual.periodo.anterior, seg = atual.periodo.seguinte;
    const ant2 = periodoDaVista(atual.vista, ant).anterior, seg2 = periodoDaVista(atual.vista, seg).seguinte;
    for (const a of [seg, ant, seg2, ant2]) {
      void buscar(atual.vista, a).then(() => pronto.current.add(chave(atual.vista, a))).catch(() => {});
    }
  }, [atual, buscar]);

  const mostrar = useCallback(async (vista: Vista, ancora: string, direcao: "esq" | "dir" | null, filtro: Filtro, gravarEndereco: boolean) => {
    let dados: DadosPeriodo;
    const k = chave(vista, ancora);
    const c = cache.current.get(k);
    const jaChegou = !!c && pronto.current.has(k) && Date.now() - c.em < VALIDADE_MS;
    if (!jaChegou) setCarregando(true);
    try { dados = await buscar(vista, ancora); }
    catch (e) { setCarregando(false); avisar(e instanceof Error ? e.message : "Não foi possível abrir este período.", "erro"); return; }
    setCarregando(false);
    setAtual({ ...dados, diaInicial: null, filtroInicial: filtro, entrada: direcao });
    if (gravarEndereco) {
      const u = new URL(window.location.href);
      u.searchParams.set("vista", vista); u.searchParams.set("data", ancora);
      u.searchParams.delete("dia"); u.searchParams.delete("mes");
      if (filtro === "todos") u.searchParams.delete("espaco"); else u.searchParams.set("espaco", filtro);
      window.history.pushState(null, "", u.toString());
    }
  }, [buscar]);

  // voltar e avançar do navegador
  useEffect(() => {
    const aoVoltar = () => {
      const u = new URL(window.location.href);
      const vista = (u.searchParams.get("vista") ?? "mes") as Vista;
      const ancora = u.searchParams.get("data");
      if (ancora && /^\d{4}-\d{2}-\d{2}$/.test(ancora)) void mostrar(vista, ancora, null, (u.searchParams.get("espaco") ?? "todos") as Filtro, false);
    };
    window.addEventListener("popstate", aoVoltar);
    return () => window.removeEventListener("popstate", aoVoltar);
  }, [mostrar]);

  return (
    <CentralAgenda
      key={chave(atual.vista, atual.ancora)}
      {...fixas}
      vista={atual.vista}
      ancora={atual.ancora}
      periodo={atual.periodo}
      itens={atual.itens}
      diaInicial={atual.diaInicial}
      filtroInicial={atual.filtroInicial}
      entrada={atual.entrada}
      carregando={carregando}
      navegar={(vista, ancora, direcao, filtro) => void mostrar(vista, ancora, direcao, filtro, true)}
    />
  );
}
