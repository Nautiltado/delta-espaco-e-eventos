"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontal, X } from "lucide-react";
import { ContextoJanela } from "./avisos";

/** Janela (modal) nativa: Esc fecha, foco preso dentro, fundo escurecido. */
export function Janela({ aberta, aoFechar, titulo, descricao, larga, children }: {
  aberta: boolean; aoFechar: () => void; titulo: string; descricao?: React.ReactNode; larga?: boolean; children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberta && !d.open) d.showModal();
    if (!aberta && d.open) d.close();
  }, [aberta]);
  return (
    <dialog
      ref={ref}
      className={larga ? "janela larga" : "janela"}
      onClose={aoFechar}
      onMouseDown={(e) => { if (e.target === ref.current) aoFechar(); }}
      aria-labelledby="janela-titulo"
    >
      {aberta && (
        <ContextoJanela.Provider value={{ fechar: aoFechar }}>
          <div className="janela-topo">
            <div>
              <h2 id="janela-titulo">{titulo}</h2>
              {descricao && <p className="mudo pequeno">{descricao}</p>}
            </div>
            <button type="button" className="botao-icone" onClick={aoFechar} aria-label="Fechar" data-dica="Fechar"><X aria-hidden /></button>
          </div>
          <div className="janela-corpo">{children}</div>
        </ContextoJanela.Provider>
      )}
    </dialog>
  );
}

/** Botão que abre uma janela com o conteúdo dado (normalmente um formulário). */
export function BotaoJanela({ rotulo, titulo, descricao, icone, classe = "botao", larga, somenteIcone, children }: {
  rotulo: string; titulo?: string; descricao?: React.ReactNode; icone?: React.ReactNode; classe?: string; larga?: boolean;
  somenteIcone?: boolean; children: React.ReactNode | ((fechar: () => void) => React.ReactNode);
}) {
  const [aberta, setAberta] = useState(false);
  const fechar = useCallback(() => setAberta(false), []);
  return (
    <>
      {somenteIcone && icone ? (
        <button type="button" className="botao-icone" onClick={() => setAberta(true)} aria-label={rotulo} data-dica={rotulo}>
          {icone}
        </button>
      ) : (
        <button type="button" className={classe} onClick={() => setAberta(true)}>
          {icone}{icone ? " " : ""}{rotulo}
        </button>
      )}
      <Janela aberta={aberta} aoFechar={fechar} titulo={titulo ?? rotulo} descricao={descricao} larga={larga}>
        {typeof children === "function" ? children(fechar) : children}
      </Janela>
    </>
  );
}

/** Ícone com legenda ao passar o mouse; vira link quando recebe href. */
export function BotaoIcone({ icone, rotulo, href, onClick, tipo = "button", perigo, desabilitado }: {
  icone: React.ReactNode; rotulo: string; href?: string; onClick?: () => void; tipo?: "button" | "submit"; perigo?: boolean; desabilitado?: boolean;
}) {
  const classe = perigo ? "botao-icone perigo" : "botao-icone";
  if (href) return <Link href={href} className={classe} aria-label={rotulo} data-dica={rotulo}>{icone}</Link>;
  return (
    <button type={tipo} className={classe} onClick={onClick} aria-label={rotulo} data-dica={rotulo} disabled={desabilitado}>
      {icone}
    </button>
  );
}

/** Menu de três pontinhos: junta as ações de uma linha num lugar só. */
export function MenuAcoes({ rotulo = "Mais ações", itens }: {
  rotulo?: string;
  itens: ({ rotulo: string; icone?: React.ReactNode; href?: string; onClick?: () => void; perigo?: boolean } | false | null | undefined)[];
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);
  const validos = itens.filter(Boolean) as Exclude<(typeof itens)[number], false | null | undefined>[];
  return (
    <div className="menu-acoes" ref={ref}>
      <button type="button" className="botao-icone" aria-label={rotulo} data-dica={rotulo} aria-expanded={aberto} aria-haspopup="menu" onClick={() => setAberto((a) => !a)}>
        <MoreHorizontal aria-hidden />
      </button>
      {aberto && (
        <div className="menu-acoes-lista" role="menu">
          {validos.map((i) => {
            const conteudo = <>{i.icone}{i.rotulo}</>;
            return i.href ? (
              <Link key={i.rotulo} href={i.href} role="menuitem" className={i.perigo ? "perigo" : undefined} onClick={() => setAberto(false)}>{conteudo}</Link>
            ) : (
              <button key={i.rotulo} type="button" role="menuitem" className={i.perigo ? "perigo" : undefined} onClick={() => { setAberto(false); i.onClick?.(); }}>{conteudo}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}
