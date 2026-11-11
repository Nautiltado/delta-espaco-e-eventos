-- Remove SOMENTE o que as contas teste.e2e.*@delta.test criaram (e as próprias contas). A auditoria não é tocada.
-- As travas de exclusão são desligadas só dentro desta transação e religadas no fim.
do $$
declare testes uuid[] := array(select id from usuarios where email like 'teste.e2e.%@delta.test');
        auths uuid[] := array(select auth_user_id from usuarios where email like 'teste.e2e.%@delta.test');
        clis uuid[]; orcs uuid[]; vers uuid[]; cat uuid[]; res uuid[];
begin
  alter table orcamento_itens_custos disable trigger custo_so_em_rascunho;
  alter table orcamento_itens disable trigger item_so_em_rascunho;
  alter table orcamento_itens disable trigger item_recalcula;
  alter table orcamento_versoes disable trigger versao_imutavel;
  alter table tarefas disable trigger tarefas_sem_delete;
  alter table orcamentos disable trigger orcamentos_sem_delete;
  alter table clientes disable trigger clientes_sem_delete;
  alter table catalogo_itens disable trigger catalogo_sem_delete;
  alter table catalogo_precos disable trigger catalogo_precos_imutavel;
  alter table usuarios disable trigger usuarios_sem_delete;
  alter table pagamentos disable trigger pagamentos_imutavel;
  alter table parcelas disable trigger parcelas_sem_delete;
  alter table contratos disable trigger contratos_sem_delete;
  alter table reservas disable trigger reservas_sem_delete;
  alter table pedidos disable trigger pedidos_sem_delete;
  alter table pedido_itens disable trigger pedido_itens_sem_delete;
  alter table pedido_pagamentos disable trigger pedido_pagamentos_imutavel;
  alter table estoque_movimentos disable trigger estoque_movimentos_imutavel;

  -- eventos (Fase 7): equipe, checklist, ficha, gastos e notas mexidos pelas contas de teste
  alter table evento_custos disable trigger evento_custos_sem_delete;
  alter table evento_notas disable trigger evento_notas_sem_delete;
  delete from evento_notas where enviado_por = any(testes);
  delete from evento_custos where criado_por = any(testes);
  delete from evento_equipe where criado_por = any(testes);
  update evento_checklist set feito_por = null, feito_em = null where feito_por = any(testes);
  delete from evento_fichas where atualizado_por = any(testes);
  alter table evento_custos enable trigger evento_custos_sem_delete;
  alter table evento_notas enable trigger evento_notas_sem_delete;

  -- encomendas (Fase 5)
  delete from estoque_movimentos where criado_por = any(testes)
    or pedido_id in (select id from pedidos where criado_por = any(testes));
  delete from pedido_pagamentos where pedido_id in (select id from pedidos where criado_por = any(testes));
  delete from pedido_itens where pedido_id in (select id from pedidos where criado_por = any(testes));
  delete from pedidos where criado_por = any(testes);

  clis := array(select id from clientes where criado_por = any(testes));  -- só o que as contas de teste criaram
  orcs := array(select id from orcamentos where criado_por = any(testes) or cliente_id = any(clis));
  vers := array(select id from orcamento_versoes where orcamento_id = any(orcs));
  cat  := array(select id from catalogo_itens where nome like '%(teste)%');
  res  := array(select id from reservas where orcamento_id = any(orcs) or cliente_id = any(clis)
                 or (tipo = 'bloqueio_administrativo' and criado_por = any(testes)));

  delete from pagamentos where parcela_id in (select id from parcelas where reserva_id = any(res));
  delete from parcelas where reserva_id = any(res);
  delete from contratos where reserva_id = any(res);
  delete from reserva_periodos where reserva_id = any(res);
  delete from reservas where id = any(res);
  delete from orcamento_itens_custos where item_id in (select id from orcamento_itens where versao_id = any(vers));
  delete from orcamento_itens where versao_id = any(vers);
  delete from orcamento_versoes where id = any(vers);
  delete from tarefas where criado_por = any(testes) or orcamento_id = any(orcs) or cliente_id = any(clis) or responsavel = any(testes);
  delete from orcamentos where id = any(orcs);
  update clientes set mesclado_em = null where id = any(clis);
  delete from clientes where id = any(clis);
  delete from catalogo_custos where item_id = any(cat) or atualizado_por = any(testes);
  delete from catalogo_precos where item_id = any(cat);
  delete from catalogo_itens where id = any(cat);
  delete from contrato_modelos where criado_por = any(testes);
  -- configurações mexidas pelo teste (chave Pix de teste): volta ao vazio e solta a referência à conta de teste
  update configuracoes set valor = '""' where chave = 'empresa.pix_chave' and atualizado_por = any(testes);
  update configuracoes set atualizado_por = null where atualizado_por = any(testes);
  delete from usuarios_perfis where usuario = any(testes);
  delete from usuarios where id = any(testes);
  delete from auth.users where id = any(auths);

  alter table orcamento_itens_custos enable trigger custo_so_em_rascunho;
  alter table orcamento_itens enable trigger item_so_em_rascunho;
  alter table orcamento_itens enable trigger item_recalcula;
  alter table orcamento_versoes enable trigger versao_imutavel;
  alter table tarefas enable trigger tarefas_sem_delete;
  alter table orcamentos enable trigger orcamentos_sem_delete;
  alter table clientes enable trigger clientes_sem_delete;
  alter table catalogo_itens enable trigger catalogo_sem_delete;
  alter table catalogo_precos enable trigger catalogo_precos_imutavel;
  alter table usuarios enable trigger usuarios_sem_delete;
  alter table pagamentos enable trigger pagamentos_imutavel;
  alter table parcelas enable trigger parcelas_sem_delete;
  alter table contratos enable trigger contratos_sem_delete;
  alter table reservas enable trigger reservas_sem_delete;
  alter table pedidos enable trigger pedidos_sem_delete;
  alter table pedido_itens enable trigger pedido_itens_sem_delete;
  alter table pedido_pagamentos enable trigger pedido_pagamentos_imutavel;
  alter table estoque_movimentos enable trigger estoque_movimentos_imutavel;
end $$;
select (select count(*) from usuarios) usuarios, (select count(*) from auth.users) contas, (select count(*) from clientes) clientes,
       (select count(*) from orcamentos) orcamentos, (select count(*) from reservas) reservas, (select count(*) from tarefas) tarefas,
       (select count(*) from pg_trigger where not tgisinternal and tgenabled = 'D') travas_desligadas;
