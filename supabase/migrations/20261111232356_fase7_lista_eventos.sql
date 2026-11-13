-- Lista de eventos para quem trabalha no dia (inclusive a cozinha, que não vê reservas nem clientes).
create function lista_eventos(p_desde timestamptz, p_ate timestamptz)
returns table (id uuid, titulo text, status reserva_status, inicio timestamptz, fim timestamptz, cliente text,
               convidados integer, tipo_evento text, espacos text[])
language plpgsql stable security definer set search_path = public as $$
begin
  if not pode_ver_eventos() then
    raise exception 'SEM_PERMISSAO: seu perfil não vê os eventos' using errcode = '42501';
  end if;
  return query
  select r.id, r.titulo, r.status, r.evento_inicio, r.evento_fim, c.nome, o.convidados, o.tipo,
         coalesce((select array_agg(distinct rc.nome) from reserva_periodos p join recursos rc on rc.id = p.recurso_id
                    where p.reserva_id = r.id and p.ativo), '{}')
    from reservas r
    join clientes c on c.id = r.cliente_id
    left join orcamentos o on o.id = r.orcamento_id
   where r.tipo = 'evento'
     and r.status in ('bloqueio_temporario', 'confirmada', 'em_preparacao', 'realizada')
     and r.evento_inicio < p_ate and r.evento_fim > p_desde
   order by r.evento_inicio;
end $$;
revoke all on function lista_eventos(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function lista_eventos(timestamptz, timestamptz) to delta_app;
