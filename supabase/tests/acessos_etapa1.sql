-- Testes da etapa 1 de usuários e permissões: cadastro, perfis, proteção do administrador, visitante,
-- desativação com transferência, convites e sessões encerradas. Desfaz tudo no fim (raise no final).
do $$
declare
  falhas text[] := '{}'; total int := 0; inst uuid := '00000000-0000-0000-0000-000000000000';
  a_adm uuid := gen_random_uuid(); a_atd uuid := gen_random_uuid();
  u_adm uuid; u_atd uuid; u_novo uuid; u_vis uuid; t1 uuid; c1 uuid; erro text; n int; r jsonb;
  agora bigint := extract(epoch from now())::bigint;
begin
  insert into usuarios (nome, email) values ('TA Adm', 'ta.adm@delta.test') returning id into u_adm;
  insert into usuarios (nome, email) values ('TA Atd', 'ta.atd@delta.test') returning id into u_atd;
  insert into usuarios_perfis values (u_adm, 'ADM'), (u_atd, 'ATD');
  insert into auth.users (instance_id, id, aud, role, email) values
    (inst, a_adm, 'authenticated', 'authenticated', 'ta.adm@delta.test'), (inst, a_atd, 'authenticated', 'authenticated', 'ta.atd@delta.test');
  perform set_config('role', 'authenticated', true);

  -- A1: atendimento não cadastra usuário
  perform set_config('request.jwt.claims', json_build_object('sub', a_atd, 'role', 'authenticated', 'iat', agora)::text, true);
  total := total + 1; erro := null;
  begin perform criar_usuario('Fulano (teste)', 'fulano.a1@delta.test', array['ATD']); exception when others then erro := sqlerrm; end;
  if erro is null or erro not like 'SEM_PERMISSAO%' then falhas := falhas || ('A1 ' || coalesce(erro, 'criou')); end if;

  -- A2: atendimento não lê convites
  total := total + 1; select count(*) into n from convites;
  if n <> 0 then falhas := falhas || 'A2 atendimento leu convites'; end if;

  -- A3: administração cadastra com dois perfis (união das permissões)
  perform set_config('request.jwt.claims', json_build_object('sub', a_adm, 'role', 'authenticated', 'iat', agora, 'aal', 'aal2')::text, true);
  u_novo := criar_usuario('Fulano (teste)', 'fulano.a3@delta.test', array['ATD', 'COZ'], '(85) 99999-0000', 'Atendente');
  total := total + 1;
  select count(distinct pp.permissao) into n from usuarios_perfis up join perfis_permissoes pp on pp.perfil = up.perfil
   where up.usuario = u_novo and pp.permissao in ('producao.status', 'orcamento.criar');
  if n <> 2 then
    falhas := falhas || 'A3 união das permissões'; end if;

  -- A4: visitante não se combina com outro perfil
  total := total + 1; erro := null;
  begin perform criar_usuario('Vis (teste)', 'vis.a4@delta.test', array['VIS', 'ATD']); exception when others then erro := sqlerrm; end;
  if erro is null or erro not like 'PERFIL_PROTEGIDO%' then falhas := falhas || ('A4 ' || coalesce(erro, 'aceitou')); end if;

  -- A5: visitante não recebe permissão de escrita
  total := total + 1; erro := null;
  begin insert into perfis_permissoes values ('VIS', 'orcamento.criar'); exception when others then erro := sqlerrm; end;
  if erro is null or erro not like 'PERFIL_PROTEGIDO%' then falhas := falhas || ('A5 ' || coalesce(erro, 'aceitou')); end if;

  -- A6: administrador não perde permissão
  total := total + 1; erro := null;
  begin delete from perfis_permissoes where perfil = 'ADM' and permissao = 'config.critica'; exception when others then erro := sqlerrm; end;
  if erro is null or erro not like 'PERFIL_PROTEGIDO%' then falhas := falhas || ('A6 ' || coalesce(erro, 'apagou')); end if;

  -- A7: ninguém tira o próprio administrador
  total := total + 1; erro := null;
  begin perform definir_perfis(u_adm, array['ATD']); exception when others then erro := sqlerrm; end;
  if erro is null or erro not like 'PERFIL_PROTEGIDO%' then falhas := falhas || ('A7 ' || coalesce(erro, 'tirou')); end if;

  -- A8: "ativo" só muda pelas funções
  total := total + 1; erro := null;
  begin update usuarios set ativo = false where id = u_atd; exception when others then erro := sqlerrm; end;
  if erro is null or erro not like 'STATUS_INVALIDO%' then falhas := falhas || ('A8 ' || coalesce(erro, 'mudou')); end if;

  -- A9: um convite aberto por vez; o novo cancela o anterior
  c1 := registrar_convite(u_novo, 'convite', repeat('a', 64), 72);
  perform registrar_convite(u_novo, 'convite', repeat('b', 64), 72);
  total := total + 1;
  select count(*) into n from convites where usuario_id = u_novo and usado_em is null and revogado_em is null;
  if n <> 1 or (select revogado_em from convites where id = c1) is null then falhas := falhas || ('A9 abertos=' || n); end if;

  -- A10: desativar exige motivo
  total := total + 1; erro := null;
  begin perform desativar_usuario(u_atd, 'ok'); exception when others then erro := sqlerrm; end;
  if erro is null or erro not like 'VALOR_INVALIDO%' then falhas := falhas || ('A10 ' || coalesce(erro, 'desativou')); end if;

  -- A11: não dá para desativar a própria conta
  total := total + 1; erro := null;
  begin perform desativar_usuario(u_adm, 'Motivo qualquer'); exception when others then erro := sqlerrm; end;
  if erro is null or erro not like 'STATUS_INVALIDO%' then falhas := falhas || ('A11 ' || coalesce(erro, 'desativou')); end if;

  -- A12: desativação transfere tarefas abertas, cancela convites e guarda o motivo
  insert into tarefas (titulo, responsavel) values ('Ligar para cliente (teste)', u_novo) returning id into t1;
  r := desativar_usuario(u_novo, 'Saiu da equipe (teste)', u_atd);
  total := total + 1;
  if (select responsavel from tarefas where id = t1) <> u_atd or (r ->> 'tarefas')::int <> 1 then falhas := falhas || ('A12 transferência ' || r); end if;
  total := total + 1;
  if exists (select 1 from convites where usuario_id = u_novo and usado_em is null and revogado_em is null) then falhas := falhas || 'A13 convite aberto'; end if;
  total := total + 1;
  if (select desativacao_motivo from usuarios where id = u_novo) <> 'Saiu da equipe (teste)' then falhas := falhas || 'A14 motivo'; end if;

  -- A15: lista mostra a situação desativado
  total := total + 1;
  if (select situacao from lista_usuarios() where id = u_novo) <> 'desativado' then falhas := falhas || 'A15 situação'; end if;

  -- A16: reativar volta a ativo e registra
  perform reativar_usuario(u_novo, 'Voltou (teste)');
  total := total + 1;
  if not (select ativo from usuarios where id = u_novo) then falhas := falhas || 'A16 reativar'; end if;

  -- A17: histórico registra cadastro, desativação e reativação
  total := total + 1;
  select count(distinct acao) into n from historico_acesso(u_novo) where acao in ('USUARIO_CRIADO', 'USUARIO_DESATIVADO', 'USUARIO_REATIVADO');
  if n <> 3 then falhas := falhas || ('A17 eventos=' || n); end if;

  -- A18: sessões encerradas derrubam o token antigo (iat anterior)
  perform revogar_sessoes(u_atd, 'Teste (teste)');
  perform set_config('request.jwt.claims', json_build_object('sub', a_atd, 'role', 'authenticated', 'iat', agora - 60)::text, true);
  total := total + 1;
  if usuario_atual() is not null then falhas := falhas || 'A18 token antigo ainda vale'; end if;

  -- A19: login novo (iat depois) volta a valer
  perform set_config('request.jwt.claims', json_build_object('sub', a_atd, 'role', 'authenticated', 'iat', agora + 60)::text, true);
  total := total + 1;
  if usuario_atual() is distinct from u_atd then falhas := falhas || 'A19 login novo'; end if;

  -- A20: anônimo não executa funções
  total := total + 1;
  if has_function_privilege('anon', 'public.criar_usuario(text,text,text[],text,text,date,text)', 'execute') then
    falhas := falhas || 'A20 anon executa criar_usuario'; end if;

  raise exception 'RESULTADO %/% %', total - coalesce(array_length(falhas, 1), 0), total, falhas;
end $$;
