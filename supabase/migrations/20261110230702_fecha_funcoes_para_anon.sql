-- Nenhuma função do schema public é executável por visitantes sem login nem diretamente por "authenticated":
-- quem entra pelo Supabase Auth recebe só o que foi concedido ao papel delta_app.
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

grant execute on function usuario_atual(), tem_permissao(text, uuid), meu_acesso(), pode_ver_reservas(),
  criar_usuario(text, text, text[]), definir_perfis(uuid, text[]),
  buscar_duplicados(text, text, text, uuid), criar_orcamento(uuid, text, text, date, text, integer, uuid, text),
  aprovar_condicoes(uuid, text), enviar_versao(uuid, date), nova_versao(uuid), registrar_aceite(uuid),
  marcar_perdido(uuid, text), mesclar_clientes(uuid, uuid), motivos_aprovacao(uuid),
  valida_cpf(text), valida_cnpj(text), normaliza_texto(text), cfg_int(text) to delta_app;
