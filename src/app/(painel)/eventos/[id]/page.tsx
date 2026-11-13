import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAlguma } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarCentavos } from "@/lib/dinheiro";
import { formatarData, formatarDataComDia, hojeNaDelta } from "@/lib/datas";
import { descreverPeriodo, diaNaDelta, horaNaDelta, STATUS_RESERVA, type StatusReserva } from "@/lib/reservas";
import { lerConfiguracoes } from "@/lib/reserva-dados";
import { rotuloUnidade, TIPOS_ORCAMENTO } from "@/lib/orcamentos";
import { normalizarTelefone } from "@/lib/documentos";
import { tamanhoLegivel } from "@/lib/comprovantes";
import {
  CATEGORIAS_GASTO, descreverResultado, ETAPAS, fechamento, mensagemEquipe, nomeFuncao, PERMISSOES_EVENTOS, sugerirEquipe,
  totalEquipe, type Ficha, type Gasto, type LinhaEquipe,
} from "@/lib/eventos";
import { BotaoAcao } from "../../reservas/componentes";
import { marcarGastoPago, pagarEquipe, removerEquipe } from "../actions";
import {
  AnexarNota, FormularioEquipe, FormularioFicha, FormularioGasto, Imprimir, ItemChecklist, NovoItemChecklist, RemoverComMotivo,
} from "../componentes";

export const metadata: Metadata = { title: "Evento" };

type ItemCheck = { id: string; etapa: string; item: string; feito_em: string | null; usuarios: { nome: string } | null };
type Nota = { id: string; custo_id: string | null; caminho: string; nome_arquivo: string; tamanho: number; enviado_em: string };

export default async function PaginaEvento({ params }: { params: Promise<{ id: string }> }) {
  const acesso = await exigirAlguma(PERMISSOES_EVENTOS);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await criarClienteServidor();
  await supabase.rpc("preparar_checklist", { p_reserva: id });
  const verGastos = pode(acesso, "evento.fechar") || pode(acesso, "custo.ver");
  const lancaGastos = pode(acesso, "evento.fechar");
  const montaEquipe = pode(acesso, "escala.gerir");
  const editaFicha = montaEquipe || pode(acesso, "orcamento.criar");

  const [{ data: f, error }, { data: fichaExtra }, { data: eq }, { data: ck }, cfg] = await Promise.all([
    supabase.rpc("ficha_evento", { p_reserva: id }),
    supabase.from("evento_fichas").select("chegada_equipe, traje, observacoes").eq("reserva_id", id).maybeSingle(),
    supabase.from("evento_equipe").select("*").eq("reserva_id", id).order("criado_em"),
    supabase.from("evento_checklist").select("id, etapa, item, feito_em, usuarios:feito_por(nome)").eq("reserva_id", id).order("ordem"),
    lerConfiguracoes(supabase, ["operacao."]),
  ]);
  if (error || !f) notFound();
  const ficha = f as Ficha;
  const extra = (fichaExtra ?? { chegada_equipe: null, traje: null, observacoes: null }) as { chegada_equipe: string | null; traje: string | null; observacoes: string | null };
  const equipe = ((eq ?? []) as LinhaEquipe[]).map((l) => ({ ...l, valor_unitario_centavos: Number(l.valor_unitario_centavos) }));
  const checklist = (ck ?? []) as unknown as ItemCheck[];

  let gastos: Gasto[] = [];
  let notas: (Nota & { url: string | null })[] = [];
  let recebido: number | null = null;
  if (verGastos) {
    const [{ data: gs }, { data: ns }, { data: ps }] = await Promise.all([
      supabase.from("evento_custos").select("*").eq("reserva_id", id).is("removido_em", null).order("data"),
      supabase.from("evento_notas").select("id, custo_id, caminho, nome_arquivo, tamanho, enviado_em").eq("reserva_id", id).is("removido_em", null).order("enviado_em"),
      supabase.from("parcelas_situacao").select("pago_centavos").eq("reserva_id", id),
    ]);
    gastos = ((gs ?? []) as Gasto[]).map((g) => ({ ...g, valor_centavos: Number(g.valor_centavos) }));
    const lista = (ns ?? []) as Nota[];
    const { data: urls } = lista.length ? await supabase.storage.from("notas").createSignedUrls(lista.map((n) => n.caminho), 3600) : { data: [] };
    notas = lista.map((n, i) => ({ ...n, url: urls?.[i]?.signedUrl ?? null }));
    if (ps) recebido = (ps as { pago_centavos: number }[]).reduce((s, p) => s + Number(p.pago_centavos), 0);
  }

  const status = STATUS_RESERVA[ficha.status as StatusReserva];
  const o = ficha.orcamento;
  const sugestao = sugerirEquipe(ficha.itens, o?.convidados ?? null, o?.tipo ?? null);
  const jaGarcom = equipe.filter((l) => l.funcao === "garcom").reduce((s, l) => s + l.quantidade, 0);
  const jaSeg = equipe.filter((l) => l.funcao === "seguranca").reduce((s, l) => s + l.quantidade, 0);
  const proxima = sugestao.garcom > jaGarcom ? { funcao: "garcom", quantidade: sugestao.garcom - jaGarcom }
    : sugestao.seguranca > jaSeg ? { funcao: "seguranca", quantidade: sugestao.seguranca - jaSeg } : { funcao: "garcom", quantidade: 1 };
  const diarias = { garcom: Number(cfg["operacao.diaria_garcom"] ?? 18000), seguranca: Number(cfg["operacao.diaria_seguranca"] ?? 18000) };
  const responsavel = String(cfg["operacao.equipe_responsavel"] ?? "Kaká");
  const telEquipe = normalizarTelefone(String(cfg["operacao.equipe_telefone"] ?? ""));
  const chegada = extra.chegada_equipe?.slice(0, 5) ?? null;
  const local = ficha.espacos.length ? `${ficha.espacos.join(" e ")} do Delta` : (o?.local_externo ?? "Delta Espaço e Eventos");
  const msg = mensagemEquipe({
    responsavel, dia: formatarDataComDia(diaNaDelta(ficha.inicio)), chegada,
    horario: `${horaNaDelta(ficha.inicio)} às ${horaNaDelta(ficha.fim)}`, titulo: ficha.titulo ?? "Evento", convidados: o?.convidados ?? null,
    linhas: equipe, traje: extra.traje, observacoes: extra.observacoes, local,
  });
  const linkEquipe = `https://wa.me/${telEquipe ? `55${telEquipe}` : ""}?text=${encodeURIComponent(msg)}`;
  const contratado = Number(ficha.valor_total_centavos ?? 0);
  const fe = fechamento(contratado, equipe, gastos);
  const hoje = hojeNaDelta();
  const notasSoltas = notas.filter((n) => !n.custo_id || !gastos.some((g) => g.id === n.custo_id));

  return (
    <>
      <div className="cabecalho">
        <div>
          <p style={{ margin: 0 }} className="nao-imprimir"><Link href="/eventos">← Eventos</Link></p>
          <h1>{ficha.titulo ?? "Evento"}</h1>
          <p>
            {ficha.cliente?.nome}
            {o && pode(acesso, "orcamento.ver") && <> · <Link href={`/reservas/${ficha.id}`}>reserva</Link> · <Link href={`/orcamentos/${o.id}`}>{o.numero}</Link></>}
            {status && <> · <span className={status.classe}>{status.rotulo.split(" (")[0]}</span></>}
          </p>
          <p className="mudo" style={{ marginTop: 2 }}>
            {descreverPeriodo(ficha.inicio, ficha.fim)} · {local}{o?.convidados ? ` · ${o.convidados} convidados` : ""}{o?.tipo ? ` · ${TIPOS_ORCAMENTO[o.tipo] ?? o.tipo}` : ""}
          </p>
        </div>
        <div className="linha nao-imprimir"><Imprimir /></div>
      </div>

      <div className="grade" style={{ alignItems: "start" }}>
        <section className="cartao">
          <h2>Ficha do dia</h2>
          <p style={{ margin: "0 0 6px" }}>
            {chegada && <><strong>Equipe chega:</strong> {chegada} · </>}
            <strong>Evento:</strong> {horaNaDelta(ficha.inicio)} às {horaNaDelta(ficha.fim)}
            {extra.traje && <> · <strong>Traje:</strong> {extra.traje}</>}
          </p>
          {extra.observacoes && <p style={{ whiteSpace: "pre-wrap" }}><strong>Observações:</strong> {extra.observacoes}</p>}
          {ficha.cliente?.telefone && <p className="mudo">Contato do cliente: {ficha.cliente.telefone}</p>}
          <h3 style={{ fontSize: "1rem", margin: "12px 0 6px" }}>Cardápio e serviços {ficha.versao_status === "aprovada" ? "contratados" : "do orçamento"}</h3>
          {ficha.versao_status && ficha.versao_status !== "aprovada" && (
            <p className="aviso info" style={{ margin: "0 0 8px" }}>O orçamento ainda não foi aprovado pelo cliente: o cardápio pode mudar.</p>
          )}
          {ficha.itens.length ? (
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              {ficha.itens.map((i, k) => (
                <li key={k}>{Number(i.quantidade).toLocaleString("pt-BR")} {rotuloUnidade(i.unidade ?? "unidade", Number(i.quantidade))} · {i.descricao}</li>
              ))}
            </ul>
          ) : <p className="mudo">O orçamento ainda não tem itens.</p>}
          {editaFicha && (
            <details className="nao-imprimir" style={{ marginTop: 12 }}>
              <summary>Editar chegada, traje e observações</summary>
              <FormularioFicha reservaId={ficha.id} chegada={chegada ?? ""} traje={extra.traje ?? ""} observacoes={extra.observacoes ?? ""} />
            </details>
          )}
        </section>

        <section className="cartao">
          <h2>Equipe{equipe.length > 0 && (verGastos || montaEquipe) && <span className="mudo" style={{ fontWeight: 400 }}> · {formatarCentavos(totalEquipe(equipe))}</span>}</h2>
          {(sugestao.garcom > 0 || sugestao.seguranca > 0) && (
            <p className="mudo" style={{ marginTop: 0, fontSize: ".88rem" }}>
              Pelo orçamento: {[sugestao.garcom && nomeFuncao("garcom", sugestao.garcom), sugestao.seguranca && nomeFuncao("seguranca", sugestao.seguranca)].filter(Boolean).join(" e ")}.
            </p>
          )}
          {equipe.length ? (
            <ul className="pedidos-lista">
              {equipe.map((l) => (
                <li key={l.id}>
                  <div>
                    <strong>{nomeFuncao(l.funcao, l.quantidade)}</strong>{l.fornecedor && <span className="mudo"> · {l.fornecedor}</span>}
                    {(verGastos || montaEquipe) && (
                      <div className="mudo" style={{ fontSize: ".85rem" }}>
                        {l.quantidade} × {formatarCentavos(l.valor_unitario_centavos)} = {formatarCentavos(l.quantidade * l.valor_unitario_centavos)}
                      </div>
                    )}
                    {l.observacao && <div className="mudo" style={{ fontSize: ".85rem" }}>{l.observacao}</div>}
                  </div>
                  <div style={{ textAlign: "right" }} className="nao-imprimir">
                    {l.pago_em ? <span className="selo">Pago {formatarData(l.pago_em)}</span> : <span className="selo dourado">A pagar</span>}
                    {(montaEquipe || lancaGastos) && (
                      <div style={{ marginTop: 6 }}>
                        <BotaoAcao acao={pagarEquipe} campos={{ id: l.id, reserva_id: ficha.id, pago_em: l.pago_em ? "" : hoje }}
                          texto={l.pago_em ? "Desmarcar pago" : "Marcar pago hoje"} classe="botao secundario pequeno" />
                        {montaEquipe && !l.pago_em && <BotaoAcao acao={removerEquipe} campos={{ id: l.id, reserva_id: ficha.id }} texto="Remover" classe="botao secundario pequeno" confirmar="Tirar esta linha da equipe?" />}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="mudo">Ninguém escalado ainda.</p>}
          <div className="nao-imprimir">
            {equipe.length > 0 && (
              <a className="botao secundario" href={linkEquipe} target="_blank" rel="noreferrer" style={{ marginBottom: 12 }}>
                Mandar para {responsavel} no WhatsApp
              </a>
            )}
            {!telEquipe && equipe.length > 0 && (
              <p className="mudo" style={{ fontSize: ".8rem" }}>Cadastre o WhatsApp de {responsavel} em <Link href="/configuracoes">Configurações</Link> para abrir direto na conversa.</p>
            )}
            {montaEquipe && (
              <details open={!equipe.length} style={{ marginTop: 8 }}>
                <summary>Adicionar à equipe</summary>
                <FormularioEquipe reservaId={ficha.id} sugestao={proxima} diarias={diarias} responsavel={responsavel} />
              </details>
            )}
          </div>
        </section>
      </div>

      <section className="cartao">
        <h2>Checklist</h2>
        <div className="grade checklist">
          {Object.entries(ETAPAS).map(([etapa, rotulo]) => {
            const itens = checklist.filter((c) => c.etapa === etapa);
            const feitos = itens.filter((c) => c.feito_em).length;
            return (
              <div key={etapa}>
                <h3 style={{ fontSize: "1rem", margin: "0 0 6px" }}>{rotulo} <span className="mudo" style={{ fontWeight: 400 }}>{feitos}/{itens.length}</span></h3>
                {itens.map((c) => (
                  <ItemChecklist key={c.id} id={c.id} reservaId={ficha.id} item={c.item} feito={!!c.feito_em}
                    quem={c.feito_em ? `${c.usuarios?.nome?.split(" ")[0] ?? ""} ${horaNaDelta(c.feito_em)}`.trim() : null} />
                ))}
                <div className="nao-imprimir"><NovoItemChecklist reservaId={ficha.id} etapa={etapa} /></div>
              </div>
            );
          })}
        </div>
      </section>

      {verGastos && (
        <div className="grade" style={{ alignItems: "start" }}>
          <section className="cartao">
            <h2>Gastos do evento{gastos.length > 0 && <span className="mudo" style={{ fontWeight: 400 }}> · {formatarCentavos(fe.custoGastos)}</span>}</h2>
            {gastos.length ? (
              <ul className="pedidos-lista">
                {gastos.map((g) => {
                  const minhas = notas.filter((n) => n.custo_id === g.id);
                  return (
                    <li key={g.id}>
                      <div style={{ minWidth: 0 }}>
                        <strong>{g.descricao}</strong>
                        <div className="mudo" style={{ fontSize: ".85rem" }}>
                          {CATEGORIAS_GASTO[g.categoria]?.split(" (")[0]} · {formatarData(g.data)}{g.fornecedor && ` · ${g.fornecedor}`}
                        </div>
                        <div style={{ fontSize: ".85rem", marginTop: 2 }}>
                          {minhas.length ? minhas.map((n) => (
                            <span key={n.id} style={{ marginRight: 8 }}>
                              📎 {n.url ? <a href={n.url} target="_blank" rel="noreferrer">{n.nome_arquivo}</a> : n.nome_arquivo}
                            </span>
                          )) : <span className="mudo">sem nota</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                        <strong>{formatarCentavos(g.valor_centavos)}</strong>
                        <div>{g.pago ? <span className="selo">Pago</span> : <span className="selo dourado">A pagar</span>}</div>
                        {lancaGastos && (
                          <div className="nao-imprimir" style={{ marginTop: 6, display: "grid", gap: 4, justifyItems: "end" }}>
                            <AnexarNota reservaId={ficha.id} custoId={g.id} />
                            <BotaoAcao acao={marcarGastoPago} campos={{ id: g.id, reserva_id: ficha.id, pago: g.pago ? "0" : "1" }}
                              texto={g.pago ? "Marcar a pagar" : "Marcar pago"} classe="botao secundario pequeno" />
                            <RemoverComMotivo acao="gasto" id={g.id} reservaId={ficha.id} rotulo="Tirar da conta" />
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="mudo">Nenhum gasto lançado.</p>}
            {notasSoltas.length > 0 && (
              <>
                <h3 style={{ fontSize: "1rem", margin: "12px 0 6px" }}>Outras notas</h3>
                <ul style={{ paddingLeft: 18 }}>
                  {notasSoltas.map((n) => (
                    <li key={n.id}>
                      {n.url ? <a href={n.url} target="_blank" rel="noreferrer">{n.nome_arquivo}</a> : n.nome_arquivo}
                      <span className="mudo"> · {tamanhoLegivel(n.tamanho)}</span>
                      {lancaGastos && <RemoverComMotivo acao="nota" id={n.id} reservaId={ficha.id} rotulo="Tirar da lista" />}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {lancaGastos && (
              <details className="nao-imprimir" open={!gastos.length} style={{ marginTop: 12 }}>
                <summary>Lançar gasto</summary>
                <FormularioGasto reservaId={ficha.id} hoje={hoje} />
              </details>
            )}
          </section>

          <section className="cartao fechamento">
            <h2>Fechamento</h2>
            <table>
              <tbody>
                <tr><td>Valor do contrato</td><td className="numero">{formatarCentavos(contratado)}</td></tr>
                {recebido !== null && <tr><td className="mudo">Já recebido do cliente</td><td className="numero mudo">{formatarCentavos(recebido)}</td></tr>}
                <tr><td>Equipe</td><td className="numero">− {formatarCentavos(fe.custoEquipe)}</td></tr>
                <tr><td>Gastos</td><td className="numero">− {formatarCentavos(fe.custoGastos)}</td></tr>
                <tr className="total">
                  <td><strong>{fe.resultado >= 0 ? "Sobrou" : "Faltou"}</strong></td>
                  <td className="numero"><strong className={fe.resultado < 0 ? "atrasada" : undefined}>{formatarCentavos(Math.abs(fe.resultado))}</strong>
                    {contratado > 0 && <div className="mudo" style={{ fontSize: ".8rem" }}>{fe.margem}% do contrato</div>}</td>
                </tr>
              </tbody>
            </table>
            {fe.aPagar > 0 && <p className="aviso info" style={{ marginBottom: 0 }}>Ainda a pagar: {formatarCentavos(fe.aPagar)} (equipe e gastos marcados como a pagar).</p>}
            {recebido !== null && recebido < contratado && <p className="mudo" style={{ fontSize: ".85rem" }}>Falta receber do cliente {formatarCentavos(contratado - recebido)}.</p>}
            <p className="mudo" style={{ fontSize: ".8rem" }}>{descreverResultado(fe.resultado)} com o que foi lançado até agora. Lance todos os gastos para o número ficar certo.</p>
          </section>
        </div>
      )}
    </>
  );
}
