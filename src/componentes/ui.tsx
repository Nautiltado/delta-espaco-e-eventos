import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

type Tom = "padrao" | "alerta" | "erro" | "info" | "marca";

/** Cartão de indicador: rótulo, valor grande, detalhe e ícone. Com href vira atalho. */
export function Indicador({ rotulo, valor, detalhe, icone: Icone, tom = "padrao", href }: {
  rotulo: string; valor: React.ReactNode; detalhe?: React.ReactNode; icone?: LucideIcon; tom?: Tom; href?: string;
}) {
  const classe = `kpi${tom !== "padrao" ? ` tom-${tom}` : ""}`;
  const corpo = (
    <>
      {Icone && <span className="kpi-icone" aria-hidden><Icone strokeWidth={1.9} /></span>}
      <span className="kpi-rotulo">{rotulo}</span>
      <span className="kpi-valor">{valor}</span>
      {detalhe && <span className="kpi-detalhe">{detalhe}</span>}
    </>
  );
  return href ? <Link href={href} className={classe}>{corpo}</Link> : <div className={classe}>{corpo}</div>;
}

/** Estado vazio com ícone, título curto e uma frase do que fazer. */
export function Vazio({ titulo, texto, icone: Icone = Inbox, acao, compacto }: { titulo: string; texto?: React.ReactNode; icone?: LucideIcon; acao?: React.ReactNode; compacto?: boolean }) {
  return (
    <div className={compacto ? "vazio compacto" : "vazio"}>
      <span className="vazio-icone" aria-hidden><Icone strokeWidth={1.8} /></span>
      <strong>{titulo}</strong>
      {texto && <p>{texto}</p>}
      {acao && <div style={{ marginTop: 8 }}>{acao}</div>}
    </div>
  );
}

/** Abas por link (cada aba é um endereço, então o filtro sobrevive ao recarregar e ao voltar). */
export function Abas({ itens, rotulo }: { itens: { href: string; rotulo: string; conta?: number; ativa: boolean }[]; rotulo: string }) {
  return (
    <nav className="abas" aria-label={rotulo}>
      {itens.map((i) => (
        <Link key={i.href} href={i.href} className="aba" aria-current={i.ativa ? "page" : undefined} scroll={false}>
          {i.rotulo}
          {i.conta !== undefined && <span className="conta">{i.conta}</span>}
        </Link>
      ))}
    </nav>
  );
}

/** Cabeçalho de cartão com título, contagem e ação à direita. */
export function TituloCartao({ titulo, conta, acao }: { titulo: string; conta?: number; acao?: React.ReactNode }) {
  return (
    <div className="cartao-cabecalho">
      <h2>{titulo}{conta !== undefined && <span className="conta">{conta}</span>}</h2>
      {acao}
    </div>
  );
}
