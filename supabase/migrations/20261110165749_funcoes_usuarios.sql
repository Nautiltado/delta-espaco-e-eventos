-- Cadastro de usuário e troca de perfis em uma única transação.
-- SECURITY INVOKER: valem as políticas de quem chama (só quem tem config.critica consegue).

create function criar_usuario(p_nome text, p_email text, p_perfis text[]) returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  if coalesce(array_length(p_perfis, 1), 0) = 0 then
    raise exception 'PERFIL_OBRIGATORIO: escolha ao menos um perfil';
  end if;
  insert into usuarios (nome, email) values (trim(p_nome), lower(trim(p_email))) returning id into v_id;
  insert into usuarios_perfis (usuario, perfil) select v_id, unnest(p_perfis);
  return v_id;
exception when unique_violation then
  raise exception 'EMAIL_JA_CADASTRADO: já existe um usuário com este e-mail';
end $$;

create function definir_perfis(p_usuario uuid, p_perfis text[]) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if coalesce(array_length(p_perfis, 1), 0) = 0 then
    raise exception 'PERFIL_OBRIGATORIO: escolha ao menos um perfil';
  end if;
  delete from usuarios_perfis where usuario = p_usuario and perfil <> all (p_perfis);
  insert into usuarios_perfis (usuario, perfil)
    select p_usuario, unnest(p_perfis)
    on conflict do nothing;
end $$;

revoke execute on function criar_usuario(text, text, text[]), definir_perfis(uuid, text[]) from public, anon, authenticated;
grant execute on function criar_usuario(text, text, text[]), definir_perfis(uuid, text[]) to delta_app;
