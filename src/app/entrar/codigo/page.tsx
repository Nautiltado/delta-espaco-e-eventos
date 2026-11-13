import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/acesso";
import { sair } from "../actions";
import { FormularioCodigo } from "./formulario";

export const metadata: Metadata = { title: "Código de verificação" };
export const instant = false;

export default async function PaginaCodigo() {
  const sessao = await obterSessao();
  if (!sessao) redirect("/entrar");
  if (!sessao.temDuasEtapas) redirect("/seguranca/duas-etapas");
  if (sessao.nivel === "aal2") redirect("/");
  return (
    <main className="entrada" style={{ gridTemplateColumns: "1fr" }}>
      <section className="entrada-form">
        <div className="cartao">
          <h1>Código de verificação</h1>
          <p className="mudo">Abra o app autenticador no seu celular e digite o código de 6 números do Delta Gestão.</p>
          <FormularioCodigo />
          <p className="mudo pequeno" style={{ marginTop: 16 }}>
            Trocou ou perdeu o celular? Peça a um administrador para remover a verificação em Usuários; depois você cadastra de novo.
          </p>
          <form action={sair}><button className="botao fantasma pequeno">Sair</button></form>
        </div>
      </section>
    </main>
  );
}
