import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirPermissao } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarDocumento, formatarTelefone, linkWhatsApp } from "@/lib/documentos";
import { formatarData, formatarDataHora } from "@/lib/datas";
import { STATUS_ORCAMENTO, type StatusOrcamento } from "@/lib/orcamentos";
import { alternarAtivoCliente, type Duplicado } from "../actions";
import { FormularioMesclagem } from "./mesclar";
import { AvisoDaPagina } from "@/componentes/avisos";

export const metadata: Metadata = { title: "Cliente" };

const ORIGEM: Record<string, string> = {
  whatsapp: "WhatsApp", instagram: "Instagram", indicacao: "Indicação", balcao: "Balcão", telefone: "Telefone", outro: "Outro",
};

export default async function FichaCliente({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mesclado?: string }>;
}) {
  const acesso = await exigirPermissao("cliente.ver");
  const { id } = await params;
  const { mesclado } = await searchParams;
  const supabase = await criarClienteServidor();
  const { data: c } = await supabase.from("clientes").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();

  const [orcamentos, tarefas, duplicados] = await Promise.all([
    pode(acesso, "orcamento.ver")
      ? supabase.from("orcamentos").select("id, numero, titulo, status, data_evento, criado_em")
          .eq("cliente_id", id).order("criado_em", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from("tarefas").select("id, titulo, vence_em, concluida_em").eq("cliente_id", id)
      .is("concluida_em", null).order("vence_em"),
    pode(acesso, "cliente.mesclar") && !c.mesclado_em
      ? supabase.rpc("buscar_duplicados", { p_nome: c.nome, p_telefone: c.telefone, p_documento: c.documento, p_ignorar: id })
      : Promise.resolve({ data: [] }),
  ]);
  const whatsapp = linkWhatsApp(c.telefone);
  const candidatos = ((duplicados.data ?? []) as Duplicado[]).map((d) => ({
    id: d.id,
    rotulo: `${d.nome}${d.telefone ? ` · ${formatarTelefone(d.telefone)}` : ""}${d.documento ? ` · ${formatarDocumento(d.documento)}` : ""} (${d.motivo})`,
  }));

  return (
    <>
      <div className="cabecalho">
        <div>
          <p style={{ margin: 0 }}><Link href="/clientes">← Clientes</Link></p>
          <h1>{c.nome}</h1>
          <p>
            <span className="selo cinza">{c.tipo === "PJ" ? "Empresa" : "Pessoa física"}</span>{" "}
            {!c.ativo && <span className="selo erro">Inativo</span>}{" "}
            {c.mesclado_em && <>Mesclado em <Link href={`/clientes/${c.mesclado_em}`}>outro cadastro</Link></>}
          </p>
        </div>
        <div className="linha">
          {pode(acesso, "orcamento.criar") && c.ativo && (
            <Link className="botao" href={`/orcamentos/novo?cliente=${c.id}`}>Novo orçamento</Link>
          )}
          {pode(acesso, "cliente.editar") && !c.mesclado_em && (
            <Link className="botao secundario" href={`/clientes/${c.id}/editar`}>Editar</Link>
          )}
        </div>
      </div>
      {mesclado && <AvisoDaPagina texto="Cadastros mesclados. O histórico do cadastro repetido agora está aqui." />}

      <div className="grade">
        <section className="cartao">
          <h2>Dados</h2>
          <table>
            <tbody>
              {c.nome_fantasia && <tr><td className="mudo">Nome fantasia</td><td>{c.nome_fantasia}</td></tr>}
              {c.responsavel_nome && <tr><td className="mudo">Responsável</td><td>{c.responsavel_nome}</td></tr>}
              <tr><td className="mudo">{c.tipo === "PJ" ? "CNPJ" : "CPF"}</td><td>{formatarDocumento(c.documento) || <span className="mudo">não informado</span>}</td></tr>
              <tr>
                <td className="mudo">Telefone</td>
                <td>
                  {formatarTelefone(c.telefone) || <span className="mudo">não informado</span>}
                  {whatsapp && <> · <a href={whatsapp} target="_blank" rel="noreferrer">abrir WhatsApp</a></>}
                </td>
              </tr>
              {c.email && <tr><td className="mudo">E-mail</td><td><a href={`mailto:${c.email}`}>{c.email}</a></td></tr>}
              {(c.endereco || c.cidade) && (
                <tr><td className="mudo">Endereço</td><td>{[c.endereco, c.cidade && `${c.cidade}${c.uf ? `-${c.uf}` : ""}`].filter(Boolean).join(", ")}</td></tr>
              )}
              {c.origem && <tr><td className="mudo">Origem</td><td>{ORIGEM[c.origem] ?? c.origem}</td></tr>}
              {c.observacoes && <tr><td className="mudo">Observações</td><td style={{ whiteSpace: "pre-wrap" }}>{c.observacoes}</td></tr>}
              <tr><td className="mudo">Cadastrado em</td><td>{formatarDataHora(c.criado_em)}</td></tr>
            </tbody>
          </table>
          {pode(acesso, "cliente.editar") && !c.mesclado_em && (
            <form action={alternarAtivoCliente} style={{ marginTop: 12 }}>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="ativar" value={c.ativo ? "0" : "1"} />
              <button className="botao secundario pequeno">{c.ativo ? "Inativar cliente" : "Reativar cliente"}</button>
            </form>
          )}
        </section>

        <section className="cartao">
          <h2>Tarefas abertas</h2>
          {(tarefas.data ?? []).length === 0 ? (
            <p className="mudo">Nenhuma.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {(tarefas.data ?? []).map((t) => (
                <li key={t.id}>{t.titulo}{t.vence_em && <span className="mudo"> · até {formatarDataHora(t.vence_em)}</span>}</li>
              ))}
            </ul>
          )}
          <p style={{ marginBottom: 0 }}><Link href={`/tarefas?cliente=${c.id}`}>Ver ou criar tarefas</Link></p>
        </section>
      </div>

      {pode(acesso, "orcamento.ver") && (
        <section className="cartao" style={{ marginTop: 18 }}>
          <h2>Orçamentos</h2>
          {(orcamentos.data ?? []).length === 0 ? (
            <p className="mudo">Nenhum orçamento ainda.</p>
          ) : (
            <table>
              <thead><tr><th>Número</th><th>Evento</th><th>Data do evento</th><th>Situação</th></tr></thead>
              <tbody>
                {(orcamentos.data ?? []).map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/orcamentos/${o.id}`}>{o.numero}</Link></td>
                    <td>{o.titulo}</td>
                    <td>{formatarData(o.data_evento)}</td>
                    <td><span className={STATUS_ORCAMENTO[o.status as StatusOrcamento].classe}>{STATUS_ORCAMENTO[o.status as StatusOrcamento].rotulo}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {candidatos.length > 0 && (
        <section className="cartao" style={{ marginTop: 18 }}>
          <h2>Possíveis cadastros repetidos</h2>
          <FormularioMesclagem destino={c.id} candidatos={candidatos} />
        </section>
      )}
    </>
  );
}
