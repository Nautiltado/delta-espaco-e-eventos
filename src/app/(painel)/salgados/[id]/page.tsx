import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { exigirAlguma } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarCentavos } from "@/lib/dinheiro";
import { formatarData, formatarDataComDia, formatarDataHora, hojeNaDelta } from "@/lib/datas";
import { linkWhatsApp } from "@/lib/documentos";
import { payloadPix } from "@/lib/pix";
import { FORMAS_PAGAMENTO } from "@/lib/reservas";
import { lerConfiguracoes } from "@/lib/reserva-dados";
import { AVISO_CANCELAMENTO, CANAIS, STATUS_PEDIDO, diaDaDelta, horaDaDelta, type StatusPedido } from "@/lib/salgados";
import { BotaoAcao, CopiarPix } from "../../reservas/componentes";
import { entregarPedido, marcarPronto } from "../actions";
import { FormularioCancelarPedido, FormularioPagamentoPedido } from "../componentes";

export const metadata: Metadata = { title: "Pedido" };

const AVISOS: Record<string, string> = {
  criado: "Pedido registrado. Agora receba o pagamento: só depois de pago ele vai para a cozinha.",
  pago: "Pagamento registrado. O pedido já aparece na tela da cozinha.",
  cancelado: "Pedido cancelado.",
};

type Pedido = {
  id: string; numero: string; cliente_nome: string; cliente_telefone: string | null; canal: string; retirada_em: string;
  status: StatusPedido; total_centavos: number; observacao: string | null; criado_em: string; pago_em: string | null;
  pronto_em: string | null; entregue_em: string | null; cancelado_em: string | null; cancelado_motivo: string | null; devolucao: boolean;
  pedido_itens: { id: string; descricao: string; quantidade: number; preco_unitario_centavos: number; total_centavos: number;
    composicao: { estoque_item_id: string; unidades: number }[] | null }[];
  pedido_pagamentos: { id: string; valor_centavos: number; forma: string; id_externo: string | null; recebido_em: string }[];
};

export default async function PaginaPedido({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string }> }) {
  const acesso = await exigirAlguma(["salgados.criar", "retirada.registrar", "producao.status"]);
  const { id } = await params;
  const { aviso } = await searchParams;
  const supabase = await criarClienteServidor();
  const [{ data }, { data: itensEstoque }, cfg] = await Promise.all([
    supabase.from("pedidos").select("*, pedido_itens(*), pedido_pagamentos(*)").eq("id", id).maybeSingle(),
    supabase.from("estoque_itens").select("id, nome"),
    lerConfiguracoes(supabase, ["empresa."]),
  ]);
  if (!data) notFound();
  const p = data as unknown as Pedido;
  const nomes = new Map((itensEstoque ?? []).map((i) => [i.id as string, i.nome as string]));
  const st = STATUS_PEDIDO[p.status];
  const hoje = hojeNaDelta();
  const dia = diaDaDelta(p.retirada_em);
  const wa = linkWhatsApp(p.cliente_telefone);
  const aguardando = p.status === "aguardando_pagamento";
  const ativo = p.status !== "entregue" && p.status !== "cancelado";

  let pix: { codigo: string; svg: string } | null = null;
  const chave = String(cfg["empresa.pix_chave"] ?? "").trim();
  if (aguardando && chave) {
    const codigo = payloadPix({
      chave, nome: String(cfg["empresa.razao_social"] ?? "Delta"), cidade: String(cfg["empresa.cidade"] ?? "Bacabal"),
      valorCentavos: p.total_centavos, identificador: p.numero.replace(/\W/g, ""),
    });
    pix = { codigo, svg: await QRCode.toString(codigo, { type: "svg", margin: 1, width: 168 }) };
  }
  const resumoWa = [
    `Olá, ${p.cliente_nome.split(" ")[0]}! Seu pedido ${p.numero} no Delta:`,
    ...p.pedido_itens.map((i) => `• ${i.quantidade}× ${i.descricao}${
      i.composicao && (i.composicao.length > 1 || /mist|sortid/i.test(i.descricao))
        ? ` (${i.composicao.map((c) => `${c.unidades} ${nomes.get(c.estoque_item_id)?.toLowerCase() ?? "?"}`).join(", ")}${i.quantidade > 1 ? " em cada" : ""})`
        : ""}`),
    `Total: ${formatarCentavos(p.total_centavos)}`,
    `Retirada: ${formatarDataComDia(dia)} às ${horaDaDelta(p.retirada_em)}`,
    "",
    AVISO_CANCELAMENTO,
    ...(aguardando && pix ? ["", "Pix copia e cola:", pix.codigo] : []),
  ].join("\n");

  return (
    <>
      <div className="cabecalho">
        <div>
          <p style={{ margin: 0 }}><Link href="/salgados">← Encomendas</Link></p>
          <h1>{p.cliente_nome}</h1>
          <p>{p.numero} · {CANAIS[p.canal] ?? p.canal} · <span className={st.classe}>{st.rotulo}</span></p>
          <p className="mudo" style={{ marginTop: 2 }}>
            Retirada {dia === hoje ? "hoje" : formatarDataComDia(dia)} às <strong>{horaDaDelta(p.retirada_em)}</strong> · {formatarCentavos(p.total_centavos)}
          </p>
        </div>
        {wa && (
          <div className="linha">
            <a className="botao secundario" href={`${wa}?text=${encodeURIComponent(resumoWa)}`} target="_blank" rel="noreferrer">
              Enviar resumo no WhatsApp
            </a>
          </div>
        )}
      </div>

      {aviso && AVISOS[aviso] && <p className="aviso ok" role="status">{AVISOS[aviso]}</p>}
      {p.status === "cancelado" && (
        <p className="aviso erro">
          Cancelado em {formatarDataHora(p.cancelado_em)}: {p.cancelado_motivo}.{" "}
          {p.pedido_pagamentos.length > 0 && (p.devolucao ? "Dinheiro a devolver ao cliente (veja Tarefas)." : "Sem devolução: o salgado já estava pronto.")}
        </p>
      )}

      <div className="grade" style={{ alignItems: "start" }}>
        <section className="cartao">
          <h2>Itens</h2>
          <ul className="pedidos-lista">
            {p.pedido_itens.map((i) => (
              <li key={i.id}>
                <div>
                  <strong>{i.quantidade}× {i.descricao}</strong>
                  {i.composicao && (i.composicao.length > 1 || /mist|sortid/i.test(i.descricao)) && (
                    <div className="mudo" style={{ fontSize: ".85rem" }}>
                      {i.composicao.map((c) => `${c.unidades} ${nomes.get(c.estoque_item_id)?.toLowerCase() ?? "?"}`).join(" · ")}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>{formatarCentavos(i.total_centavos)}</div>
              </li>
            ))}
          </ul>
          <p style={{ textAlign: "right", fontSize: "1.1rem" }}><strong>Total {formatarCentavos(p.total_centavos)}</strong></p>
          {p.observacao && <p><strong>Observação:</strong> {p.observacao}</p>}
          {p.cliente_telefone && <p className="mudo">Telefone: {p.cliente_telefone}</p>}
          {ativo && <p className="mudo" style={{ fontSize: ".85rem" }}>{AVISO_CANCELAMENTO}</p>}
        </section>

        <section className="cartao">
          {aguardando ? (
            <>
              <h2>Receber {formatarCentavos(p.total_centavos)}</h2>
              {pix ? (
                <>
                  <div dangerouslySetInnerHTML={{ __html: pix.svg }} aria-label="QR Code Pix" role="img" style={{ maxWidth: 168 }} />
                  <CopiarPix codigo={pix.codigo} />
                </>
              ) : (
                <p className="mudo">Cadastre a chave Pix em <Link href="/configuracoes">Configurações</Link> para gerar o Pix copia e cola.</p>
              )}
              {pode(acesso, "salgados.criar") || pode(acesso, "pagamento.confirmar") ? (
                <>
                  <hr />
                  <p className="mudo" style={{ fontSize: ".85rem" }}>Só registre depois de ver o dinheiro na conta (ou na mão).</p>
                  <FormularioPagamentoPedido pedidoId={p.id} hoje={hoje} />
                </>
              ) : null}
            </>
          ) : (
            <>
              <h2>Andamento</h2>
              <ul style={{ paddingLeft: 18 }}>
                <li>Pedido em {formatarDataHora(p.criado_em)}</li>
                {p.pedido_pagamentos.map((pg) => (
                  <li key={pg.id}>
                    Pago {formatarCentavos(pg.valor_centavos)} por {FORMAS_PAGAMENTO[pg.forma as keyof typeof FORMAS_PAGAMENTO] ?? pg.forma} em {formatarData(pg.recebido_em)}
                    {pg.id_externo && <span className="mudo"> ({pg.id_externo})</span>}
                  </li>
                ))}
                {p.pronto_em && <li>Pronto em {formatarDataHora(p.pronto_em)}</li>}
                {p.entregue_em && <li>Entregue em {formatarDataHora(p.entregue_em)}</li>}
              </ul>
              {p.status === "pago" && pode(acesso, "producao.status") && (
                <BotaoAcao acao={marcarPronto} campos={{ pedido_id: p.id }} texto="Marcar como pronto" />
              )}
              {(p.status === "pago" || p.status === "pronto") && pode(acesso, "retirada.registrar") && (
                <BotaoAcao acao={entregarPedido} campos={{ pedido_id: p.id }} texto="Cliente retirou"
                  classe={p.status === "pronto" ? "botao" : "botao secundario"} ajuda="Baixa as unidades do estoque." />
              )}
            </>
          )}
          {ativo && (pode(acesso, "salgados.criar") || pode(acesso, "pagamento.estornar")) && (
            <details style={{ marginTop: 16 }}>
              <summary>Cancelar pedido</summary>
              <FormularioCancelarPedido pedidoId={p.id} status={p.status as "aguardando_pagamento" | "pago" | "pronto"} podeExcecao={pode(acesso, "pagamento.estornar")} />
            </details>
          )}
        </section>
      </div>
    </>
  );
}
