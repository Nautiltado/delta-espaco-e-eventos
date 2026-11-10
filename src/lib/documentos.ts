// CPF, CNPJ e telefone. O banco valida de novo (valida_cpf / valida_cnpj); aqui é para a mensagem amigável.

export function somenteDigitos(texto: string | null | undefined): string {
  return (texto ?? "").replace(/\D/g, "");
}

export function validaCpf(valor: string): boolean {
  const c = somenteDigitos(valor);
  if (!/^\d{11}$/.test(c) || /^(\d)\1{10}$/.test(c)) return false;
  const d = c.split("").map(Number);
  for (const n of [9, 10]) {
    let s = 0;
    for (let i = 0; i < n; i++) s += d[i] * (n + 1 - i);
    if (((s * 10) % 11) % 10 !== d[n]) return false;
  }
  return true;
}

export function validaCnpj(valor: string): boolean {
  const c = somenteDigitos(valor);
  if (!/^\d{14}$/.test(c) || /^(\d)\1{13}$/.test(c)) return false;
  const d = c.split("").map(Number);
  const digito = (pesos: number[]) => {
    const r = pesos.reduce((s, p, i) => s + d[i] * p, 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return (
    digito([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === d[12] &&
    digito([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === d[13]
  );
}

export function formatarDocumento(doc: string | null | undefined): string {
  const c = somenteDigitos(doc);
  if (c.length === 11) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return c;
}

/**
 * Telefone guardado como DDD + número (10 ou 11 dígitos), sem +55.
 * Aceita "(99) 98152-2414", "+55 99 98152-2414", "099981522414". Retorna null se não der para entender.
 */
export function normalizarTelefone(texto: string | null | undefined): string | null {
  let t = somenteDigitos(texto);
  if (!t) return null;
  if (t.length >= 12 && t.startsWith("55")) t = t.slice(2);
  if (t.length === 11 && t.startsWith("0")) t = t.slice(1);
  if (t.length === 12 && t.startsWith("0")) t = t.slice(1);
  return /^\d{10,11}$/.test(t) ? t : null;
}

export function formatarTelefone(tel: string | null | undefined): string {
  const t = somenteDigitos(tel);
  if (t.length === 11) return t.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (t.length === 10) return t.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return t;
}

export function linkWhatsApp(tel: string | null | undefined): string | null {
  const t = normalizarTelefone(tel);
  return t ? `https://wa.me/55${t}` : null;
}
