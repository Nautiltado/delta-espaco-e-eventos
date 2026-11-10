"use client";

import { useActionState } from "react";
import { mesclarClientes, type EstadoMesclagem } from "../actions";

export function FormularioMesclagem({
  destino,
  candidatos,
}: {
  destino: string;
  candidatos: { id: string; rotulo: string }[];
}) {
  const [estado, acao, enviando] = useActionState<EstadoMesclagem, FormData>(mesclarClientes, {});
  return (
    <form action={acao}>
      <input type="hidden" name="destino" value={destino} />
      {estado.erro && <p className="aviso erro" role="alert">{estado.erro}</p>}
      <div className="campo">
        <label htmlFor="origem">Cadastro repetido que será incorporado a este</label>
        <select id="origem" name="origem" required defaultValue="">
          <option value="" disabled>Escolha…</option>
          {candidatos.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
        </select>
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontWeight: 500 }}>
        <input type="checkbox" name="confirmo" value="1" style={{ marginTop: 4 }} />
        Confirmo que é a mesma pessoa ou empresa. Orçamentos, tarefas e reservas do cadastro repetido passam para
        este, e ele fica inativo (não é apagado).
      </label>
      <button className="botao secundario" style={{ marginTop: 10 }} disabled={enviando}>
        {enviando ? "Mesclando…" : "Mesclar cadastros"}
      </button>
    </form>
  );
}
