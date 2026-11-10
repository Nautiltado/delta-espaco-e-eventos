-- Testes da Fase 2 (Fundação). Rodam como um único bloco e terminam SEMPRE com uma exceção
-- "RESULTADO ..." para desfazer tudo: nenhum dado de teste fica no banco.
-- Uso: cole no SQL Editor do Supabase (ou execute pelo conector) e leia a mensagem de erro final.
do $$
declare
  falhas text[] := '{}';
  total int := 0;
  inst uuid := '00000000-0000-0000-0000-000000000000';
  u_atd uuid; u_coz uuid; u_fin uuid; u_ina uuid; u_adm uuid;
  a_atd uuid := gen_random_uuid(); a_coz uuid := gen_random_uuid(); a_fin uuid := gen_random_uuid();
  a_ina uuid := gen_random_uuid(); a_adm uuid := gen_random_uuid();
  v_cli uuid; v_rec uuid; v_res1 uuid; v_res2 uuid;
  c int; j jsonb; t text;
begin
  ---------------------------------------------------------------- dados de teste
  insert into usuarios (nome, email) values ('Teste Atendimento', 'teste.atd@delta.test') returning id into u_atd;
  insert into usuarios (nome, email) values ('Teste Cozinha',     'teste.coz@delta.test') returning id into u_coz;
  insert into usuarios (nome, email) values ('Teste Financeiro',  'teste.fin@delta.test') returning id into u_fin;
  insert into usuarios (nome, email) values ('Teste Inativo',     'teste.ina@delta.test') returning id into u_ina;
  insert into usuarios (nome, email) values ('Teste Admin',       'teste.adm@delta.test') returning id into u_adm;
  insert into usuarios_perfis values (u_atd,'ATD'),(u_coz,'COZ'),(u_fin,'FIN'),(u_ina,'ATD'),(u_adm,'ADM');
  insert into auth.users (instance_id, id, aud, role, email) values
    (inst, a_atd, 'authenticated', 'authenticated', 'teste.atd@delta.test'),
    (inst, a_coz, 'authenticated', 'authenticated', 'teste.coz@delta.test'),
    (inst, a_fin, 'authenticated', 'authenticated', 'Teste.Fin@delta.test'),
    (inst, a_ina, 'authenticated', 'authenticated', 'teste.ina@delta.test'),
    (inst, a_adm, 'authenticated', 'authenticated', 'teste.adm@delta.test');
  update usuarios set ativo = false where id = u_ina;
  insert into clientes (tipo, nome, documento) values ('PF', 'Cliente Teste', '00000000191') returning id into v_cli;
  insert into recursos (nome, tipo) values ('Espaço Teste', 'espaco') returning id into v_rec;

  ---------------------------------------------------------------- login e vínculo
  total := total + 1;
  if (select count(*) from usuarios where auth_user_id in (a_atd, a_coz, a_fin, a_ina, a_adm)) <> 5 then
    falhas := falhas || 'L1 contas de login não foram vinculadas aos cadastros (inclusive e-mail com maiúsculas)';
  end if;

  total := total + 1;
  begin
    insert into auth.users (instance_id, id, aud, role, email)
    values (inst, gen_random_uuid(), 'authenticated', 'authenticated', 'desconhecido@delta.test');
    falhas := falhas || 'L2 e-mail não cadastrado conseguiu criar conta';
  exception when others then
    if sqlerrm not like 'ACESSO_NAO_AUTORIZADO%' then falhas := falhas || ('L2 erro inesperado: ' || sqlerrm); end if;
  end;

  ---------------------------------------------------------------- visitante sem login (anon)
  perform set_config('role', 'anon', true);
  total := total + 1;
  begin
    perform count(*) from clientes;
    falhas := falhas || 'A1 visitante sem login leu clientes';
  exception when insufficient_privilege then null;
  end;
  total := total + 1;
  begin
    perform count(*) from configuracoes;
    falhas := falhas || 'A2 visitante sem login leu configurações';
  exception when insufficient_privilege then null;
  end;
  perform set_config('role', 'none', true);

  ---------------------------------------------------------------- Cozinha
  perform set_config('request.jwt.claims', json_build_object('sub', a_coz, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  total := total + 1;
  if usuario_atual() is distinct from u_coz then falhas := falhas || 'C1 sessão da cozinha não resolve o usuário'; end if;
  total := total + 1;
  j := meu_acesso();
  if not (j -> 'permissoes') ? 'producao.status' or (j -> 'permissoes') ? 'cliente.ver' then
    falhas := falhas || 'C2 permissões da cozinha erradas';
  end if;
  total := total + 1;
  select count(*) into c from clientes;
  if c <> 0 then falhas := falhas || 'C3 cozinha vê dados pessoais de clientes'; end if;
  total := total + 1;
  begin
    insert into clientes (tipo, nome, documento) values ('PF', 'Invasor', '11111111111');
    falhas := falhas || 'C4 cozinha cadastrou cliente';
  exception when insufficient_privilege then null;
  end;
  total := total + 1;
  update configuracoes set valor = '99' where chave = 'reserva.bloqueio_horas';
  get diagnostics c = row_count;
  if c <> 0 then falhas := falhas || 'C5 cozinha alterou configuração'; end if;
  total := total + 1;
  select count(*) into c from auditoria;
  if c <> 0 then falhas := falhas || 'C6 cozinha vê auditoria'; end if;
  total := total + 1;
  select count(*) into c from usuarios;
  if c <> 1 then falhas := falhas || ('C7 cozinha vê ' || c || ' usuários (deveria ver só a si)'); end if;
  total := total + 1;
  begin
    insert into usuarios_perfis values (u_coz, 'ADM');
    falhas := falhas || 'C8 cozinha se promoveu a administradora';
  exception when insufficient_privilege then null;
  end;
  perform set_config('role', 'none', true);

  ---------------------------------------------------------------- Atendimento
  perform set_config('request.jwt.claims', json_build_object('sub', a_atd, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  total := total + 1;
  select count(*) into c from clientes;
  if c < 1 then falhas := falhas || 'T1 atendimento não vê clientes'; end if;
  total := total + 1;
  begin
    insert into clientes (tipo, nome, documento) values ('PJ', 'Empresa Teste', '11222333000181');
  exception when others then falhas := falhas || ('T2 atendimento não cadastra cliente: ' || sqlerrm);
  end;
  total := total + 1;
  begin
    insert into reservas (cliente_id, valor_total_centavos, expira_em) values (v_cli, 100000, now() + interval '1 day');
    falhas := falhas || 'T3 atendimento gravou reserva direto na tabela';
  exception when insufficient_privilege then null;
  end;
  total := total + 1;
  begin
    perform criar_bloqueio_temporario(v_cli, 100000, array[v_rec], tstzrange(now(), now() + interval '5 hours'));
    falhas := falhas || 'T4 atendimento chamou função de reserva ainda não liberada';
  exception when insufficient_privilege then null;
  end;
  total := total + 1;
  select count(*) into c from auditoria;
  if c <> 0 then falhas := falhas || 'T5 atendimento vê auditoria'; end if;
  perform set_config('role', 'none', true);

  ---------------------------------------------------------------- Financeiro
  perform set_config('request.jwt.claims', json_build_object('sub', a_fin, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  total := total + 1;
  begin
    insert into clientes (tipo, nome, documento) values ('PF', 'Outro', '22222222222');
    falhas := falhas || 'F1 financeiro cadastrou cliente (só leitura)';
  exception when insufficient_privilege then null;
  end;
  total := total + 1;
  select count(*) into c from clientes;
  if c < 1 then falhas := falhas || 'F2 financeiro não vê clientes'; end if;
  perform set_config('role', 'none', true);

  ---------------------------------------------------------------- Usuário desativado
  perform set_config('request.jwt.claims', json_build_object('sub', a_ina, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  total := total + 1;
  if usuario_atual() is not null or meu_acesso() is not null then falhas := falhas || 'D1 usuário desativado ainda é reconhecido'; end if;
  total := total + 1;
  select count(*) into c from clientes;
  if c <> 0 then falhas := falhas || 'D2 usuário desativado vê clientes'; end if;
  perform set_config('role', 'none', true);

  ---------------------------------------------------------------- Sessão de login sem cadastro
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  total := total + 1;
  select count(*) into c from configuracoes;
  if c <> 0 then falhas := falhas || 'S1 sessão sem cadastro lê configurações'; end if;
  perform set_config('role', 'none', true);

  ---------------------------------------------------------------- Administrador
  perform set_config('request.jwt.claims', json_build_object('sub', a_adm, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  total := total + 1;
  update configuracoes set valor = '48' where chave = 'reserva.bloqueio_horas';
  get diagnostics c = row_count;
  if c <> 1 then falhas := falhas || 'M1 administrador não alterou configuração'; end if;
  total := total + 1;
  if not exists (select 1 from auditoria where tabela = 'configuracoes' and registro_id = 'reserva.bloqueio_horas'
                   and usuario = u_adm and antes ->> 'valor' = '24' and depois ->> 'valor' = '48') then
    falhas := falhas || 'M2 alteração de configuração não ficou na auditoria com autor, antes e depois';
  end if;
  total := total + 1;
  if (select atualizado_por from configuracoes where chave = 'reserva.bloqueio_horas') is distinct from u_adm then
    falhas := falhas || 'M3 configuração não registra quem alterou';
  end if;
  total := total + 1;
  begin
    update configuracoes set valor = '150' where chave = 'financeiro.sinal_percentual';
    falhas := falhas || 'M4 aceitou percentual de 150';
  exception when others then
    if sqlerrm not like 'CONFIG_INVALIDA%' then falhas := falhas || ('M4 erro inesperado: ' || sqlerrm); end if;
  end;
  total := total + 1;
  begin
    update configuracoes set valor = '{"min":500,"max":100}' where chave = 'espaco.menor.faixa_preco';
    falhas := falhas || 'M5 aceitou faixa com mínimo maior que o máximo';
  exception when others then
    if sqlerrm not like 'CONFIG_INVALIDA%' then falhas := falhas || ('M5 erro inesperado: ' || sqlerrm); end if;
  end;
  total := total + 1;
  select count(*) into c from usuarios;
  if c < 7 then falhas := falhas || 'M6 administrador não vê todos os usuários'; end if;
  total := total + 1;
  update usuarios set ativo = false where id = u_atd;
  get diagnostics c = row_count;
  if c <> 1 then falhas := falhas || 'M7 administrador não desativou usuário'; end if;
  total := total + 1;
  begin
    delete from usuarios where id = u_coz;
    falhas := falhas || 'M8 usuário foi excluído (deveria só desativar)';
  exception when others then
    if sqlerrm not like 'REGISTRO_IMUTAVEL%' then falhas := falhas || ('M8 erro inesperado: ' || sqlerrm); end if;
  end;
  total := total + 1;
  begin
    insert into reservas (cliente_id, valor_total_centavos, expira_em) values (v_cli, 100000, now() + interval '1 day');
    falhas := falhas || 'M9 administrador gravou reserva direto na tabela';
  exception when insufficient_privilege then null;
  end;
  perform set_config('role', 'none', true);

  ---------------------------------------------------------------- Regras do núcleo (como sistema)
  total := total + 1;
  begin
    update usuarios set ativo = false where id in (select usuario from usuarios_perfis where perfil = 'ADM');
    falhas := falhas || 'N1 todos os administradores foram desativados';
  exception when others then
    if sqlerrm not like 'SEM_ADMINISTRADOR%' then falhas := falhas || ('N1 erro inesperado: ' || sqlerrm); end if;
  end;
  total := total + 1;
  begin
    update auditoria set acao = 'X' where id = (select max(id) from auditoria);
    falhas := falhas || 'N2 auditoria foi alterada';
  exception when others then
    if sqlerrm not like 'REGISTRO_IMUTAVEL%' then falhas := falhas || ('N2 erro inesperado: ' || sqlerrm); end if;
  end;
  total := total + 1;
  v_res1 := criar_bloqueio_temporario(v_cli, 100000, array[v_rec],
              tstzrange('2027-03-20 14:00-03', '2027-03-21 02:00-03'));
  begin
    v_res2 := criar_bloqueio_temporario(v_cli, 100000, array[v_rec],
                tstzrange('2027-03-20 22:00-03', '2027-03-21 06:00-03'));
    falhas := falhas || 'N3 dois bloqueios sobrepostos no mesmo espaço';
  exception when others then
    if sqlerrm not like 'DATA_INDISPONIVEL%' then falhas := falhas || ('N3 erro inesperado: ' || sqlerrm); end if;
  end;
  total := total + 1;
  begin
    v_res2 := criar_bloqueio_temporario(v_cli, 100000, array[v_rec],
                tstzrange('2027-03-21 02:00-03', '2027-03-21 10:00-03'));
  exception when others then falhas := falhas || ('N4 horário encostado (sem sobreposição) foi recusado: ' || sqlerrm);
  end;
  total := total + 1;
  update reservas set status = 'cancelada' where id = v_res1;
  begin
    perform criar_bloqueio_temporario(v_cli, 100000, array[v_rec],
              tstzrange('2027-03-20 18:00-03', '2027-03-20 23:00-03'));
  exception when others then falhas := falhas || ('N5 data de reserva cancelada continuou bloqueada: ' || sqlerrm);
  end;

  ---------------------------------------------------------------- resultado (sempre desfaz)
  t := format('RESULTADO %s de %s testes passaram', total - coalesce(array_length(falhas, 1), 0), total);
  if array_length(falhas, 1) > 0 then
    t := t || E'\nFALHAS:\n- ' || array_to_string(falhas, E'\n- ');
  end if;
  raise exception '%', t;
end $$;

-- Cadastro de usuário e troca de perfis (migration funcoes_usuarios). Também termina desfazendo tudo.
do $$
declare
  falhas text[] := '{}'; total int := 0;
  inst uuid := '00000000-0000-0000-0000-000000000000';
  u_adm uuid; u_atd uuid; a_adm uuid := gen_random_uuid(); a_atd uuid := gen_random_uuid(); v uuid; t text;
begin
  insert into usuarios (nome, email) values ('Teste Admin', 'teste.adm@delta.test') returning id into u_adm;
  insert into usuarios (nome, email) values ('Teste Atd', 'teste.atd@delta.test') returning id into u_atd;
  insert into usuarios_perfis values (u_adm,'ADM'),(u_atd,'ATD');
  insert into auth.users (instance_id, id, aud, role, email) values
    (inst, a_adm, 'authenticated', 'authenticated', 'teste.adm@delta.test'),
    (inst, a_atd, 'authenticated', 'authenticated', 'teste.atd@delta.test');

  perform set_config('request.jwt.claims', json_build_object('sub', a_atd, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  total := total + 1;
  begin perform criar_usuario('Invasor', 'inv@delta.test', array['ADM']); falhas := falhas || 'U1 atendimento criou usuário';
  exception when insufficient_privilege then null; end;
  total := total + 1;
  begin perform definir_perfis(u_atd, array['ADM']);
    if exists (select 1 from usuarios_perfis where usuario = u_atd and perfil = 'ADM') then falhas := falhas || 'U2 atendimento se promoveu'; end if;
  exception when insufficient_privilege then null; end;
  perform set_config('role', 'none', true);

  perform set_config('request.jwt.claims', json_build_object('sub', a_adm, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  total := total + 1;
  v := criar_usuario('  Nova Pessoa ', 'Nova@Delta.test', array['ATD','COZ']);
  if (select count(*) from usuarios_perfis where usuario = v) <> 2 or (select email from usuarios where id = v) <> 'nova@delta.test' then
    falhas := falhas || 'U3 criar_usuario não gravou cadastro e perfis'; end if;
  total := total + 1;
  begin perform criar_usuario('Repetido', 'nova@delta.test', array['ATD']); falhas := falhas || 'U4 aceitou e-mail repetido';
  exception when others then if sqlerrm not like 'EMAIL_JA_CADASTRADO%' then falhas := falhas || ('U4 ' || sqlerrm); end if; end;
  total := total + 1;
  begin perform criar_usuario('Sem perfil', 'sp@delta.test', array[]::text[]); falhas := falhas || 'U5 aceitou sem perfil';
  exception when others then if sqlerrm not like 'PERFIL_OBRIGATORIO%' then falhas := falhas || ('U5 ' || sqlerrm); end if; end;
  total := total + 1;
  perform definir_perfis(v, array['FIN']);
  if (select array_agg(perfil) from usuarios_perfis where usuario = v) <> array['FIN'] then falhas := falhas || 'U6 definir_perfis não trocou'; end if;
  perform set_config('role', 'none', true);

  total := total + 1;
  begin
    perform set_config('app.usuario', u_adm::text, true);
    update usuarios set ativo = false where id in (select usuario from usuarios_perfis where perfil='ADM' and usuario <> u_adm);
    perform definir_perfis(u_adm, array['ATD']);
    falhas := falhas || 'U7 removeu o último administrador';
  exception when others then if sqlerrm not like 'SEM_ADMINISTRADOR%' then falhas := falhas || ('U7 ' || sqlerrm); end if; end;

  t := format('RESULTADO %s de %s testes passaram', total - coalesce(array_length(falhas, 1), 0), total);
  if array_length(falhas, 1) > 0 then t := t || E'\nFALHAS:\n- ' || array_to_string(falhas, E'\n- '); end if;
  raise exception '%', t;
end $$;
