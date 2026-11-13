"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { CHAVE_TEMA as CHAVE } from "@/lib/tema";

export type Tema = "claro" | "escuro" | "auto";
const EVENTO = "delta-tema";

function ler(): Tema {
  try {
    const t = localStorage.getItem(CHAVE);
    return t === "claro" || t === "escuro" ? t : "auto";
  } catch {
    return "auto";
  }
}

function assinar(aviso: () => void) {
  window.addEventListener(EVENTO, aviso);
  window.addEventListener("storage", aviso);
  return () => {
    window.removeEventListener(EVENTO, aviso);
    window.removeEventListener("storage", aviso);
  };
}

function escolher(t: Tema) {
  try {
    localStorage.setItem(CHAVE, t);
  } catch {
    /* navegação privada: vale só nesta aba */
  }
  document.documentElement.setAttribute("data-tema", t);
  window.dispatchEvent(new Event(EVENTO));
}

const OPCOES: { valor: Tema; rotulo: string; Icone: typeof Sun }[] = [
  { valor: "claro", rotulo: "Claro", Icone: Sun },
  { valor: "escuro", rotulo: "Escuro", Icone: Moon },
  { valor: "auto", rotulo: "Automático (segue o aparelho)", Icone: Monitor },
];

/** Claro, escuro ou automático. A escolha fica salva neste aparelho. */
export function SeletorTema() {
  const atual = useSyncExternalStore(assinar, ler, () => "auto" as Tema);
  return (
    <div className="seletor-tema" role="radiogroup" aria-label="Aparência">
      {OPCOES.map(({ valor, rotulo, Icone }) => (
        <button key={valor} type="button" role="radio" aria-checked={atual === valor} aria-label={rotulo} title={rotulo}
          className={atual === valor ? "ativo" : undefined} onClick={() => escolher(valor)}>
          <Icone aria-hidden strokeWidth={1.9} />
        </button>
      ))}
    </div>
  );
}
