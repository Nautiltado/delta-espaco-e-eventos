import type { Metadata } from "next";
import Link from "next/link";
import { exigirAcesso } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { hojeNaDelta, instanteAtual } from "@/lib/datas";
import { Plus } from "lucide-react";
import { Abas } from "@/componentes/ui";
import { BotaoJanela } from "@/componentes/janela";
import { FormularioTarefa } from "./formulario";
import { ListaTarefas, SELECT_TAREFA, type Tarefa } from "./lista";

export const metadata: Metadata = { title: "Tarefas" };

export default async function PaginaTarefas({ searchParams }: { searchParams: Promise<{ cliente?: string; aba?: string }> }) {
  const acesso = await exigirAcesso();
  const sp = await searchParams;
  const { cliente } = sp;
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

  const concluidas = (f ?? []) as unknown as Tarefa[];
  const abas = { abertas: "Abertas", minhas: "Só as minhas", concluidas: "Concluídas recentemente" } as const;
  type Aba = keyof typeof abas;
  const conta: Record<Aba, number> = { abertas: todas.length, minhas: minhas.length, concluidas: concluidas.length };
  const aba: Aba = sp.aba && sp.aba in abas ? (sp.aba as Aba) : "abertas";
  const href = (k: Aba) => {
    const q = new URLSearchParams();
    if (cliente) q.set("cliente", cliente);
    if (k !== "abertas") q.set("aba", k);
    const t = q.toString();
    return t ? `/tarefas?${t}` : "/tarefas";
  };
  const lista = aba === "minhas" ? minhas : aba === "abertas" ? [...minhas, ...outras] : concluidas;

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
        {podeCriar && (
          <BotaoJanela rotulo="Nova tarefa" icone={<Plus aria-hidden />}>
            <FormularioTarefa clienteId={cliente} hoje={hojeNaDelta()} />
          </BotaoJanela>
        )}
      </div>
      <section className="cartao sem-respiro">
        <div className="cartao-cabecalho">
          <Abas rotulo="Tarefas" itens={(Object.keys(abas) as Aba[]).map((k) => ({ href: href(k), rotulo: abas[k], conta: conta[k], ativa: aba === k }))} />
        </div>
        <div className="lista-rolavel" style={{ padding: "8px 20px 16px" }}>
          <ListaTarefas tarefas={lista} agora={agora} />
        </div>
      </section>
    </>
  );
}
