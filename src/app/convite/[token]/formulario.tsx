"use client";

import { useActionState, useState } from "react";
import { aceitarConvite, type EstadoConvite } from "./actions";

export function FormularioConvite({ token }: { token: string }) {
  const [estado, acao, enviando] = useActionState<EstadoConvite, FormData>(aceitarConvite, {});
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const forca = [senha.length >= 10, /[a-zA-Z]/.test(senha) && /\d/.test(senha), senha.length >= 14 || /[^a-zA-Z0-9]/.test(senha)].filter(Boolean).length;
  return (
    <form action={acao}>
      <input type="hidden" name="token" value={token} />
      <div className="campo">
        <label htmlFor="senha">Senha nova</label>
        <input id="senha" name="senha" type="password" autoComplete="new-password" required minLength={10} value={senha} onChange={(e) => setSenha(e.target.value)} />
        <small className="mudo">Pelo menos 10 caracteres, com letras e números. {senha && ["Fraca", "Fraca", "Boa", "Forte"][forca]}</small>
      </div>
      <div className="campo">
        <label htmlFor="confirmacao">Repita a senha</label>
        <input id="confirmacao" name="confirmacao" type="password" autoComplete="new-password" required value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
        {confirmacao && confirmacao !== senha && <small className="texto-alerta">As senhas ainda não são iguais.</small>}
      </div>
      {estado.erro && <p className="aviso erro" role="alert">{estado.erro}</p>}
      <button className="botao" disabled={enviando} style={{ width: "100%", justifyContent: "center" }}>{enviando ? "Salvando…" : "Salvar senha e entrar"}</button>
    </form>
  );
}
