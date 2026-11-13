-- Testes da Fase 7 (ficha, equipe, checklist, gastos e notas). Terminam com "RESULTADO ..." e desfazem tudo.
do $$
declare
  falhas text[] := '{}'; total int := 0; inst uuid := '00000000-0000-0000-0000-000000000000';
  u_atd uuid; u_coz uuid; u_adm uuid; u_fin uuid;
  a_atd uuid := gen_random_uuid(); a_coz uuid := gen_random_uuid(); a_adm uuid := gen_random_uuid(); a_fin uuid := gen_random_uuid();
  ev uuid := (select id from reservas where tipo = 'evento' order by criado_em desc limit 1);
  f jsonb; eq uuid; c1 uuid; c2 uuid; it uuid; n int;
begin
  if ev is null then raise exception 'RESULTADO sem evento para testar'; end if;
  insert into usuarios (nome, email) values ('T7 Atd', 't7.atd@delta.test') returning id into u_atd;
  insert into usuarios (nome, email) values ('T7 Coz', 't7.coz@delta.test') returning id into u_coz;
  insert into usuarios (nome, email) values ('T7 Adm', 't7.adm@delta.test') returning id into u_adm;
  insert into usuarios (nome, email) values ('T7 Fin', 't7.fin@delta.test') returning id into u_fin;
  insert into usuarios_perfis values (u_atd,'ATD'),(u_coz,'COZ'),(u_adm,'ADM'),(u_fin,'FIN');
  insert into auth.users (instance_id, id, aud, role, email) values
    (inst, a_atd, 'authenticated', 'authenticated', 't7.atd@delta.test'), (inst, a_coz, 'authenticated', 'authenticated', 't7.coz@delta.test'),
    (inst, a_adm, 'authenticated', 'authenticated', 't7.adm@delta.test'), (inst, a_fin, 'authenticated', 'authenticated', 't7.fin@delta.test');

  ------------------------------------------------ cozinha: vê a ficha, não monta equipe, não vê gastos
  perform set_config('request.jwt.claims', json_build_object('sub', a_coz, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  f := ficha_evento(ev);
  total := total + 1;
  if f->>'id' <> ev::text or jsonb_typeof(f->'itens') <> 'array' then falhas := falhas || 'E1 ficha sem dados'; end if;
  total := total + 1;
  if f->'valor_total_centavos' <> 'null'::jsonb then falhas := falhas || 'E2 cozinha vê o valor do evento'; end if;
  total := total + 1;
  begin
    perform adicionar_equipe(ev, 'garcom', 2, 18000, 'Kaká', null);
    falhas := falhas || 'E3 cozinha montou equipe';
  exception when others then if sqlerrm not like 'SEM_PERMISSAO%' then falhas := falhas || ('E3 ' || sqlerrm); end if; end;
  perform preparar_checklist(ev);
  perform preparar_checklist(ev);
  total := total + 1;
  if (select count(*) from evento_checklist where reserva_id = ev) <> 16 then falhas := falhas || 'E4 lista padrão não tem 16 itens (ou duplicou)'; end if;
  it := (select id from evento_checklist where reserva_id = ev and etapa = 'montagem' order by ordem limit 1);
  perform marcar_checklist(it, true);
  total := total + 1;
  if (select feito_por from evento_checklist where id = it) <> u_coz then falhas := falhas || 'E5 não guardou quem marcou'; end if;
  perform marcar_checklist(it, false);
  total := total + 1;
  if (select feito_em from evento_checklist where id = it) is not null then falhas := falhas || 'E6 não desmarcou'; end if;

  ------------------------------------------------ administração: equipe e gastos
  perform set_config('request.jwt.claims', json_build_object('sub', a_adm, 'role', 'authenticated')::text, true);
  eq := adicionar_equipe(ev, 'garcom', 3, 18000, 'Kaká', null);
  total := total + 1;
  if (select quantidade * valor_unitario_centavos from evento_equipe where id = eq) <> 54000 then falhas := falhas || 'E7 equipe com total errado'; end if;
  perform pagar_equipe(eq, current_date);
  total := total + 1;
  begin
    perform remover_equipe(eq);
    falhas := falhas || 'E8 removeu equipe já paga';
  exception when others then if sqlerrm not like 'STATUS_INVALIDO%' then falhas := falhas || ('E8 ' || sqlerrm); end if; end;
  perform pagar_equipe(eq, null);
  perform remover_equipe(eq);
  total := total + 1;
  if exists (select 1 from evento_equipe where id = eq) then falhas := falhas || 'E9 não removeu equipe'; end if;

  c1 := registrar_custo_evento(ev, 'compras', 'Carne do Atacadão', 'Atacadão', 45090, current_date, true);
  c2 := registrar_custo_evento(ev, 'gas', 'Botijão', null, 12000, current_date, false);
  total := total + 1;
  if (select sum(valor_centavos) from evento_custos where reserva_id = ev and removido_em is null) <> 57090 then falhas := falhas || 'E10 soma dos gastos'; end if;
  total := total + 1;
  begin
    perform registrar_custo_evento(ev, 'compras', 'X', null, 0, null, true);
    falhas := falhas || 'E11 gasto zerado aceito';
  exception when others then if sqlerrm not like 'VALOR_INVALIDO%' then falhas := falhas || ('E11 ' || sqlerrm); end if; end;
  total := total + 1;
  begin
    perform remover_custo_evento(c2, '');
    falhas := falhas || 'E12 removeu gasto sem motivo';
  exception when others then if sqlerrm not like 'JUSTIFICATIVA_OBRIGATORIA%' then falhas := falhas || ('E12 ' || sqlerrm); end if; end;
  perform remover_custo_evento(c2, 'lançado em dobro');
  total := total + 1;
  if (select removido_em from evento_custos where id = c2) is null then falhas := falhas || 'E13 não tirou o gasto'; end if;
  total := total + 1;
  begin
    perform registrar_nota(ev, c1, ev::text || '/nao-existe.pdf', 'nota.pdf', 'application/pdf', 1000);
    falhas := falhas || 'E14 nota sem arquivo aceita';
  exception when others then if sqlerrm not like 'STATUS_INVALIDO%' then falhas := falhas || ('E14 ' || sqlerrm); end if; end;
  perform marcar_custo_pago(c1, false);
  total := total + 1;
  if (select pago from evento_custos where id = c1) then falhas := falhas || 'E15 não marcou como a pagar'; end if;

  ------------------------------------------------ cozinha não lê gastos; atendimento escreve a ficha mas não a equipe
  perform set_config('request.jwt.claims', json_build_object('sub', a_coz, 'role', 'authenticated')::text, true);
  total := total + 1;
  if (select count(*) from evento_custos where reserva_id = ev) <> 0 then falhas := falhas || 'E16 cozinha vê gastos'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', a_atd, 'role', 'authenticated')::text, true);
  perform salvar_ficha_evento(ev, '17:30', 'Camisa preta', 'Bolo chega às 18h');
  total := total + 1;
  if (select traje from evento_fichas where reserva_id = ev) <> 'Camisa preta' then falhas := falhas || 'E17 ficha não salvou'; end if;
  total := total + 1;
  begin
    perform adicionar_equipe(ev, 'garcom', 2, 18000, 'Kaká', null);
    falhas := falhas || 'E18 atendimento montou equipe';
  exception when others then if sqlerrm not like 'SEM_PERMISSAO%' then falhas := falhas || ('E18 ' || sqlerrm); end if; end;

  ------------------------------------------------ financeiro lança gasto; ninguém apaga gasto
  perform set_config('request.jwt.claims', json_build_object('sub', a_fin, 'role', 'authenticated')::text, true);
  perform registrar_custo_evento(ev, 'bebidas', 'Refrigerantes', null, 8000, null, true);
  total := total + 1;
  if (select count(*) from evento_custos where reserva_id = ev and categoria = 'bebidas') <> 1 then falhas := falhas || 'E19 financeiro não lançou'; end if;
  perform set_config('role', 'none', true);
  total := total + 1;
  begin
    delete from evento_custos where id = c1;
    falhas := falhas || 'E20 gasto apagado';
  exception when others then null; end;

  raise exception '%', format('RESULTADO %s de %s testes passaram', total - coalesce(array_length(falhas, 1), 0), total)
    || case when array_length(falhas, 1) > 0 then E'\nFALHAS:\n- ' || array_to_string(falhas, E'\n- ') else '' end;
end $$;
