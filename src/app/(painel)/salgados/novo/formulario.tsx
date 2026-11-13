"use client";

import { useMemo, useState, useTransition } from "react";
import { criarPedido, type Estado } from "../actions";
import { formatarCentavos } from "@/lib/dinheiro";
import { CANAIS, composicaoDoProduto, disponivel, type Produto, type SaldoEstoque } from "@/lib/salgados";
import { somarDias } from "@/lib/reservas";

type Linha = { quantidade: number; sabores: string[] };

/** Pedido de encomenda em uma tela: cliente, retirada e o cardápio com + e −. */
export function FormularioPedido({ produtos, estoque, hoje, horaSugerida }: {
  produtos: Produto[]; estoque: SaldoEstoque[]; hoje: string; horaSugerida: string;
}) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [canal, setCanal] = useState("whatsapp");
  const [data, setData] = useState(hoje);
  const [hora, setHora] = useState(horaSugerida);
  const [observacao, setObservacao] = useState("");
  const [linhas, setLinhas] = useState<Record<string, Linha>>({});
  const [estado, setEstado] = useState<Estado>({});
  const [enviando, iniciar] = useTransition();

  const porId = useMemo(() => new Map(estoque.map((e) => [e.id, e])), [estoque]);
  const grupos = useMemo(() => [...new Set(produtos.map((p) => p.grupo))], [produtos]);
  const escolhidos = produtos.filter((p) => (linhas[p.id]?.quantidade ?? 0) > 0);
  const total = escolhidos.reduce((s, p) => s + p.preco_centavos * linhas[p.id].quantidade, 0);

  // Quanto de cada salgado o pedido tira do estoque (para avisar quando falta)
  const consumo = new Map<string, number>();
  for (const p of escolhidos) {
    const q = linhas[p.id].quantidade;
    const partes = composicaoDoProduto(p, linhas[p.id].sabores);
    for (const c of partes) consumo.set(c.estoque_item_id, (consumo.get(c.estoque_item_id) ?? 0) + c.unidades * q);
  }
  const faltas = [...consumo.entries()]
    .map(([id, u]) => ({ s: porId.get(id), u }))
    .filter((x) => x.s && x.u > disponivel(x.s));
  const sortidoSemSabor = escolhidos.filter((p) => p.sortido && !linhas[p.id].sabores.length);
  const blocosDe = (p: Produto) => (p.bloco_unidades ? p.unidades / p.bloco_unidades : 0);
  const mistoIncompleto = escolhidos.filter((p) => p.bloco_unidades && linhas[p.id].sabores.length !== blocosDe(p));
  const soEncomendaHoje = data === hoje && escolhidos.some((p) => p.so_encomenda);

  function mudar(id: string, delta: number) {
    setLinhas((l) => {
      const atual = l[id] ?? { quantidade: 0, sabores: [] };
      const q = Math.max(0, Math.min(1000, atual.quantidade + delta));
      return { ...l, [id]: { ...atual, quantidade: q } };
    });
  }
  function alternarSabor(id: string, sabor: string) {
    setLinhas((l) => {
      const atual = l[id] ?? { quantidade: 1, sabores: [] };
      const sabores = atual.sabores.includes(sabor) ? atual.sabores.filter((s) => s !== sabor) : [...atual.sabores, sabor];
      return { ...l, [id]: { ...atual, sabores } };
    });
  }

  /** Misto: põe ou tira um bloco de 25 de um sabor (no máximo os 4 blocos do cento). */
  function mudarBloco(p: Produto, sabor: string, delta: number) {
    setEstado({});
    setLinhas((l) => {
      const atual = l[p.id] ?? { quantidade: 1, sabores: [] };
      let sabores = atual.sabores;
      if (delta > 0 && sabores.length < blocosDe(p)) sabores = [...sabores, sabor];
      if (delta < 0) {
        const i = sabores.lastIndexOf(sabor);
        if (i >= 0) sabores = sabores.filter((_, n) => n !== i);
      }
      return { ...l, [p.id]: { ...atual, sabores } };
    });
  }

  function registrar() {
    if (!escolhidos.length) return setEstado({ erro: "Inclua ao menos um item." });
    if (sortidoSemSabor.length) return setEstado({ erro: `Escolha os sabores do ${sortidoSemSabor[0].nome.toLowerCase()}.` });
    if (mistoIncompleto.length) {
      const p = mistoIncompleto[0];
      const faltam = blocosDe(p) - linhas[p.id].sabores.length;
      return setEstado({ erro: `Complete o ${p.nome.toLowerCase()}: faltam ${faltam * p.bloco_unidades!} unidades (${faltam} ${faltam === 1 ? "bloco" : "blocos"} de ${p.bloco_unidades}).` });
    }
    setEstado({});
    iniciar(async () => {
      const r = await criarPedido({
        nome, telefone, canal, data, hora, observacao,
        itens: escolhidos.map((p) => ({ produto_id: p.id, quantidade: linhas[p.id].quantidade, ...(p.sortido ? { sortido: linhas[p.id].sabores } : {}) })),
      });
      if (r?.erro) setEstado(r);
    });
  }

  return (
    <div className="pedido-form">
      <section className="cartao">
        <div className="linha" style={{ marginBottom: 12 }}>
          <div className="campo" style={{ flex: 2 }}>
            <label htmlFor="p-nome">Quem vai retirar</label>
            <input id="p-nome" type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" autoComplete="off" />
          </div>
          <div className="campo">
            <label htmlFor="p-tel">Telefone (opcional)</label>
            <input id="p-tel" type="tel" inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(99) 98111-2233" />
          </div>
        </div>
        <div className="campo">
          <span className="rotulo-campo">Chegou por</span>
          <div className="chips" role="radiogroup" aria-label="Chegou por">
            {Object.entries(CANAIS).map(([v, r]) => (
              <button key={v} type="button" role="radio" aria-checked={canal === v} className={canal === v ? "chip ativo" : "chip"} onClick={() => setCanal(v)}>{r}</button>
            ))}
          </div>
        </div>
        <div className="linha">
          <div className="campo">
            <label htmlFor="p-data">Retirada: dia</label>
            <input id="p-data" type="date" value={data} min={hoje} onChange={(e) => setData(e.target.value)} />
            <div className="chips" style={{ marginTop: 6 }}>
              <button type="button" className={data === hoje ? "chip ativo" : "chip"} onClick={() => setData(hoje)}>Hoje</button>
              <button type="button" className={data === somarDias(hoje, 1) ? "chip ativo" : "chip"} onClick={() => setData(somarDias(hoje, 1))}>Amanhã</button>
            </div>
          </div>
          <div className="campo">
            <label htmlFor="p-hora">Hora</label>
            <input id="p-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>
        </div>
      </section>

      {grupos.map((g) => (
        <section className="cartao" key={g}>
          <h2>{g}</h2>
          <ul className="cardapio">
            {produtos.filter((p) => p.grupo === g).map((p) => {
              const l = linhas[p.id];
              const q = l?.quantidade ?? 0;
              const s = p.estoque_item_id ? porId.get(p.estoque_item_id) : undefined;
              return (
                <li key={p.id} className={q ? "escolhido" : undefined}>
                  <div className="cardapio-linha">
                    <div style={{ minWidth: 0 }}>
                      <strong>{p.nome}</strong>
                      <div className="mudo" style={{ fontSize: ".82rem" }}>
                        {formatarCentavos(p.preco_centavos)}
                        {s && <> · {disponivel(s) > 0 ? `${disponivel(s)} un. prontas` : "sem estoque"}</>}
                        {p.so_encomenda && " · sob encomenda"}
                      </div>
                    </div>
                    <div className="contador">
                      <button type="button" onClick={() => mudar(p.id, -1)} disabled={!q} aria-label={`Menos ${p.nome}`}>−</button>
                      <span aria-live="polite" aria-label={`Quantidade de ${p.nome}`}>{q}</span>
                      <button type="button" onClick={() => mudar(p.id, 1)} aria-label={`Mais ${p.nome}`}>+</button>
                    </div>
                  </div>
                  {p.sortido && q > 0 && p.bloco_unidades && (() => {
                    const total = blocosDe(p);
                    const usados = l.sabores.length;
                    return (
                      <div className="misto" style={{ marginTop: 8 }}>
                        <span className="mudo" style={{ fontSize: ".8rem" }}>
                          Até {total} sabores, {p.bloco_unidades} unidades cada (pode repetir).{" "}
                          <strong className={usados === total ? "texto-sucesso" : "texto-alerta"}>
                            {usados * p.bloco_unidades} de {p.unidades}
                          </strong>
                          {q > 1 && <> · os {q} centos saem com esta mesma combinação</>}
                        </span>
                        <ul className="misto-sabores">
                          {estoque.filter((e) => e.ativo && e.grupo === p.sortido_grupo).map((e) => {
                            const n = l.sabores.filter((x) => x === e.id).length;
                            return (
                              <li key={e.id} className={n ? "escolhido" : undefined}>
                                <span>{e.nome}</span>
                                <div className="contador pequeno">
                                  <button type="button" onClick={() => mudarBloco(p, e.id, -1)} disabled={!n} aria-label={`Menos ${p.bloco_unidades} de ${e.nome}`}>−</button>
                                  <span aria-label={`Unidades de ${e.nome}`}>{n * p.bloco_unidades!}</span>
                                  <button type="button" onClick={() => mudarBloco(p, e.id, 1)} disabled={usados >= total} aria-label={`Mais ${p.bloco_unidades} de ${e.nome}`}>+</button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })()}
                  {p.sortido && q > 0 && !p.bloco_unidades && (
                    <div style={{ marginTop: 8 }}>
                      <span className="mudo" style={{ fontSize: ".8rem" }}>Sabores (a quantidade é dividida igualmente):</span>
                      <div className="chips" style={{ marginTop: 4 }}>
                        {estoque.filter((e) => e.ativo && e.grupo === p.sortido_grupo).map((e) => (
                          <button key={e.id} type="button" className={l.sabores.includes(e.id) ? "chip ativo" : "chip"} onClick={() => alternarSabor(p.id, e.id)}
                            aria-pressed={l.sabores.includes(e.id)}>
                            {e.nome}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section className="cartao">
        <div className="campo" style={{ marginBottom: 0 }}>
          <label htmlFor="p-obs">Observação (opcional)</label>
          <textarea id="p-obs" rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: bem sequinhos, embalar separado" maxLength={500} />
        </div>
      </section>

      <div className="rodape-pedido">
        {faltas.length > 0 && (
          <p className="aviso info" style={{ margin: "0 0 8px" }}>
            Pouco estoque de {faltas.map((f) => `${f.s!.nome.toLowerCase()} (precisa ${f.u}, tem ${Math.max(0, disponivel(f.s!))})`).join(", ")}. A cozinha vai ver no painel.
          </p>
        )}
        {soEncomendaHoje && <p className="aviso info" style={{ margin: "0 0 8px" }}>Tem item sob encomenda para hoje: confirme com a cozinha.</p>}
        {estado.erro && <p className="aviso erro" role="alert" style={{ margin: "0 0 8px" }}>{estado.erro}</p>}
        <button type="button" className="botao" onClick={registrar} disabled={enviando}>
          {enviando ? "Registrando…" : `Registrar pedido · ${formatarCentavos(total)}`}
        </button>
        <span className="mudo" style={{ fontSize: ".82rem" }}>Depois vem o Pix. Vai para a cozinha quando pago. Avise o cliente: depois de pronto, cancelar não devolve o dinheiro.</span>
      </div>
    </div>
  );
}
