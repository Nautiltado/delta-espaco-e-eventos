-- Fase 7 (1ª parte): ficha do evento, equipe (diaristas do Kaká), checklist, gastos com nota fiscal e fechamento.

insert into configuracoes (chave, grupo, descricao, tipo, valor, ordem) values
  ('operacao.equipe_responsavel', 'Operação', 'Quem fornece a equipe de garçons e ajudantes', 'texto', '"Kaká"', 10),
  ('operacao.equipe_telefone', 'Operação', 'WhatsApp de quem fornece a equipe (com DDD)', 'texto_opcional', '""', 20),
  ('operacao.diaria_garcom', 'Operação', 'Diária do garçom por evento', 'centavos', '18000', 30),
  ('operacao.diaria_seguranca', 'Operação', 'Diária do segurança por evento', 'centavos', '18000', 40)
on conflict (chave) do nothing;

create function pode_ver_eventos() returns boolean language sql stable security definer set search_path = public as $$
  select tem_permissao('orcamento.ver') or tem_permissao('escala.gerir') or tem_permissao('evento.fechar')
      or tem_permissao('producao.status') or tem_permissao('custo.ver')
$$;
create function pode_ver_gastos() returns boolean language sql stable security definer set search_path = public as $$
  select tem_permissao('evento.fechar') or tem_permissao('custo.ver')
$$;
revoke all on function pode_ver_eventos() from public, anon;
revoke all on function pode_ver_gastos() from public, anon;
grant execute on function pode_ver_eventos() to delta_app, authenticated;
grant execute on function pode_ver_gastos() to delta_app, authenticated;

-- ---------------------------------------------------------------- tabelas
create table evento_fichas (
  reserva_id uuid primary key references reservas(id),
  chegada_equipe time,
  traje text check (traje is null or length(traje) <= 120),
  observacoes text check (observacoes is null or length(observacoes) <= 2000),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references usuarios(id) default usuario_atual()
);

create table evento_equipe (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references reservas(id),
  funcao text not null check (funcao in ('garcom', 'seguranca', 'cozinha', 'recepcao', 'limpeza', 'outro')),
  quantidade integer not null check (quantidade between 1 and 50),
  valor_unitario_centavos bigint not null check (valor_unitario_centavos >= 0),
  fornecedor text check (fornecedor is null or length(fornecedor) <= 80),
  observacao text check (observacao is null or length(observacao) <= 300),
  pago_em date,
  criado_por uuid references usuarios(id) default usuario_atual(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index on evento_equipe (reserva_id);

create table evento_checklist (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references reservas(id),
  etapa text not null check (etapa in ('montagem', 'conferencia', 'desmontagem')),
  item text not null check (length(item) between 2 and 160),
  ordem integer not null default 0,
  feito_por uuid references usuarios(id),
  feito_em timestamptz
);
create index on evento_checklist (reserva_id);

create table evento_custos (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references reservas(id),
  categoria text not null check (categoria in ('compras', 'bebidas', 'gas', 'aluguel', 'transporte', 'decoracao', 'outros')),
  descricao text not null check (length(descricao) between 2 and 200),
  fornecedor text check (fornecedor is null or length(fornecedor) <= 120),
  valor_centavos bigint not null check (valor_centavos > 0),
  data date not null,
  pago boolean not null default true,
  criado_por uuid references usuarios(id) default usuario_atual(),
  criado_em timestamptz not null default now(),
  removido_em timestamptz,
  removido_por uuid references usuarios(id),
  removido_motivo text
);
create index on evento_custos (reserva_id);

create table evento_notas (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references reservas(id),
  custo_id uuid references evento_custos(id),
  caminho text not null unique,
  nome_arquivo text not null check (length(nome_arquivo) between 1 and 200),
  tipo text not null,
  tamanho integer not null check (tamanho > 0),
  enviado_por uuid references usuarios(id) default usuario_atual(),
  enviado_em timestamptz not null default now(),
  removido_em timestamptz,
  removido_por uuid references usuarios(id),
  removido_motivo text
);
create index on evento_notas (reserva_id);
create index on evento_notas (custo_id);

alter table evento_fichas enable row level security;
alter table evento_equipe enable row level security;
alter table evento_checklist enable row level security;
alter table evento_custos enable row level security;
alter table evento_notas enable row level security;
create policy ler on evento_fichas for select using (pode_ver_eventos());
create policy ler on evento_equipe for select using (pode_ver_eventos());
create policy ler on evento_checklist for select using (pode_ver_eventos());
create policy ler on evento_custos for select using (pode_ver_gastos());
create policy ler on evento_notas for select using (pode_ver_gastos());
grant select on evento_fichas, evento_equipe, evento_checklist, evento_custos, evento_notas to delta_app;

create trigger aud_evento_fichas after insert or update on evento_fichas for each row execute function trg_auditar();
create trigger aud_evento_equipe after insert or update or delete on evento_equipe for each row execute function trg_auditar();
create trigger aud_evento_checklist after insert or update or delete on evento_checklist for each row execute function trg_auditar();
create trigger aud_evento_custos after insert or update on evento_custos for each row execute function trg_auditar();
create trigger aud_evento_notas after insert or update on evento_notas for each row execute function trg_auditar();
create trigger evento_custos_sem_delete before delete on evento_custos for each row execute function trg_bloquear_alteracao();
create trigger evento_notas_sem_delete before delete on evento_notas for each row execute function trg_bloquear_alteracao();

-- Notas fiscais: bucket privado, só quem cuida dos gastos envia e abre.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('notas', 'notas', false, 10485760,
        array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'])
on conflict (id) do nothing;
create policy notas_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'notas' and public.tem_permissao('evento.fechar'));
create policy notas_ler on storage.objects for select to authenticated
  using (bucket_id = 'notas' and public.pode_ver_gastos());

-- ---------------------------------------------------------------- funções
create function evento_existente(p_reserva uuid) returns reservas
language plpgsql stable security definer set search_path = public as $$
declare r reservas%rowtype;
begin
  select * into r from reservas where id = p_reserva and tipo = 'evento';
  if not found then raise exception 'STATUS_INVALIDO: evento não encontrado' using errcode = 'P0001'; end if;
  return r;
end $$;

-- Tudo o que a equipe precisa no dia, sem preços (a cozinha também vê).
create function ficha_evento(p_reserva uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r reservas%rowtype; o orcamentos%rowtype; v_id uuid; res jsonb;
begin
  if not pode_ver_eventos() then
    raise exception 'SEM_PERMISSAO: seu perfil não vê os eventos' using errcode = '42501';
  end if;
  r := evento_existente(p_reserva);
  select * into o from orcamentos where id = r.orcamento_id;
  select id into v_id from orcamento_versoes where orcamento_id = r.orcamento_id and status = 'aprovada' limit 1;
  select jsonb_build_object(
    'id', r.id, 'titulo', r.titulo, 'status', r.status, 'inicio', r.evento_inicio, 'fim', r.evento_fim,
    'valor_total_centavos', case when pode_ver_gastos() or tem_permissao('pagamento.confirmar') then r.valor_total_centavos end,
    'cliente', (select jsonb_build_object('nome', c.nome, 'telefone', c.telefone) from clientes c where c.id = r.cliente_id),
    'orcamento', case when o.id is null then null else jsonb_build_object('id', o.id, 'numero', o.numero, 'tipo', o.tipo,
                   'convidados', o.convidados, 'horario', o.horario, 'local_externo', o.local_externo) end,
    'espacos', coalesce((select jsonb_agg(distinct rc.nome) from reserva_periodos p join recursos rc on rc.id = p.recurso_id
                          where p.reserva_id = r.id and p.ativo), '[]'),
    'itens', coalesce((select jsonb_agg(jsonb_build_object('descricao', i.descricao, 'quantidade', i.quantidade, 'unidade', i.unidade) order by i.ordem)
                         from orcamento_itens i where i.versao_id = v_id), '[]')
  ) into res;
  return res;
end $$;

create function salvar_ficha_evento(p_reserva uuid, p_chegada time, p_traje text, p_observacoes text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (tem_permissao('escala.gerir') or tem_permissao('orcamento.criar')) then
    raise exception 'SEM_PERMISSAO: seu perfil não altera a ficha do evento' using errcode = '42501';
  end if;
  perform evento_existente(p_reserva);
  insert into evento_fichas (reserva_id, chegada_equipe, traje, observacoes)
  values (p_reserva, p_chegada, nullif(trim(p_traje), ''), nullif(trim(p_observacoes), ''))
  on conflict (reserva_id) do update set chegada_equipe = excluded.chegada_equipe, traje = excluded.traje,
     observacoes = excluded.observacoes, atualizado_em = now(), atualizado_por = usuario_atual();
end $$;

create function adicionar_equipe(p_reserva uuid, p_funcao text, p_quantidade integer, p_valor bigint, p_fornecedor text, p_observacao text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not tem_permissao('escala.gerir') then
    raise exception 'SEM_PERMISSAO: seu perfil não monta a equipe' using errcode = '42501';
  end if;
  perform evento_existente(p_reserva);
  if p_quantidade is null or p_quantidade not between 1 and 50 then
    raise exception 'VALOR_INVALIDO: quantidade de pessoas inválida' using errcode = 'P0001';
  end if;
  if p_valor is null or p_valor < 0 then
    raise exception 'VALOR_INVALIDO: valor da diária inválido' using errcode = 'P0001';
  end if;
  insert into evento_equipe (reserva_id, funcao, quantidade, valor_unitario_centavos, fornecedor, observacao)
  values (p_reserva, p_funcao, p_quantidade, p_valor, nullif(trim(p_fornecedor), ''), nullif(trim(p_observacao), ''))
  returning id into v;
  return v;
end $$;

create function remover_equipe(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('escala.gerir') then
    raise exception 'SEM_PERMISSAO: seu perfil não monta a equipe' using errcode = '42501';
  end if;
  if exists (select 1 from evento_equipe where id = p_id and pago_em is not null) then
    raise exception 'STATUS_INVALIDO: essa equipe já foi paga; desmarque o pagamento antes' using errcode = 'P0001';
  end if;
  delete from evento_equipe where id = p_id;
end $$;

create function pagar_equipe(p_id uuid, p_pago_em date) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (tem_permissao('escala.gerir') or tem_permissao('evento.fechar')) then
    raise exception 'SEM_PERMISSAO: seu perfil não registra o pagamento da equipe' using errcode = '42501';
  end if;
  update evento_equipe set pago_em = p_pago_em, atualizado_em = now() where id = p_id;
  if not found then raise exception 'STATUS_INVALIDO: linha da equipe não encontrada' using errcode = 'P0001'; end if;
end $$;

-- Lista padrão, criada na primeira vez que o evento é aberto.
create function preparar_checklist(p_reserva uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not pode_ver_eventos() then
    raise exception 'SEM_PERMISSAO: seu perfil não vê os eventos' using errcode = '42501';
  end if;
  perform evento_existente(p_reserva);
  if exists (select 1 from evento_checklist where reserva_id = p_reserva) then return; end if;
  insert into evento_checklist (reserva_id, etapa, item, ordem)
  select p_reserva, e, i, o from (values
    ('montagem', 'Mesas e cadeiras arrumadas', 10),
    ('montagem', 'Toalhas e decoração no lugar', 20),
    ('montagem', 'Som e iluminação testados', 30),
    ('montagem', 'Banheiros limpos e abastecidos', 40),
    ('montagem', 'Louças, talheres e buffet separados', 50),
    ('montagem', 'Bebidas gelando', 60),
    ('conferencia', 'Comida conferida com o cardápio', 10),
    ('conferencia', 'Equipe completa e uniformizada', 20),
    ('conferencia', 'Ar-condicionado ligado', 30),
    ('conferencia', 'Entrada e estacionamento livres', 40),
    ('desmontagem', 'Louças recolhidas e contadas', 10),
    ('desmontagem', 'Sobras guardadas ou entregues ao cliente', 20),
    ('desmontagem', 'Lixo retirado', 30),
    ('desmontagem', 'Espaço limpo', 40),
    ('desmontagem', 'Luzes, ar e gás desligados', 50),
    ('desmontagem', 'Portas trancadas', 60)
  ) v(e, i, o);
end $$;

create function marcar_checklist(p_item uuid, p_feito boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not pode_ver_eventos() then
    raise exception 'SEM_PERMISSAO: seu perfil não vê os eventos' using errcode = '42501';
  end if;
  update evento_checklist
     set feito_em = case when p_feito then now() end, feito_por = case when p_feito then usuario_atual() end
   where id = p_item;
  if not found then raise exception 'STATUS_INVALIDO: item não encontrado' using errcode = 'P0001'; end if;
end $$;

create function adicionar_item_checklist(p_reserva uuid, p_etapa text, p_item text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not pode_ver_eventos() then
    raise exception 'SEM_PERMISSAO: seu perfil não vê os eventos' using errcode = '42501';
  end if;
  perform evento_existente(p_reserva);
  if length(trim(coalesce(p_item, ''))) < 2 then
    raise exception 'VALOR_INVALIDO: escreva o item' using errcode = 'P0001';
  end if;
  insert into evento_checklist (reserva_id, etapa, item, ordem)
  values (p_reserva, p_etapa, trim(p_item),
          coalesce((select max(ordem) from evento_checklist where reserva_id = p_reserva and etapa = p_etapa), 0) + 10);
end $$;

create function remover_item_checklist(p_item uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('escala.gerir') then
    raise exception 'SEM_PERMISSAO: seu perfil não muda a lista' using errcode = '42501';
  end if;
  delete from evento_checklist where id = p_item;
end $$;

create function registrar_custo_evento(p_reserva uuid, p_categoria text, p_descricao text, p_fornecedor text,
  p_valor bigint, p_data date, p_pago boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not tem_permissao('evento.fechar') then
    raise exception 'SEM_PERMISSAO: seu perfil não lança gastos' using errcode = '42501';
  end if;
  perform evento_existente(p_reserva);
  if p_valor is null or p_valor <= 0 then
    raise exception 'VALOR_INVALIDO: valor do gasto inválido' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_descricao, ''))) < 2 then
    raise exception 'VALOR_INVALIDO: diga o que foi comprado' using errcode = 'P0001';
  end if;
  insert into evento_custos (reserva_id, categoria, descricao, fornecedor, valor_centavos, data, pago)
  values (p_reserva, p_categoria, trim(p_descricao), nullif(trim(p_fornecedor), ''), p_valor, coalesce(p_data, current_date), coalesce(p_pago, true))
  returning id into v;
  return v;
end $$;

create function marcar_custo_pago(p_custo uuid, p_pago boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('evento.fechar') then
    raise exception 'SEM_PERMISSAO: seu perfil não lança gastos' using errcode = '42501';
  end if;
  update evento_custos set pago = p_pago where id = p_custo and removido_em is null;
  if not found then raise exception 'STATUS_INVALIDO: gasto não encontrado' using errcode = 'P0001'; end if;
end $$;

create function remover_custo_evento(p_custo uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('evento.fechar') then
    raise exception 'SEM_PERMISSAO: seu perfil não lança gastos' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'JUSTIFICATIVA_OBRIGATORIA: diga por que o gasto sai' using errcode = 'P0001';
  end if;
  update evento_custos set removido_em = now(), removido_por = usuario_atual(), removido_motivo = trim(p_motivo)
   where id = p_custo and removido_em is null;
  if not found then raise exception 'STATUS_INVALIDO: gasto não encontrado' using errcode = 'P0001'; end if;
end $$;

create function registrar_nota(p_reserva uuid, p_custo uuid, p_caminho text, p_nome text, p_tipo text, p_tamanho integer) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if not tem_permissao('evento.fechar') then
    raise exception 'SEM_PERMISSAO: seu perfil não anexa notas' using errcode = '42501';
  end if;
  perform evento_existente(p_reserva);
  if p_caminho is null or split_part(p_caminho, '/', 1) <> p_reserva::text
     or not exists (select 1 from storage.objects where bucket_id = 'notas' and name = p_caminho) then
    raise exception 'STATUS_INVALIDO: arquivo não encontrado; envie de novo' using errcode = 'P0001';
  end if;
  if p_custo is not null and not exists (select 1 from evento_custos where id = p_custo and reserva_id = p_reserva and removido_em is null) then
    raise exception 'STATUS_INVALIDO: o gasto escolhido não é deste evento' using errcode = 'P0001';
  end if;
  insert into evento_notas (reserva_id, custo_id, caminho, nome_arquivo, tipo, tamanho)
  values (p_reserva, p_custo, p_caminho, left(trim(p_nome), 200), p_tipo, p_tamanho)
  returning id into v;
  return v;
end $$;

create function remover_nota(p_nota uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('evento.fechar') then
    raise exception 'SEM_PERMISSAO: seu perfil não anexa notas' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'JUSTIFICATIVA_OBRIGATORIA: diga por que a nota sai da lista' using errcode = 'P0001';
  end if;
  update evento_notas set removido_em = now(), removido_por = usuario_atual(), removido_motivo = trim(p_motivo)
   where id = p_nota and removido_em is null;
  if not found then raise exception 'STATUS_INVALIDO: nota não encontrada' using errcode = 'P0001'; end if;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'evento_existente(uuid)', 'ficha_evento(uuid)', 'salvar_ficha_evento(uuid, time, text, text)',
    'adicionar_equipe(uuid, text, integer, bigint, text, text)', 'remover_equipe(uuid)', 'pagar_equipe(uuid, date)',
    'preparar_checklist(uuid)', 'marcar_checklist(uuid, boolean)', 'adicionar_item_checklist(uuid, text, text)',
    'remover_item_checklist(uuid)', 'registrar_custo_evento(uuid, text, text, text, bigint, date, boolean)',
    'marcar_custo_pago(uuid, boolean)', 'remover_custo_evento(uuid, text)',
    'registrar_nota(uuid, uuid, text, text, text, integer)', 'remover_nota(uuid, text)']
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    if f <> 'evento_existente(uuid)' then execute format('grant execute on function %s to delta_app', f); end if;
  end loop;
end $$;
