import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirPermissao } from "@/lib/acesso";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dadosOrcamentoRapido } from "@/lib/orcamento-rapido-dados";
import { EditorModelo } from "../editor";
import { AvisoDaPagina } from "@/componentes/avisos";

export const metadata: Metadata = { title: "Modelo de orçamento" };

export default async function PaginaEditarModelo({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ salvo?: string }> }) {
  await exigirPermissao("catalogo.alterar");
  const { id } = await params;
  const { salvo } = await searchParams;
  const supabase = await criarClienteServidor();
  const { modelos, opcoes } = await dadosOrcamentoRapido(supabase, { incluirInativos: true });
  const novo = id === "novo";
  const modelo = novo ? null : modelos.find((m) => m.id === id);
  if (!novo && !modelo) notFound();
  return (
    <>
      <div className="cabecalho">
        <div>
          <p style={{ margin: 0 }}><Link href="/orcamentos/modelos">← Modelos de orçamento</Link></p>
          <h1>{novo ? "Novo modelo" : modelo!.nome}</h1>
        </div>
      </div>
      {salvo && <AvisoDaPagina texto="Modelo salvo." />}
      <section className="cartao">
        <EditorModelo key={modelo?.id ?? "novo"} modelo={modelo ?? null} opcoes={opcoes} />
      </section>
    </>
  );
}
