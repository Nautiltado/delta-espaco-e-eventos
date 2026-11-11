"use client";

import { useActionState } from "react";
import { salvarConfiguracao, type EstadoConfig } from "./actions";
import type { TipoConfig } from "@/lib/configuracoes";

const SUFIXO: Partial<Record<TipoConfig, string>> = {
  horas: "horas",
  dias: "dias",
  percentual: "%",
  inteiro: "",
  centavos: "R$",
};

export function CampoConfiguracao({
  chave,
  tipo,
  valorCampo,
  faixa,
}: {
  chave: string;
  tipo: TipoConfig;
  valorCampo: string;
  faixa?: { min: string; max: string };
}) {
  const [estado, acao, enviando] = useActionState<EstadoConfig, FormData>(salvarConfiguracao, {});
  return (
    <form action={acao}>
      <input type="hidden" name="chave" value={chave} />
      <div className="linha">
        {tipo === "faixa_centavos" && faixa ? (
          <>
            <div className="campo">
              <label htmlFor={`${chave}-min`}>Mínimo (R$)</label>
              <input id={`${chave}-min`} name="min" type="text" inputMode="decimal" defaultValue={faixa.min} />
            </div>
            <div className="campo">
              <label htmlFor={`${chave}-max`}>Máximo (R$)</label>
              <input id={`${chave}-max`} name="max" type="text" inputMode="decimal" defaultValue={faixa.max} />
            </div>
          </>
        ) : (
          <div className="campo">
            <label htmlFor={chave}>{SUFIXO[tipo] ? `Valor (${SUFIXO[tipo]})` : "Valor"}</label>
            <input
              id={chave}
              name="valor"
              type="text"
              inputMode={tipo === "texto" || tipo === "texto_opcional" ? "text" : "decimal"}
              defaultValue={valorCampo}
            />
          </div>
        )}
        <button className="botao pequeno" disabled={enviando} style={{ marginBottom: 2 }}>
          {enviando ? "Salvando…" : "Salvar"}
        </button>
      </div>
      {estado.erro && <p className="aviso erro" role="alert">{estado.erro}</p>}
      {estado.ok && <p className="aviso ok" role="status">{estado.ok}</p>}
    </form>
  );
}
