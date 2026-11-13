"use client";

import { useActionState } from "react";
import { entrar, type EstadoEntrada } from "./actions";

export function FormularioEntrada({ aviso }: { aviso?: string }) {
  const [estado, acao, enviando] = useActionState<EstadoEntrada, FormData>(entrar, {});
  return (
    <form action={acao}>
      {aviso && !estado.erro && <p className="aviso info">{aviso}</p>}
      {estado.erro && <p className="aviso erro" role="alert">{estado.erro}</p>}
      <div className="campo">
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required autoFocus defaultValue={estado.email} key={estado.email} />
      </div>
      <div className="campo">
        <label htmlFor="senha">Senha</label>
        <input id="senha" name="senha" type="password" autoComplete="current-password" required />
      </div>
      <button className="botao" disabled={enviando} style={{ width: "100%", justifyContent: "center" }}>
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
