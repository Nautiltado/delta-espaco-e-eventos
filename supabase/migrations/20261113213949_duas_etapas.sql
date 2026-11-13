-- Verificação em duas etapas (app autenticador) obrigatória para Administração e Financeiro.
-- O banco confere sozinho: sessão desses perfis sem o código (aal1) não tem permissão nenhuma.

create or replace function exige_duas_etapas(p_usuario uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from usuarios_perfis where usuario = p_usuario and perfil in ('ADM', 'FIN'))
$$;

-- Sessão "forte": entrou com senha + código. Chamadas do próprio servidor (sem login) não passam por aqui.
create or replace function sessao_forte() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is null or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;

create or replace function tem_permissao(p_permissao text, p_usuario uuid default usuario_atual()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from usuarios u
      join usuarios_perfis up on up.usuario = u.id
      join perfis_permissoes pp on pp.perfil = up.perfil
     where u.id = p_usuario and u.ativo and pp.permissao = p_permissao)
  -- a própria pessoa, logada sem o código, não usa as permissões se o perfil dela exige duas etapas
  and (p_usuario is distinct from usuario_atual() or sessao_forte() or not exige_duas_etapas(p_usuario))
$$;

-- Registro na auditoria: ativar é da própria pessoa; remover é da administração.
create or replace function registrar_evento_mfa(p_usuario uuid, p_acao text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_acao not in ('MFA_ATIVADA', 'MFA_REMOVIDA') then
    raise exception 'VALOR_INVALIDO: evento desconhecido' using errcode = '22023';
  end if;
  if not (p_usuario = usuario_atual() or tem_permissao('config.critica')) then
    raise exception 'SEM_PERMISSAO: só a administração' using errcode = '42501';
  end if;
  perform registrar_evento_acesso(p_usuario, p_acao, jsonb_build_object('resultado', 'ok'));
end $$;

revoke execute on function exige_duas_etapas(uuid), sessao_forte() from public, anon;
grant execute on function exige_duas_etapas(uuid), sessao_forte() to delta_app, service_role;
revoke execute on function registrar_evento_mfa(uuid, text) from public, anon;
grant execute on function registrar_evento_mfa(uuid, text) to delta_app, service_role;

-- Lista de usuários: mostra quem já ativou as duas etapas e lê "trocar senha" também de app_metadata.
drop function if exists lista_usuarios();
create function lista_usuarios()
returns table(id uuid, nome text, email text, telefone text, cargo text, inicio_em date, observacoes text, ativo boolean,
              criado_em timestamptz, desativado_em timestamptz, desativacao_motivo text, perfis text[], ultimo_acesso timestamptz,
              tem_login boolean, situacao text, convite_expira_em timestamptz, convite_enviado_em timestamptz, trocar_senha boolean,
              duas_etapas boolean)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not tem_permissao('config.critica') then raise exception 'SEM_PERMISSAO: só a administração' using errcode = '42501'; end if;
  return query
  select u.id, u.nome, u.email, u.telefone, u.cargo, u.inicio_em, u.observacoes, u.ativo, u.criado_em, u.desativado_em, u.desativacao_motivo,
         coalesce((select array_agg(up.perfil order by up.perfil) from usuarios_perfis up where up.usuario = u.id), '{}'),
         au.last_sign_in_at, u.auth_user_id is not null,
         case
           when not u.ativo then 'desativado'
           when c.id is not null and c.expira_em < now() and au.last_sign_in_at is null then 'convite_expirado'
           when c.id is not null and c.enviado_em is null then 'convite_pendente'
           when c.id is not null then 'convite_enviado'
           when u.auth_user_id is null then 'sem_acesso'
           when au.last_sign_in_at is null or ts.trocar then 'primeiro_acesso'
           else 'ativo'
         end,
         c.expira_em, c.enviado_em, ts.trocar,
         exists (select 1 from auth.mfa_factors f where f.user_id = au.id and f.status = 'verified')
    from usuarios u
    left join auth.users au on au.id = u.auth_user_id
    left join lateral (select coalesce((au.raw_app_meta_data ->> 'trocar_senha')::boolean, false)
                           or coalesce((au.raw_user_meta_data ->> 'trocar_senha')::boolean, false) as trocar) ts on true
    left join lateral (select * from convites cv where cv.usuario_id = u.id and cv.tipo = 'convite' and cv.usado_em is null and cv.revogado_em is null
                       order by cv.criado_em desc limit 1) c on true
   order by u.ativo desc, u.nome;
end $$;
revoke execute on function lista_usuarios() from public, anon;
grant execute on function lista_usuarios() to delta_app, service_role;
