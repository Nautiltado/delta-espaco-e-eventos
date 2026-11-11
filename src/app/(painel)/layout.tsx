import Image from "next/image";
import { exigirAcesso } from "@/lib/acesso";
import { menuDoUsuario, NOMES_PERFIS } from "@/lib/permissoes";
import { BarraInferior, BotaoMenu, MenuLateral } from "@/componentes/menu-lateral";
import { sair } from "@/app/entrar/actions";

// Painel interno, sempre com dados do usuário logado: pode esperar o servidor.
export const instant = false;

export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  const acesso = await exigirAcesso();
  const perfis = acesso.perfis.map((p) => NOMES_PERFIS[p] ?? p).join(", ");
  return (
    <div className="painel">
      <header className="barra-celular">
        <Image src="/logo-brasao.png" alt="" width={30} height={32} />
        <strong>DELTA</strong>
        <BotaoMenu />
      </header>
      <aside className="lateral">
        <div className="marca">
          <Image src="/logo-brasao.png" alt="" width={42} height={45} />
          <div className="marca-texto">
            <strong>DELTA</strong>
            <span>Gestão</span>
          </div>
        </div>
        <nav aria-label="Principal">
          <MenuLateral itens={menuDoUsuario(acesso)} />
        </nav>
        <div className="usuario">
          <strong>{acesso.nome}</strong>
          <span>{perfis}</span>
          <form action={sair}>
            <button className="botao-sair">Sair</button>
          </form>
        </div>
      </aside>
      <main className="conteudo">{children}</main>
      <BarraInferior itens={menuDoUsuario(acesso)} />
    </div>
  );
}
