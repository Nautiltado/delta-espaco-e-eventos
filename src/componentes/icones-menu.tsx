import {
  BookOpenText, CalendarDays, ChefHat, ClipboardList, FileSignature, FileText, LayoutDashboard, PartyPopper,
  Settings, ShieldCheck, ShoppingBag, Users, UserCog, Wallet, Warehouse, type LucideIcon,
} from "lucide-react";

/** Um ícone por tela, do mesmo traço (lucide), usado no menu, na barra do celular e nos atalhos. */
export const ICONES_MENU: Record<string, LucideIcon> = {
  "/": LayoutDashboard,
  "/tarefas": ClipboardList,
  "/clientes": Users,
  "/orcamentos": FileText,
  "/catalogo": BookOpenText,
  "/agenda": CalendarDays,
  "/eventos": PartyPopper,
  "/salgados": ShoppingBag,
  "/salgados/cozinha": ChefHat,
  "/salgados/estoque": Warehouse,
  "/financeiro": Wallet,
  "/contratos": FileSignature,
  "/usuarios": UserCog,
  "/configuracoes": Settings,
  "/auditoria": ShieldCheck,
};
