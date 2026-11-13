-- Testes do endurecimento de segurança. Desfaz tudo no fim (raise no final).
do $$
declare
  falhas text[] := '{}'; total int := 0; inst uuid := '00000000-0000-0000-0000-000000000000';
  a_atd uuid := gen_random_uuid(); u_atd uuid; cli uuid; orc uuid; t1 uuid; erro text; n int; s text;
  agora bigint := extract(epoch from now())::bigint;
begin
  insert into usuarios (nome, email) values ('TS Atd', 'ts.atd@delta.test') returning id into u_atd;
  insert into usuarios_perfis values (u_atd, 'ATD');
  insert into auth.users (instance_id, id, aud, role, email) values (inst, a_atd, 'authenticated', 'authenticated', 'ts.atd@delta.test');
  insert into clientes (tipo, nome) values ('PF', 'Cliente Seg (teste)') returning id into cli;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a_atd, 'role', 'authenticated', 'iat', agora)::text, true);

  -- S1: criar orçamento pela função continua funcionando
  orc := criar_orcamento(cli, 'Festa Seg (teste)', 'espaco');
  total := total + 1;
  if orc is null then falhas := falhas || 'S1 criar_orcamento'; end if;

  -- S2: editar o título direto pode
  total := total + 1; erro := null;
  begin update orcamentos set titulo = 'Festa Seg 2 (teste)' where id = orc; exception when others then erro := sqlerrm; end;
  if erro is not null then falhas := falhas || ('S2 ' || erro); end if;

  -- S3: mudar o status direto não pode
  total := total + 1; erro := null;
  begin update orcamentos set status = 'aprovado' where id = orc; exception when others then erro := sqlerrm; end;
  if erro is null or erro not like '%permission denied%' then falhas := falhas || ('S3 ' || coalesce(erro, 'mudou')); end if;

  -- S4: inventar autor ao criar não pode
  total := total + 1; erro := null;
  begin insert into orcamentos (cliente_id, titulo, tipo, criado_por) values (cli, 'X (teste)', 'espaco', u_atd); exception when others then erro := sqlerrm; end;
  if erro is null or erro not like '%permission denied%' then falhas := falhas || ('S4 ' || coalesce(erro, 'gravou')); end if;

  -- S5: marcar versão como enviada direto não pode
  total := total + 1; erro := null;
  begin update orcamento_versoes set status = 'enviada' where orcamento_id = orc; exception when others then erro := sqlerrm; end;
  if erro is null or erro not like '%permission denied%' then falhas := falhas || ('S5 ' || coalesce(erro, 'mudou')); end if;

  -- S6: concluir tarefa grava quem está logado, mesmo se a requisição disser outro
  perform set_config('role', 'none', true);
  insert into tarefas (titulo, responsavel) values ('Tarefa Seg (teste)', u_atd) returning id into t1;
  perform set_config('role', 'authenticated', true);
  update tarefas set concluida_em = now(), concluida_por = gen_random_uuid() where id = t1;
  total := total + 1;
  perform set_config('role', 'none', true);
  if (select concluida_por from tarefas where id = t1) is distinct from u_atd then falhas := falhas || 'S6 autor da conclusão'; end if;
  perform set_config('role', 'authenticated', true);

  -- S7: mudar título de tarefa direto não pode
  total := total + 1; erro := null;
  begin update tarefas set titulo = 'mudado' where id = t1; exception when others then erro := sqlerrm; end;
  if erro is null or erro not like '%permission denied%' then falhas := falhas || ('S7 ' || coalesce(erro, 'mudou')); end if;

  -- S8: função de gatilho e registro de auditoria não podem ser chamados pela API
  total := total + 1; erro := null;
  begin perform registrar_evento_acesso(u_atd, 'FALSO', '{}'); exception when others then erro := sqlerrm; end;
  if erro is null or erro not like '%permission denied%' then falhas := falhas || ('S8 ' || coalesce(erro, 'registrou')); end if;

  -- S9: exigir senha nova só para administração
  total := total + 1; erro := null;
  begin perform registrar_troca_senha_forcada(u_atd); exception when others then erro := sqlerrm; end;
  if erro is null or erro not like 'SEM_PERMISSAO%' then falhas := falhas || ('S9 ' || coalesce(erro, 'registrou')); end if;

  -- S10: limite de tentativas não é acessível pela API
  total := total + 1; erro := null;
  begin perform consumir_tentativa('x', 1, 60, 60); exception when others then erro := sqlerrm; end;
  if erro is null or erro not like '%permission denied%' then falhas := falhas || ('S10 ' || coalesce(erro, 'executou')); end if;

  -- S11: limite conta e bloqueia (como servidor)
  perform set_config('role', 'none', true);
  total := total + 1;
  if consumir_tentativa('teste:seg', 3, 60, 120) <> 0 or consumir_tentativa('teste:seg', 3, 60, 120) <> 0
     or consumir_tentativa('teste:seg', 3, 60, 120) <> 0 or consumir_tentativa('teste:seg', 3, 60, 120) = 0 then
    falhas := falhas || 'S11 contagem';
  end if;
  total := total + 1;
  if consumir_tentativa('teste:seg', 3, 60, 120) = 0 then falhas := falhas || 'S12 segue bloqueado'; end if;
  perform limpar_tentativas('teste:seg');
  total := total + 1;
  if consumir_tentativa('teste:seg', 3, 60, 120) <> 0 then falhas := falhas || 'S13 limpar'; end if;

  -- S14: anônimo não executa nada
  total := total + 1;
  select count(*) into n from pg_proc p where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute');
  if n <> 0 then falhas := falhas || ('S14 funções liberadas para anônimo: ' || n); end if;

  -- S15: toda tabela com RLS
  total := total + 1;
  select string_agg(tablename, ',') into s from pg_tables where schemaname = 'public' and not rowsecurity;
  if s is not null then falhas := falhas || ('S15 sem RLS: ' || s); end if;

  raise exception 'RESULTADO %/% %', total - coalesce(array_length(falhas, 1), 0), total, falhas;
end $$;
