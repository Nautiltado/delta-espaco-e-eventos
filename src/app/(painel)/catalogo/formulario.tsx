"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { salvarItem, type EstadoItem } from "./actions";
import { CATEGORIAS } from "@/lib/orcamentos";
import { UNIDADES_PADRAO } from "@/lib/unidades";

export type ItemFormulario = {
  id?: string;
  nome: string;
  categoria: string;
  unidade: string;
  descricao: string | null;
  preco_tipo: "fixo" | "faixa" | "a_combinar";
  subgrupo?: string | null;
  preco: string;
  preco_min: string;
  preco_max: string;
  ordem: number;
  ativo: boolean;
  custo?: string;
};

export function FormularioItem({ item, mostrarCusto, unidades = UNIDADES_PADRAO }: {
  item?: ItemFormulario; mostrarCusto: boolean; unidades?: { codigo: string; singular: string; ativo: boolean }[];
}) {
  const [estado, acao, salvando] = useActionState<EstadoItem, FormData>(salvarItem, {});
  const [tipo, setTipo] = useState(item?.preco_tipo ?? "fixo");
  return (
    <form action={acao}>
      {item?.id && <input type="hidden" name="id" value={item.id} />}
      {estado.erro && <p className="aviso erro" role="alert">{estado.erro}</p>}
      <div className="linha" style={{ marginBottom: 14 }}>
        <div className="campo" style={{ flex: 2 }}>
          <label htmlFor="nome">Nome</label>
          <input id="nome" name="nome" type="text" required defaultValue={item?.nome} />
        </div>
        <div className="campo">
          <label htmlFor="categoria">Categoria</label>
          <select id="categoria" name="categoria" defaultValue={item?.categoria ?? "alimentacao"}>
            {Object.entries(CATEGORIAS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="subgrupo">Subgrupo (opcional)</label>
          <input id="subgrupo" name="subgrupo" type="text" placeholder="Ex.: Carnes e aves" defaultValue={item?.subgrupo ?? ""} />
        </div>
        <div className="campo">
          <label htmlFor="unidade">Cobrado por <Link href="/catalogo/unidades" className="pequeno">(unidades)</Link></label>
          <select id="unidade" name="unidade" defaultValue={item?.unidade ?? "evento"}>
            {unidades.filter((u) => u.ativo || u.codigo === item?.unidade).map((u) => <option key={u.codigo} value={u.codigo}>{u.singular}</option>)}
          </select>
        </div>
      </div>
      <div className="campo">
        <label htmlFor="descricao">Descrição (aparece no orçamento)</label>
        <input id="descricao" name="descricao" type="text" defaultValue={item?.descricao ?? ""} />
      </div>
      <div className="campo">
        <label>Preço</label>
        <div className="opcoes">
          <label><input type="radio" name="preco_tipo" value="fixo" checked={tipo === "fixo"} onChange={() => setTipo("fixo")} /> Preço fixo</label>
          <label><input type="radio" name="preco_tipo" value="faixa" checked={tipo === "faixa"} onChange={() => setTipo("faixa")} /> Faixa (negociado caso a caso)</label>
          <label><input type="radio" name="preco_tipo" value="a_combinar" checked={tipo === "a_combinar"} onChange={() => setTipo("a_combinar")} /> A combinar (preço digitado em cada orçamento)</label>
        </div>
      </div>
      <div className="linha" style={{ marginBottom: 14 }}>
        {tipo === "a_combinar" ? null : tipo === "fixo" ? (
          <div className="campo">
            <label htmlFor="preco">Preço (R$)</label>
            <input id="preco" name="preco" type="text" inputMode="decimal" defaultValue={item?.preco} />
          </div>
        ) : (
          <>
            <div className="campo">
              <label htmlFor="preco_min">Mínimo (R$)</label>
              <input id="preco_min" name="preco_min" type="text" inputMode="decimal" defaultValue={item?.preco_min} />
            </div>
            <div className="campo">
              <label htmlFor="preco_max">Máximo (R$)</label>
              <input id="preco_max" name="preco_max" type="text" inputMode="decimal" defaultValue={item?.preco_max} />
            </div>
          </>
        )}
        {mostrarCusto && (
          <div className="campo">
            <label htmlFor="custo">Custo interno (R$) <span className="selo dourado">restrito</span></label>
            <input id="custo" name="custo" type="text" inputMode="decimal" defaultValue={item?.custo} placeholder="Deixe vazio se não souber" />
          </div>
        )}
        <div className="campo" style={{ maxWidth: 110 }}>
          <label htmlFor="ordem">Ordem</label>
          <input id="ordem" name="ordem" type="text" inputMode="numeric" defaultValue={item?.ordem ?? 0} />
        </div>
      </div>
      <label style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 500, marginBottom: 14 }}>
        <input type="checkbox" name="ativo" value="1" defaultChecked={item?.ativo ?? true} /> Disponível para novos orçamentos
      </label>
      <p className="mudo">Mudanças de preço ficam no histórico. Orçamentos já enviados não mudam.</p>
      <div className="linha">
        <button className="botao" disabled={salvando}>{salvando ? "Salvando…" : "Salvar item"}</button>
        <Link className="botao secundario" href="/catalogo">Voltar</Link>
      </div>
    </form>
  );
}
