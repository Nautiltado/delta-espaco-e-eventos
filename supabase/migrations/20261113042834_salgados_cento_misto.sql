-- Cento misto: 100 salgados em 4 blocos de 25; até 4 sabores, podendo repetir (ex.: 50 de coxinha + 25 + 25).
alter table cardapio_encomenda add column bloco_unidades integer check (bloco_unidades is null or bloco_unidades > 0);
alter table cardapio_encomenda add constraint cardapio_bloco_divide check (bloco_unidades is null or (sortido and unidades % bloco_unidades = 0));

-- Composição: produto simples consome o próprio salgado; sortido divide igual; misto conta 25 por bloco escolhido.
create or replace function composicao_do_item(p_produto cardapio_encomenda, p_escolha uuid[]) returns jsonb
language plpgsql immutable as $$
declare n int; base int; resto int; r jsonb := '[]'; i int; s record;
begin
  if p_produto.estoque_item_id is not null then
    return jsonb_build_array(jsonb_build_object('estoque_item_id', p_produto.estoque_item_id, 'unidades', p_produto.unidades));
  end if;
  if not p_produto.sortido or p_escolha is null or array_length(p_escolha, 1) is null then
    return null;
  end if;
  if p_produto.bloco_unidades is not null then
    -- um elemento por bloco, na ordem em que o sabor apareceu primeiro
    for s in select e as id, count(*) as blocos, min(o) as primeiro
               from unnest(p_escolha) with ordinality as t(e, o) group by e order by 3 loop
      r := r || jsonb_build_object('estoque_item_id', s.id, 'unidades', s.blocos * p_produto.bloco_unidades);
    end loop;
    return r;
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
-- No misto, "sortido" traz um sabor por bloco (4 blocos = 4 elementos, repetidos quando o sabor ocupa mais de um bloco).
create or replace function criar_pedido(p_nome text, p_telefone text, p_canal text, p_retirada timestamptz, p_observacao text, p_itens jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; x jsonb; prod cardapio_encomenda; q int; escolha uuid[]; total bigint := 0; blocos int;
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
    if exists (select 1 from unnest(escolha) e where not exists (
                 select 1 from estoque_itens where id = e and ativo and (prod.sortido_grupo is null or grupo = prod.sortido_grupo))) then
      raise exception 'STATUS_INVALIDO: sabor do sortido inválido' using errcode = 'P0001';
    end if;
    if prod.sortido and coalesce(array_length(escolha, 1), 0) = 0 then
      raise exception 'STATUS_INVALIDO: escolha os sabores de %', prod.nome using errcode = 'P0001';
    end if;
    if prod.bloco_unidades is not null then
      blocos := prod.unidades / prod.bloco_unidades;
      if array_length(escolha, 1) <> blocos then
        raise exception 'STATUS_INVALIDO: o % tem % blocos de % unidades; escolha o sabor de cada bloco', lower(prod.nome), blocos, prod.bloco_unidades using errcode = 'P0001';
      end if;
    end if;
    insert into pedido_itens (pedido_id, produto_id, descricao, quantidade, preco_unitario_centavos, composicao)
    values (v_id, prod.id, prod.nome, q, prod.preco_centavos, composicao_do_item(prod, escolha));
    total := total + q * prod.preco_centavos;
  end loop;
  update pedidos set total_centavos = total where id = v_id;
  return v_id;
end $$;

-- Os dois centos mistos, com o preço do cento de cada tipo (ajustável no cardápio)
insert into cardapio_encomenda (nome, grupo, descricao, preco_centavos, unidades, sortido, sortido_grupo, bloco_unidades, ordem)
select v.nome, v.grupo, v.descricao, c.preco_centavos, 100, true, v.sg, 25, v.ordem
  from (values
    ('Salgados de fritura mistos (cento)', 'Salgados de fritura', 'Até 4 sabores, 25 unidades de cada (pode repetir sabor).', 'fritura', 12, 'Salgados de fritura sortidos (cento)'),
    ('Salgados de forno mistos (cento)',   'Salgados de forno',   'Até 4 sabores, 25 unidades de cada (pode repetir sabor).', 'forno',   112, 'Salgados de forno sortidos (cento)')
  ) as v(nome, grupo, descricao, sg, ordem, referencia)
  join cardapio_encomenda c on c.nome = v.referencia
on conflict (nome) do nothing;
