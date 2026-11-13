-- Testes da Fase 4 (Reservas, contratos e pagamentos). Terminam com "RESULTADO ..." e desfazem tudo.
do $$
declare
  falhas text[] := '{}'; total int := 0; inst uuid := '00000000-0000-0000-0000-000000000000';
  u_atd uuid; u_fin uuid; u_adm uuid; u_ope uuid;
  a_atd uuid := gen_random_uuid(); a_fin uuid := gen_random_uuid(); a_adm uuid := gen_random_uuid(); a_ope uuid := gen_random_uuid();
  menor uuid := (select id from recursos where nome = 'Espaço menor');
  maior uuid := (select id from recursos where nome = 'Espaço maior');
  cat uuid := (select id from catalogo_itens where nome = 'Locação do espaço menor');
  c1 uuid; c2 uuid; o1 uuid; o2 uuid; o3 uuid; o4 uuid; o5 uuid; v uuid;
  r1 uuid; r2 uuid; r3 uuid; r4 uuid; r5 uuid; b1 uuid; k1 uuid; k3 uuid; p1 uuid; p2 uuid; g1 uuid;
  n int; j jsonb; t text; ini timestamptz := '2027-06-10 19:00-03'; fim timestamptz := '2027-06-11 02:00-03';
  texto text := repeat('Cláusula de teste do contrato. ', 30);
begin
  insert into usuarios (nome, email) values ('T4 Atd', 't4.atd@delta.test') returning id into u_atd;
  insert into usuarios (nome, email) values ('T4 Fin', 't4.fin@delta.test') returning id into u_fin;
  insert into usuarios (nome, email) values ('T4 Adm', 't4.adm@delta.test') returning id into u_adm;
  insert into usuarios (nome, email) values ('T4 Ope', 't4.ope@delta.test') returning id into u_ope;
  insert into usuarios_perfis values (u_atd,'ATD'),(u_fin,'FIN'),(u_adm,'ADM'),(u_ope,'OPE');
  insert into auth.users (instance_id, id, aud, role, email) values
    (inst, a_atd, 'authenticated', 'authenticated', 't4.atd@delta.test'), (inst, a_fin, 'authenticated', 'authenticated', 't4.fin@delta.test'),
    (inst, a_adm, 'authenticated', 'authenticated', 't4.adm@delta.test'), (inst, a_ope, 'authenticated', 'authenticated', 't4.ope@delta.test');

  ------------------------------------------------ preparação comercial (administrador)
  perform set_config('request.jwt.claims', json_build_object('sub', a_adm, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  insert into clientes (tipo, nome, documento, endereco, cidade, uf) values ('PF', 'Cliente Contrato', '52998224725', 'Rua A, 10', 'Bacabal', 'MA') returning id into c1;
  insert into clientes (tipo, nome) values ('PF', 'Cliente Sem Endereço') returning id into c2;
  o1 := criar_orcamento(c1, 'Casamento teste', 'espaco', null, null, 120, menor);
  o2 := criar_orcamento(c2, 'Aniversário teste', 'espaco', null, null, 80, menor);
  o3 := criar_orcamento(c1, 'Formatura teste', 'espaco', null, null, 300, maior);
  o4 := criar_orcamento(c1, 'Evento próximo teste', 'espaco', null, null, 50, menor);
  o5 := criar_orcamento(c1, 'Pagamento tardio teste', 'espaco', null, null, 50, menor);
  for v in select id from orcamento_versoes where orcamento_id in (o1, o2, o3, o4, o5) loop
    insert into orcamento_itens (versao_id, catalogo_item_id, descricao, unidade, quantidade, preco_unitario_centavos)
    values (v, cat, 'Locação do espaço menor', 'evento', 1, 100001);
    perform enviar_versao(v);
    perform registrar_aceite(v);
  end loop;
  perform set_config('role', 'none', true);

  ------------------------------------------------ agenda: bloqueio temporário e conflitos (cenário 4, sequencial)
  perform set_config('request.jwt.claims', json_build_object('sub', a_atd, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  r1 := reservar_data(o1, ini, fim, array[menor]);
  total := total + 1;
  select count(*) into n from reservas where id = r1 and status = 'bloqueio_temporario' and expira_em between now() + interval '23 hours' and now() + interval '25 hours';
  if n <> 1 then falhas := falhas || 'R1 bloqueio temporário de 24 h não criado'; end if;
  total := total + 1;
  if (select upper(periodo) from reserva_periodos where reserva_id = r1) <> fim + interval '4 hours' then
    falhas := falhas || 'R2 período não inclui as 4 h de limpeza';
  end if;
  total := total + 1;
  begin
    perform reservar_data(o2, '2027-06-11 05:00-03', '2027-06-11 12:00-03', array[menor]);
    falhas := falhas || 'R3 aceitou evento durante a limpeza do anterior';
  exception when others then
    if sqlerrm not like 'DATA_INDISPONIVEL: Espaço menor já está ocupado%' then falhas := falhas || ('R3 ' || sqlerrm); end if;
  end;
  total := total + 1;
  begin
    r2 := reservar_data(o2, '2027-06-11 06:00-03', '2027-06-11 12:00-03', array[menor]);
  exception when others then falhas := falhas || ('R4 recusou horário logo após a limpeza: ' || sqlerrm); end;
  total := total + 1;
  begin
    r3 := reservar_data(o3, ini, fim, array[maior]);
  exception when others then falhas := falhas || ('R5 espaços não são independentes: ' || sqlerrm); end;
  total := total + 1;
  begin
    perform liberar_bloqueio(r3);
    perform reservar_data(o3, ini, fim, array[menor, maior]);
    falhas := falhas || 'R6 atendimento reservou os dois espaços sem aprovação';
  exception when insufficient_privilege then null; end;
  total := total + 1;
  begin
    perform reservar_data(o1, ini + interval '30 days', fim + interval '30 days', array[menor]);
    falhas := falhas || 'R7 mesmo orçamento reservou duas datas';
  exception when others then
    if sqlerrm not like 'STATUS_INVALIDO%' then falhas := falhas || ('R7 ' || sqlerrm); end if;
  end;
  perform set_config('role', 'none', true);

  ------------------------------------------------ bloqueio administrativo
  perform set_config('request.jwt.claims', json_build_object('sub', a_ope, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  total := total + 1;
  begin
    b1 := bloquear_agenda(array[maior], '2027-07-01 08:00-03', '2027-07-03 08:00-03', 'Pintura do salão');
  exception when others then falhas := falhas || ('R8 operacional não bloqueou a agenda: ' || sqlerrm); end;
  total := total + 1;
  begin
    perform remover_bloqueio_agenda(b1);
    falhas := falhas || 'R9 operacional removeu bloqueio sem permissão';
  exception when insufficient_privilege then null; end;
  perform set_config('role', 'none', true);

  ------------------------------------------------ contrato
  perform set_config('request.jwt.claims', json_build_object('sub', a_atd, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  total := total + 1;
  begin
    perform gerar_contrato(r2, 1, 'Marileide', texto, '{}');
    falhas := falhas || 'R10 gerou contrato para cliente sem CPF e endereço';
  exception when others then
    if sqlerrm not like 'CONTRATO_DADOS_CLIENTE%' then falhas := falhas || ('R10 ' || sqlerrm); end if;
  end;
  k1 := gerar_contrato(r1, 1, 'Marileide Costa Melo Santos', texto, '{"teste": true}');
  total := total + 1;
  select count(*) into n from parcelas where reserva_id = r1;
  if n <> 2 or (select valor_centavos from parcelas where reserva_id = r1 and numero = 1) <> 50001
     or (select valor_centavos from parcelas where reserva_id = r1 and numero = 2) <> 50000
     or (select vencimento from parcelas where reserva_id = r1 and numero = 2) <> '2027-06-03' then
    falhas := falhas || 'R11 parcelas 50/50 com saldo 7 dias antes erradas';
  end if;
  total := total + 1;
  if (select conteudo_hash from contratos where id = k1) is null then falhas := falhas || 'R12 contrato sem impressão digital'; end if;
  total := total + 1;
  begin
    perform confirmar_reserva(r1);
    falhas := falhas || 'R13 atendimento confirmou reserva';
  exception when insufficient_privilege then null; end;
  perform registrar_assinatura(k1, hoje_delta(), 'presencial', 'estabelecimento', null);
  total := total + 1;
  begin
    perform registrar_pagamento((select id from parcelas where reserva_id = r1 and numero = 1), 50001, 'pix', hoje_delta());
    falhas := falhas || 'R14 atendimento deu baixa em pagamento';
  exception when insufficient_privilege then null; end;
  perform set_config('role', 'none', true);
  total := total + 1;
  begin
    update contratos set texto = 'alterado' where id = k1;
    falhas := falhas || 'R15 contrato assinado alterado direto no banco';
  exception when others then
    if sqlerrm not like 'CONTRATO_%IMUTAVEL%' then falhas := falhas || ('R15 ' || sqlerrm); end if;
  end;

  ------------------------------------------------ pagamento e confirmação (cenário 3)
  perform set_config('request.jwt.claims', json_build_object('sub', a_fin, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select id into p1 from parcelas where reserva_id = r1 and numero = 1;
  select id into p2 from parcelas where reserva_id = r1 and numero = 2;
  total := total + 1;
  begin
    perform registrar_pagamento(p1, 60000, 'pix', hoje_delta());
    falhas := falhas || 'R16 aceitou pagamento acima do saldo';
  exception when others then
    if sqlerrm not like 'VALOR_INVALIDO%' then falhas := falhas || ('R16 ' || sqlerrm); end if;
  end;
  g1 := registrar_pagamento(p1, 30000, 'pix', hoje_delta(), 'Pix parcial', 'inter', 'E2E-TESTE-1');
  total := total + 1;
  begin
    perform confirmar_reserva(r1);
    falhas := falhas || 'R17 confirmou com entrada parcial';
  exception when others then
    if sqlerrm not like 'ENTRADA_NAO_CONFIRMADA%' then falhas := falhas || ('R17 ' || sqlerrm); end if;
  end;
  total := total + 1;
  begin
    perform registrar_pagamento(p1, 20001, 'pix', hoje_delta(), null, 'inter', 'E2E-TESTE-1');
    falhas := falhas || 'R18 mesmo Pix registrado duas vezes';
  exception when others then
    if sqlerrm not like 'PAGAMENTO_DUPLICADO%' then falhas := falhas || ('R18 ' || sqlerrm); end if;
  end;
  perform registrar_pagamento(p1, 20001, 'pix', hoje_delta(), null, 'inter', 'E2E-TESTE-2');
  perform confirmar_reserva(r1);
  total := total + 1;
  if (select status from reservas where id = r1) <> 'confirmada'
     or not exists (select 1 from tarefas where orcamento_id = o1 and titulo like 'Cobrar o saldo%') then
    falhas := falhas || 'R19 reserva não confirmou ou não criou a tarefa de cobrança do saldo';
  end if;
  total := total + 1;
  begin
    update pagamentos set valor_centavos = 1 where id = g1;
    falhas := falhas || 'R20 pagamento editado';
  exception when others then
    if sqlerrm not like 'REGISTRO_IMUTAVEL%' and sqlstate <> '42501' then falhas := falhas || ('R20 ' || sqlerrm); end if;
  end;
  total := total + 1;
  begin
    perform estornar_pagamento(g1, 1000, 'teste');
    falhas := falhas || 'R21 financeiro estornou sem permissão';
  exception when insufficient_privilege then null; end;
  perform set_config('role', 'none', true);

  perform set_config('request.jwt.claims', json_build_object('sub', a_adm, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform estornar_pagamento(g1, 10000, 'Cobrança a maior, combinado com o cliente');
  total := total + 1;
  if (select pago_centavos from parcelas_situacao where parcela_id = p1) <> 40001 then
    falhas := falhas || 'R22 estorno não reduziu o pago (livro só de inclusão)';
  end if;
  total := total + 1;
  begin
    perform estornar_pagamento(g1, 25000, 'acima do recebido');
    falhas := falhas || 'R23 estornou mais do que o recebido';
  exception when others then
    if sqlerrm not like 'VALOR_INVALIDO%' then falhas := falhas || ('R23 ' || sqlerrm); end if;
  end;

  ------------------------------------------------ cancelamento pela política
  j := calcular_cancelamento(r1, 'cliente', '2026-11-10');
  total := total + 1;
  if (j ->> 'percentual')::int <> 10 or (j ->> 'multa_centavos')::bigint <> 10000 or (j ->> 'devolver_centavos')::bigint <> 30001 then
    falhas := falhas || ('R24 cálculo do cancelamento com mais de 120 dias errado: ' || j::text);
  end if;
  j := calcular_cancelamento(r1, 'cliente', '2027-06-05');
  total := total + 1;
  if (j ->> 'percentual')::int <> 35 or (j ->> 'cobrar_centavos')::bigint <> 0 or (j ->> 'devolver_centavos')::bigint <> 5001 then
    falhas := falhas || ('R25 cálculo com 5 dias errado: ' || j::text);
  end if;
  j := calcular_cancelamento(r1, 'delta', '2026-11-10');
  total := total + 1;
  if (j ->> 'devolver_centavos')::bigint <> 50001 then falhas := falhas || ('R26 cancelamento pela Delta não soma a multa: ' || j::text); end if;
  total := total + 1;
  begin
    perform cancelar_reserva(r1, 'arrependimento', 'cliente desistiu');
    falhas := falhas || 'R27 aceitou arrependimento de contrato fechado no estabelecimento';
  exception when others then
    if sqlerrm not like 'STATUS_INVALIDO: Não se aplica%' then falhas := falhas || ('R27 ' || sqlerrm); end if;
  end;
  j := cancelar_reserva(r1, 'cliente', 'Cliente mudou de cidade');
  total := total + 1;
  if (select status from reservas where id = r1) <> 'cancelada' or (select status from contratos where id = k1) <> 'cancelado'
     or exists (select 1 from reserva_periodos where reserva_id = r1 and ativo)
     or not exists (select 1 from tarefas where orcamento_id = o1 and titulo like 'Devolver%' and concluida_em is null) then
    falhas := falhas || 'R28 cancelamento não liberou a data, não cancelou o contrato ou não criou a tarefa de devolução';
  end if;
  total := total + 1;
  begin
    perform remover_bloqueio_agenda(b1);
  exception when others then falhas := falhas || ('R29 administração não removeu bloqueio: ' || sqlerrm); end;

  ------------------------------------------------ contratação a menos de 7 dias: parcela única
  r4 := reservar_data(o4, now() + interval '3 days', now() + interval '3 days 5 hours', array[menor]);
  perform gerar_contrato(r4, 1, 'Marileide Costa Melo Santos', texto, '{}');
  total := total + 1;
  if (select count(*) from parcelas where reserva_id = r4) <> 1 or (select valor_centavos from parcelas where reserva_id = r4) <> 100001 then
    falhas := falhas || 'R30 contratação a menos de 7 dias não gerou parcela única integral';
  end if;

  ------------------------------------------------ pagamento tardio em data ocupada após expirar
  r5 := reservar_data(o5, '2027-08-20 19:00-03', '2027-08-20 23:00-03', array[menor]);
  k3 := gerar_contrato(r5, 1, 'Marileide Costa Melo Santos', texto, '{}');
  perform registrar_assinatura(k3, hoje_delta(), 'presencial', 'estabelecimento', null);
  perform set_config('role', 'none', true);
  update reservas set expira_em = now() - interval '1 minute' where id = r5;   -- simula 24 h depois
  perform expirar_bloqueios();
  total := total + 1;
  if (select status from reservas where id = r5) <> 'expirada' or exists (select 1 from reserva_periodos where reserva_id = r5 and ativo) then
    falhas := falhas || 'R31 bloqueio vencido não expirou ou não liberou a data';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', a_adm, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform liberar_bloqueio(r2);
  perform reservar_data(o2, '2027-08-20 20:00-03', '2027-08-20 23:30-03', array[menor]);  -- outro cliente ocupa a data
  perform registrar_pagamento((select id from parcelas where reserva_id = r5 and numero = 1), 50001, 'pix', hoje_delta());
  total := total + 1;
  begin
    perform confirmar_reserva(r5);
    falhas := falhas || 'R32 confirmou reserva em data já ocupada por outro cliente';
  exception when others then
    if sqlerrm not like 'DATA_INDISPONIVEL%' then falhas := falhas || ('R32 ' || sqlerrm); end if;
  end;
  total := total + 1;
  if (select pago_centavos from parcelas_situacao where reserva_id = r5 and numero = 1) <> 50001 then
    falhas := falhas || 'R33 pagamento tardio não ficou registrado (dinheiro recebido some)';
  end if;
  perform set_config('role', 'none', true);

  t := format('RESULTADO %s de %s testes passaram', total - coalesce(array_length(falhas, 1), 0), total);
  if array_length(falhas, 1) > 0 then t := t || E'\nFALHAS:\n- ' || array_to_string(falhas, E'\n- '); end if;
  raise exception '%', t;
end $$;
