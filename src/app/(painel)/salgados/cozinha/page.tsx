import type { Metadata } from "next";
import Link from "next/link";
import { ChefHat } from "lucide-react";
import { TituloCartao, Vazio } from "@/componentes/ui";
import { exigirAlguma } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarDataComDia, hojeNaDelta } from "@/lib/datas";
import { diaDaDelta, disponivel, horaDaDelta, precisaRepor, somarPorSalgado } from "@/lib/salgados";
import { SELECT_PEDIDO, cardapioEEstoque, type PedidoResumo } from "@/lib/salgados-dados";
import { BotaoAcao } from "../../reservas/componentes";
import { entregarPedido, marcarPronto } from "../actions";
import { FormularioProducao } from "../componentes";

export const metadata: Metadata = { title: "Cozinha" };

export default async function PaginaCozinha() {
  const acesso = await exigirAlguma(["producao.status", "salgados.ver"]);
  const supabase = await criarClienteServidor();
  const [{ data }, { estoque }] = await Promise.all([
    supabase.from("pedidos").select(SELECT_PEDIDO).in("status", ["pago", "pronto"]).order("retirada_em"),
    cardapioEEstoque(supabase),
  ]);
  const pedidos = (data ?? []) as unknown as PedidoResumo[];
  const hoje = hojeNaDelta();
  const nomes = new Map(estoque.map((e) => [e.id, e.nome]));
  const deHoje = pedidos.filter((p) => diaDaDelta(p.retirada_em) <= hoje);
  const depois = pedidos.filter((p) => diaDaDelta(p.retirada_em) > hoje);
  const somaHoje = somarPorSalgado(deHoje.filter((p) => p.status === "pago"));
  const ativos = estoque.filter((e) => e.ativo);
  const repor = ativos.filter(precisaRepor);

  function Cartao({ p }: { p: PedidoResumo }) {
    const dia = diaDaDelta(p.retirada_em);
    return (
      <div className={p.status === "pronto" ? "cozinha-pedido pronto" : "cozinha-pedido"}>
        <div className="cardapio-linha">
          <div>
            <span className="hora">{horaDaDelta(p.retirada_em)}</span>{" "}
            {dia !== hoje && <span className="mudo">{formatarDataComDia(dia)}</span>}
            <div><Link href={`/salgados/${p.id}`}>{p.cliente_nome}</Link> <span className="mudo">{p.numero}</span></div>
          </div>
          <span className={p.status === "pronto" ? "selo" : "selo dourado"}>{p.status === "pronto" ? "Pronto" : "Separar"}</span>
        </div>
        <ul style={{ margin: "8px 0", paddingLeft: 18 }}>
          {p.pedido_itens.map((i, k) => (
            <li key={k}>
              <strong>{i.quantidade}× {i.descricao}</strong>
              {i.composicao && (i.composicao.length > 1 || /mist|sortid/i.test(i.descricao)) && (
                <span className="mudo"> — {i.composicao.map((c) => `${c.unidades} ${nomes.get(c.estoque_item_id)?.toLowerCase() ?? "?"}`).join(", ")}</span>
              )}
            </li>
          ))}
        </ul>
        {p.observacao && <p style={{ margin: "0 0 8px" }}><strong>Obs.:</strong> {p.observacao}</p>}
        <div className="linha">
          {p.status === "pago" && <BotaoAcao acao={marcarPronto} campos={{ pedido_id: p.id }} texto="Pronto" />}
          {pode(acesso, "retirada.registrar") && (
            <BotaoAcao acao={entregarPedido} campos={{ pedido_id: p.id }} texto="Cliente retirou" classe="botao secundario" />
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Cozinha</h1>
          <p>Pedidos pagos, por hora de retirada. O estoque desconta quando o cliente retira.</p>
        </div>
        {pode(acesso, "estoque.movimentar") && <Link className="botao secundario" href="/salgados/estoque">Estoque</Link>}
      </div>

      {repor.length > 0 && (
        <p className="aviso erro" role="note">
          Repor: {repor.map((e) => `${e.nome.toLowerCase()} (${Math.max(0, disponivel(e))} de ${e.minimo})`).join(" · ")}
        </p>
      )}

      <div className="painel-lateral cozinha-colunas">
        <div>
          <section className="cartao">
            <h2>Hoje ({deHoje.length})</h2>
            {deHoje.length ? deHoje.map((p) => <Cartao key={p.id} p={p} />) : <Vazio compacto icone={ChefHat} titulo="Nenhum pedido pago para hoje" />}
            {somaHoje.size > 0 && (
              <p className="mudo" style={{ fontSize: ".9rem" }}>
                Ainda separar hoje: {[...somaHoje].map(([k, v]) => `${v} ${nomes.get(k)?.toLowerCase()}`).join(" · ")}
              </p>
            )}
          </section>
          {depois.length > 0 && (
            <section className="cartao">
              <h2>Próximos dias ({depois.length})</h2>
              {depois.map((p) => <Cartao key={p.id} p={p} />)}
            </section>
          )}
        </div>
        <div>
          <section className="cartao">
            <h2>Fiz agora</h2>
            <FormularioProducao itens={ativos.map((e) => ({ id: e.id, nome: e.nome }))} />
          </section>
          <section className="cartao sem-respiro">
            <TituloCartao titulo="Estoque agora" acao={<span className="mudo pequeno">disponível · mínimo</span>} />
            <ul className="estoque-lista rola-por-dentro">
              {[...ativos].sort((a, b) => Number(precisaRepor(b)) - Number(precisaRepor(a))).map((e) => (
                <li key={e.id} className={precisaRepor(e) ? "estoque-item repor" : "estoque-item"}>
                  <span className="estoque-nome">{e.nome}
                    {e.reservado > 0 && <small className="mudo">{e.saldo} guardados, {e.reservado} vendidos</small>}
                  </span>
                  <span className="num">{disponivel(e)}</span>
                  <span className="mudo pequeno estoque-min">mín. {e.minimo}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
