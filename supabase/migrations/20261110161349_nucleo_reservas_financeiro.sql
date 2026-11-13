create extension if not exists btree_gist;

create type reserva_status  as enum ('bloqueio_temporario','confirmada','em_preparacao','realizada','cancelada','expirada');
create type contrato_status as enum ('rascunho','enviado','assinado','cancelado','substituido');
create type pagamento_tipo  as enum ('recebimento','estorno');

create table clientes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('PF','PJ')),
  nome text not null,
  documento text not null,
  criado_em timestamptz not null default now()
);
create unique index uq_clientes_documento on clientes (documento);

create table recursos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  tipo text not null check (tipo in ('espaco','cozinha','equipamento','equipe')),
  exclusivo boolean not null default true,
  quantidade integer not null default 1 check (quantidade > 0)
);

create table reservas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  status reserva_status not null default 'bloqueio_temporario',
  expira_em timestamptz,
  valor_total_centavos bigint not null check (valor_total_centavos > 0),
  criado_por uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (status <> 'bloqueio_temporario' or expira_em is not null)
);

create table reserva_periodos (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references reservas(id),
  recurso_id uuid not null references recursos(id),
  periodo tstzrange not null check (not isempty(periodo) and lower_inc(periodo) and not upper_inc(periodo)),
  ativo boolean not null default true,
  constraint sem_sobreposicao exclude using gist (recurso_id with =, periodo with &&) where (ativo)
);
create index ix_periodos_reserva on reserva_periodos (reserva_id);

create function trg_periodo_so_exclusivo() returns trigger language plpgsql as $$
begin
  if not (select exclusivo from recursos where id = new.recurso_id) then
    raise exception 'RECURSO_NAO_EXCLUSIVO: use a verificação por quantidade' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger periodo_so_exclusivo before insert on reserva_periodos
  for each row execute function trg_periodo_so_exclusivo();

create function trg_sincroniza_periodos() returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    update reserva_periodos
       set ativo = new.status in ('bloqueio_temporario','confirmada','em_preparacao','realizada')
     where reserva_id = new.id;
  end if;
  return new;
end $$;
create trigger sincroniza_periodos after update of status on reservas
  for each row execute function trg_sincroniza_periodos();

create table contratos (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references reservas(id),
  versao integer not null default 1,
  status contrato_status not null default 'rascunho',
  assinado_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (reserva_id, versao)
);

create function trg_contrato_imutavel() returns trigger language plpgsql as $$
begin
  if old.status = 'assinado' and not (new.status in ('cancelado','substituido')
        and new.reserva_id = old.reserva_id and new.versao = old.versao and new.assinado_em is not distinct from old.assinado_em) then
    raise exception 'CONTRATO_ASSINADO_IMUTAVEL: crie uma nova versão' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger contrato_imutavel before update on contratos
  for each row execute function trg_contrato_imutavel();

create table parcelas (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references reservas(id),
  numero smallint not null check (numero in (1,2)),
  valor_centavos bigint not null check (valor_centavos > 0),
  vencimento date not null,
  unique (reserva_id, numero)
);

create table pagamentos (
  id uuid primary key default gen_random_uuid(),
  parcela_id uuid not null references parcelas(id),
  tipo pagamento_tipo not null default 'recebimento',
  valor_centavos bigint not null check (valor_centavos > 0),
  forma text not null check (forma in ('pix','dinheiro','debito','credito','transferencia','outra')),
  provedor text,
  id_externo text,
  referencia text,
  confirmado_por uuid not null,
  confirmado_em timestamptz not null default now()
);
create unique index uq_pagamento_externo on pagamentos (provedor, id_externo) where id_externo is not null;

create function trg_bloquear_alteracao() returns trigger language plpgsql as $$
begin
  raise exception 'REGISTRO_IMUTAVEL: % não aceita % (use estorno, cancelamento ou ajuste)', tg_table_name, tg_op using errcode = 'P0001';
end $$;
create trigger pagamentos_imutavel before update or delete on pagamentos for each row execute function trg_bloquear_alteracao();
create trigger parcelas_sem_delete before delete on parcelas for each row execute function trg_bloquear_alteracao();
create trigger reservas_sem_delete before delete on reservas for each row execute function trg_bloquear_alteracao();
create trigger contratos_sem_delete before delete on contratos for each row execute function trg_bloquear_alteracao();

create view parcelas_situacao with (security_invoker = true) as
select p.id as parcela_id, p.reserva_id, p.numero, p.valor_centavos, p.vencimento,
       coalesce(sum(case g.tipo when 'recebimento' then g.valor_centavos else -g.valor_centavos end), 0)::bigint as pago_centavos,
       p.valor_centavos - coalesce(sum(case g.tipo when 'recebimento' then g.valor_centavos else -g.valor_centavos end), 0)::bigint as saldo_centavos
  from parcelas p left join pagamentos g on g.parcela_id = p.id
 group by p.id;

create table auditoria (
  id bigserial primary key,
  em timestamptz not null default now(),
  tabela text not null,
  registro_id text,
  acao text not null,
  usuario uuid,
  antes jsonb,
  depois jsonb
);
create trigger auditoria_imutavel before update or delete on auditoria for each row execute function trg_bloquear_alteracao();

create function trg_auditar() returns trigger language plpgsql as $$
declare v_usuario uuid := nullif(current_setting('app.usuario', true), '')::uuid;
begin
  insert into auditoria (tabela, registro_id, acao, usuario, antes, depois)
  values (tg_table_name,
          coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(old) ->> 'id')),
          tg_op, v_usuario,
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;
create trigger aud_reservas  after insert or update on reservas         for each row execute function trg_auditar();
create trigger aud_periodos  after insert or update on reserva_periodos for each row execute function trg_auditar();
create trigger aud_contratos after insert or update on contratos        for each row execute function trg_auditar();
create trigger aud_parcelas  after insert or update on parcelas         for each row execute function trg_auditar();
create trigger aud_pagamentos after insert on pagamentos                for each row execute function trg_auditar();

create function expirar_bloqueios() returns integer language plpgsql as $$
declare n integer;
begin
  update reservas set status = 'expirada', atualizado_em = now()
   where status = 'bloqueio_temporario' and expira_em < now();
  get diagnostics n = row_count;
  return n;
end $$;

create function criar_bloqueio_temporario(
  p_cliente uuid, p_valor_centavos bigint, p_recursos uuid[], p_periodo tstzrange,
  p_horas integer default 24, p_usuario uuid default null) returns uuid
language plpgsql as $$
declare v_id uuid; r uuid;
begin
  perform expirar_bloqueios();
  insert into reservas (cliente_id, valor_total_centavos, expira_em, criado_por)
  values (p_cliente, p_valor_centavos, now() + make_interval(hours => p_horas), p_usuario)
  returning id into v_id;
  foreach r in array p_recursos loop
    insert into reserva_periodos (reserva_id, recurso_id, periodo) values (v_id, r, p_periodo);
  end loop;
  return v_id;
exception when exclusion_violation then
  raise exception 'DATA_INDISPONIVEL: o espaço já está reservado nesse período' using errcode = 'P0001';
end $$;

create function gerar_parcelas(p_reserva uuid, p_data_evento date,
  p_percentual_sinal integer default 50, p_dias_saldo integer default 7) returns void
language plpgsql as $$
declare v_total bigint; v_sinal bigint;
begin
  select valor_total_centavos into strict v_total from reservas where id = p_reserva;
  v_sinal := (v_total * p_percentual_sinal + 99) / 100;
  insert into parcelas (reserva_id, numero, valor_centavos, vencimento) values
    (p_reserva, 1, v_sinal, current_date),
    (p_reserva, 2, v_total - v_sinal, p_data_evento - p_dias_saldo);
end $$;

create function confirmar_reserva(p_reserva uuid, p_usuario uuid) returns void
language plpgsql as $$
declare r reservas%rowtype; v_ok boolean;
begin
  select * into r from reservas where id = p_reserva for update;
  if not found then raise exception 'RESERVA_INEXISTENTE' using errcode = 'P0001'; end if;
  if r.status not in ('bloqueio_temporario','expirada') then
    raise exception 'STATUS_INVALIDO: a reserva está %', r.status using errcode = 'P0001';
  end if;
  if not exists (select 1 from contratos where reserva_id = p_reserva and status = 'assinado') then
    raise exception 'CONTRATO_NAO_ASSINADO' using errcode = 'P0001';
  end if;
  select (pago_centavos >= valor_centavos) into v_ok from parcelas_situacao where reserva_id = p_reserva and numero = 1;
  if v_ok is not true then raise exception 'ENTRADA_NAO_CONFIRMADA' using errcode = 'P0001'; end if;
  perform set_config('app.usuario', p_usuario::text, true);
  begin
    update reservas set status = 'confirmada', expira_em = null, atualizado_em = now() where id = p_reserva;
  exception when exclusion_violation then
    raise exception 'DATA_INDISPONIVEL: a data foi ocupada por outra reserva' using errcode = 'P0001';
  end;
end $$;
