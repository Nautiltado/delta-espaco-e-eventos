import type { Metadata } from "next";
import { exigirPermissao } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { carregarUnidades } from "@/lib/orcamento-dados";
import { mapaDeUnidades, rotuloDaUnidade } from "@/lib/unidades";
import { FormularioUnidade } from "./formulario";

export const metadata: Metadata = { title: "Unidades de cobrança" };

export default async function PaginaUnidades() {
  const acesso = await exigirPermissao("orcamento.ver");
  const podeEditar = pode(acesso, "catalogo.alterar");
  const supabase = await criarClienteServidor();
  const [unidades, { data: usos }] = await Promise.all([
    carregarUnidades(supabase),
    supabase.from("catalogo_itens").select("unidade"),
  ]);
  const mapa = mapaDeUnidades(unidades);
  const emUso = new Map<string, number>();
  for (const u of usos ?? []) emUso.set(u.unidade as string, (emUso.get(u.unidade as string) ?? 0) + 1);
  const opcoes = unidades.map((u) => ({ codigo: u.codigo, singular: u.singular }));

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Unidades de cobrança</h1>
          <p>Como cada item é cobrado no orçamento. A equivalência aparece no orçamento e na proposta: 2 centos = 200 unidades.</p>
        </div>
      </div>
      <section className="cartao sem-respiro">
        <div className="tabela-rolavel">
          <table>
            <thead><tr><th>Unidade</th><th>Plural</th><th>Equivalência</th><th className="numero">Passo</th><th className="numero">Itens no catálogo</th><th>Situação</th>{podeEditar && <th />}</tr></thead>
            <tbody>
              {unidades.map((u) => (
                <tr key={u.codigo} className={u.ativo ? undefined : "linha-inativa"}>
                  <td><strong>{u.singular}</strong> <span className="mudo pequeno">{u.codigo}</span></td>
                  <td>{u.plural}</td>
                  <td>{u.equivale_quantidade && u.equivale_unidade
                    ? `1 ${u.singular} = ${String(u.equivale_quantidade).replace(".", ",")} ${rotuloDaUnidade(u.equivale_unidade, u.equivale_quantidade, mapa)}`
                    : <span className="mudo">—</span>}</td>
                  <td className="numero">{String(u.passo).replace(".", ",")}</td>
                  <td className="numero">{emUso.get(u.codigo) ?? 0}</td>
                  <td>{u.ativo ? <span className="selo">ativa</span> : <span className="selo cinza">inativa</span>}</td>
                  {podeEditar && (
                    <td><FormularioUnidade unidade={u} opcoes={opcoes} /></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {podeEditar && (
        <section className="cartao">
          <h2>Nova unidade</h2>
          <FormularioUnidade opcoes={opcoes} />
        </section>
      )}
      <p className="mudo pequeno">O passo é o arredondamento das quantidades calculadas pelos modelos (ex.: cento de 0,5 em 0,5). Unidade inativa some das listas, mas continua valendo nos itens que já a usam.</p>
    </>
  );
}
