import type { Metadata } from "next";
import Link from "next/link";
import { exigirPermissao } from "@/lib/acesso";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarCentavos } from "@/lib/dinheiro";
import { formatarData, hojeNaDelta } from "@/lib/datas";
import { FORMAS_PAGAMENTO, periodoCurto, somarDias, STATUS_RESERVA, type StatusReserva } from "@/lib/reservas";
import type { ParcelaSituacao } from "@/lib/reserva-dados";

export const metadata: Metadata = { title: "Financeiro" };

type ReservaResumo = { id: string; titulo: string | null; status: StatusReserva; evento_inicio: string; evento_fim: string; clientes: { nome: string } | null };

export default async function PaginaFinanceiro() {
  await exigirPermissao("pagamento.confirmar");
  const hoje = hojeNaDelta();
  const supabase = await criarClienteServidor();

  const [{ data: abertas }, { data: recentes }] = await Promise.all([
    supabase.from("parcelas_situacao").select("*").gt("saldo_centavos", 0).order("vencimento"),
    supabase.from("pagamentos").select("id, tipo, valor_centavos, forma, recebido_em, parcela_id, parcelas(numero, reserva_id)").order("confirmado_em", { ascending: false }).limit(20),
  ]);
  const parcelas = (abertas ?? []) as ParcelaSituacao[];
  const ids = [...new Set([...parcelas.map((p) => p.reserva_id), ...((recentes ?? []) as unknown as { parcelas: { reserva_id: string } | null }[]).map((g) => g.parcelas?.reserva_id ?? "")])].filter(Boolean);
  const { data: rs } = ids.length
    ? await supabase.from("reservas").select("id, titulo, status, evento_inicio, evento_fim, clientes(nome)").in("id", ids)
    : { data: [] };
  const reservas = new Map(((rs ?? []) as unknown as ReservaResumo[]).map((r) => [r.id, r]));

  const ativas = parcelas.filter((p) => {
    const r = reservas.get(p.reserva_id);
    return r && r.status !== "cancelada";
  });
  const limite = somarDias(hoje, 30);
  const grupos = [
    { titulo: "Atrasadas", lista: ativas.filter((p) => p.vencimento < hoje) },
    { titulo: "Vencem até " + formatarData(limite), lista: ativas.filter((p) => p.vencimento >= hoje && p.vencimento <= limite) },
    { titulo: "Depois", lista: ativas.filter((p) => p.vencimento > limite) },
  ];
  const totalAberto = ativas.reduce((s, p) => s + Number(p.saldo_centavos), 0);

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Financeiro</h1>
          <p>Parcelas a receber e últimos lançamentos. A baixa é feita na página da reserva, depois de conferir o extrato.</p>
        </div>
      </div>
      <div className="painel-lateral">
        <div>
          <section className="cartao">
            <h2>A receber · {formatarCentavos(totalAberto)}</h2>
            {ativas.length === 0 && <p className="mudo" style={{ margin: 0 }}>Nenhuma parcela em aberto.</p>}
            {grupos.filter((g) => g.lista.length).map((g) => (
              <div key={g.titulo} style={{ marginBottom: 14 }}>
                <h3 style={{ fontSize: ".95rem", margin: "6px 0" }} className={g.titulo === "Atrasadas" ? "atrasada" : undefined}>{g.titulo}</h3>
                <table>
                  <thead><tr><th>Vence</th><th>Evento</th><th className="numero">Em aberto</th></tr></thead>
                  <tbody>
                    {g.lista.map((p) => {
                      const r = reservas.get(p.reserva_id)!;
                      return (
                        <tr key={p.parcela_id}>
                          <td style={{ whiteSpace: "nowrap" }}>{p.numero === 1 ? "Entrada" : formatarData(p.vencimento)}</td>
                          <td>
                            <Link href={`/reservas/${r.id}`}>{r.clientes?.nome ?? r.titulo}</Link>
                            <div className="mudo">{r.titulo} · {periodoCurto(r.evento_inicio, r.evento_fim)} · {p.numero}ª parcela{r.status === "bloqueio_temporario" ? " · data segura" : r.status === "expirada" ? " · bloqueio expirado" : ""}</div>
                          </td>
                          <td className="numero">{formatarCentavos(Number(p.saldo_centavos))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </section>
        </div>
        <aside>
          <section className="cartao">
            <h2>Últimos lançamentos</h2>
            {(recentes ?? []).length === 0 ? <p className="mudo" style={{ margin: 0 }}>Nenhum ainda.</p> : (
              <table>
                <tbody>
                  {((recentes ?? []) as unknown as { id: string; tipo: string; valor_centavos: number; forma: string; recebido_em: string; parcelas: { numero: number; reserva_id: string } | null }[]).map((g) => {
                    const r = g.parcelas ? reservas.get(g.parcelas.reserva_id) : undefined;
                    return (
                      <tr key={g.id}>
                        <td style={{ whiteSpace: "nowrap" }}>{formatarData(g.recebido_em)}</td>
                        <td>
                          {r ? <Link href={`/reservas/${r.id}`}>{r.clientes?.nome ?? r.titulo}</Link> : "—"}
                          <div className="mudo">{g.tipo === "estorno" ? "Estorno" : FORMAS_PAGAMENTO[g.forma] ?? g.forma}{r && r.status === "cancelada" ? ` · ${STATUS_RESERVA.cancelada.rotulo.toLowerCase()}` : ""}</div>
                        </td>
                        <td className="numero">{g.tipo === "estorno" ? "- " : ""}{formatarCentavos(Number(g.valor_centavos))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
