-- Fase 3 (Comercial): clientes PF/PJ com duplicados e mesclagem, catálogo com histórico de preço
-- e custo restrito, orçamentos versionados (imutáveis após envio) com aprovação de desconto, e tarefas.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create function normaliza_texto(t text) returns text
language sql immutable parallel safe set search_path = public, extensions as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, '')))
$$;

----------------------------------------------------------------------- documentos
create function valida_cpf(c text) returns boolean
language plpgsql immutable set search_path = public as $$
declare d int[]; s int; r int; i int;
begin
  if c !~ '^[0-9]{11}$' or c ~ '^(.)\1{10}$' then return false; end if;
  d := string_to_array(c, null)::int[];
  for n in 9..10 loop
    s := 0;
    for i in 1..n loop s := s + d[i] * (n + 2 - i); end loop;
    r := (s * 10) % 11 % 10;
    if r <> d[n + 1] then return false; end if;
  end loop;
  return true;
end $$;

create function valida_cnpj(c text) returns boolean
language plpgsql immutable set search_path = public as $$
declare d int[]; p1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2]; p2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2]; s int; r int;
begin
  if c !~ '^[0-9]{14}$' or c ~ '^(.)\1{13}$' then return false; end if;
  d := string_to_array(c, null)::int[];
  s := 0; for i in 1..12 loop s := s + d[i] * p1[i]; end loop;
  r := s % 11; r := case when r < 2 then 0 else 11 - r end;
  if r <> d[13] then return false; end if;
  s := 0; for i in 1..13 loop s := s + d[i] * p2[i]; end loop;
  r := s % 11; r := case when r < 2 then 0 else 11 - r end;
  return r = d[14];
end $$;

----------------------------------------------------------------------- clientes
alter table clientes alter column documento drop not null;
drop index uq_clientes_documento;
create unique index uq_clientes_documento on clientes (documento) where documento is not null;

alter table clientes
  add column nome_fantasia    text,
  add column responsavel_nome text,
  add column telefone         text check (telefone ~ '^[0-9]{10,11}$'),
  add column email            text check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  add column endereco         text,
  add column cidade           text,
  add column uf               text check (uf ~ '^[A-Z]{2}$'),
  add column origem           text check (origem in ('whatsapp','instagram','indicacao','balcao','telefone','outro')),
  add column observacoes      text,
  add column ativo            boolean not null default true,
  add column mesclado_em      uuid references clientes(id),
  add column criado_por       uuid default usuario_atual(),
  add column atualizado_em    timestamptz not null default now(),
  add constraint clientes_nome check (length(trim(nome)) >= 2),
  add constraint clientes_documento_valido check (
    documento is null or (tipo = 'PF' and valida_cpf(documento)) or (tipo = 'PJ' and valida_cnpj(documento)));

create index ix_clientes_telefone on clientes (telefone) where telefone is not null;
create index ix_clientes_nome_trgm on clientes using gin (normaliza_texto(nome) extensions.gin_trgm_ops);

create function trg_atualizado_em() returns trigger language plpgsql set search_path = public as $$
begin new.atualizado_em := now(); return new; end $$;
create trigger clientes_atualizado before update on clientes for each row execute function trg_atualizado_em();
create trigger aud_clientes after insert or update on clientes for each row execute function trg_auditar();
create trigger clientes_sem_delete before delete on clientes for each row execute function trg_bloquear_alteracao();

-- Possíveis cadastros repetidos. Respeita as políticas de quem chama (precisa de cliente.ver).
create function buscar_duplicados(p_nome text, p_telefone text, p_documento text, p_ignorar uuid default null)
returns table (id uuid, nome text, telefone text, documento text, motivo text)
language sql stable security invoker set search_path = public, extensions as $$
  select c.id, c.nome, c.telefone, c.documento,
         case when p_documento is not null and c.documento = p_documento then 'Mesmo CPF/CNPJ'
              when p_telefone is not null and c.telefone = p_telefone then 'Mesmo telefone'
              else 'Nome parecido' end
    from clientes c
   where c.mesclado_em is null
     and (p_ignorar is null or c.id <> p_ignorar)
     and ((p_documento is not null and c.documento = p_documento)
       or (p_telefone is not null and c.telefone = p_telefone)
       or (length(coalesce(p_nome, '')) >= 4
           and extensions.similarity(normaliza_texto(c.nome), normaliza_texto(p_nome)) >= 0.55))
   order by 5, extensions.similarity(normaliza_texto(c.nome), normaliza_texto(p_nome)) desc
   limit 10
$$;

----------------------------------------------------------------------- catálogo
insert into recursos (nome, tipo, exclusivo) values ('Espaço menor', 'espaco', true), ('Espaço maior', 'espaco', true);
alter table recursos add column capacidade integer check (capacidade > 0), add column ativo boolean not null default true;
update recursos set capacidade = 100 where nome = 'Espaço menor';
update recursos set capacidade = 500 where nome = 'Espaço maior';

create table catalogo_itens (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null unique check (length(trim(nome)) >= 2),
  categoria     text not null check (categoria in ('espaco','alimentacao','bebida','servico','equipe','equipamento','salgado','outro')),
  unidade       text not null check (unidade in ('evento','pessoa','unidade','cento','hora','diaria','kg','litro')),
  descricao     text,
  preco_tipo    text not null check (preco_tipo in ('fixo','faixa')),
  preco_centavos     bigint check (preco_centavos >= 0),
  preco_min_centavos bigint check (preco_min_centavos >= 0),
  preco_max_centavos bigint,
  recurso_id    uuid references recursos(id),
  ativo         boolean not null default true,
  ordem         integer not null default 0,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check ((preco_tipo = 'fixo' and preco_centavos is not null)
      or (preco_tipo = 'faixa' and preco_min_centavos is not null and preco_max_centavos >= preco_min_centavos))
);

create table catalogo_precos (
  id             bigserial primary key,
  item_id        uuid not null references catalogo_itens(id),
  preco_tipo     text not null,
  preco_centavos bigint,
  preco_min_centavos bigint,
  preco_max_centavos bigint,
  vigente_desde  timestamptz not null default now(),
  alterado_por   uuid
);
create index ix_catalogo_precos_item on catalogo_precos (item_id, vigente_desde desc);

create table catalogo_custos (
  item_id        uuid primary key references catalogo_itens(id),
  custo_centavos bigint not null check (custo_centavos >= 0),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid default usuario_atual()
);

create function trg_historico_preco() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or (new.preco_tipo, new.preco_centavos, new.preco_min_centavos, new.preco_max_centavos)
       is distinct from (old.preco_tipo, old.preco_centavos, old.preco_min_centavos, old.preco_max_centavos) then
    insert into catalogo_precos (item_id, preco_tipo, preco_centavos, preco_min_centavos, preco_max_centavos, alterado_por)
    values (new.id, new.preco_tipo, new.preco_centavos, new.preco_min_centavos, new.preco_max_centavos, usuario_atual());
  end if;
  return new;
end $$;
create trigger catalogo_historico after insert or update on catalogo_itens for each row execute function trg_historico_preco();
create trigger catalogo_atualizado before update on catalogo_itens for each row execute function trg_atualizado_em();
create trigger aud_catalogo after insert or update on catalogo_itens for each row execute function trg_auditar();
create trigger catalogo_sem_delete before delete on catalogo_itens for each row execute function trg_bloquear_alteracao();
create trigger aud_catalogo_custos after insert or update or delete on catalogo_custos for each row execute function trg_auditar();
create trigger catalogo_precos_imutavel before update or delete on catalogo_precos for each row execute function trg_bloquear_alteracao();

-- Preços que estavam em Configurações passam a morar no catálogo (fonte única).
insert into catalogo_itens (nome, categoria, unidade, descricao, preco_tipo, preco_min_centavos, preco_max_centavos, recurso_id, ordem)
select 'Locação do espaço menor', 'espaco', 'evento', 'Até 100 pessoas. Entregue e devolvido limpo.', 'faixa',
       (valor ->> 'min')::bigint, (valor ->> 'max')::bigint, (select id from recursos where nome = 'Espaço menor'), 10
  from configuracoes where chave = 'espaco.menor.faixa_preco';
insert into catalogo_itens (nome, categoria, unidade, descricao, preco_tipo, preco_min_centavos, preco_max_centavos, recurso_id, ordem)
select 'Locação do espaço maior', 'espaco', 'evento', 'De 400 a 500 pessoas. Entregue e devolvido limpo.', 'faixa',
       (valor ->> 'min')::bigint, (valor ->> 'max')::bigint, (select id from recursos where nome = 'Espaço maior'), 20
  from configuracoes where chave = 'espaco.maior.faixa_preco';
insert into catalogo_itens (nome, categoria, unidade, descricao, preco_tipo, preco_centavos, ordem)
select 'Garçom', 'equipe', 'evento', 'Até 4 horas de trabalho.', 'fixo', (valor #>> '{}')::bigint, 30
  from configuracoes where chave = 'terceirizado.garcom_valor';
insert into catalogo_itens (nome, categoria, unidade, descricao, preco_tipo, preco_centavos, ordem)
select 'Segurança', 'equipe', 'evento', 'Até 4 horas de trabalho.', 'fixo', (valor #>> '{}')::bigint, 40
  from configuracoes where chave = 'terceirizado.seguranca_valor';

alter table configuracoes disable trigger configuracoes_sem_delete;
delete from configuracoes where chave in ('espaco.menor.faixa_preco','espaco.maior.faixa_preco',
                                          'terceirizado.garcom_valor','terceirizado.seguranca_valor');
alter table configuracoes enable trigger configuracoes_sem_delete;

insert into configuracoes (chave, grupo, descricao, tipo, valor, ordem) values
  ('orcamento.validade_dias',          'Orçamentos', 'Validade padrão de um orçamento enviado',                     'dias', '7', 10),
  ('orcamento.desconto_teto_percentual','Orçamentos', 'Desconto que o atendimento pode dar sem aprovação',           'percentual', '5', 20),
  ('orcamento.retorno_dias',           'Orçamentos', 'Tarefa de retorno ao cliente, dias após o envio',             'dias', '2', 30);

----------------------------------------------------------------------- orçamentos
create type orcamento_status as enum ('rascunho','enviado','aprovado','perdido');
create type versao_status    as enum ('rascunho','enviada','aprovada','substituida');
create sequence orcamento_numero_seq;

create function cfg_int(p_chave text) returns integer
language sql stable security definer set search_path = public as $$
  select (valor #>> '{}')::integer from configuracoes where chave = p_chave
$$;

create table orcamentos (
  id           uuid primary key default gen_random_uuid(),
  numero       text not null unique default (
                 'ORC-' || to_char(now() at time zone 'America/Fortaleza', 'YYYY') || '-' ||
                 lpad(nextval('orcamento_numero_seq')::text, 4, '0')),
  cliente_id   uuid not null references clientes(id),
  titulo       text not null check (length(trim(titulo)) >= 3),
  tipo         text not null check (tipo in ('espaco','espaco_buffet','buffet_externo','outro')),
  data_evento  date,
  horario      text,
  convidados   integer check (convidados > 0),
  recurso_id   uuid references recursos(id),
  local_externo text,
  status       orcamento_status not null default 'rascunho',
  motivo_perda text,
  responsavel  uuid references usuarios(id) default usuario_atual(),
  criado_por   uuid default usuario_atual(),
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (status <> 'perdido' or length(trim(coalesce(motivo_perda, ''))) > 0)
);
create index ix_orcamentos_cliente on orcamentos (cliente_id);
create index ix_orcamentos_status on orcamentos (status, data_evento);

create table orcamento_versoes (
  id                 uuid primary key default gen_random_uuid(),
  orcamento_id       uuid not null references orcamentos(id),
  numero             integer not null,
  status             versao_status not null default 'rascunho',
  validade           date,
  condicoes          text,
  observacoes        text,
  subtotal_centavos  bigint not null default 0,
  desconto_centavos  bigint not null default 0 check (desconto_centavos >= 0),
  total_centavos     bigint generated always as (subtotal_centavos - desconto_centavos) stored,
  aprovacao_motivos  text[],
  aprovado_por       uuid references usuarios(id),
  aprovado_em        timestamptz,
  aprovacao_justificativa text,
  enviada_em         timestamptz,
  enviada_por        uuid references usuarios(id),
  snapshot           jsonb,
  conteudo_hash      text,
  aceita_em          timestamptz,
  aceite_registrado_por uuid references usuarios(id),
  criado_em          timestamptz not null default now(),
  unique (orcamento_id, numero),
  check (desconto_centavos <= subtotal_centavos)
);
create unique index uq_um_rascunho_por_orcamento on orcamento_versoes (orcamento_id) where status = 'rascunho';

create table orcamento_itens (
  id                      uuid primary key default gen_random_uuid(),
  versao_id               uuid not null references orcamento_versoes(id),
  ordem                   integer not null default 0,
  catalogo_item_id        uuid references catalogo_itens(id),
  descricao               text not null check (length(trim(descricao)) >= 2),
  unidade                 text not null,
  quantidade              numeric(12,2) not null check (quantidade > 0),
  preco_unitario_centavos bigint not null check (preco_unitario_centavos >= 0),
  total_centavos          bigint generated always as (round(quantidade * preco_unitario_centavos)::bigint) stored
);
create index ix_orcamento_itens_versao on orcamento_itens (versao_id, ordem);

create table orcamento_itens_custos (
  item_id                 uuid primary key references orcamento_itens(id) on delete cascade,
  custo_unitario_centavos bigint not null check (custo_unitario_centavos >= 0)
);

-- Versão enviada é imutável: só pode passar a aprovada (aceite do cliente) ou substituída (nova versão enviada).
create function trg_versao_imutavel() returns trigger
language plpgsql set search_path = public as $$
declare livres text[] := array['status','aceita_em','aceite_registrado_por'];
begin
  if tg_op = 'DELETE' then
    raise exception 'ORCAMENTO_IMUTAVEL: versões não são excluídas' using errcode = 'P0001';
  end if;
  if old.status = 'rascunho' then
    if new.status = 'rascunho' and (new.subtotal_centavos, new.desconto_centavos)
         is distinct from (old.subtotal_centavos, old.desconto_centavos) then
      -- valores mudaram: a aprovação dada antes não vale mais
      new.aprovado_por := null; new.aprovado_em := null;
      new.aprovacao_justificativa := null; new.aprovacao_motivos := null;
    end if;
    return new;
  end if;
  if (to_jsonb(new) - livres) <> (to_jsonb(old) - livres)
     or not ((old.status = 'enviada' and new.status in ('enviada','aprovada','substituida'))
          or (old.status = new.status)) then
    raise exception 'ORCAMENTO_IMUTAVEL: orçamento enviado não pode ser alterado; crie uma nova versão' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger versao_imutavel before update or delete on orcamento_versoes
  for each row execute function trg_versao_imutavel();

create function trg_item_so_em_rascunho() returns trigger
language plpgsql set search_path = public as $$
declare v_status versao_status;
begin
  select status into v_status from orcamento_versoes where id = coalesce(new.versao_id, old.versao_id);
  if v_status <> 'rascunho' then
    raise exception 'ORCAMENTO_IMUTAVEL: orçamento enviado não pode ser alterado; crie uma nova versão' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.versao_id <> old.versao_id then
    raise exception 'ORCAMENTO_IMUTAVEL: item não muda de versão' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
create trigger item_so_em_rascunho before insert or update or delete on orcamento_itens
  for each row execute function trg_item_so_em_rascunho();

create function trg_custo_so_em_rascunho() returns trigger
language plpgsql set search_path = public as $$
declare v_status versao_status;
begin
  select v.status into v_status from orcamento_itens i join orcamento_versoes v on v.id = i.versao_id
   where i.id = coalesce(new.item_id, old.item_id);
  if v_status is not null and v_status <> 'rascunho' then
    raise exception 'ORCAMENTO_IMUTAVEL: custo de orçamento enviado não muda' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
create trigger custo_so_em_rascunho before insert or update or delete on orcamento_itens_custos
  for each row execute function trg_custo_so_em_rascunho();

-- Subtotal sempre recalculado pelo banco; custo do catálogo copiado para o item (fica restrito).
create function trg_item_recalcula() returns trigger
language plpgsql security definer set search_path = public as $$
declare v uuid := coalesce(new.versao_id, old.versao_id);
begin
  update orcamento_versoes
     set subtotal_centavos = x.soma, desconto_centavos = least(desconto_centavos, x.soma)
    from (select coalesce(sum(total_centavos), 0)::bigint as soma from orcamento_itens where versao_id = v) x
   where id = v;
  if tg_op = 'INSERT' and new.catalogo_item_id is not null then
    insert into orcamento_itens_custos (item_id, custo_unitario_centavos)
    select new.id, custo_centavos from catalogo_custos where item_id = new.catalogo_item_id;
  end if;
  return null;
end $$;
create trigger item_recalcula after insert or update or delete on orcamento_itens
  for each row execute function trg_item_recalcula();

create trigger orcamentos_atualizado before update on orcamentos for each row execute function trg_atualizado_em();
create trigger aud_orcamentos after insert or update on orcamentos for each row execute function trg_auditar();
create trigger aud_orcamento_versoes after insert or update on orcamento_versoes for each row execute function trg_auditar();
create trigger orcamentos_sem_delete before delete on orcamentos for each row execute function trg_bloquear_alteracao();

-- Motivos que exigem aprovação de quem tem desconto.aprovar.
create function motivos_aprovacao(p_versao uuid) returns text[]
language plpgsql stable security definer set search_path = public as $$
declare v orcamento_versoes%rowtype; m text[] := '{}'; r record; teto int := coalesce(cfg_int('orcamento.desconto_teto_percentual'), 0);
begin
  select * into v from orcamento_versoes where id = p_versao;
  if v.desconto_centavos > 0 and v.desconto_centavos * 100 > v.subtotal_centavos * teto then
    m := m || format('Desconto de %s%% acima do limite de %s%%',
                     round(v.desconto_centavos * 100.0 / nullif(v.subtotal_centavos, 0), 1), teto);
  end if;
  for r in select i.descricao, i.preco_unitario_centavos, c.preco_tipo, c.preco_centavos, c.preco_min_centavos
             from orcamento_itens i join catalogo_itens c on c.id = i.catalogo_item_id
            where i.versao_id = p_versao loop
    if r.preco_tipo = 'faixa' and r.preco_unitario_centavos < r.preco_min_centavos then
      m := m || format('%s abaixo da faixa do catálogo', r.descricao);
    elsif r.preco_tipo = 'fixo' and r.preco_unitario_centavos < r.preco_centavos then
      m := m || format('%s abaixo do preço do catálogo', r.descricao);
    end if;
  end loop;
  return m;
end $$;

create function criar_orcamento(p_cliente uuid, p_titulo text, p_tipo text, p_data date default null,
  p_horario text default null, p_convidados integer default null, p_recurso uuid default null,
  p_local_externo text default null) returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  insert into orcamentos (cliente_id, titulo, tipo, data_evento, horario, convidados, recurso_id, local_externo)
  values (p_cliente, trim(p_titulo), p_tipo, p_data, nullif(trim(p_horario), ''), p_convidados, p_recurso, nullif(trim(p_local_externo), ''))
  returning id into v_id;
  insert into orcamento_versoes (orcamento_id, numero, condicoes)
  values (v_id, 1, format('%s%% na contratação e o restante até %s dias antes do evento, por Pix ou transferência.',
                          coalesce(cfg_int('financeiro.sinal_percentual'), 50), coalesce(cfg_int('financeiro.saldo_dias_antes'), 7)));
  return v_id;
end $$;

create function aprovar_condicoes(p_versao uuid, p_justificativa text) returns void
language plpgsql security definer set search_path = public as $$
declare m text[];
begin
  if not tem_permissao('desconto.aprovar') then
    raise exception 'SEM_PERMISSAO: só quem aprova descontos pode aprovar estas condições' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_justificativa, ''))) < 5 then
    raise exception 'JUSTIFICATIVA_OBRIGATORIA: explique o motivo da aprovação' using errcode = 'P0001';
  end if;
  if (select status from orcamento_versoes where id = p_versao) is distinct from 'rascunho' then
    raise exception 'ORCAMENTO_IMUTAVEL: só é possível aprovar uma versão em rascunho' using errcode = 'P0001';
  end if;
  m := motivos_aprovacao(p_versao);
  update orcamento_versoes
     set aprovado_por = usuario_atual(), aprovado_em = now(),
         aprovacao_justificativa = trim(p_justificativa), aprovacao_motivos = m
   where id = p_versao;
end $$;

----------------------------------------------------------------------- tarefas
create table tarefas (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null check (length(trim(titulo)) >= 3),
  descricao    text,
  vence_em     timestamptz,
  responsavel  uuid references usuarios(id) default usuario_atual(),
  cliente_id   uuid references clientes(id),
  orcamento_id uuid references orcamentos(id),
  concluida_em timestamptz,
  concluida_por uuid references usuarios(id),
  criado_por   uuid references usuarios(id) default usuario_atual(),
  criado_em    timestamptz not null default now()
);
create index ix_tarefas_abertas on tarefas (responsavel, vence_em) where concluida_em is null;
create trigger aud_tarefas after insert or update on tarefas for each row execute function trg_auditar();
create trigger tarefas_sem_delete before delete on tarefas for each row execute function trg_bloquear_alteracao();

create function enviar_versao(p_versao uuid, p_validade date default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v orcamento_versoes%rowtype; o orcamentos%rowtype; m text[]; s jsonb; n_itens int;
begin
  if not tem_permissao('orcamento.criar') then
    raise exception 'SEM_PERMISSAO: seu perfil não envia orçamentos' using errcode = '42501';
  end if;
  select * into v from orcamento_versoes where id = p_versao for update;
  if not found or v.status <> 'rascunho' then
    raise exception 'ORCAMENTO_IMUTAVEL: esta versão já foi enviada' using errcode = 'P0001';
  end if;
  select * into o from orcamentos where id = v.orcamento_id for update;
  if o.status in ('aprovado','perdido') then
    raise exception 'STATUS_INVALIDO: orçamento %', o.status using errcode = 'P0001';
  end if;
  select count(*) into n_itens from orcamento_itens where versao_id = p_versao;
  if n_itens = 0 or v.subtotal_centavos - v.desconto_centavos <= 0 then
    raise exception 'ORCAMENTO_VAZIO: inclua ao menos um item com valor' using errcode = 'P0001';
  end if;
  if v.desconto_centavos > 0 and not (tem_permissao('desconto.dar') or tem_permissao('desconto.aprovar')) then
    raise exception 'SEM_PERMISSAO: seu perfil não dá desconto' using errcode = '42501';
  end if;
  m := motivos_aprovacao(p_versao);
  if coalesce(array_length(m, 1), 0) > 0 and v.aprovado_por is null then
    raise exception 'APROVACAO_NECESSARIA: %', array_to_string(m, '; ') using errcode = 'P0001';
  end if;

  s := jsonb_build_object(
    'orcamento', jsonb_build_object('numero', o.numero, 'titulo', o.titulo, 'tipo', o.tipo, 'data_evento', o.data_evento,
                                    'horario', o.horario, 'convidados', o.convidados, 'local_externo', o.local_externo,
                                    'espaco', (select nome from recursos where id = o.recurso_id)),
    'versao', v.numero,
    'cliente', (select jsonb_build_object('tipo', tipo, 'nome', nome, 'nome_fantasia', nome_fantasia, 'documento', documento,
                                          'responsavel', responsavel_nome, 'telefone', telefone, 'email', email,
                                          'endereco', endereco, 'cidade', cidade, 'uf', uf)
                  from clientes where id = o.cliente_id),
    'empresa', (select jsonb_object_agg(replace(chave, 'empresa.', ''), valor #>> '{}') from configuracoes where chave like 'empresa.%'),
    'itens', (select coalesce(jsonb_agg(jsonb_build_object('descricao', descricao, 'unidade', unidade, 'quantidade', quantidade,
                                                           'preco_unitario_centavos', preco_unitario_centavos, 'total_centavos', total_centavos)
                                        order by ordem, descricao), '[]')
                from orcamento_itens where versao_id = p_versao),
    'subtotal_centavos', v.subtotal_centavos, 'desconto_centavos', v.desconto_centavos,
    'total_centavos', v.subtotal_centavos - v.desconto_centavos,
    'condicoes', v.condicoes, 'observacoes', v.observacoes,
    'validade', coalesce(p_validade, (now() at time zone 'America/Fortaleza')::date + coalesce(cfg_int('orcamento.validade_dias'), 7)),
    'enviada_em', now());

  update orcamento_versoes set status = 'substituida'
   where orcamento_id = o.id and status = 'enviada';
  update orcamento_versoes
     set status = 'enviada', enviada_em = now(), enviada_por = usuario_atual(), snapshot = s,
         validade = (s ->> 'validade')::date,
         conteudo_hash = encode(extensions.digest(s::text, 'sha256'), 'hex')
   where id = p_versao;
  update orcamentos set status = 'enviado' where id = o.id;

  insert into tarefas (titulo, vence_em, responsavel, cliente_id, orcamento_id, criado_por)
  values (format('Retornar ao cliente sobre o orçamento %s', o.numero),
          now() + make_interval(days => coalesce(cfg_int('orcamento.retorno_dias'), 2)),
          coalesce(o.responsavel, usuario_atual()), o.cliente_id, o.id, usuario_atual());
end $$;

create function nova_versao(p_orcamento uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_ult orcamento_versoes%rowtype; v_id uuid; r record; novo uuid;
begin
  if not tem_permissao('orcamento.criar') then
    raise exception 'SEM_PERMISSAO: seu perfil não edita orçamentos' using errcode = '42501';
  end if;
  if (select status from orcamentos where id = p_orcamento for update) in ('aprovado','perdido') then
    raise exception 'STATUS_INVALIDO: orçamento encerrado' using errcode = 'P0001';
  end if;
  select id into v_id from orcamento_versoes where orcamento_id = p_orcamento and status = 'rascunho';
  if found then return v_id; end if;
  select * into v_ult from orcamento_versoes where orcamento_id = p_orcamento order by numero desc limit 1;
  insert into orcamento_versoes (orcamento_id, numero, condicoes, observacoes, desconto_centavos)
  values (p_orcamento, v_ult.numero + 1, v_ult.condicoes, v_ult.observacoes, 0)
  returning id into v_id;
  for r in select i.*, c.custo_unitario_centavos from orcamento_itens i
             left join orcamento_itens_custos c on c.item_id = i.id
            where i.versao_id = v_ult.id order by i.ordem loop
    insert into orcamento_itens (versao_id, ordem, catalogo_item_id, descricao, unidade, quantidade, preco_unitario_centavos)
    values (v_id, r.ordem, r.catalogo_item_id, r.descricao, r.unidade, r.quantidade, r.preco_unitario_centavos)
    returning id into novo;
    if r.custo_unitario_centavos is not null then
      insert into orcamento_itens_custos (item_id, custo_unitario_centavos) values (novo, r.custo_unitario_centavos)
      on conflict (item_id) do update set custo_unitario_centavos = excluded.custo_unitario_centavos;
    end if;
  end loop;
  update orcamento_versoes set desconto_centavos = v_ult.desconto_centavos where id = v_id;
  return v_id;
end $$;

create function registrar_aceite(p_versao uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v orcamento_versoes%rowtype;
begin
  if not tem_permissao('orcamento.criar') then
    raise exception 'SEM_PERMISSAO: seu perfil não registra aceite' using errcode = '42501';
  end if;
  select * into v from orcamento_versoes where id = p_versao for update;
  if v.status <> 'enviada' then
    raise exception 'STATUS_INVALIDO: só a versão enviada mais recente pode ser aceita' using errcode = 'P0001';
  end if;
  if v.validade < (now() at time zone 'America/Fortaleza')::date then
    raise exception 'ORCAMENTO_VENCIDO: a validade terminou em %; envie uma nova versão', to_char(v.validade, 'DD/MM/YYYY') using errcode = 'P0001';
  end if;
  update orcamento_versoes set status = 'aprovada', aceita_em = now(), aceite_registrado_por = usuario_atual() where id = p_versao;
  update orcamentos set status = 'aprovado' where id = v.orcamento_id;
  update tarefas set concluida_em = now(), concluida_por = usuario_atual()
   where orcamento_id = v.orcamento_id and concluida_em is null and titulo like 'Retornar ao cliente%';
end $$;

create function marcar_perdido(p_orcamento uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('orcamento.criar') then
    raise exception 'SEM_PERMISSAO: seu perfil não altera orçamentos' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'JUSTIFICATIVA_OBRIGATORIA: informe o motivo da perda' using errcode = 'P0001';
  end if;
  update orcamentos set status = 'perdido', motivo_perda = trim(p_motivo)
   where id = p_orcamento and status in ('rascunho','enviado');
  if not found then raise exception 'STATUS_INVALIDO: orçamento já encerrado' using errcode = 'P0001'; end if;
  update tarefas set concluida_em = now(), concluida_por = usuario_atual()
   where orcamento_id = p_orcamento and concluida_em is null;
end $$;

----------------------------------------------------------------------- mesclagem de clientes
create function mesclar_clientes(p_origem uuid, p_destino uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o clientes%rowtype; d clientes%rowtype;
begin
  if not tem_permissao('cliente.mesclar') then
    raise exception 'SEM_PERMISSAO: seu perfil não mescla cadastros' using errcode = '42501';
  end if;
  if p_origem = p_destino then raise exception 'MESCLAGEM_INVALIDA: escolha dois cadastros diferentes' using errcode = 'P0001'; end if;
  select * into o from clientes where id = p_origem for update;
  select * into d from clientes where id = p_destino for update;
  if o.id is null or d.id is null or o.mesclado_em is not null or d.mesclado_em is not null then
    raise exception 'MESCLAGEM_INVALIDA: cadastro inexistente ou já mesclado' using errcode = 'P0001';
  end if;
  if o.tipo <> d.tipo then
    raise exception 'MESCLAGEM_INVALIDA: não é possível mesclar pessoa física com jurídica' using errcode = 'P0001';
  end if;
  if o.documento is not null and d.documento is not null and o.documento <> d.documento then
    raise exception 'MESCLAGEM_INVALIDA: os cadastros têm documentos diferentes' using errcode = 'P0001';
  end if;
  update clientes set documento = null where id = p_origem;
  update clientes set
    documento = coalesce(d.documento, o.documento), nome_fantasia = coalesce(d.nome_fantasia, o.nome_fantasia),
    responsavel_nome = coalesce(d.responsavel_nome, o.responsavel_nome), telefone = coalesce(d.telefone, o.telefone),
    email = coalesce(d.email, o.email), endereco = coalesce(d.endereco, o.endereco), cidade = coalesce(d.cidade, o.cidade),
    uf = coalesce(d.uf, o.uf), origem = coalesce(d.origem, o.origem),
    observacoes = nullif(concat_ws(E'\n', d.observacoes, o.observacoes), '')
  where id = p_destino;
  update orcamentos set cliente_id = p_destino where cliente_id = p_origem;
  update tarefas set cliente_id = p_destino where cliente_id = p_origem;
  update reservas set cliente_id = p_destino where cliente_id = p_origem;
  update clientes set ativo = false, mesclado_em = p_destino where id = p_origem;
end $$;

----------------------------------------------------------------------- políticas de acesso
alter table catalogo_itens         enable row level security;
alter table catalogo_precos        enable row level security;
alter table catalogo_custos        enable row level security;
alter table orcamentos             enable row level security;
alter table orcamento_versoes      enable row level security;
alter table orcamento_itens        enable row level security;
alter table orcamento_itens_custos enable row level security;
alter table tarefas                enable row level security;

create policy catalogo_ler   on catalogo_itens for select using (usuario_atual() is not null);
create policy catalogo_criar on catalogo_itens for insert with check (tem_permissao('catalogo.alterar'));
create policy catalogo_editar on catalogo_itens for update using (tem_permissao('catalogo.alterar')) with check (tem_permissao('catalogo.alterar'));
create policy precos_ler     on catalogo_precos for select using (usuario_atual() is not null);
create policy custos_ler     on catalogo_custos for select using (tem_permissao('custo.ver'));
create policy custos_gravar  on catalogo_custos for all
  using (tem_permissao('custo.ver') and tem_permissao('catalogo.alterar'))
  with check (tem_permissao('custo.ver') and tem_permissao('catalogo.alterar'));

create policy orcamentos_ler    on orcamentos for select using (tem_permissao('orcamento.ver'));
create policy orcamentos_editar on orcamentos for update
  using (tem_permissao('orcamento.criar') and status in ('rascunho','enviado'))
  with check (tem_permissao('orcamento.criar'));
create policy orcamentos_criar  on orcamentos for insert with check (tem_permissao('orcamento.criar'));
create policy versoes_ler       on orcamento_versoes for select using (tem_permissao('orcamento.ver'));
create policy versoes_criar     on orcamento_versoes for insert with check (tem_permissao('orcamento.criar'));
create policy versoes_editar    on orcamento_versoes for update
  using (tem_permissao('orcamento.criar') and status = 'rascunho')
  with check (tem_permissao('orcamento.criar') and status = 'rascunho'
              and (desconto_centavos = 0 or tem_permissao('desconto.dar') or tem_permissao('desconto.aprovar')));
create policy itens_ler         on orcamento_itens for select using (tem_permissao('orcamento.ver'));
create policy itens_gravar      on orcamento_itens for all
  using (tem_permissao('orcamento.criar')) with check (tem_permissao('orcamento.criar'));
create policy itens_custos_ler  on orcamento_itens_custos for select using (tem_permissao('custo.ver'));
create policy itens_custos_gravar on orcamento_itens_custos for all
  using (tem_permissao('custo.ver') and tem_permissao('orcamento.criar'))
  with check (tem_permissao('custo.ver') and tem_permissao('orcamento.criar'));

create policy tarefas_ler on tarefas for select
  using (responsavel = usuario_atual() or criado_por = usuario_atual() or tem_permissao('orcamento.ver'));
create policy tarefas_criar on tarefas for insert
  with check (usuario_atual() is not null and (tem_permissao('orcamento.criar') or tem_permissao('cliente.editar')));
create policy tarefas_editar on tarefas for update
  using (responsavel = usuario_atual() or criado_por = usuario_atual() or tem_permissao('orcamento.criar'))
  with check (usuario_atual() is not null);

----------------------------------------------------------------------- privilégios
grant select, insert, update on catalogo_itens, orcamentos, orcamento_versoes, tarefas to delta_app;
grant select on catalogo_precos to delta_app;
grant select, insert, update, delete on catalogo_custos, orcamento_itens, orcamento_itens_custos to delta_app;
grant select on recursos to delta_app;
revoke all on catalogo_itens, catalogo_precos, catalogo_custos, orcamentos, orcamento_versoes, orcamento_itens,
  orcamento_itens_custos, tarefas from anon, authenticated;
grant execute on function buscar_duplicados(text, text, text, uuid), criar_orcamento(uuid, text, text, date, text, integer, uuid, text),
  aprovar_condicoes(uuid, text), enviar_versao(uuid, date), nova_versao(uuid), registrar_aceite(uuid), marcar_perdido(uuid, text),
  mesclar_clientes(uuid, uuid), motivos_aprovacao(uuid), valida_cpf(text), valida_cnpj(text), normaliza_texto(text) to delta_app;
grant usage on sequence orcamento_numero_seq to delta_app;
grant execute on function cfg_int(text) to delta_app;
revoke execute on function trg_historico_preco(), trg_item_recalcula(), trg_versao_imutavel(),
  trg_item_so_em_rascunho(), trg_custo_so_em_rascunho(), trg_atualizado_em() from public, anon, authenticated;
