import type { Metadata } from "next";
import Link from "next/link";
import { exigirPermissao } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarCentavos } from "@/lib/dinheiro";
import { CATEGORIAS, UNIDADES } from "@/lib/orcamentos";
import { precoDoItem, type ItemCatalogo } from "@/lib/catalogo";

export const metadata: Metadata = { title: "Catálogo" };

export default async function PaginaCatalogo() {
  const acesso = await exigirPermissao("orcamento.ver");
  const verCusto = pode(acesso, "custo.ver");
  const supabase = await criarClienteServidor();
  const [{ data: itens }, { data: custos }] = await Promise.all([
    supabase.from("catalogo_itens").select("*").order("categoria").order("ordem").order("nome"),
    verCusto ? supabase.from("catalogo_custos").select("item_id, custo_centavos") : Promise.resolve({ data: [] }),
  ]);
  const custoPorItem = new Map((custos ?? []).map((c) => [c.item_id as string, c.custo_centavos as number]));
  const lista = (itens ?? []) as ItemCatalogo[];
  const categorias = [...new Set(lista.map((i) => i.categoria))];

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Catálogo</h1>
          <p>Produtos e serviços com preço de referência. No orçamento, também dá para incluir item livre.</p>
        </div>
        {pode(acesso, "catalogo.alterar") && <Link className="botao" href="/catalogo/novo">Novo item</Link>}
      </div>

      {categorias.length === 0 && <p className="cartao mudo">Nenhum item no catálogo.</p>}
      {categorias.map((cat) => (
        <section className="cartao" key={cat}>
          <h2>{CATEGORIAS[cat] ?? cat}</h2>
          <table>
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
              {lista.filter((i) => i.categoria === cat).map((i) => {
                const custo = custoPorItem.get(i.id);
                const precoRef = i.preco_tipo === "fixo" ? i.preco_centavos : i.preco_min_centavos;
                return (
                  <tr key={i.id} style={i.ativo ? undefined : { opacity: 0.5 }}>
                    <td>
                      <Link href={`/catalogo/${i.id}`}><strong>{i.nome}</strong></Link>
                      {!i.ativo && <> <span className="selo cinza">Inativo</span></>}
                      {i.descricao && <div className="mudo">{i.descricao}</div>}
                    </td>
                    <td>{UNIDADES[i.unidade] ?? i.unidade}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{precoDoItem(i)}</td>
                    {verCusto && <td>{custo !== undefined ? formatarCentavos(custo) : <span className="mudo">—</span>}</td>}
                    {verCusto && (
                      <td className="mudo">
                        {custo !== undefined && precoRef
                          ? `${Math.round(((precoRef - custo) * 100) / precoRef)}%${i.preco_tipo === "faixa" ? " no mínimo" : ""}`
                          : "—"}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </>
  );
}
