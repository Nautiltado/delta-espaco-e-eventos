// Traduz os códigos de erro levantados pelo banco em mensagens para a tela.

const MENSAGENS: Record<string, string> = {
  SEM_ADMINISTRADOR: "É preciso manter ao menos um administrador ativo.",
  EMAIL_JA_CADASTRADO: "Já existe um usuário com este e-mail.",
  PERFIL_OBRIGATORIO: "Escolha ao menos um perfil.",
  CONFIG_INVALIDA: "Valor inválido para esta configuração.",
  REGISTRO_IMUTAVEL: "Este registro não pode ser alterado ou excluído.",
  ACESSO_NAO_AUTORIZADO: "Este e-mail não está cadastrado no Delta Gestão.",
};

export function mensagemDoBanco(erro: { message?: string; code?: string } | null | undefined): string {
  const texto = erro?.message ?? "";
  const codigo = texto.split(":")[0].trim();
  if (codigo === "CONFIG_INVALIDA" && texto.includes(":")) {
    return texto.slice(texto.indexOf(":") + 1).trim();
  }
  if (MENSAGENS[codigo]) return MENSAGENS[codigo];
  if (erro?.code === "42501") return "Seu perfil não permite esta ação.";
  return "Não foi possível concluir. Tente de novo.";
}
