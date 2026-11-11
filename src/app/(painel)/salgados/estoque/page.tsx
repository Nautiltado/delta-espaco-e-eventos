import type { Metadata } from "next";
import Link from "next/link";
import { exigirAlguma } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarCentavos } from "@/lib/dinheiro";
import { formatarDataHora } from "@/lib/datas";
import { disponivel, precisaRepor } from "@/lib/salgados";
import { cardapioEEstoque } from "@/lib/salgados-dados";
import { FormularioAjuste, FormularioMinimo, FormularioPreco } from "../componentes";

export const metadata: Metadata = { title: "Estoque e preços" };

const TIPOS: Record<string, string> = { producao: "Produção", pedido: "Retirada", ajuste: "Contagem", perda: "Perda", evento: "Evento" };

export default async function PaginaEstoque() {
  const acesso = await exigirAlguma(["estoque.movimentar", "catalogo.alterar"]);
  const supabase = await criarClienteServidor();
  const [{ produtos, estoque }, { data: movs }] = await Promise.all([
    cardapioEEstoque(supabase, { incluirInativos: true }),
    supabase.from("estoque_movimentos").select("id, estoque_item_id, tipo, quantidade, observacao, criado_em, pedidos(numero, id), usuarios(nome)")
      .order("criado_em", { ascending: false }).limit(40),
  ]);
  const nomes = new Map(estoque.map((e) => [e.id, e.nome]));
  const movimentos = (movs ?? []) as unknown as {
    id: number; estoque_item_id: string; tipo: string; quantidade: number; observacao: string | null; criado_em: string;
    pedidos: { numero: string; id: string } | null; usuarios: { nome: string } | null;
  }[];
  const podeEstoque = pode(acesso, "estoque.movimentar");

  return (
    <>
      <div className="cabecalho">
        <div>
          <p style={{ margin: 0 }}><Link href="/salgados">← Encomendas</Link></p>
          <h1>Estoque e preços</h1>
          <p>Disponível = guardado menos o que já foi vendido e ainda não saiu. Abaixo do mínimo, a cozinha vê o aviso de repor.</p>
        </div>
      </div>

      {podeEstoque && (
        <section className="cartao">
          <h2>Salgados guardados</h2>
                      <table className="empilhar">
              <thead><tr><th>Salgado</th><th>Guardado</th><th>Vendido</th><th>Disponível</th><th>Mínimo</th><th>Perda, evento ou contagem</th></tr></thead>
              <tbody>
                {estoque.map((e) => (
                  <tr key={e.id}>
                    <td>{e.nome}<div className="mudo" style={{ fontSize: ".8rem" }}>{e.grupo === "forno" ? "forno" : "fritura"}</div></td>
                    <td data-rotulo="Guardado">{e.saldo}</td>
                    <td data-rotulo="Vendido">{e.reservado}</td>
                    <td data-rotulo="Disponível"><strong className={precisaRepor(e) ? "atrasada" : undefined}>{disponivel(e)}</strong></td>
                    <td><FormularioMinimo id={e.id} minimo={e.minimo} /></td>
                    <td>
                      <details><summary>Registrar</summary><FormularioAjuste item={{ id: e.id, nome: e.nome }} /></details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </section>
      )}

      {pode(acesso, "catalogo.alterar") && (
        <section className="cartao">
          <h2>Cardápio de encomendas</h2>
          <p className="mudo" style={{ marginTop: 0 }}>Preço vale para pedidos novos. Pedidos já feitos guardam o preço da hora.</p>
                      <table className="empilhar">
              <thead><tr><th>Produto</th><th>Atual</th><th>Alterar</th></tr></thead>
              <tbody>
                {produtos.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nome}<div className="mudo" style={{ fontSize: ".8rem" }}>{p.grupo}{p.unidades > 1 ? ` · ${p.unidades} un.` : ""}</div></td>
                    <td data-rotulo="Preço">{p.ativo ? formatarCentavos(p.preco_centavos) : <span className="mudo">fora</span>}</td>
                    <td><FormularioPreco id={p.id} preco={p.preco_centavos} ativo={p.ativo} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
        </section>
      )}

      {podeEstoque && (
        <section className="cartao">
          <h2>Últimas movimentações</h2>
          {movimentos.length ? (
            <ul className="pedidos-lista">
              {movimentos.map((m) => (
                <li key={m.id}>
                  <div>
                    <strong>{m.quantidade > 0 ? "+" : ""}{m.quantidade}</strong> {nomes.get(m.estoque_item_id)?.toLowerCase()} · {TIPOS[m.tipo] ?? m.tipo}
                    {m.pedidos && <> · <Link href={`/salgados/${m.pedidos.id}`}>{m.pedidos.numero}</Link></>}
                    {m.observacao && <div className="mudo" style={{ fontSize: ".85rem" }}>{m.observacao}</div>}
                  </div>
                  <div className="mudo" style={{ textAlign: "right", fontSize: ".85rem" }}>
                    {formatarDataHora(m.criado_em)}{m.usuarios && <div>{m.usuarios.nome}</div>}
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="mudo">Nada registrado ainda.</p>}
        </section>
      )}
    </>
  );
}
