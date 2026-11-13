import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import { exigirPermissao } from "@/lib/acesso";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarDataHora, hojeNaDelta } from "@/lib/datas";
import { somarDias } from "@/lib/reservas";
import { lerConfiguracoes } from "@/lib/reserva-dados";
import { MARCADORES_CONHECIDOS, planoDeParcelas, valoresDoContrato } from "@/lib/contrato";
import { BotaoJanela } from "@/componentes/janela";
import { EditorModelo } from "./editor";

export const metadata: Metadata = { title: "Modelo de contrato" };

export default async function PaginaModeloContrato() {
  await exigirPermissao("contrato.editar");
  const supabase = await criarClienteServidor();
  const [{ data }, cfg] = await Promise.all([
    supabase.from("contrato_modelos")
      .select("versao, titulo, corpo, anexo, observacao, criado_em, usuarios:criado_por(nome)")
      .order("versao", { ascending: false }),
    lerConfiguracoes(supabase, ["empresa."]),
  ]);
  const modelos = (data ?? []) as unknown as {
    versao: number; titulo: string; corpo: string; anexo: string | null; observacao: string | null; criado_em: string; usuarios: { nome: string } | null;
  }[];
  const atual = modelos[0];

  // Exemplo só para a pré-visualização: dados da empresa reais, cliente e evento fictícios (nada é gravado).
  const hoje = hojeNaDelta();
  const dia = somarDias(hoje, 60);
  const empresa = (k: string) => String(cfg[`empresa.${k}`] ?? "").trim();
  const total = 850000;
  const exemplo = valoresDoContrato({
    numero: "CTR-EXEMPLO-0001", hoje, canal: "estabelecimento", signatario: "Nome de quem assina pela Delta (exemplo)",
    empresa: { razao_social: empresa("razao_social"), nome_fantasia: empresa("nome_fantasia"), cnpj: empresa("cnpj"), endereco: empresa("endereco"), cidade: empresa("cidade") || "Bacabal" },
    cliente: { tipo: "PF", nome: "Maria Exemplo da Silva", nome_fantasia: null, documento: "00000000000", responsavel_nome: null,
      endereco: "Rua do Exemplo, 100, Centro", cidade: "Bacabal", uf: "MA", telefone: "99900000000", email: "maria@exemplo.com" },
    orcamento: { numero: "ORC-EXEMPLO-0001", versao: 1, titulo: "Aniversário de 15 anos (exemplo)", convidados: 150, local_externo: null },
    espacos: ["Espaço maior"],
    evento: { inicio: `${dia}T19:00:00-03:00`, fim: `${dia}T23:59:00-03:00` },
    itens: [
      { descricao: "Locação do espaço maior", unidade: "evento", quantidade: 1, preco_unitario_centavos: 350000, total_centavos: 350000 },
      { descricao: "Salgados fritos sortidos", unidade: "cento", quantidade: 15, preco_unitario_centavos: 8000, total_centavos: 120000, equivalencia: "1.500 unidades" },
      { descricao: "Garçom", unidade: "pessoa", quantidade: 6, preco_unitario_centavos: 15000, total_centavos: 90000 },
      { descricao: "Bolo decorado", unidade: "unidade", quantidade: 1, preco_unitario_centavos: 290000, total_centavos: 290000 },
    ],
    subtotal_centavos: total, desconto_centavos: 0, total_centavos: total,
    parcelas: planoDeParcelas(total, dia, hoje, { sinalPercentual: 30, saldoDiasAntes: 7, integralDias: 15 }),
  });

  return (
    <>
      <div className="cabecalho">
        <div>
          <p style={{ margin: 0 }}><Link href="/contratos">← Contratos</Link></p>
          <h1>Modelo de contrato</h1>
          <p>{atual ? `Versão ${atual.versao} em uso. ` : ""}Salvar cria uma versão nova; contratos já gerados ficam com o texto da versão em que foram gerados.</p>
        </div>
        <BotaoJanela rotulo={`Versões (${modelos.length})`} icone={<History aria-hidden />} classe="botao secundario" titulo="Versões do modelo">
          <ul className="pedidos-lista">
            {modelos.map((m) => (
              <li key={m.versao}>
                <div><strong>v{m.versao}</strong> · {m.observacao ?? m.titulo}</div>
                <div className="mudo pequeno" style={{ textAlign: "right" }}>{formatarDataHora(m.criado_em)}{m.usuarios ? <div>{m.usuarios.nome}</div> : null}</div>
              </li>
            ))}
          </ul>
        </BotaoJanela>
      </div>
      <p className="aviso info" role="note">Antes do primeiro contrato real, peça a um advogado para revisar este texto e o Anexo I.</p>
      <EditorModelo
        titulo={atual?.titulo ?? "Contrato de prestação de serviços para evento"}
        corpo={atual?.corpo ?? ""}
        anexo={atual?.anexo ?? ""}
        marcadores={MARCADORES_CONHECIDOS}
        exemplo={exemplo}
      />
    </>
  );
}
