-- Cancelamento: até o salgado ficar pronto, devolve o dinheiro; depois de pronto, não devolve
-- (o salgado já foi feito) e as unidades saem do estoque como perda. Exceção só pela administração.
alter table pedidos add column devolucao boolean not null default false;

drop function cancelar_pedido(uuid, text);
create function cancelar_pedido(p_pedido uuid, p_motivo text, p_devolver_mesmo_pronto boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare p pedidos%rowtype; devolve boolean;
begin
  if not (tem_permissao('salgados.criar') or tem_permissao('pagamento.estornar')) then
    raise exception 'SEM_PERMISSAO: seu perfil não cancela pedidos' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'JUSTIFICATIVA_OBRIGATORIA: diga o motivo do cancelamento' using errcode = 'P0001';
  end if;
  select * into p from pedidos where id = p_pedido for update;
  if not found or p.status in ('entregue', 'cancelado') then
    raise exception 'STATUS_INVALIDO: pedido já entregue ou cancelado' using errcode = 'P0001';
  end if;
  if p_devolver_mesmo_pronto and p.status = 'pronto' and not tem_permissao('pagamento.estornar') then
    raise exception 'SEM_PERMISSAO: depois de pronto, só a administração autoriza devolver o dinheiro' using errcode = '42501';
  end if;
  devolve := p.status = 'pago' or (p.status = 'pronto' and p_devolver_mesmo_pronto);

  update pedidos set status = 'cancelado', cancelado_em = now(), cancelado_motivo = trim(p_motivo), devolucao = devolve
   where id = p.id;

  if p.status = 'pronto' then
    insert into estoque_movimentos (estoque_item_id, tipo, quantidade, pedido_id, observacao)
    select (c->>'estoque_item_id')::uuid, 'perda', -sum((c->>'unidades')::int * i.quantidade), p.id,
           format('%s cancelado depois de pronto', p.numero)
      from pedido_itens i cross join lateral jsonb_array_elements(coalesce(i.composicao, '[]')) c
     where i.pedido_id = p.id
     group by 1;
  end if;

  if devolve then
    insert into tarefas (titulo, vence_em, responsavel, criado_por)
    values (format('Devolver %s ao cliente do pedido %s (%s)', formatar_reais(p.total_centavos), p.numero, p.cliente_nome),
            now() + interval '1 day', usuario_atual(), usuario_atual());
  end if;
end $$;
revoke all on function cancelar_pedido(uuid, text, boolean) from public, anon, authenticated;
grant execute on function cancelar_pedido(uuid, text, boolean) to delta_app;
