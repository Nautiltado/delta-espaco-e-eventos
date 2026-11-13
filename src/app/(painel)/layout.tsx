import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { exigirAcesso } from "@/lib/acesso";
import { menuDoUsuario, NOMES_PERFIS } from "@/lib/permissoes";
import { instanteAtual } from "@/lib/datas";
import { BarraInferior, BotaoMenu, MenuLateral, Migalhas } from "@/componentes/menu-lateral";
import { sair } from "@/app/entrar/actions";
import { SeletorTema } from "@/componentes/seletor-tema";

// Painel interno, sempre com dados do usuário logado: pode esperar o servidor.
export const instant = false;

const dataExtenso = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Fortaleza" });

function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  const acesso = await exigirAcesso();
  const perfis = acesso.perfis.map((p) => NOMES_PERFIS[p] ?? p).join(", ");
  const itens = menuDoUsuario(acesso);
  const hoje = dataExtenso.format(new Date(instanteAtual()));
  return (
    <div className="painel">
      <header className="barra-celular">
        <Image src="/logo-brasao.png" alt="" width={28} height={30} />
        <strong>DELTA</strong>
        <BotaoMenu />
      </header>
      <aside className="lateral">
        <Link href="/" className="marca" aria-label="Delta Gestão, visão geral">
          <Image src="/logo-brasao.png" alt="" width={34} height={36} />
          <div className="marca-texto">
            <strong>DELTA</strong>
            <span>Gestão</span>
          </div>
        </Link>
        <nav aria-label="Principal">
          <MenuLateral itens={itens} />
        </nav>
        <div style={{ marginTop: "auto" }}>
          <SeletorTema />
        <div className="usuario">
          <span className="avatar" aria-hidden>{iniciais(acesso.nome)}</span>
          <div className="usuario-dados">
            <strong>{acesso.nome}</strong>
            <span>{perfis}</span>
          </div>
          <form action={sair}>
            <button className="botao-sair" aria-label="Sair" title="Sair"><LogOut aria-hidden strokeWidth={1.8} /></button>
          </form>
        </div>
        </div>
      </aside>
      <div className="principal">
        <div className="topo">
          <Migalhas itens={itens} />
          <span className="topo-data">{hoje.charAt(0).toUpperCase() + hoje.slice(1)}</span>
        </div>
        <main className="conteudo">{children}</main>
      </div>
      <BarraInferior itens={itens} />
    </div>
  );
}
