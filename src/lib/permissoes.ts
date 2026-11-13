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
  | "config.critica"
  | "salgados.ver"
  | "estoque.ver"
  | "evento.ver"
  | "financeiro.ver"
  | "contrato.ver";

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
  VIS: "Visitante (só ver)",
};

export function pode(acesso: Acesso | null, permissao: Permissao): boolean {
  return !!acesso && acesso.permissoes.includes(permissao);
}

export type GrupoMenu = "geral" | "comercial" | "operacao" | "administracao";

export const GRUPOS_MENU: Record<GrupoMenu, string> = {
  geral: "Geral",
  comercial: "Comercial",
  operacao: "Operação",
  administracao: "Administração",
};

export type ItemMenu = {
  href: string;
  rotulo: string;
  grupo: GrupoMenu;
  /** Sem permissão: qualquer usuário logado vê. Lista: basta ter uma. */
  permissao?: Permissao | Permissao[];
  /** Ainda não construído: aparece desabilitado com a fase prevista. */
  fase?: number;
};

// Só entram telas que existem: Atendimento (WhatsApp), Equipe e fornecedores e Relatórios
// aparecem aqui quando as fases delas forem construídas.
export const MENU: ItemMenu[] = [
  { href: "/", rotulo: "Visão geral", grupo: "geral" },
  { href: "/tarefas", rotulo: "Tarefas", grupo: "geral" },
  { href: "/clientes", rotulo: "Clientes", grupo: "comercial", permissao: "cliente.ver" },
  { href: "/orcamentos", rotulo: "Orçamentos", grupo: "comercial", permissao: "orcamento.ver" },
  { href: "/catalogo", rotulo: "Catálogo", grupo: "comercial", permissao: "orcamento.ver" },
  { href: "/agenda", rotulo: "Agenda", grupo: "operacao", permissao: "orcamento.ver" },
  { href: "/eventos", rotulo: "Eventos", grupo: "operacao", permissao: ["orcamento.ver", "escala.gerir", "evento.fechar", "producao.status", "custo.ver", "evento.ver"] },
  { href: "/salgados", rotulo: "Encomendas", grupo: "operacao", permissao: ["salgados.criar", "salgados.ver"] },
  { href: "/salgados/cozinha", rotulo: "Cozinha", grupo: "operacao", permissao: ["producao.status", "salgados.ver"] },
  { href: "/salgados/estoque", rotulo: "Estoque", grupo: "operacao", permissao: ["estoque.movimentar", "catalogo.alterar", "estoque.ver"] },
  { href: "/financeiro", rotulo: "Financeiro", grupo: "administracao", permissao: ["pagamento.confirmar", "financeiro.ver"] },
  { href: "/contratos", rotulo: "Contratos", grupo: "administracao", permissao: ["contrato.editar", "contrato.ver"] },
  { href: "/usuarios", rotulo: "Usuários", grupo: "administracao", permissao: "config.critica" },
  { href: "/configuracoes", rotulo: "Configurações", grupo: "administracao" },
  { href: "/auditoria", rotulo: "Auditoria", grupo: "administracao", permissao: "auditoria.ver" },
];

/** Páginas internas que não estão no menu, para a trilha de navegação. */
export const SUBPAGINAS: { prefixo: RegExp; rotulo: string; pai: string }[] = [
  { prefixo: /^\/orcamentos\/novo$/, rotulo: "Novo orçamento", pai: "/orcamentos" },
  { prefixo: /^\/orcamentos\/modelos/, rotulo: "Modelos", pai: "/orcamentos" },
  { prefixo: /^\/orcamentos\/.+/, rotulo: "Orçamento", pai: "/orcamentos" },
  { prefixo: /^\/clientes\/novo$/, rotulo: "Novo cliente", pai: "/clientes" },
  { prefixo: /^\/clientes\/.+\/editar$/, rotulo: "Editar cliente", pai: "/clientes" },
  { prefixo: /^\/clientes\/.+/, rotulo: "Cliente", pai: "/clientes" },
  { prefixo: /^\/catalogo\/novo$/, rotulo: "Novo item", pai: "/catalogo" },
  { prefixo: /^\/catalogo\/unidades$/, rotulo: "Unidades de cobrança", pai: "/catalogo" },
  { prefixo: /^\/catalogo\/.+/, rotulo: "Item", pai: "/catalogo" },
  { prefixo: /^\/reservas\/.+/, rotulo: "Reserva", pai: "/agenda" },
  { prefixo: /^\/eventos\/.+/, rotulo: "Ficha do evento", pai: "/eventos" },
  { prefixo: /^\/salgados\/novo$/, rotulo: "Novo pedido", pai: "/salgados" },
  { prefixo: /^\/salgados\/(?!cozinha|estoque).+/, rotulo: "Pedido", pai: "/salgados" },
];

export function menuDoUsuario(acesso: Acesso | null): ItemMenu[] {
  if (!acesso) return [];
  return MENU.filter((item) => {
    if (!item.permissao) return true;
    const lista = Array.isArray(item.permissao) ? item.permissao : [item.permissao];
    return lista.some((p) => pode(acesso, p));
  });
}
