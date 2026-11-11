import type { Metadata } from "next";
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

export const metadata: Metadata = { title: "Configurações" };

const ORDEM_GRUPOS = ["Empresa", "Contrato", "Reservas", "Preços", "Financeiro", "Cancelamento", "Remarcação", "Terceirizados"];

const dataHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Fortaleza",
});

export default async function PaginaConfiguracoes() {
  const acesso = await exigirAcesso();
  const podeEditar = pode(acesso, "config.critica");
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("configuracoes").select("*").order("grupo").order("ordem");
  const configs = (data ?? []) as Configuracao[];
  const grupos = [...new Set(configs.map((c) => c.grupo))].sort(
    (a, b) => (ORDEM_GRUPOS.indexOf(a) + 99) % 99 - (ORDEM_GRUPOS.indexOf(b) + 99) % 99,
  );

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

      {grupos.map((grupo) => (
        <section className="cartao" key={grupo}>
          <h2>{grupo}</h2>
          <table className="tabela-config">
            <tbody>
              {configs
                .filter((c) => c.grupo === grupo)
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
    </>
  );
}
