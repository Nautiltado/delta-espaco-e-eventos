"use client";

import { Retorno as RetornoOk } from "@/componentes/avisos";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarModelo, type Estado } from "../actions";
import { centavosParaCampo, lerReais } from "@/lib/dinheiro";
import { rotuloUnidade } from "@/lib/orcamentos";
import { buscarNoCatalogo, calcularQuantidade, type ItemModelo, type OpcaoRapida, type Regra } from "@/lib/orcamento-rapido";

type LinhaEditor = { catalogo_item_id: string; regra: Regra; fator: string; minimo: string; opcional: boolean; preco: string };

const num = (t: string) => {
  const n = Number(t.trim().replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};
const txt = (n: number) => String(n).replace(".", ",");

export function EditorModelo({
  modelo, opcoes,
}: {
  modelo: { id: string; nome: string; descricao: string | null; ativo: boolean; itens: ItemModelo[] } | null;
  opcoes: OpcaoRapida[];
}) {
  const router = useRouter();
  const catalogo = useMemo(() => new Map(opcoes.map((o) => [o.id, o])), [opcoes]);
  const [nome, setNome] = useState(modelo?.nome ?? "");
  const [descricao, setDescricao] = useState(modelo?.descricao ?? "");
  const [ativo, setAtivo] = useState(modelo?.ativo ?? true);
  const [linhas, setLinhas] = useState<LinhaEditor[]>(
    [...(modelo?.itens ?? [])].sort((a, b) => a.ordem - b.ordem).map((i) => ({
      catalogo_item_id: i.catalogo_item_id, regra: i.regra, fator: txt(i.fator), minimo: txt(i.minimo), opcional: i.opcional,
      preco: i.preco_centavos == null ? "" : centavosParaCampo(i.preco_centavos),
    })),
  );
  const [busca, setBusca] = useState("");
  const [exemplo, setExemplo] = useState("50");
  const [estado, setEstado] = useState<Estado>({});
  const [salvando, iniciar] = useTransition();
  const resultados = useMemo(() => buscarNoCatalogo(opcoes.filter((o) => !linhas.some((l) => l.catalogo_item_id === o.id)), busca, 10), [opcoes, busca, linhas]);

  function acrescentar(o: OpcaoRapida) {
    const regra: Regra = o.recurso_id || o.unidade === "evento" ? "fixa" : "por_pessoa";
    const fator = o.unidade === "cento" ? "0,03" : "1";
    setLinhas((l) => [...l, { catalogo_item_id: o.id, regra, fator, minimo: o.unidade === "cento" ? "0,5" : "0", opcional: false, preco: "" }]);
    setBusca("");
  }
  const mudar = (i: number, c: Partial<LinhaEditor>) => setLinhas((l) => l.map((x, n) => (n === i ? { ...x, ...c } : x)));
  const mover = (i: number, d: number) => setLinhas((l) => {
    const j = i + d;
    if (j < 0 || j >= l.length) return l;
    const c = [...l];
    [c[i], c[j]] = [c[j], c[i]];
    return c;
  });

  function salvar() {
    const itens = linhas.map((l) => ({
      catalogo_item_id: l.catalogo_item_id, regra: l.regra, fator: num(l.fator), minimo: l.minimo.trim() ? num(l.minimo) : 0,
      opcional: l.opcional, preco_centavos: l.preco.trim() ? lerReais(l.preco) : null,
    }));
    if (itens.some((i) => !(i.fator > 0) || !(i.minimo >= 0))) return setEstado({ erro: "Confira as quantidades (use números, ex.: 0,03 ou 30)." });
    if (linhas.some((l) => l.preco.trim() && lerReais(l.preco) === null)) return setEstado({ erro: "Confira os preços (ex.: 85,00)." });
    iniciar(async () => {
      const r = await salvarModelo({ id: modelo?.id ?? null, nome, descricao, ativo, itens });
      setEstado(r);
      if (r.ok && r.id && !modelo) router.replace(`/orcamentos/modelos/${r.id}?salvo=1`);
      else if (r.ok) router.refresh();
    });
  }

  const convidadosExemplo = Number(exemplo) || null;

  return (
    <div>
      <RetornoOk estado={estado} />
      <div className="linha" style={{ marginBottom: 12 }}>
        <div className="campo" style={{ flex: 1 }}>
          <label htmlFor="m-nome">Nome do modelo</label>
          <input id="m-nome" type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Jantar, Coffee break, Café da manhã" />
        </div>
        <div className="campo" style={{ flex: 2 }}>
          <label htmlFor="m-desc">Descrição (opcional)</label>
          <input id="m-desc" type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>
      </div>
      <label style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 14 }}>
        <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Aparece para escolher nos orçamentos
      </label>

      <div className="busca-rapida" style={{ marginBottom: 12 }}>
        <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Acrescentar item do catálogo: digite e Enter"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (resultados[0]) acrescentar(resultados[0]); } }} aria-label="Acrescentar item do catálogo" />
        {busca && (
          <ul className="resultados">
            {resultados.map((o) => (
              <li key={o.id}><button type="button" onClick={() => acrescentar(o)}><span>{o.nome}</span><span className="mudo">{o.grupo}</span></button></li>
            ))}
            {resultados.length === 0 && <li className="mudo" style={{ padding: "8px 10px" }}>Nada encontrado (ou já está no modelo).</li>}
          </ul>
        )}
      </div>

      <p className="mudo" style={{ fontSize: ".85rem" }}>
        Simular com{" "}
        <input type="text" inputMode="numeric" value={exemplo} onChange={(e) => setExemplo(e.target.value)} style={{ width: 60, padding: "2px 6px" }} aria-label="Convidados para simular" />{" "}
        convidados. “Por convidado” em centos: 0,03 = 3 unidades por pessoa. “1 a cada”: ex. 30 = 1 garçom a cada 30 convidados.
      </p>

      <div className="tabela-rapida">
        <table>
          <thead>
            <tr><th>Item</th><th>Regra</th><th style={{ width: 90 }}>Quanto</th><th style={{ width: 80 }}>Mínimo</th><th>Opcional</th><th style={{ width: 110 }}>Preço (opcional)</th><th>Simulação</th><th /></tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => {
              const o = catalogo.get(l.catalogo_item_id);
              const f = num(l.fator), m = l.minimo.trim() ? num(l.minimo) : 0;
              const sim = o && f > 0 && m >= 0 ? calcularQuantidade(l.regra, f, m, convidadosExemplo, o.unidade) : null;
              return (
                <tr key={l.catalogo_item_id}>
                  <td>{o?.nome ?? "(item inativo)"}<div className="mudo" style={{ fontSize: ".72rem" }}>por {o ? rotuloUnidade(o.unidade, 1) : "—"}</div></td>
                  <td>
                    <select value={l.regra} onChange={(e) => mudar(i, { regra: e.target.value as Regra })} aria-label={`Regra de ${o?.nome}`}>
                      <option value="fixa">Quantidade fixa</option>
                      <option value="por_pessoa">Por convidado</option>
                      <option value="a_cada">1 a cada N convidados</option>
                    </select>
                  </td>
                  <td><input type="text" inputMode="decimal" value={l.fator} onChange={(e) => mudar(i, { fator: e.target.value })} aria-label={`Quanto de ${o?.nome}`} /></td>
                  <td><input type="text" inputMode="decimal" value={l.minimo} onChange={(e) => mudar(i, { minimo: e.target.value })} aria-label={`Mínimo de ${o?.nome}`} /></td>
                  <td style={{ textAlign: "center" }}><input type="checkbox" checked={l.opcional} onChange={(e) => mudar(i, { opcional: e.target.checked })} aria-label={`${o?.nome} é opcional`} /></td>
                  <td><input type="text" inputMode="decimal" value={l.preco} placeholder="—" onChange={(e) => mudar(i, { preco: e.target.value })} aria-label={`Preço de ${o?.nome}`} /></td>
                  <td className="mudo" style={{ whiteSpace: "nowrap" }}>{sim != null && o ? `${String(sim).replace(".", ",")} ${rotuloUnidade(o.unidade, sim)}` : "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button type="button" className="botao secundario pequeno" onClick={() => mover(i, -1)} aria-label="Subir">↑</button>{" "}
                    <button type="button" className="botao secundario pequeno" onClick={() => mover(i, 1)} aria-label="Descer">↓</button>{" "}
                    <button type="button" className="botao secundario pequeno" onClick={() => setLinhas((x) => x.filter((_, n) => n !== i))} aria-label={`Tirar ${o?.nome}`}>✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mudo" style={{ fontSize: ".82rem" }}>
        Opcional: vem desmarcado no orçamento (ex.: segurança). Locação de espaço: o sistema marca só o espaço que comporta os convidados.
        Preço em branco: usa o último preço praticado ou o do catálogo.
      </p>
      <div className="linha">
        <button type="button" className="botao" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar modelo"}</button>
        <Link className="botao secundario" href="/orcamentos/modelos">Voltar</Link>
      </div>
    </div>
  );
}
