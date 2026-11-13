"use client";

import { useActionState, useState } from "react";
import { salvarTemposEspaco, type EstadoConfig } from "./actions";

type Tempos = { montagem: number | null; desmontagem: number | null; limpeza: number | null; intervalo: number | null };
const CAMPOS: { k: keyof Tempos; rotulo: string }[] = [
  { k: "montagem", rotulo: "Montagem (antes)" },
  { k: "desmontagem", rotulo: "Desmontagem (depois)" },
  { k: "limpeza", rotulo: "Limpeza (depois)" },
  { k: "intervalo", rotulo: "Intervalo extra" },
];
const txt = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));

export function TemposDoEspaco({ id, nome, tempos, padrao, podeEditar }: {
  id: string; nome: string; tempos: Tempos; padrao: Record<keyof Tempos, number>; podeEditar: boolean;
}) {
  const [estado, acao, enviando] = useActionState<EstadoConfig, FormData>(salvarTemposEspaco, {});
  const [v, setV] = useState(() => Object.fromEntries(CAMPOS.map((c) => [c.k, txt(tempos[c.k])])) as Record<keyof Tempos, string>);
  return (
    <form action={acao} className="tempos-espaco" aria-label={`Tempos do ${nome}`}>
      <input type="hidden" name="recurso" value={id} />
      <strong>{nome}</strong>
      <div className="form-colunas">
        {CAMPOS.map((c) => (
          <div key={c.k} className="campo">
            <label htmlFor={`t-${id}-${c.k}`}>{c.rotulo}</label>
            <input type="text" id={`t-${id}-${c.k}`} name={c.k} inputMode="decimal" disabled={!podeEditar}
              value={v[c.k]} onChange={(e) => setV({ ...v, [c.k]: e.target.value })}
              placeholder={`padrão: ${txt(padrao[c.k])} h`} />
          </div>
        ))}
      </div>
      {podeEditar && (
        <div className="linha" style={{ alignItems: "center" }}>
          <button className="botao pequeno" disabled={enviando}>{enviando ? "Salvando…" : "Salvar"}</button>
          {estado.erro && <span className="aviso erro" role="alert">{estado.erro}</span>}
          {estado.ok && <span className="aviso ok" role="status">{estado.ok}</span>}
        </div>
      )}
    </form>
  );
}
