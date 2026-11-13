-- Acesso de visitante (temporário): perfil que enxerga as telas para avaliação do sistema.
-- O visitante nunca recebe um token do banco: o servidor consulta por ele, só leitura, e esconde nomes, contatos e valores.
-- Para desligar: desative o usuário "Visitante" em Usuários (ou apague o perfil VIS).
insert into perfis (codigo, nome, descricao) values ('VIS', 'Visitante (só ver)', 'Avaliação do sistema: só leitura, dados pessoais e valores ocultos.');
insert into perfis_permissoes (perfil, permissao)
select 'VIS', p from unnest(array['cliente.ver', 'orcamento.ver', 'salgados.criar', 'producao.status', 'estoque.movimentar',
                                 'pagamento.confirmar', 'escala.gerir', 'evento.fechar', 'contrato.gerar', 'whatsapp.atender']) p;

insert into usuarios (nome, email) values ('Visitante', 'visitante@delta-gestao.app');
insert into usuarios_perfis (usuario, perfil) select id, 'VIS' from usuarios where email = 'visitante@delta-gestao.app';
with n as (
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'visitante@delta-gestao.app',
          -- senha aleatória que ninguém conhece: a entrada é só pelo botão, feita pelo servidor
          extensions.crypt(encode(extensions.gen_random_bytes(32), 'hex'), extensions.gen_salt('bf')),
          now(), '{"provider":"email","providers":["email"]}', '{"visitante":true}', now(), now(), '', '', '', '')
  returning id, email)
insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), 'email', now(), now(), now() from n;
