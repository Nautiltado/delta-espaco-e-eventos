import { createHash } from "node:crypto";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { FormularioConvite } from "./formulario";

export const metadata: Metadata = { title: "Criar senha", robots: { index: false, follow: false } };
export const instant = false;

const MOTIVOS: Record<string, string> = {
  invalido: "Este link não existe. Confira se copiou o endereço inteiro.",
  usado: "Este link já foi usado. Se não foi você, avise a administração.",
  expirado: "Este link venceu. Peça um novo à administração.",
  revogado: "Este link foi cancelado pela administração.",
  desativado: "Este acesso está desativado.",
};

export default async function PaginaConvite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valido = /^[A-Za-z0-9_-]{40,60}$/.test(token);
  const { data } = valido
    ? await criarClienteAdmin().rpc("conferir_convite", { p_hash: createHash("sha256").update(token).digest("hex") })
    : { data: { ok: false, motivo: "invalido" } };
  const c = data as { ok: boolean; motivo?: string; nome?: string; email?: string; tipo?: string };
  return (
    <main className="entrada">
      <section className="entrada-arte">
        <Image src="/logo-brasao.png" alt="Brasão da Delta" width={190} height={205} priority />
        <p>Delta Espaço e Eventos</p>
      </section>
      <section className="entrada-form">
        <div className="cartao">
          {c.ok ? (
            <>
              <h1>{c.tipo === "convite" ? `Bem-vindo, ${c.nome}` : `Nova senha, ${c.nome}`}</h1>
              <p className="mudo">
                {c.tipo === "convite" ? "Crie a sua senha para entrar no Delta Gestão." : "Escolha a sua nova senha."} O acesso é do e-mail{" "}
                <strong>{c.email}</strong>. Ninguém da administração vê a sua senha.
              </p>
              <FormularioConvite token={token} />
            </>
          ) : (
            <>
              <h1>Link sem validade</h1>
              <p className="mudo">{MOTIVOS[c.motivo ?? "invalido"] ?? MOTIVOS.invalido}</p>
              <Link className="botao" href="/entrar">Ir para a entrada</Link>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
