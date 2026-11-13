import type { Metadata } from "next";
import Link from "next/link";
import { exigirPermissao } from "@/lib/acesso";
import { criarClienteServidor } from "@/lib/supabase/server";
import { hojeNaDelta, instanteAtual } from "@/lib/datas";
import { horaDaDelta } from "@/lib/salgados";
import { cardapioEEstoque } from "@/lib/salgados-dados";
import { FormularioPedido } from "./formulario";

export const metadata: Metadata = { title: "Novo pedido" };

export default async function PaginaNovoPedido() {
  await exigirPermissao("salgados.criar");
  const supabase = await criarClienteServidor();
  const { produtos, estoque } = await cardapioEEstoque(supabase);
  // Sugestão: daqui a 2 horas, arredondado para a meia hora seguinte, entre 8h e 20h.
  const daqui2h = new Date(instanteAtual() + 2 * 3600000);
  const [h, m] = horaDaDelta(daqui2h.toISOString()).split(":").map(Number);
  let hora = m === 0 ? h : m <= 30 ? h + 0.5 : h + 1;
  hora = Math.min(Math.max(hora, 8), 20);
  const horaSugerida = `${String(Math.floor(hora)).padStart(2, "0")}:${hora % 1 ? "30" : "00"}`;
  return (
    <>
      <div className="cabecalho">
        <div>
          <p style={{ margin: 0 }}><Link href="/salgados">← Encomendas</Link></p>
          <h1>Novo pedido</h1>
          <p>Retirada no Delta. O cliente paga tudo na hora do pedido.</p>
        </div>
      </div>
      <FormularioPedido produtos={produtos} estoque={estoque} hoje={hojeNaDelta()} horaSugerida={horaSugerida} />
    </>
  );
}
