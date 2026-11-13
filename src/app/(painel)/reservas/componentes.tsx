"use client";

import { Retorno } from "@/componentes/avisos";

import { useActionState, useState } from "react";
import {
  bloquearAgenda,
  cancelarReserva,
  estornarPagamento,
  gerarContrato,
  registrarAssinatura,
  registrarPagamento,
  reservarData,
  salvarModeloContrato,
  type Estado,
} from "./actions";
import { centavosParaCampo, formatarCentavos } from "@/lib/dinheiro";
import { FORMAS_ASSINATURA, FORMAS_PAGAMENTO, INICIATIVAS } from "@/lib/reservas";

type Acao = (e: Estado, f: FormData) => Promise<Estado>;

export { Retorno };

/** Botão que dispara uma ação com campos escondidos. */
export function BotaoAcao({
  acao,
  campos,
  texto,
  classe = "botao",
  ajuda,
  confirmar,
}: {
  acao: Acao;
  campos: Record<string, string>;
  texto: string;
  classe?: string;
  ajuda?: string;
  /** Ação destrutiva: pede confirmação na própria tela antes de enviar (a pergunta aparece no lugar do botão). */
  confirmar?: string;
}) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(acao, {});
  const [perguntando, setPerguntando] = useState(false);
  return (
    <form action={(f) => { setPerguntando(false); return enviar(f); }} style={{ marginBottom: 8 }}>
      {Object.entries(campos).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <Retorno estado={estado} />
      {confirmar && perguntando ? (
        <div className="confirmacao" role="alertdialog" aria-label={confirmar}>
          <span>{confirmar}</span>
          <div className="linha">
            <button className="botao perigo pequeno" disabled={enviando} autoFocus>{enviando ? "Aguarde…" : `Sim, ${texto.charAt(0).toLowerCase()}${texto.slice(1)}`}</button>
            <button type="button" className="botao fantasma pequeno" onClick={() => setPerguntando(false)}>Cancelar</button>
          </div>
        </div>
      ) : confirmar ? (
        <button type="button" className={classe} disabled={enviando} onClick={() => setPerguntando(true)}>{enviando ? "Aguarde…" : texto}</button>
      ) : (
        <button className={classe} disabled={enviando}>{enviando ? "Aguarde…" : texto}</button>
      )}
      {ajuda && <p className="mudo" style={{ margin: "4px 0 0", fontSize: ".85rem" }}>{ajuda}</p>}
    </form>
  );
}

// ------------------------------------------------------------------ reservar data

export function FormularioReservarData({
  orcamentoId,
  espacos,
  externo,
  dataInicial,
  espacoInicial,
}: {
  orcamentoId: string;
  espacos: { id: string; nome: string; capacidade: number | null }[];
  externo: boolean;
  dataInicial: string;
  espacoInicial: string | null;
}) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(reservarData, {});
  const [inicio, setInicio] = useState("19:00");
  const [fim, setFim] = useState("23:00");
  const virada = fim && inicio && fim <= inicio;
  return (
    <form action={enviar}>
      <input type="hidden" name="orcamento_id" value={orcamentoId} />
      <Retorno estado={estado} />
      <div className="campo">
        <label htmlFor="r-data">Data do evento</label>
        <input id="r-data" name="data" type="date" required defaultValue={dataInicial} />
      </div>
      <div className="linha" style={{ marginBottom: 12 }}>
        <div className="campo">
          <label htmlFor="r-inicio">Início</label>
          <input id="r-inicio" name="inicio" type="time" required value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="r-fim">Término</label>
          <input id="r-fim" name="fim" type="time" required value={fim} onChange={(e) => setFim(e.target.value)} />
        </div>
      </div>
      {virada && <p className="aviso info">Término no dia seguinte (o evento atravessa a madrugada).</p>}
      {!externo && (
        <fieldset className="campo" style={{ border: 0, padding: 0 }}>
          <legend style={{ fontWeight: 600, marginBottom: 4 }}>Espaço</legend>
          <div className="opcoes">
            {espacos.map((e) => (
              <label key={e.id}>
                <input type="checkbox" name="recursos" value={e.id} defaultChecked={e.id === espacoInicial} /> {e.nome}
                {e.capacidade ? <span className="mudo"> (até {e.capacidade})</span> : null}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <button className="botao" disabled={enviando}>{enviando ? "Conferindo a agenda…" : "Segurar a data"}</button>
      <p className="mudo" style={{ fontSize: ".85rem", marginBottom: 0 }}>
        A data fica segura por 24 horas, com 4 horas de limpeza depois do término. Ela só vira reserva com contrato assinado e entrada paga.
      </p>
    </form>
  );
}

// ------------------------------------------------------------------ contrato

export function FormularioGerarContrato({ reservaId, regenerar }: { reservaId: string; regenerar: boolean }) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(gerarContrato, {});
  return (
    <form action={enviar}>
      <input type="hidden" name="reserva_id" value={reservaId} />
      <Retorno estado={estado} />
      <div className="campo">
        <label htmlFor="g-sig">Quem assina pela Delta</label>
        <select id="g-sig" name="signatario" defaultValue="principal">
          <option value="principal">Titular (Marileide)</option>
          <option value="alternativo">Na ausência da titular (Leonardo)</option>
        </select>
      </div>
      <div className="campo">
        <label htmlFor="g-canal">Onde o contrato é fechado</label>
        <select id="g-canal" name="canal" defaultValue="estabelecimento">
          <option value="estabelecimento">Na Delta (presencial)</option>
          <option value="fora_estabelecimento">À distância (WhatsApp, e-mail, gov.br)</option>
        </select>
        <small className="mudo">À distância, o cliente pode desistir em 7 dias com devolução integral (CDC art. 49). Isso entra no contrato.</small>
      </div>
      <button className={regenerar ? "botao secundario" : "botao"} disabled={enviando}>
        {enviando ? "Gerando…" : regenerar ? "Gerar nova versão do contrato" : "Gerar contrato"}
      </button>
    </form>
  );
}

export function FormularioAssinatura({ contratoId, hoje }: { contratoId: string; hoje: string }) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(registrarAssinatura, {});
  return (
    <form action={enviar}>
      <input type="hidden" name="contrato_id" value={contratoId} />
      <Retorno estado={estado} />
      <div className="linha" style={{ marginBottom: 12 }}>
        <div className="campo">
          <label htmlFor="a-data">Assinado em</label>
          <input id="a-data" name="data" type="date" required defaultValue={hoje} max={hoje} />
        </div>
        <div className="campo">
          <label htmlFor="a-forma">Como</label>
          <select id="a-forma" name="forma" defaultValue="presencial">
            {Object.entries(FORMAS_ASSINATURA).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </div>
      </div>
      <div className="campo">
        <label htmlFor="a-obs">Observação (opcional)</label>
        <input id="a-obs" name="obs" type="text" placeholder="Ex.: via física arquivada na pasta 2027" />
      </div>
      <button className="botao" disabled={enviando}>{enviando ? "Registrando…" : "Registrar assinatura das duas partes"}</button>
    </form>
  );
}

// ------------------------------------------------------------------ pagamentos

export function FormularioPagamento({ parcelaId, saldo, hoje }: { parcelaId: string; saldo: number; hoje: string }) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(registrarPagamento, {});
  // Campos controlados: se o banco recusar (ex.: identificador repetido), o que foi digitado continua na tela.
  const [forma, setForma] = useState("pix");
  const [valor, setValor] = useState(centavosParaCampo(saldo));
  const [data, setData] = useState(hoje);
  const [idExterno, setIdExterno] = useState("");
  const [referencia, setReferencia] = useState("");
  return (
    <form action={enviar}>
      <input type="hidden" name="parcela_id" value={parcelaId} />
      <Retorno estado={estado} />
      <div className="linha" style={{ marginBottom: 10 }}>
        <div className="campo">
          <label htmlFor={`p-valor-${parcelaId}`}>Valor recebido</label>
          <input id={`p-valor-${parcelaId}`} name="valor" type="text" inputMode="decimal" required value={valor} onChange={(e) => setValor(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor={`p-forma-${parcelaId}`}>Forma</label>
          <select id={`p-forma-${parcelaId}`} name="forma" value={forma} onChange={(e) => setForma(e.target.value)}>
            {Object.entries(FORMAS_PAGAMENTO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor={`p-data-${parcelaId}`}>Entrou na conta em</label>
          <input id={`p-data-${parcelaId}`} name="recebido_em" type="date" required value={data} max={hoje} onChange={(e) => setData(e.target.value)} />
        </div>
      </div>
      {(forma === "pix" || forma === "transferencia") && (
        <div className="campo">
          <label htmlFor={`p-id-${parcelaId}`}>Identificador no extrato (ID da transação)</label>
          <input id={`p-id-${parcelaId}`} name="id_externo" type="text" placeholder="Ex.: E00416968202611111234abcdef"
            value={idExterno} onChange={(e) => setIdExterno(e.target.value)} />
          <small className="mudo">Copie do extrato do Inter. O sistema recusa o mesmo identificador duas vezes.</small>
        </div>
      )}
      <div className="campo">
        <label htmlFor={`p-ref-${parcelaId}`}>Observação (opcional)</label>
        <input id={`p-ref-${parcelaId}`} name="referencia" type="text" placeholder="Ex.: pago pela mãe da noiva"
          value={referencia} onChange={(e) => setReferencia(e.target.value)} />
      </div>
      <button className="botao" disabled={enviando}>{enviando ? "Registrando…" : "Dar baixa (conferi no extrato)"}</button>
    </form>
  );
}

export function FormularioEstorno({ pagamentoId, maximo }: { pagamentoId: string; maximo: number }) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(estornarPagamento, {});
  return (
    <form action={enviar}>
      <input type="hidden" name="pagamento_id" value={pagamentoId} />
      <Retorno estado={estado} />
      <div className="linha" style={{ marginBottom: 8 }}>
        <div className="campo">
          <label htmlFor={`e-v-${pagamentoId}`}>Valor do estorno</label>
          <input id={`e-v-${pagamentoId}`} name="valor" type="text" inputMode="decimal" required defaultValue={centavosParaCampo(maximo)} />
        </div>
        <div className="campo" style={{ flex: 2 }}>
          <label htmlFor={`e-m-${pagamentoId}`}>Motivo</label>
          <input id={`e-m-${pagamentoId}`} name="motivo" type="text" required placeholder="Ex.: lançado em duplicidade" />
        </div>
      </div>
      <button className="botao secundario pequeno" disabled={enviando}>Registrar estorno</button>
    </form>
  );
}

// ------------------------------------------------------------------ cancelamento

export type Calculo = {
  iniciativa: string;
  dias_antes: number;
  faixa: string | null;
  percentual: number;
  base_centavos: number;
  multa_centavos: number;
  pago_centavos: number;
  devolver_centavos: number;
  cobrar_centavos: number;
  elegivel: boolean;
  contrato_assinado: boolean;
  observacao: string | null;
};

export function FormularioCancelamento({ reservaId, calculos }: { reservaId: string; calculos: Record<string, Calculo> }) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(cancelarReserva, {});
  const [iniciativa, setIniciativa] = useState("cliente");
  const [motivo, setMotivo] = useState("");
  const c = calculos[iniciativa];
  return (
    <form action={enviar}>
      <input type="hidden" name="reserva_id" value={reservaId} />
      <Retorno estado={estado} />
      <div className="campo">
        <label htmlFor="c-ini">Quem está cancelando</label>
        <select id="c-ini" name="iniciativa" value={iniciativa} onChange={(e) => setIniciativa(e.target.value)}>
          {Object.entries(INICIATIVAS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
      </div>
      {c && (
        <div className={c.elegivel ? "aviso info" : "aviso erro"} data-teste="calculo-cancelamento">
          {c.faixa && <p style={{ margin: 0 }}>Faltam {c.dias_antes} dias (faixa {c.faixa}): multa de {c.percentual}% sobre {formatarCentavos(c.base_centavos)} = <strong>{formatarCentavos(c.multa_centavos)}</strong>.</p>}
          <p style={{ margin: 0 }}>Recebido até agora: {formatarCentavos(c.pago_centavos)}.</p>
          {c.devolver_centavos > 0 && <p style={{ margin: 0 }}>Devolver ao cliente: <strong>{formatarCentavos(c.devolver_centavos)}</strong>.</p>}
          {c.cobrar_centavos > 0 && <p style={{ margin: 0 }}>Cobrar do cliente: <strong>{formatarCentavos(c.cobrar_centavos)}</strong>.</p>}
          {c.devolver_centavos === 0 && c.cobrar_centavos === 0 && <p style={{ margin: 0 }}>Nada a devolver nem a cobrar.</p>}
          {c.observacao && <p style={{ margin: "4px 0 0" }}>{c.observacao}</p>}
        </div>
      )}
      <div className="campo">
        <label htmlFor="c-mot">Motivo</label>
        <textarea id="c-mot" name="motivo" rows={2} required placeholder="O que aconteceu, como foi comunicado"
          value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </div>
      <label style={{ display: "block", marginBottom: 10 }}>
        <input type="checkbox" name="ciente" value="sim" required /> Conferi os valores e quero cancelar. Isto libera a data e não pode ser desfeito.
      </label>
      <button className="botao secundario" disabled={enviando || (c && !c.elegivel)}>Cancelar a reserva</button>
    </form>
  );
}

// ------------------------------------------------------------------ agenda

export function FormularioBloqueio({ espacos, hoje, dataInicial = "" }: { espacos: { id: string; nome: string }[]; hoje: string; dataInicial?: string }) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(bloquearAgenda, {});
  return (
    <form action={enviar}>
      <Retorno estado={estado} />
      <div className="campo">
        <label htmlFor="b-data">Dia</label>
        <input id="b-data" name="data" type="date" required min={hoje} defaultValue={dataInicial} />
      </div>
      <div className="linha" style={{ marginBottom: 12 }}>
        <div className="campo">
          <label htmlFor="b-ini">De</label>
          <input id="b-ini" name="inicio" type="time" required defaultValue="08:00" />
        </div>
        <div className="campo">
          <label htmlFor="b-fim">Até</label>
          <input id="b-fim" name="fim" type="time" required defaultValue="18:00" />
        </div>
      </div>
      <div className="opcoes" style={{ marginBottom: 12 }}>
        {espacos.map((e) => (
          <label key={e.id}><input type="checkbox" name="recursos" value={e.id} /> {e.nome}</label>
        ))}
      </div>
      <div className="campo">
        <label htmlFor="b-mot">Motivo</label>
        <input id="b-mot" name="motivo" type="text" required placeholder="Ex.: manutenção do ar-condicionado" />
      </div>
      <button className="botao secundario" disabled={enviando}>Bloquear</button>
    </form>
  );
}

// ------------------------------------------------------------------ modelo de contrato

export function FormularioModelo({ titulo, corpo, anexo }: { titulo: string; corpo: string; anexo: string }) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(salvarModeloContrato, {});
  return (
    <form action={enviar}>
      <Retorno estado={estado} />
      <div className="campo">
        <label htmlFor="m-titulo">Título</label>
        <input id="m-titulo" name="titulo" type="text" required defaultValue={titulo} />
      </div>
      <div className="campo">
        <label htmlFor="m-corpo">Texto do contrato</label>
        <textarea id="m-corpo" name="corpo" rows={24} required defaultValue={corpo} style={{ fontFamily: "ui-monospace, monospace", fontSize: ".85rem" }} />
      </div>
      <div className="campo">
        <label htmlFor="m-anexo">Anexo I (política)</label>
        <textarea id="m-anexo" name="anexo" rows={14} defaultValue={anexo} style={{ fontFamily: "ui-monospace, monospace", fontSize: ".85rem" }} />
      </div>
      <div className="campo">
        <label htmlFor="m-obs">O que mudou</label>
        <input id="m-obs" name="observacao" type="text" required placeholder="Ex.: revisão do advogado, cláusula 3.3" />
      </div>
      <button className="botao" disabled={enviando}>Salvar como nova versão</button>
    </form>
  );
}

// ------------------------------------------------------------------ Pix

export function CopiarPix({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div>
      <textarea readOnly value={codigo} rows={3} style={{ width: "100%", fontFamily: "ui-monospace, monospace", fontSize: ".75rem" }} aria-label="Pix copia e cola" />
      <button
        type="button"
        className="botao secundario pequeno"
        onClick={async () => {
          await navigator.clipboard.writeText(codigo);
          setCopiado(true);
        }}
      >
        {copiado ? "Copiado" : "Copiar Pix copia e cola"}
      </button>
    </div>
  );
}
