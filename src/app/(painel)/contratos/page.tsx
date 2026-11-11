import type { Metadata } from "next";
import { exigirPermissao } from "@/lib/acesso";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarDataHora } from "@/lib/datas";
import { MARCADORES_CONHECIDOS } from "@/lib/contrato";
import { FormularioModelo } from "../reservas/componentes";

export const metadata: Metadata = { title: "Modelo de contrato" };

export default async function PaginaModeloContrato() {
  await exigirPermissao("contrato.editar");
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("contrato_modelos")
    .select("versao, titulo, corpo, anexo, observacao, criado_em, usuarios:criado_por(nome)")
    .order("versao", { ascending: false });
  const modelos = (data ?? []) as unknown as {
    versao: number; titulo: string; corpo: string; anexo: string | null; observacao: string | null; criado_em: string; usuarios: { nome: string } | null;
  }[];
  const atual = modelos[0];

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Modelo de contrato</h1>
          <p>Salvar cria uma versão nova. Contratos já gerados ficam com o texto da versão em que foram gerados.</p>
        </div>
      </div>
      <p className="aviso info">
        Antes do primeiro contrato real, peça a um advogado para revisar este texto e o Anexo I.
      </p>
      <div className="painel-lateral">
        <section className="cartao">
          <h2>{atual ? `Versão ${atual.versao} em uso` : "Nenhum modelo ainda"}</h2>
          <FormularioModelo titulo={atual?.titulo ?? "Contrato de prestação de serviços para evento"} corpo={atual?.corpo ?? ""} anexo={atual?.anexo ?? ""} />
        </section>
        <aside>
          <section className="cartao">
            <h2>Marcadores</h2>
            <p className="mudo" style={{ marginTop: 0 }}>O sistema troca cada marcador pelos dados da reserva ao gerar o contrato.</p>
            <ul style={{ paddingLeft: 18, margin: 0, fontFamily: "ui-monospace, monospace", fontSize: ".8rem" }}>
              {MARCADORES_CONHECIDOS.map((m) => <li key={m}>{`{{${m}}}`}</li>)}
            </ul>
          </section>
          <section className="cartao">
            <h2>Versões</h2>
            <table>
              <tbody>
                {modelos.map((m) => (
                  <tr key={m.versao}>
                    <td>v{m.versao}</td>
                    <td>{m.observacao ?? m.titulo}<div className="mudo">{formatarDataHora(m.criado_em)}{m.usuarios ? ` · ${m.usuarios.nome}` : ""}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </aside>
      </div>
    </>
  );
}
