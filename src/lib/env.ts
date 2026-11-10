function exigir(nome: string, valor: string | undefined): string {
  if (!valor) {
    throw new Error(`Variável de ambiente ausente: ${nome}. Veja .env.example.`);
  }
  return valor;
}

export const env = {
  get supabaseUrl() {
    return exigir("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabasePublishableKey() {
    return exigir(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
  },
  /** Chave secreta: só no servidor, nunca com prefixo NEXT_PUBLIC. */
  get supabaseSecretKey() {
    return exigir("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY);
  },
};
