"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adicionarEquipe, adicionarItem, marcarItem, prepararNota, registrarGasto, registrarNota, removerGasto, removerNota,
  salvarFicha, type Estado,
} from "./actions";
import { comprimirImagem } from "@/lib/comprimir-imagem";
import { TAMANHO_MAXIMO, TIPOS_COMPROVANTE, tamanhoLegivel } from "@/lib/comprovantes";
import { criarClienteNavegador } from "@/lib/supabase/navegador";
import { centavosParaCampo, formatarCentavos } from "@/lib/dinheiro";
import { CATEGORIAS_GASTO, FUNCOES, nomeFuncao } from "@/lib/eventos";
import { Retorno } from "../reservas/componentes";

export function FormularioFicha({ reservaId, chegada, traje, observacoes }: {
  reservaId: string; chegada: string; traje: string; observacoes: string;
}) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(salvarFicha, {});
  const [c, setC] = useState(chegada);
  const [t, setT] = useState(traje);
  const [o, setO] = useState(observacoes);
  return (
    <form action={enviar}>
      <input type="hidden" name="reserva_id" value={reservaId} />
      <Retorno estado={estado} />
      <div className="linha" style={{ marginBottom: 10 }}>
        <div className="campo">
          <label htmlFor="f-chegada">Equipe chega às</label>
          <input id="f-chegada" name="chegada" type="time" value={c} onChange={(e) => setC(e.target.value)} />
        </div>
        <div className="campo" style={{ flex: 2 }}>
          <label htmlFor="f-traje">Traje da equipe</label>
          <input id="f-traje" name="traje" type="text" value={t} onChange={(e) => setT(e.target.value)} placeholder="Ex.: camisa preta e calça preta" />
        </div>
      </div>
      <div className="campo">
        <label htmlFor="f-obs">Observações para o dia</label>
        <textarea id="f-obs" name="observacoes" rows={3} value={o} onChange={(e) => setO(e.target.value)}
          placeholder="Ex.: bolo chega às 18h pela lateral; mesa dos noivos perto do palco; 2 convidados veganos" />
      </div>
      <button className="botao secundario" disabled={enviando}>{enviando ? "Salvando…" : "Salvar ficha"}</button>
    </form>
  );
}

export function FormularioEquipe({ reservaId, sugestao, diarias, responsavel }: {
  reservaId: string; sugestao: { funcao: string; quantidade: number }; diarias: Record<string, number>; responsavel: string;
}) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(adicionarEquipe, {});
  const [funcao, setFuncao] = useState(sugestao.funcao);
  const [quantidade, setQuantidade] = useState(String(sugestao.quantidade || 1));
  const [valor, setValor] = useState(centavosParaCampo(diarias[sugestao.funcao] ?? 0));
  const [fornecedor, setFornecedor] = useState(responsavel);
  const [obs, setObs] = useState("");
  const q = Number(quantidade) || 0;
  const v = Math.round(Number(valor.replace(/\./g, "").replace(",", ".")) * 100) || 0;
  return (
    <form action={enviar}>
      <input type="hidden" name="reserva_id" value={reservaId} />
      <Retorno estado={estado} />
      <div className="linha" style={{ marginBottom: 10 }}>
        <div className="campo">
          <label htmlFor="e-funcao">Função</label>
          <select id="e-funcao" name="funcao" value={funcao} onChange={(e) => {
            setFuncao(e.target.value);
            if (diarias[e.target.value]) setValor(centavosParaCampo(diarias[e.target.value]));
          }}>
            {Object.entries(FUNCOES).map(([k, f]) => <option key={k} value={k}>{f.um.charAt(0).toUpperCase() + f.um.slice(1)}</option>)}
          </select>
        </div>
        <div className="campo" style={{ maxWidth: 110 }}>
          <label htmlFor="e-qtd">Quantas pessoas</label>
          <input id="e-qtd" name="quantidade" type="text" inputMode="numeric" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
        </div>
        <div className="campo" style={{ maxWidth: 140 }}>
          <label htmlFor="e-valor">Diária de cada (R$)</label>
          <input id="e-valor" name="valor" type="text" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="e-forn">Quem traz</label>
          <input id="e-forn" name="fornecedor" type="text" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
        </div>
      </div>
      <div className="campo">
        <label htmlFor="e-obs">Observação (opcional)</label>
        <input id="e-obs" name="observacao" type="text" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: 1 fica no bar" />
      </div>
      <button className="botao" disabled={enviando}>
        {enviando ? "Adicionando…" : `Adicionar ${q > 0 ? nomeFuncao(funcao, q) : ""}${q > 0 && v > 0 ? ` · ${formatarCentavos(q * v)}` : ""}`}
      </button>
    </form>
  );
}

/** Um item da lista: toque para marcar ou desmarcar. */
export function ItemChecklist({ id, reservaId, item, feito, quem }: { id: string; reservaId: string; item: string; feito: boolean; quem: string | null }) {
  const [, enviar, enviando] = useActionState<Estado, FormData>(marcarItem, {});
  const [otimista, setOtimista] = useState<boolean | null>(null);
  const marcado = otimista ?? feito;
  return (
    <form action={(f) => { setOtimista(!marcado); return enviar(f); }} className="item-check">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="reserva_id" value={reservaId} />
      <input type="hidden" name="feito" value={marcado ? "0" : "1"} />
      <button type="submit" role="checkbox" aria-checked={marcado} disabled={enviando} className={marcado ? "feito" : undefined}>
        <span className="caixa" aria-hidden>{marcado ? "✓" : ""}</span>
        <span>{item}{marcado && quem && <small className="mudo"> · {quem}</small>}</span>
      </button>
    </form>
  );
}

export function NovoItemChecklist({ reservaId, etapa }: { reservaId: string; etapa: string }) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(adicionarItem, {});
  const [item, setItem] = useState("");
  return (
    <form action={async (f) => { await enviar(f); setItem(""); }} className="form-inline" style={{ marginTop: 6 }}>
      <input type="hidden" name="reserva_id" value={reservaId} />
      <input type="hidden" name="etapa" value={etapa} />
      <input name="item" type="text" value={item} onChange={(e) => setItem(e.target.value)} placeholder="Outro item…" aria-label="Novo item" style={{ flex: 1, minWidth: 120 }} />
      <button className="botao secundario pequeno" disabled={enviando || item.trim().length < 2}>+</button>
      {estado.erro && <span className="atrasada">{estado.erro}</span>}
    </form>
  );
}

async function enviarArquivos(reservaId: string, custoId: string | null, arquivos: File[], aviso: (s: string | null) => void): Promise<{ enviados: number; erro?: string }> {
  const cliente = criarClienteNavegador();
  let enviados = 0;
  for (const [n, original] of arquivos.entries()) {
    aviso(`Enviando nota ${n + 1} de ${arquivos.length}…`);
    if (!(original.type in TIPOS_COMPROVANTE)) return { enviados, erro: `${original.name}: envie foto (JPG, PNG, WEBP, HEIC) ou PDF.` };
    const { blob, tipo, nome } = await comprimirImagem(original);
    if (blob.size > TAMANHO_MAXIMO) return { enviados, erro: `${original.name} tem ${tamanhoLegivel(blob.size)}; o limite é 10 MB.` };
    const preparo = await prepararNota(reservaId, tipo, blob.size);
    if ("erro" in preparo) return { enviados, erro: preparo.erro };
    const { error } = await cliente.storage.from("notas").uploadToSignedUrl(preparo.caminho, preparo.token, blob, { contentType: tipo });
    if (error) return { enviados, erro: `Falha ao enviar ${original.name}. Confira a internet e tente de novo.` };
    const r = await registrarNota({ reservaId, custoId, caminho: preparo.caminho, nome, tipo, tamanho: blob.size });
    if (r.erro) return { enviados, erro: r.erro };
    enviados++;
  }
  aviso(null);
  return { enviados };
}

/** Lança um gasto e, se quiser, já anexa a foto ou PDF da nota. */
export function FormularioGasto({ reservaId, hoje }: { reservaId: string; hoje: string }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [categoria, setCategoria] = useState("compras");
  const [descricao, setDescricao] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hoje);
  const [pago, setPago] = useState(true);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [estado, setEstado] = useState<Estado>({});
  const [progresso, setProgresso] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function lancar() {
    setEstado({});
    iniciar(async () => {
      const f = new FormData();
      Object.entries({ reserva_id: reservaId, categoria, descricao, fornecedor, valor, data }).forEach(([k, v]) => f.set(k, v));
      if (pago) f.set("pago", "on");
      const r = await registrarGasto({}, f);
      if (r.erro || !r.id) return setEstado(r);
      if (arquivos.length) {
        const up = await enviarArquivos(reservaId, r.id, arquivos, setProgresso);
        setProgresso(null);
        if (up.erro) {
          setEstado({ erro: `Gasto lançado, mas a nota não foi: ${up.erro} Anexe de novo pela lista.` });
          router.refresh();
          return;
        }
      }
      setEstado({ ok: arquivos.length ? "Gasto lançado com a nota." : "Gasto lançado." });
      setDescricao(""); setFornecedor(""); setValor(""); setArquivos([]);
      if (entrada.current) entrada.current.value = "";
      router.refresh();
    });
  }

  return (
    <div>
      <Retorno estado={estado} />
      <div className="linha" style={{ marginBottom: 10 }}>
        <div className="campo">
          <label htmlFor="g-cat">Tipo</label>
          <select id="g-cat" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {Object.entries(CATEGORIAS_GASTO).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
          </select>
        </div>
        <div className="campo" style={{ flex: 2 }}>
          <label htmlFor="g-desc">O que foi</label>
          <input id="g-desc" type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: carne e frango para o jantar" />
        </div>
      </div>
      <div className="linha" style={{ marginBottom: 10 }}>
        <div className="campo">
          <label htmlFor="g-forn">Onde comprou (opcional)</label>
          <input id="g-forn" type="text" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Ex.: Mateus Supermercados" />
        </div>
        <div className="campo" style={{ maxWidth: 130 }}>
          <label htmlFor="g-valor">Valor (R$)</label>
          <input id="g-valor" type="text" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
        </div>
        <div className="campo" style={{ maxWidth: 160 }}>
          <label htmlFor="g-data">Data</label>
          <input id="g-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
      </div>
      <div className="campo">
        <label htmlFor="g-nota">Nota fiscal ou cupom (foto ou PDF, opcional)</label>
        <input id="g-nota" ref={entrada} type="file" multiple accept="image/*,application/pdf" onChange={(e) => setArquivos(Array.from(e.target.files ?? []))} />
      </div>
      <label style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 500, marginBottom: 10 }}>
        <input type="checkbox" checked={pago} onChange={(e) => setPago(e.target.checked)} /> Já foi pago
      </label>
      <button type="button" className="botao" onClick={lancar} disabled={pendente}>{progresso ?? (pendente ? "Lançando…" : "Lançar gasto")}</button>
    </div>
  );
}

/** Anexar nota a um gasto que já está na lista. */
export function AnexarNota({ reservaId, custoId }: { reservaId: string; custoId: string | null }) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({});
  const [progresso, setProgresso] = useState<string | null>(null);
  return (
    <label className="botao secundario pequeno" style={{ cursor: "pointer" }}>
      {progresso ?? "Anexar nota"}
      <input type="file" multiple accept="image/*,application/pdf" style={{ display: "none" }} onChange={async (e) => {
        const arquivos = Array.from(e.target.files ?? []);
        if (!arquivos.length) return;
        const r = await enviarArquivos(reservaId, custoId, arquivos, setProgresso);
        setProgresso(null);
        setEstado(r.erro ? { erro: r.erro } : { ok: "Nota anexada." });
        e.target.value = "";
        router.refresh();
      }} />
      {estado.erro && <span className="atrasada" style={{ marginLeft: 6 }}>{estado.erro}</span>}
    </label>
  );
}

export function RemoverComMotivo({ acao, id, reservaId, rotulo }: {
  acao: "gasto" | "nota"; id: string; reservaId: string; rotulo: string;
}) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(acao === "gasto" ? removerGasto : removerNota, {});
  const [motivo, setMotivo] = useState("");
  return (
    <details>
      <summary style={{ cursor: "pointer", fontSize: ".8rem" }} className="mudo">{rotulo}</summary>
      <form action={enviar} style={{ marginTop: 6 }}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="reserva_id" value={reservaId} />
        <Retorno estado={estado} />
        <input name="motivo" type="text" required value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (ex.: lançado em dobro)" style={{ marginBottom: 6 }} />
        <button className="botao secundario pequeno" disabled={enviando}>{rotulo}</button>
      </form>
    </details>
  );
}

export function Imprimir() {
  return <button type="button" className="botao secundario" onClick={() => window.print()}>Imprimir ficha</button>;
}
