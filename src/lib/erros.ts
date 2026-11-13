// Traduz os erros levantados pelo banco em mensagens para a tela.
// Os códigos de regra (ex.: "APROVACAO_NECESSARIA: motivo") trazem o detalhe depois dos dois-pontos.

const MENSAGENS: Record<string, string> = {
  SEM_ADMINISTRADOR: "É preciso manter ao menos um administrador ativo.",
  EMAIL_JA_CADASTRADO: "Já existe um usuário com este e-mail.",
  PERFIL_OBRIGATORIO: "Escolha ao menos um perfil.",
  REGISTRO_IMUTAVEL: "Este registro não pode ser alterado ou excluído.",
  ACESSO_NAO_AUTORIZADO: "Este e-mail não está cadastrado no Delta Gestão.",
  ORCAMENTO_IMUTAVEL: "Este orçamento já foi enviado e não pode mais ser alterado. Crie uma nova versão.",
  ORCAMENTO_VAZIO: "Inclua ao menos um item com valor antes de enviar.",
  CONTRATO_IMUTAVEL: "Contrato gerado não muda. Gere uma nova versão se algo mudou.",
  CONTRATO_ASSINADO_IMUTAVEL: "Já existe contrato assinado: ele não muda. Para alterar, cancele ou faça um aditivo.",
  RESERVA_INEXISTENTE: "Reserva não encontrada.",
};

/** Códigos cujo texto depois dos dois-pontos já é a explicação certa para a pessoa. */
const COM_DETALHE = new Set([
  "CONFIG_INVALIDA",
  "APROVACAO_NECESSARIA",
  "STATUS_INVALIDO",
  "ORCAMENTO_VENCIDO",
  "JUSTIFICATIVA_OBRIGATORIA",
  "MESCLAGEM_INVALIDA",
  "SEM_PERMISSAO",
  "DATA_INDISPONIVEL",
  "HORARIO_INVALIDO",
  "CONTRATO_DADOS_CLIENTE",
  "CONTRATO_NAO_ASSINADO",
  "ENTRADA_NAO_CONFIRMADA",
  "PAGAMENTO_DUPLICADO",
  "VALOR_INVALIDO",
  "PARCELAS_COM_PAGAMENTO",
  "PRECO_PENDENTE",
  "VISITANTE",
  "PERFIL_PROTEGIDO",
  "PERFIL_OBRIGATORIO",
]);

const PREFIXO: Record<string, string> = {
  APROVACAO_NECESSARIA: "Precisa de aprovação de um administrador: ",
  STATUS_INVALIDO: "Não é possível nesta situação: ",
  DATA_INDISPONIVEL: "Data indisponível: ",
  PRECO_PENDENTE: "Defina os preços antes de enviar: ",
  VISITANTE: "Modo visitante: ",
};

const RESTRICOES: Record<string, string> = {
  uq_clientes_documento: "Já existe um cliente com este CPF/CNPJ. Procure pelo cadastro existente.",
  clientes_documento_valido: "CPF ou CNPJ inválido. Confira os números.",
  clientes_telefone_check: "Telefone inválido. Use DDD e número.",
  clientes_email_check: "E-mail inválido.",
  catalogo_itens_nome_key: "Já existe um item com este nome no catálogo.",
  item_desconto_ate_bruto: "O desconto não pode passar do valor do item.",
  item_pendente_sem_desconto: "Defina o preço antes de dar desconto no item.",
  item_unidade_fk: "Unidade de cobrança inexistente.",
  catalogo_itens_unidade_fk: "Unidade de cobrança inexistente.",
};

type ErroBanco = { message?: string; code?: string; details?: string } | null | undefined;

export function mensagemDoBanco(erro: ErroBanco): string {
  const texto = erro?.message ?? "";
  const separador = texto.indexOf(":");
  const codigo = (separador > 0 ? texto.slice(0, separador) : texto).trim();
  const detalhe = separador > 0 ? texto.slice(separador + 1).trim() : "";

  if (COM_DETALHE.has(codigo) && detalhe) {
    const d = detalhe.charAt(0).toUpperCase() + detalhe.slice(1);
    return (PREFIXO[codigo] ?? "") + (PREFIXO[codigo] ? detalhe : d) + (/[.!?]$/.test(d) ? "" : ".");
  }
  if (MENSAGENS[codigo]) return MENSAGENS[codigo];
  for (const [restricao, msg] of Object.entries(RESTRICOES)) {
    if (texto.includes(restricao) || erro?.details?.includes(restricao)) return msg;
  }
  if (erro?.code === "42501") return "Seu perfil não permite esta ação.";
  if (erro?.code === "23514") return "Algum dado está fora do formato aceito. Confira os campos.";
  return "Não foi possível concluir. Tente de novo.";
}
