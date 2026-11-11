import type { Metadata } from "next";
import Link from "next/link";
import { exigirPermissao } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarDocumento, formatarTelefone } from "@/lib/documentos";

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
  searchParams: Promise<{ q?: string; inativos?: string }>;
}) {
  const acesso = await exigirPermissao("cliente.ver");
  const { q = "", inativos } = await searchParams;
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("buscar_clientes", {
    p_texto: q.slice(0, 100) || null,
    p_inativos: inativos === "1",
    p_limite: 200,
  });
  const clientes = (data ?? []) as Linha[];

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Clientes</h1>
          <p>Pessoas e empresas, com CPF/CNPJ conferido e aviso de cadastro repetido.</p>
        </div>
        {pode(acesso, "cliente.editar") && <Link className="botao" href="/clientes/novo">Novo cliente</Link>}
      </div>

      <section className="cartao">
        <form className="linha" style={{ marginBottom: 16 }}>
          <div className="campo" style={{ flex: 3 }}>
            <label htmlFor="q">Buscar por nome, telefone ou CPF/CNPJ</label>
            <input id="q" name="q" type="search" defaultValue={q} placeholder="Ex.: Maria, 98152 ou 620.814" autoFocus />
          </div>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 500, marginBottom: 10 }}>
            <input type="checkbox" name="inativos" value="1" defaultChecked={inativos === "1"} /> Incluir inativos
          </label>
          <button className="botao secundario" style={{ marginBottom: 2 }}>Buscar</button>
        </form>

        {error && <p className="aviso erro">Não foi possível carregar os clientes.</p>}
        {clientes.length === 0 ? (
          <p className="mudo">{q ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}</p>
        ) : (
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
        )}
        {clientes.length === 200 && <p className="mudo">Mostrando os 200 primeiros. Refine a busca.</p>}
      </section>
    </>
  );
}
