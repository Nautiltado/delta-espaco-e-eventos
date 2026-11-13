"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

/**
 * Avisos que aparecem no canto da tela e somem sozinhos (toasts).
 * Qualquer componente chama avisar("texto"); a caixa fica no layout do painel.
 */
type Tom = "ok" | "erro" | "info";
type Aviso = { id: number; texto: string; tom: Tom };
type Ouvinte = (a: Aviso) => void;

const ouvintes = new Set<Ouvinte>();
let proximo = 1;

export function avisar(texto: string, tom: Tom = "ok") {
  const a = { id: proximo++, texto, tom };
  ouvintes.forEach((o) => o(a));
}

const DURACAO: Record<Tom, number> = { ok: 3500, info: 5000, erro: 7000 };

export function CaixaDeAvisos() {
  const [lista, setLista] = useState<Aviso[]>([]);
  useEffect(() => {
    const ouvir: Ouvinte = (a) => {
      setLista((l) => [...l.slice(-3), a]);
      setTimeout(() => setLista((l) => l.filter((x) => x.id !== a.id)), DURACAO[a.tom]);
    };
    ouvintes.add(ouvir);
    return () => { ouvintes.delete(ouvir); };
  }, []);
  return (
    <div className="toasts" aria-hidden>
      {lista.map((a) => {
        const Icone = a.tom === "ok" ? CheckCircle2 : a.tom === "erro" ? AlertTriangle : Info;
        return (
          <div key={a.id} className={`toast ${a.tom}`}>
            <Icone aria-hidden strokeWidth={2} />
            <span>{a.texto}</span>
            <button type="button" className="toast-fechar" onClick={() => setLista((l) => l.filter((x) => x.id !== a.id))} tabIndex={-1}>
              <X aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Dentro de uma janela (modal), o retorno de sucesso fecha a janela. */
export const ContextoJanela = createContext<{ fechar: () => void } | null>(null);
export const useJanela = () => useContext(ContextoJanela);

/**
 * Retorno de uma ação de formulário. Sucesso vira toast (e fecha a janela, se houver);
 * erro vira toast e também fica escrito junto do formulário, para a pessoa corrigir.
 * O texto de sucesso fica só para leitores de tela (role=status).
 */
export function Retorno({ estado, fechar = true }: { estado: { ok?: string; erro?: string }; fechar?: boolean }) {
  const janela = useJanela();
  const visto = useRef<object | null>(null);
  useEffect(() => {
    if (visto.current === estado) return;
    visto.current = estado;
    if (estado.ok) {
      avisar(estado.ok, "ok");
      if (fechar && janela) janela.fechar();
    } else if (estado.erro) avisar(estado.erro, "erro");
  }, [estado, janela, fechar]);
  if (estado.erro) return <p className="aviso erro" role="alert">{estado.erro}</p>;
  if (estado.ok) return <p className="aviso ok so-leitor" role="status">{estado.ok}</p>;
  return null;
}

/** Aviso vindo do endereço (?salvo=1 etc.): mostra o toast uma vez. */
export function AvisoDaPagina({ texto, tom = "ok" }: { texto: string; tom?: Tom }) {
  const feito = useRef(false);
  useEffect(() => {
    if (feito.current) return;
    feito.current = true;
    avisar(texto, tom);
  }, [texto, tom]);
  return <p className={`aviso ${tom} so-leitor`} role="status">{texto}</p>;
}
