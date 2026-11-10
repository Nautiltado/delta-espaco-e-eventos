// Dinheiro sempre em centavos inteiros. Nunca ponto flutuante nas contas.

const formatador = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatarCentavos(centavos: number): string {
  if (!Number.isSafeInteger(centavos)) throw new Error("Valor em centavos inválido");
  return formatador.format(centavos / 100).replace(/ /g, " ");
}

/** Para preencher campos de formulário: 150000 → "1.500,00". */
export function centavosParaCampo(centavos: number): string {
  return formatarCentavos(centavos).replace(/^-?R\$\s?/, "");
}

/**
 * Converte o que a pessoa digitou ("1.500", "1.500,50", "R$ 600", "600,5") em centavos.
 * Retorna null se não for um valor válido e não negativo.
 */
export function lerReais(texto: string): number | null {
  const limpo = texto.replace(/R\$/gi, "").replace(/\s/g, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(limpo)) return null;
  const [inteiro, decimal = ""] = limpo.replace(/\./g, "").split(",");
  const centavos = Number(inteiro) * 100 + Number(decimal.padEnd(2, "0"));
  return Number.isSafeInteger(centavos) ? centavos : null;
}
