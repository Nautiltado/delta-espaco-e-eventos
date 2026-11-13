-- Ao criar nova versão, os descontos já aprovados da versão anterior são copiados mesmo por quem não dá desconto.
create or replace function trg_item_regras() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.categoria is null and new.catalogo_item_id is not null then
    select categoria into new.categoria from catalogo_itens where id = new.catalogo_item_id;
  end if;
  new.detalhe := nullif(trim(coalesce(new.detalhe, '')), '');
  if new.desconto_centavos > 0 and (tg_op = 'INSERT' or new.desconto_centavos is distinct from old.desconto_centavos)
     and coalesce(current_setting('delta.copiando_versao', true), '') <> '1'
     and not (tem_permissao('desconto.dar') or tem_permissao('desconto.aprovar')) then
    raise exception 'SEM_PERMISSAO: seu perfil não dá desconto' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function nova_versao(p_orcamento uuid) returns uuid
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
  insert into orcamento_versoes (orcamento_id, numero, condicoes, observacoes, apresentacao, desconto_centavos)
  values (p_orcamento, v_ult.numero + 1, v_ult.condicoes, v_ult.observacoes, v_ult.apresentacao, 0)
  returning id into v_id;
  perform set_config('delta.copiando_versao', '1', true);
  for r in select i.*, c.custo_unitario_centavos from orcamento_itens i
             left join orcamento_itens_custos c on c.item_id = i.id
            where i.versao_id = v_ult.id order by i.ordem loop
    insert into orcamento_itens (versao_id, ordem, catalogo_item_id, descricao, detalhe, categoria, unidade, quantidade,
                                 preco_unitario_centavos, desconto_centavos)
    values (v_id, r.ordem, r.catalogo_item_id, r.descricao, r.detalhe, r.categoria, r.unidade, r.quantidade,
            r.preco_unitario_centavos, r.desconto_centavos)
    returning id into novo;
    if r.custo_unitario_centavos is not null then
      insert into orcamento_itens_custos (item_id, custo_unitario_centavos) values (novo, r.custo_unitario_centavos)
      on conflict (item_id) do update set custo_unitario_centavos = excluded.custo_unitario_centavos;
    end if;
  end loop;
  perform set_config('delta.copiando_versao', '', true);
  update orcamento_versoes set desconto_centavos = v_ult.desconto_centavos where id = v_id;
  return v_id;
end $$;
