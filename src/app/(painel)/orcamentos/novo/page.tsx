import type { Metadata } from "next";
import Link from "next/link";
import { exigirPermissao } from "@/lib/acesso";
import { criarClienteServidor } from "@/lib/supabase/server";
import { criarOrcamento } from "../actions";
import { FormularioEvento } from "../componentes";

export const metadata: Metadata = { title: "Novo orçamento" };

export default async function NovoOrcamento({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  await exigirPermissao("orcamento.criar");
  const { cliente } = await searchParams;
  const supabase = await criarClienteServidor();
  const [{ data: clientes }, { data: espacos }] = await Promise.all([
    supabase.rpc("buscar_clientes", { p_texto: null, p_inativos: false, p_limite: 500 }),
    supabase.from("recursos").select("id, nome, capacidade").eq("tipo", "espaco").eq("ativo", true).order("capacidade"),
  ]);
  const lista = ((clientes ?? []) as { id: string; nome: string }[]).map((c) => ({ id: c.id, nome: c.nome }));

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Novo orçamento</h1>
          <p>Primeiro os dados do evento; os itens vêm na próxima tela. Orçamento não reserva a data.</p>
        </div>
      </div>
      <section className="cartao">
        {lista.length === 0 ? (
          <p>Cadastre o cliente antes. <Link href="/clientes/novo">Novo cliente</Link></p>
        ) : (
          <>
            <FormularioEvento
              acao={criarOrcamento}
              clientes={lista}
              clienteInicial={cliente}
              espacos={espacos ?? []}
              textoBotao="Criar orçamento"
            />
            <p className="mudo" style={{ marginBottom: 0 }}>
              Cliente novo? <Link href="/clientes/novo">Cadastre aqui</Link> e volte.
            </p>
          </>
        )}
      </section>
    </>
  );
}
