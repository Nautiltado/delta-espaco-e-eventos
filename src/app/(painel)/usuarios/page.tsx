import type { Metadata } from "next";
import Link from "next/link";
import { exigirPermissao } from "@/lib/acesso";
import { criarClienteServidor } from "@/lib/supabase/server";
import { NOMES_PERFIS } from "@/lib/permissoes";
import { instanteAtual } from "@/lib/datas";
import { PainelUsuarios, type UsuarioLista, type PerfilComPermissoes } from "./painel";

export const metadata: Metadata = { title: "Usuários" };

const POR_PAGINA = 20;

export default async function PaginaUsuarios({
  searchParams,
}: { searchParams: Promise<{ q?: string; perfil?: string; situacao?: string; acesso?: string; pagina?: string }> }) {
  const acesso = await exigirPermissao("config.critica");
  const q = await searchParams;
  const supabase = await criarClienteServidor();
  const [{ data: lista, error }, { data: perfis }, { data: pp }, { data: permissoes }] = await Promise.all([
    supabase.rpc("lista_usuarios"),
    supabase.from("perfis").select("codigo, nome").order("codigo"),
    supabase.from("perfis_permissoes").select("perfil, permissao"),
    supabase.from("permissoes").select("codigo, descricao").order("codigo"),
  ]);
  const todos = (lista ?? []) as UsuarioLista[];
  const agora = instanteAtual();
  const busca = (q.q ?? "").trim().toLocaleLowerCase("pt-BR");
  const filtrados = todos.filter((u) =>
    (!busca || u.nome.toLocaleLowerCase("pt-BR").includes(busca) || u.email.includes(busca))
    && (!q.perfil || u.perfis.includes(q.perfil))
    && (!q.situacao || u.situacao === q.situacao)
    && (!q.acesso || (q.acesso === "nunca" ? !u.ultimo_acesso : q.acesso === "30" ? !!u.ultimo_acesso && agora - Date.parse(u.ultimo_acesso) > 30 * 864e5 : !!u.ultimo_acesso && agora - Date.parse(u.ultimo_acesso) <= 7 * 864e5)));
  const pagina = Math.max(1, Number(q.pagina) || 1);
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const visiveis = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const descricoes = new Map((permissoes ?? []).map((p) => [p.codigo as string, (p.descricao as string | null) ?? p.codigo]));
  const perfisCompletos: PerfilComPermissoes[] = (perfis ?? []).map((p) => ({
    codigo: p.codigo, nome: NOMES_PERFIS[p.codigo] ?? p.nome,
    permissoes: (pp ?? []).filter((x) => x.perfil === p.codigo).map((x) => x.permissao as string).sort(),
  }));
  const link = (mudar: Record<string, string | undefined>) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: q.q, perfil: q.perfil, situacao: q.situacao, acesso: q.acesso, ...mudar })) if (v) s.set(k, v);
    return `/usuarios${s.size ? `?${s}` : ""}`;
  };
  const contagem = (s: string) => todos.filter((u) => u.situacao === s).length;

  return (
    <>
      {error && <p className="aviso erro">Não foi possível carregar os usuários.</p>}
      <PainelUsuarios
        usuarios={visiveis}
        todosAtivos={todos.filter((u) => u.ativo).map((u) => ({ id: u.id, nome: u.nome }))}
        perfis={perfisCompletos}
        descricoes={Object.fromEntries(descricoes)}
        euId={acesso.id}
        filtros={{ q: q.q ?? "", perfil: q.perfil ?? "", situacao: q.situacao ?? "", acesso: q.acesso ?? "" }}
        resumo={{ total: todos.length, ativos: contagem("ativo"), pendentes: contagem("convite_pendente") + contagem("convite_enviado") + contagem("primeiro_acesso") + contagem("convite_expirado"), desativados: contagem("desativado") }}
      />
      {totalPaginas > 1 && (
        <div className="linha" style={{ justifyContent: "space-between", marginTop: 12 }}>
          {pagina > 1 ? <Link className="botao secundario pequeno" href={link({ pagina: String(pagina - 1) })}>← Anterior</Link> : <span />}
          <span className="mudo pequeno">Página {pagina} de {totalPaginas} · {filtrados.length} usuários</span>
          {pagina < totalPaginas ? <Link className="botao secundario pequeno" href={link({ pagina: String(pagina + 1) })}>Próxima →</Link> : <span />}
        </div>
      )}
    </>
  );
}
