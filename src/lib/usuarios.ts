// Usuários e acessos: rótulos e o resumo de permissões por módulo (o banco é quem decide; isto só explica).

export const SITUACOES: Record<string, { rotulo: string; selo: string }> = {
  ativo: { rotulo: "Ativo", selo: "" },
  primeiro_acesso: { rotulo: "Aguardando primeiro acesso", selo: "info" },
  convite_pendente: { rotulo: "Convite pendente", selo: "alerta" },
  convite_enviado: { rotulo: "Convite enviado", selo: "info" },
  convite_expirado: { rotulo: "Convite expirado", selo: "erro" },
  sem_acesso: { rotulo: "Sem acesso criado", selo: "cinza" },
  desativado: { rotulo: "Desativado", selo: "cinza" },
};

const MODULOS: [RegExp, string][] = [
  [/^cliente\./, "Clientes"],
  [/^(orcamento|desconto)\./, "Orçamentos"],
  [/^custo\./, "Custos e margens"],
  [/^catalogo\./, "Catálogo"],
  [/^(reserva|bloqueio|capacidade)\./, "Agenda e reservas"],
  [/^(evento|escala)\./, "Eventos"],
  [/^contrato\./, "Contratos"],
  [/^(pagamento|financeiro)\./, "Financeiro"],
  [/^(salgados|producao|retirada)\./, "Encomendas e cozinha"],
  [/^estoque\./, "Estoque"],
  [/^whatsapp\./, "WhatsApp"],
  [/^(auditoria|config)\./, "Administração"],
];

/** Permissões que mexem com dinheiro, custos, contratos ou administração: destacadas no resumo. */
export const SENSIVEIS = new Set(["custo.ver", "config.critica", "auditoria.ver", "pagamento.estornar", "pagamento.confirmar", "desconto.aprovar", "contrato.editar", "cliente.mesclar"]);

export function moduloDa(permissao: string): string {
  return MODULOS.find(([r]) => r.test(permissao))?.[1] ?? "Outros";
}

/** União das permissões dos perfis (é assim que o banco combina vários perfis). */
export function permissoesDosPerfis(perfis: string[], matriz: { codigo: string; permissoes: string[] }[]): string[] {
  return [...new Set(matriz.filter((p) => perfis.includes(p.codigo)).flatMap((p) => p.permissoes))].sort();
}

export function agruparPorModulo(permissoes: string[]): [string, string[]][] {
  const m = new Map<string, string[]>();
  for (const p of permissoes) m.set(moduloDa(p), [...(m.get(moduloDa(p)) ?? []), p]);
  const ordem = MODULOS.map(([, n]) => n);
  return [...m.entries()].sort((a, b) => ordem.indexOf(a[0]) - ordem.indexOf(b[0]));
}

export const ACOES_HISTORICO: Record<string, string> = {
  USUARIO_CRIADO: "Cadastro criado", PERFIS_ALTERADOS: "Perfis alterados", CONVITE_CRIADO: "Convite gerado",
  REDEFINICAO_CRIADA: "Link de redefinição gerado", CONVITE_REVOGADO: "Links cancelados", CONVITE_ACEITO: "Convite aceito (senha criada)",
  SENHA_REDEFINIDA: "Senha redefinida pelo link", SESSOES_REVOGADAS: "Sessões encerradas", TROCA_SENHA_FORCADA: "Troca de senha exigida",
  USUARIO_DESATIVADO: "Desativado", USUARIO_REATIVADO: "Reativado", ACESSO_NEGADO: "Tentou abrir algo sem permissão",
  INSERT: "Perfil incluído", DELETE: "Perfil removido",
};
