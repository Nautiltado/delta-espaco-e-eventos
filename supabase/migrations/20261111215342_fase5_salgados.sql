-- Fase 5: encomendas de salgados (pagas na hora, só retirada), estoque de salgados prontos e painel da cozinha.
-- A cozinha produz para estoque e repõe quando chega no mínimo; cada pedido entregue desconta do estoque.

-- ---------------------------------------------------------------- estoque de salgados prontos
create table estoque_itens (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(trim(nome)) >= 2),
  minimo integer not null default 100 check (minimo >= 0),
  ativo boolean not null default true,
  ordem integer not null default 0,
  atualizado_em timestamptz not null default now()
);

create table estoque_movimentos (
  id bigint generated always as identity primary key,
  estoque_item_id uuid not null references estoque_itens(id),
  tipo text not null check (tipo in ('producao', 'pedido', 'ajuste', 'perda', 'evento')),
  quantidade integer not null check (quantidade <> 0),   -- em unidades; saída é negativa
  pedido_id uuid,
  observacao text check (observacao is null or length(observacao) <= 200),
  criado_por uuid references usuarios(id) default usuario_atual(),
  criado_em timestamptz not null default now()
);
create index on estoque_movimentos (estoque_item_id, criado_em desc);
create trigger estoque_movimentos_imutavel before update or delete on estoque_movimentos for each row execute function trg_bloquear_alteracao();

-- ---------------------------------------------------------------- cardápio de encomendas (o do InstaDelivery)
create table cardapio_encomenda (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(trim(nome)) >= 2),
  grupo text not null,
  descricao text,
  preco_centavos bigint not null check (preco_centavos > 0),
  -- quantas unidades de salgado cada venda tira do estoque (cento = 100, meio cento = 50)
  unidades integer not null default 1 check (unidades > 0),
  -- salgado do estoque que este produto consome; nulo = sortido (a composição vem no pedido) ou feito sob encomenda
  estoque_item_id uuid references estoque_itens(id),
  sortido boolean not null default false,
  so_encomenda boolean not null default false,          -- precisa de antecedência (sanduíches, panquecas)
  ativo boolean not null default true,
  ordem integer not null default 0,
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------- pedidos
create type pedido_status as enum ('aguardando_pagamento', 'pago', 'pronto', 'entregue', 'cancelado');
create sequence pedido_numero_seq;

create table pedidos (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique default (
    'PED-' || to_char(now() at time zone 'America/Fortaleza', 'YYYY') || '-' || lpad(nextval('pedido_numero_seq')::text, 4, '0')),
  cliente_nome text not null check (length(trim(cliente_nome)) >= 2),
  cliente_telefone text check (cliente_telefone is null or cliente_telefone ~ '^[0-9]{10,11}$'),
  cliente_id uuid references clientes(id),
  canal text not null default 'balcao' check (canal in ('balcao', 'whatsapp', 'instadelivery', 'telefone', 'outro')),
  retirada_em timestamptz not null,
  status pedido_status not null default 'aguardando_pagamento',
  total_centavos bigint not null default 0 check (total_centavos >= 0),
  observacao text check (observacao is null or length(observacao) <= 500),
  criado_por uuid references usuarios(id) default usuario_atual(),
  criado_em timestamptz not null default now(),
  pago_em timestamptz,
  pronto_em timestamptz,
  entregue_em timestamptz,
  entregue_por uuid references usuarios(id),
  cancelado_em timestamptz,
  cancelado_motivo text
);
create index on pedidos (retirada_em);
create index on pedidos (status);
create trigger pedidos_sem_delete before delete on pedidos for each row execute function trg_bloquear_alteracao();

create table pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id),
  produto_id uuid references cardapio_encomenda(id),
  descricao text not null,
  quantidade integer not null check (quantidade > 0),
  preco_unitario_centavos bigint not null check (preco_unitario_centavos >= 0),
  total_centavos bigint generated always as (quantidade * preco_unitario_centavos) stored,
  -- sortido: [{"estoque_item_id": "...", "unidades": 25}, ...] por unidade vendida
  composicao jsonb
);
create index on pedido_itens (pedido_id);
create trigger pedido_itens_sem_delete before update or delete on pedido_itens for each row execute function trg_bloquear_alteracao();

create table pedido_pagamentos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id),
  valor_centavos bigint not null check (valor_centavos > 0),
  forma text not null check (forma in ('pix', 'dinheiro', 'debito', 'credito', 'transferencia', 'outra')),
  id_externo text,
  recebido_em date not null,
  registrado_por uuid references usuarios(id) default usuario_atual(),
  criado_em timestamptz not null default now()
);
create unique index on pedido_pagamentos (forma, id_externo) where id_externo is not null;
create trigger pedido_pagamentos_imutavel before update or delete on pedido_pagamentos for each row execute function trg_bloquear_alteracao();

-- Quais sabores entram em cada sortido (fritura × forno)
alter table estoque_itens add column grupo text not null default 'fritura' check (grupo in ('fritura', 'forno'));
alter table cardapio_encomenda add column sortido_grupo text check (sortido_grupo in ('fritura', 'forno'));

-- ---------------------------------------------------------------- leitura (RLS) e auditoria
alter table estoque_itens enable row level security;
alter table estoque_movimentos enable row level security;
alter table cardapio_encomenda enable row level security;
alter table pedidos enable row level security;
alter table pedido_itens enable row level security;
alter table pedido_pagamentos enable row level security;

create function pode_ver_salgados() returns boolean language sql stable security definer set search_path = public as $$
  select tem_permissao('salgados.criar') or tem_permissao('producao.status') or tem_permissao('retirada.registrar')
      or tem_permissao('estoque.movimentar') or tem_permissao('pagamento.confirmar')
$$;
revoke all on function pode_ver_salgados() from public, anon, authenticated;
grant execute on function pode_ver_salgados() to delta_app;

create policy ler on estoque_itens for select using (pode_ver_salgados());
create policy ler on estoque_movimentos for select using (pode_ver_salgados());
create policy ler on cardapio_encomenda for select using (pode_ver_salgados());
create policy ler on pedidos for select using (pode_ver_salgados());
create policy ler on pedido_itens for select using (pode_ver_salgados());
create policy ler on pedido_pagamentos for select using (pode_ver_salgados());
grant select on estoque_itens, estoque_movimentos, cardapio_encomenda, pedidos, pedido_itens, pedido_pagamentos to delta_app;

create trigger aud_estoque_itens after insert or update on estoque_itens for each row execute function trg_auditar();
create trigger aud_cardapio_encomenda after insert or update on cardapio_encomenda for each row execute function trg_auditar();
create trigger aud_pedidos after insert or update on pedidos for each row execute function trg_auditar();
create trigger aud_pedido_pagamentos after insert on pedido_pagamentos for each row execute function trg_auditar();

-- saldo = soma dos movimentos; reservado = o que já está em pedidos pagos e ainda não entregues
create view estoque_saldo with (security_invoker = true) as
with reservado as (
  select (c->>'estoque_item_id')::uuid as estoque_item_id, sum((c->>'unidades')::int * i.quantidade) as unidades
    from pedido_itens i join pedidos p on p.id = i.pedido_id
    cross join lateral jsonb_array_elements(coalesce(i.composicao, '[]')) c
   where p.status in ('pago', 'pronto')
   group by 1
)
select e.id, e.nome, e.grupo, e.minimo, e.ativo, e.ordem,
       coalesce((select sum(m.quantidade) from estoque_movimentos m where m.estoque_item_id = e.id), 0)::int as saldo,
       coalesce((select unidades from reservado r where r.estoque_item_id = e.id), 0)::int as reservado
  from estoque_itens e;
grant select on estoque_saldo to delta_app;

-- ---------------------------------------------------------------- funções (todas as escritas passam por aqui)

/** Composição de um item: produto simples consome o próprio salgado; sortido usa a escolha do pedido. */
create function composicao_do_item(p_produto cardapio_encomenda, p_escolha uuid[]) returns jsonb
language plpgsql immutable as $$
declare n int; base int; resto int; r jsonb := '[]'; i int;
begin
  if p_produto.estoque_item_id is not null then
    return jsonb_build_array(jsonb_build_object('estoque_item_id', p_produto.estoque_item_id, 'unidades', p_produto.unidades));
  end if;
  if not p_produto.sortido or p_escolha is null or array_length(p_escolha, 1) is null then
    return null;
  end if;
  n := array_length(p_escolha, 1);
  base := p_produto.unidades / n;
  resto := p_produto.unidades - base * n;
  for i in 1..n loop
    r := r || jsonb_build_object('estoque_item_id', p_escolha[i], 'unidades', base + case when i <= resto then 1 else 0 end);
  end loop;
  return r;
end $$;

-- p_itens: [{"produto_id": "...", "quantidade": 2, "sortido": ["estoque_item_id", ...]}]
create function criar_pedido(p_nome text, p_telefone text, p_canal text, p_retirada timestamptz, p_observacao text, p_itens jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; x jsonb; prod cardapio_encomenda; q int; escolha uuid[]; total bigint := 0;
begin
  if not tem_permissao('salgados.criar') then
    raise exception 'SEM_PERMISSAO: seu perfil não registra pedidos' using errcode = '42501';
  end if;
  if p_retirada is null or p_retirada < now() - interval '30 minutes' then
    raise exception 'HORARIO_INVALIDO: a retirada não pode ser no passado' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'ORCAMENTO_VAZIO: inclua ao menos um item no pedido' using errcode = 'P0001';
  end if;
  insert into pedidos (cliente_nome, cliente_telefone, canal, retirada_em, observacao)
  values (trim(p_nome), nullif(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'), ''), coalesce(p_canal, 'balcao'), p_retirada, nullif(trim(p_observacao), ''))
  returning id into v_id;
  for x in select * from jsonb_array_elements(p_itens) loop
    select * into prod from cardapio_encomenda where id = (x->>'produto_id')::uuid and ativo;
    if not found then raise exception 'STATUS_INVALIDO: produto fora do cardápio' using errcode = 'P0001'; end if;
    q := (x->>'quantidade')::int;
    if q is null or q <= 0 or q > 1000 then raise exception 'VALOR_INVALIDO: quantidade inválida' using errcode = 'P0001'; end if;
    escolha := array(select (jsonb_array_elements_text(coalesce(x->'sortido', '[]'))::uuid));
    if exists (select 1 from unnest(escolha) e where not exists (select 1 from estoque_itens where id = e and ativo)) then
      raise exception 'STATUS_INVALIDO: sabor do sortido inválido' using errcode = 'P0001';
    end if;
    insert into pedido_itens (pedido_id, produto_id, descricao, quantidade, preco_unitario_centavos, composicao)
    values (v_id, prod.id, prod.nome, q, prod.preco_centavos, composicao_do_item(prod, escolha));
    total := total + q * prod.preco_centavos;
  end loop;
  update pedidos set total_centavos = total where id = v_id;
  return v_id;
end $$;

-- Pagamento integral no ato: o valor tem de ser o total do pedido.
create function pagar_pedido(p_pedido uuid, p_forma text, p_recebido_em date, p_id_externo text)
returns void language plpgsql security definer set search_path = public as $$
declare p pedidos%rowtype;
begin
  if not (tem_permissao('salgados.criar') or tem_permissao('pagamento.confirmar')) then
    raise exception 'SEM_PERMISSAO: seu perfil não registra pagamento' using errcode = '42501';
  end if;
  select * into p from pedidos where id = p_pedido for update;
  if not found or p.status <> 'aguardando_pagamento' then
    raise exception 'STATUS_INVALIDO: o pedido não está aguardando pagamento' using errcode = 'P0001';
  end if;
  if p_recebido_em is null or p_recebido_em > (now() at time zone 'America/Fortaleza')::date then
    raise exception 'VALOR_INVALIDO: data de recebimento inválida' using errcode = 'P0001';
  end if;
  begin
    insert into pedido_pagamentos (pedido_id, valor_centavos, forma, id_externo, recebido_em)
    values (p.id, p.total_centavos, p_forma, nullif(trim(p_id_externo), ''), p_recebido_em);
  exception when unique_violation then
    raise exception 'PAGAMENTO_DUPLICADO: este identificador de pagamento já foi registrado' using errcode = 'P0001';
  end;
  update pedidos set status = 'pago', pago_em = now() where id = p.id;
end $$;

create function marcar_pedido_pronto(p_pedido uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('producao.status') then
    raise exception 'SEM_PERMISSAO: seu perfil não muda a produção' using errcode = '42501';
  end if;
  update pedidos set status = 'pronto', pronto_em = now() where id = p_pedido and status = 'pago';
  if not found then raise exception 'STATUS_INVALIDO: só pedido pago vai para pronto' using errcode = 'P0001'; end if;
end $$;

-- Entrega: só pago (ou pronto); desconta do estoque o que cada item consome.
create function entregar_pedido(p_pedido uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p pedidos%rowtype;
begin
  if not tem_permissao('retirada.registrar') then
    raise exception 'SEM_PERMISSAO: seu perfil não registra retirada' using errcode = '42501';
  end if;
  select * into p from pedidos where id = p_pedido for update;
  if not found or p.status not in ('pago', 'pronto') then
    raise exception 'ENTRADA_NAO_CONFIRMADA: o pedido só sai depois de pago' using errcode = 'P0001';
  end if;
  insert into estoque_movimentos (estoque_item_id, tipo, quantidade, pedido_id, observacao)
  select (c->>'estoque_item_id')::uuid, 'pedido', -sum((c->>'unidades')::int * i.quantidade), p.id, p.numero
    from pedido_itens i cross join lateral jsonb_array_elements(coalesce(i.composicao, '[]')) c
   where i.pedido_id = p.id
   group by 1;
  update pedidos set status = 'entregue', entregue_em = now(), entregue_por = usuario_atual() where id = p.id;
end $$;

create function cancelar_pedido(p_pedido uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare p pedidos%rowtype;
begin
  if not (tem_permissao('salgados.criar') or tem_permissao('pagamento.estornar')) then
    raise exception 'SEM_PERMISSAO: seu perfil não cancela pedidos' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'JUSTIFICATIVA_OBRIGATORIA: diga o motivo do cancelamento' using errcode = 'P0001';
  end if;
  select * into p from pedidos where id = p_pedido for update;
  if not found or p.status in ('entregue', 'cancelado') then
    raise exception 'STATUS_INVALIDO: pedido já entregue ou cancelado' using errcode = 'P0001';
  end if;
  update pedidos set status = 'cancelado', cancelado_em = now(), cancelado_motivo = trim(p_motivo) where id = p.id;
  if p.status <> 'aguardando_pagamento' then
    insert into tarefas (titulo, vence_em, responsavel, criado_por)
    values (format('Devolver %s ao cliente do pedido %s (%s)', formatar_reais(p.total_centavos), p.numero, p.cliente_nome),
            now() + interval '1 day', usuario_atual(), usuario_atual());
  end if;
end $$;

-- Produção, perda e ajuste de estoque (em unidades).
create function movimentar_estoque(p_item uuid, p_tipo text, p_quantidade integer, p_observacao text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (tem_permissao('estoque.movimentar') or tem_permissao('producao.status')) then
    raise exception 'SEM_PERMISSAO: seu perfil não movimenta estoque' using errcode = '42501';
  end if;
  if p_tipo not in ('producao', 'perda', 'ajuste', 'evento') then
    raise exception 'VALOR_INVALIDO: tipo de movimento inválido' using errcode = 'P0001';
  end if;
  if p_quantidade is null or p_quantidade = 0 or abs(p_quantidade) > 100000 then
    raise exception 'VALOR_INVALIDO: quantidade inválida' using errcode = 'P0001';
  end if;
  if p_tipo in ('perda', 'ajuste') and length(trim(coalesce(p_observacao, ''))) < 3 then
    raise exception 'JUSTIFICATIVA_OBRIGATORIA: diga o motivo do ajuste ou da perda' using errcode = 'P0001';
  end if;
  insert into estoque_movimentos (estoque_item_id, tipo, quantidade, observacao)
  values (p_item,
          p_tipo,
          case when p_tipo = 'producao' then abs(p_quantidade) when p_tipo in ('perda', 'evento') then -abs(p_quantidade) else p_quantidade end,
          nullif(trim(p_observacao), ''));
end $$;

create function definir_minimo_estoque(p_item uuid, p_minimo integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('estoque.movimentar') then
    raise exception 'SEM_PERMISSAO: seu perfil não altera o estoque' using errcode = '42501';
  end if;
  update estoque_itens set minimo = greatest(0, p_minimo), atualizado_em = now() where id = p_item;
end $$;

create function definir_preco_encomenda(p_produto uuid, p_preco bigint, p_ativo boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('catalogo.alterar') then
    raise exception 'SEM_PERMISSAO: seu perfil não altera preços' using errcode = '42501';
  end if;
  if p_preco is null or p_preco <= 0 then raise exception 'VALOR_INVALIDO: preço inválido' using errcode = 'P0001'; end if;
  update cardapio_encomenda set preco_centavos = p_preco, ativo = coalesce(p_ativo, ativo), atualizado_em = now() where id = p_produto;
end $$;

revoke all on function composicao_do_item(cardapio_encomenda, uuid[]) from public, anon, authenticated;
revoke all on function criar_pedido(text, text, text, timestamptz, text, jsonb) from public, anon, authenticated;
revoke all on function pagar_pedido(uuid, text, date, text) from public, anon, authenticated;
revoke all on function marcar_pedido_pronto(uuid) from public, anon, authenticated;
revoke all on function entregar_pedido(uuid) from public, anon, authenticated;
revoke all on function cancelar_pedido(uuid, text) from public, anon, authenticated;
revoke all on function movimentar_estoque(uuid, text, integer, text) from public, anon, authenticated;
revoke all on function definir_minimo_estoque(uuid, integer) from public, anon, authenticated;
revoke all on function definir_preco_encomenda(uuid, bigint, boolean) from public, anon, authenticated;
grant execute on function criar_pedido(text, text, text, timestamptz, text, jsonb) to delta_app;
grant execute on function pagar_pedido(uuid, text, date, text) to delta_app;
grant execute on function marcar_pedido_pronto(uuid) to delta_app;
grant execute on function entregar_pedido(uuid) to delta_app;
grant execute on function cancelar_pedido(uuid, text) to delta_app;
grant execute on function movimentar_estoque(uuid, text, integer, text) to delta_app;
grant execute on function definir_minimo_estoque(uuid, integer) to delta_app;
grant execute on function definir_preco_encomenda(uuid, bigint, boolean) to delta_app;

-- ---------------------------------------------------------------- dados iniciais (cardápio do InstaDelivery, 11/11/2026)
insert into estoque_itens (nome, ordem) values
  ('Coxinha de frango', 10), ('Pastelzinho de carne', 20), ('Risoles de carne', 30), ('Croquete de camarão', 40),
  ('Quibe de carne', 50), ('Bolinha de queijo', 60), ('Empada de frango', 70), ('Lolita de goiabada', 80),
  ('Pastelzinho de forno de carne assada', 90), ('Barquete de frango', 100);

insert into cardapio_encomenda (nome, grupo, descricao, preco_centavos, unidades, estoque_item_id, sortido, so_encomenda, ordem)
select v.nome, v.grupo, v.descricao, v.preco, v.unidades, e.id, v.sortido, v.so_encomenda, v.ordem
  from (values
    ('Salgados de fritura sortidos (cento)', 'Salgados de fritura', 'Escolha os sabores na hora do pedido.', 8000, 100, null, true, false, 10),
    ('Salgados de fritura sortidos (meio cento)', 'Salgados de fritura', 'Escolha os sabores na hora do pedido.', 4000, 50, null, true, false, 11),
    ('Coxinha de frango (cento)', 'Salgados de fritura', null, 8000, 100, 'Coxinha de frango', false, false, 20),
    ('Pastelzinho de carne (cento)', 'Salgados de fritura', null, 8000, 100, 'Pastelzinho de carne', false, false, 30),
    ('Risoles de carne (cento)', 'Salgados de fritura', null, 8000, 100, 'Risoles de carne', false, false, 40),
    ('Croquete de camarão (cento)', 'Salgados de fritura', null, 10000, 100, 'Croquete de camarão', false, false, 50),
    ('Quibe de carne (cento)', 'Salgados de fritura', null, 8000, 100, 'Quibe de carne', false, false, 60),
    ('Bolinha de queijo (cento)', 'Salgados de fritura', null, 8000, 100, 'Bolinha de queijo', false, false, 70),
    ('Salgados de forno sortidos (cento)', 'Salgados de forno', 'Escolha os sabores na hora do pedido.', 11000, 100, null, true, false, 110),
    ('Salgados de forno sortidos (meio cento)', 'Salgados de forno', 'Escolha os sabores na hora do pedido.', 5500, 50, null, true, false, 111),
    ('Empada de frango (cento)', 'Salgados de forno', null, 11000, 100, 'Empada de frango', false, false, 120),
    ('Lolita de goiabada (cento)', 'Salgados de forno', null, 11000, 100, 'Lolita de goiabada', false, false, 130),
    ('Pastelzinho de forno de carne assada (cento)', 'Salgados de forno', null, 11000, 100, 'Pastelzinho de forno de carne assada', false, false, 140),
    ('Barquete de frango (cento)', 'Salgados extras', null, 13000, 100, 'Barquete de frango', false, false, 210),
    ('Mini pizza (unidade)', 'Sanduíches (encomenda)', null, 1000, 1, null, false, true, 310),
    ('Mini sanduíche (unidade)', 'Sanduíches (encomenda)', null, 1000, 1, null, false, true, 320),
    ('Sanduíche natural (unidade)', 'Sanduíches (encomenda)', null, 1000, 1, null, false, true, 330),
    ('Jarra de suco 1,5 L', 'Bebidas', null, 2500, 1, null, false, false, 410),
    ('Água mineral 200 ml (copinho)', 'Bebidas', null, 200, 1, null, false, false, 420),
    ('Refrigerante 1,5 L', 'Bebidas', null, 800, 1, null, false, false, 430),
    ('Panqueca de frango ao molho branco (unidade)', 'Encomendas', null, 2000, 1, null, false, true, 510),
    ('Panqueca de carne ao molho vermelho (unidade)', 'Encomendas', null, 2000, 1, null, false, true, 520),
    ('Caldo de carne (copo)', 'Encomendas', null, 1500, 1, null, false, true, 530),
    ('Salgados congelados (cento)', 'Encomendas', 'Para fritar em casa.', 8000, 100, null, false, true, 540),
    ('Salada de frutas 300 ml', 'Encomendas', null, 1500, 1, null, false, true, 550)
  ) as v(nome, grupo, descricao, preco, unidades, estoque, sortido, so_encomenda, ordem)
  left join estoque_itens e on e.nome = v.estoque;

-- Sabores de forno e grupo de cada sortido
update estoque_itens set grupo = 'forno' where nome in ('Empada de frango', 'Lolita de goiabada', 'Pastelzinho de forno de carne assada', 'Barquete de frango');
update cardapio_encomenda set sortido_grupo = case when grupo like '%forno%' then 'forno' else 'fritura' end where sortido;
