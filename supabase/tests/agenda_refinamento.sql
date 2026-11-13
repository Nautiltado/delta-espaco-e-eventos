-- Testes da agenda refinada (tempos por espaço/evento, disponibilidade, bloqueio, detalhes). Desfaz tudo no fim.
do $$
declare
  falhas text[] := '{}'; total int := 0; inst uuid := '00000000-0000-0000-0000-000000000000';
  u_adm uuid; u_atd uuid; a_adm uuid := gen_random_uuid(); a_atd uuid := gen_random_uuid();
  menor uuid := (select id from recursos where nome = 'Espaço menor');
  maior uuid := (select id from recursos where nome = 'Espaço maior');
  cli uuid; o1 uuid; o2 uuid; o3 uuid; r1 uuid; r2 uuid; b1 uuid; per tstzrange; n int; j jsonb;
  ini timestamptz := '2031-03-15 19:00-03'; fim timestamptz := '2031-03-15 23:00-03';
begin
  insert into usuarios (nome, email) values ('TA Adm', 'ta.adm@delta.test') returning id into u_adm;
  insert into usuarios (nome, email) values ('TA Atd', 'ta.atd@delta.test') returning id into u_atd;
  insert into usuarios_perfis values (u_adm, 'ADM'), (u_atd, 'ATD');
  insert into auth.users (instance_id, id, aud, role, email) values
    (inst, a_adm, 'authenticated', 'authenticated', 'ta.adm@delta.test'), (inst, a_atd, 'authenticated', 'authenticated', 'ta.atd@delta.test');
  insert into clientes (tipo, nome) values ('PF', 'Cliente Agenda (teste)') returning id into cli;

  perform set_config('request.jwt.claims', json_build_object('sub', a_adm, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  o1 := criar_orcamento(cli, 'Teste A1', 'espaco_buffet', null, null, 100, menor, null);
  o2 := criar_orcamento(cli, 'Teste A2', 'espaco_buffet', null, null, 100, maior, null);
  o3 := criar_orcamento(cli, 'Teste A3', 'espaco_buffet', null, null, 100, maior, null);

  -- A1: padrão = 0 h antes, 4 h depois (nada mudou)
  r1 := reservar_data(o1, ini, fim, array[menor]);
  select periodo into per from reserva_periodos where reserva_id = r1;
  total := total + 1;
  if per <> tstzrange(ini, fim + interval '4 hours', '[)') then falhas := falhas || ('A1 folga padrão mudou: ' || per::text); end if;

  -- A2: espaço com limpeza própria (2 h) e reorganização (1 h)
  perform definir_tempos_espaco(maior, null, null, 2, 1);
  -- A3: evento com montagem 3 h e desmontagem 1 h no espaço maior
  r2 := reservar_data(o2, ini, fim, array[maior], 3, 1);
  select periodo into per from reserva_periodos where reserva_id = r2;
  total := total + 1;
  if per <> tstzrange(ini - interval '3 hours', fim + interval '4 hours', '[)') then falhas := falhas || ('A3 folga por evento/espaço: ' || per::text); end if;

  -- A4: espaços independentes na consulta
  select count(*) into n from verificar_disponibilidade(array[menor, maior], ini + interval '1 hour', fim, true) v where not v.livre;
  total := total + 1;
  if n <> 2 then falhas := falhas || ('A4 os dois deviam estar ocupados: ' || n); end if;
  select count(*) into n from verificar_disponibilidade(array[menor], fim + interval '5 hours', fim + interval '9 hours', true) v where v.livre;
  total := total + 1;
  if n <> 1 then falhas := falhas || 'A4b menor devia estar livre depois da limpeza'; end if;
  total := total + 1;
  if (select conflito from verificar_disponibilidade(array[menor], ini, fim, true)) not like '%Espaço menor já está ocupado%' then falhas := falhas || 'A4c texto do conflito'; end if;

  -- A5: reservar em cima dá DATA_INDISPONIVEL (regra intacta)
  total := total + 1;
  begin
    perform reservar_data(o3, ini, fim, array[maior]);
    falhas := falhas || 'A5 reservou por cima';
  exception when others then if sqlerrm not like 'DATA_INDISPONIVEL%' then falhas := falhas || ('A5 ' || sqlerrm); end if; end;

  -- A6: bloqueio de vários dias com observações; não sobrescreve reserva
  b1 := bloquear_agenda(array[menor], '2031-04-01 00:00-03', '2031-04-04 00:00-03', 'Reforma (teste)', 'Pintura do salão');
  total := total + 1;
  if (select observacoes from reservas where id = b1) <> 'Pintura do salão' then falhas := falhas || 'A6 observações'; end if;
  total := total + 1;
  begin
    perform bloquear_agenda(array[menor], ini, fim, 'Por cima (teste)', null);
    falhas := falhas || 'A6b bloqueio sobrescreveu a reserva';
  exception when others then if sqlerrm not like 'DATA_INDISPONIVEL%' then falhas := falhas || ('A6b ' || sqlerrm); end if; end;

  -- A7: detalhes da agenda trazem cliente, convidados, espaços com período ocupado e quem bloqueou
  j := agenda_detalhes('2031-03-15 00:00-03', '2031-04-05 00:00-03');
  total := total + 1;
  if jsonb_array_length(j) <> 3 then falhas := falhas || ('A7 itens: ' || jsonb_array_length(j)); end if;
  total := total + 1;
  if not exists (select 1 from jsonb_array_elements(j) e where e->>'cliente' = 'Cliente Agenda (teste)' and (e->'orcamento'->>'convidados')::int = 100
                 and jsonb_array_length(e->'espacos') = 1) then falhas := falhas || 'A7b dados do evento'; end if;
  total := total + 1;
  if not exists (select 1 from jsonb_array_elements(j) e where e->>'tipo' = 'bloqueio_administrativo' and e->>'criado_por' = 'TA Adm') then falhas := falhas || 'A7c quem bloqueou'; end if;
  total := total + 1;
  if (select count(*) from usuarios_atendimento() where nome = 'TA Adm') <> 1 then falhas := falhas || 'A8 responsáveis'; end if;

  -- A9: atendimento não muda tempos dos espaços
  perform set_config('request.jwt.claims', json_build_object('sub', a_atd, 'role', 'authenticated')::text, true);
  total := total + 1;
  begin
    perform definir_tempos_espaco(menor, 1, 1, 1, 1);
    falhas := falhas || 'A9 atendimento mudou os tempos';
  exception when others then if sqlerrm not like 'SEM_PERMISSAO%' then falhas := falhas || ('A9 ' || sqlerrm); end if; end;
  total := total + 1;
  if jsonb_array_length(agenda_detalhes('2031-03-15 00:00-03', '2031-03-16 00:00-03')) <> 2 then falhas := falhas || 'A10 atendimento vê a agenda'; end if;

  raise exception '%', format('RESULTADO %s de %s testes passaram', total - coalesce(array_length(falhas, 1), 0), total)
    || case when array_length(falhas, 1) > 0 then E'\nFALHAS:\n- ' || array_to_string(falhas, E'\n- ') else '' end;
end $$;
