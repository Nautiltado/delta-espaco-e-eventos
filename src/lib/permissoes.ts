export type Permissao =
  | "cliente.ver"
  | "cliente.editar"
  | "cliente.mesclar"
  | "orcamento.ver"
  | "orcamento.criar"
  | "desconto.dar"
  | "desconto.aprovar"
  | "custo.ver"
  | "catalogo.alterar"
  | "contrato.editar"
  | "contrato.gerar"
  | "pagamento.confirmar"
  | "pagamento.estornar"
  | "reserva.confirmar"
  | "bloqueio.criar"
  | "bloqueio.remover"
  | "reserva.cancelar"
  | "evento.fechar"
  | "salgados.criar"
  | "producao.status"
  | "retirada.registrar"
  | "capacidade.autorizar"
  | "estoque.movimentar"
  | "escala.gerir"
  | "whatsapp.atender"
  | "auditoria.ver"
  | "config.critica";

export type Acesso = {
  id: string;
  nome: string;
  email: string;
  perfis: string[];
  permissoes: string[];
};

export const NOMES_PERFIS: Record<string, string> = {
  ADM: "Administrador",
  GER: "Gerência",
  ATD: "Atendimento",
  FIN: "Financeiro",
  COZ: "Cozinha",
  OPE: "Operacional",
};

export function pode(acesso: Acesso | null, permissao: Permissao): boolean {
  return !!acesso && acesso.permissoes.includes(permissao);
}

export type ItemMenu = {
  href: string;
  rotulo: string;
  /** Sem permissão: qualquer usuário logado vê. */
  permissao?: Permissao;
  /** Ainda não construído: aparece desabilitado com a fase prevista. */
  fase?: number;
};

export const MENU: ItemMenu[] = [
  { href: "/", rotulo: "Início" },
  { href: "/tarefas", rotulo: "Tarefas" },
  { href: "/orcamentos", rotulo: "Orçamentos", permissao: "orcamento.ver" },
  { href: "/clientes", rotulo: "Clientes", permissao: "cliente.ver" },
  { href: "/catalogo", rotulo: "Catálogo", permissao: "orcamento.ver" },
  { href: "/agenda", rotulo: "Agenda", permissao: "orcamento.ver", fase: 4 },
  { href: "/financeiro", rotulo: "Financeiro", permissao: "pagamento.confirmar", fase: 4 },
  { href: "/salgados", rotulo: "Salgados", permissao: "producao.status", fase: 5 },
  { href: "/usuarios", rotulo: "Usuários", permissao: "config.critica" },
  { href: "/configuracoes", rotulo: "Configurações" },
  { href: "/auditoria", rotulo: "Auditoria", permissao: "auditoria.ver" },
];

export function menuDoUsuario(acesso: Acesso | null): ItemMenu[] {
  if (!acesso) return [];
  return MENU.filter((item) => !item.permissao || pode(acesso, item.permissao));
}
