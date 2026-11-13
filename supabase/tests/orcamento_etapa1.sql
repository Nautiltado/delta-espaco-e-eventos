-- Testes da etapa 1 dos orçamentos: unidades, item com desconto e preço pendente, custo, aprovação, versões. Desfaz tudo no fim.
do $$
declare
  falhas text[] := '{}'; total int := 0; inst uuid := '00000000-0000-0000-0000-000000000000';
  u_adm uuid; u_atd uuid; a_adm uuid := gen_random_uuid(); a_atd uuid := gen_random_uuid();
  menor uuid := (select id from recursos where nome = 'Espaço menor');
  coxinha uuid := (select id from catalogo_itens where nome = 'Coxinha de frango');
  cli uuid; o1 uuid; v1 uuid; v2 uuid; i1 uuid; i2 uuid; i3 uuid; x record; m text[]; s jsonb; n int; erro text;
begin
  insert into usuarios (nome, email) values ('TE Adm', 'te.adm@delta.test') returning id into u_adm;
  insert into usuarios (nome, email) values ('TE Atd', 'te.atd@delta.test') returning id into u_atd;
  insert into usuarios_perfis values (u_adm, 'ADM'), (u_atd, 'ATD');
  insert into auth.users (instance_id, id, aud, role, email) values
    (inst, a_adm, 'authenticated', 'authenticated', 'te.adm@delta.test'), (inst, a_atd, 'authenticated', 'authenticated', 'te.atd@delta.test');
  insert into clientes (tipo, nome) values ('PF', 'Cliente Etapa 1 (teste)') returning id into cli;

  perform set_config('request.jwt.claims', json_build_object('sub', a_atd, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  o1 := criar_orcamento(cli, 'Aniversário 100 (teste)', 'espaco_buffet', '2031-05-10', '18h às 23h', 100, menor, null);
  select id into v1 from orcamento_versoes where orcamento_id = o1;

  -- E1: item do catálogo herda a categoria; preço pode ficar pendente (null)
  insert into orcamento_itens (versao_id, ordem, catalogo_item_id, descricao, unidade, quantidade, preco_unitario_centavos)
  values (v1, 1, coxinha, 'Coxinha de frango', 'cento', 2, null) returning id into i1;
  select * into x from orcamento_itens where id = i1;
  total := total + 1;
  if x.categoria is distinct from 'salgado_frito' or x.total_centavos <> 0 then falhas := falhas || ('E1 categoria/total: ' || coalesce(x.categoria, 'nula') || ' ' || x.total_centavos); end if;

  -- E2: pendência aparece e impede o envio
  insert into orcamento_itens (versao_id, ordem, descricao, detalhe, categoria, unidade, quantidade, preco_unitario_centavos)
  values (v1, 2, 'Decoração temática', '  Balões e painel  ', 'servico', 'servico', 1, 50000) returning id into i2;
  m := pendencias_orcamento(v1);
  total := total + 1;
  if coalesce(array_length(m, 1), 0) <> 1 or m[1] not like 'Coxinha de frango sem preço%' then falhas := falhas || ('E2 pendências: ' || coalesce(array_to_string(m, '|'), '')); end if;
  begin
    perform enviar_versao(v1, null);
    falhas := falhas || 'E3 enviou com preço pendente'::text;
  exception when others then
    if sqlerrm not like 'PRECO_PENDENTE%' then falhas := falhas || ('E3 erro inesperado: ' || sqlerrm); end if;
  end;
  total := total + 1;

  -- E4: detalhe é aparado
  total := total + 1;
  if (select detalhe from orcamento_itens where id = i2) <> 'Balões e painel' then falhas := falhas || 'E4 detalhe não aparado'::text; end if;
  -- E5: atendimento pode dar desconto no item (o teto decide se precisa de aprovação)
  update orcamento_itens set desconto_centavos = 1000 where id = i2;
  total := total + 1;
  if (select total_centavos from orcamento_itens where id = i2) <> 49000 then falhas := falhas || 'E5 desconto do atendimento'::text; end if;

  -- E6: administração define preço e desconto; total = bruto - desconto e a versão soma o líquido
  perform set_config('request.jwt.claims', json_build_object('sub', a_adm, 'role', 'authenticated')::text, true);
  update orcamento_itens set preco_unitario_centavos = 9000 where id = i1;          -- 2 centos × R$ 90
  update orcamento_itens set desconto_centavos = 5000 where id = i2;                -- R$ 50 de desconto
  select * into x from orcamento_itens where id = i2;
  total := total + 1;
  if x.bruto_centavos <> 50000 or x.total_centavos <> 45000 then falhas := falhas || ('E6 item: ' || x.bruto_centavos || '/' || x.total_centavos); end if;
  total := total + 1;
  if (select subtotal_centavos from orcamento_versoes where id = v1) <> 18000 + 45000 then
    falhas := falhas || ('E6 subtotal: ' || (select subtotal_centavos from orcamento_versoes where id = v1)); end if;

  -- E7: desconto maior que o valor do item é recusado
  begin
    update orcamento_itens set desconto_centavos = 60000 where id = i2;
    falhas := falhas || 'E7 aceitou desconto maior que o item'::text;
  exception when check_violation then null;
  end;
  total := total + 1;

  -- E8: desconto total (R$ 50 de R$ 680 = 7,4%) passa do teto de 5%
  m := motivos_aprovacao(v1);
  total := total + 1;
  if not exists (select 1 from unnest(m) t where t like 'Desconto de 7,4% acima do limite%') then falhas := falhas || ('E8 motivos: ' || array_to_string(m, '|')); end if;

  -- E9: venda abaixo do custo exige aprovação
  insert into orcamento_itens_custos (item_id, custo_unitario_centavos) values (i1, 9500);
  m := motivos_aprovacao(v1);
  total := total + 1;
  if not exists (select 1 from unnest(m) t where t = 'Coxinha de frango vendido abaixo do custo') then falhas := falhas || ('E9 custo: ' || array_to_string(m, '|')); end if;

  -- E10: aprovação some quando um item muda depois dela
  perform aprovar_condicoes(v1, 'Cliente fechou dois eventos (teste)');
  update orcamento_itens set quantidade = 3 where id = i1;
  total := total + 1;
  if (select aprovado_por from orcamento_versoes where id = v1) is not null then falhas := falhas || 'E10 aprovação continuou depois de mudar item'::text; end if;

  -- E11: envio congela equivalência do cento, detalhe e desconto do item
  update orcamento_itens set preco_unitario_centavos = 12000 where id = i1;         -- acima do custo
  perform aprovar_condicoes(v1, 'Desconto da decoração autorizado (teste)');
  perform enviar_versao(v1, '2031-04-30');
  select snapshot into s from orcamento_versoes where id = v1;
  total := total + 1;
  if s #>> '{itens,0,equivalencia}' <> '300 unidades' or s #>> '{itens,1,detalhe}' <> 'Balões e painel'
     or (s #>> '{itens,1,desconto_centavos}')::bigint <> 5000 or (s ->> 'descontos_itens_centavos')::bigint <> 5000 then
    falhas := falhas || ('E11 snapshot: ' || (s -> 'itens')::text); end if;

  -- E12: item da versão enviada não muda
  begin
    update orcamento_itens set preco_unitario_centavos = 1 where id = i2;
    falhas := falhas || 'E12 alterou item enviado'::text;
  exception when others then
    if sqlerrm not like 'ORCAMENTO_IMUTAVEL%' then falhas := falhas || ('E12 erro inesperado: ' || sqlerrm); end if;
  end;
  total := total + 1;

  -- E13: atendimento cria a versão 2 copiando detalhe, categoria, desconto e custo
  perform set_config('request.jwt.claims', json_build_object('sub', a_atd, 'role', 'authenticated')::text, true);
  v2 := nova_versao(o1);
  perform set_config('request.jwt.claims', json_build_object('sub', a_adm, 'role', 'authenticated')::text, true);  -- custo e auditoria só a administração vê
  total := total + 1;
  select count(*) into n from orcamento_itens i join orcamento_itens_custos k on k.item_id = i.id where i.versao_id = v2;
  if (select count(*) from orcamento_itens where versao_id = v2 and desconto_centavos = 5000 and detalhe = 'Balões e painel' and categoria = 'servico') <> 1
     or n <> 1 then falhas := falhas || 'E13 nova versão não copiou tudo'::text; end if;
  -- E14: a versão 1 continua intacta
  total := total + 1;
  if (select status from orcamento_versoes where id = v1) <> 'enviada' or (select count(*) from orcamento_itens where versao_id = v1) <> 2 then
    falhas := falhas || 'E14 versão anterior mudou'::text; end if;

  -- E15: trilha registra quem mudou preço e desconto
  total := total + 1;
  if (select count(*) from auditoria where tabela = 'orcamento_itens' and registro_id = i2::text and acao = 'UPDATE' and usuario = u_adm) < 1
     or (select count(*) from auditoria where tabela = 'orcamento_itens_custos' and registro_id = i1::text) < 1 then
    falhas := falhas || 'E15 sem auditoria dos itens'::text; end if;

  -- E16: unidade inexistente é recusada
  begin
    insert into orcamento_itens (versao_id, ordem, descricao, unidade, quantidade, preco_unitario_centavos) values (v2, 9, 'X item', 'barril', 1, 100);
    falhas := falhas || 'E16 aceitou unidade inexistente'::text;
  exception when foreign_key_violation then null;
  end;
  total := total + 1;

  raise exception 'RESULTADO %/% %', total - coalesce(array_length(falhas, 1), 0), total, array_to_string(falhas, ' || ');
end $$;
