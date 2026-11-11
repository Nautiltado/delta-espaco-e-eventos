import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { exigirPermissao } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarCentavos } from "@/lib/dinheiro";
import { formatarData, formatarDataHora, hojeNaDelta, instanteAtual } from "@/lib/datas";
import { linkWhatsApp } from "@/lib/documentos";
import { payloadPix } from "@/lib/pix";
import { descreverPeriodo, FORMAS_ASSINATURA, FORMAS_PAGAMENTO, INICIATIVAS, STATUS_CONTRATO, STATUS_RESERVA } from "@/lib/reservas";
import { lerConfiguracoes, type Contrato, type Pagamento, type ParcelaSituacao, type Reserva } from "@/lib/reserva-dados";
import { confirmarReserva, liberarBloqueio, prorrogarBloqueio, removerBloqueio } from "../actions";
import { EnviarComprovantes, RemoverComprovante } from "../comprovantes";
import { tamanhoLegivel } from "@/lib/comprovantes";
import {
  BotaoAcao,
  CopiarPix,
  FormularioAssinatura,
  FormularioCancelamento,
  FormularioEstorno,
  FormularioGerarContrato,
  FormularioPagamento,
  type Calculo,
} from "../componentes";

export const metadata: Metadata = { title: "Reserva" };

const AVISOS: Record<string, string> = {
  prorrogada: "Prazo da data segura prorrogado.",
  liberada: "Data liberada: o horário voltou para a agenda.",
  contrato: "Contrato gerado. Baixe o PDF, colha as assinaturas e registre aqui.",
  assinatura: "Assinatura registrada.",
  pagamento: "Pagamento registrado.",
  estorno: "Estorno registrado.",
  confirmada: "Reserva confirmada. Criei a tarefa de cobrar o saldo.",
  cancelada: "Reserva cancelada. As tarefas de devolução ou cobrança foram criadas.",
  bloqueio_removido: "Bloqueio removido: o horário voltou para a agenda.",
};

function Passo({ feito, children }: { feito: boolean; children: React.ReactNode }) {
  return (
    <li style={{ listStyle: "none", margin: "0 0 6px", display: "flex", gap: 8 }}>
      <span aria-hidden style={{ color: feito ? "var(--esmeralda)" : "var(--grafite-suave)", fontWeight: 700 }}>{feito ? "✓" : "○"}</span>
      <span>{children}</span>
    </li>
  );
}

export default async function PaginaReserva({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ segura?: string; aviso?: string }>;
}) {
  const acesso = await exigirPermissao("orcamento.ver");
  const { id } = await params;
  const { segura, aviso } = await searchParams;
  const textoAviso = aviso ? AVISOS[aviso] : undefined;
  const supabase = await criarClienteServidor();

  const { data: r } = await supabase.from("reservas").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();
  const reserva = r as Reserva;

  const [{ data: orc }, { data: periodos }, { data: cs }, { data: ps }, cfg] = await Promise.all([
    reserva.orcamento_id
      ? supabase.from("orcamentos").select("id, numero, titulo, status, convidados, clientes(id, nome, telefone, documento, endereco)").eq("id", reserva.orcamento_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("reserva_periodos").select("periodo, ativo, recursos(nome)").eq("reserva_id", id),
    supabase.from("contratos").select("*").eq("reserva_id", id).order("versao", { ascending: false }),
    supabase.from("parcelas_situacao").select("*").eq("reserva_id", id).order("numero"),
    lerConfiguracoes(supabase, ["empresa."]),
  ]);
  const o = orc as unknown as {
    id: string; numero: string; titulo: string; status: string; convidados: number | null;
    clientes: { id: string; nome: string; telefone: string | null; documento: string | null; endereco: string | null };
  } | null;
  const contratos = (cs ?? []) as Contrato[];
  const parcelas = ((ps ?? []) as ParcelaSituacao[]).map((p) => ({
    ...p, valor_centavos: Number(p.valor_centavos), pago_centavos: Number(p.pago_centavos), saldo_centavos: Number(p.saldo_centavos),
  }));
  const { data: gs } = parcelas.length
    ? await supabase.from("pagamentos").select("*").in("parcela_id", parcelas.map((p) => p.parcela_id)).order("confirmado_em")
    : { data: [] };
  const pagamentos = ((gs ?? []) as Pagamento[]).map((g) => ({ ...g, valor_centavos: Number(g.valor_centavos) }));
  const espacos = [...new Set(((periodos ?? []) as unknown as { recursos: { nome: string } | null }[]).map((p) => p.recursos?.nome).filter(Boolean))];

  const hoje = hojeNaDelta();
  const ativa = ["bloqueio_temporario", "expirada", "confirmada", "em_preparacao"].includes(reserva.status);
  const aceitaPagamento = ativa || reserva.status === "realizada";
  const vigente = contratos.find((c) => ["enviado", "assinado"].includes(c.status));
  const assinado = contratos.find((c) => c.status === "assinado");
  const entradaPaga = parcelas[0] ? parcelas[0].saldo_centavos <= 0 : false;
  const totalPago = parcelas.reduce((s, p) => s + p.pago_centavos, 0);
  const total = Number(reserva.valor_total_centavos ?? 0);
  const restanteMs = reserva.expira_em ? Date.parse(reserva.expira_em) - instanteAtual() : 0;
  const horasRestantes = Math.max(0, Math.floor(restanteMs / 3600000));

  // Pix copia e cola por parcela em aberto (só com a chave cadastrada).
  const chavePix = String(cfg["empresa.pix_chave"] ?? "").trim();
  const pix = new Map<string, { codigo: string; svg: string }>();
  if (chavePix && aceitaPagamento && o) {
    for (const p of parcelas.filter((x) => x.saldo_centavos > 0)) {
      const codigo = payloadPix({
        chave: chavePix,
        nome: String(cfg["empresa.razao_social"] ?? "Delta"),
        cidade: String(cfg["empresa.cidade"] ?? "Bacabal"),
        valorCentavos: p.saldo_centavos,
        identificador: `${o.numero}P${p.numero}`,
      });
      pix.set(p.parcela_id, { codigo, svg: await QRCode.toString(codigo, { type: "svg", margin: 1, width: 168 }) });
    }
  }

  const podeCancelar = pode(acesso, "reserva.cancelar") && reserva.tipo === "evento" && ativa;
  const calculos: Record<string, Calculo> = {};
  if (podeCancelar) {
    const rs = await Promise.all(
      Object.keys(INICIATIVAS).map((k) => supabase.rpc("calcular_cancelamento", { p_reserva: id, p_iniciativa: k })),
    );
    Object.keys(INICIATIVAS).forEach((k, i) => {
      const d = rs[i].data as Calculo | null;
      if (d) calculos[k] = d;
    });
  }
  const whatsapp = linkWhatsApp(o?.clientes.telefone);

  // Comprovantes (só para quem cuida do financeiro): endereços temporários de 1 hora para abrir.
  type Comprovante = { id: string; caminho: string; nome_arquivo: string; tipo: string; tamanho: number; descricao: string | null;
    pagamento_id: string | null; enviado_em: string; removido_em: string | null; removido_motivo: string | null; usuarios: { nome: string } | null };
  const verComprovantes = pode(acesso, "pagamento.confirmar") && reserva.tipo === "evento";
  let comprovantes: (Comprovante & { url: string | null })[] = [];
  if (verComprovantes) {
    const { data: cs2 } = await supabase.from("comprovantes")
      .select("id, caminho, nome_arquivo, tipo, tamanho, descricao, pagamento_id, enviado_em, removido_em, removido_motivo, usuarios:enviado_por(nome)")
      .eq("reserva_id", id).order("enviado_em");
    const lista = (cs2 ?? []) as unknown as Comprovante[];
    const ativos = lista.filter((c) => !c.removido_em);
    const { data: urls } = ativos.length
      ? await supabase.storage.from("comprovantes").createSignedUrls(ativos.map((c) => c.caminho), 3600)
      : { data: [] };
    const porCaminho = new Map((urls ?? []).map((u) => [u.path, u.signedUrl]));
    comprovantes = lista.map((c) => ({ ...c, url: c.removido_em ? null : porCaminho.get(c.caminho) ?? null }));
  }
  const rotuloPagamento = (g: Pagamento) =>
    `${formatarData(g.recebido_em)} · ${FORMAS_PAGAMENTO[g.forma] ?? g.forma} · ${formatarCentavos(g.valor_centavos)}`;

  if (reserva.tipo === "bloqueio_administrativo") {
    return (
      <>
        <div className="cabecalho">
          <div>
            <p style={{ margin: 0 }}><Link href="/agenda">← Agenda</Link></p>
            <h1>Agenda bloqueada</h1>
            <p>{espacos.join(" e ")} · {descreverPeriodo(reserva.evento_inicio, reserva.evento_fim)}</p>
          </div>
        </div>
        {textoAviso && <p className="aviso ok" role="status">{textoAviso}</p>}
        <section className="cartao">
          <p style={{ marginTop: 0 }}>Motivo: {reserva.motivo}</p>
          {reserva.status === "confirmada" && pode(acesso, "bloqueio.remover") && (
            <BotaoAcao acao={removerBloqueio} campos={{ reserva_id: id }} texto="Remover bloqueio" classe="botao secundario" />
          )}
          {reserva.status === "cancelada" && <p className="selo erro">Removido</p>}
        </section>
      </>
    );
  }

  return (
    <>
      <div className="cabecalho">
        <div>
          <p style={{ margin: 0 }}><Link href="/agenda">← Agenda</Link></p>
          <h1>{reserva.titulo}</h1>
          <p>
            {o && <><Link href={`/clientes/${o.clientes.id}`}>{o.clientes.nome}</Link> · <Link href={`/orcamentos/${o.id}`}>{o.numero}</Link> · </>}
            <span className={STATUS_RESERVA[reserva.status].classe}>{STATUS_RESERVA[reserva.status].rotulo}</span>
          </p>
          <p className="mudo" style={{ marginTop: 2 }}>
            {descreverPeriodo(reserva.evento_inicio, reserva.evento_fim)}
            {espacos.length > 0 && ` · ${espacos.join(" e ")}`}
            {o?.convidados && ` · ${o.convidados} convidados`}
            {total > 0 && ` · ${formatarCentavos(total)}`}
          </p>
        </div>
        {reserva.tipo === "evento" && ["bloqueio_temporario", "confirmada", "em_preparacao", "realizada"].includes(reserva.status) && (
          <div className="linha"><Link className="botao secundario" href={`/eventos/${reserva.id}`}>Ficha, equipe e gastos</Link></div>
        )}
      </div>

      {textoAviso && <p className="aviso ok" role="status">{textoAviso}</p>}
      {segura && reserva.status === "bloqueio_temporario" && (
        <p className="aviso ok">Data segura até {formatarDataHora(reserva.expira_em)}. Agora gere o contrato e cobre a entrada.</p>
      )}
      {reserva.status === "expirada" && (
        <p className="aviso erro">
          O prazo para fechar terminou e a data voltou a ficar livre. Se o cliente ainda quer, siga normalmente: ao confirmar, o sistema confere se ninguém ocupou a data.
        </p>
      )}
      {reserva.status === "cancelada" && reserva.cancelamento?.iniciativa === "liberacao" && (
        <p className="aviso info">Data liberada em {formatarDataHora(reserva.cancelada_em)}, antes de contrato assinado ou pagamento.</p>
      )}
      {reserva.status === "cancelada" && reserva.cancelamento && reserva.cancelamento.iniciativa !== "liberacao" && (
        <p className="aviso erro">
          Cancelada em {formatarDataHora(reserva.cancelada_em)}
          {typeof reserva.cancelamento.iniciativa === "string" && INICIATIVAS[reserva.cancelamento.iniciativa] ? ` (${INICIATIVAS[reserva.cancelamento.iniciativa]})` : ""}
          {typeof reserva.cancelamento.motivo === "string" ? `: ${reserva.cancelamento.motivo}` : ""}.
          {Number(reserva.cancelamento.multa_centavos ?? 0) > 0 && ` Multa: ${formatarCentavos(Number(reserva.cancelamento.multa_centavos))}.`}
          {Number(reserva.cancelamento.devolver_centavos ?? 0) > 0 && ` Devolver: ${formatarCentavos(Number(reserva.cancelamento.devolver_centavos))}.`}
          {Number(reserva.cancelamento.cobrar_centavos ?? 0) > 0 && ` Cobrar: ${formatarCentavos(Number(reserva.cancelamento.cobrar_centavos))}.`}
        </p>
      )}

      <div className="painel-lateral">
        <div>
          <section className="cartao">
            <h2>Contrato</h2>
            {contratos.length === 0 && <p className="mudo" style={{ marginTop: 0 }}>Nenhum contrato gerado ainda.</p>}
            {vigente && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ marginTop: 0 }}>
                  <strong>Nº {vigente.conteudo?.numero ?? `v${vigente.versao}`}</strong>{" "}
                  <span className={STATUS_CONTRATO[vigente.status].classe}>{STATUS_CONTRATO[vigente.status].rotulo}</span>
                  <br />
                  <span className="mudo">
                    Gerado em {formatarDataHora(vigente.criado_em)} · modelo v{vigente.modelo_versao} ·{" "}
                    {vigente.conteudo?.canal === "fora_estabelecimento" ? "fechado à distância" : "fechado na Delta"}
                  </span>
                </p>
                <p>
                  <a className="botao secundario pequeno" href={`/reservas/${id}/contrato?versao=${vigente.versao}`} target="_blank" rel="noreferrer">PDF do contrato</a>
                  {whatsapp && <> <a className="botao secundario pequeno" href={whatsapp} target="_blank" rel="noreferrer">WhatsApp do cliente</a></>}
                </p>
                {assinado && (
                  <p className="mudo">
                    Assinado em {formatarData(assinado.assinado_em?.slice(0, 10))} ({FORMAS_ASSINATURA[assinado.assinatura_forma ?? ""] ?? assinado.assinatura_forma})
                    {assinado.assinatura_obs && ` · ${assinado.assinatura_obs}`}
                  </p>
                )}
                {vigente.status === "enviado" && pode(acesso, "contrato.gerar") && ativa && (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: "pointer", fontWeight: 600 }}>Registrar assinatura</summary>
                    <div style={{ marginTop: 10 }}><FormularioAssinatura contratoId={vigente.id} hoje={hoje} /></div>
                  </details>
                )}
                {vigente.conteudo_hash && (
                  <p className="mudo" style={{ fontSize: ".75rem", wordBreak: "break-all", marginBottom: 0 }}>Impressão digital: {vigente.conteudo_hash.slice(0, 32)}</p>
                )}
              </div>
            )}
            {pode(acesso, "contrato.gerar") && ativa && !assinado && (
              o?.status !== "aprovado" ? (
                <p className="aviso info">Para gerar o contrato, registre no <Link href={`/orcamentos/${o?.id}`}>orçamento</Link> o aceite do cliente.</p>
              ) : !o.clientes.documento || !o.clientes.endereco ? (
                <p className="aviso info">Complete o CPF/CNPJ e o endereço no <Link href={`/clientes/${o.clientes.id}`}>cadastro do cliente</Link> para gerar o contrato.</p>
              ) : (
                <details open={!vigente} style={{ marginTop: 6 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 600 }}>{vigente ? "Gerar nova versão (substitui a anterior)" : "Gerar contrato"}</summary>
                  <div style={{ marginTop: 10 }}><FormularioGerarContrato reservaId={id} regenerar={!!vigente} /></div>
                </details>
              )
            )}
            {contratos.length > 1 && (
              <table style={{ marginTop: 12 }}>
                <tbody>
                  {contratos.filter((c) => c.id !== vigente?.id).map((c) => (
                    <tr key={c.id}>
                      <td><a href={`/reservas/${id}/contrato?versao=${c.versao}`} target="_blank" rel="noreferrer">Versão {c.versao}</a></td>
                      <td><span className={STATUS_CONTRATO[c.status].classe}>{STATUS_CONTRATO[c.status].rotulo}</span></td>
                      <td className="mudo">{formatarDataHora(c.criado_em)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="cartao">
            <h2>Parcelas</h2>
            {parcelas.length === 0 ? (
              <p className="mudo" style={{ marginTop: 0 }}>As parcelas saem junto com o contrato.</p>
            ) : (
              <>
                {parcelas.map((p) => {
                  const pg = pix.get(p.parcela_id);
                  return (
                    <div key={p.parcela_id} style={{ borderBottom: "1px solid var(--borda)", padding: "10px 0" }} data-teste={`parcela-${p.numero}`}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div>
                          <strong>{parcelas.length === 1 ? "Parcela única" : p.numero === 1 ? "1ª parcela (entrada)" : `${p.numero}ª parcela (saldo)`}</strong>
                          <br />
                          <span className="mudo">{p.numero === 1 ? "Na assinatura" : `Vence ${formatarData(p.vencimento)}`}</span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <strong>{formatarCentavos(p.valor_centavos)}</strong>
                          <br />
                          {p.saldo_centavos <= 0 ? (
                            <span className="selo">Paga</span>
                          ) : p.pago_centavos > 0 ? (
                            <span className="selo dourado">Falta {formatarCentavos(p.saldo_centavos)}</span>
                          ) : p.numero > 1 && p.vencimento < hoje ? (
                            <span className="selo erro">Atrasada</span>
                          ) : (
                            <span className="selo cinza">Em aberto</span>
                          )}
                        </div>
                      </div>
                      {p.saldo_centavos > 0 && aceitaPagamento && (
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10 }}>
                          {pg && (
                            <div style={{ flex: "0 0 auto" }}>
                              <div dangerouslySetInnerHTML={{ __html: pg.svg }} aria-label="QR Code Pix" role="img" />
                            </div>
                          )}
                          <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                            {pg ? <CopiarPix codigo={pg.codigo} /> : (
                              <p className="mudo" style={{ marginTop: 0 }}>
                                Cadastre a chave Pix em <Link href="/configuracoes">Configurações</Link> para gerar o Pix copia e cola.
                              </p>
                            )}
                            {pode(acesso, "pagamento.confirmar") && (
                              <details style={{ marginTop: 10 }}>
                                <summary style={{ cursor: "pointer", fontWeight: 600 }}>Dar baixa</summary>
                                <div style={{ marginTop: 10 }}><FormularioPagamento parcelaId={p.parcela_id} saldo={p.saldo_centavos} hoje={hoje} /></div>
                              </details>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                <p style={{ marginBottom: 0 }}>Recebido: <strong>{formatarCentavos(totalPago)}</strong> de {formatarCentavos(parcelas.reduce((s, p) => s + p.valor_centavos, 0))}</p>
              </>
            )}
          </section>

          {pagamentos.length > 0 && (
            <section className="cartao">
              <h2>Lançamentos</h2>
              <table>
                <thead><tr><th>Data</th><th>Parcela</th><th>Forma</th><th className="numero">Valor</th></tr></thead>
                <tbody>
                  {pagamentos.map((g) => {
                    const parcela = parcelas.find((p) => p.parcela_id === g.parcela_id);
                    const estornado = pagamentos.filter((x) => x.estorno_de === g.id).reduce((s, x) => s + x.valor_centavos, 0);
                    return (
                      <tr key={g.id}>
                        <td style={{ whiteSpace: "nowrap" }}>{formatarData(g.recebido_em)}</td>
                        <td>{parcela?.numero}ª</td>
                        <td>
                          {g.tipo === "estorno" ? <span className="selo erro">Estorno</span> : FORMAS_PAGAMENTO[g.forma] ?? g.forma}
                          {g.id_externo && <div className="mudo" style={{ fontSize: ".75rem", wordBreak: "break-all" }}>{g.id_externo}</div>}
                          {(g.observacao || g.referencia) && g.tipo === "estorno" && <div className="mudo">{g.observacao}</div>}
                          {g.referencia && g.tipo === "recebimento" && <div className="mudo">{g.referencia}</div>}
                          {g.tipo === "recebimento" && pode(acesso, "pagamento.estornar") && g.valor_centavos - estornado > 0 && (
                            <details style={{ marginTop: 6 }}>
                              <summary style={{ cursor: "pointer", fontSize: ".85rem" }}>Estornar</summary>
                              <div style={{ marginTop: 6 }}><FormularioEstorno pagamentoId={g.id} maximo={g.valor_centavos - estornado} /></div>
                            </details>
                          )}
                        </td>
                        <td className="numero">{g.tipo === "estorno" ? "- " : ""}{formatarCentavos(g.valor_centavos)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}
          {verComprovantes && (
            <section className="cartao" id="comprovantes">
              <h2>Comprovantes {comprovantes.filter((c) => !c.removido_em).length > 0 && <span className="mudo" style={{ fontFamily: "var(--sans)", fontSize: ".85rem" }}>{comprovantes.filter((c) => !c.removido_em).length}</span>}</h2>
              {comprovantes.filter((c) => !c.removido_em).length === 0 && <p className="mudo" style={{ marginTop: 0 }}>Nenhum comprovante anexado ainda.</p>}
              <div className="comprovantes">
                {comprovantes.filter((c) => !c.removido_em).map((c) => {
                  const pg = pagamentos.find((g) => g.id === c.pagamento_id);
                  return (
                    <div key={c.id} className="comprovante">
                      <a href={c.url ?? "#"} target="_blank" rel="noreferrer" className="miniatura">
                        {c.tipo.startsWith("image/") && c.tipo !== "image/heic" && c.tipo !== "image/heif" && c.url
                          ? (
                            // Endereço assinado e temporário do armazenamento privado: não passa pelo otimizador de imagens.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.url} alt={`Comprovante ${c.nome_arquivo}`} loading="lazy" />
                          )
                          : <span>{c.tipo === "application/pdf" ? "PDF" : "Arquivo"}</span>}
                      </a>
                      <div style={{ minWidth: 0 }}>
                        <a href={c.url ?? "#"} target="_blank" rel="noreferrer" style={{ wordBreak: "break-word" }}>{c.nome_arquivo}</a>
                        <div className="mudo" style={{ fontSize: ".8rem" }}>
                          {formatarDataHora(c.enviado_em)}{c.usuarios ? ` · ${c.usuarios.nome}` : ""} · {tamanhoLegivel(c.tamanho)}
                        </div>
                        {pg && <div style={{ fontSize: ".85rem" }}>Pagamento: {rotuloPagamento(pg)}</div>}
                        {c.descricao && <div style={{ fontSize: ".85rem" }}>{c.descricao}</div>}
                        {pode(acesso, "pagamento.estornar") && <RemoverComprovante comprovanteId={c.id} />}
                      </div>
                    </div>
                  );
                })}
              </div>
              <details style={{ marginTop: 12 }} open={comprovantes.filter((c) => !c.removido_em).length === 0 && reserva.status === "realizada"}>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>Anexar comprovantes</summary>
                <div style={{ marginTop: 10 }}>
                  <EnviarComprovantes reservaId={id} pagamentos={pagamentos.filter((g) => g.tipo === "recebimento").map((g) => ({ id: g.id, rotulo: rotuloPagamento(g) }))} />
                </div>
              </details>
              {comprovantes.some((c) => c.removido_em) && (
                <details style={{ marginTop: 10 }}>
                  <summary className="mudo" style={{ cursor: "pointer", fontSize: ".85rem" }}>Tirados da lista ({comprovantes.filter((c) => c.removido_em).length})</summary>
                  <ul className="mudo" style={{ fontSize: ".85rem" }}>
                    {comprovantes.filter((c) => c.removido_em).map((c) => (
                      <li key={c.id}>{c.nome_arquivo} · tirado em {formatarDataHora(c.removido_em)}: {c.removido_motivo}</li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
          )}
        </div>

        <aside>
          <section className="cartao">
            <h2>Próximo passo</h2>
            <ul style={{ padding: 0, margin: "0 0 12px" }}>
              <Passo feito={reserva.status !== "expirada" && reserva.status !== "cancelada"}>
                Data segura
                {reserva.status === "bloqueio_temporario" && (
                  <span className="mudo"> · até {formatarDataHora(reserva.expira_em)} ({horasRestantes}h){reserva.prorrogacoes > 0 && `, prorrogada ${reserva.prorrogacoes}x`}</span>
                )}
              </Passo>
              <Passo feito={!!vigente}>Contrato gerado</Passo>
              <Passo feito={!!assinado}>Contrato assinado</Passo>
              <Passo feito={entradaPaga}>{parcelas.length === 1 ? "Pagamento integral recebido" : "Entrada recebida"}</Passo>
              <Passo feito={["confirmada", "em_preparacao", "realizada"].includes(reserva.status)}>Reserva confirmada</Passo>
            </ul>

            {["bloqueio_temporario", "expirada"].includes(reserva.status) && pode(acesso, "reserva.confirmar") && (
              assinado && entradaPaga ? (
                <BotaoAcao acao={confirmarReserva} campos={{ reserva_id: id }} texto="Confirmar a reserva" />
              ) : (
                <p className="mudo">Confirmar fica liberado com o contrato assinado e a entrada recebida.</p>
              )
            )}
            {reserva.status === "confirmada" && (
              <p style={{ marginTop: 0 }}>Confirmada em {formatarDataHora(reserva.confirmada_em)}.</p>
            )}
            {reserva.status === "realizada" && (
              <p style={{ marginTop: 0 }}>
                Evento realizado.{" "}
                {verComprovantes && (comprovantes.some((c) => !c.removido_em)
                  ? <a href="#comprovantes">Ver comprovantes</a>
                  : <a href="#comprovantes">Anexe os comprovantes de pagamento</a>)}
              </p>
            )}
            {["bloqueio_temporario", "expirada"].includes(reserva.status) && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--borda)" }}>
                {reserva.status === "bloqueio_temporario" && pode(acesso, "reserva.confirmar") && (
                  <BotaoAcao acao={prorrogarBloqueio} campos={{ reserva_id: id }} texto="Prorrogar mais 24 horas" classe="botao secundario pequeno" />
                )}
                {pode(acesso, "orcamento.criar") && !assinado && totalPago === 0 && (
                  <BotaoAcao acao={liberarBloqueio} campos={{ reserva_id: id }} texto="Liberar a data" classe="botao secundario pequeno"
                    ajuda="Use quando o cliente desistir antes de assinar e pagar." />
                )}
              </div>
            )}
          </section>

          {podeCancelar && (assinado || totalPago > 0) && (
            <section className="cartao">
              <details>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>Cancelar a reserva</summary>
                <div style={{ marginTop: 12 }}><FormularioCancelamento reservaId={id} calculos={calculos} /></div>
              </details>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
