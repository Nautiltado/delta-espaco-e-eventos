// Modo visitante: esconde dados pessoais e valores nas respostas do banco antes de chegarem às telas.
// O visitante nunca recebe token do banco; esta máscara roda no servidor, sobre tudo o que ele consulta.

const OCULTO = "••••••";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Campos de texto que sempre somem: documentos, contatos, endereços, textos livres que podem citar o cliente. */
const SENSIVEIS = new Set([
  "documento", "cpf", "cnpj", "telefone", "cliente_telefone", "celular", "whatsapp", "email", "endereco", "logradouro",
  "bairro", "cep", "complemento", "responsavel_nome", "nome_fantasia", "cliente_nome", "titulo", "observacoes", "observacao",
  "apresentacao", "texto", "id_externo", "referencia", "caminho", "arquivo", "nome_arquivo", "local_externo", "fornecedor",
  "signatario_delta", "assinatura_obs", "cancelado_motivo", "aprovacao_justificativa",
]);
/** Campos que, quando são texto (não id), trazem o nome de uma pessoa. */
const NOME_DE_PESSOA = new Set(["cliente", "criado_por", "responsavel", "enviada_por", "aprovado_por", "confirmado_por",
  "registrado_por", "assinado_por", "usuario", "autor", "gerado_por", "concluida_por", "entregue_por"]);
/** Objetos aninhados de pessoa (cliente, usuário): o "nome" dentro deles some. */
const CONTEXTO_PESSOA = /client|usuari|respons|criad|enviad|aprovad|confirmad|assin|signat|autor|equipe|gerad|conclu|entreg/;
/** Recursos cujo "nome" de cada linha é de pessoa. */
const RECURSOS_DE_PESSOA = /^(clientes|usuarios|rpc\/buscar_clientes|rpc\/buscar_duplicados|rpc\/usuarios_atendimento)$/;
/** Números de dinheiro viram zero. */
const DINHEIRO = /_centavos$|^valor(_total)?$|^pago$|^total$/;

function texto(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && !UUID.test(v);
}

function mascarar(valor: unknown, chave: string | null, recurso: string): unknown {
  if (Array.isArray(valor)) return valor.map((v) => mascarar(v, chave, recurso));
  if (valor && typeof valor === "object") {
    const pessoa = chave === null ? RECURSOS_DE_PESSOA.test(recurso) : CONTEXTO_PESSOA.test(chave);
    const saida: Record<string, unknown> = {};
    const config = recurso === "configuracoes" && chave === null;
    for (const [k, v] of Object.entries(valor)) {
      if (config && k === "valor") {
        // configurações: textos (empresa, signatário, chave Pix) e valores em dinheiro somem; prazos e percentuais ficam
        const tipo = String((valor as Record<string, unknown>).tipo ?? "");
        saida[k] = typeof v === "string" ? OCULTO : /centavos/.test(tipo) ? 0 : v;
        continue;
      }
      if (DINHEIRO.test(k) && (typeof v === "number" || (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v)))) saida[k] = 0;
      else if (texto(v) && (SENSIVEIS.has(k) || NOME_DE_PESSOA.has(k) || (k === "nome" && pessoa))) saida[k] = OCULTO;
      else if (k === "descricao" && texto(v) && /^(tarefas)$/.test(recurso)) saida[k] = OCULTO;
      else saida[k] = mascarar(v, k, recurso);
    }
    return saida;
  }
  return valor;
}

/** Aplica a máscara a uma resposta do banco. `recurso` é o caminho depois de /rest/v1/ (ex.: "clientes", "rpc/agenda_detalhes"). */
export function mascararResposta(corpo: unknown, recurso: string): unknown {
  return mascarar(corpo, null, recurso);
}

export const TEXTO_OCULTO = OCULTO;
