// Cria (ou redefine) a senha provisória de um usuário JÁ cadastrado na tabela usuarios.
// Uso: node --env-file=.env.local scripts/criar-acesso.mjs email@exemplo.com
// Serve para o primeiro acesso dos administradores; depois disso, use a tela Usuários.
import { randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const email = (process.argv[2] ?? "").trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.SUPABASE_SECRET_KEY;
if (!email || !url || !chave) {
  console.error("Uso: node --env-file=.env.local scripts/criar-acesso.mjs email@exemplo.com");
  console.error("Precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY no .env.local");
  process.exit(1);
}

const letras = "abcdefghjkmnpqrstuvwxyz";
const bloco = (n) => Array.from({ length: n }, () => letras[randomInt(letras.length)]).join("");
const senha = `${bloco(4)}-${bloco(4)}-${randomInt(100, 1000)}`;

const admin = createClient(url, chave, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: usuario, error: erroBusca } = await admin
  .from("usuarios")
  .select("id, nome, ativo, auth_user_id")
  .eq("email", email)
  .maybeSingle();
if (erroBusca) throw erroBusca;
if (!usuario) {
  console.error(`Nenhum usuário com o e-mail ${email}. Cadastre-o antes (tabela usuarios).`);
  process.exit(1);
}
if (!usuario.ativo) {
  console.error(`${usuario.nome} está desativado.`);
  process.exit(1);
}

const { error } = usuario.auth_user_id
  ? await admin.auth.admin.updateUserById(usuario.auth_user_id, {
      password: senha,
      user_metadata: { trocar_senha: true },
    })
  : await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { trocar_senha: true },
    });
if (error) throw error;

console.log(`Acesso pronto para ${usuario.nome} <${email}>`);
console.log(`Senha provisória: ${senha}`);
console.log("No primeiro login o sistema pede uma senha nova.");
