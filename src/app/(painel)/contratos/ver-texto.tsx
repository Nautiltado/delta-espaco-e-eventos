"use client";

import { useState, useTransition } from "react";
import { Eye } from "lucide-react";
import { Janela } from "@/componentes/janela";
import { carregarTextoContrato } from "./actions";

export function VerTextoContrato({ id, numero }: { id: string; numero: string }) {
  const [aberta, setAberta] = useState(false);
  const [texto, setTexto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, iniciar] = useTransition();
  const abrir = () => {
    setAberta(true);
    if (texto) return;
    iniciar(async () => {
      const r = await carregarTextoContrato(id);
      if (r.erro) setErro(r.erro); else setTexto(r.texto ?? "");
    });
  };
  return (
    <>
      <button type="button" className="botao-icone" onClick={abrir} aria-label="Ver texto do contrato" data-dica="Ver texto"><Eye aria-hidden /></button>
      <Janela aberta={aberta} aoFechar={() => setAberta(false)} titulo={numero} larga descricao="Texto gravado na hora em que o contrato foi gerado.">
        {carregando && <p className="mudo">Carregando…</p>}
        {erro && <p className="aviso erro" role="alert">{erro}</p>}
        {texto && <pre className="texto-contrato">{texto}</pre>}
      </Janela>
    </>
  );
}
