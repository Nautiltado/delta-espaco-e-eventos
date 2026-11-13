-- Grava o modelo e a lista de itens de uma vez (tudo ou nada).
create function salvar_modelo_orcamento(p_id uuid, p_nome text, p_descricao text, p_ativo boolean, p_itens jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := p_id;
begin
  if not tem_permissao('catalogo.alterar') then
    raise exception 'SEM_PERMISSAO: seu perfil não altera modelos de orçamento' using errcode = '42501';
  end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'CONFIG_INVALIDA: inclua ao menos um item no modelo' using errcode = 'P0001';
  end if;
  if v_id is null then
    insert into orcamento_modelos (nome, descricao, ativo, ordem)
    values (trim(p_nome), nullif(trim(p_descricao), ''), coalesce(p_ativo, true),
            coalesce((select max(ordem) from orcamento_modelos), 0) + 10)
    returning id into v_id;
  else
    update orcamento_modelos set nome = trim(p_nome), descricao = nullif(trim(p_descricao), ''), ativo = coalesce(p_ativo, true),
           atualizado_em = now()
     where id = v_id;
    if not found then raise exception 'STATUS_INVALIDO: modelo inexistente' using errcode = 'P0001'; end if;
    delete from orcamento_modelo_itens where modelo_id = v_id;
  end if;
  insert into orcamento_modelo_itens (modelo_id, catalogo_item_id, regra, fator, minimo, opcional, preco_centavos, ordem)
  select v_id, (x->>'catalogo_item_id')::uuid, x->>'regra', (x->>'fator')::numeric, coalesce((x->>'minimo')::numeric, 0),
         coalesce((x->>'opcional')::boolean, false), (x->>'preco_centavos')::bigint, n * 10
    from jsonb_array_elements(p_itens) with ordinality as t(x, n);
  return v_id;
exception when unique_violation then
  raise exception 'CONFIG_INVALIDA: já existe um modelo com esse nome, ou um item repetido no modelo' using errcode = 'P0001';
end $$;
revoke all on function salvar_modelo_orcamento(uuid, text, text, boolean, jsonb) from public, anon, authenticated;
grant execute on function salvar_modelo_orcamento(uuid, text, text, boolean, jsonb) to delta_app;
