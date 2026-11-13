// Montagem do texto do contrato a partir do modelo (com {{marcadores}}) e dos dados da reserva.
// O texto final é gravado pelo banco com impressão digital (sha256) e não muda mais.

import { formatarCentavos } from "@/lib/dinheiro";
import { formatarData } from "@/lib/datas";
import { formatarDocumento, formatarTelefone } from "@/lib/documentos";
import { reaisPorExtenso } from "@/lib/extenso";
import { formatarQuantidade, rotuloUnidade } from "@/lib/orcamentos";
import { dataPorExtenso, descreverPeriodo, diaNaDelta, somarDias } from "@/lib/reservas";

export type ParcelaPlano = { numero: number; valor_centavos: number; vencimento: string };

/** Mesma regra do banco (gerar_contrato): entrada arredondada para cima; integral se o evento está perto. */
export function planoDeParcelas(
  totalCentavos: number,
  dataEvento: string,
  hoje: string,
  cfg: { sinalPercentual: number; saldoDiasAntes: number; integralDias: number },
): ParcelaPlano[] {
  const dias = Math.round((Date.parse(`${dataEvento}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86400000);
  if (dias < cfg.integralDias) return [{ numero: 1, valor_centavos: totalCentavos, vencimento: hoje }];
  const sinal = Math.floor((totalCentavos * cfg.sinalPercentual + 99) / 100);
  return [
    { numero: 1, valor_centavos: sinal, vencimento: hoje },
    { numero: 2, valor_centavos: totalCentavos - sinal, vencimento: somarDias(dataEvento, -cfg.saldoDiasAntes) },
  ];
}

export type DadosContrato = {
  numero: string;
  hoje: string;
  canal: "estabelecimento" | "fora_estabelecimento";
  signatario: string;
  empresa: { razao_social: string; nome_fantasia: string; cnpj: string; endereco: string; cidade: string; uf?: string };
  cliente: {
    tipo: "PF" | "PJ";
    nome: string;
    nome_fantasia: string | null;
    documento: string | null;
    responsavel_nome: string | null;
    endereco: string | null;
    cidade: string | null;
    uf: string | null;
    telefone: string | null;
    email: string | null;
  };
  orcamento: { numero: string; versao: number; titulo: string; convidados: number | null; local_externo: string | null };
  espacos: string[];
  evento: { inicio: string; fim: string };
  itens: { descricao: string; unidade: string; quantidade: number; preco_unitario_centavos: number; total_centavos: number;
    desconto_centavos?: number; equivalencia?: string | null }[];
  subtotal_centavos: number;
  desconto_centavos: number;
  total_centavos: number;
  parcelas: ParcelaPlano[];
};

function localDoCliente(c: DadosContrato["cliente"]): string {
  const cidade = [c.cidade, c.uf].filter(Boolean).join("-");
  return [c.endereco?.trim(), cidade].filter(Boolean).join(", ");
}

export function qualificacaoDoCliente(c: DadosContrato["cliente"]): string {
  const contato = [c.telefone && `telefone ${formatarTelefone(c.telefone)}`, c.email && `e-mail ${c.email}`].filter(Boolean).join(", ");
  if (c.tipo === "PJ") {
    return (
      `${c.nome.trim()}` +
      (c.nome_fantasia ? `, nome fantasia ${c.nome_fantasia.trim()}` : "") +
      `, pessoa jurídica inscrita no CNPJ sob o nº ${formatarDocumento(c.documento)}, com sede na ${localDoCliente(c)}` +
      (contato ? `, ${contato}` : "") +
      `, neste ato representada por ${c.responsavel_nome?.trim()}.`
    );
  }
  return (
    `${c.nome.trim()}, inscrito(a) no CPF sob o nº ${formatarDocumento(c.documento)}, residente e domiciliado(a) na ${localDoCliente(c)}` +
    (contato ? `, ${contato}` : "") +
    "."
  );
}

function assinaturaDoCliente(c: DadosContrato["cliente"]): string {
  if (c.tipo === "PJ") return `${c.nome.trim()} (CNPJ ${formatarDocumento(c.documento)})\np/ ${c.responsavel_nome?.trim()}`;
  return `${c.nome.trim()} (CPF ${formatarDocumento(c.documento)})`;
}

function textoItens(d: DadosContrato): string {
  const linhas = d.itens.map(
    (i) => `- ${formatarQuantidade(i.quantidade)} ${rotuloUnidade(i.unidade, i.quantidade)}${i.equivalencia ? ` (${i.equivalencia})` : ""} de ${i.descricao.trim()}: ${formatarCentavos(i.total_centavos)}${i.desconto_centavos ? ` (com desconto de ${formatarCentavos(i.desconto_centavos)})` : ""}`,
  );
  if (d.desconto_centavos > 0) {
    linhas.push(`Subtotal: ${formatarCentavos(d.subtotal_centavos)}`);
    linhas.push(`Desconto: ${formatarCentavos(d.desconto_centavos)}`);
  }
  linhas.push(`Total: ${formatarCentavos(d.total_centavos)}`);
  return linhas.join("\n");
}

function textoParcelas(d: DadosContrato): string {
  if (d.parcelas.length === 1) {
    return `Parcela única de ${formatarCentavos(d.parcelas[0].valor_centavos)}, na assinatura deste contrato.`;
  }
  return d.parcelas
    .map((p, n) => {
      const nome = n === 0 ? "entrada" : n === d.parcelas.length - 1 ? "saldo" : `${p.numero}ª parcela`;
      const quando = n === 0 ? "na assinatura deste contrato" : `até ${formatarData(p.vencimento)}`;
      return `${String.fromCharCode(97 + n)}) ${p.numero}ª parcela (${nome}): ${formatarCentavos(p.valor_centavos)}, ${quando};`;
    })
    .join("\n")
    .replace(/;$/, ".");
}

/** Valores de cada {{marcador}} do modelo. */
export function valoresDoContrato(d: DadosContrato): Record<string, string> {
  const local = d.orcamento.local_externo?.trim()
    ? d.orcamento.local_externo.trim()
    : `${d.espacos.join(" e ")} da ${d.empresa.nome_fantasia}, ${d.empresa.endereco}`;
  const fora = d.canal === "fora_estabelecimento";
  return {
    "contrato.numero": d.numero,
    "empresa.razao_social": d.empresa.razao_social,
    "empresa.nome_fantasia": d.empresa.nome_fantasia,
    "empresa.cnpj": d.empresa.cnpj,
    "empresa.endereco": d.empresa.endereco,
    signatario: d.signatario,
    "cliente.qualificacao": qualificacaoDoCliente(d.cliente),
    "cliente.assinatura": assinaturaDoCliente(d.cliente),
    "orcamento.numero": d.orcamento.numero,
    "orcamento.versao": String(d.orcamento.versao),
    "evento.titulo": d.orcamento.titulo.trim(),
    "evento.periodo": descreverPeriodo(d.evento.inicio, d.evento.fim),
    "evento.data": formatarData(diaNaDelta(d.evento.inicio)),
    "evento.local": local,
    "evento.convidados": d.orcamento.convidados ? String(d.orcamento.convidados) : "a confirmar, nos prazos do Anexo I",
    itens: textoItens(d),
    "valor.total": formatarCentavos(d.total_centavos),
    "valor.extenso": reaisPorExtenso(d.total_centavos),
    "pagamento.parcelas": textoParcelas(d),
    "contrato.canal": fora ? "fora do estabelecimento da CONTRATADA" : "no estabelecimento da CONTRATADA",
    "contrato.arrependimento": fora
      ? "Por isso, o CONTRATANTE pode desistir em até 7 (sete) dias contados da assinatura, com devolução integral dos valores pagos, nos termos do art. 49 do Código de Defesa do Consumidor."
      : "",
    cidade: `${d.empresa.cidade}${d.empresa.uf ? `-${d.empresa.uf}` : "-MA"}`,
    "data.extenso": dataPorExtenso(d.hoje),
  };
}

const MARCADOR = /\{\{\s*([a-z_.]+)\s*\}\}/g;

/** Marcadores que o modelo usa e que o sistema não sabe preencher (para o editor avisar antes de salvar). */
export function marcadoresDesconhecidos(modelo: string, conhecidos: string[]): string[] {
  const set = new Set(conhecidos);
  return [...new Set([...modelo.matchAll(MARCADOR)].map((m) => m[1]))].filter((m) => !set.has(m));
}

export const MARCADORES_CONHECIDOS = [
  "contrato.numero", "empresa.razao_social", "empresa.nome_fantasia", "empresa.cnpj", "empresa.endereco", "signatario",
  "cliente.qualificacao", "cliente.assinatura", "orcamento.numero", "orcamento.versao", "evento.titulo", "evento.periodo",
  "evento.data", "evento.local", "evento.convidados", "itens", "valor.total", "valor.extenso", "pagamento.parcelas",
  "contrato.canal", "contrato.arrependimento", "cidade", "data.extenso",
];

/** Preenche o modelo e junta o anexo. Lança erro se sobrar marcador sem valor. */
export function montarTextoContrato(corpo: string, anexo: string | null, valores: Record<string, string>): string {
  const faltando = marcadoresDesconhecidos(corpo, Object.keys(valores));
  if (faltando.length) throw new Error(`Modelo com marcadores desconhecidos: ${faltando.join(", ")}`);
  const preenchido = corpo.replace(MARCADOR, (_, k: string) => valores[k]).replace(/[ \t]+\n/g, "\n").trimEnd();
  const anexoLimpo = anexo?.trim();
  return anexoLimpo ? `${preenchido}\n\n\nANEXO I\n\n${anexoLimpo}\n` : `${preenchido}\n`;
}
