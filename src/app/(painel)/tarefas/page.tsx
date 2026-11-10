import type { Metadata } from "next";
import Link from "next/link";
import { exigirAcesso } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { hojeNaDelta, instanteAtual } from "@/lib/datas";
import { FormularioTarefa } from "./formulario";
import { ListaTarefas, SELECT_TAREFA, type Tarefa } from "./lista";

export const metadata: Metadata = { title: "Tarefas" };

export default async function PaginaTarefas({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const acesso = await exigirAcesso();
  const { cliente } = await searchParams;
  const supabase = await criarClienteServidor();
  let abertas = supabase.from("tarefas").select(SELECT_TAREFA).is("concluida_em", null).order("vence_em", { nullsFirst: false });
  let feitas = supabase.from("tarefas").select(SELECT_TAREFA).not("concluida_em", "is", null).order("concluida_em", { ascending: false }).limit(15);
  if (cliente) {
    abertas = abertas.eq("cliente_id", cliente);
    feitas = feitas.eq("cliente_id", cliente);
  }
  const [{ data: a }, { data: f }, nomeCliente] = await Promise.all([
    abertas,
    feitas,
    cliente ? supabase.from("clientes").select("nome").eq("id", cliente).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const todas = (a ?? []) as unknown as Tarefa[];
  const minhas = todas.filter((t) => t.responsavel === acesso.id);
  const outras = todas.filter((t) => t.responsavel !== acesso.id);
  const agora = instanteAtual();
  const podeCriar = pode(acesso, "orcamento.criar") || pode(acesso, "cliente.editar");

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Tarefas{nomeCliente.data ? ` · ${nomeCliente.data.nome}` : ""}</h1>
          <p>
            Retornos e lembretes. Ao enviar um orçamento, o sistema cria a tarefa de retorno sozinho.
            {cliente && <> <Link href="/tarefas">Ver todas</Link></>}
          </p>
        </div>
      </div>
      <div className="painel-lateral">
        <div>
          <section className="cartao">
            <h2>Suas tarefas ({minhas.length})</h2>
            <ListaTarefas tarefas={minhas} agora={agora} />
          </section>
          {outras.length > 0 && (
            <section className="cartao">
              <h2>Da equipe ({outras.length})</h2>
              <ListaTarefas tarefas={outras} agora={agora} />
            </section>
          )}
          <section className="cartao">
            <h2>Concluídas recentemente</h2>
            <ListaTarefas tarefas={(f ?? []) as unknown as Tarefa[]} agora={agora} />
          </section>
        </div>
        {podeCriar && (
          <aside>
            <section className="cartao">
              <h2>Nova tarefa</h2>
              <FormularioTarefa clienteId={cliente} hoje={hojeNaDelta()} />
            </section>
          </aside>
        )}
      </div>
    </>
  );
}
