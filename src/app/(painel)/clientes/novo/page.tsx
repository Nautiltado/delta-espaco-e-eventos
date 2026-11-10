import type { Metadata } from "next";
import { exigirPermissao } from "@/lib/acesso";
import { FormularioCliente } from "../formulario";

export const metadata: Metadata = { title: "Novo cliente" };

export default async function NovoCliente() {
  await exigirPermissao("cliente.editar");
  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Novo cliente</h1>
          <p>Só o nome é obrigatório no primeiro contato. CPF/CNPJ e endereço serão exigidos no contrato.</p>
        </div>
      </div>
      <section className="cartao">
        <FormularioCliente />
      </section>
    </>
  );
}
