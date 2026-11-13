-- Acessos, etapa 1: funções fechadas para quem não entrou, permissões de "ver", visitante só leitura,
-- convites por link, sessões, desativação com justificativa e transferência, proteção do administrador e trilha.

----------------------------------------------------------------------- 1. funções: ninguém sem login executa nada
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to delta_app, service_role;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public grant execute on functions to delta_app, service_role;
alter function composicao_do_item(cardapio_encomenda, uuid[]) set search_path = public;

----------------------------------------------------------------------- 2. permissões de "ver" por módulo
insert into permissoes (codigo, descricao) values
  ('salgados.ver',   'Ver encomendas e a fila da cozinha'),
  ('estoque.ver',    'Ver o estoque de salgados'),
  ('evento.ver',     'Ver eventos, ficha, equipe e checklist'),
  ('financeiro.ver', 'Ver parcelas, pagamentos e comprovantes'),
  ('contrato.ver',   'Ver contratos gerados')
on conflict (codigo) do nothing;

-- O administrador recebe toda permissão nova, sempre.
insert into perfis_permissoes (perfil, permissao)
select 'ADM', codigo from permissoes on conflict do nothing;

create or replace function pode_ver_salgados() returns boolean language sql stable security definer set search_path = public as $$
  select tem_permissao('salgados.criar') or tem_permissao('producao.status') or tem_permissao('retirada.registrar')
      or tem_permissao('estoque.movimentar') or tem_permissao('pagamento.confirmar')
      or tem_permissao('salgados.ver') or tem_permissao('estoque.ver')
$$;
create or replace function pode_ver_eventos() returns boolean language sql stable security definer set search_path = public as $$
  select tem_permissao('orcamento.ver') or tem_permissao('escala.gerir') or tem_permissao('evento.fechar')
      or tem_permissao('producao.status') or tem_permissao('custo.ver') or tem_permissao('evento.ver')
$$;
create or replace function pode_ver_gastos() returns boolean language sql stable security definer set search_path = public as $$
  select tem_permissao('evento.fechar') or tem_permissao('custo.ver') or tem_permissao('financeiro.ver')
$$;
create or replace function pode_ver_reservas() returns boolean language sql stable security definer set search_path = public as $$
  select tem_permissao('orcamento.ver') or tem_permissao('reserva.confirmar')
      or tem_permissao('pagamento.confirmar') or tem_permissao('bloqueio.criar')
      or tem_permissao('financeiro.ver') or tem_permissao('contrato.ver')
$$;
drop policy if exists comprovantes_ler on comprovantes;
create policy comprovantes_ler on comprovantes for select using (tem_permissao('pagamento.confirmar') or tem_permissao('financeiro.ver'));
do $$
declare p record;
begin
  -- parcelas e pagamentos: quem vê o financeiro também lê
  for p in select policyname, tablename from pg_policies where schemaname = 'public' and tablename in ('parcelas', 'pagamentos') and cmd = 'SELECT' loop
    execute format('drop policy %I on %I', p.policyname, p.tablename);
  end loop;
end $$;
create policy parcelas_ler on parcelas for select using (tem_permissao('pagamento.confirmar') or tem_permissao('orcamento.ver') or tem_permissao('financeiro.ver'));
create policy pagamentos_ler on pagamentos for select using (tem_permissao('pagamento.confirmar') or tem_permissao('orcamento.ver') or tem_permissao('financeiro.ver'));

----------------------------------------------------------------------- 3. visitante: só permissões de ver
delete from perfis_permissoes where perfil = 'VIS';
insert into perfis_permissoes (perfil, permissao) values
  ('VIS', 'cliente.ver'), ('VIS', 'orcamento.ver'), ('VIS', 'salgados.ver'), ('VIS', 'estoque.ver'),
  ('VIS', 'evento.ver'), ('VIS', 'financeiro.ver'), ('VIS', 'contrato.ver');

create function trg_regras_perfis_permissoes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('INSERT', 'UPDATE') and new.perfil = 'VIS' and new.permissao not like '%.ver' then
    raise exception 'PERFIL_PROTEGIDO: o visitante só pode ter permissões de ver' using errcode = 'P0001';
  end if;
  if tg_op in ('DELETE', 'UPDATE') and old.perfil = 'ADM' then
    raise exception 'PERFIL_PROTEGIDO: o administrador tem todas as permissões e não pode perder nenhuma' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
create trigger regras_perfis_permissoes before insert or update or delete on perfis_permissoes
  for each row execute function trg_regras_perfis_permissoes();

-- permissão nova entra automaticamente no administrador
create function trg_permissao_nova_para_adm() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfis_permissoes (perfil, permissao) values ('ADM', new.codigo) on conflict do nothing;
  return new;
end $$;
create trigger permissao_nova_para_adm after insert on permissoes for each row execute function trg_permissao_nova_para_adm();

----------------------------------------------------------------------- 4. cadastro do funcionário
alter table usuarios
  add column telefone text check (telefone is null or telefone ~ '^\d{10,11}$'),
  add column cargo text check (cargo is null or length(trim(cargo)) between 2 and 80),
  add column inicio_em date,
  add column observacoes text check (observacoes is null or length(observacoes) <= 1000),
  add column desativado_em timestamptz,
  add column desativado_por uuid references usuarios(id),
  add column desativacao_motivo text,
  add column sessoes_revogadas_em timestamptz;

-- Sessões revogadas: tokens emitidos antes do corte deixam de valer na hora (as sessões também são apagadas).
create or replace function usuario_atual() returns uuid
language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is not null then
      (select id from usuarios
        where auth_user_id = auth.uid() and ativo
          and (sessoes_revogadas_em is null
               or to_timestamp(coalesce((auth.jwt() ->> 'iat')::bigint, 0)) >= sessoes_revogadas_em))
    else nullif(current_setting('app.usuario', true), '')::uuid
  end
$$;

----------------------------------------------------------------------- 5. convites e links de redefinição
create table convites (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references usuarios(id),
  tipo        text not null check (tipo in ('convite', 'redefinicao')),
  token_hash  text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),   -- só o hash; o link vai uma vez para o administrador
  criado_por  uuid not null references usuarios(id),
  criado_em   timestamptz not null default now(),
  expira_em   timestamptz not null,
  enviado_em  timestamptz,                                                  -- quando o administrador copiou ou mandou o link
  usado_em    timestamptz,
  revogado_em timestamptz,
  revogado_por uuid references usuarios(id),
  check (expira_em > criado_em)
);
create index convites_usuario on convites (usuario_id, criado_em desc);
alter table convites enable row level security;
create policy convites_ler on convites for select using (tem_permissao('config.critica'));
grant select on convites to delta_app;
revoke all on convites from anon, authenticated;
create trigger aud_convites after insert or update on convites for each row execute function trg_auditar();

-- Evento de acesso na trilha (quem fez, quem foi afetado, resultado e origem ficam em "depois").
create function registrar_evento_acesso(p_usuario uuid, p_acao text, p_info jsonb default '{}') returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into auditoria (tabela, registro_id, acao, usuario, antes, depois)
  values ('acessos', p_usuario::text, upper(p_acao), usuario_atual(), null, coalesce(p_info, '{}'));
end $$;

-- Tentativa de abrir algo sem permissão: qualquer usuário logado registra a própria.
create function registrar_acesso_negado(p_recurso text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if usuario_atual() is null then return; end if;
  insert into auditoria (tabela, registro_id, acao, usuario, antes, depois)
  values ('acessos', usuario_atual()::text, 'ACESSO_NEGADO', usuario_atual(), null,
          jsonb_build_object('recurso', left(coalesce(p_recurso, ''), 200), 'resultado', 'negado'));
end $$;

create function registrar_convite(p_usuario uuid, p_tipo text, p_hash text, p_horas int default 72) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; u usuarios%rowtype;
begin
  if not tem_permissao('config.critica') then raise exception 'SEM_PERMISSAO: só a administração convida' using errcode = '42501'; end if;
  select * into u from usuarios where id = p_usuario for update;
  if not found then raise exception 'STATUS_INVALIDO: usuário inexistente' using errcode = 'P0001'; end if;
  if not u.ativo then raise exception 'STATUS_INVALIDO: reative o usuário antes de mandar um link' using errcode = 'P0001'; end if;
  if p_horas not between 1 and 168 then raise exception 'VALOR_INVALIDO: validade de 1 a 168 horas' using errcode = 'P0001'; end if;
  update convites set revogado_em = now(), revogado_por = usuario_atual()
   where usuario_id = p_usuario and usado_em is null and revogado_em is null;
  insert into convites (usuario_id, tipo, token_hash, criado_por, expira_em)
  values (p_usuario, p_tipo, p_hash, usuario_atual(), now() + make_interval(hours => p_horas))
  returning id into v_id;
  perform registrar_evento_acesso(p_usuario, case p_tipo when 'convite' then 'CONVITE_CRIADO' else 'REDEFINICAO_CRIADA' end,
                                  jsonb_build_object('validade_horas', p_horas, 'resultado', 'ok'));
  return v_id;
end $$;

create function marcar_convite_enviado(p_convite uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('config.critica') then raise exception 'SEM_PERMISSAO: só a administração' using errcode = '42501'; end if;
  update convites set enviado_em = coalesce(enviado_em, now()) where id = p_convite and usado_em is null and revogado_em is null;
end $$;

create function revogar_convite(p_usuario uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('config.critica') then raise exception 'SEM_PERMISSAO: só a administração' using errcode = '42501'; end if;
  update convites set revogado_em = now(), revogado_por = usuario_atual()
   where usuario_id = p_usuario and usado_em is null and revogado_em is null;
  if found then perform registrar_evento_acesso(p_usuario, 'CONVITE_REVOGADO', jsonb_build_object('resultado', 'ok')); end if;
end $$;

-- Usado pelo servidor (chave secreta) na página do link: confere e consome o convite numa única operação.
create function consumir_convite(p_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c convites%rowtype; u usuarios%rowtype;
begin
  select * into c from convites where token_hash = p_hash for update;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'invalido'); end if;
  if c.revogado_em is not null then return jsonb_build_object('ok', false, 'motivo', 'revogado'); end if;
  if c.usado_em is not null then return jsonb_build_object('ok', false, 'motivo', 'usado'); end if;
  if c.expira_em < now() then return jsonb_build_object('ok', false, 'motivo', 'expirado'); end if;
  select * into u from usuarios where id = c.usuario_id;
  if not u.ativo then return jsonb_build_object('ok', false, 'motivo', 'desativado'); end if;
  update convites set usado_em = now() where id = c.id;
  insert into auditoria (tabela, registro_id, acao, usuario, antes, depois)
  values ('acessos', u.id::text, case c.tipo when 'convite' then 'CONVITE_ACEITO' else 'SENHA_REDEFINIDA' end, u.id, null,
          jsonb_build_object('resultado', 'ok', 'origem', 'link'));
  return jsonb_build_object('ok', true, 'usuario', u.id, 'email', u.email, 'nome', u.nome, 'auth_user_id', u.auth_user_id, 'tipo', c.tipo);
end $$;

-- Conferência sem consumir (para mostrar a tela certa antes de a pessoa digitar a senha).
create function conferir_convite(p_hash text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_build_object('ok', c.usado_em is null and c.revogado_em is null and c.expira_em >= now() and u.ativo,
             'motivo', case when c.revogado_em is not null then 'revogado' when c.usado_em is not null then 'usado'
                            when c.expira_em < now() then 'expirado' when not u.ativo then 'desativado' end,
             'nome', split_part(u.nome, ' ', 1), 'email', u.email, 'tipo', c.tipo)
      from convites c join usuarios u on u.id = c.usuario_id where c.token_hash = p_hash),
    jsonb_build_object('ok', false, 'motivo', 'invalido'))
$$;
revoke execute on function consumir_convite(text), conferir_convite(text) from delta_app;   -- só o servidor (service_role)

----------------------------------------------------------------------- 6. sessões
create function revogar_sessoes(p_usuario uuid, p_motivo text default null) returns void
language plpgsql security definer set search_path = public, auth as $$
declare a uuid;
begin
  if not tem_permissao('config.critica') then raise exception 'SEM_PERMISSAO: só a administração' using errcode = '42501'; end if;
  update usuarios set sessoes_revogadas_em = now() where id = p_usuario returning auth_user_id into a;
  if a is not null then delete from auth.sessions where user_id = a; end if;
  perform registrar_evento_acesso(p_usuario, 'SESSOES_REVOGADAS', jsonb_build_object('motivo', p_motivo, 'resultado', 'ok'));
end $$;

----------------------------------------------------------------------- 7. cadastro, perfis, desativação
-- Mudar "ativo" só pelas funções (que pedem justificativa e cortam sessões).
create function trg_ativo_so_por_funcao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.ativo is distinct from old.ativo and coalesce(current_setting('delta.mudando_ativo', true), '') <> '1' then
    raise exception 'STATUS_INVALIDO: use Desativar ou Reativar no Gerenciar acesso' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger ativo_so_por_funcao before update on usuarios for each row execute function trg_ativo_so_por_funcao();

drop function criar_usuario(text, text, text[]);
create function criar_usuario(p_nome text, p_email text, p_perfis text[], p_telefone text default null, p_cargo text default null,
                              p_inicio date default null, p_observacoes text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not tem_permissao('config.critica') then raise exception 'SEM_PERMISSAO: só a administração cadastra usuários' using errcode = '42501'; end if;
  if coalesce(array_length(p_perfis, 1), 0) = 0 then raise exception 'PERFIL_OBRIGATORIO: escolha ao menos um perfil'; end if;
  if 'VIS' = any(p_perfis) and array_length(p_perfis, 1) > 1 then
    raise exception 'PERFIL_PROTEGIDO: o perfil Visitante não se combina com outros' using errcode = 'P0001';
  end if;
  insert into usuarios (nome, email, telefone, cargo, inicio_em, observacoes)
  values (trim(p_nome), lower(trim(p_email)), nullif(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'), ''),
          nullif(trim(coalesce(p_cargo, '')), ''), p_inicio, nullif(trim(coalesce(p_observacoes, '')), ''))
  returning id into v_id;
  insert into usuarios_perfis (usuario, perfil) select v_id, unnest(p_perfis);
  perform registrar_evento_acesso(v_id, 'USUARIO_CRIADO', jsonb_build_object('perfis', p_perfis, 'resultado', 'ok'));
  return v_id;
exception when unique_violation then
  raise exception 'EMAIL_JA_CADASTRADO: já existe um usuário com este e-mail';
end $$;

create function atualizar_usuario(p_usuario uuid, p_nome text, p_telefone text, p_cargo text, p_inicio date, p_observacoes text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('config.critica') then raise exception 'SEM_PERMISSAO: só a administração' using errcode = '42501'; end if;
  update usuarios set nome = trim(p_nome), telefone = nullif(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'), ''),
         cargo = nullif(trim(coalesce(p_cargo, '')), ''), inicio_em = p_inicio,
         observacoes = nullif(trim(coalesce(p_observacoes, '')), ''), atualizado_em = now()
   where id = p_usuario;
end $$;

create or replace function definir_perfis(p_usuario uuid, p_perfis text[]) returns void
language plpgsql security definer set search_path = public as $$
declare antes text[];
begin
  if not tem_permissao('config.critica') then raise exception 'SEM_PERMISSAO: só a administração muda perfis' using errcode = '42501'; end if;
  if coalesce(array_length(p_perfis, 1), 0) = 0 then raise exception 'PERFIL_OBRIGATORIO: escolha ao menos um perfil'; end if;
  if 'VIS' = any(p_perfis) and array_length(p_perfis, 1) > 1 then
    raise exception 'PERFIL_PROTEGIDO: o perfil Visitante não se combina com outros' using errcode = 'P0001';
  end if;
  if p_usuario = usuario_atual() and not ('ADM' = any(p_perfis)) and exists (select 1 from usuarios_perfis where usuario = p_usuario and perfil = 'ADM') then
    raise exception 'PERFIL_PROTEGIDO: você não pode tirar o seu próprio perfil de administrador; peça a outro administrador' using errcode = 'P0001';
  end if;
  select array_agg(perfil order by perfil) into antes from usuarios_perfis where usuario = p_usuario;
  delete from usuarios_perfis where usuario = p_usuario and perfil <> all (p_perfis);
  insert into usuarios_perfis (usuario, perfil) select p_usuario, unnest(p_perfis) on conflict do nothing;
  perform registrar_evento_acesso(p_usuario, 'PERFIS_ALTERADOS',
    jsonb_build_object('antes', antes, 'depois', (select array_agg(x order by x) from unnest(p_perfis) x), 'resultado', 'ok'));
end $$;

create function desativar_usuario(p_usuario uuid, p_motivo text, p_transferir_para uuid default null) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare u usuarios%rowtype; n_tarefas int := 0; n_orc int := 0;
begin
  if not tem_permissao('config.critica') then raise exception 'SEM_PERMISSAO: só a administração desativa usuários' using errcode = '42501'; end if;
  if p_usuario = usuario_atual() then raise exception 'STATUS_INVALIDO: você não pode desativar a sua própria conta' using errcode = 'P0001'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'VALOR_INVALIDO: escreva o motivo da desativação' using errcode = 'P0001'; end if;
  select * into u from usuarios where id = p_usuario for update;
  if not found or not u.ativo then raise exception 'STATUS_INVALIDO: usuário já está desativado' using errcode = 'P0001'; end if;
  if p_transferir_para is not null then
    if p_transferir_para = p_usuario or not exists (select 1 from usuarios where id = p_transferir_para and ativo) then
      raise exception 'VALOR_INVALIDO: escolha um usuário ativo para receber as tarefas' using errcode = 'P0001';
    end if;
    update tarefas set responsavel = p_transferir_para where responsavel = p_usuario and concluida_em is null;
    get diagnostics n_tarefas = row_count;
    update orcamentos set responsavel = p_transferir_para where responsavel = p_usuario and status not in ('aprovado', 'perdido');
    get diagnostics n_orc = row_count;
  end if;
  perform set_config('delta.mudando_ativo', '1', true);
  update usuarios set ativo = false, desativado_em = now(), desativado_por = usuario_atual(), desativacao_motivo = trim(p_motivo),
         sessoes_revogadas_em = now(), atualizado_em = now()
   where id = p_usuario;                                   -- o gatilho mantem_admin recusa se for o último administrador
  perform set_config('delta.mudando_ativo', '', true);
  if u.auth_user_id is not null then delete from auth.sessions where user_id = u.auth_user_id; end if;
  update convites set revogado_em = now(), revogado_por = usuario_atual() where usuario_id = p_usuario and usado_em is null and revogado_em is null;
  perform registrar_evento_acesso(p_usuario, 'USUARIO_DESATIVADO', jsonb_build_object('motivo', trim(p_motivo), 'transferido_para', p_transferir_para,
    'tarefas_transferidas', n_tarefas, 'orcamentos_transferidos', n_orc, 'resultado', 'ok'));
  return jsonb_build_object('tarefas', n_tarefas, 'orcamentos', n_orc);
end $$;

create function reativar_usuario(p_usuario uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('config.critica') then raise exception 'SEM_PERMISSAO: só a administração' using errcode = '42501'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'VALOR_INVALIDO: escreva o motivo da reativação' using errcode = 'P0001'; end if;
  perform set_config('delta.mudando_ativo', '1', true);
  update usuarios set ativo = true, desativado_em = null, desativado_por = null, desativacao_motivo = null, atualizado_em = now()
   where id = p_usuario and not ativo;
  if not found then raise exception 'STATUS_INVALIDO: usuário já está ativo' using errcode = 'P0001'; end if;
  perform set_config('delta.mudando_ativo', '', true);
  perform registrar_evento_acesso(p_usuario, 'USUARIO_REATIVADO', jsonb_build_object('motivo', trim(p_motivo), 'resultado', 'ok'));
end $$;

----------------------------------------------------------------------- 8. lista para a tela (com último acesso e situação do convite)
create function lista_usuarios() returns table (
  id uuid, nome text, email text, telefone text, cargo text, inicio_em date, observacoes text, ativo boolean,
  criado_em timestamptz, desativado_em timestamptz, desativacao_motivo text, perfis text[], ultimo_acesso timestamptz,
  tem_login boolean, situacao text, convite_expira_em timestamptz, convite_enviado_em timestamptz, trocar_senha boolean)
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
           when au.last_sign_in_at is null or coalesce((au.raw_user_meta_data ->> 'trocar_senha')::boolean, false) then 'primeiro_acesso'
           else 'ativo'
         end,
         c.expira_em, c.enviado_em, coalesce((au.raw_user_meta_data ->> 'trocar_senha')::boolean, false)
    from usuarios u
    left join auth.users au on au.id = u.auth_user_id
    left join lateral (select * from convites cv where cv.usuario_id = u.id and cv.tipo = 'convite' and cv.usado_em is null and cv.revogado_em is null
                       order by cv.criado_em desc limit 1) c on true
   order by u.ativo desc, u.nome;
end $$;

-- Histórico de acesso de um usuário (para o painel lateral)
create function historico_acesso(p_usuario uuid) returns table (em timestamptz, acao text, por text, info jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not tem_permissao('config.critica') then raise exception 'SEM_PERMISSAO: só a administração' using errcode = '42501'; end if;
  return query
  select a.em, a.acao, (select nome from usuarios where id = a.usuario), coalesce(a.depois, '{}')
    from auditoria a
   where (a.tabela = 'acessos' and a.registro_id = p_usuario::text)
      or (a.tabela = 'usuarios_perfis' and (coalesce(a.depois, a.antes) ->> 'usuario') = p_usuario::text)
   order by a.em desc limit 60;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to delta_app, service_role;
revoke execute on function consumir_convite(text), conferir_convite(text) from delta_app;
