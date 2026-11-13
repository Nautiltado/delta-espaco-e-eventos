// Valor por extenso em reais, para o contrato. Ex.: 150050 → "mil e quinhentos reais e cinquenta centavos".

const UNIDADES = [
  "zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
  "dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove",
];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

/** 0 a 999 */
function ate999(n: number): string {
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c) partes.push(CENTENAS[c]);
  if (resto) {
    if (resto < 20) partes.push(UNIDADES[resto]);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
    }
  }
  return partes.join(" e ");
}

const ESCALAS: [string, string][] = [
  ["", ""],
  ["mil", "mil"],
  ["milhão", "milhões"],
  ["bilhão", "bilhões"],
];

/** Número inteiro por extenso (0 a 999 bilhões). */
export function inteiroPorExtenso(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12) throw new Error("Número fora do intervalo");
  if (n === 0) return "zero";
  const grupos: number[] = [];
  for (let x = n; x > 0; x = Math.floor(x / 1000)) grupos.push(x % 1000);

  const partes: { texto: string; valor: number }[] = [];
  for (let i = grupos.length - 1; i >= 0; i--) {
    const g = grupos[i];
    if (!g) continue;
    let texto: string;
    if (i === 0) texto = ate999(g);
    else if (i === 1) texto = g === 1 ? "mil" : `${ate999(g)} mil`;
    else texto = `${ate999(g)} ${g === 1 ? ESCALAS[i][0] : ESCALAS[i][1]}`;
    partes.push({ texto, valor: g });
  }
  // "e" antes do último grupo quando ele é menor que 100 ou centena redonda: "mil e quinhentos", "mil e dez".
  return partes
    .map((p, idx) => {
      if (idx === 0) return p.texto;
      const ultimo = idx === partes.length - 1;
      const conecta = ultimo && (p.valor < 100 || p.valor % 100 === 0);
      return (conecta ? " e " : " ") + p.texto;
    })
    .join("");
}

/** Centavos → "mil e quinhentos reais e cinquenta centavos". */
export function reaisPorExtenso(centavos: number): string {
  if (!Number.isSafeInteger(centavos) || centavos < 0) throw new Error("Valor inválido");
  const reais = Math.floor(centavos / 100);
  const cent = centavos % 100;
  const partes: string[] = [];
  if (reais > 0) {
    const t = inteiroPorExtenso(reais);
    // "um milhão de reais", "dois milhões de reais"
    const deReais = reais >= 1_000_000 && reais % 1_000_000 === 0;
    partes.push(`${t}${deReais ? " de" : ""} ${reais === 1 ? "real" : "reais"}`);
  }
  if (cent > 0) partes.push(`${inteiroPorExtenso(cent)} ${cent === 1 ? "centavo" : "centavos"}`);
  return partes.length ? partes.join(" e ") : "zero real";
}
