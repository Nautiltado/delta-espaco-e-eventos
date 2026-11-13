"use client";

import { useActionState } from "react";
import { verificarCodigo, type EstadoCodigo } from "./actions";

export function FormularioCodigo() {
  const [estado, acao, enviando] = useActionState<EstadoCodigo, FormData>(verificarCodigo, {});
  return (
    <form action={acao}>
      {estado.erro && <p className="aviso erro" role="alert">{estado.erro}</p>}
      <div className="campo">
        <label htmlFor="codigo">Código</label>
        <input id="codigo" name="codigo" className="campo-codigo" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus placeholder="000000" />
      </div>
      <button className="botao" disabled={enviando} style={{ width: "100%", justifyContent: "center" }}>
        {enviando ? "Conferindo…" : "Entrar"}
      </button>
    </form>
  );
}
