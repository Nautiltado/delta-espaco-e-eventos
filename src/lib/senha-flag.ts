/**
 * "Precisa trocar a senha": a marca oficial fica em app_metadata, que só o servidor (chave secreta) altera.
 * A antiga, em user_metadata, ainda é lida para quem foi marcado antes; como a própria pessoa consegue
 * mudar user_metadata, ela sozinha nunca libera: basta uma das duas estar ligada.
 */
type ComMetadados = { app_metadata?: Record<string, unknown> | null; user_metadata?: Record<string, unknown> | null } | null | undefined;

export function precisaTrocarSenha(u: ComMetadados): boolean {
  return u?.app_metadata?.trocar_senha === true || u?.user_metadata?.trocar_senha === true;
}
