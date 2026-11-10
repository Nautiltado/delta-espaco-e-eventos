"use client";

import { useActionState } from "react";
import { trocarSenha, type EstadoTroca } from "./actions";

export function FormularioTroca() {
  const [estado, acao, enviando] = useActionState<EstadoTroca, FormData>(trocarSenha, {});
  return (
    <form action={acao}>
      {estado.erro && <p className="aviso erro" role="alert">{estado.erro}</p>}
      <div className="campo">
        <label htmlFor="senha">Nova senha (mínimo de 10 caracteres)</label>
        <input id="senha" name="senha" type="password" autoComplete="new-password" minLength={10} required autoFocus />
      </div>
      <div className="campo">
        <label htmlFor="confirmacao">Repita a nova senha</label>
        <input id="confirmacao" name="confirmacao" type="password" autoComplete="new-password" required />
      </div>
      <button className="botao" disabled={enviando} style={{ width: "100%", justifyContent: "center" }}>
        {enviando ? "Salvando…" : "Salvar senha"}
      </button>
    </form>
  );
}
