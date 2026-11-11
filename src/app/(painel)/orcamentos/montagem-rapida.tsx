"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adicionarItensEmLote, type Estado } from "./actions";
import { centavosParaCampo, formatarCentavos, lerReais } from "@/lib/dinheiro";
import { formatarQuantidade, lerQuantidade, rotuloUnidade, totalItem } from "@/lib/orcamentos";
import { buscarNoCatalogo, linhaAvulsa, linhasDoModelo, type ItemModelo, type Linha, type OpcaoRapida } from "@/lib/orcamento-rapido";

type LinhaTela = Linha & { qtdTexto: string; precoTexto: string };
type Modelo = { id: string; nome: string; descricao: string | null; itens: ItemModelo[] };

const ORIGEM: Record<string, string> = { modelo: "preço do modelo", ultimo: "último preço usado", catalogo: "preço do catálogo" };

function paraTela(l: Linha): LinhaTela {
  return { ...l, qtdTexto: formatarQuantidade(l.quantidade), precoTexto: l.preco_centavos == null ? "" : centavosParaCampo(l.preco_centavos) };
}

/**
 * Montar o orçamento de uma vez: escolhe um modelo (as quantidades saem do número de convidados),
 * marca/desmarca, ajusta, acrescenta do catálogo pela busca e inclui tudo num clique.
 */
export function MontagemRapida({
  versaoId, opcoes, modelos, convidados, recursoId, externo, aberto,
}: {
  versaoId: string; opcoes: OpcaoRapida[]; modelos: Modelo[]; convidados: number | null; recursoId: string | null; externo: boolean; aberto: boolean;
}) {
  const router = useRouter();
  const [linhas, setLinhas] = useState<LinhaTela[]>([]);
  const [modeloAtual, setModeloAtual] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [estado, setEstado] = useState<Estado>({});
  const [enviando, iniciar] = useTransition();
  const campoBusca = useRef<HTMLInputElement>(null);
  const catalogo = useMemo(() => new Map(opcoes.map((o) => [o.id, o])), [opcoes]);
  const resultados = useMemo(() => buscarNoCatalogo(opcoes, busca, 10), [opcoes, busca]);

  function usarModelo(m: Modelo) {
    setModeloAtual(m.id);
    setEstado({});
    setLinhas(linhasDoModelo(m.itens, catalogo, { convidados, recurso_id: recursoId, externo }).map(paraTela));
  }

  function acrescentar(o: OpcaoRapida) {
    setLinhas((atual) => {
      const ja = atual.find((l) => l.catalogo_item_id === o.id);
      if (ja) return atual.map((l) => (l === ja ? { ...l, marcado: true } : l));
      return [...atual, paraTela(linhaAvulsa(o, convidados))];
    });
    setBusca("");
    campoBusca.current?.focus();
  }

  function mudar(chave: string, campo: Partial<LinhaTela>) {
    setLinhas((atual) => atual.map((l) => (l.chave === chave ? { ...l, ...campo } : l)));
  }

  const marcadas = linhas.filter((l) => l.marcado);
  const calculadas = marcadas.map((l) => ({ l, q: lerQuantidade(l.qtdTexto), p: lerReais(l.precoTexto) }));
  const semPreco = calculadas.filter((c) => c.p === null).length;
  const qtdInvalida = calculadas.filter((c) => c.q === null).length;
  const total = calculadas.reduce((s, c) => s + (c.q !== null && c.p !== null ? totalItem(c.q, c.p) : 0), 0);

  function incluir() {
    if (!marcadas.length) return setEstado({ erro: "Marque ao menos um item." });
    if (qtdInvalida) return setEstado({ erro: "Confira as quantidades marcadas em vermelho." });
    if (semPreco) return setEstado({ erro: `Falta o preço de ${semPreco} ${semPreco === 1 ? "item" : "itens"} (em vermelho).` });
    iniciar(async () => {
      const r = await adicionarItensEmLote(versaoId, calculadas.map((c) => ({
        catalogo_item_id: c.l.catalogo_item_id, descricao: c.l.nome, unidade: c.l.unidade, quantidade: c.q!, preco_centavos: c.p!,
      })));
      setEstado(r);
      if (r.ok) {
        setLinhas([]);
        setModeloAtual(null);
        router.refresh();
      }
    });
  }

  return (
    <details className="montagem" open={aberto}>
      <summary><strong>Montar rápido</strong> <span className="mudo">· por modelo ou buscando no catálogo, vários itens de uma vez</span></summary>

      {modelos.length > 0 && (
        <div className="modelos" role="group" aria-label="Modelos de orçamento">
          {modelos.map((m) => (
            <button key={m.id} type="button" className={modeloAtual === m.id ? "modelo ativo" : "modelo"} onClick={() => usarModelo(m)} title={m.descricao ?? ""}>
              {m.nome}
            </button>
          ))}
        </div>
      )}
      {!convidados && (
        <p className="aviso info" style={{ marginTop: 8 }}>Informe os convidados nos dados do evento para o sistema calcular as quantidades.</p>
      )}

      <div className="busca-rapida">
        <label htmlFor="busca-rapida" className="sr-only">Buscar no catálogo</label>
        <input
          id="busca-rapida" ref={campoBusca} type="search" value={busca} autoComplete="off"
          placeholder="Acrescentar do catálogo: digite (ex.: coxinha, filé, suco) e Enter"
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (resultados[0]) acrescentar(resultados[0]); } }}
        />
        {busca && (
          <ul className="resultados">
            {resultados.length === 0 && <li className="mudo" style={{ padding: "8px 10px" }}>Nada encontrado. Use “Incluir item” abaixo para item livre.</li>}
            {resultados.map((o) => (
              <li key={o.id}>
                <button type="button" onClick={() => acrescentar(o)}>
                  <span>{o.nome}</span>
                  <span className="mudo">{o.grupo} · por {rotuloUnidade(o.unidade, 1)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {linhas.length > 0 && (
        <div className="tabela-rapida">
          <table>
            <thead>
              <tr><th style={{ width: 28 }} /><th>Item</th><th style={{ width: 120 }}>Qtd.</th><th style={{ width: 130 }}>Preço unit. (R$)</th><th className="numero" style={{ width: 110 }}>Total</th></tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const q = lerQuantidade(l.qtdTexto);
                const p = lerReais(l.precoTexto);
                return (
                  <tr key={l.chave} className={l.marcado ? undefined : "desmarcada"}>
                    <td><input type="checkbox" checked={l.marcado} aria-label={`Incluir ${l.nome}`} onChange={(e) => mudar(l.chave, { marcado: e.target.checked })} /></td>
                    <td>
                      {l.nome}
                      <div className="mudo" style={{ fontSize: ".75rem" }}>{l.regra_texto ?? l.grupo}</div>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input type="text" inputMode="decimal" value={l.qtdTexto} aria-label={`Quantidade de ${l.nome}`}
                          className={l.marcado && q === null ? "invalido" : undefined}
                          onChange={(e) => mudar(l.chave, { qtdTexto: e.target.value, marcado: true })} style={{ width: 64 }} />
                        <span className="mudo" style={{ fontSize: ".75rem" }}>{rotuloUnidade(l.unidade, q ?? 1)}</span>
                      </div>
                    </td>
                    <td>
                      <input type="text" inputMode="decimal" value={l.precoTexto} placeholder="preço" aria-label={`Preço de ${l.nome}`}
                        className={l.marcado && p === null ? "invalido" : undefined}
                        onChange={(e) => mudar(l.chave, { precoTexto: e.target.value, marcado: true })} />
                      {l.origem_preco && <div className="mudo" style={{ fontSize: ".7rem" }}>{ORIGEM[l.origem_preco]}</div>}
                    </td>
                    <td className="numero">{l.marcado && q !== null && p !== null ? formatarCentavos(totalItem(q, p)) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {estado.erro && <p className="aviso erro" role="alert">{estado.erro}</p>}
      {estado.ok && <p className="aviso ok" role="status">{estado.ok}</p>}

      {linhas.length > 0 && (
        <div className="linha" style={{ alignItems: "center", marginTop: 10 }}>
          <button type="button" className="botao" onClick={incluir} disabled={enviando}>
            {enviando ? "Incluindo…" : `Incluir ${marcadas.length} ${marcadas.length === 1 ? "item" : "itens"} · ${formatarCentavos(total)}`}
          </button>
          <button type="button" className="botao secundario" onClick={() => { setLinhas([]); setModeloAtual(null); setEstado({}); }}>Limpar</button>
          {semPreco > 0 && <span className="mudo">{semPreco} sem preço</span>}
        </div>
      )}
    </details>
  );
}
