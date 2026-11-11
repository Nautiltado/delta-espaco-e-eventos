"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Cliente do navegador, usado só para enviar arquivo a um endereço de envio assinado pelo servidor. */
export function criarClienteNavegador() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}
