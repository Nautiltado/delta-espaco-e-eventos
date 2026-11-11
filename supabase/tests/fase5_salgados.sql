-- Testes da Fase 5 (encomendas de salgados e estoque). Terminam com "RESULTADO ..." e desfazem tudo.
do $$
declare
  falhas text[] := '{}'; total int := 0; inst uuid := '00000000-0000-0000-0000-000000000000';
  u_atd uuid; u_coz uuid; u_adm uuid; u_fin uuid;
  a_atd uuid := gen_random_uuid(); a_coz uuid := gen_random_uuid(); a_adm uuid := gen_random_uuid(); a_fin uuid := gen_random_uuid();
  coxinha uuid := (select id from estoque_itens where nome = 'Coxinha de frango');
  bolinha uuid := (select id from estoque_itens where nome = 'Bolinha de queijo');
  risoles uuid := (select id from estoque_itens where nome = 'Risoles de carne');
  p_cox uuid := (select id from cardapio_encomenda where nome = 'Coxinha de frango (cento)');
  p_sort uuid := (select id from cardapio_encomenda where nome = 'Salgados de fritura sortidos (cento)');
  p_meio uuid := (select id from cardapio_encomenda where nome = 'Salgados de fritura sortidos (meio cento)');
  p_pizza uuid := (select id from cardapio_encomenda where nome = 'Mini pizza (unidade)');
  ped1 uuid; ped2 uuid; ped3 uuid; n int; t text; s0 int; s1 int;
  ret timestamptz := now() + interval '3 hours';
begin
  insert into usuarios (nome, email) values ('T5 Atd', 't5.atd@delta.test') returning id into u_atd;
  insert into usuarios (nome, email) values ('T5 Coz', 't5.coz@delta.test') returning id into u_coz;
  insert into usuarios (nome, email) values ('T5 Adm', 't5.adm@delta.test') returning id into u_adm;
  insert into usuarios (nome, email) values ('T5 Fin', 't5.fin@delta.test') returning id into u_fin;
  insert into usuarios_perfis values (u_atd,'ATD'),(u_coz,'COZ'),(u_adm,'ADM'),(u_fin,'FIN');
  insert into auth.users (instance_id, id, aud, role, email) values
    (inst, a_atd, 'authenticated', 'authenticated', 't5.atd@delta.test'), (inst, a_coz, 'authenticated', 'authenticated', 't5.coz@delta.test'),
    (inst, a_adm, 'authenticated', 'authenticated', 't5.adm@delta.test'), (inst, a_fin, 'authenticated', 'authenticated', 't5.fin@delta.test');

  ------------------------------------------------ cozinha registra produção
  perform set_config('request.jwt.claims', json_build_object('sub', a_coz, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  s0 := (select saldo from estoque_saldo where id = coxinha);
  perform movimentar_estoque(coxinha, 'producao', 300, null);
  perform movimentar_estoque(bolinha, 'producao', 200, null);
  total := total + 1;
  if (select saldo from estoque_saldo where id = coxinha) <> s0 + 300 then falhas := falhas || 'S1 produção não entrou no estoque'; end if;
  total := total + 1;
  begin
    perform movimentar_estoque(coxinha, 'perda', 10, '');
    falhas := falhas || 'S2 perda sem motivo aceita';
  exception when others then
    if sqlerrm not like 'JUSTIFICATIVA_OBRIGATORIA%' then falhas := falhas || ('S2 ' || sqlerrm); end if;
  end;
  total := total + 1;
  begin
    perform criar_pedido('Ana', null, 'balcao', ret, null, jsonb_build_array(jsonb_build_object('produto_id', p_cox, 'quantidade', 1)));
    falhas := falhas || 'S3 cozinha conseguiu registrar pedido';
  exception when others then
    if sqlerrm not like 'SEM_PERMISSAO%' then falhas := falhas || ('S3 ' || sqlerrm); end if;
  end;
  perform set_config('role', 'none', true);

  ------------------------------------------------ atendimento registra pedidos
  perform set_config('request.jwt.claims', json_build_object('sub', a_atd, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  ped1 := criar_pedido('Maria Teste', '(99) 98111-2233', 'whatsapp', ret, 'Bem sequinhos', jsonb_build_array(
    jsonb_build_object('produto_id', p_cox, 'quantidade', 2),
    jsonb_build_object('produto_id', p_sort, 'quantidade', 1, 'sortido', jsonb_build_array(coxinha, bolinha, risoles)),
    jsonb_build_object('produto_id', p_pizza, 'quantidade', 10)));
  total := total + 1;
  if (select total_centavos from pedidos where id = ped1) <> 2 * 8000 + 8000 + 10 * 1000 then falhas := falhas || 'S4 total do pedido errado'; end if;
  total := total + 1;
  if (select status from pedidos where id = ped1) <> 'aguardando_pagamento' or (select cliente_telefone from pedidos where id = ped1) <> '99981112233' then
    falhas := falhas || 'S5 pedido não ficou aguardando pagamento ou telefone não normalizado';
  end if;
  total := total + 1;
  if (select composicao from pedido_itens where pedido_id = ped1 and produto_id = p_sort)
     <> jsonb_build_array(jsonb_build_object('estoque_item_id', coxinha, 'unidades', 34), jsonb_build_object('estoque_item_id', bolinha, 'unidades', 33),
                          jsonb_build_object('estoque_item_id', risoles, 'unidades', 33)) then
    falhas := falhas || 'S6 sortido não dividiu 100 em 34/33/33';
  end if;
  total := total + 1;
  begin
    perform criar_pedido('João', null, 'balcao', now() - interval '2 hours', null, jsonb_build_array(jsonb_build_object('produto_id', p_cox, 'quantidade', 1)));
    falhas := falhas || 'S7 aceitou retirada no passado';
  exception when others then
    if sqlerrm not like 'HORARIO_INVALIDO%' then falhas := falhas || ('S7 ' || sqlerrm); end if;
  end;
  total := total + 1;
  begin
    perform entregar_pedido(ped1);
    falhas := falhas || 'S8 entregou pedido sem pagamento';
  exception when others then
    if sqlerrm not like 'ENTRADA_NAO_CONFIRMADA%' then falhas := falhas || ('S8 ' || sqlerrm); end if;
  end;
  perform pagar_pedido(ped1, 'pix', hoje_delta(), 'E2E-T5-1');
  total := total + 1;
  if (select status from pedidos where id = ped1) <> 'pago' or (select valor_centavos from pedido_pagamentos where pedido_id = ped1) <> 34000 then
    falhas := falhas || 'S9 pagamento integral não registrado';
  end if;
  total := total + 1;
  if (select reservado from estoque_saldo where id = coxinha) <> 234 then falhas := falhas || 'S10 reservado da coxinha não é 234'; end if;
  ped2 := criar_pedido('Pedro Teste', null, 'balcao', ret, null, jsonb_build_array(jsonb_build_object('produto_id', p_meio, 'quantidade', 1)));
  total := total + 1;
  begin
    perform pagar_pedido(ped2, 'pix', hoje_delta(), 'E2E-T5-1');
    falhas := falhas || 'S11 aceitou o mesmo Pix em outro pedido';
  exception when others then
    if sqlerrm not like 'PAGAMENTO_DUPLICADO%' then falhas := falhas || ('S11 ' || sqlerrm); end if;
  end;
  perform set_config('role', 'none', true);

  ------------------------------------------------ cozinha: pronto e entrega descontam o estoque
  perform set_config('request.jwt.claims', json_build_object('sub', a_coz, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform marcar_pedido_pronto(ped1);
  s1 := (select saldo from estoque_saldo where id = coxinha);
  perform entregar_pedido(ped1);
  total := total + 1;
  if (select saldo from estoque_saldo where id = coxinha) <> s1 - 234 or (select reservado from estoque_saldo where id = coxinha) <> 0 then
    falhas := falhas || 'S12 entrega não descontou 234 coxinhas';
  end if;
  total := total + 1;
  if (select status from pedidos where id = ped1) <> 'entregue' or (select entregue_por from pedidos where id = ped1) <> u_coz then
    falhas := falhas || 'S13 entrega sem registro de quem entregou';
  end if;
  total := total + 1;
  begin
    perform entregar_pedido(ped1);
    falhas := falhas || 'S14 entregou duas vezes';
  exception when others then null;
  end;
  perform set_config('role', 'none', true);

  ------------------------------------------------ cancelamento e imutabilidade
  perform set_config('request.jwt.claims', json_build_object('sub', a_atd, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  ped3 := criar_pedido('Clara Teste', null, 'telefone', ret, null, jsonb_build_array(jsonb_build_object('produto_id', p_cox, 'quantidade', 1)));
  perform pagar_pedido(ped3, 'dinheiro', hoje_delta(), null);
  perform cancelar_pedido(ped3, 'Cliente desistiu');
  total := total + 1;
  if (select status from pedidos where id = ped3) <> 'cancelado'
     or not exists (select 1 from tarefas where titulo like 'Devolver R$ 80,00 ao cliente do pedido%') then
    falhas := falhas || 'S15 cancelamento de pedido pago não criou tarefa de devolução';
  end if;
  perform cancelar_pedido(ped2, 'Não pagou');
  total := total + 1;
  if exists (select 1 from tarefas where titulo like '%pedido ' || (select numero from pedidos where id = ped2) || '%') then
    falhas := falhas || 'S16 pedido não pago gerou tarefa de devolução';
  end if;
  total := total + 1;
  begin
    update pedido_itens set quantidade = 99 where pedido_id = ped1;
    falhas := falhas || 'S17 item de pedido alterado';
  exception when others then null;
  end;
  total := total + 1;
  begin
    perform definir_preco_encomenda(p_cox, 9000, true);
    falhas := falhas || 'S18 atendimento alterou preço';
  exception when others then
    if sqlerrm not like 'SEM_PERMISSAO%' then falhas := falhas || ('S18 ' || sqlerrm); end if;
  end;
  perform set_config('role', 'none', true);

  ------------------------------------------------ leitura: financeiro vê, operação não
  perform set_config('request.jwt.claims', json_build_object('sub', a_fin, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  total := total + 1;
  if (select count(*) from pedidos where id in (ped1, ped2, ped3)) <> 3 then falhas := falhas || 'S19 financeiro não vê os pedidos'; end if;
  perform set_config('role', 'none', true);

  t := format('RESULTADO %s de %s testes passaram', total - coalesce(array_length(falhas, 1), 0), total);
  if array_length(falhas, 1) > 0 then t := t || E'\nFALHAS:\n- ' || array_to_string(falhas, E'\n- '); end if;
  raise exception '%', t;
end $$;
