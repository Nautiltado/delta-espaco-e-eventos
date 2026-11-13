"use client";

import { useActionState, useState, useTransition } from "react";
import { confirmarCadastro, iniciarCadastro, type Cadastro, type EstadoCodigo } from "./actions";

export function CadastroDuasEtapas() {
  const [cadastro, setCadastro] = useState<Cadastro | null>(null);
  const [comecando, comecar] = useTransition();
  const [estado, acao, enviando] = useActionState<EstadoCodigo, FormData>(
    (_: EstadoCodigo, f: FormData) => confirmarCadastro(cadastro?.fatorId ?? "", f), {},
  );
  if (!cadastro?.fatorId) {
    return (
      <>
        {cadastro?.erro && <p className="aviso erro" role="alert">{cadastro.erro}</p>}
        <button type="button" className="botao" style={{ width: "100%", justifyContent: "center" }} disabled={comecando}
          onClick={() => comecar(async () => setCadastro(await iniciarCadastro()))}>
          {comecando ? "Gerando…" : "Mostrar o QR code"}
        </button>
      </>
    );
  }
  return (
    <form action={acao}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cadastro.qr} alt="QR code para o app autenticador" className="qr-mfa" />
      <details className="pequeno" style={{ marginBottom: 12 }}>
        <summary>Não consegue ler o QR code?</summary>
        <p className="mudo" style={{ margin: "6px 0 0" }}>No app, escolha &ldquo;digitar chave&rdquo; e use:</p>
        <code className="segredo-mfa" data-segredo={cadastro.segredo}>{cadastro.segredo}</code>
      </details>
      {estado.erro && <p className="aviso erro" role="alert">{estado.erro}</p>}
      <div className="campo">
        <label htmlFor="codigo">Código de 6 números do app</label>
        <input id="codigo" name="codigo" className="campo-codigo" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus placeholder="000000" />
      </div>
      <button className="botao" disabled={enviando} style={{ width: "100%", justifyContent: "center" }}>
        {enviando ? "Conferindo…" : "Ativar e entrar"}
      </button>
    </form>
  );
}
