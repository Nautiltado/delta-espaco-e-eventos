import type { Metadata } from "next";
import Link from "next/link";
import { Building2, CalendarClock, FileSignature, History, Ban, Repeat, Users, Tag, Wallet, Timer, Settings2, ScrollText, ShieldCheck, Ruler } from "lucide-react";
import { exigirAcesso } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import {
  exibirValor,
  faixaParaCampos,
  valorParaCampo,
  type Configuracao,
} from "@/lib/configuracoes";
import { CampoConfiguracao } from "./campo";
import { TemposDoEspaco } from "./tempos";

export const metadata: Metadata = { title: "Configurações" };

const ORDEM_GRUPOS = ["Empresa", "Contrato", "Reservas", "Preços", "Financeiro", "Cancelamento", "Remarcação", "Terceirizados"];

const dataHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Fortaleza",
});

const ICONES: Record<string, React.ReactNode> = {
  Empresa: <Building2 aria-hidden />, Contrato: <FileSignature aria-hidden />, Reservas: <CalendarClock aria-hidden />,
  Preços: <Tag aria-hidden />, Financeiro: <Wallet aria-hidden />, Cancelamento: <Ban aria-hidden />,
  Remarcação: <Repeat aria-hidden />, Terceirizados: <Users aria-hidden />,
};
const slug = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");

export default async function PaginaConfiguracoes({ searchParams }: { searchParams: Promise<{ secao?: string }> }) {
  const { secao } = await searchParams;
  const acesso = await exigirAcesso();
  const podeEditar = pode(acesso, "config.critica");
  const supabase = await criarClienteServidor();
  const [{ data }, { data: espacos }] = await Promise.all([
    supabase.from("configuracoes").select("*").order("grupo").order("ordem"),
    supabase.from("recursos").select("id, nome, montagem_horas, desmontagem_horas, limpeza_horas, intervalo_horas")
      .eq("tipo", "espaco").eq("ativo", true).order("capacidade"),
  ]);
  const configs = (data ?? []) as Configuracao[];
  // o mesmo grupo pode vir escrito com e sem maiúscula: junta e mostra o nome com maiúscula
  const nomesDosGrupos = new Map<string, string>();
  for (const c of configs) {
    const k = slug(c.grupo);
    const atual = nomesDosGrupos.get(k);
    if (!atual || (atual[0] === atual[0].toLowerCase() && c.grupo[0] !== c.grupo[0].toLowerCase())) nomesDosGrupos.set(k, c.grupo);
  }
  const grupos = [...nomesDosGrupos.values()].sort(
    (a, b) => (ORDEM_GRUPOS.indexOf(a) + 99) % 99 - (ORDEM_GRUPOS.indexOf(b) + 99) % 99,
  );

  const atual = secao === "tempos" || grupos.some((g) => slug(g) === secao) ? secao! : slug(grupos[0] ?? "");
  const grupoAtual = grupos.find((g) => slug(g) === atual);

  const num = (k: string, p: number) => { const n = Number(configs.find((c) => c.chave === k)?.valor); return Number.isFinite(n) ? n : p; };
  const padrao = {
    montagem: num("espaco.montagem_horas", 0), desmontagem: num("espaco.desmontagem_horas", 0),
    limpeza: num("espaco.limpeza_horas", 4), intervalo: num("espaco.intervalo_horas", 0),
  };
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Configurações</h1>
          <p>
            Valores que o sistema usa como padrão. {podeEditar
              ? "Toda alteração fica registrada na auditoria, com o valor anterior."
              : "Somente administradores podem alterar."}
          </p>
        </div>
      </div>

      <div className="config-layout">
        <nav className="config-nav" aria-label="Seções das configurações">
          <p className="config-nav-titulo">Configurações</p>
          {grupos.map((g) => (
            <Link key={g} href={`/configuracoes?secao=${slug(g)}`} aria-current={atual === slug(g) ? "page" : undefined} scroll={false}>
              {ICONES[g] ?? <Settings2 aria-hidden />}{g}
            </Link>
          ))}
          {(espacos ?? []).length > 0 && (
            <Link href="/configuracoes?secao=tempos" aria-current={atual === "tempos" ? "page" : undefined} scroll={false}><Timer aria-hidden />Tempos dos espaços</Link>
          )}
          <p className="config-nav-titulo">Atalhos</p>
          {pode(acesso, "orcamento.ver") && <Link href="/catalogo/unidades"><Ruler aria-hidden />Unidades de cobrança</Link>}
          {pode(acesso, "contrato.editar") && <Link href="/contratos/modelo"><ScrollText aria-hidden />Modelo de contrato</Link>}
          {pode(acesso, "config.critica") && <Link href="/usuarios"><ShieldCheck aria-hidden />Usuários e acessos</Link>}
          {pode(acesso, "auditoria.ver") && <Link href="/auditoria"><History aria-hidden />Auditoria</Link>}
        </nav>
        <div className="config-conteudo">
      {grupoAtual && [grupoAtual].map((grupo) => (
        <section className="cartao" key={grupo}>
          <h2>{grupo}</h2>
          <table className="tabela-config">
            <tbody>
              {configs
                .filter((c) => slug(c.grupo) === slug(grupo))
                .map((c) => (
                  <tr key={c.chave}>
                    <td style={{ width: "38%" }}>
                      <strong>{c.descricao}</strong>{c.restrita && <> <span className="selo dourado">restrita</span></>}
                      <div className="mudo">
                        Atual: {exibirValor(c.tipo, c.valor)} · alterado em {dataHora.format(new Date(c.atualizado_em))}
                      </div>
                    </td>
                    <td>
                      {podeEditar ? (
                        <CampoConfiguracao
                          chave={c.chave}
                          tipo={c.tipo}
                          valorCampo={valorParaCampo(c.tipo, c.valor)}
                          faixa={c.tipo === "faixa_centavos" ? faixaParaCampos(c.valor) : undefined}
                        />
                      ) : (
                        exibirValor(c.tipo, c.valor)
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      ))}

      {atual === "tempos" && (espacos ?? []).length > 0 && (
        <section className="cartao">
          <h2>Tempos de cada espaço</h2>
          <p className="mudo">
            Folgas que a agenda reserva antes e depois de cada evento. Em branco, o espaço usa o padrão geral
            (grupo Reservas). Cada evento ainda pode ter montagem e desmontagem próprias ao segurar a data.
          </p>
          {(espacos ?? []).map((e) => (
            <TemposDoEspaco key={e.id} id={e.id} nome={e.nome} padrao={padrao} podeEditar={podeEditar}
              tempos={{ montagem: n(e.montagem_horas), desmontagem: n(e.desmontagem_horas), limpeza: n(e.limpeza_horas), intervalo: n(e.intervalo_horas) }} />
          ))}
        </section>
      )}
        </div>
      </div>
    </>
  );
}
