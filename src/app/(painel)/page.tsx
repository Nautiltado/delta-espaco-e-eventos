import type { Metadata } from "next";
import Link from "next/link";
import { exigirAcesso } from "@/lib/acesso";
import { pode } from "@/lib/permissoes";

export const metadata: Metadata = { title: "Início" };

const FASES = [
  { n: 1, nome: "Planejamento", situacao: "concluida" },
  { n: 2, nome: "Fundação: login, perfis, auditoria, configurações", situacao: "atual" },
  { n: 3, nome: "Comercial: clientes, catálogo, orçamentos", situacao: "proxima" },
  { n: 4, nome: "Reservas, contratos e pagamentos (primeiro uso real)", situacao: "futura" },
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
  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>{saudacao()}, {primeiroNome}</h1>
          <p>O sistema está na Fase 2: a base de acesso e configuração já funciona.</p>
        </div>
      </div>

      <div className="grade">
        <section className="cartao">
          <h2>O que já dá para fazer</h2>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
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
          <p className="mudo" style={{ marginTop: 0 }}>Itens que só a Delta pode fornecer:</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>Faixas de cancelamento e revisão do contrato por advogado</li>
            <li>Nome e CPF de quem assina pela Delta</li>
            <li>Horários típicos dos eventos e da limpeza</li>
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
