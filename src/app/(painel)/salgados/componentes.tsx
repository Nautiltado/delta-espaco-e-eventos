"use client";

import { useActionState, useState } from "react";
import { cancelarPedido, definirMinimo, definirPreco, movimentarEstoque, pagarPedido, type Estado } from "./actions";
import { centavosParaCampo } from "@/lib/dinheiro";
import { FORMAS_PAGAMENTO } from "@/lib/reservas";
import { Retorno } from "@/componentes/avisos";

export function FormularioPagamentoPedido({ pedidoId, hoje }: { pedidoId: string; hoje: string }) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(pagarPedido, {});
  const [forma, setForma] = useState("pix");
  const [idExterno, setIdExterno] = useState("");
  return (
    <form action={enviar}>
      <input type="hidden" name="pedido_id" value={pedidoId} />
      <Retorno estado={estado} />
      <div className="linha" style={{ marginBottom: 10 }}>
        <div className="campo">
          <label htmlFor="pp-forma">Forma</label>
          <select id="pp-forma" name="forma" value={forma} onChange={(e) => setForma(e.target.value)}>
            {Object.entries(FORMAS_PAGAMENTO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="pp-data">Recebido em</label>
          <input id="pp-data" name="recebido_em" type="date" defaultValue={hoje} max={hoje} required />
        </div>
      </div>
      {(forma === "pix" || forma === "transferencia") && (
        <div className="campo">
          <label htmlFor="pp-id">Identificador no extrato (opcional)</label>
          <input id="pp-id" name="id_externo" type="text" value={idExterno} onChange={(e) => setIdExterno(e.target.value)} placeholder="Ex.: E00416968202611111234abcdef" />
        </div>
      )}
      <button className="botao" disabled={enviando}>{enviando ? "Registrando…" : "Pagamento recebido (conferi)"}</button>
    </form>
  );
}

export function FormularioCancelarPedido({ pedidoId, status, podeExcecao }: {
  pedidoId: string; status: "aguardando_pagamento" | "pago" | "pronto"; podeExcecao: boolean;
}) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(cancelarPedido, {});
  const [motivo, setMotivo] = useState("");
  const [devolver, setDevolver] = useState(false);
  return (
    <form action={enviar}>
      <input type="hidden" name="pedido_id" value={pedidoId} />
      <Retorno estado={estado} />
      {status === "pago" && <p className="aviso info">Ainda não ficou pronto: o cliente recebe o dinheiro de volta (o sistema cria a tarefa de devolver).</p>}
      {status === "pronto" && (
        <p className="aviso erro">Já está pronto: o dinheiro <strong>não</strong> é devolvido, e os salgados saem do estoque como perda.</p>
      )}
      <div className="campo">
        <label htmlFor="pc-motivo">Motivo</label>
        <input id="pc-motivo" name="motivo" type="text" required value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: cliente desistiu" />
      </div>
      {status === "pronto" && podeExcecao && (
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 500, marginBottom: 10 }}>
          <input type="checkbox" name="devolver" checked={devolver} onChange={(e) => setDevolver(e.target.checked)} />
          Devolver mesmo assim (erro nosso: atraso, pedido errado)
        </label>
      )}
      <button className="botao secundario" disabled={enviando}>Cancelar pedido</button>
    </form>
  );
}

/** Cozinha: registrar o que acabou de fazer, com atalhos de quantidade. */
export function FormularioProducao({ itens }: { itens: { id: string; nome: string }[] }) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(movimentarEstoque, {});
  const [item, setItem] = useState(itens[0]?.id ?? "");
  const [qtd, setQtd] = useState("100");
  return (
    <form action={enviar}>
      <input type="hidden" name="tipo" value="producao" />
      <input type="hidden" name="nome" value={itens.find((i) => i.id === item)?.nome.toLowerCase() ?? ""} />
      <Retorno estado={estado} />
      <div className="campo">
        <label htmlFor="pr-item">Salgado</label>
        <select id="pr-item" name="estoque_item_id" value={item} onChange={(e) => setItem(e.target.value)}>
          {itens.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="pr-qtd">Quantas unidades fez</label>
        <input id="pr-qtd" name="quantidade" type="text" inputMode="numeric" value={qtd} onChange={(e) => setQtd(e.target.value)} />
        <div className="chips" style={{ marginTop: 6 }}>
          {[50, 100, 200, 300, 500].map((n) => (
            <button key={n} type="button" className={qtd === String(n) ? "chip ativo" : "chip"} onClick={() => setQtd(String(n))}>{n}</button>
          ))}
        </div>
      </div>
      <button className="botao" disabled={enviando}>{enviando ? "Registrando…" : "Registrar produção"}</button>
    </form>
  );
}

export function FormularioAjuste({ item }: { item: { id: string; nome: string } }) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(movimentarEstoque, {});
  const [tipo, setTipo] = useState("perda");
  const [qtd, setQtd] = useState("");
  const [sinal, setSinal] = useState("-");
  const [obs, setObs] = useState("");
  return (
    <form action={enviar}>
      <input type="hidden" name="estoque_item_id" value={item.id} />
      <input type="hidden" name="nome" value={item.nome.toLowerCase()} />
      <Retorno estado={estado} />
      <div className="linha" style={{ marginBottom: 8 }}>
        <div className="campo">
          <label htmlFor={`aj-t-${item.id}`}>O que houve</label>
          <select id={`aj-t-${item.id}`} name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="perda">Perda (estragou, caiu)</option>
            <option value="evento">Saída para evento</option>
            <option value="ajuste">Contagem (corrigir o saldo)</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor={`aj-q-${item.id}`}>Unidades</label>
          <input id={`aj-q-${item.id}`} name="quantidade" type="text" inputMode="numeric" required value={qtd} onChange={(e) => setQtd(e.target.value)} />
        </div>
        {tipo === "ajuste" && (
          <div className="campo">
            <label htmlFor={`aj-s-${item.id}`}>Na contagem</label>
            <select id={`aj-s-${item.id}`} name="sinal" value={sinal} onChange={(e) => setSinal(e.target.value)}>
              <option value="-">tirar</option>
              <option value="+">somar</option>
            </select>
          </div>
        )}
      </div>
      <div className="campo">
        <label htmlFor={`aj-o-${item.id}`}>Motivo</label>
        <input id={`aj-o-${item.id}`} name="observacao" type="text" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: contagem do fim do dia" />
      </div>
      <div className="janela-rodape"><button className="botao" disabled={enviando}>{enviando ? "Registrando…" : "Registrar"}</button></div>
    </form>
  );
}

export function FormularioMinimo({ id, minimo }: { id: string; minimo: number }) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(definirMinimo, {});
  const [valor, setValor] = useState(String(minimo));
  return (
    <form action={enviar}>
      <input type="hidden" name="estoque_item_id" value={id} />
      <div className="campo">
        <label htmlFor={`min-${id}`}>Mínimo (unidades)</label>
        <input id={`min-${id}`} name="minimo" type="text" inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus />
      </div>
      <Retorno estado={estado} />
      <div className="janela-rodape"><button className="botao" disabled={enviando}>{enviando ? "Salvando…" : "Salvar"}</button></div>
    </form>
  );
}

export function FormularioPreco({ id, preco, ativo }: { id: string; preco: number; ativo: boolean }) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(definirPreco, {});
  const [valor, setValor] = useState(centavosParaCampo(preco));
  const [aVenda, setAVenda] = useState(ativo);
  return (
    <form action={enviar}>
      <input type="hidden" name="produto_id" value={id} />
      <div className="campo">
        <label htmlFor={`preco-${id}`}>Preço (R$)</label>
        <input id={`preco-${id}`} name="preco" type="text" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus />
      </div>
      <label style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 500 }}>
        <input type="checkbox" name="ativo" checked={aVenda} onChange={(e) => setAVenda(e.target.checked)} /> À venda
      </label>
      <Retorno estado={estado} />
      <div className="janela-rodape"><button className="botao" disabled={enviando}>{enviando ? "Salvando…" : "Salvar"}</button></div>
    </form>
  );
}
