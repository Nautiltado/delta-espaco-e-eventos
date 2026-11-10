import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigirPermissao } from "@/lib/acesso";
import { criarClienteServidor } from "@/lib/supabase/server";
import { FormularioCliente, type ClienteFormulario } from "../../formulario";

export const metadata: Metadata = { title: "Editar cliente" };

export default async function EditarCliente({ params }: { params: Promise<{ id: string }> }) {
  await exigirPermissao("cliente.editar");
  const { id } = await params;
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("clientes").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Editar cliente</h1>
          <p>Toda alteração fica registrada na auditoria.</p>
        </div>
      </div>
      <section className="cartao">
        <FormularioCliente cliente={data as ClienteFormulario} />
      </section>
    </>
  );
}
