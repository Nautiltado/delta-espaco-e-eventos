import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/acesso";
import { FormularioTroca } from "./formulario";

export const metadata: Metadata = { title: "Trocar senha" };

// Painel interno, sempre com dados do usuário logado: pode esperar o servidor.
export const instant = false;

export default async function PaginaTrocarSenha() {
  const sessao = await obterSessao();
  if (!sessao) redirect("/entrar");
  return (
    <main className="entrada" style={{ gridTemplateColumns: "1fr" }}>
      <section className="entrada-form">
        <div className="cartao">
          <h1>Defina sua senha</h1>
          <p className="mudo">
            {sessao.trocarSenha
              ? "Você entrou com uma senha provisória. Escolha uma senha só sua para continuar."
              : "Escolha a nova senha."}
          </p>
          <FormularioTroca />
        </div>
      </section>
    </main>
  );
}
