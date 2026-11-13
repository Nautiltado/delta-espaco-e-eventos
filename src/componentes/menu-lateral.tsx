"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Menu as IconeMenu, MoreHorizontal } from "lucide-react";
import { GRUPOS_MENU, SUBPAGINAS, type GrupoMenu, type ItemMenu } from "@/lib/permissoes";
import { ICONES_MENU } from "./icones-menu";

const ativoEm = (href: string, caminho: string) => (href === "/" ? caminho === "/" : caminho === href || caminho.startsWith(`${href}/`));

/** Item ativo = o de endereço mais específico que bate (Cozinha ganha de Encomendas em /salgados/cozinha). */
function ativoNoMenu(href: string, caminho: string, todos: ItemMenu[]): boolean {
  const sub = SUBPAGINAS.find((s) => s.prefixo.test(caminho));
  if (sub && !todos.some((o) => o.href === caminho)) return href === sub.pai;
  if (!ativoEm(href, caminho)) return false;
  return !todos.some((o) => o.href.length > href.length && ativoEm(o.href, caminho));
}

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
  const grupos = (Object.keys(GRUPOS_MENU) as GrupoMenu[]).map((g) => ({ g, lista: itens.filter((i) => i.grupo === g) })).filter((x) => x.lista.length);
  return (
    <div className="menu-grupos">
      {grupos.map(({ g, lista }) => (
        <div key={g}>
          <p className="menu-titulo" id={`menu-${g}`}>{GRUPOS_MENU[g]}</p>
          <ul className="menu" aria-labelledby={`menu-${g}`}>
            {lista.map((item) => {
              const Icone = ICONES_MENU[item.href];
              const ativo = ativoNoMenu(item.href, caminho, itens);
              return (
                <li key={item.href}>
                  <Link href={item.href} aria-current={ativo ? "page" : undefined} title={item.rotulo}>
                    {Icone && <Icone aria-hidden strokeWidth={1.8} />}
                    <span className="rotulo">{item.rotulo}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Trilha da página atual: grupo › tela › subpágina. */
export function Migalhas({ itens }: { itens: ItemMenu[] }) {
  const caminho = usePathname();
  const sub = SUBPAGINAS.find((s) => s.prefixo.test(caminho)) && !itens.some((i) => i.href === caminho)
    ? SUBPAGINAS.find((s) => s.prefixo.test(caminho)) : undefined;
  const item = itens.find((i) => i.href === (sub?.pai ?? "")) ?? itens.find((i) => ativoNoMenu(i.href, caminho, itens));
  if (!item) return <ol className="migalhas"><li aria-current="page">Delta Gestão</li></ol>;
  return (
    <ol className="migalhas" aria-label="Você está em">
      <li>{GRUPOS_MENU[item.grupo]}</li>
      {sub ? (
        <>
          <li><Link href={item.href}>{item.rotulo}</Link></li>
          <li aria-current="page">{sub.rotulo}</li>
        </>
      ) : (
        <li aria-current="page">{item.rotulo}</li>
      )}
    </ol>
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
      <IconeMenu aria-hidden /> Menu
    </button>
  );
}

/** Barra de baixo no celular: os atalhos do dia a dia, ao alcance do polegar. */
export function BarraInferior({ itens }: { itens: ItemMenu[] }) {
  const caminho = usePathname();
  // Os 4 primeiros que a pessoa pode usar, na ordem do dia a dia (a cozinha vê Cozinha e Tarefas, por exemplo).
  const principais = ["/", "/agenda", "/orcamentos", "/salgados", "/salgados/cozinha", "/eventos", "/clientes", "/tarefas"]
    .map((h) => itens.find((i) => i.href === h && !i.fase))
    .filter((i): i is ItemMenu => !!i)
    .slice(0, 4);
  return (
    <nav className="barra-inferior" aria-label="Atalhos">
      {principais.map((i) => {
        const Icone = ICONES_MENU[i.href];
        return (
          <Link key={i.href} href={i.href} aria-current={ativoNoMenu(i.href, caminho, itens) ? "page" : undefined}>
            {Icone && <Icone aria-hidden strokeWidth={1.8} />}
            {i.href === "/" ? "Início" : i.rotulo}
          </Link>
        );
      })}
      <button type="button" onClick={alternarMenu}>
        <MoreHorizontal aria-hidden strokeWidth={1.8} />
        Mais
      </button>
    </nav>
  );
}
