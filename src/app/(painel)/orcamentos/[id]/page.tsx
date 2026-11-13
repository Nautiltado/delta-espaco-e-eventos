import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirPermissao } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarCentavos } from "@/lib/dinheiro";
import { formatarData, formatarDataComDia, formatarDataHora, hojeNaDelta } from "@/lib/datas";
import { linkWhatsApp } from "@/lib/documentos";
import { descreverPeriodo, STATUS_RESERVA, type StatusReserva } from "@/lib/reservas";
import { FormularioReservarData } from "../../reservas/componentes";
import { MontagemRapida } from "../montagem-rapida";
import { dadosOrcamentoRapido } from "@/lib/orcamento-rapido-dados";
import { apresentacaoPadrao } from "@/lib/proposta";
import type { ConteudoOrcamento } from "@/lib/pdf/orcamento";
import { ordenarCatalogo, precoDoItem, precoSugerido, type ItemCatalogo } from "@/lib/catalogo";
import { CATEGORIAS, margem, ordemCategoria, STATUS_ORCAMENTO, STATUS_VERSAO, TIPOS_ORCAMENTO, totalItem } from "@/lib/orcamentos";
import { carregarUnidades, SELECT_ORCAMENTO, versaoEmFoco, type ItemOrcamento, type Orcamento, type Versao } from "@/lib/orcamento-dados";
import { equivalencia, mapaDeUnidades, rotuloDaUnidade } from "@/lib/unidades";
import { criarNovaVersao, salvarCabecalho } from "../actions";
import {
  FormularioAceite,
  FormularioAprovacao,
  FormularioCondicoes,
  FormularioEnvio,
  FormularioEvento,
  FormularioPerda,
  LinhaItem,
  NovoItem,
} from "../componentes";

export const metadata: Metadata = { title: "Orçamento" };

export default async function PaginaOrcamento({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ versao?: string; enviado?: string; erro?: string }>;
}) {
  const acesso = await exigirPermissao("orcamento.ver");
  const { id } = await params;
  const { versao, enviado, erro } = await searchParams;
  const verCusto = pode(acesso, "custo.ver");
  const podeCriar = pode(acesso, "orcamento.criar");
  const supabase = await criarClienteServidor();

  const [{ data: orc }, { data: vs }] = await Promise.all([
    supabase.from("orcamentos").select(SELECT_ORCAMENTO).eq("id", id).maybeSingle(),
    supabase.from("orcamento_versoes").select("*").eq("orcamento_id", id).order("numero", { ascending: false }),
  ]);
  if (!orc) notFound();
  const o = orc as Orcamento;
  const versoes = (vs ?? []) as Versao[];
  const v = versaoEmFoco(versoes, Number(versao) || undefined);
  if (!v) notFound();
  const rascunho = versoes.find((x) => x.status === "rascunho");
  const aberto = o.status === "rascunho" || o.status === "enviado";
  const editavel = podeCriar && v.status === "rascunho";

  const [{ data: its }, catalogo, motivos, pendencias, unidades, { data: ultimos }, validadeCfg, espacos, { data: rs }] = await Promise.all([
    supabase.from("orcamento_itens").select("*").eq("versao_id", v.id).order("ordem").order("descricao"),
    supabase.from("catalogo_itens").select("*").order("categoria").order("ordem").order("nome"),
    v.status === "rascunho" ? supabase.rpc("motivos_aprovacao", { p_versao: v.id }) : Promise.resolve({ data: [] }),
    v.status === "rascunho" ? supabase.rpc("pendencias_orcamento", { p_versao: v.id }) : Promise.resolve({ data: [] }),
    carregarUnidades(supabase),
    supabase.from("ultimo_preco_catalogo").select("catalogo_item_id, preco_unitario_centavos"),
    supabase.from("configuracoes").select("valor").eq("chave", "orcamento.validade_dias").maybeSingle(),
    supabase.from("recursos").select("id, nome, capacidade").eq("tipo", "espaco").eq("ativo", true).order("capacidade"),
    supabase.from("reservas").select("id, status, evento_inicio, evento_fim, expira_em").eq("orcamento_id", id).order("criado_em", { ascending: false }),
  ]);
  const reservas = (rs ?? []) as { id: string; status: StatusReserva; evento_inicio: string; evento_fim: string; expira_em: string | null }[];
  const reservaAtiva = reservas.find((r) => ["bloqueio_temporario", "confirmada", "em_preparacao", "realizada"].includes(r.status));
  const ultimaReserva = reservaAtiva ?? reservas[0];
  const itens = (its ?? []) as ItemOrcamento[];
  const custos =
    verCusto && itens.length
      ? await supabase.from("orcamento_itens_custos").select("item_id, custo_unitario_centavos").in("item_id", itens.map((i) => i.id))
      : { data: [] as { item_id: string; custo_unitario_centavos: number }[] };
  const custoPorItem = new Map((custos.data ?? []).map((c) => [c.item_id, c.custo_unitario_centavos]));
  const todosCatalogo = (catalogo.data ?? []) as ItemCatalogo[];
  const rapido = editavel ? await dadosOrcamentoRapido(supabase) : null;
  const catalogoPorId = new Map(todosCatalogo.map((c) => [c.id, c]));
  // Texto automático da apresentação, para mostrar no campo enquanto ninguém escreveu um próprio.
  const conteudoParaTexto = {
    orcamento: { numero: o.numero, titulo: o.titulo, tipo: o.tipo, data_evento: o.data_evento, horario: o.horario, convidados: o.convidados,
                 local_externo: o.local_externo, espaco: o.recursos?.nome ?? null },
    itens: itens.map((i) => ({ ...i, quantidade: Number(i.quantidade), categoria: i.catalogo_item_id ? catalogoPorId.get(i.catalogo_item_id)?.categoria ?? null : null })),
  } as unknown as ConteudoOrcamento;
  const motivosLista = (motivos.data ?? []) as string[];
  const pendenciasLista = (pendencias.data ?? []) as string[];
  const mapaUnidades = mapaDeUnidades(unidades);
  const ultimoPreco = new Map((ultimos ?? []).map((u) => [u.catalogo_item_id as string, Number(u.preco_unitario_centavos)]));
  const podeDescontar = pode(acesso, "desconto.dar") || pode(acesso, "desconto.aprovar");
  const brutoTotal = itens.reduce((s, i) => s + Number(i.bruto_centavos), 0);
  const descontosItens = itens.reduce((s, i) => s + Number(i.desconto_centavos), 0);
  const precisaAprovar = motivosLista.length > 0 && !v.aprovado_por;
  const custoTotal = itens.reduce((s, i) => s + (custoPorItem.has(i.id) ? totalItem(Number(i.quantidade), custoPorItem.get(i.id)!) : 0), 0);
  // margem só sobre os itens que têm custo: comparar com o total geral superestimaria a margem
  const totalComCusto = itens.filter((i) => custoPorItem.has(i.id)).reduce((s, i) => s + Number(i.total_centavos), 0);
  const itensSemCusto = itens.filter((i) => !custoPorItem.has(i.id)).length;
  const m = margem(totalComCusto - (v.desconto_centavos && totalComCusto ? Math.round((v.desconto_centavos * totalComCusto) / Math.max(v.subtotal_centavos, 1)) : 0), custoTotal);
  const diasValidade = Number(validadeCfg.data?.valor ?? 7);
  const validadePadrao = new Date(Date.parse(`${hojeNaDelta()}T12:00:00Z`) + diasValidade * 86400000).toISOString().slice(0, 10);
  const whatsapp = linkWhatsApp(o.clientes.telefone);

  return (
    <>
      <div className="cabecalho">
        <div>
          <p style={{ margin: 0 }}><Link href="/orcamentos">← Orçamentos</Link></p>
          <h1>{o.titulo}</h1>
          <p>
            <Link href={`/clientes/${o.clientes.id}`}>{o.clientes.nome}</Link> · {o.numero} ·{" "}
            <span className={STATUS_ORCAMENTO[o.status].classe}>{STATUS_ORCAMENTO[o.status].rotulo}</span>
          </p>
          <p className="mudo" style={{ marginTop: 2 }}>
            {TIPOS_ORCAMENTO[o.tipo]}
            {o.data_evento && ` · ${formatarDataComDia(o.data_evento)}`}
            {o.horario && ` · ${o.horario}`}
            {o.convidados && ` · ${o.convidados} convidados`}
            {o.recursos?.nome && ` · ${o.recursos.nome}`}
            {o.local_externo && ` · ${o.local_externo}`}
          </p>
        </div>
        <div className="linha" style={{ alignItems: "center" }}>
          <a className="botao secundario" href={`/orcamentos/${o.id}/pdf?versao=${v.numero}`} target="_blank" rel="noreferrer">
            {v.status === "rascunho" ? "Prévia da proposta" : "Proposta (PDF)"}
          </a>
          <a href={`/orcamentos/${o.id}/pdf?versao=${v.numero}&formato=detalhado`} target="_blank" rel="noreferrer" style={{ fontSize: ".85rem" }}>
            PDF detalhado (itens e preços)
          </a>
        </div>
      </div>

      {enviado && (
        <p className="aviso ok">
          Versão {v.numero} enviada e congelada. Baixe o PDF e mande ao cliente
          {whatsapp && <> pelo <a href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a></>}. Criei uma tarefa de retorno.
        </p>
      )}
      {erro && <p className="aviso erro">{erro}</p>}
      {o.status === "perdido" && <p className="aviso erro">Perdido: {o.motivo_perda}</p>}
      {v.status !== "rascunho" && rascunho && (
        <p className="aviso info">
          Você está vendo a versão {v.numero}, que não muda mais. <Link href={`/orcamentos/${o.id}?versao=${rascunho.numero}`}>Continuar editando a versão {rascunho.numero}</Link>.
        </p>
      )}

      <div className="painel-lateral">
        <div>
          <section className="cartao">
            <h2>
              Itens · versão {v.numero} <span className={STATUS_VERSAO[v.status].classe} style={{ fontFamily: "var(--sans)" }}>{STATUS_VERSAO[v.status].rotulo}</span>
            </h2>
            <div className="tabela-rolavel">
            <table className="tabela-itens">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="numero">Qtd.</th>
                  <th className="numero">Unitário</th>
                  <th className="numero">Desconto</th>
                  <th className="numero">Total</th>
                  {verCusto && <th className="numero" title="Restrito: não aparece para o cliente">Custo</th>}
                  {editavel && <th />}
                </tr>
              </thead>
              <tbody>
                {itens.length === 0 && (
                  <tr><td colSpan={7} className="mudo">Nenhum item ainda. Inclua abaixo: do catálogo, por modelo ou personalizado.</td></tr>
                )}
                {itens.map((i) => {
                  const cat = i.catalogo_item_id ? catalogoPorId.get(i.catalogo_item_id) : undefined;
                  return (
                    <LinhaItem
                      key={`${i.id}-${i.preco_unitario_centavos}-${i.quantidade}-${i.desconto_centavos}-${custoPorItem.get(i.id) ?? ""}`}
                      editavel={editavel}
                      verCusto={verCusto}
                      podeDescontar={podeDescontar}
                      item={{
                        id: i.id,
                        descricao: i.descricao,
                        detalhe: i.detalhe,
                        categoria: i.categoria ?? cat?.categoria ?? null,
                        unidade: i.unidade,
                        unidadeRotulo: rotuloDaUnidade(i.unidade, Number(i.quantidade), mapaUnidades),
                        equivalencia: equivalencia(i.unidade, Number(i.quantidade), mapaUnidades),
                        quantidade: Number(i.quantidade),
                        preco_unitario_centavos: i.preco_unitario_centavos == null ? null : Number(i.preco_unitario_centavos),
                        desconto_centavos: Number(i.desconto_centavos),
                        bruto_centavos: Number(i.bruto_centavos),
                        total_centavos: Number(i.total_centavos),
                        custo_unitario_centavos: custoPorItem.get(i.id) ?? null,
                        faixa: cat ? precoDoItem(cat) : null,
                        ultimo_preco: i.catalogo_item_id ? ultimoPreco.get(i.catalogo_item_id) ?? null : null,
                      }}
                    />
                  );
                })}
              </tbody>
              <tbody>
                {descontosItens > 0 && (
                  <>
                    <tr><td colSpan={4}>Valor dos itens</td><td className="numero">{formatarCentavos(brutoTotal)}</td></tr>
                    <tr><td colSpan={4}>Descontos nos itens</td><td className="numero">- {formatarCentavos(descontosItens)}</td></tr>
                  </>
                )}
                {v.desconto_centavos > 0 && (
                  <>
                    <tr><td colSpan={4}>Subtotal</td><td className="numero">{formatarCentavos(v.subtotal_centavos)}</td></tr>
                    <tr><td colSpan={4}>Desconto no total</td><td className="numero">- {formatarCentavos(v.desconto_centavos)}</td></tr>
                  </>
                )}
                <tr className="total-linha">
                  <td colSpan={4}>Total{pendenciasLista.length > 0 && <span className="selo alerta" style={{ marginLeft: 8 }}>{pendenciasLista.length} preço(s) pendente(s)</span>}</td>
                  <td className="numero">{formatarCentavos(v.total_centavos)}</td>
                  {verCusto && <td className="numero mudo">{formatarCentavos(custoTotal)}</td>}
                  {editavel && <td />}
                </tr>
              </tbody>
            </table>
            </div>
            {verCusto && itens.length > 0 && (
              <p style={{ marginBottom: 0 }}>
                <span className="selo dourado">restrito</span>{" "}
                Lucro bruto estimado: <strong>{formatarCentavos(m.valor)}</strong> ({m.percentual.toFixed(1).replace(".", ",")}% de margem)
                {itensSemCusto > 0 && <span className="mudo"> · calculado só sobre os itens com custo; {itensSemCusto} {itensSemCusto === 1 ? "item está" : "itens estão"} sem custo</span>}
              </p>
            )}
            {editavel && rapido && (
              <MontagemRapida
                versaoId={v.id}
                opcoes={rapido.opcoes}
                modelos={rapido.modelos}
                convidados={o.convidados}
                recursoId={o.recurso_id}
                totalAtual={v.total_centavos}
                unidades={unidades}
                externo={o.tipo === "buffet_externo"}
                aberto={itens.length === 0}
              />
            )}
            {editavel && (
              <details style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--borda)" }}>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>Incluir um item de cada vez (do catálogo ou personalizado)</summary>
                <div style={{ marginTop: 10 }}>
                <NovoItem
                  key={itens.length}
                  versaoId={v.id}
                  catalogo={ordenarCatalogo(todosCatalogo.filter((c) => c.ativo), ordemCategoria).map((c) => ({
                    grupo: (CATEGORIAS[c.categoria] ?? c.categoria) + (c.subgrupo ? ` · ${c.subgrupo}` : ""),
                    id: c.id,
                    nome: c.nome,
                    unidade: c.unidade,
                    descricao: c.descricao,
                    preco_sugerido: precoSugerido(c),
                    faixa: precoDoItem(c),
                    ultimo_preco: ultimoPreco.get(c.id) ?? null,
                  }))}
                  unidades={unidades.filter((u) => u.ativo)}
                />
                </div>
              </details>
            )}
          </section>

          <section className="cartao">
            <h2>Condições</h2>
            {editavel ? (
              <FormularioCondicoes
                key={v.id}
                versaoId={v.id}
                desconto={v.desconto_centavos}
                condicoes={v.condicoes}
                observacoes={v.observacoes}
                apresentacao={v.apresentacao}
                apresentacaoPadrao={apresentacaoPadrao(conteudoParaTexto)}
                podeDescontar={podeDescontar}
              />
            ) : (
              <>
                <p style={{ whiteSpace: "pre-wrap", marginTop: 0 }}>{v.condicoes || <span className="mudo">Sem condições informadas.</span>}</p>
                {v.observacoes && <p style={{ whiteSpace: "pre-wrap" }}><span className="mudo">Observações: </span>{v.observacoes}</p>}
              </>
            )}
          </section>

          {podeCriar && aberto && (
            <section className="cartao">
              <details>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>Editar dados do evento</summary>
                <div style={{ marginTop: 14 }}>
                  <FormularioEvento
                    acao={salvarCabecalho}
                    espacos={espacos.data ?? []}
                    textoBotao="Salvar dados do evento"
                    evento={{
                      id: o.id, titulo: o.titulo, tipo: o.tipo, data_evento: o.data_evento, horario: o.horario,
                      convidados: o.convidados, recurso_id: o.recurso_id, local_externo: o.local_externo,
                    }}
                  />
                </div>
              </details>
            </section>
          )}
        </div>

        <aside>
          <section className="cartao">
            <h2>Próximo passo</h2>
            {v.status === "rascunho" && editavel && (
              <>
                {pendenciasLista.length > 0 && (
                  <div className="aviso alerta">
                    <strong>Falta definir antes de enviar</strong>
                    <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{pendenciasLista.map((x) => <li key={x}>{x}</li>)}</ul>
                  </div>
                )}
                {motivosLista.length > 0 && (
                  <div className={v.aprovado_por ? "aviso ok" : "aviso info"}>
                    <strong>{v.aprovado_por ? "Condições aprovadas" : "Precisa de aprovação"}</strong>
                    <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{motivosLista.map((x) => <li key={x}>{x}</li>)}</ul>
                    {v.aprovado_por && (
                      <p style={{ margin: "6px 0 0" }}>Em {formatarDataHora(v.aprovado_em)}: {v.aprovacao_justificativa}</p>
                    )}
                  </div>
                )}
                {precisaAprovar && (pode(acesso, "desconto.aprovar")
                  ? <FormularioAprovacao versaoId={v.id} />
                  : <p className="mudo">Peça a um administrador para abrir este orçamento e aprovar.</p>)}
                {itens.length === 0 ? (
                  <p className="mudo">Inclua os itens para poder enviar.</p>
                ) : (
                  <div style={{ marginTop: 12 }}>
                    <FormularioEnvio versaoId={v.id} validadePadrao={validadePadrao} bloqueado={precisaAprovar || pendenciasLista.length > 0} />
                  </div>
                )}
              </>
            )}
            {v.status === "rascunho" && !editavel && <p className="mudo">Versão em elaboração.</p>}

            {v.status === "enviada" && (
              <>
                <p style={{ marginTop: 0 }}>
                  Enviada em {formatarDataHora(v.enviada_em)}.<br />
                  Válida até <strong>{formatarData(v.validade)}</strong>
                  {v.validade && v.validade < hojeNaDelta() && <span className="selo erro"> vencida</span>}.
                </p>
                {podeCriar && <FormularioAceite versaoId={v.id} />}
                {podeCriar && !rascunho && (
                  <form action={criarNovaVersao} style={{ marginTop: 12 }}>
                    <input type="hidden" name="orcamento_id" value={o.id} />
                    <button className="botao secundario pequeno">Cliente pediu mudança: criar versão {v.numero + 1}</button>
                  </form>
                )}
              </>
            )}
            {v.status === "aprovada" && (
              <p style={{ marginTop: 0 }}>
                Aceita pelo cliente em {formatarDataHora(v.aceita_em)}. O contrato sai da página da reserva.
              </p>
            )}
            {v.status === "substituida" && <p className="mudo" style={{ marginTop: 0 }}>Esta versão foi substituída por uma mais nova.</p>}

            {podeCriar && aberto && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--borda)" }}>
                <FormularioPerda orcamentoId={o.id} />
              </div>
            )}
          </section>

          {(ultimaReserva || (podeCriar && o.status !== "perdido")) && (
            <section className="cartao" id="data-do-evento">
              <h2>Data do evento</h2>
              {ultimaReserva && (
                <p style={{ marginTop: 0 }}>
                  <Link href={`/reservas/${ultimaReserva.id}`}>{descreverPeriodo(ultimaReserva.evento_inicio, ultimaReserva.evento_fim)}</Link>
                  <br />
                  <span className={STATUS_RESERVA[ultimaReserva.status].classe}>{STATUS_RESERVA[ultimaReserva.status].rotulo}</span>
                  {ultimaReserva.status === "bloqueio_temporario" && <span className="mudo"> até {formatarDataHora(ultimaReserva.expira_em)}</span>}
                </p>
              )}
              {!reservaAtiva && podeCriar && o.status !== "perdido" && (
                <details open={!ultimaReserva}>
                  <summary style={{ cursor: "pointer", fontWeight: 600 }}>{ultimaReserva ? "Reservar outra data" : "Reservar a data"}</summary>
                  <div style={{ marginTop: 10 }}>
                    <FormularioReservarData
                      orcamentoId={o.id}
                      espacos={espacos.data ?? []}
                      externo={o.tipo === "buffet_externo"}
                      dataInicial={o.data_evento ?? ""}
                      espacoInicial={o.recurso_id}
                    />
                  </div>
                </details>
              )}
            </section>
          )}

          <section className="cartao">
            <h2>Versões</h2>
            <table>
              <tbody>
                {versoes.map((x) => (
                  <tr key={x.id} style={x.id === v.id ? { background: "var(--marfim-alt)" } : undefined}>
                    <td style={{ whiteSpace: "nowrap" }}><Link href={`/orcamentos/${o.id}?versao=${x.numero}`}>Versão {x.numero}</Link></td>
                    <td><span className={STATUS_VERSAO[x.status].classe}>{STATUS_VERSAO[x.status].rotulo}</span></td>
                    <td className="numero">{formatarCentavos(x.total_centavos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {v.conteudo_hash && (
              <p className="mudo" style={{ fontSize: ".75rem", wordBreak: "break-all", marginBottom: 0 }}>
                Impressão digital da versão {v.numero}: {v.conteudo_hash.slice(0, 32)}
              </p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
