import Image from "next/image";
import type { Metadata } from "next";
import { FormularioEntrada } from "./formulario";
import { entrarComoVisitante } from "./actions";
import { visitanteLigado } from "@/lib/visitante";

export const metadata: Metadata = { title: "Entrar" };

const AVISOS: Record<string, string> = {
  "sem-acesso": "Sua conta não tem acesso ativo ao Delta Gestão. Fale com um administrador.",
  "senha-trocada": "Senha alterada. Entre de novo com a senha nova.",
  "visitante-desligado": "O acesso de visitante está desligado no momento.",
};

// Painel interno, sempre com dados do usuário logado: pode esperar o servidor.
export const instant = false;

export default async function PaginaEntrar({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;
  const visitante = await visitanteLigado();
  return (
    <main className="entrada">
      <section className="entrada-arte">
        <Image src="/logo-brasao.png" alt="Brasão da Delta" width={190} height={205} priority />
        <p>Delta Espaço e Eventos</p>
      </section>
      <section className="entrada-form">
        <div className="cartao">
          <h1>Delta Gestão</h1>
          <p className="mudo">Entre com o e-mail e a senha cadastrados pela administração.</p>
          <FormularioEntrada aviso={motivo ? AVISOS[motivo] : undefined} />
          <p className="mudo" style={{ marginTop: 18, marginBottom: 0 }}>
            Esqueceu a senha? Um administrador pode redefini-la em Usuários.
          </p>
          {visitante && (
            <form action={entrarComoVisitante} className="entrada-visitante">
              <div className="separador"><span>ou</span></div>
              <button className="botao secundario" style={{ width: "100%", justifyContent: "center" }}>Conhecer o sistema sem login</button>
              <p className="mudo pequeno" style={{ margin: "8px 0 0" }}>
                Modo visitante: só para ver. Nomes, contatos e valores aparecem ocultos e nada pode ser alterado.
              </p>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
