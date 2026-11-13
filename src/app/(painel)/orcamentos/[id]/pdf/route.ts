import { renderToBuffer } from "@react-pdf/renderer";
import { obterSessao, sessaoCompleta } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { DocumentoOrcamento } from "@/lib/pdf/orcamento";
import { DocumentoProposta } from "@/lib/pdf/proposta";
import { hojeNaDelta } from "@/lib/datas";
import { somarDias } from "@/lib/reservas";
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
  if (!sessaoCompleta(sessao)) return new Response("Faça login.", { status: 401 });
  if (!pode(sessao.acesso, "orcamento.ver")) return new Response("Sem permissão.", { status: 403 });

  const { id } = await ctx.params;
  const url = new URL(request.url);
  const pedida = Number(url.searchParams.get("versao")) || undefined;
  // Padrão: proposta comercial (cardápio por categoria e valor total). "detalhado": itens com quantidade e preço.
  const detalhado = url.searchParams.get("formato") === "detalhado";
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

  let pdf: Buffer;
  if (detalhado) {
    // Chamada direta: o componente devolve o <Document> que o renderizador espera.
    pdf = await renderToBuffer(DocumentoOrcamento({ c: conteudo, previa, hash: previa ? null : v.conteudo_hash }));
  } else {
    const { data: cfg } = await supabase
      .from("configuracoes").select("chave, valor").in("chave", ["evento.confirmacao_convidados_dias", "orcamento.validade_dias"]);
    const valor = (k: string) => Number((cfg ?? []).find((x) => x.chave === k)?.valor);
    if (previa && !conteudo.validade) conteudo = { ...conteudo, validade: somarDias(hojeNaDelta(), valor("orcamento.validade_dias") || 7) };
    // Versões enviadas antes da proposta comercial não guardaram a categoria: procura pelo nome no catálogo.
    let categoriaPorNome: Map<string, string> | undefined;
    if (conteudo.itens.some((i) => !i.categoria)) {
      const { data: cat } = await supabase.from("catalogo_itens").select("nome, categoria");
      categoriaPorNome = new Map((cat ?? []).map((x) => [String(x.nome).trim().toLowerCase(), String(x.categoria)]));
    }
    pdf = await renderToBuffer(DocumentoProposta({
      c: conteudo, previa, confirmacaoDias: valor("evento.confirmacao_convidados_dias") || 10, categoriaPorNome,
    }));
  }
  const nome = `${conteudo.orcamento.numero}-v${v.numero}${detalhado ? "-detalhado" : ""}${previa ? "-previa" : ""}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nome}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
