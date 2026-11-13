-- Cria as contas de teste (teste.e2e.{adm,atd,fin,coz}@delta.test). Troque SENHA_DE_TESTE antes de rodar
-- e apague tudo no fim com limpar-dados-de-teste.sql. Nunca use senha real aqui.
do $$
declare c record; uid uuid; senha text := 'SENHA_DE_TESTE';
begin
  for c in select * from (values ('adm', 'Teste ADM', 'ADM'), ('atd', 'Teste ATD', 'ATD'), ('fin', 'Teste FIN', 'FIN'), ('coz', 'Teste COZ', 'COZ')) v(k, nome, perfil) loop
    if exists (select 1 from usuarios where email = 'teste.e2e.' || c.k || '@delta.test') then continue; end if;
    insert into usuarios (nome, email) values (c.nome, 'teste.e2e.' || c.k || '@delta.test') returning id into uid;
    insert into usuarios_perfis values (uid, c.perfil);
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                            created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', 'teste.e2e.' || c.k || '@delta.test',
            extensions.crypt(senha, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (uid::text, uid, jsonb_build_object('sub', uid::text, 'email', 'teste.e2e.' || c.k || '@delta.test', 'email_verified', true), 'email', now(), now(), now());
  end loop;
end $$;
select email, (select array_agg(perfil) from usuarios_perfis where usuario = u.id) perfis, auth_user_id is not null tem_login from usuarios u where email like 'teste.e2e.%';
