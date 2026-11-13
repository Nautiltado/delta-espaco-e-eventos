import type { Metadata } from "next";
import Link from "next/link";
import { exigirPermissao } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dadosOrcamentoRapido } from "@/lib/orcamento-rapido-dados";
import { descreverRegra } from "@/lib/orcamento-rapido";

export const metadata: Metadata = { title: "Modelos de orçamento" };

export default async function PaginaModelos() {
  const acesso = await exigirPermissao("orcamento.ver");
  const supabase = await criarClienteServidor();
  const { modelos, opcoes } = await dadosOrcamentoRapido(supabase, { incluirInativos: true });
  const porId = new Map(opcoes.map((o) => [o.id, o]));
  const editar = pode(acesso, "catalogo.alterar");
  return (
    <>
      <div className="cabecalho">
        <div>
          <p style={{ margin: 0 }}><Link href="/orcamentos">← Orçamentos</Link></p>
          <h1>Modelos de orçamento</h1>
          <p>Cardápios prontos por tipo de evento. No orçamento, em “Montar rápido”, o modelo traz os itens com as quantidades calculadas pelos convidados.</p>
        </div>
        {editar && <Link className="botao" href="/orcamentos/modelos/novo">Novo modelo</Link>}
      </div>
      {modelos.length === 0 && <p className="cartao mudo">Nenhum modelo ainda.</p>}
      {modelos.map((m) => (
        <section className="cartao" key={m.id} style={m.ativo ? undefined : { opacity: 0.6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0 }}>{m.nome} {!m.ativo && <span className="selo cinza">Inativo</span>}</h2>
            {editar && <Link className="botao secundario pequeno" href={`/orcamentos/modelos/${m.id}`}>Editar</Link>}
          </div>
          {m.descricao && <p className="mudo">{m.descricao}</p>}
          <ul style={{ columns: "2 260px", paddingLeft: 18, marginBottom: 0 }}>
            {[...m.itens].sort((a, b) => a.ordem - b.ordem).map((i) => {
              const o = porId.get(i.catalogo_item_id);
              return (
                <li key={i.catalogo_item_id}>
                  {o?.nome ?? "(item inativo)"}{i.opcional && <span className="mudo"> (opcional)</span>}
                  <span className="mudo" style={{ fontSize: ".8rem" }}> · {o ? descreverRegra(i.regra, i.fator, i.minimo, o.unidade) : ""}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
