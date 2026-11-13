import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const POR_PAGINA = 20;

/** Lê ?pagina= do endereço (1 em diante) e devolve o intervalo para o .range() do Supabase. */
export function paginaDoEndereco(valor: string | string[] | undefined, porPagina = POR_PAGINA) {
  const n = Math.max(1, Math.floor(Number(Array.isArray(valor) ? valor[0] : valor) || 1));
  return { pagina: n, de: (n - 1) * porPagina, ate: n * porPagina - 1, porPagina };
}

/** Recorta uma lista já carregada (para telas que filtram em memória). */
export function recortar<T>(lista: T[], pagina: number, porPagina = POR_PAGINA) {
  const ultima = Math.max(1, Math.ceil(lista.length / porPagina));
  const p = Math.min(pagina, ultima);
  return { itens: lista.slice((p - 1) * porPagina, p * porPagina), pagina: p };
}

/**
 * Rodapé de paginação por link: mantém os outros filtros do endereço.
 * Some quando tudo cabe numa página só.
 */
export function Paginacao({ total, pagina, porPagina = POR_PAGINA, caminho, parametros = {} }: {
  total: number; pagina: number; porPagina?: number; caminho: string;
  parametros?: Record<string, string | string[] | undefined>;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (total <= porPagina) return null;
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(parametros)) {
      if (k === "pagina" || v === undefined || v === "") continue;
      for (const x of Array.isArray(v) ? v : [v]) q.append(k, x);
    }
    if (p > 1) q.set("pagina", String(p));
    const s = q.toString();
    return s ? `${caminho}?${s}` : caminho;
  };
  const de = (pagina - 1) * porPagina + 1;
  const ate = Math.min(total, pagina * porPagina);
  // números visíveis: primeira, última e vizinhas da atual
  const nums = [...new Set([1, pagina - 1, pagina, pagina + 1, paginas])].filter((n) => n >= 1 && n <= paginas).sort((a, b) => a - b);
  return (
    <nav className="paginacao" aria-label="Páginas">
      <span className="mudo">{de}–{ate} de {total}</span>
      <div className="paginacao-botoes">
        {pagina > 1 ? (
          <Link href={href(pagina - 1)} className="botao-icone" aria-label="Página anterior" data-dica="Anterior" scroll={false}><ChevronLeft aria-hidden /></Link>
        ) : <span className="botao-icone desabilitado" aria-hidden><ChevronLeft /></span>}
        {nums.map((n, i) => (
          <span key={n} style={{ display: "contents" }}>
            {i > 0 && n - nums[i - 1] > 1 && <span className="mudo">…</span>}
            <Link href={href(n)} className="pagina-num" aria-current={n === pagina ? "page" : undefined} scroll={false}>{n}</Link>
          </span>
        ))}
        {pagina < paginas ? (
          <Link href={href(pagina + 1)} className="botao-icone" aria-label="Próxima página" data-dica="Próxima" scroll={false}><ChevronRight aria-hidden /></Link>
        ) : <span className="botao-icone desabilitado" aria-hidden><ChevronRight /></span>}
      </div>
    </nav>
  );
}
