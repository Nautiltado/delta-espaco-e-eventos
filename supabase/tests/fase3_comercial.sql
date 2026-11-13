-- Testes da Fase 3 (Comercial). Terminam sempre com "RESULTADO ..." e desfazem tudo.
do $$
declare
  falhas text[] := '{}'; total int := 0; inst uuid := '00000000-0000-0000-0000-000000000000';
  u_atd uuid; u_fin uuid; u_coz uuid; u_adm uuid;
  a_atd uuid := gen_random_uuid(); a_fin uuid := gen_random_uuid(); a_coz uuid := gen_random_uuid(); a_adm uuid := gen_random_uuid();
  c1 uuid; c2 uuid; orc uuid; v1 uuid; v2 uuid; it uuid; n int; j jsonb; t text;
  cat_menor uuid := (select id from catalogo_itens where nome = 'Locação do espaço menor');
  cat_garcom uuid := (select id from catalogo_itens where nome = 'Garçom');
begin
  insert into usuarios (nome, email) values ('T Atd', 't3.atd@delta.test') returning id into u_atd;
  insert into usuarios (nome, email) values ('T Fin', 't3.fin@delta.test') returning id into u_fin;
  insert into usuarios (nome, email) values ('T Coz', 't3.coz@delta.test') returning id into u_coz;
  insert into usuarios (nome, email) values ('T Adm', 't3.adm@delta.test') returning id into u_adm;
  insert into usuarios_perfis values (u_atd,'ATD'),(u_fin,'FIN'),(u_coz,'COZ'),(u_adm,'ADM');
  insert into auth.users (instance_id, id, aud, role, email) values
    (inst, a_atd, 'authenticated', 'authenticated', 't3.atd@delta.test'),
    (inst, a_fin, 'authenticated', 'authenticated', 't3.fin@delta.test'),
    (inst, a_coz, 'authenticated', 'authenticated', 't3.coz@delta.test'),
    (inst, a_adm, 'authenticated', 'authenticated', 't3.adm@delta.test');

  -------------------------------------------------- administrador: custo e preço do catálogo
  perform set_config('request.jwt.claims', json_build_object('sub', a_adm, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  insert into catalogo_custos (item_id, custo_centavos) values (cat_garcom, 12000);
  total := total + 1;
  update catalogo_itens set preco_centavos = 19000 where id = cat_garcom;
  if (select count(*) from catalogo_precos where item_id = cat_garcom) <> 2 then falhas := falhas || 'K1 histórico de preço não registrou a mudança'; end if;
  update catalogo_itens set preco_centavos = 18000 where id = cat_garcom;
  perform set_config('role', 'none', true);

  -------------------------------------------------- atendimento: clientes
  perform set_config('request.jwt.claims', json_build_object('sub', a_atd, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  total := total + 1;
  begin
    insert into clientes (tipo, nome, documento) values ('PF', 'CPF Inválido', '12345678900');
    falhas := falhas || 'K2 aceitou CPF inválido';
  exception when check_violation then null; end;
  insert into clientes (tipo, nome, documento, telefone, origem) values ('PF', 'Maria José da Silva', '52998224725', '99981522414', 'whatsapp') returning id into c1;
  insert into clientes (tipo, nome, telefone) values ('PF', 'Maria Jose Silva', '99981522414') returning id into c2;
  total := total + 1;
  select count(*) into n from buscar_duplicados('Maria José Silva', '99981522414', null, c2) where id = c1;
  if n <> 1 then falhas := falhas || 'K3 duplicado por telefone não detectado'; end if;
  total := total + 1;
  select count(*) into n from buscar_duplicados('maria jose da silva', null, null, null);
  if n < 2 then falhas := falhas || 'K4 nome parecido (sem acento) não detectado'; end if;
  total := total + 1;
  begin
    update catalogo_itens set preco_centavos = 1 where id = cat_garcom;
    get diagnostics n = row_count;
    if n > 0 then falhas := falhas || 'K5 atendimento alterou preço do catálogo'; end if;
  exception when insufficient_privilege then null; end;
  total := total + 1;
  select count(*) into n from catalogo_custos;
  if n <> 0 then falhas := falhas || 'K6 atendimento vê custo do catálogo'; end if;

  -------------------------------------------------- atendimento: orçamento
  orc := criar_orcamento(c1, 'Aniversário de 15 anos', 'espaco', '2027-05-20', '19h às 2h', 90,
                         (select id from recursos where nome = 'Espaço menor'));
  select id into v1 from orcamento_versoes where orcamento_id = orc;
  insert into orcamento_itens (versao_id, ordem, catalogo_item_id, descricao, unidade, quantidade, preco_unitario_centavos)
  values (v1, 1, cat_menor, 'Locação do espaço menor', 'evento', 1, 100000),
         (v1, 2, cat_garcom, 'Garçom', 'evento', 2, 18000);
  insert into orcamento_itens (versao_id, ordem, descricao, unidade, quantidade, preco_unitario_centavos)
  values (v1, 3, 'Decoração simples (item livre)', 'evento', 1, 25050) returning id into it;
  total := total + 1;
  if (select subtotal_centavos from orcamento_versoes where id = v1) <> 161050 then
    falhas := falhas || 'K7 subtotal calculado errado';
  end if;
  total := total + 1;
  select count(*) into n from orcamento_itens_custos;
  if n <> 0 then falhas := falhas || 'K8 atendimento vê custo dos itens do orçamento'; end if;
  update orcamento_versoes set desconto_centavos = 30000 where id = v1;
  total := total + 1;
  begin
    perform enviar_versao(v1);
    falhas := falhas || 'K9 enviou desconto de 18% sem aprovação';
  exception when others then
    if sqlerrm not like 'APROVACAO_NECESSARIA%' then falhas := falhas || ('K9 ' || sqlerrm); end if;
  end;
  total := total + 1;
  begin
    perform aprovar_condicoes(v1, 'cliente antigo');
    falhas := falhas || 'K10 atendimento aprovou o próprio desconto';
  exception when insufficient_privilege then null; end;
  perform set_config('role', 'none', true);

  -------------------------------------------------- financeiro: vê custo, não cria
  perform set_config('request.jwt.claims', json_build_object('sub', a_fin, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  total := total + 1;
  select count(*) into n from orcamento_itens_custos c join orcamento_itens i on i.id = c.item_id where i.versao_id = v1;
  if n <> 1 then falhas := falhas || ('K11 financeiro deveria ver 1 custo (garçom), viu ' || n); end if;
  total := total + 1;
  begin
    perform criar_orcamento(c1, 'Tentativa do financeiro', 'outro');
    falhas := falhas || 'K12 financeiro criou orçamento';
  exception when insufficient_privilege then null; end;
  perform set_config('role', 'none', true);

  -------------------------------------------------- cozinha: não vê nada comercial
  perform set_config('request.jwt.claims', json_build_object('sub', a_coz, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  total := total + 1;
  select count(*) into n from orcamentos;
  if n <> 0 then falhas := falhas || 'K13 cozinha vê orçamentos'; end if;
  perform set_config('role', 'none', true);

  -------------------------------------------------- administrador aprova; atendimento envia
  perform set_config('request.jwt.claims', json_build_object('sub', a_adm, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform aprovar_condicoes(v1, 'Cliente fechou outro evento conosco');
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a_atd, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform enviar_versao(v1);
  total := total + 1;
  select snapshot into j from orcamento_versoes where id = v1;
  if j -> 'cliente' ->> 'nome' <> 'Maria José da Silva' or (j ->> 'total_centavos')::bigint <> 131050
     or (select conteudo_hash from orcamento_versoes where id = v1) is null then
    falhas := falhas || 'K14 envio não congelou cliente, total e impressão digital';
  end if;
  total := total + 1;
  if not exists (select 1 from tarefas where orcamento_id = orc and concluida_em is null) then
    falhas := falhas || 'K15 envio não criou a tarefa de retorno';
  end if;

  -------------------------------------------------- critério de aceite: enviado não muda
  total := total + 1;
  begin
    update orcamento_itens set preco_unitario_centavos = 1 where id = it;
    falhas := falhas || 'K16 item de orçamento enviado foi alterado';
  exception when others then
    if sqlerrm not like 'ORCAMENTO_IMUTAVEL%' then falhas := falhas || ('K16 ' || sqlerrm); end if;
  end;
  total := total + 1;
  begin
    delete from orcamento_itens where id = it;
    falhas := falhas || 'K17 item de orçamento enviado foi apagado';
  exception when others then
    if sqlerrm not like 'ORCAMENTO_IMUTAVEL%' then falhas := falhas || ('K17 ' || sqlerrm); end if;
  end;
  total := total + 1;
  update orcamento_versoes set desconto_centavos = 0 where id = v1;
  get diagnostics n = row_count;
  if n <> 0 then falhas := falhas || 'K18 desconto de orçamento enviado foi alterado'; end if;
  perform set_config('role', 'none', true);
  total := total + 1;
  begin
    update orcamento_versoes set snapshot = '{}' where id = v1;   -- nem o dono do banco consegue
    falhas := falhas || 'K19 versão enviada alterada direto no banco';
  exception when others then
    if sqlerrm not like 'ORCAMENTO_IMUTAVEL%' then falhas := falhas || ('K19 ' || sqlerrm); end if;
  end;

  -------------------------------------------------- nova versão, aceite e encerramento
  perform set_config('request.jwt.claims', json_build_object('sub', a_atd, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  v2 := nova_versao(orc);
  total := total + 1;
  if (select count(*) from orcamento_itens where versao_id = v2) <> 3
     or (select numero from orcamento_versoes where id = v2) <> 2
     or (select aprovado_por from orcamento_versoes where id = v2) is not null then
    falhas := falhas || 'K20 nova versão não copiou os itens ou herdou a aprovação';
  end if;
  total := total + 1;
  if (select count(*) from orcamento_itens_custos c join orcamento_itens i on i.id = c.item_id where i.versao_id = v2) <> 0 then
    falhas := falhas || 'K21 custo da nova versão visível para o atendimento';
  end if;
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a_adm, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform aprovar_condicoes(v2, 'Mantido o desconto da versão 1');
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a_atd, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform enviar_versao(v2);
  total := total + 1;
  if (select status from orcamento_versoes where id = v1) <> 'substituida' then
    falhas := falhas || 'K26 envio da versão 2 não marcou a versão 1 como substituída';
  end if;
  total := total + 1;
  begin
    perform registrar_aceite(v1);
    falhas := falhas || 'K27 aceitou versão substituída';
  exception when others then
    if sqlerrm not like 'STATUS_INVALIDO%' then falhas := falhas || ('K27 ' || sqlerrm); end if;
  end;
  perform registrar_aceite(v2);
  total := total + 1;
  if (select status from orcamentos where id = orc) <> 'aprovado' or exists (select 1 from tarefas where orcamento_id = orc and concluida_em is null and titulo like 'Retornar%') then
    falhas := falhas || 'K22 aceite não aprovou o orçamento ou não fechou a tarefa';
  end if;
  total := total + 1;
  begin
    perform nova_versao(orc);
    falhas := falhas || 'K23 criou versão em orçamento aprovado';
  exception when others then
    if sqlerrm not like 'STATUS_INVALIDO%' then falhas := falhas || ('K23 ' || sqlerrm); end if;
  end;
  total := total + 1;
  begin
    perform mesclar_clientes(c2, c1);
    falhas := falhas || 'K24 atendimento mesclou cadastros';
  exception when insufficient_privilege then null; end;
  perform set_config('role', 'none', true);

  -------------------------------------------------- mesclagem pelo administrador
  perform set_config('request.jwt.claims', json_build_object('sub', a_adm, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  perform criar_orcamento(c2, 'Orçamento do cadastro repetido', 'outro');
  perform mesclar_clientes(c2, c1);
  total := total + 1;
  if (select count(*) from orcamentos where cliente_id = c1) <> 2
     or (select mesclado_em from clientes where id = c2) is distinct from c1 then
    falhas := falhas || 'K25 mesclagem não moveu os orçamentos ou não marcou o cadastro';
  end if;
  perform set_config('role', 'none', true);

  t := format('RESULTADO %s de %s testes passaram', total - coalesce(array_length(falhas, 1), 0), total);
  if array_length(falhas, 1) > 0 then t := t || E'\nFALHAS:\n- ' || array_to_string(falhas, E'\n- '); end if;
  raise exception '%', t;
end $$;
