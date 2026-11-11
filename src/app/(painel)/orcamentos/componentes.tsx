"use client";

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
import { formatarQuantidade, lerQuantidade, rotuloUnidade, totalItem, TIPOS_ORCAMENTO, UNIDADES } from "@/lib/orcamentos";

function Retorno({ estado }: { estado: Estado }) {
  if (estado.erro) return <p className="aviso erro" role="alert">{estado.erro}</p>;
  if (estado.ok) return <p className="aviso ok" role="status">{estado.ok}</p>;
  return null;
}

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
  unidade: string;
  quantidade: number;
  preco_unitario_centavos: number;
  total_centavos: number;
  custo_unitario_centavos?: number | null;
  faixa?: string | null;
};

export function LinhaItem({ item, editavel, verCusto }: { item: LinhaItemDados; editavel: boolean; verCusto: boolean }) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(salvarItem, {});
  const custo = item.custo_unitario_centavos != null ? totalItem(item.quantidade, item.custo_unitario_centavos) : null;
  if (!editavel) {
    return (
      <tr>
        <td>{item.descricao}</td>
        <td className="numero">{formatarQuantidade(item.quantidade)} {rotuloUnidade(item.unidade, item.quantidade)}</td>
        <td className="numero">{formatarCentavos(item.preco_unitario_centavos)}</td>
        <td className="numero">{formatarCentavos(item.total_centavos)}</td>
        {verCusto && <td className="numero mudo">{custo != null ? formatarCentavos(custo) : "—"}</td>}
      </tr>
    );
  }
  const formId = `item-${item.id}`;
  return (
    <tr>
      <td>
        <form id={formId} action={enviar}>
          <input type="hidden" name="id" value={item.id} />
        </form>
        <input form={formId} name="descricao" type="text" defaultValue={item.descricao} aria-label="Descrição" />
        {item.faixa && <div className="mudo" style={{ fontSize: ".78rem" }}>Catálogo: {item.faixa}</div>}
        <Retorno estado={estado.ok ? {} : estado} />
      </td>
      <td style={{ width: 72 }}>
        <input form={formId} name="quantidade" type="text" inputMode="decimal" aria-label="Quantidade"
          defaultValue={formatarQuantidade(item.quantidade)} />
        <div className="mudo" style={{ fontSize: ".78rem" }}>{rotuloUnidade(item.unidade, item.quantidade)}</div>
      </td>
      <td style={{ width: 120 }}>
        <input form={formId} name="preco" type="text" inputMode="decimal" aria-label="Preço unitário"
          defaultValue={centavosParaCampo(item.preco_unitario_centavos)} />
      </td>
      <td className="numero">{formatarCentavos(item.total_centavos)}</td>
      {verCusto && <td className="numero mudo">{custo != null ? formatarCentavos(custo) : "—"}</td>}
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
};

/** Use com key={quantidade de itens}: ao incluir um item, o formulário recomeça limpo; com erro, mantém o que foi digitado. */
export function NovoItem({ versaoId, catalogo }: { versaoId: string; catalogo: OpcaoCatalogo[] }) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(adicionarItem, {});
  const [escolha, setEscolha] = useState("");
  const [descricao, setDescricao] = useState("");
  const [unidade, setUnidade] = useState("evento");
  const [preco, setPreco] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const selecionado = catalogo.find((c) => c.id === escolha);
  const q = lerQuantidade(quantidade);
  const p = lerReais(preco);

  function escolher(id: string) {
    setEscolha(id);
    const c = catalogo.find((x) => x.id === id);
    if (c) {
      setDescricao(c.nome);
      setUnidade(c.unidade);
      setPreco(c.preco_sugerido === null ? "" : centavosParaCampo(c.preco_sugerido));
    } else {
      setDescricao("");
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
            <option value="">Item livre (digite abaixo)</option>
            {[...new Set(catalogo.map((c) => c.grupo))].map((g) => (
              <optgroup key={g} label={g}>
                {catalogo.filter((c) => c.grupo === g).map((c) => <option key={c.id} value={c.id}>{c.nome} · {c.faixa}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="campo" style={{ flex: 2, minWidth: 200 }}>
          <label htmlFor="descricao-novo">Descrição no orçamento</label>
          <input id="descricao-novo" name="descricao" type="text" required value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>
      </div>
      <div className="linha" style={{ marginTop: 10 }}>
        <div className="campo">
          <label htmlFor="quantidade-novo">Quantidade</label>
          <input id="quantidade-novo" name="quantidade" type="text" inputMode="decimal" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="unidade-novo">Por</label>
          <select id="unidade-novo" name="unidade" value={unidade} onChange={(e) => setUnidade(e.target.value)} disabled={!!selecionado}>
            {Object.entries(UNIDADES).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
          {selecionado && <input type="hidden" name="unidade" value={unidade} />}
        </div>
        <div className="campo">
          <label htmlFor="preco-novo">Preço unitário (R$)</label>
          <input id="preco-novo" name="preco" type="text" inputMode="decimal" required value={preco} onChange={(e) => setPreco(e.target.value)}
            placeholder={selecionado && selecionado.preco_sugerido === null ? "A combinar: digite" : undefined} />
        </div>
        <div className="campo" style={{ minWidth: 110 }}>
          <label>Total</label>
          <div style={{ padding: "9px 0", fontWeight: 600 }}>{q !== null && p !== null ? formatarCentavos(totalItem(q, p)) : "—"}</div>
        </div>
        <button className="botao" disabled={enviando} style={{ marginBottom: 2 }}>{enviando ? "Incluindo…" : "Incluir item"}</button>
      </div>
      {selecionado?.descricao && <p className="mudo" style={{ margin: "6px 0 0" }}>{selecionado.descricao}</p>}
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
}: {
  versaoId: string;
  desconto: number;
  condicoes: string | null;
  observacoes: string | null;
  podeDescontar: boolean;
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
