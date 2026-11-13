import type { Metadata } from "next";
import Link from "next/link";
import { exigirAlguma } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarCentavos } from "@/lib/dinheiro";
import { formatarDataHora } from "@/lib/datas";
import { disponivel, precisaRepor } from "@/lib/salgados";
import { cardapioEEstoque } from "@/lib/salgados-dados";
import { ClipboardMinus, Gauge, Pencil } from "lucide-react";
import { BotaoJanela } from "@/componentes/janela";
import { TituloCartao } from "@/componentes/ui";
import { FormularioAjuste, FormularioMinimo, FormularioPreco } from "../componentes";

export const metadata: Metadata = { title: "Estoque e preços" };

const TIPOS: Record<string, string> = { producao: "Produção", pedido: "Retirada", ajuste: "Contagem", perda: "Perda", evento: "Evento" };

export default async function PaginaEstoque() {
  const acesso = await exigirAlguma(["estoque.movimentar", "catalogo.alterar", "estoque.ver"]);
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

      <div className="estoque-colunas">
      {podeEstoque && (
        <section className="cartao sem-respiro">
          <TituloCartao titulo="Salgados guardados" conta={estoque.length} />
          <div className="lista-rolavel">
            <table className="empilhar">
              <thead><tr><th>Salgado</th><th className="numero">Guardado</th><th className="numero">Vendido</th><th className="numero">Disponível</th><th className="numero">Mínimo</th><th><span className="sr-only">Ações</span></th></tr></thead>
              <tbody>
                {estoque.map((e) => (
                  <tr key={e.id} data-item={e.nome}>
                    <td>{e.nome}<div className="mudo" style={{ fontSize: ".8rem" }}>{e.grupo === "forno" ? "forno" : "fritura"}</div></td>
                    <td className="numero" data-rotulo="Guardado">{e.saldo}</td>
                    <td className="numero" data-rotulo="Vendido">{e.reservado}</td>
                    <td className="numero" data-rotulo="Disponível"><strong className={precisaRepor(e) ? "atrasada" : undefined}>{disponivel(e)}</strong></td>
                    <td className="numero" data-rotulo="Mínimo">{e.minimo}</td>
                    <td className="acoes">
                      <span className="acoes-linha">
                        <BotaoJanela rotulo="Perda, evento ou contagem" somenteIcone icone={<ClipboardMinus aria-hidden />} titulo={`${e.nome}: perda, evento ou contagem`}>
                          <FormularioAjuste item={{ id: e.id, nome: e.nome }} />
                        </BotaoJanela>
                        <BotaoJanela rotulo="Mudar mínimo" somenteIcone icone={<Gauge aria-hidden />} titulo={`${e.nome}: estoque mínimo`}
                          descricao="Abaixo do mínimo, a cozinha vê o aviso de repor.">
                          <FormularioMinimo id={e.id} minimo={e.minimo} />
                        </BotaoJanela>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {pode(acesso, "catalogo.alterar") && (
        <section className="cartao sem-respiro">
          <TituloCartao titulo="Cardápio de encomendas" conta={produtos.length} />
          <div className="lista-rolavel">
            <table className="empilhar">
              <thead><tr><th>Produto</th><th className="numero">Preço</th><th><span className="sr-only">Ações</span></th></tr></thead>
              <tbody>
                {produtos.map((p) => (
                  <tr key={p.id} data-item={p.nome}>
                    <td>{p.nome}<div className="mudo" style={{ fontSize: ".8rem" }}>{p.grupo}{p.unidades > 1 ? ` · ${p.unidades} un.` : ""}</div></td>
                    <td className="numero" data-rotulo="Preço">{p.ativo ? formatarCentavos(p.preco_centavos) : <span className="selo cinza">fora de venda</span>}</td>
                    <td className="acoes">
                      <BotaoJanela rotulo="Mudar preço" somenteIcone icone={<Pencil aria-hidden />} titulo={`${p.nome}: preço`}
                        descricao="Vale para pedidos novos. Pedidos já feitos guardam o preço da hora.">
                        <FormularioPreco id={p.id} preco={p.preco_centavos} ativo={p.ativo} />
                      </BotaoJanela>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      </div>

      {podeEstoque && (
        <section className="cartao" style={{ marginTop: 16 }}>
          <h2>Últimas movimentações</h2>
          {movimentos.length ? (
            <ul className="pedidos-lista rola-por-dentro" style={{ maxHeight: 420 }}>
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
          ) : <p className="mudo" style={{ margin: 0 }}>Nada registrado ainda.</p>}
        </section>
      )}
    </>
  );
}
