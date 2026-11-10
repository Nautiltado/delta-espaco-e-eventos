import type { Metadata } from "next";
import { exigirPermissao } from "@/lib/acesso";
import { criarClienteServidor } from "@/lib/supabase/server";
import { LinhaUsuario, NovoUsuario } from "./formularios";

export const metadata: Metadata = { title: "Usuários" };

type LinhaBanco = {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  auth_user_id: string | null;
  usuarios_perfis: { perfil: string }[];
};

export default async function PaginaUsuarios() {
  const acesso = await exigirPermissao("config.critica");
  const supabase = await criarClienteServidor();
  const [{ data: usuarios, error }, { data: perfis }] = await Promise.all([
    supabase
      .from("usuarios")
      .select("id, nome, email, ativo, auth_user_id, usuarios_perfis(perfil)")
      .order("ativo", { ascending: false })
      .order("nome"),
    supabase.from("perfis").select("codigo, nome").order("codigo"),
  ]);
  const listaPerfis = perfis ?? [];

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Usuários</h1>
          <p>Cada pessoa tem login próprio. Ninguém é excluído: quem sai é desativado e o histórico fica.</p>
        </div>
      </div>

      <section className="cartao">
        <h2>Equipe</h2>
        {error && <p className="aviso erro">Não foi possível carregar os usuários.</p>}
        <table>
          <thead>
            <tr>
              <th>Pessoa</th>
              <th>Perfis</th>
              <th>Acesso</th>
            </tr>
          </thead>
          <tbody>
            {((usuarios ?? []) as LinhaBanco[]).map((u) => (
              <LinhaUsuario
                key={u.id}
                ehVoce={u.id === acesso.id}
                perfis={listaPerfis}
                usuario={{
                  id: u.id,
                  nome: u.nome,
                  email: u.email,
                  ativo: u.ativo,
                  temLogin: !!u.auth_user_id,
                  perfis: u.usuarios_perfis.map((p) => p.perfil),
                }}
              />
            ))}
          </tbody>
        </table>
      </section>

      <section className="cartao">
        <h2>Cadastrar pessoa</h2>
        <p className="mudo" style={{ marginTop: -6 }}>
          O sistema gera uma senha provisória. No primeiro acesso, a pessoa troca por uma senha dela.
        </p>
        <NovoUsuario perfis={listaPerfis} />
      </section>
    </>
  );
}
