import type { Metadata } from "next";
import Link from "next/link";
import { exigirAcesso } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { instanteAtual } from "@/lib/datas";
import { ListaTarefas, SELECT_TAREFA, type Tarefa } from "./tarefas/lista";

export const metadata: Metadata = { title: "Início" };

const FASES = [
  { n: 1, nome: "Planejamento", situacao: "concluida" },
  { n: 2, nome: "Fundação: login, perfis, auditoria, configurações", situacao: "concluida" },
  { n: 3, nome: "Comercial: clientes, catálogo, orçamentos, tarefas", situacao: "atual" },
  { n: 4, nome: "Reservas, contratos e pagamentos (primeiro uso real)", situacao: "proxima" },
  { n: 5, nome: "Salgados e cozinha", situacao: "futura" },
  { n: 6, nome: "WhatsApp", situacao: "futura" },
  { n: 7, nome: "Financeiro e operação dos eventos", situacao: "futura" },
  { n: 8, nome: "Relatórios e inteligência", situacao: "futura" },
] as const;

const SELO: Record<string, { texto: string; classe: string }> = {
  concluida: { texto: "Concluída", classe: "selo" },
  atual: { texto: "Em uso agora", classe: "selo dourado" },
  proxima: { texto: "Próxima", classe: "selo cinza" },
  futura: { texto: "Prevista", classe: "selo cinza" },
};

function saudacao(): string {
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Fortaleza" }).format(new Date()),
  );
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function Inicio() {
  const acesso = await exigirAcesso();
  const primeiroNome = acesso.nome.split(" ")[0];
  const supabase = await criarClienteServidor();
  const fimDoDia = new Date(instanteAtual() + 86400000).toISOString();
  const [{ data: tarefas }, abertos] = await Promise.all([
    supabase.from("tarefas").select(SELECT_TAREFA).is("concluida_em", null).eq("responsavel", acesso.id)
      .lte("vence_em", fimDoDia).order("vence_em").limit(10),
    pode(acesso, "orcamento.ver")
      ? supabase.from("orcamentos").select("status", { count: "exact", head: true }).eq("status", "enviado")
      : Promise.resolve({ count: null }),
  ]);
  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>{saudacao()}, {primeiroNome}</h1>
          <p>Fase 3 em uso: clientes, catálogo, orçamentos com PDF e tarefas.</p>
        </div>
      </div>

      <section className="cartao" style={{ marginBottom: 18 }}>
        <h2>Para hoje</h2>
        <ListaTarefas tarefas={(tarefas ?? []) as unknown as Tarefa[]} agora={instanteAtual()} />
        <p style={{ marginBottom: 0 }}>
          <Link href="/tarefas">Todas as tarefas</Link>
          {abertos.count ? <> · <Link href="/orcamentos">{abertos.count} orçamento(s) aguardando resposta do cliente</Link></> : null}
        </p>
      </section>

      <div className="grade">
        <section className="cartao">
          <h2>O que já dá para fazer</h2>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {pode(acesso, "orcamento.criar") && (
              <li><Link href="/orcamentos/novo">Fazer um orçamento</Link> com itens do catálogo ou livres, gerar o PDF e registrar o aceite.</li>
            )}
            {pode(acesso, "cliente.ver") && (
              <li><Link href="/clientes">Consultar clientes</Link>, com aviso de cadastro repetido.</li>
            )}
            {pode(acesso, "catalogo.alterar") && (
              <li><Link href="/catalogo">Manter o catálogo</Link> com preço, faixa e custo interno.</li>
            )}
            {pode(acesso, "config.critica") && (
              <li><Link href="/usuarios">Cadastrar pessoas da equipe</Link> e escolher o perfil de cada uma.</li>
            )}
            <li>
              <Link href="/configuracoes">Ver{pode(acesso, "config.critica") ? " e ajustar" : ""} as configurações</Link>:
              prazos, faixas de preço, sinal e valores de terceirizados.
            </li>
            {pode(acesso, "auditoria.ver") && (
              <li><Link href="/auditoria">Consultar a auditoria</Link>: quem mudou o quê, e quando.</li>
            )}
          </ul>
        </section>
        <section className="cartao">
          <h2>Para ir ao ar na Fase 4</h2>
          <p className="mudo" style={{ marginTop: 0 }}>Política, signatários e horários já recebidos. Falta:</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>Leitura final da política e do contrato por advogado inscrito na OAB</li>
          </ul>
        </section>
      </div>

      <section className="cartao" style={{ marginTop: 18 }}>
        <h2>Fases do projeto</h2>
        <table>
          <tbody>
            {FASES.map((f) => (
              <tr key={f.n}>
                <td style={{ width: 70 }} className="mudo">Fase {f.n}</td>
                <td>{f.nome}</td>
                <td style={{ textAlign: "right" }}>
                  <span className={SELO[f.situacao].classe}>{SELO[f.situacao].texto}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
