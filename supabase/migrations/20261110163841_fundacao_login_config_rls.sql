-- Fase 2 (Fundação): login individual pelo Supabase Auth, configurações com histórico,
-- políticas de acesso nas tabelas do núcleo e higiene de privilégios.

-- 1. Extensão fora do schema public (aviso do Supabase). A restrição de exclusão continua válida.
create schema if not exists extensions;
alter extension btree_gist set schema extensions;

-- 2. Novas tabelas no public não ganham acesso automático de anon/authenticated.
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated, public;

-- 3. Vínculo entre o cadastro interno e a conta de login.
alter table usuarios add column auth_user_id uuid unique references auth.users(id) on delete set null;

-- Usuário logado: pela sessão do Supabase Auth; sem sessão (tarefas internas e testes), pelo app.usuario.
-- Usuário inativo não é ninguém: perde todas as permissões na hora.
create or replace function usuario_atual() returns uuid
language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is not null then
      (select id from usuarios where auth_user_id = auth.uid() and ativo)
    else nullif(current_setting('app.usuario', true), '')::uuid
  end
$$;

-- Só entra quem foi cadastrado antes por um administrador: qualquer outra conta de login é recusada.
create function vincular_usuario_auth() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  update usuarios set auth_user_id = new.id, atualizado_em = now()
   where email = lower(new.email) and ativo and auth_user_id is null
   returning id into v_id;
  if v_id is null then
    raise exception 'ACESSO_NAO_AUTORIZADO: e-mail não cadastrado no Delta Gestão';
  end if;
  return new;
end $$;
create trigger delta_vincular_usuario after insert on auth.users
  for each row execute function vincular_usuario_auth();

-- 4. Auditoria usa o usuário logado e identifica registros sem coluna id.
create or replace function trg_auditar() returns trigger
language plpgsql security definer set search_path = public as $$
declare j jsonb := coalesce(to_jsonb(new), to_jsonb(old));
begin
  insert into auditoria (tabela, registro_id, acao, usuario, antes, depois)
  values (tg_table_name,
          coalesce(j ->> 'id', j ->> 'chave', j ->> 'codigo',
                   (j ->> 'usuario') || ':' || (j ->> 'perfil'),
                   (j ->> 'perfil') || ':' || (j ->> 'permissao')),
          tg_op, usuario_atual(),
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

-- 5. Configurações: valores que a Delta ajusta sem mexer no código. O histórico fica na auditoria.
create table configuracoes (
  chave         text primary key check (chave ~ '^[a-z_]+(\.[a-z_]+)*$'),
  grupo         text not null,
  descricao     text not null,
  tipo          text not null check (tipo in ('inteiro','percentual','horas','dias','centavos','faixa_centavos','texto')),
  valor         jsonb not null,
  ordem         integer not null default 0,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references usuarios(id)
);

create function trg_configuracao_valida() returns trigger
language plpgsql set search_path = public as $$
declare v jsonb := new.valor;
begin
  if new.tipo in ('inteiro','horas','dias','centavos') then
    if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric <> trunc((v #>> '{}')::numeric) or (v #>> '{}')::numeric < 0 then
      raise exception 'CONFIG_INVALIDA: % precisa ser um número inteiro maior ou igual a zero', new.chave;
    end if;
  elsif new.tipo = 'percentual' then
    if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric not between 0 and 100
       or (v #>> '{}')::numeric <> trunc((v #>> '{}')::numeric) then
      raise exception 'CONFIG_INVALIDA: % precisa ser um percentual inteiro de 0 a 100', new.chave;
    end if;
  elsif new.tipo = 'faixa_centavos' then
    if jsonb_typeof(v) <> 'object' or jsonb_typeof(v -> 'min') <> 'number' or jsonb_typeof(v -> 'max') <> 'number'
       or (v ->> 'min')::numeric < 0 or (v ->> 'min')::numeric > (v ->> 'max')::numeric
       or (v ->> 'min')::numeric <> trunc((v ->> 'min')::numeric) or (v ->> 'max')::numeric <> trunc((v ->> 'max')::numeric) then
      raise exception 'CONFIG_INVALIDA: % precisa de mínimo e máximo inteiros, com mínimo até o máximo', new.chave;
    end if;
  elsif new.tipo = 'texto' then
    if jsonb_typeof(v) <> 'string' or length(trim(v #>> '{}')) = 0 then
      raise exception 'CONFIG_INVALIDA: % precisa de um texto', new.chave;
    end if;
  end if;
  if tg_op = 'UPDATE' then
    if new.chave <> old.chave or new.tipo <> old.tipo then
      raise exception 'CONFIG_INVALIDA: chave e tipo não mudam';
    end if;
    new.atualizado_em := now();
    new.atualizado_por := usuario_atual();
  end if;
  return new;
end $$;
create trigger configuracao_valida before insert or update on configuracoes
  for each row execute function trg_configuracao_valida();
create trigger aud_configuracoes after insert or update or delete on configuracoes
  for each row execute function trg_auditar();
create trigger configuracoes_sem_delete before delete on configuracoes
  for each row execute function trg_bloquear_alteracao();

insert into configuracoes (chave, grupo, descricao, tipo, valor, ordem) values
  ('empresa.nome_fantasia',     'Empresa',    'Nome fantasia',                                   'texto', '"Delta Espaço e Eventos"', 10),
  ('empresa.razao_social',      'Empresa',    'Razão social (titular da conta)',                 'texto', '"M C Melo Santos"', 20),
  ('empresa.cnpj',              'Empresa',    'CNPJ',                                            'texto', '"06.328.111/0001-08"', 30),
  ('empresa.endereco',          'Empresa',    'Endereço',                                        'texto', '"Rua Rui Barbosa, 373, Centro, Bacabal-MA"', 40),
  ('reserva.bloqueio_horas',    'Reservas',   'Prazo do bloqueio temporário de data',            'horas', '24', 10),
  ('espaco.limpeza_horas',      'Reservas',   'Tempo de limpeza bloqueado no calendário',        'horas', '4', 20),
  ('espaco.menor.capacidade',   'Reservas',   'Capacidade do espaço menor (pessoas)',            'inteiro', '100', 30),
  ('espaco.maior.capacidade',   'Reservas',   'Capacidade máxima do espaço maior (pessoas)',     'inteiro', '500', 40),
  ('espaco.menor.faixa_preco',  'Preços',     'Faixa de preço do espaço menor',                  'faixa_centavos', '{"min":60000,"max":150000}', 10),
  ('espaco.maior.faixa_preco',  'Preços',     'Faixa de preço do espaço maior',                  'faixa_centavos', '{"min":200000,"max":500000}', 20),
  ('financeiro.sinal_percentual','Financeiro','Entrada na contratação',                          'percentual', '50', 10),
  ('financeiro.saldo_dias_antes','Financeiro','Saldo vence quantos dias antes do evento',        'dias', '7', 20),
  ('terceirizado.garcom_valor', 'Terceirizados','Garçom, valor por evento',                      'centavos', '18000', 10),
  ('terceirizado.seguranca_valor','Terceirizados','Segurança, valor por evento',                 'centavos', '18000', 20),
  ('terceirizado.jornada_horas','Terceirizados','Horas incluídas no valor por evento',           'horas', '4', 30);

-- 6. Resumo do usuário logado para a interface (a interface só esconde; quem decide é o banco).
create function meu_acesso() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', u.id, 'nome', u.nome, 'email', u.email,
    'perfis', coalesce((select jsonb_agg(up.perfil order by up.perfil) from usuarios_perfis up where up.usuario = u.id), '[]'),
    'permissoes', coalesce((select jsonb_agg(distinct pp.permissao) from usuarios_perfis up
                              join perfis_permissoes pp on pp.perfil = up.perfil where up.usuario = u.id), '[]'))
    from usuarios u where u.id = usuario_atual() and u.ativo
$$;

-- 7. Políticas das tabelas que estavam fechadas sem regra.
alter table configuracoes enable row level security;
create policy config_ler    on configuracoes for select using (usuario_atual() is not null);
create policy config_editar on configuracoes for update
  using (tem_permissao('config.critica')) with check (tem_permissao('config.critica'));

create policy auditoria_ler on auditoria for select using (tem_permissao('auditoria.ver'));

create policy clientes_ler    on clientes for select using (tem_permissao('cliente.ver'));
create policy clientes_criar  on clientes for insert with check (tem_permissao('cliente.editar'));
create policy clientes_editar on clientes for update
  using (tem_permissao('cliente.editar')) with check (tem_permissao('cliente.editar'));

create policy recursos_ler   on recursos for select using (usuario_atual() is not null);
create policy recursos_gerir on recursos for all
  using (tem_permissao('config.critica')) with check (tem_permissao('config.critica'));

-- Reservas e financeiro: só leitura direta. Gravação apenas pelas funções transacionais (Fase 4).
create function pode_ver_reservas() returns boolean
language sql stable security definer set search_path = public as $$
  select tem_permissao('orcamento.ver') or tem_permissao('reserva.confirmar')
      or tem_permissao('pagamento.confirmar') or tem_permissao('bloqueio.criar')
$$;
create policy reservas_ler  on reservas         for select using (pode_ver_reservas());
create policy periodos_ler  on reserva_periodos for select using (pode_ver_reservas());
create policy contratos_ler on contratos        for select using (pode_ver_reservas());
create policy parcelas_ler  on parcelas         for select
  using (tem_permissao('pagamento.confirmar') or tem_permissao('orcamento.ver'));
create policy pagamentos_ler on pagamentos      for select
  using (tem_permissao('pagamento.confirmar') or tem_permissao('orcamento.ver'));

-- 8. Privilégios: o papel da aplicação recebe só o necessário; quem entra pelo Supabase Auth herda esse papel.
grant select, update on configuracoes to delta_app;
grant select on auditoria to delta_app;
grant select, insert, update on clientes, recursos to delta_app;
grant select on reservas, reserva_periodos, contratos, parcelas, pagamentos, parcelas_situacao to delta_app;
grant execute on function usuario_atual(), tem_permissao(text, uuid), meu_acesso(), pode_ver_reservas() to delta_app;
revoke all on configuracoes from anon, authenticated;
revoke execute on function vincular_usuario_auth(), meu_acesso(), pode_ver_reservas(),
  trg_auditar(), trg_configuracao_valida() from public, anon, authenticated;
grant execute on function meu_acesso(), pode_ver_reservas() to delta_app;

grant delta_app to authenticated;
