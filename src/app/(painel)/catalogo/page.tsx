import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { exigirPermissao } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarCentavos } from "@/lib/dinheiro";
import { CATEGORIAS, ordemCategoria, UNIDADES } from "@/lib/orcamentos";
import { ordenarCatalogo, precoDoItem, type ItemCatalogo } from "@/lib/catalogo";

export const metadata: Metadata = { title: "Catálogo" };

export default async function PaginaCatalogo({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const acesso = await exigirPermissao("orcamento.ver");
  const { q } = await searchParams;
  const termo = (q ?? "").trim();
  const normalizar = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const verCusto = pode(acesso, "custo.ver");
  const supabase = await criarClienteServidor();
  const [{ data: itens }, { data: custos }] = await Promise.all([
    supabase.from("catalogo_itens").select("*").order("categoria").order("ordem").order("nome"),
    verCusto ? supabase.from("catalogo_custos").select("item_id, custo_centavos") : Promise.resolve({ data: [] }),
  ]);
  const custoPorItem = new Map((custos ?? []).map((c) => [c.item_id as string, c.custo_centavos as number]));
  const todos = ordenarCatalogo((itens ?? []) as ItemCatalogo[], ordemCategoria);
  const lista = termo ? todos.filter((i) => normalizar(`${i.nome} ${i.descricao ?? ""} ${i.subgrupo ?? ""}`).includes(normalizar(termo))) : todos;
  const categorias = [...new Set(lista.map((i) => i.categoria))];

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Catálogo</h1>
          <p>Cardápio, materiais e serviços. Itens “a combinar” têm o preço digitado em cada orçamento. No orçamento, também dá para incluir item livre.</p>
        </div>
        {pode(acesso, "catalogo.alterar") && <Link className="botao" href="/catalogo/novo">Novo item</Link>}
      </div>

      <section className="cartao">
        <form className="linha" style={{ alignItems: "flex-end" }}>
          <div className="campo" style={{ flex: 1, marginBottom: 0 }}>
            <label htmlFor="q">Procurar no catálogo</label>
            <input id="q" name="q" type="search" defaultValue={termo} placeholder="Ex.: coxinha, filé, suco" />
          </div>
          <button className="botao secundario">Procurar</button>
          {termo && <Link href="/catalogo">Limpar</Link>}
        </form>
        {!termo && (
          <p className="opcoes" style={{ margin: "12px 0 0", fontSize: ".88rem" }}>
            {categorias.map((c) => <a key={c} href={`#cat-${c}`}>{CATEGORIAS[c] ?? c}</a>)}
          </p>
        )}
      </section>

      {categorias.length === 0 && <p className="cartao mudo">{termo ? "Nada encontrado." : "Nenhum item no catálogo."}</p>}
      {categorias.map((cat) => (
        <section className="cartao" key={cat} id={`cat-${cat}`}>
          <h2>{CATEGORIAS[cat] ?? cat} <span className="mudo" style={{ fontFamily: "var(--sans)", fontSize: ".85rem" }}>{lista.filter((i) => i.categoria === cat).length}</span></h2>
          <table className="empilhar">
            <thead>
              <tr>
                <th>Item</th>
                <th>Cobrado por</th>
                <th>Preço</th>
                {verCusto && <th>Custo <span className="selo dourado">restrito</span></th>}
                {verCusto && <th>Margem</th>}
              </tr>
            </thead>
            <tbody>
              {lista.filter((i) => i.categoria === cat).map((i, n, doGrupo) => {
                const custo = custoPorItem.get(i.id);
                const novoSubgrupo = i.subgrupo && i.subgrupo !== doGrupo[n - 1]?.subgrupo;
                const precoRef = i.preco_tipo === "fixo" ? i.preco_centavos : i.preco_min_centavos;
                return (
                  <Fragment key={i.id}>
                  {novoSubgrupo && (
                    <tr><td colSpan={verCusto ? 5 : 3} style={{ fontWeight: 600, color: "var(--esmeralda)", paddingTop: 14 }}>{i.subgrupo}</td></tr>
                  )}
                  <tr style={i.ativo ? undefined : { opacity: 0.5 }}>
                    <td>
                      <Link href={`/catalogo/${i.id}`}><strong>{i.nome}</strong></Link>
                      {!i.ativo && <> <span className="selo cinza">Inativo</span></>}
                      {i.descricao && <div className="mudo">{i.descricao}</div>}
                    </td>
                    <td data-rotulo="Por">{UNIDADES[i.unidade] ?? i.unidade}</td>
                    <td data-rotulo="Preço" style={{ whiteSpace: "nowrap" }}>{precoDoItem(i)}</td>
                    {verCusto && <td data-rotulo="Custo">{custo !== undefined ? formatarCentavos(custo) : <span className="mudo">—</span>}</td>}
                    {verCusto && (
                      <td className="mudo">
                        {custo !== undefined && precoRef
                          ? `${Math.round(((precoRef - custo) * 100) / precoRef)}%${i.preco_tipo === "faixa" ? " no mínimo" : ""}`
                          : "—"}
                      </td>
                    )}
                  </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </>
  );
}
