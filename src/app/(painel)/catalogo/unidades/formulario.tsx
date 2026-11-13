"use client";

import { useActionState } from "react";
import { Retorno as RetornoOk } from "@/componentes/avisos";
import { salvarUnidade } from "../actions";
import type { Unidade } from "@/lib/unidades";

type Estado = { erro?: string; ok?: string };

export function FormularioUnidade({ unidade, opcoes }: { unidade?: Unidade; opcoes: { codigo: string; singular: string }[] }) {
  const [estado, acao, salvando] = useActionState<Estado, FormData>(salvarUnidade, {});
  const num = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));
  return (
    <form action={acao} className="form-colunas" style={{ alignItems: "end" }}>
      {!unidade && <input type="hidden" name="novo" value="1" />}
      {unidade && <input type="hidden" name="codigo" value={unidade.codigo} />}
      {!unidade && (
        <div className="campo"><label htmlFor="u-codigo">Código</label><input id="u-codigo" name="codigo" type="text" required placeholder="ex.: duzia" /></div>
      )}
      <div className="campo"><label htmlFor={`u-sing-${unidade?.codigo ?? "nova"}`}>Singular</label><input id={`u-sing-${unidade?.codigo ?? "nova"}`} name="singular" type="text" required defaultValue={unidade?.singular} placeholder="dúzia" /></div>
      <div className="campo"><label htmlFor={`u-plu-${unidade?.codigo ?? "nova"}`}>Plural</label><input id={`u-plu-${unidade?.codigo ?? "nova"}`} name="plural" type="text" required defaultValue={unidade?.plural} placeholder="dúzias" /></div>
      <div className="campo"><label htmlFor={`u-eq-${unidade?.codigo ?? "nova"}`}>Equivale a</label><input id={`u-eq-${unidade?.codigo ?? "nova"}`} name="equivale_quantidade" type="text" inputMode="decimal" defaultValue={num(unidade?.equivale_quantidade)} placeholder="12" /></div>
      <div className="campo">
        <label htmlFor={`u-equ-${unidade?.codigo ?? "nova"}`}>de</label>
        <select id={`u-equ-${unidade?.codigo ?? "nova"}`} name="equivale_unidade" defaultValue={unidade?.equivale_unidade ?? ""}>
          <option value="">sem equivalência</option>
          {opcoes.filter((o) => o.codigo !== unidade?.codigo).map((o) => <option key={o.codigo} value={o.codigo}>{o.singular}</option>)}
        </select>
      </div>
      <div className="campo"><label htmlFor={`u-passo-${unidade?.codigo ?? "nova"}`}>Passo</label><input id={`u-passo-${unidade?.codigo ?? "nova"}`} name="passo" type="text" inputMode="decimal" defaultValue={num(unidade?.passo ?? 1)} /></div>
      <input type="hidden" name="ordem" value={unidade?.ordem ?? 500} />
      <label className="opcoes" style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 500 }}>
        <input type="checkbox" name="ativo" value="1" defaultChecked={unidade?.ativo ?? true} /> Ativa
      </label>
      <div style={{ gridColumn: "1 / -1" }}><RetornoOk estado={estado} /></div>
      <div className="janela-rodape" style={{ gridColumn: "1 / -1" }}>
        <button className="botao" disabled={salvando}>{salvando ? "Salvando…" : unidade ? "Salvar" : "Criar unidade"}</button>
      </div>
    </form>
  );
}
