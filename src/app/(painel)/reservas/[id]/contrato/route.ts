import { renderToBuffer } from "@react-pdf/renderer";
import { obterSessao, sessaoCompleta } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { DocumentoContrato } from "@/lib/pdf/contrato";

/** PDF do contrato, sempre do texto congelado na geração (o mesmo da impressão digital). */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const sessao = await obterSessao();
  if (!sessaoCompleta(sessao)) return new Response("Faça login.", { status: 401 });
  if (!pode(sessao.acesso, "orcamento.ver")) return new Response("Sem permissão.", { status: 403 });

  const { id } = await ctx.params;
  const versao = Number(new URL(request.url).searchParams.get("versao")) || undefined;
  const supabase = await criarClienteServidor();
  let consulta = supabase.from("contratos").select("versao, status, texto, conteudo, conteudo_hash").eq("reserva_id", id);
  consulta = versao ? consulta.eq("versao", versao) : consulta.order("versao", { ascending: false }).limit(1);
  const { data } = await consulta.maybeSingle();
  if (!data?.texto) return new Response("Contrato não encontrado.", { status: 404 });

  const numero = (data.conteudo as { numero?: string } | null)?.numero ?? `v${data.versao}`;
  const pdf = await renderToBuffer(DocumentoContrato({ texto: data.texto, numero, hash: data.conteudo_hash, situacao: data.status }));
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="contrato-${numero}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
