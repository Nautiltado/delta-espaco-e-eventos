"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { prepararComprovante, registrarComprovante, removerComprovante, type Estado } from "./actions";
import { comprimirImagem } from "@/lib/comprimir-imagem";
import { TAMANHO_MAXIMO, TIPOS_COMPROVANTE, tamanhoLegivel } from "@/lib/comprovantes";
import { criarClienteNavegador } from "@/lib/supabase/navegador";
import { Retorno } from "./componentes";

/** Anexa um ou vários comprovantes (foto ou PDF) de uma vez. */
export function EnviarComprovantes({ reservaId, pagamentos }: { reservaId: string; pagamentos: { id: string; rotulo: string }[] }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [pagamento, setPagamento] = useState("");
  const [descricao, setDescricao] = useState("");
  const [estado, setEstado] = useState<Estado>({});
  const [progresso, setProgresso] = useState<string | null>(null);

  async function enviar() {
    if (!arquivos.length) return setEstado({ erro: "Escolha ao menos um arquivo." });
    setEstado({});
    const cliente = criarClienteNavegador();
    let enviados = 0;
    for (const [n, original] of arquivos.entries()) {
      setProgresso(`Enviando ${n + 1} de ${arquivos.length}…`);
      if (!(original.type in TIPOS_COMPROVANTE)) {
        setEstado({ erro: `${original.name}: envie foto (JPG, PNG, WEBP, HEIC) ou PDF.` });
        break;
      }
      const { blob, tipo, nome } = await comprimirImagem(original);
      if (blob.size > TAMANHO_MAXIMO) {
        setEstado({ erro: `${original.name} tem ${tamanhoLegivel(blob.size)}; o limite é 10 MB.` });
        break;
      }
      const preparo = await prepararComprovante(reservaId, tipo, blob.size);
      if ("erro" in preparo) { setEstado({ erro: preparo.erro }); break; }
      const { error } = await cliente.storage.from("comprovantes").uploadToSignedUrl(preparo.caminho, preparo.token, blob, { contentType: tipo });
      if (error) { setEstado({ erro: `Falha ao enviar ${original.name}. Confira a internet e tente de novo.` }); break; }
      const r = await registrarComprovante({ reservaId, caminho: preparo.caminho, nome, tipo, tamanho: blob.size, pagamentoId: pagamento || null, descricao });
      if (r.erro) { setEstado(r); break; }
      enviados++;
    }
    setProgresso(null);
    if (enviados) {
      setEstado((e) => e.erro ? e : { ok: enviados === 1 ? "Comprovante anexado." : `${enviados} comprovantes anexados.` });
      setArquivos([]);
      setDescricao("");
      if (entrada.current) entrada.current.value = "";
      router.refresh();
    }
  }

  return (
    <div>
      <Retorno estado={estado} />
      <div className="campo">
        <label htmlFor="c-arquivos">Fotos ou PDFs dos comprovantes</label>
        <input id="c-arquivos" ref={entrada} type="file" multiple accept="image/*,application/pdf"
          onChange={(e) => setArquivos(Array.from(e.target.files ?? []))} />
        {arquivos.length > 1 && <small className="mudo">{arquivos.length} arquivos escolhidos</small>}
      </div>
      {pagamentos.length > 0 && (
        <div className="campo">
          <label htmlFor="c-pagamento">De qual pagamento (opcional)</label>
          <select id="c-pagamento" value={pagamento} onChange={(e) => setPagamento(e.target.value)}>
            <option value="">Não ligar a um pagamento</option>
            {pagamentos.map((p) => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
          </select>
        </div>
      )}
      <div className="campo">
        <label htmlFor="c-desc">Observação (opcional)</label>
        <input id="c-desc" type="text" value={descricao} maxLength={300} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Pix da entrada enviado pela mãe da noiva" />
      </div>
      <button type="button" className="botao" onClick={enviar} disabled={!!progresso}>{progresso ?? "Anexar"}</button>
    </div>
  );
}

export function RemoverComprovante({ comprovanteId }: { comprovanteId: string }) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(removerComprovante, {});
  return (
    <details>
      <summary style={{ cursor: "pointer", fontSize: ".8rem" }} className="mudo">Tirar da lista</summary>
      <form action={enviar} style={{ marginTop: 6 }}>
        <input type="hidden" name="comprovante_id" value={comprovanteId} />
        <Retorno estado={estado} />
        <input name="motivo" type="text" required placeholder="Motivo (ex.: arquivo errado)" style={{ marginBottom: 6 }} />
        <button className="botao secundario pequeno" disabled={enviando}>Tirar da lista</button>
      </form>
    </details>
  );
}
