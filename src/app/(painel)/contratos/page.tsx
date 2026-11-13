import type { Metadata } from "next";
import Link from "next/link";
import { FilePen, FileText, Search } from "lucide-react";
import { exigirAlguma } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarData, formatarDataHora } from "@/lib/datas";
import { formatarCentavos } from "@/lib/dinheiro";
import { STATUS_CONTRATO } from "@/lib/reservas";
import { Abas, Vazio } from "@/componentes/ui";
import { BotaoIcone } from "@/componentes/janela";
import { Paginacao, paginaDoEndereco } from "@/componentes/paginacao";
import { VerTextoContrato } from "./ver-texto";

export const metadata: Metadata = { title: "Contratos" };

const FILTROS = {
  todos: { rotulo: "Todos", status: null },
  aguardando: { rotulo: "Aguardando assinatura", status: ["enviado", "rascunho"] },
  assinados: { rotulo: "Assinados", status: ["assinado"] },
  encerrados: { rotulo: "Cancelados e substituídos", status: ["cancelado", "substituido"] },
} as const;
type Filtro = keyof typeof FILTROS;

type Linha = {
  id: string; reserva_id: string; versao: number; status: string; criado_em: string; assinado_em: string | null;
  modelo_versao: number | null; conteudo: { numero?: string } | null;
  reservas: { evento_inicio: string; titulo: string | null; valor_total_centavos: number | null; clientes: { nome: string } | null } | null;
};

export default async function PaginaContratos({ searchParams }: { searchParams: Promise<{ q?: string; filtro?: string; pagina?: string }> }) {
  const acesso = await exigirAlguma(["contrato.editar", "contrato.ver"]);
  const sp = await searchParams;
  const filtro: Filtro = sp.filtro && sp.filtro in FILTROS ? (sp.filtro as Filtro) : "todos";
  const termo = (sp.q ?? "").trim();
  const { pagina, de, ate, porPagina } = paginaDoEndereco(sp.pagina);
  const supabase = await criarClienteServidor();

  let consulta = supabase
    .from("contratos")
    .select("id, reserva_id, versao, status, criado_em, assinado_em, modelo_versao, conteudo, reservas!inner(evento_inicio, titulo, valor_total_centavos, clientes!inner(nome))", { count: "exact" })
    .order("criado_em", { ascending: false });
  const st = FILTROS[filtro].status;
  if (st) consulta = consulta.in("status", st as unknown as string[]);
  if (termo) consulta = consulta.ilike("reservas.clientes.nome", `%${termo}%`);
  const [{ data, count, error }, contagens] = await Promise.all([
    consulta.range(de, ate),
    Promise.all((Object.keys(FILTROS) as Filtro[]).map(async (k) => {
      let q = supabase.from("contratos").select("id", { count: "exact", head: true });
      const s = FILTROS[k].status;
      if (s) q = q.in("status", s as unknown as string[]);
      const { count: c } = await q;
      return [k, c ?? 0] as const;
    })),
  ]);
  const conta = Object.fromEntries(contagens) as Record<Filtro, number>;
  const lista = (data ?? []) as unknown as Linha[];
  const link = (f: Filtro) => {
    const q = new URLSearchParams();
    if (f !== "todos") q.set("filtro", f);
    if (termo) q.set("q", termo);
    const s = q.toString();
    return s ? `/contratos?${s}` : "/contratos";
  };

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Contratos</h1>
          <p>Contratos gerados a partir das reservas. Clique num contrato para abrir a reserva; o modelo define o texto dos próximos.</p>
        </div>
        {pode(acesso, "contrato.editar") && (
          <Link className="botao" href="/contratos/modelo"><FilePen aria-hidden />Modelo do contrato</Link>
        )}
      </div>

      <section className="cartao sem-respiro">
        <div className="cartao-cabecalho">
          <div className="barra-filtros" style={{ width: "100%" }}>
            <form className="crescer campo-busca" role="search" action="/contratos">
              <Search aria-hidden />
              {filtro !== "todos" && <input type="hidden" name="filtro" value={filtro} />}
              <label htmlFor="q" className="sr-only">Procurar por cliente</label>
              <input id="q" name="q" type="search" defaultValue={termo} placeholder="Procurar por cliente" />
            </form>
            <Abas rotulo="Situação" itens={(Object.keys(FILTROS) as Filtro[]).map((k) => ({ href: link(k), rotulo: FILTROS[k].rotulo, conta: conta[k], ativa: filtro === k }))} />
          </div>
        </div>
        {error && <p className="aviso erro" style={{ margin: 16 }}>Não foi possível carregar os contratos.</p>}
        {!error && lista.length === 0 ? (
          <Vazio icone={FileText} titulo={termo || filtro !== "todos" ? "Nenhum contrato nesta seleção" : "Nenhum contrato gerado ainda"}
            texto="O contrato é gerado na reserva, depois que a data é segurada." />
        ) : (
          <div className="lista-rolavel">
            <table className="empilhar">
              <thead>
                <tr><th>Contrato</th><th>Cliente</th><th>Evento</th><th className="numero">Valor</th><th>Situação</th><th>Gerado em</th><th><span className="sr-only">Ações</span></th></tr>
              </thead>
              <tbody>
                {lista.map((c) => {
                  const s = STATUS_CONTRATO[c.status] ?? { rotulo: c.status, classe: "selo cinza" };
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/reservas/${c.reserva_id}`} style={{ textDecoration: "none" }}><strong>{c.conteudo?.numero ?? "—"}</strong></Link>
                        <div className="mudo pequeno">versão {c.versao}{c.modelo_versao ? ` · modelo v${c.modelo_versao}` : ""}</div>
                      </td>
                      <td data-rotulo="Cliente">{c.reservas?.clientes?.nome ?? "—"}</td>
                      <td data-rotulo="Evento">{c.reservas ? formatarData(c.reservas.evento_inicio.slice(0, 10)) : "—"}
                        {c.reservas?.titulo && <div className="mudo pequeno">{c.reservas.titulo}</div>}</td>
                      <td className="numero" data-rotulo="Valor">{c.reservas?.valor_total_centavos != null ? formatarCentavos(c.reservas.valor_total_centavos) : "—"}</td>
                      <td data-rotulo="Situação"><span className={s.classe}>{s.rotulo}</span>
                        {c.assinado_em && <div className="mudo pequeno">em {formatarData(c.assinado_em.slice(0, 10))}</div>}</td>
                      <td data-rotulo="Gerado em">{formatarDataHora(c.criado_em)}</td>
                      <td className="acoes">
                        <span className="acoes-linha">
                          <VerTextoContrato id={c.id} numero={c.conteudo?.numero ?? "Contrato"} />
                          <BotaoIcone icone={<FileText aria-hidden />} rotulo="Abrir a reserva" href={`/reservas/${c.reserva_id}`} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Paginacao total={count ?? 0} pagina={pagina} porPagina={porPagina} caminho="/contratos" parametros={sp} />
      </section>
    </>
  );
}
