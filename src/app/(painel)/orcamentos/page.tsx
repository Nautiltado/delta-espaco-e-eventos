import type { Metadata } from "next";
import Link from "next/link";
import { exigirPermissao } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarCentavos } from "@/lib/dinheiro";
import { formatarData, hojeNaDelta, instanteAtual } from "@/lib/datas";
import { STATUS_ORCAMENTO, type StatusOrcamento } from "@/lib/orcamentos";

export const metadata: Metadata = { title: "Orçamentos" };

type Cartao = {
  id: string;
  numero: string;
  titulo: string;
  status: StatusOrcamento;
  data_evento: string | null;
  atualizado_em: string;
  motivo_perda: string | null;
  clientes: { nome: string };
  orcamento_versoes: { numero: number; status: string; total_centavos: number; validade: string | null }[];
};

const COLUNAS: StatusOrcamento[] = ["rascunho", "enviado", "aprovado", "perdido"];

export default async function PaginaOrcamentos({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const acesso = await exigirPermissao("orcamento.ver");
  const { dias } = await searchParams;
  const janela = Math.min(Math.max(Number(dias) || 60, 7), 365);
  const desde = new Date(instanteAtual() - janela * 86400000).toISOString();
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("orcamentos")
    .select("id, numero, titulo, status, data_evento, atualizado_em, motivo_perda, clientes(nome), orcamento_versoes(numero, status, total_centavos, validade)")
    .or(`status.in.(rascunho,enviado),atualizado_em.gte.${desde}`)
    .order("data_evento", { ascending: true, nullsFirst: false });
  const orcamentos = (data ?? []) as unknown as Cartao[];
  const hoje = hojeNaDelta();

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Orçamentos</h1>
          <p>
            Em elaboração e enviados sempre aparecem; aprovados e perdidos, dos últimos {janela} dias.{" "}
            {janela < 365 && <Link href="/orcamentos?dias=365">Ver o último ano</Link>}
          </p>
        </div>
        <div className="linha">
          <Link className="botao secundario" href="/orcamentos/modelos">Modelos</Link>
          {pode(acesso, "orcamento.criar") && <Link className="botao" href="/orcamentos/novo">Novo orçamento</Link>}
        </div>
      </div>

      <div className="funil">
        {COLUNAS.map((status) => {
          const lista = orcamentos.filter((o) => o.status === status);
          const soma = lista.reduce((s, o) => s + ultimaVersao(o).total, 0);
          return (
            <section className="funil-coluna" key={status}>
              <h2>
                <span>{STATUS_ORCAMENTO[status].rotulo}</span>
                <span className="mudo" style={{ fontFamily: "var(--sans)", fontSize: ".85rem" }}>{lista.length}</span>
              </h2>
              {soma > 0 && <p className="mudo" style={{ margin: "-6px 0 10px" }}>{formatarCentavos(soma)}</p>}
              {lista.length === 0 && <p className="mudo" style={{ margin: "4px 4px 8px", fontSize: ".8rem" }}>Nenhum orçamento aqui.</p>}
              {lista.map((o) => {
                const u = ultimaVersao(o);
                const vencido = status === "enviado" && u.validade && u.validade < hoje;
                return (
                  <Link className="funil-cartao" href={`/orcamentos/${o.id}`} key={o.id}>
                    <strong>{o.clientes.nome}</strong>
                    <span>{o.titulo}</span>
                    <div className="mudo" style={{ fontSize: ".82rem", marginTop: 4 }}>
                      {o.numero}{u.numero > 1 ? ` · v${u.numero}` : ""}
                      {o.data_evento && ` · ${formatarData(o.data_evento)}`}
                    </div>
                    <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between", gap: 6 }}>
                      <span style={{ fontWeight: 600 }}>{u.total > 0 ? formatarCentavos(u.total) : ""}</span>
                      {vencido && <span className="selo erro">validade vencida</span>}
                    </div>
                    {status === "perdido" && o.motivo_perda && <div className="mudo" style={{ fontSize: ".8rem" }}>{o.motivo_perda}</div>}
                  </Link>
                );
              })}
            </section>
          );
        })}
      </div>
    </>
  );
}

function ultimaVersao(o: Cartao) {
  // Valor de referência: a aceita, senão a última enviada, senão o rascunho.
  const v = [...o.orcamento_versoes].sort((a, b) => b.numero - a.numero);
  const ref = v.find((x) => x.status === "aprovada") ?? v.find((x) => x.status === "enviada") ?? v[0];
  return { numero: ref?.numero ?? 1, total: ref?.total_centavos ?? 0, validade: ref?.validade ?? null };
}
