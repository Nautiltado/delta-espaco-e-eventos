"use client";

import { Retorno as RetornoOk } from "@/componentes/avisos";

import { useActionState } from "react";
import { criarTarefa, type EstadoTarefa } from "./actions";

export function FormularioTarefa({ clienteId, hoje }: { clienteId?: string; hoje: string }) {
  const [estado, enviar, enviando] = useActionState<EstadoTarefa, FormData>(criarTarefa, {});
  return (
    <form action={enviar} key={estado.seq ?? 0}>
      {clienteId && <input type="hidden" name="cliente_id" value={clienteId} />}
      <RetornoOk estado={estado} />
      <div className="campo">
        <label htmlFor="titulo">O que precisa ser feito</label>
        <input id="titulo" name="titulo" type="text" required placeholder="Ex.: Ligar para confirmar o número de convidados" />
      </div>
      <div className="linha" style={{ marginBottom: 14 }}>
        <div className="campo">
          <label htmlFor="data">Até quando</label>
          <input id="data" name="data" type="date" defaultValue={hoje} />
        </div>
        <div className="campo">
          <label htmlFor="hora">Hora</label>
          <input id="hora" name="hora" type="text" placeholder="18:00" pattern="\d{2}:\d{2}" />
        </div>
      </div>
      <div className="campo">
        <label htmlFor="descricao">Detalhes (opcional)</label>
        <textarea id="descricao" name="descricao" rows={2} />
      </div>
      <button className="botao" disabled={enviando}>{enviando ? "Criando…" : "Criar tarefa"}</button>
    </form>
  );
}
