import { z } from "zod";
import { centavosParaCampo, formatarCentavos, lerReais } from "@/lib/dinheiro";

export type TipoConfig =
  | "inteiro"
  | "percentual"
  | "horas"
  | "dias"
  | "centavos"
  | "faixa_centavos"
  | "texto";

export type Configuracao = {
  chave: string;
  grupo: string;
  descricao: string;
  tipo: TipoConfig;
  valor: unknown;
  ordem: number;
  restrita: boolean;
  atualizado_em: string;
  atualizado_por: string | null;
};

export type Faixa = { min: number; max: number };

const inteiroNaoNegativo = z.coerce
  .number({ message: "Informe um número" })
  .int("Use um número inteiro")
  .min(0, "Não pode ser negativo");

/**
 * Lê o formulário de uma configuração e devolve o valor no formato gravado no banco.
 * O banco repete esta validação (trg_configuracao_valida): esta aqui só dá a mensagem amigável.
 */
export function lerValorDoFormulario(
  tipo: TipoConfig,
  form: { valor?: string; min?: string; max?: string },
): { ok: true; valor: unknown } | { ok: false; erro: string } {
  switch (tipo) {
    case "inteiro":
    case "horas":
    case "dias": {
      const r = inteiroNaoNegativo.safeParse((form.valor ?? "").trim());
      return r.success ? { ok: true, valor: r.data } : { ok: false, erro: r.error.issues[0].message };
    }
    case "percentual": {
      const r = inteiroNaoNegativo.max(100, "Máximo de 100%").safeParse((form.valor ?? "").trim());
      return r.success ? { ok: true, valor: r.data } : { ok: false, erro: r.error.issues[0].message };
    }
    case "centavos": {
      const c = lerReais(form.valor ?? "");
      return c === null ? { ok: false, erro: "Valor em reais inválido" } : { ok: true, valor: c };
    }
    case "faixa_centavos": {
      const min = lerReais(form.min ?? "");
      const max = lerReais(form.max ?? "");
      if (min === null || max === null) return { ok: false, erro: "Informe mínimo e máximo em reais" };
      if (min > max) return { ok: false, erro: "O mínimo não pode ser maior que o máximo" };
      return { ok: true, valor: { min, max } };
    }
    case "texto": {
      const t = (form.valor ?? "").trim();
      return t ? { ok: true, valor: t } : { ok: false, erro: "Não pode ficar vazio" };
    }
  }
}

export function exibirValor(tipo: TipoConfig, valor: unknown): string {
  switch (tipo) {
    case "centavos":
      return formatarCentavos(valor as number);
    case "faixa_centavos": {
      const f = valor as Faixa;
      return `${formatarCentavos(f.min)} a ${formatarCentavos(f.max)}`;
    }
    case "percentual":
      return `${valor}%`;
    case "horas":
      return `${valor} h`;
    case "dias":
      return `${valor} dias`;
    default:
      return String(valor);
  }
}

export function valorParaCampo(tipo: TipoConfig, valor: unknown): string {
  return tipo === "centavos" ? centavosParaCampo(valor as number) : String(valor ?? "");
}

export function faixaParaCampos(valor: unknown): { min: string; max: string } {
  const f = valor as Faixa;
  return { min: centavosParaCampo(f.min), max: centavosParaCampo(f.max) };
}
