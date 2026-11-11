// Cenário 4: dezenas de pedidos SIMULTÂNEOS para o mesmo espaço e horário. Só um pode ser aceito.
// Cada pedido usa sua própria conexão HTTP ao Supabase, com o login de um atendente.
// Uso: NODE_USE_ENV_PROXY=1 SENHA_TESTE=... node testes-de-tela/concorrencia.mjs
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://hlbkwlrooeffcjmfovlg.supabase.co";
const CHAVE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_gafQxdxn9OeNI7Z8GOp1vg_bA0OApss";
const EMAIL = process.env.EMAIL_TESTE ?? "teste.e2e.conc@delta.test";

const login = createClient(URL, CHAVE, { auth: { persistSession: false } });
const { data: sessao, error } = await login.auth.signInWithPassword({ email: EMAIL, password: process.env.SENHA_TESTE });
if (error) throw error;
const token = sessao.session.access_token;
const cliente = () => createClient(URL, CHAVE, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${token}` } },
});

const { data: orcs } = await cliente().from("orcamentos").select("id").like("titulo", "Concorrência %").order("titulo");
const { data: espaco } = await cliente().from("recursos").select("id").eq("nome", "Espaço maior").single();
console.log(`${orcs.length} orçamentos diferentes pedindo o Espaço maior em 15/03/2028, 19h às 23h, ao mesmo tempo…`);

const inicio = performance.now();
const resultados = await Promise.all(orcs.map((o) =>
  cliente().rpc("reservar_data", {
    p_orcamento: o.id,
    p_inicio: "2028-03-15T19:00:00-03:00",
    p_fim: "2028-03-15T23:00:00-03:00",
    p_recursos: [espaco.id],
  }),
));
const ms = Math.round(performance.now() - inicio);
const aceitos = resultados.filter((r) => !r.error);
const recusados = resultados.filter((r) => r.error?.message?.startsWith("DATA_INDISPONIVEL"));
const outros = resultados.filter((r) => r.error && !r.error.message.startsWith("DATA_INDISPONIVEL"));
console.log(`aceitos: ${aceitos.length} · recusados por data ocupada: ${recusados.length} · outros erros: ${outros.length} · ${ms} ms`);
if (outros.length) console.log(outros.map((r) => r.error.message));
if (recusados[0]) console.log("mensagem ao atendente:", recusados[0].error.message);
const ok = aceitos.length === 1 && recusados.length === orcs.length - 1;
console.log(ok ? "RESULTADO: passou (exatamente um aceito)" : "RESULTADO: FALHOU");
process.exit(ok ? 0 : 1);
