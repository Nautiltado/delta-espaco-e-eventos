import type { Metadata } from "next";
import Link from "next/link";
import { Plus, ShoppingBag } from "lucide-react";
import { Abas, Vazio } from "@/componentes/ui";
import { Paginacao, paginaDoEndereco } from "@/componentes/paginacao";
import { exigirAlguma } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarCentavos } from "@/lib/dinheiro";
import { formatarDataComDia, hojeNaDelta } from "@/lib/datas";
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

const ABAS = {
  aguardando: "Aguardando pagamento",
  hoje: "Retirada hoje",
  proximos: "Próximos dias",
  encerrados: "Entregues e cancelados",
} as const;
type Aba = keyof typeof ABAS;

export default async function PaginaEncomendas({ searchParams }: { searchParams: Promise<{ aba?: string; pagina?: string }> }) {
  const acesso = await exigirAlguma(["salgados.criar", "retirada.registrar", "producao.status", "salgados.ver"]);
  const sp = await searchParams;
  const supabase = await criarClienteServidor();
  const hoje = hojeNaDelta();
  const { pagina, de, ate, porPagina } = paginaDoEndereco(sp.pagina);
  const [{ data: abertos }, { data: encerrados, count: totalEncerrados }] = await Promise.all([
    supabase.from("pedidos").select(SELECT_PEDIDO).in("status", ["aguardando_pagamento", "pago", "pronto"]).order("retirada_em"),
    supabase.from("pedidos").select(SELECT_PEDIDO, { count: "exact" }).in("status", ["entregue", "cancelado"])
      .order("retirada_em", { ascending: false }).range(sp.aba === "encerrados" ? de : 0, sp.aba === "encerrados" ? ate : 0),
  ]);
  const ab = (abertos ?? []) as unknown as PedidoResumo[];
  const aguardando = ab.filter((p) => p.status === "aguardando_pagamento");
  const pagos = ab.filter((p) => p.status !== "aguardando_pagamento");
  const deHoje = pagos.filter((p) => diaDaDelta(p.retirada_em) <= hoje);
  const proximos = pagos.filter((p) => diaDaDelta(p.retirada_em) > hoje);
  const totalHoje = deHoje.reduce((s, p) => s + p.total_centavos, 0);
  const conta: Record<Aba, number> = { aguardando: aguardando.length, hoje: deHoje.length, proximos: proximos.length, encerrados: totalEncerrados ?? 0 };
  const aba: Aba = sp.aba && sp.aba in ABAS ? (sp.aba as Aba) : aguardando.length ? "aguardando" : "hoje";
  const href = (k: Aba) => (k === "hoje" && !aguardando.length ? "/salgados" : `/salgados?aba=${k}`);

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
          {pode(acesso, "salgados.criar") && <Link className="botao" href="/salgados/novo"><Plus aria-hidden />Novo pedido</Link>}
        </div>
      </div>

      <section className="cartao sem-respiro">
        <div className="cartao-cabecalho">
          <Abas rotulo="Encomendas" itens={(Object.keys(ABAS) as Aba[]).map((k) => ({ href: href(k), rotulo: ABAS[k], conta: conta[k], ativa: aba === k }))} />
          {aba === "hoje" && totalHoje > 0 && <span className="mudo">Total de hoje: {formatarCentavos(totalHoje)}</span>}
        </div>
        <div className="lista-rolavel" style={{ padding: "4px 20px" }}>
          {aba === "aguardando" && (
            <>
              <p className="mudo pequeno" style={{ margin: "10px 0 0" }}>Confira o Pix no extrato e registre. Sem pagamento, a cozinha não recebe.</p>
              <Lista pedidos={aguardando} mostrarDia />
            </>
          )}
          {aba === "hoje" && <Lista pedidos={deHoje} mostrarDia={deHoje.some((p) => diaDaDelta(p.retirada_em) < hoje)} />}
          {aba === "proximos" && <Lista pedidos={proximos} mostrarDia />}
          {aba === "encerrados" && <Lista pedidos={(encerrados ?? []) as unknown as PedidoResumo[]} mostrarDia />}
        </div>
        {aba === "encerrados" && <Paginacao total={totalEncerrados ?? 0} pagina={pagina} porPagina={porPagina} caminho="/salgados" parametros={sp} />}
      </section>
    </>
  );
}
