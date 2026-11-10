import { renderToBuffer } from "@react-pdf/renderer";
import { obterSessao } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { DocumentoOrcamento } from "@/lib/pdf/orcamento";
import {
  conteudoDaPrevia,
  SELECT_ORCAMENTO,
  versaoEmFoco,
  type ItemOrcamento,
  type Orcamento,
  type Versao,
} from "@/lib/orcamento-dados";

/**
 * PDF do orçamento. Versão enviada: gerado do conteúdo congelado no envio (sempre igual ao que o cliente recebeu).
 * Rascunho: prévia com marca d'água, a partir dos dados atuais.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const sessao = await obterSessao();
  if (!sessao?.acesso || sessao.trocarSenha) return new Response("Faça login.", { status: 401 });
  if (!pode(sessao.acesso, "orcamento.ver")) return new Response("Sem permissão.", { status: 403 });

  const { id } = await ctx.params;
  const pedida = Number(new URL(request.url).searchParams.get("versao")) || undefined;
  const supabase = await criarClienteServidor();
  const [{ data: orcamento }, { data: versoes }] = await Promise.all([
    supabase.from("orcamentos").select(SELECT_ORCAMENTO).eq("id", id).maybeSingle(),
    supabase.from("orcamento_versoes").select("*").eq("orcamento_id", id).order("numero", { ascending: false }),
  ]);
  if (!orcamento) return new Response("Orçamento não encontrado.", { status: 404 });
  const v = versaoEmFoco((versoes ?? []) as Versao[], pedida);
  if (!v) return new Response("Versão não encontrada.", { status: 404 });

  const previa = v.status === "rascunho";
  let conteudo = v.snapshot;
  if (previa || !conteudo) {
    const { data: itens } = await supabase
      .from("orcamento_itens").select("*").eq("versao_id", v.id).order("ordem").order("descricao");
    conteudo = await conteudoDaPrevia(supabase, orcamento as Orcamento, v, (itens ?? []) as ItemOrcamento[]);
  }

  // Chamada direta: o componente devolve o <Document> que o renderizador espera.
  const pdf = await renderToBuffer(DocumentoOrcamento({ c: conteudo, previa, hash: previa ? null : v.conteudo_hash }));
  const nome = `${conteudo.orcamento.numero}-v${v.numero}${previa ? "-previa" : ""}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nome}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
