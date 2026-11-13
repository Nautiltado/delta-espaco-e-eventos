import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirPermissao } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { centavosParaCampo, formatarCentavos } from "@/lib/dinheiro";
import { formatarDataHora } from "@/lib/datas";
import { precoDoItem, type ItemCatalogo } from "@/lib/catalogo";
import { CATEGORIAS } from "@/lib/orcamentos";
import { carregarUnidades } from "@/lib/orcamento-dados";
import { mapaDeUnidades, rotuloDaUnidade } from "@/lib/unidades";
import { FormularioItem } from "../formulario";

export const metadata: Metadata = { title: "Item do catálogo" };

type Historico = {
  id: number;
  preco_tipo: "fixo" | "faixa" | "a_combinar";
  preco_centavos: number | null;
  preco_min_centavos: number | null;
  preco_max_centavos: number | null;
  vigente_desde: string;
};

export default async function ItemDoCatalogo({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ salvo?: string }>;
}) {
  const acesso = await exigirPermissao("orcamento.ver");
  const { id } = await params;
  const { salvo } = await searchParams;
  const verCusto = pode(acesso, "custo.ver");
  const supabase = await criarClienteServidor();
  const [{ data: item }, { data: historico }, custo, unidades] = await Promise.all([
    supabase.from("catalogo_itens").select("*").eq("id", id).maybeSingle(),
    supabase.from("catalogo_precos").select("*").eq("item_id", id).order("vigente_desde", { ascending: false }).limit(30),
    verCusto
      ? supabase.from("catalogo_custos").select("custo_centavos").eq("item_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
    carregarUnidades(supabase),
  ]);
  if (!item) notFound();
  const i = item as ItemCatalogo;
  const custoCentavos = (custo.data as { custo_centavos: number } | null)?.custo_centavos;

  return (
    <>
      <div className="cabecalho">
        <div>
          <p style={{ margin: 0 }}><Link href="/catalogo">← Catálogo</Link></p>
          <h1>{i.nome}</h1>
          <p>{CATEGORIAS[i.categoria]}{i.subgrupo ? ` · ${i.subgrupo}` : ""} · por {rotuloDaUnidade(i.unidade, 1, mapaDeUnidades(unidades))} · {precoDoItem(i)}</p>
        </div>
      </div>
      {salvo && <p className="aviso ok">Item salvo.</p>}

      {pode(acesso, "catalogo.alterar") ? (
        <section className="cartao">
          <h2>Editar</h2>
          <FormularioItem
            mostrarCusto={verCusto}
            unidades={unidades}
            item={{
              id: i.id,
              nome: i.nome,
              categoria: i.categoria,
              unidade: i.unidade,
              descricao: i.descricao,
              preco_tipo: i.preco_tipo,
              subgrupo: i.subgrupo ?? null,
              preco: i.preco_centavos !== null ? centavosParaCampo(i.preco_centavos) : "",
              preco_min: i.preco_min_centavos !== null ? centavosParaCampo(i.preco_min_centavos) : "",
              preco_max: i.preco_max_centavos !== null ? centavosParaCampo(i.preco_max_centavos) : "",
              ordem: i.ordem,
              ativo: i.ativo,
              custo: custoCentavos !== undefined ? centavosParaCampo(custoCentavos) : "",
            }}
          />
        </section>
      ) : (
        verCusto && custoCentavos !== undefined && (
          <section className="cartao"><p style={{ margin: 0 }}>Custo interno: {formatarCentavos(custoCentavos)}</p></section>
        )
      )}

      <section className="cartao">
        <h2>Histórico de preço</h2>
        <table>
          <thead><tr><th>Desde</th><th>Preço</th></tr></thead>
          <tbody>
            {((historico ?? []) as Historico[]).map((h, n) => (
              <tr key={h.id}>
                <td>{formatarDataHora(h.vigente_desde)} {n === 0 && <span className="selo">atual</span>}</td>
                <td>{precoDoItem(h)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
