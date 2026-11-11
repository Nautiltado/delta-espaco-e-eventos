-- Gasto tirado da conta leva junto as notas dele (continuam guardadas no histórico).
create or replace function remover_custo_evento(p_custo uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('evento.fechar') then
    raise exception 'SEM_PERMISSAO: seu perfil não lança gastos' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'JUSTIFICATIVA_OBRIGATORIA: diga por que o gasto sai' using errcode = 'P0001';
  end if;
  update evento_custos set removido_em = now(), removido_por = usuario_atual(), removido_motivo = trim(p_motivo)
   where id = p_custo and removido_em is null;
  if not found then raise exception 'STATUS_INVALIDO: gasto não encontrado' using errcode = 'P0001'; end if;
  update evento_notas set removido_em = now(), removido_por = usuario_atual(), removido_motivo = 'gasto tirado da conta: ' || trim(p_motivo)
   where custo_id = p_custo and removido_em is null;
end $$;
update evento_notas n set removido_em = now(), removido_motivo = 'gasto tirado da conta'
  from evento_custos c where c.id = n.custo_id and c.removido_em is not null and n.removido_em is null;
