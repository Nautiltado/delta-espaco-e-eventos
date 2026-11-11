"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { ItemMenu } from "@/lib/permissoes";

const ativoEm = (href: string, caminho: string) => (href === "/" ? caminho === "/" : caminho.startsWith(href));

/** Fecha o menu do celular a cada troca de página. */
function useFecharAoNavegar() {
  const caminho = usePathname();
  useEffect(() => {
    document.documentElement.removeAttribute("data-menu");
  }, [caminho]);
  return caminho;
}

export function MenuLateral({ itens }: { itens: ItemMenu[] }) {
  const caminho = useFecharAoNavegar();
  return (
    <ul className="menu">
      {itens.map((item) => {
        if (item.fase) {
          return (
            <li key={item.href}>
              <span className="futuro" title={`Chega na Fase ${item.fase}`}>
                {item.rotulo} <small>Fase {item.fase}</small>
              </span>
            </li>
          );
        }
        const ativo = ativoEm(item.href, caminho);
        return (
          <li key={item.href}>
            <Link href={item.href} aria-current={ativo ? "page" : undefined}>
              {item.rotulo}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function alternarMenu() {
  const raiz = document.documentElement;
  if (raiz.hasAttribute("data-menu")) raiz.removeAttribute("data-menu");
  else raiz.setAttribute("data-menu", "aberto");
}

/** Barra de cima no celular: marca e botão do menu completo. */
export function BotaoMenu() {
  return (
    <button type="button" className="botao-menu" onClick={alternarMenu} aria-label="Abrir ou fechar o menu">
      <span aria-hidden>☰</span> Menu
    </button>
  );
}

const ICONES: Record<string, string> = { "/": "⌂", "/agenda": "▦", "/orcamentos": "✎", "/clientes": "☺", "/financeiro": "R$", "/tarefas": "✓" };

/** Barra de baixo no celular: os atalhos do dia a dia, ao alcance do polegar. */
export function BarraInferior({ itens }: { itens: ItemMenu[] }) {
  const caminho = usePathname();
  const principais = ["/", "/agenda", "/orcamentos", "/clientes"]
    .map((h) => itens.find((i) => i.href === h && !i.fase))
    .filter((i): i is ItemMenu => !!i);
  return (
    <nav className="barra-inferior" aria-label="Atalhos">
      {principais.map((i) => (
        <Link key={i.href} href={i.href} aria-current={ativoEm(i.href, caminho) ? "page" : undefined}>
          <span aria-hidden className="icone">{ICONES[i.href]}</span>
          {i.href === "/" ? "Início" : i.rotulo}
        </Link>
      ))}
      <button type="button" onClick={alternarMenu}>
        <span aria-hidden className="icone">☰</span>
        Mais
      </button>
    </nav>
  );
}
