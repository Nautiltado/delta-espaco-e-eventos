import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/acesso";
import { exigeDuasEtapas } from "@/lib/duas-etapas";
import { sair } from "@/app/entrar/actions";
import { CadastroDuasEtapas } from "./cadastro";

export const metadata: Metadata = { title: "Verificação em duas etapas" };
export const instant = false;

export default async function PaginaDuasEtapas() {
  const sessao = await obterSessao();
  if (!sessao) redirect("/entrar");
  if (!sessao.acesso || sessao.authId === "visitante") redirect("/entrar?motivo=sem-acesso");
  if (sessao.temDuasEtapas) redirect(sessao.nivel === "aal2" ? "/" : "/entrar/codigo");
  const obrigatorio = exigeDuasEtapas(sessao.acesso.perfis);
  return (
    <main className="entrada" style={{ gridTemplateColumns: "1fr" }}>
      <section className="entrada-form" style={{ maxWidth: 520 }}>
        <div className="cartao">
          <h1>Proteja sua conta</h1>
          <p className="mudo">
            {obrigatorio
              ? "Quem é da Administração ou do Financeiro entra com a senha e mais um código do celular. Assim, mesmo que alguém descubra sua senha, não consegue entrar."
              : "Além da senha, peça um código do celular ao entrar. Mesmo que alguém descubra sua senha, não consegue entrar."}
          </p>
          <ol className="passos-mfa">
            <li>Instale no celular um app autenticador gratuito: <strong>Google Authenticator</strong> ou <strong>Microsoft Authenticator</strong>.</li>
            <li>No app, toque em <strong>+</strong> e escolha <strong>ler QR code</strong>.</li>
            <li>Aponte para o código que vai aparecer aqui e digite os 6 números que o app mostrar.</li>
          </ol>
          <CadastroDuasEtapas />
          <form action={sair} style={{ marginTop: 12 }}><button className="botao fantasma pequeno">Sair e fazer depois</button></form>
        </div>
      </section>
    </main>
  );
}
