import type { Metadata } from "next";
import { exigirPermissao } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { FormularioItem } from "../formulario";

export const metadata: Metadata = { title: "Novo item do catálogo" };

export default async function NovoItem() {
  const acesso = await exigirPermissao("catalogo.alterar");
  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Novo item do catálogo</h1>
          <p>Use preço fixo para itens tabelados e faixa para o que é negociado, como a locação dos espaços.</p>
        </div>
      </div>
      <section className="cartao">
        <FormularioItem mostrarCusto={pode(acesso, "custo.ver")} />
      </section>
    </>
  );
}
