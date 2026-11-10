-- Percentual com vírgula decimal nos motivos de aprovação ("5,3%" em vez de "5.3%").
create or replace function motivos_aprovacao(p_versao uuid) returns text[]
language plpgsql stable security definer set search_path = public as $$
declare v orcamento_versoes%rowtype; m text[] := '{}'; r record; teto int := coalesce(cfg_int('orcamento.desconto_teto_percentual'), 0);
begin
  select * into v from orcamento_versoes where id = p_versao;
  if v.desconto_centavos > 0 and v.desconto_centavos * 100 > v.subtotal_centavos * teto then
    m := m || format('Desconto de %s%% acima do limite de %s%%',
                     replace(round(v.desconto_centavos * 100.0 / nullif(v.subtotal_centavos, 0), 1)::text, '.', ','), teto);
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
