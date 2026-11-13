import "server-only";
import { cookies } from "next/headers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { COOKIE_VISITANTE, EMAIL_VISITANTE, segredoDoVisitante, visitanteValido } from "@/lib/visitante-cookie";
import { mascararResposta } from "@/lib/visitante-mascara";

/** Consultas que só leem (podem ser chamadas pelo visitante). Qualquer outra função do banco é recusada aqui. */
const RPC_DE_LEITURA = new Set([
  "meu_acesso", "agenda_detalhes", "buscar_clientes", "buscar_duplicados", "usuarios_atendimento", "verificar_disponibilidade",
  "motivos_aprovacao", "pendencias_orcamento", "lista_eventos", "ficha_evento", "calcular_cancelamento",
]);

export async function ehVisitante(): Promise<boolean> {
  const valor = (await cookies()).get(COOKIE_VISITANTE)?.value;
  return visitanteValido(valor, segredoDoVisitante(), Date.now());
}

// Token do usuário "Visitante", só na memória do servidor (o navegador recebe apenas o cookie assinado).
let guardado: { token: string; expira: number } | null = null;

async function tokenDoVisitante(): Promise<string> {
  if (guardado && guardado.expira - 60 > Date.now() / 1000) return guardado.token;
  if (modoTesteLocal()) return tokenDeTeste();
  const admin = criarClienteAdmin();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL_VISITANTE });
  if (error || !data.properties?.hashed_token) throw new Error("Acesso de visitante indisponível.");
  const anonimo = createClient(env.supabaseUrl, env.supabasePublishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: s, error: e2 } = await anonimo.auth.verifyOtp({ type: "magiclink", token_hash: data.properties.hashed_token });
  if (e2 || !s.session) throw new Error("Acesso de visitante indisponível.");
  guardado = { token: s.session.access_token, expira: s.session.expires_at ?? Math.floor(Date.now() / 1000) + 3000 };
  return guardado.token;
}

/** Testes locais: sem a chave secreta, entra com uma conta de teste de perfil Visitante (usuário e senha no ambiente local). */
function modoTesteLocal(): boolean {
  return !process.env.SUPABASE_SECRET_KEY && process.env.DELTA_TESTE_LOCAL === "1" && !!process.env.VISITANTE_TESTE_EMAIL;
}

async function tokenDeTeste(): Promise<string> {
  const anonimo = createClient(env.supabaseUrl, env.supabasePublishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await anonimo.auth.signInWithPassword({ email: process.env.VISITANTE_TESTE_EMAIL!, password: process.env.VISITANTE_TESTE_SENHA ?? "" });
  if (error || !data.session) throw new Error("Conta de teste do visitante indisponível.");
  guardado = { token: data.session.access_token, expira: data.session.expires_at ?? Math.floor(Date.now() / 1000) + 3000 };
  return guardado.token;
}

function recusar(): Response {
  return new Response(JSON.stringify({ code: "42501", message: "VISITANTE: aqui dá só para ver, nada é alterado", details: null, hint: null }), {
    status: 403, headers: { "content-type": "application/json" },
  });
}

/** Só leitura e com máscara: escritas, arquivos e funções que alteram dados não passam. */
const fetchDoVisitante: typeof fetch = async (entrada, init) => {
  const url = new URL(typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  const metodo = (init?.method ?? (entrada instanceof Request ? entrada.method : "GET")).toUpperCase();
  const caminho = url.pathname;
  if (caminho.startsWith("/storage/")) return recusar();
  if (caminho.startsWith("/rest/v1/") && metodo !== "GET" && metodo !== "HEAD") {
    const rpc = caminho.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/)?.[1];
    if (!rpc || !RPC_DE_LEITURA.has(rpc)) return recusar();
  }
  const resposta = await fetch(entrada, init);
  if (!caminho.startsWith("/rest/v1/") || !(resposta.headers.get("content-type") ?? "").includes("json")) return resposta;
  const corpo = await resposta.text();
  if (!corpo) return new Response(corpo, { status: resposta.status, statusText: resposta.statusText, headers: resposta.headers });
  const cabecalhos = new Headers(resposta.headers);
  cabecalhos.delete("content-length");
  cabecalhos.delete("content-encoding");
  const recurso = caminho.replace(/^\/rest\/v1\//, "");
  return new Response(JSON.stringify(mascararResposta(JSON.parse(corpo), recurso)), {
    status: resposta.status, statusText: resposta.statusText, headers: cabecalhos,
  });
};

export function clienteDoVisitante(): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabasePublishableKey, {
    accessToken: tokenDoVisitante,
    global: { fetch: fetchDoVisitante },
  });
}

/** O visitante está ligado? (usuário "Visitante" ativo). Consultado com a chave do servidor. */
export async function visitanteLigado(): Promise<boolean> {
  if (modoTesteLocal()) return true;
  if (!process.env.SUPABASE_SECRET_KEY) return false;
  const { data } = await criarClienteAdmin().from("usuarios").select("ativo").eq("email", EMAIL_VISITANTE).maybeSingle();
  return data?.ativo === true;
}
