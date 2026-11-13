import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { BookOpenText, CircleDollarSign, Clock3, EyeOff, Lock, Pencil, Plus, Search } from "lucide-react";
import { exigirPermissao } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarCentavos } from "@/lib/dinheiro";
import { CATEGORIAS, ordemCategoria, UNIDADES } from "@/lib/orcamentos";
import { ordenarCatalogo, precoDoItem, type ItemCatalogo } from "@/lib/catalogo";
import { Abas, Indicador, Vazio } from "@/componentes/ui";

export const metadata: Metadata = { title: "Catálogo" };

/** Serviços e espaços são cobrados como trabalho ou uso; o resto é produto (comida, bebida, material). */
const CATEGORIAS_SERVICO = new Set(["espaco", "equipe", "servico", "equipamento"]);
const SITUACOES = { todos: "Todos", ativos: "Ativos", pendentes: "Preço a combinar", inativos: "Inativos" } as const;
type Situacao = keyof typeof SITUACOES;

export default async function PaginaCatalogo({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string; situacao?: string }> }) {
  const acesso = await exigirPermissao("orcamento.ver");
  const sp = await searchParams;
  const termo = (sp.q ?? "").trim();
  const situacao: Situacao = sp.situacao && sp.situacao in SITUACOES ? (sp.situacao as Situacao) : "ativos";
  const normalizar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const verCusto = pode(acesso, "custo.ver");
  const podeEditar = pode(acesso, "catalogo.alterar");
  const supabase = await criarClienteServidor();
  const [{ data: itens }, { data: custos }] = await Promise.all([
    supabase.from("catalogo_itens").select("*").order("categoria").order("ordem").order("nome"),
    verCusto ? supabase.from("catalogo_custos").select("item_id, custo_centavos") : Promise.resolve({ data: [] }),
  ]);
  const custoPorItem = new Map((custos ?? []).map((c) => [c.item_id as string, c.custo_centavos as number]));
  const todos = ordenarCatalogo((itens ?? []) as ItemCatalogo[], ordemCategoria);
  const cat = sp.cat && todos.some((i) => i.categoria === sp.cat) ? sp.cat : undefined;

  const ativos = todos.filter((i) => i.ativo);
  const conta = {
    todos: todos.length,
    ativos: ativos.length,
    pendentes: ativos.filter((i) => i.preco_tipo === "a_combinar").length,
    inativos: todos.length - ativos.length,
  };
  const comPreco = ativos.length - conta.pendentes;
  const comCusto = ativos.filter((i) => custoPorItem.has(i.id)).length;

  const porSituacao = todos.filter((i) =>
    situacao === "todos" ? true : situacao === "ativos" ? i.ativo : situacao === "inativos" ? !i.ativo : i.ativo && i.preco_tipo === "a_combinar");
  const porBusca = termo ? porSituacao.filter((i) => normalizar(`${i.nome} ${i.descricao ?? ""} ${i.subgrupo ?? ""}`).includes(normalizar(termo))) : porSituacao;
  const lista = cat ? porBusca.filter((i) => i.categoria === cat) : porBusca;
  const categorias = [...new Set(porBusca.map((i) => i.categoria))];

  const link = (q: { situacao?: string; cat?: string | null; q?: string }) => {
    const s = new URLSearchParams();
    const sit = q.situacao ?? situacao; if (sit !== "ativos") s.set("situacao", sit);
    const c = q.cat === null ? undefined : (q.cat ?? cat); if (c) s.set("cat", c);
    const t = q.q ?? termo; if (t) s.set("q", t);
    const str = s.toString();
    return str ? `/catalogo?${str}` : "/catalogo";
  };
  const colunas = 5 + (verCusto ? 2 : 0) + 1;

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Catálogo</h1>
          <p>Cardápio, espaços, equipe e materiais que entram nos orçamentos. Itens “a combinar” têm o preço digitado em cada orçamento.</p>
        </div>
        {podeEditar && <div className="linha"><Link className="botao" href="/catalogo/novo"><Plus aria-hidden />Novo item</Link></div>}
      </div>

      <div className="kpis">
        <Indicador rotulo="Itens ativos" valor={conta.ativos} icone={BookOpenText} detalhe={`${categorias.length} ${categorias.length === 1 ? "categoria" : "categorias"} nesta seleção`} />
        <Indicador rotulo="Com preço definido" valor={comPreco} icone={CircleDollarSign} detalhe="Preço fixo ou faixa" />
        <Indicador rotulo="Preço a combinar" valor={conta.pendentes} icone={Clock3} tom="alerta" href={link({ situacao: "pendentes", cat: null })} detalhe="Definido em cada orçamento" />
        {verCusto
          ? <Indicador rotulo="Com custo cadastrado" valor={`${comCusto} de ${conta.ativos}`} icone={Lock} tom="marca" detalhe="Visível só para quem pode ver custos" />
          : <Indicador rotulo="Inativos" valor={conta.inativos} icone={EyeOff} tom="info" href={link({ situacao: "inativos", cat: null })} detalhe="Fora dos orçamentos novos" />}
      </div>

      <section className="cartao sem-respiro" style={{ marginTop: 16 }}>
        <div className="cartao-cabecalho" style={{ gap: 12 }}>
          <div className="barra-filtros" style={{ width: "100%" }}>
            <form className="crescer campo-busca" role="search" action="/catalogo">
              <Search aria-hidden />
              {situacao !== "ativos" && <input type="hidden" name="situacao" value={situacao} />}
              {cat && <input type="hidden" name="cat" value={cat} />}
              <label htmlFor="q" className="sr-only">Procurar no catálogo</label>
              <input id="q" name="q" type="search" defaultValue={termo} placeholder="Procurar por nome, descrição ou grupo (ex.: coxinha, filé, suco)" />
            </form>
            <Abas rotulo="Situação dos itens" itens={(Object.keys(SITUACOES) as Situacao[]).map((k) => ({ href: link({ situacao: k }), rotulo: SITUACOES[k], conta: conta[k], ativa: situacao === k }))} />
          </div>
          <nav className="pilulas" aria-label="Categorias">
            <Link className="pilula" href={link({ cat: null })} aria-current={!cat ? "page" : undefined} scroll={false}>Todas <span className="conta">{porBusca.length}</span></Link>
            {categorias.map((c) => (
              <Link key={c} className="pilula" href={link({ cat: c })} aria-current={cat === c ? "page" : undefined} scroll={false}>
                {CATEGORIAS[c] ?? c} <span className="conta">{porBusca.filter((i) => i.categoria === c).length}</span>
              </Link>
            ))}
          </nav>
        </div>

        {lista.length === 0 ? (
          <Vazio icone={Search} titulo={termo ? `Nada encontrado para “${termo}”` : "Nenhum item nesta seleção"}
            texto={termo || cat || situacao !== "ativos" ? "Mude a busca ou os filtros." : "Cadastre o primeiro item do catálogo."}
            acao={termo || cat || situacao !== "ativos" ? <Link className="botao secundario pequeno" href="/catalogo">Limpar filtros</Link> : undefined} />
        ) : (
          <table className="empilhar">
            <thead>
              <tr>
                <th>Item</th>
                <th>Tipo</th>
                <th>Cobrado por</th>
                <th>Preço</th>
                {verCusto && <th><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>Custo <Lock aria-label="restrito" size={12} /></span></th>}
                {verCusto && <th className="numero">Margem</th>}
                <th>Situação</th>
                <th className="numero"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((i, n) => {
                const custo = custoPorItem.get(i.id);
                const precoRef = i.preco_tipo === "fixo" ? i.preco_centavos : i.preco_min_centavos;
                const novaCategoria = !cat && i.categoria !== lista[n - 1]?.categoria;
                const novoSubgrupo = i.subgrupo && (i.subgrupo !== lista[n - 1]?.subgrupo || novaCategoria);
                const margem = custo !== undefined && precoRef ? Math.round(((precoRef - custo) * 100) / precoRef) : null;
                return (
                  <Fragment key={i.id}>
                    {novaCategoria && <tr className="subgrupo"><td colSpan={colunas}>{CATEGORIAS[i.categoria] ?? i.categoria}</td></tr>}
                    {novoSubgrupo && cat && <tr className="subgrupo"><td colSpan={colunas}>{i.subgrupo}</td></tr>}
                    <tr className={i.ativo ? undefined : "linha-inativa"}>
                      <td>
                        <Link href={`/catalogo/${i.id}`} style={{ textDecoration: "none" }}><strong>{i.nome}</strong></Link>
                        {i.descricao && <div className="mudo">{i.descricao}</div>}
                        {!cat && i.subgrupo && <div className="mudo" style={{ fontSize: ".76rem" }}>{i.subgrupo}</div>}
                      </td>
                      <td data-rotulo="Tipo"><span className={CATEGORIAS_SERVICO.has(i.categoria) ? "selo info" : "selo cinza"}>{CATEGORIAS_SERVICO.has(i.categoria) ? "Serviço" : "Produto"}</span></td>
                      <td data-rotulo="Por">{UNIDADES[i.unidade] ?? i.unidade}</td>
                      <td data-rotulo="Preço" style={{ whiteSpace: "nowrap" }}>
                        {i.preco_tipo === "a_combinar" ? <span className="selo alerta">A combinar</span> : <strong style={{ fontWeight: 600 }}>{precoDoItem(i)}</strong>}
                      </td>
                      {verCusto && <td data-rotulo="Custo">{custo !== undefined ? formatarCentavos(custo) : <span className="mudo" style={{ whiteSpace: "nowrap" }}>sem custo</span>}</td>}
                      {verCusto && (
                        <td className="numero" data-rotulo="Margem">
                          {margem === null ? <span className="mudo">—</span> : (
                            <span style={{ color: margem < 20 ? "var(--erro)" : margem < 40 ? "var(--alerta)" : "var(--sucesso)", fontWeight: 600 }}>
                              {margem}%{i.preco_tipo === "faixa" && <span className="mudo" style={{ fontWeight: 400 }}> mín.</span>}
                            </span>
                          )}
                        </td>
                      )}
                      <td data-rotulo="Situação">{i.ativo ? <span className="selo">Ativo</span> : <span className="selo cinza">Inativo</span>}</td>
                      <td className="numero">
                        <Link className="botao fantasma pequeno" href={`/catalogo/${i.id}`} aria-label={`${podeEditar ? "Editar" : "Ver"} ${i.nome}`}>
                          {podeEditar ? <><Pencil aria-hidden />Editar</> : "Ver"}
                        </Link>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="cartao-rodape mudo">
          {lista.length} {lista.length === 1 ? "item" : "itens"} · No orçamento também dá para incluir item livre, fora do catálogo.
        </div>
      </section>
    </>
  );
}
