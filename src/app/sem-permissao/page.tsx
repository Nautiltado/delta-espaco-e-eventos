import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sem permissão" };

export default function SemPermissao() {
  return (
    <main className="entrada" style={{ gridTemplateColumns: "1fr" }}>
      <section className="entrada-form">
        <div className="cartao">
          <h1>Sem permissão</h1>
          <p className="mudo">
            Seu perfil não dá acesso a esta área. Se precisar dela, peça a um administrador.
          </p>
          <Link className="botao" href="/">Voltar ao início</Link>
        </div>
      </section>
    </main>
  );
}
