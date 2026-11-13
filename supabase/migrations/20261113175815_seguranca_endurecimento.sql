-- Endurecimento de segurança (13/11/2026).
-- 1) Funções de gatilho e de uso interno não podem ser chamadas pela API.
-- 2) Colunas que só mudam por função (status, número, autor...) não aceitam gravação direta pela API.
-- 3) Limite de tentativas (login, convite, visitante), guardado no banco e só usado pelo servidor.

-- ---------------------------------------------------------------- 1. funções internas fechadas
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and (p.prorettype = 'trigger'::regtype
            or p.proname in ('registrar_evento_acesso', 'expirar_bloqueios', 'marcar_realizadas'))
  loop
    execute format('revoke execute on function %s from public, anon, authenticated, delta_app', f.assinatura);
    execute format('grant execute on function %s to service_role', f.assinatura);
  end loop;
end $$;

-- Exigir senha nova é registrado por função própria (antes o servidor chamava registrar_evento_acesso direto).
create or replace function registrar_troca_senha_forcada(p_usuario uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('config.critica') then
    raise exception 'SEM_PERMISSAO: só a administração exige senha nova' using errcode = '42501';
  end if;
  perform registrar_evento_acesso(p_usuario, 'TROCA_SENHA_FORCADA', jsonb_build_object('resultado', 'ok'));
end $$;
revoke execute on function registrar_troca_senha_forcada(uuid) from public, anon;
grant execute on function registrar_troca_senha_forcada(uuid) to delta_app, service_role;

-- ---------------------------------------------------------------- 2. gravação direta só nas colunas que a tela edita
-- orçamentos: status, número, motivo da perda e autor só mudam pelas funções do sistema
revoke insert, update on orcamentos from delta_app, authenticated;
grant insert (cliente_id, titulo, tipo, data_evento, horario, convidados, recurso_id, local_externo) on orcamentos to delta_app;
grant update (titulo, tipo, data_evento, horario, convidados, recurso_id, local_externo, responsavel, atualizado_em) on orcamentos to delta_app;

-- versões: status, totais, datas de envio e aceite só pelas funções
revoke insert, update on orcamento_versoes from delta_app, authenticated;
grant insert (orcamento_id, numero, condicoes) on orcamento_versoes to delta_app;
grant update (desconto_centavos, condicoes, observacoes, apresentacao) on orcamento_versoes to delta_app;

-- tarefas: quem cria e quando não se altera; concluir só marca a conclusão
revoke insert, update on tarefas from delta_app, authenticated;
grant insert (titulo, descricao, vence_em, responsavel, cliente_id, orcamento_id) on tarefas to delta_app;
grant update (concluida_em, concluida_por) on tarefas to delta_app;

-- sem "security definer" de propósito: assim current_user mostra se veio da API (authenticated) ou de uma função do sistema
create or replace function trg_tarefa_conclusao() returns trigger
language plpgsql set search_path = public as $$
begin
  -- quem conclui é quem está logado, não quem a requisição disser
  if current_user in ('authenticated', 'delta_app') then
    new.concluida_por := case when new.concluida_em is null then null else usuario_atual() end;
  end if;
  return new;
end $$;
revoke execute on function trg_tarefa_conclusao() from public, anon, authenticated, delta_app;
drop trigger if exists tarefa_conclusao on tarefas;
create trigger tarefa_conclusao before update on tarefas for each row execute function trg_tarefa_conclusao();

-- ---------------------------------------------------------------- 3. limite de tentativas
create table if not exists limites_tentativas (
  chave text primary key,             -- ex.: "login:ip:<hash>" (nunca o IP ou e-mail em texto)
  janela_inicio timestamptz not null default now(),
  tentativas integer not null default 0,
  bloqueado_ate timestamptz
);
alter table limites_tentativas enable row level security;  -- sem políticas: só o servidor (service_role) mexe
revoke all on limites_tentativas from public, anon, authenticated, delta_app;

/**
 * Conta uma tentativa e diz se ainda pode. Passou do máximo na janela: bloqueia pelo tempo de castigo.
 * Devolve os segundos que faltam (0 = pode seguir).
 */
create or replace function consumir_tentativa(p_chave text, p_maximo integer, p_janela_s integer, p_castigo_s integer)
returns integer language plpgsql security definer set search_path = public as $$
declare r limites_tentativas;
begin
  insert into limites_tentativas as l (chave) values (left(p_chave, 200))
  on conflict (chave) do update set chave = l.chave
  returning * into r;
  if r.bloqueado_ate is not null and r.bloqueado_ate > now() then
    return ceil(extract(epoch from r.bloqueado_ate - now()))::integer;
  end if;
  if r.janela_inicio < now() - make_interval(secs => p_janela_s) or r.bloqueado_ate is not null then
    update limites_tentativas set janela_inicio = now(), tentativas = 1, bloqueado_ate = null where chave = r.chave;
    return 0;
  end if;
  if r.tentativas + 1 > p_maximo then
    update limites_tentativas set bloqueado_ate = now() + make_interval(secs => p_castigo_s) where chave = r.chave;
    return p_castigo_s;
  end if;
  update limites_tentativas set tentativas = r.tentativas + 1 where chave = r.chave;
  return 0;
end $$;

/** Deu certo (ex.: login correto): zera o contador daquela chave. */
create or replace function limpar_tentativas(p_chave text) returns void
language sql security definer set search_path = public as $$
  delete from limites_tentativas where chave = left(p_chave, 200);
$$;

revoke execute on function consumir_tentativa(text, integer, integer, integer), limpar_tentativas(text) from public, anon, authenticated, delta_app;
grant execute on function consumir_tentativa(text, integer, integer, integer), limpar_tentativas(text) to service_role;
