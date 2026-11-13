import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Vazio } from "@/componentes/ui";
import { exigirAlguma } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarCentavos } from "@/lib/dinheiro";
import { formatarDataComDia, hojeNaDelta, instanteAtual } from "@/lib/datas";
import { CANAIS, STATUS_PEDIDO, diaDaDelta, horaDaDelta } from "@/lib/salgados";
import { SELECT_PEDIDO, type PedidoResumo } from "@/lib/salgados-dados";

export const metadata: Metadata = { title: "Encomendas" };

function Lista({ pedidos, mostrarDia = false }: { pedidos: PedidoResumo[]; mostrarDia?: boolean }) {
  if (!pedidos.length) return <Vazio compacto icone={ShoppingBag} titulo="Nenhum pedido aqui" />;
  return (
    <ul className="pedidos-lista">
      {pedidos.map((p) => (
        <li key={p.id}>
          <div>
            <Link href={`/salgados/${p.id}`}><strong>{p.cliente_nome}</strong></Link>
            <div className="mudo" style={{ fontSize: ".85rem" }}>
              {p.numero} · {CANAIS[p.canal] ?? p.canal} · {p.pedido_itens.map((i) => `${i.quantidade}× ${i.descricao}`).join(", ")}
            </div>
          </div>
          <div style={{ textAlign: "right", flex: "0 0 auto" }}>
            <div><strong>{mostrarDia && `${formatarDataComDia(diaDaDelta(p.retirada_em))} `}{horaDaDelta(p.retirada_em)}</strong></div>
            <div style={{ fontSize: ".85rem" }}>{formatarCentavos(p.total_centavos)}</div>
            <span className={STATUS_PEDIDO[p.status].classe}>{STATUS_PEDIDO[p.status].rotulo}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function PaginaEncomendas() {
  const acesso = await exigirAlguma(["salgados.criar", "retirada.registrar", "producao.status", "salgados.ver"]);
  const supabase = await criarClienteServidor();
  const hoje = hojeNaDelta();
  const desde = new Date(instanteAtual() - 3 * 86400000).toISOString();
  const [{ data: abertos }, { data: recentes }] = await Promise.all([
    supabase.from("pedidos").select(SELECT_PEDIDO).in("status", ["aguardando_pagamento", "pago", "pronto"]).order("retirada_em"),
    supabase.from("pedidos").select(SELECT_PEDIDO).in("status", ["entregue", "cancelado"]).gte("retirada_em", desde)
      .order("retirada_em", { ascending: false }).limit(30),
  ]);
  const ab = (abertos ?? []) as unknown as PedidoResumo[];
  const aguardando = ab.filter((p) => p.status === "aguardando_pagamento");
  const pagos = ab.filter((p) => p.status !== "aguardando_pagamento");
  const deHoje = pagos.filter((p) => diaDaDelta(p.retirada_em) <= hoje);
  const proximos = pagos.filter((p) => diaDaDelta(p.retirada_em) > hoje);
  const totalHoje = deHoje.reduce((s, p) => s + p.total_centavos, 0);

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Encomendas</h1>
          <p>Salgados e lanches para retirar. A cozinha só vê o pedido depois de pago.</p>
        </div>
        <div className="linha">
          {pode(acesso, "producao.status") && <Link className="botao secundario" href="/salgados/cozinha">Cozinha</Link>}
          {(pode(acesso, "estoque.movimentar") || pode(acesso, "catalogo.alterar")) && (
            <Link className="botao secundario" href="/salgados/estoque">Estoque e preços</Link>
          )}
          {pode(acesso, "salgados.criar") && <Link className="botao" href="/salgados/novo">Novo pedido</Link>}
        </div>
      </div>

      {aguardando.length > 0 && (
        <section className="cartao" style={{ borderColor: "var(--dourado)" }}>
          <h2>Aguardando pagamento ({aguardando.length})</h2>
          <p className="mudo" style={{ marginTop: 0 }}>Confira o Pix no extrato e registre. Sem pagamento, a cozinha não recebe.</p>
          <Lista pedidos={aguardando} mostrarDia />
        </section>
      )}
      <section className="cartao">
        <h2>Retirada hoje ({deHoje.length}){totalHoje > 0 && <span className="mudo" style={{ fontWeight: 400 }}> · {formatarCentavos(totalHoje)}</span>}</h2>
        <Lista pedidos={deHoje} mostrarDia={deHoje.some((p) => diaDaDelta(p.retirada_em) < hoje)} />
      </section>
      <section className="cartao">
        <h2>Próximos dias ({proximos.length})</h2>
        <Lista pedidos={proximos} mostrarDia />
      </section>
      <section className="cartao">
        <h2>Entregues e cancelados (últimos 3 dias)</h2>
        <Lista pedidos={(recentes ?? []) as unknown as PedidoResumo[]} mostrarDia />
      </section>
    </>
  );
}
