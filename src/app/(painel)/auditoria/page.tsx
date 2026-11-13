import type { Metadata } from "next";
import Link from "next/link";
import { exigirPermissao } from "@/lib/acesso";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Auditoria" };

const POR_PAGINA = 50;

const TABELAS: Record<string, string> = {
  usuarios: "Usuários",
  usuarios_perfis: "Perfis de usuário",
  perfis_permissoes: "Permissões dos perfis",
  configuracoes: "Configurações",
  reservas: "Reservas",
  reserva_periodos: "Períodos reservados",
  contratos: "Contratos",
  parcelas: "Parcelas",
  pagamentos: "Pagamentos",
};

const ACOES: Record<string, string> = { INSERT: "Criou", UPDATE: "Alterou", DELETE: "Removeu" };

const dataHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "America/Fortaleza",
});

type Registro = {
  id: number;
  em: string;
  tabela: string;
  registro_id: string | null;
  acao: string;
  usuario: string | null;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
};

/** Mostra só os campos que mudaram (ou todos, numa criação). */
function diferencas(r: Registro): string[] {
  const ignorar = new Set(["atualizado_em", "criado_em"]);
  if (r.acao === "INSERT" && r.depois) {
    return Object.entries(r.depois)
      .filter(([k, v]) => !ignorar.has(k) && k !== "id" && v !== null)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  }
  if (r.acao === "DELETE" && r.antes) {
    return Object.entries(r.antes)
      .filter(([k]) => !ignorar.has(k))
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  }
  const antes = r.antes ?? {};
  const depois = r.depois ?? {};
  return Object.keys(depois)
    .filter((k) => !ignorar.has(k) && JSON.stringify(antes[k]) !== JSON.stringify(depois[k]))
    .map((k) => `${k}: ${JSON.stringify(antes[k])} → ${JSON.stringify(depois[k])}`);
}

export default async function PaginaAuditoria({
  searchParams,
}: {
  searchParams: Promise<{ tabela?: string; pagina?: string }>;
}) {
  await exigirPermissao("auditoria.ver");
  const { tabela, pagina } = await searchParams;
  const p = Math.max(1, Number(pagina) || 1);
  const filtro = tabela && TABELAS[tabela] ? tabela : undefined;

  const supabase = await criarClienteServidor();
  let consulta = supabase
    .from("auditoria")
    .select("*")
    .order("id", { ascending: false })
    .range((p - 1) * POR_PAGINA, p * POR_PAGINA);
  if (filtro) consulta = consulta.eq("tabela", filtro);
  const [{ data, error }, { data: usuarios }] = await Promise.all([
    consulta,
    supabase.from("usuarios").select("id, nome"),
  ]);
  const registros = ((data ?? []) as Registro[]).slice(0, POR_PAGINA);
  const temMais = (data?.length ?? 0) > POR_PAGINA;
  const nomes = new Map((usuarios ?? []).map((u) => [u.id as string, u.nome as string]));
  const link = (q: Record<string, string | number | undefined>) => {
    const s = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => v !== undefined && s.set(k, String(v)));
    const t = s.toString();
    return t ? `/auditoria?${t}` : "/auditoria";
  };

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Auditoria</h1>
          <p>Registro permanente de alterações. Ninguém, nem o administrador, consegue editá-lo ou apagá-lo.</p>
        </div>
      </div>

      <section className="cartao">
        <div className="pilulas" style={{ marginBottom: 14 }}>
          <Link className="pilula" aria-current={filtro ? undefined : "page"} href={link({})}>Tudo</Link>
          {Object.entries(TABELAS).map(([k, nome]) => (
            <Link key={k} className="pilula" aria-current={filtro === k ? "page" : undefined} href={link({ tabela: k })}>
              {nome}
            </Link>
          ))}
        </div>
        {error && <p className="aviso erro">Não foi possível carregar a auditoria.</p>}
        {registros.length === 0 ? (
          <p className="mudo">Nenhum registro.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Quem</th>
                <th>O quê</th>
                <th>Mudança</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{dataHora.format(new Date(r.em))}</td>
                  <td>{r.usuario ? nomes.get(r.usuario) ?? "Usuário" : <span className="mudo">Sistema</span>}</td>
                  <td>
                    {ACOES[r.acao] ?? r.acao} · {TABELAS[r.tabela] ?? r.tabela}
                    <div className="mudo" style={{ fontSize: ".78rem" }}>{r.registro_id}</div>
                  </td>
                  <td style={{ fontSize: ".85rem", fontFamily: "ui-monospace, monospace", wordBreak: "break-word" }}>
                    {diferencas(r).map((d) => (
                      <div key={d}>{d}</div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="linha" style={{ marginTop: 14, justifyContent: "space-between" }}>
          {p > 1 ? <Link className="botao secundario pequeno" href={link({ tabela: filtro, pagina: p - 1 })}>← Mais recentes</Link> : <span />}
          {temMais && <Link className="botao secundario pequeno" href={link({ tabela: filtro, pagina: p + 1 })}>Mais antigos →</Link>}
        </div>
      </section>
    </>
  );
}
