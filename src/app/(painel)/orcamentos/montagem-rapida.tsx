"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adicionarItensEmLote, type Estado } from "./actions";
import { centavosParaCampo, formatarCentavos, lerReais } from "@/lib/dinheiro";
import { formatarQuantidade, lerQuantidade, totalItem } from "@/lib/orcamentos";
import { equivalencia, mapaDeUnidades, rotuloDaUnidade, type Unidade } from "@/lib/unidades";
import { aplicarBandejaRodada, buscarNoCatalogo, GARCOM, linhaAvulsa, linhasDoModelo, type ItemModelo, type Linha, type OpcaoRapida } from "@/lib/orcamento-rapido";

type LinhaTela = Linha & { qtdTexto: string; precoTexto: string };
type Modelo = { id: string; nome: string; descricao: string | null; itens: ItemModelo[] };

const ORIGEM: Record<string, string> = { modelo: "preço do modelo", catalogo: "preço do catálogo" };

/** A tela guarda a quantidade como texto; a regra da bandeja trabalha com número. */
function comBandeja(linhas: LinhaTela[], opcoes: OpcaoRapida[], convidados: number | null): { linhas: LinhaTela[]; aviso: string | null } {
  const comoNumero = linhas.map((l) => ({ ...l, quantidade: lerQuantidade(l.qtdTexto) ?? 0 }));
  const garcom = opcoes.find((o) => o.nome === GARCOM);
  const r = aplicarBandejaRodada(comoNumero, () => (garcom ? paraTela(linhaAvulsa(garcom, convidados)) : null));
  if (!r.aviso) return { linhas, aviso: null };
  return { linhas: r.linhas.map((l) => ({ ...l, qtdTexto: formatarQuantidade(l.quantidade) })), aviso: r.aviso };
}

function paraTela(l: Linha): LinhaTela {
  return { ...l, qtdTexto: formatarQuantidade(l.quantidade), precoTexto: l.preco_centavos == null ? "" : centavosParaCampo(l.preco_centavos) };
}

/**
 * Montar o orçamento de uma vez: escolhe um modelo (as quantidades saem do número de convidados),
 * marca/desmarca, ajusta, acrescenta do catálogo pela busca e inclui tudo num clique.
 */
export function MontagemRapida({
  versaoId, opcoes, modelos, convidados, recursoId, externo, aberto, totalAtual, unidades,
}: {
  versaoId: string; opcoes: OpcaoRapida[]; modelos: Modelo[]; convidados: number | null; recursoId: string | null; externo: boolean; aberto: boolean;
  /** Total do orçamento como está agora (sem estas linhas ainda não incluídas). */
  totalAtual: number;
  unidades: Unidade[];
}) {
  const mapaUnidades = useMemo(() => mapaDeUnidades(unidades), [unidades]);
  const router = useRouter();
  const [linhas, setLinhas] = useState<LinhaTela[]>([]);
  const [modeloAtual, setModeloAtual] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [estado, setEstado] = useState<Estado>({});
  const [avisoRegra, setAvisoRegra] = useState<string | null>(null);

  /** Toda mudança na lista passa pela regra da bandeja rodada (mínimo de 2 garçons). */
  function atualizar(f: (atual: LinhaTela[]) => LinhaTela[]) {
    setLinhas((atual) => {
      const r = comBandeja(f(atual), opcoes, convidados);
      setAvisoRegra(r.aviso);
      return r.linhas;
    });
  }
  const [enviando, iniciar] = useTransition();
  const campoBusca = useRef<HTMLInputElement>(null);
  const catalogo = useMemo(() => new Map(opcoes.map((o) => [o.id, o])), [opcoes]);
  const resultados = useMemo(() => buscarNoCatalogo(opcoes, busca, 10), [opcoes, busca]);

  function usarModelo(m: Modelo) {
    setModeloAtual(m.id);
    setEstado({});
    atualizar(() => linhasDoModelo(m.itens, catalogo, { convidados, recurso_id: recursoId, externo }).map(paraTela));
  }

  function acrescentar(o: OpcaoRapida) {
    atualizar((atual) => {
      const ja = atual.find((l) => l.catalogo_item_id === o.id);
      if (ja) return atual.map((l) => (l === ja ? { ...l, marcado: true } : l));
      return [...atual, paraTela(linhaAvulsa(o, convidados))];
    });
    setBusca("");
    campoBusca.current?.focus();
  }

  function mudar(chave: string, campo: Partial<LinhaTela>) {
    // Só checkbox dispara a regra; ao digitar a quantidade, a pessoa manda (o aviso fica se baixar de 2).
    if ("marcado" in campo && !("qtdTexto" in campo) && !("precoTexto" in campo)) {
      atualizar((atual) => atual.map((l) => (l.chave === chave ? { ...l, ...campo } : l)));
    } else {
      setLinhas((atual) => atual.map((l) => (l.chave === chave ? { ...l, ...campo } : l)));
    }
  }

  const marcadas = linhas.filter((l) => l.marcado);
  const calculadas = marcadas.map((l) => ({ l, q: lerQuantidade(l.qtdTexto), p: lerReais(l.precoTexto) }));
  // preço em branco = pendente (entra no orçamento, mas o envio fica bloqueado até alguém definir)
  const calculadasComPendente = calculadas.map((c) => ({ ...c, pendente: !c.l.precoTexto.trim(), invalido: !!c.l.precoTexto.trim() && c.p === null }));
  const semPreco = calculadasComPendente.filter((c) => c.pendente).length;
  const precoInvalido = calculadasComPendente.filter((c) => c.invalido).length;
  const qtdInvalida = calculadas.filter((c) => c.q === null).length;
  const total = calculadas.reduce((s, c) => s + (c.q !== null && c.p !== null ? totalItem(c.q, c.p) : 0), 0);

  function incluir() {
    if (!marcadas.length) return setEstado({ erro: "Marque ao menos um item." });
    if (qtdInvalida) return setEstado({ erro: "Confira as quantidades marcadas em vermelho." });
    const garcons = calculadas.find((c) => c.l.nome === GARCOM)?.q ?? 0;
    if (marcadas.some((l) => l.nome === "Bandeja rodada") && garcons < 2) {
      return setEstado({ erro: "Bandeja rodada pede no mínimo 2 garçons." });
    }
    if (precoInvalido) return setEstado({ erro: "Confira os preços marcados em vermelho (ex.: 90,00), ou deixe em branco para definir depois." });
    iniciar(async () => {
      const r = await adicionarItensEmLote(versaoId, calculadas.map((c) => ({
        catalogo_item_id: c.l.catalogo_item_id, descricao: c.l.nome, unidade: c.l.unidade, quantidade: c.q!, preco_centavos: c.l.precoTexto.trim() ? c.p! : null,
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
                  <span className="mudo">{o.grupo} · por {rotuloDaUnidade(o.unidade, 1, mapaUnidades)}</span>
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
                        <span className="mudo" style={{ fontSize: ".75rem" }}>{rotuloDaUnidade(l.unidade, q ?? 1, mapaUnidades)}</span>
                      </div>
                      {q !== null && equivalencia(l.unidade, q, mapaUnidades) && (
                        <div className="mudo" style={{ fontSize: ".7rem" }}>= {equivalencia(l.unidade, q, mapaUnidades)}</div>
                      )}
                    </td>
                    <td>
                      <input type="text" inputMode="decimal" value={l.precoTexto} placeholder="a definir" aria-label={`Preço de ${l.nome}`}
                        className={l.marcado && !!l.precoTexto.trim() && p === null ? "invalido" : undefined}
                        onChange={(e) => mudar(l.chave, { precoTexto: e.target.value, marcado: true })} />
                      {l.origem_preco && <div className="mudo" style={{ fontSize: ".7rem" }}>{ORIGEM[l.origem_preco]}</div>}
                      {!l.precoTexto.trim() && <div className="texto-alerta" style={{ fontSize: ".7rem" }}>pendente</div>}
                      {catalogo.get(l.catalogo_item_id)?.preco_ultimo != null && (
                        <div className="mudo" style={{ fontSize: ".7rem" }} title="Preço usado num orçamento anterior. Só referência: não é aplicado sozinho.">
                          último: {formatarCentavos(catalogo.get(l.catalogo_item_id)!.preco_ultimo!)}
                        </div>
                      )}
                    </td>
                    <td className="numero">{l.marcado && q !== null && p !== null ? formatarCentavos(totalItem(q, p)) : l.marcado && !l.precoTexto.trim() ? <span className="texto-alerta">pendente</span> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {avisoRegra && <p className="aviso info">{avisoRegra}</p>}
      {linhas.some((l) => l.nome === "Bandeja rodada" && l.marcado) && (() => {
        const g = linhas.find((l) => l.nome === GARCOM);
        const q = g && g.marcado ? lerQuantidade(g.qtdTexto) ?? 0 : 0;
        return q < 2 ? <p className="aviso erro">Bandeja rodada pede no mínimo 2 garçons.</p> : null;
      })()}
      {estado.erro && <p className="aviso erro" role="alert">{estado.erro}</p>}
      {estado.ok && <p className="aviso ok" role="status">{estado.ok}</p>}

      {linhas.length > 0 && (
        <p className="aviso info" style={{ marginTop: 10 }}>
          Estes itens <strong>ainda não estão no orçamento</strong>. Total do orçamento agora: {formatarCentavos(totalAtual)}; depois de incluir:{" "}
          <strong>{formatarCentavos(totalAtual + total)}</strong>
          {semPreco > 0 && <> (mais {semPreco} {semPreco === 1 ? "item" : "itens"} com preço pendente)</>}.
        </p>
      )}
      {linhas.length > 0 && (
        <div className="linha" style={{ alignItems: "center", marginTop: 10 }}>
          <button type="button" className="botao" onClick={incluir} disabled={enviando}>
            {enviando ? "Incluindo…" : `Incluir ${marcadas.length} ${marcadas.length === 1 ? "item" : "itens"} · ${formatarCentavos(total)}`}
          </button>
          <button type="button" className="botao secundario" onClick={() => { setLinhas([]); setModeloAtual(null); setEstado({}); }}>Limpar</button>
          {semPreco > 0 && <span className="texto-alerta pequeno">{semPreco} com preço pendente: entram, mas o envio fica bloqueado até definir</span>}
        </div>
      )}
    </details>
  );
}
