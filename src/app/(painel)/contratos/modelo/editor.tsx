"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { Retorno } from "@/componentes/avisos";
import { salvarModeloContrato, type Estado } from "../../reservas/actions";

const MARCADOR = /\{\{\s*([a-z_.]+)\s*\}\}/g;

/** O que cada marcador quer dizer, para quem edita o modelo. */
const DESCRICOES: Record<string, string> = {
  "contrato.numero": "Número do contrato",
  "empresa.razao_social": "Razão social da Delta",
  "empresa.nome_fantasia": "Nome fantasia da Delta",
  "empresa.cnpj": "CNPJ da Delta",
  "empresa.endereco": "Endereço da Delta",
  signatario: "Quem assina pela Delta",
  "cliente.qualificacao": "Nome, documento e endereço do cliente",
  "cliente.assinatura": "Nome do cliente na assinatura",
  "orcamento.numero": "Número do orçamento",
  "orcamento.versao": "Versão do orçamento",
  "evento.titulo": "Nome do evento",
  "evento.periodo": "Data e horário do evento",
  "evento.data": "Data do evento",
  "evento.local": "Local do evento",
  "evento.convidados": "Número de convidados",
  itens: "Lista dos itens contratados",
  "valor.total": "Valor total",
  "valor.extenso": "Valor total por extenso",
  "pagamento.parcelas": "Parcelas e vencimentos",
  "contrato.canal": "Onde o contrato foi fechado",
  "contrato.arrependimento": "Cláusula de arrependimento (só fora do estabelecimento)",
  cidade: "Cidade da Delta",
  "data.extenso": "Data de hoje por extenso",
};

function escapar(t: string) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Texto com os marcadores pintados (fica atrás da caixa de texto, alinhado letra a letra). */
function realcar(texto: string, conhecidos: Set<string>) {
  let html = "";
  let ultimo = 0;
  for (const m of texto.matchAll(MARCADOR)) {
    html += escapar(texto.slice(ultimo, m.index));
    html += `<mark class="${conhecidos.has(m[1]) ? "" : "desconhecido"}">${escapar(m[0])}</mark>`;
    ultimo = (m.index ?? 0) + m[0].length;
  }
  return html + escapar(texto.slice(ultimo)) + "\n";
}

function CaixaMarcada({ id, nome, valor, aoMudar, linhas, conhecidos, aoFocar, refTexto }: {
  id: string; nome: string; valor: string; aoMudar: (v: string) => void; linhas: number; conhecidos: Set<string>;
  aoFocar: () => void; refTexto: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const fundo = useRef<HTMLPreElement>(null);
  return (
    <div className="editor-marcado" style={{ ["--linhas" as string]: linhas }}>
      <pre ref={fundo} className="editor-fundo" aria-hidden dangerouslySetInnerHTML={{ __html: realcar(valor, conhecidos) }} />
      <textarea
        ref={refTexto} id={id} name={nome} value={valor} spellCheck={false}
        onChange={(e) => aoMudar(e.target.value)} onFocus={aoFocar}
        onScroll={(e) => { if (fundo.current) { fundo.current.scrollTop = e.currentTarget.scrollTop; fundo.current.scrollLeft = e.currentTarget.scrollLeft; } }}
        // soltar um marcador: o próprio navegador insere o texto onde o cursor do arrasto parou
      />
    </div>
  );
}

export function EditorModelo({ titulo: tituloInicial, corpo: corpoInicial, anexo: anexoInicial, marcadores, exemplo }: {
  titulo: string; corpo: string; anexo: string; marcadores: string[]; exemplo: Record<string, string>;
}) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(salvarModeloContrato, {});
  const [titulo, setTitulo] = useState(tituloInicial);
  const [corpo, setCorpo] = useState(corpoInicial);
  const [anexo, setAnexo] = useState(anexoInicial);
  const [aba, setAba] = useState<"texto" | "previa">("texto");
  const refCorpo = useRef<HTMLTextAreaElement>(null);
  const refAnexo = useRef<HTMLTextAreaElement>(null);
  const [alvo, setAlvo] = useState<"corpo" | "anexo">("corpo");
  const conhecidos = useMemo(() => new Set(marcadores), [marcadores]);
  const desconhecidos = useMemo(
    () => [...new Set([...`${corpo}\n${anexo}`.matchAll(MARCADOR)].map((m) => m[1]))].filter((m) => !conhecidos.has(m)),
    [corpo, anexo, conhecidos],
  );
  const usados = useMemo(() => new Set([...`${corpo}\n${anexo}`.matchAll(MARCADOR)].map((m) => m[1])), [corpo, anexo]);
  const alterado = titulo !== tituloInicial || corpo !== corpoInicial || anexo !== anexoInicial;

  function inserir(m: string) {
    const ref = alvo === "anexo" ? refAnexo : refCorpo;
    const set = alvo === "anexo" ? setAnexo : setCorpo;
    const ta = ref.current;
    const texto = `{{${m}}}`;
    if (!ta) return;
    const ini = ta.selectionStart ?? ta.value.length;
    const fim = ta.selectionEnd ?? ini;
    set(ta.value.slice(0, ini) + texto + ta.value.slice(fim));
    setAba("texto");
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(ini + texto.length, ini + texto.length); });
  }

  const previa = useMemo(() => {
    const preencher = (t: string) => t.replace(MARCADOR, (bruto, k: string) => (k in exemplo ? `\u0001${exemplo[k]}\u0002` : bruto));
    const corpoP = preencher(corpo);
    const anexoP = anexo.trim() ? `\n\n\nANEXO I\n\n${preencher(anexo.trim())}` : "";
    return escapar(corpoP + anexoP).replace(/\u0001/g, '<span class="preenchido">').replace(/\u0002/g, "</span>");
  }, [corpo, anexo, exemplo]);

  return (
    <form action={enviar} className="editor-contrato">
      <div className="editor-principal cartao">
        <div className="campo">
          <label htmlFor="m-titulo">Título</label>
          <input id="m-titulo" name="titulo" type="text" required value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div className="abas-locais" role="tablist" aria-label="Modo">
          <button type="button" role="tab" aria-selected={aba === "texto"} className={aba === "texto" ? "ativa" : ""} onClick={() => setAba("texto")}>Texto</button>
          <button type="button" role="tab" aria-selected={aba === "previa"} className={aba === "previa" ? "ativa" : ""} onClick={() => setAba("previa")}>Pré-visualização</button>
        </div>
        {/* os campos ficam sempre no formulário; a prévia só cobre a vista */}
        <div hidden={aba !== "texto"}>
          <div className="campo">
            <label htmlFor="m-corpo">Texto do contrato</label>
            <CaixaMarcada id="m-corpo" nome="corpo" valor={corpo} aoMudar={setCorpo} linhas={24} conhecidos={conhecidos} aoFocar={() => setAlvo("corpo")} refTexto={refCorpo} />
          </div>
          <div className="campo">
            <label htmlFor="m-anexo">Anexo I (política)</label>
            <CaixaMarcada id="m-anexo" nome="anexo" valor={anexo} aoMudar={setAnexo} linhas={12} conhecidos={conhecidos} aoFocar={() => setAlvo("anexo")} refTexto={refAnexo} />
          </div>
        </div>
        {aba === "previa" && (
          <div>
            <p className="aviso info" style={{ marginTop: 0 }}>Exemplo com dados fictícios do cliente e do evento, só para ver como fica. Nada aqui é gravado.</p>
            <pre className="texto-contrato previa" dangerouslySetInnerHTML={{ __html: previa }} />
          </div>
        )}
        {desconhecidos.length > 0 && (
          <p className="aviso erro" role="note">Marcador que o sistema não conhece (fica em vermelho): {desconhecidos.map((d) => `{{${d}}}`).join(", ")}. Corrija antes de salvar.</p>
        )}
        <div className="campo" style={{ marginTop: 12 }}>
          <label htmlFor="m-obs">O que mudou</label>
          <input id="m-obs" name="observacao" type="text" required placeholder="Ex.: revisão do advogado, cláusula 3.3" />
        </div>
        <Retorno estado={estado} />
        <div className="janela-rodape">
          {alterado && <span className="mudo pequeno" style={{ marginRight: "auto", alignSelf: "center" }}>Alterações ainda não salvas</span>}
          <button className="botao" disabled={enviando || desconhecidos.length > 0}>{enviando ? "Salvando…" : "Salvar como nova versão"}</button>
        </div>
      </div>

      <aside className="cartao editor-lateral">
        <h2>Marcadores</h2>
        <p className="mudo pequeno" style={{ marginTop: 0 }}>Arraste para dentro do texto ou clique para pôr onde está o cursor. O sistema troca cada um pelos dados da reserva.</p>
        <ul className="lista-marcadores">
          {marcadores.map((m) => (
            <li key={m}>
              <button
                type="button" draggable
                onDragStart={(e) => { e.dataTransfer.setData("text/plain", `{{${m}}}`); e.dataTransfer.effectAllowed = "copy"; }}
                onClick={() => inserir(m)}
                className={usados.has(m) ? "marcador usado" : "marcador"}
                title={`Inserir {{${m}}}`}
              >
                <GripVertical aria-hidden />
                <span><code>{`{{${m}}}`}</code><small>{DESCRICOES[m] ?? ""}</small></span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </form>
  );
}
