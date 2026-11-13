"use client";

import { Retorno } from "@/componentes/avisos";

import { useActionState, useState } from "react";
import {
  adicionarItem,
  aprovarCondicoes,
  enviarVersao,
  marcarPerdido,
  registrarAceite,
  salvarCondicoes,
  salvarItem,
  type Estado,
} from "./actions";
import { centavosParaCampo, formatarCentavos, lerReais } from "@/lib/dinheiro";
import { CATEGORIAS, formatarQuantidade, lerQuantidade, margem, totalItem, TIPOS_ORCAMENTO } from "@/lib/orcamentos";



// ------------------------------------------------------------------ dados do evento

export type DadosEvento = {
  id?: string;
  titulo: string;
  tipo: string;
  data_evento: string | null;
  horario: string | null;
  convidados: number | null;
  recurso_id: string | null;
  local_externo: string | null;
};

export function FormularioEvento({
  acao,
  evento,
  espacos,
  clientes,
  clienteInicial,
  textoBotao,
}: {
  acao: (e: Estado, f: FormData) => Promise<Estado>;
  evento?: DadosEvento;
  espacos: { id: string; nome: string; capacidade: number | null }[];
  clientes?: { id: string; nome: string }[];
  clienteInicial?: string;
  textoBotao: string;
}) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(acao, {});
  const [tipo, setTipo] = useState(evento?.tipo ?? "espaco");
  const externo = tipo === "buffet_externo";
  return (
    <form action={enviar}>
      {evento?.id && <input type="hidden" name="id" value={evento.id} />}
      <Retorno estado={estado} />
      {clientes && (
        <div className="campo">
          <label htmlFor="cliente_id">Cliente</label>
          <select id="cliente_id" name="cliente_id" required defaultValue={clienteInicial ?? ""}>
            <option value="" disabled>Escolha o cliente…</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
      )}
      <div className="linha" style={{ marginBottom: 14 }}>
        <div className="campo" style={{ flex: 2 }}>
          <label htmlFor="titulo">Evento</label>
          <input id="titulo" name="titulo" type="text" required placeholder="Ex.: Aniversário de 15 anos da Ana"
            defaultValue={evento?.titulo} />
        </div>
        <div className="campo">
          <label htmlFor="tipo">Tipo</label>
          <select id="tipo" name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {Object.entries(TIPOS_ORCAMENTO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </div>
      </div>
      <div className="linha" style={{ marginBottom: 14 }}>
        <div className="campo">
          <label htmlFor="data_evento">Data do evento</label>
          <input id="data_evento" name="data_evento" type="date" defaultValue={evento?.data_evento ?? ""} />
        </div>
        <div className="campo">
          <label htmlFor="horario">Horário</label>
          <input id="horario" name="horario" type="text" placeholder="Ex.: 19h às 2h" defaultValue={evento?.horario ?? ""} />
        </div>
        <div className="campo">
          <label htmlFor="convidados">Convidados</label>
          <input id="convidados" name="convidados" type="text" inputMode="numeric" defaultValue={evento?.convidados ?? ""} />
        </div>
        {externo ? (
          <div className="campo" style={{ flex: 2 }}>
            <label htmlFor="local_externo">Local do evento</label>
            <input id="local_externo" name="local_externo" type="text" defaultValue={evento?.local_externo ?? ""} />
          </div>
        ) : (
          <div className="campo">
            <label htmlFor="recurso_id">Espaço</label>
            <select id="recurso_id" name="recurso_id" defaultValue={evento?.recurso_id ?? ""}>
              <option value="">A definir</option>
              {espacos.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}{e.capacidade ? ` (até ${e.capacidade})` : ""}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      <button className="botao" disabled={enviando}>{enviando ? "Salvando…" : textoBotao}</button>
    </form>
  );
}

// ------------------------------------------------------------------ itens

export type LinhaItemDados = {
  id: string;
  descricao: string;
  detalhe: string | null;
  categoria: string | null;
  unidade: string;
  unidadeRotulo: string;
  equivalencia: string | null;
  quantidade: number;
  /** null = pendente */
  preco_unitario_centavos: number | null;
  desconto_centavos: number;
  bruto_centavos: number;
  total_centavos: number;
  custo_unitario_centavos?: number | null;
  /** Referências para quem preenche (nunca aplicadas sozinhas). */
  faixa?: string | null;
  ultimo_preco?: number | null;
};

function Margem({ total, custo }: { total: number; custo: number | null }) {
  if (custo == null) return <span className="mudo">sem custo</span>;
  const m = margem(total, custo);
  const cls = m.valor < 0 ? "texto-erro" : m.percentual < 20 ? "texto-alerta" : "texto-sucesso";
  return <span className={cls}>{formatarCentavos(m.valor)} · {m.percentual.toFixed(0)}%</span>;
}

export function LinhaItem({ item, editavel, verCusto, podeDescontar }: {
  item: LinhaItemDados; editavel: boolean; verCusto: boolean; podeDescontar: boolean;
}) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(salvarItem, {});
  const pendente = item.preco_unitario_centavos === null;
  const custo = item.custo_unitario_centavos != null ? totalItem(item.quantidade, item.custo_unitario_centavos) : null;
  const categoria = item.categoria ? CATEGORIAS[item.categoria] ?? item.categoria : null;
  if (!editavel) {
    return (
      <tr className={pendente ? "item-pendente" : undefined}>
        <td>
          {item.descricao}
          {item.detalhe && <div className="mudo pequeno">{item.detalhe}</div>}
          {categoria && <div className="mudo pequeno">{categoria}</div>}
        </td>
        <td className="numero">
          {formatarQuantidade(item.quantidade)} {item.unidadeRotulo}
          {item.equivalencia && <div className="mudo pequeno">= {item.equivalencia}</div>}
        </td>
        <td className="numero">{pendente ? <span className="selo alerta">pendente</span> : formatarCentavos(item.preco_unitario_centavos!)}</td>
        <td className="numero">{item.desconto_centavos ? `- ${formatarCentavos(item.desconto_centavos)}` : "—"}</td>
        <td className="numero">{formatarCentavos(item.total_centavos)}</td>
        {verCusto && <td className="numero mudo">{custo != null ? formatarCentavos(custo) : "—"}<div className="pequeno"><Margem total={item.total_centavos} custo={custo} /></div></td>}
      </tr>
    );
  }
  const formId = `item-${item.id}`;
  return (
    <tr className={pendente ? "item-pendente" : undefined}>
      <td>
        <form id={formId} action={enviar}>
          <input type="hidden" name="id" value={item.id} />
        </form>
        <input form={formId} name="descricao" type="text" defaultValue={item.descricao} aria-label="Descrição" />
        <input form={formId} name="detalhe" type="text" defaultValue={item.detalhe ?? ""} aria-label="Descrição para o cliente"
          placeholder="Descrição para o cliente (opcional)" className="campo-detalhe" maxLength={500} />
        <div className="mudo pequeno">
          {categoria}
          {item.faixa && <>{categoria ? " · " : ""}Catálogo: {item.faixa}</>}
          {item.ultimo_preco != null && <> · último usado: {formatarCentavos(item.ultimo_preco)} (referência)</>}
        </div>
        <Retorno estado={estado.ok ? {} : estado} />
      </td>
      <td style={{ width: 96 }}>
        <input form={formId} name="quantidade" type="text" inputMode="decimal" aria-label="Quantidade"
          defaultValue={formatarQuantidade(item.quantidade)} />
        <div className="mudo pequeno">{item.unidadeRotulo}</div>
        {item.equivalencia && <div className="mudo pequeno" title="Equivalência da unidade de cobrança">= {item.equivalencia}</div>}
      </td>
      <td style={{ width: 120 }}>
        <input form={formId} name="preco" type="text" inputMode="decimal" aria-label="Preço unitário"
          defaultValue={pendente ? "" : centavosParaCampo(item.preco_unitario_centavos!)}
          placeholder="a definir" className={pendente ? "invalido" : undefined} />
        {pendente && <div className="pequeno texto-alerta">preço pendente</div>}
      </td>
      <td style={{ width: 104 }}>
        {podeDescontar ? (
          <input form={formId} name="desconto" type="text" inputMode="decimal" aria-label="Desconto no item"
            defaultValue={item.desconto_centavos ? centavosParaCampo(item.desconto_centavos) : ""} placeholder="0,00" disabled={pendente} />
        ) : (
          <span className="mudo">{item.desconto_centavos ? `- ${formatarCentavos(item.desconto_centavos)}` : "—"}</span>
        )}
      </td>
      <td className="numero">
        {formatarCentavos(item.total_centavos)}
        {item.desconto_centavos > 0 && <div className="mudo pequeno">de {formatarCentavos(item.bruto_centavos)}</div>}
      </td>
      {verCusto && (
        <td style={{ width: 120 }}>
          <input form={formId} name="custo" type="text" inputMode="decimal" aria-label="Custo unitário interno"
            defaultValue={item.custo_unitario_centavos != null ? centavosParaCampo(item.custo_unitario_centavos) : ""} placeholder="custo unit." />
          <div className="pequeno"><Margem total={item.total_centavos} custo={custo} /></div>
        </td>
      )}
      <td className="acoes">
        <button form={formId} className="botao secundario pequeno" disabled={enviando} title="Salvar alterações deste item">Salvar</button>{" "}
        <button form={formId} name="remover" value="1" className="botao secundario pequeno" disabled={enviando}
          aria-label={`Remover ${item.descricao}`}>×</button>
      </td>
    </tr>
  );
}

export type OpcaoCatalogo = {
  id: string;
  nome: string;
  unidade: string;
  descricao: string | null;
  preco_sugerido: number | null;
  faixa: string;
  grupo: string;
  ultimo_preco?: number | null;
};

export type OpcaoUnidade = { codigo: string; singular: string; plural: string; equivale_quantidade: number | null; equivale_unidade: string | null };

/** Use com key={quantidade de itens}: ao incluir um item, o formulário recomeça limpo; com erro, mantém o que foi digitado. */
export function NovoItem({ versaoId, catalogo, unidades }: { versaoId: string; catalogo: OpcaoCatalogo[]; unidades: OpcaoUnidade[] }) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(adicionarItem, {});
  const [escolha, setEscolha] = useState("");
  const [descricao, setDescricao] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [categoria, setCategoria] = useState("outro");
  const [unidade, setUnidade] = useState("unidade");
  const [preco, setPreco] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const selecionado = catalogo.find((c) => c.id === escolha);
  const q = lerQuantidade(quantidade);
  const p = preco.trim() ? lerReais(preco) : null;
  const u = unidades.find((x) => x.codigo === unidade);
  const eq = u?.equivale_quantidade && q ? `${formatarQuantidade(q * u.equivale_quantidade)} ${unidades.find((x) => x.codigo === u.equivale_unidade)?.plural ?? ""}` : null;

  function escolher(id: string) {
    setEscolha(id);
    const c = catalogo.find((x) => x.id === id);
    if (c) {
      setDescricao(c.nome);
      setDetalhe(c.descricao ?? "");
      setUnidade(c.unidade);
      setPreco(c.preco_sugerido === null ? "" : centavosParaCampo(c.preco_sugerido));
    } else {
      setDescricao("");
      setDetalhe("");
      setPreco("");
    }
  }

  return (
    <form action={enviar}>
      <input type="hidden" name="versao_id" value={versaoId} />
      <input type="hidden" name="catalogo_item_id" value={escolha} />
      <Retorno estado={estado} />
      <div className="linha">
        <div className="campo" style={{ flex: 2, minWidth: 200 }}>
          <label htmlFor="escolha">Do catálogo</label>
          <select id="escolha" value={escolha} onChange={(e) => escolher(e.target.value)}>
            <option value="">Item personalizado (fora do catálogo)</option>
            {[...new Set(catalogo.map((c) => c.grupo))].map((g) => (
              <optgroup key={g} label={g}>
                {catalogo.filter((c) => c.grupo === g).map((c) => <option key={c.id} value={c.id}>{c.nome} · {c.faixa}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="campo" style={{ flex: 2, minWidth: 200 }}>
          <label htmlFor="descricao-novo">Nome no orçamento</label>
          <input id="descricao-novo" name="descricao" type="text" required value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>
        {!selecionado && (
          <div className="campo" style={{ minWidth: 160 }}>
            <label htmlFor="categoria-novo">Categoria</label>
            <select id="categoria-novo" name="categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {Object.entries(CATEGORIAS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="campo" style={{ marginTop: 10 }}>
        <label htmlFor="detalhe-novo">Descrição para o cliente <span className="mudo">(opcional)</span></label>
        <input id="detalhe-novo" name="detalhe" type="text" value={detalhe} onChange={(e) => setDetalhe(e.target.value)} maxLength={500} />
      </div>
      <div className="linha" style={{ marginTop: 10 }}>
        <div className="campo">
          <label htmlFor="quantidade-novo">Quantidade</label>
          <input id="quantidade-novo" name="quantidade" type="text" inputMode="decimal" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
          {eq && <small className="mudo">= {eq}</small>}
        </div>
        <div className="campo">
          <label htmlFor="unidade-novo">Cobrado por</label>
          <select id="unidade-novo" name="unidade" value={unidade} onChange={(e) => setUnidade(e.target.value)} disabled={!!selecionado}>
            {unidades.map((x) => <option key={x.codigo} value={x.codigo}>{x.singular}</option>)}
          </select>
          {selecionado && <input type="hidden" name="unidade" value={unidade} />}
        </div>
        <div className="campo">
          <label htmlFor="preco-novo">Preço unitário (R$)</label>
          <input id="preco-novo" name="preco" type="text" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)}
            placeholder="em branco = pendente" />
          {selecionado?.ultimo_preco != null && <small className="mudo">Último usado: {formatarCentavos(selecionado.ultimo_preco)} (só referência)</small>}
        </div>
        <div className="campo" style={{ minWidth: 110 }}>
          <label>Total</label>
          <div style={{ padding: "9px 0", fontWeight: 600 }}>
            {q !== null && p !== null ? formatarCentavos(totalItem(q, p)) : q !== null && !preco.trim() ? <span className="texto-alerta">pendente</span> : "—"}
          </div>
        </div>
        <button className="botao" disabled={enviando} style={{ marginBottom: 2 }}>{enviando ? "Incluindo…" : "Incluir item"}</button>
      </div>
      {selecionado && selecionado.preco_sugerido === null && !preco.trim() && (
        <p className="mudo pequeno" style={{ margin: "6px 0 0" }}>Este item é “a combinar” no catálogo: ele entra com preço pendente e o orçamento só pode ser enviado depois que alguém definir o valor.</p>
      )}
    </form>
  );
}

// ------------------------------------------------------------------ condições e desconto

export function FormularioCondicoes({
  versaoId,
  desconto,
  condicoes,
  observacoes,
  podeDescontar,
  apresentacao,
  apresentacaoPadrao,
}: {
  versaoId: string;
  desconto: number;
  condicoes: string | null;
  observacoes: string | null;
  podeDescontar: boolean;
  apresentacao: string | null;
  apresentacaoPadrao: string;
}) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(salvarCondicoes, {});
  return (
    <form action={enviar}>
      <input type="hidden" name="versao_id" value={versaoId} />
      <Retorno estado={estado} />
      {podeDescontar && (
        <div className="campo" style={{ maxWidth: 220 }}>
          <label htmlFor="desconto">Desconto (R$)</label>
          <input id="desconto" name="desconto" type="text" inputMode="decimal" defaultValue={desconto ? centavosParaCampo(desconto) : ""} placeholder="0,00" />
        </div>
      )}
      <div className="campo">
        <label htmlFor="condicoes">Condições de pagamento</label>
        <textarea id="condicoes" name="condicoes" rows={2} defaultValue={condicoes ?? ""} />
      </div>
      <div className="campo">
        <label htmlFor="apresentacao">Apresentação da proposta (opcional)</label>
        <textarea id="apresentacao" name="apresentacao" rows={3} defaultValue={apresentacao ?? ""} placeholder={apresentacaoPadrao} maxLength={1500} />
        <small className="mudo">Em branco, a proposta usa o texto automático que aparece aqui em cinza.</small>
      </div>
      <div className="campo">
        <label htmlFor="observacoes">Observações para o cliente</label>
        <textarea id="observacoes" name="observacoes" rows={3} defaultValue={observacoes ?? ""} />
      </div>
      <button className="botao secundario" disabled={enviando}>{enviando ? "Salvando…" : "Salvar condições"}</button>
    </form>
  );
}

export function FormularioAprovacao({ versaoId }: { versaoId: string }) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(aprovarCondicoes, {});
  return (
    <form action={enviar}>
      <input type="hidden" name="versao_id" value={versaoId} />
      <Retorno estado={estado} />
      <div className="campo">
        <label htmlFor="justificativa">Justificativa da aprovação</label>
        <textarea id="justificativa" name="justificativa" rows={2} required placeholder="Ex.: cliente fechou dois eventos" />
      </div>
      <button className="botao" disabled={enviando}>{enviando ? "Aprovando…" : "Aprovar condições"}</button>
    </form>
  );
}

export function FormularioEnvio({ versaoId, validadePadrao, bloqueado }: { versaoId: string; validadePadrao: string; bloqueado: boolean }) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(enviarVersao, {});
  return (
    <form action={enviar}>
      <input type="hidden" name="versao_id" value={versaoId} />
      <Retorno estado={estado} />
      <div className="campo">
        <label htmlFor="validade">Válido até</label>
        <input id="validade" name="validade" type="date" defaultValue={validadePadrao} />
      </div>
      <button className="botao" disabled={enviando || bloqueado} style={{ width: "100%", justifyContent: "center" }}>
        {enviando ? "Enviando…" : "Enviar ao cliente"}
      </button>
      <p className="mudo" style={{ margin: "8px 0 0" }}>
        Ao enviar, esta versão fica congelada e o PDF passa a ser o oficial. Para mudar depois, crie uma nova versão.
      </p>
    </form>
  );
}

export function FormularioAceite({ versaoId }: { versaoId: string }) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(registrarAceite, {});
  return (
    <form action={enviar}>
      <input type="hidden" name="versao_id" value={versaoId} />
      <Retorno estado={estado} />
      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontWeight: 500 }}>
        <input type="checkbox" name="confirmo" value="1" style={{ marginTop: 4 }} />
        O cliente aceitou esta versão, com estes valores.
      </label>
      <button className="botao" style={{ marginTop: 8 }} disabled={enviando}>{enviando ? "Registrando…" : "Registrar aceite"}</button>
    </form>
  );
}

export function FormularioPerda({ orcamentoId }: { orcamentoId: string }) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(marcarPerdido, {});
  const [aberto, setAberto] = useState(false);
  if (!aberto) {
    return <button type="button" className="botao secundario pequeno" onClick={() => setAberto(true)}>Marcar como perdido</button>;
  }
  return (
    <form action={enviar}>
      <input type="hidden" name="orcamento_id" value={orcamentoId} />
      <Retorno estado={estado} />
      <div className="campo">
        <label htmlFor="motivo">Por que não fechou?</label>
        <select id="motivo" name="motivo" required defaultValue="">
          <option value="" disabled>Escolha…</option>
          <option>Preço acima do esperado</option>
          <option>Data indisponível</option>
          <option>Escolheu outro local ou fornecedor</option>
          <option>Evento cancelado pelo cliente</option>
          <option>Sem resposta do cliente</option>
          <option>Outro motivo</option>
        </select>
      </div>
      <button className="botao secundario pequeno" disabled={enviando}>Confirmar perda</button>
    </form>
  );
}
