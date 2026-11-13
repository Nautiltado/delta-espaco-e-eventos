import type { Metadata } from "next";
import Link from "next/link";
import { exigirPermissao } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarDocumento, formatarTelefone } from "@/lib/documentos";
import { Search, UserPlus, Users } from "lucide-react";
import { BotaoJanela } from "@/componentes/janela";
import { Paginacao, recortar } from "@/componentes/paginacao";
import { Vazio } from "@/componentes/ui";
import { FormularioCliente } from "./formulario";

export const metadata: Metadata = { title: "Clientes" };

type Linha = {
  id: string;
  tipo: "PF" | "PJ";
  nome: string;
  nome_fantasia: string | null;
  telefone: string | null;
  documento: string | null;
  cidade: string | null;
  ativo: boolean;
};

export default async function PaginaClientes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; inativos?: string; pagina?: string }>;
}) {
  const acesso = await exigirPermissao("cliente.ver");
  const sp = await searchParams;
  const { q = "", inativos } = sp;
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("buscar_clientes", {
    p_texto: q.slice(0, 100) || null,
    p_inativos: inativos === "1",
    p_limite: 200,
  });
  const todos = (data ?? []) as Linha[];
  const { itens: clientes, pagina } = recortar(todos, Math.max(1, Number(sp.pagina) || 1));

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Clientes</h1>
          <p>Pessoas e empresas, com CPF/CNPJ conferido e aviso de cadastro repetido.</p>
        </div>
        {pode(acesso, "cliente.editar") && (
          <BotaoJanela rotulo="Novo cliente" icone={<UserPlus aria-hidden />} larga
            descricao="Só o nome é obrigatório no primeiro contato. CPF/CNPJ e endereço serão exigidos no contrato.">
            <FormularioCliente />
          </BotaoJanela>
        )}
      </div>

      <section className="cartao sem-respiro">
        <div className="cartao-cabecalho">
          <form className="barra-filtros" style={{ width: "100%" }} role="search">
            <div className="crescer campo-busca">
              <Search aria-hidden />
              <label htmlFor="q" className="sr-only">Buscar por nome, telefone ou CPF/CNPJ</label>
              <input id="q" name="q" type="search" defaultValue={q} placeholder="Buscar por nome, telefone ou CPF/CNPJ (ex.: Maria, 98152)" autoFocus />
            </div>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 500, margin: 0 }}>
              <input type="checkbox" name="inativos" value="1" defaultChecked={inativos === "1"} /> Incluir inativos
            </label>
            <button className="botao secundario">Buscar</button>
          </form>
        </div>

        {error && <p className="aviso erro" style={{ margin: 16 }}>Não foi possível carregar os clientes.</p>}
        {clientes.length === 0 ? (
          <Vazio icone={Users} titulo={q ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado ainda"} texto={q ? "Tente outro nome, telefone ou documento." : undefined} />
        ) : (
          <div className="lista-rolavel">
          <table className="empilhar">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Telefone</th>
                <th>CPF/CNPJ</th>
                <th>Cidade</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} style={c.ativo ? undefined : { opacity: 0.55 }}>
                  <td>
                    <Link href={`/clientes/${c.id}`}><strong>{c.nome}</strong></Link>
                    {c.nome_fantasia && <div className="mudo">{c.nome_fantasia}</div>}
                    {" "}<span className="selo cinza">{c.tipo === "PJ" ? "Empresa" : "Pessoa"}</span>
                    {!c.ativo && <> <span className="selo erro">Inativo</span></>}
                  </td>
                  <td data-rotulo="Telefone">{formatarTelefone(c.telefone)}</td>
                  <td data-rotulo="CPF/CNPJ">{formatarDocumento(c.documento)}</td>
                  <td>{c.cidade}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        <Paginacao total={todos.length} pagina={pagina} caminho="/clientes" parametros={sp} />
        {todos.length === 200 && <p className="mudo" style={{ padding: "0 16px 12px" }}>Mostrando os 200 primeiros. Refine a busca.</p>}
      </section>
    </>
  );
}
