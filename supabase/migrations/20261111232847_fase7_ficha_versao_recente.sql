-- Ficha: sem versão aprovada, mostra a mais recente.
create or replace function ficha_evento(p_reserva uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r reservas%rowtype; o orcamentos%rowtype; v_id uuid; v_status text; res jsonb;
begin
  if not pode_ver_eventos() then
    raise exception 'SEM_PERMISSAO: seu perfil não vê os eventos' using errcode = '42501';
  end if;
  r := evento_existente(p_reserva);
  select * into o from orcamentos where id = r.orcamento_id;
  -- a versão aprovada; enquanto não houver, a mais recente (a tela avisa que ainda pode mudar)
  select id, status::text into v_id, v_status from orcamento_versoes where orcamento_id = r.orcamento_id
   order by (status = 'aprovada') desc, numero desc limit 1;
  select jsonb_build_object(
    'id', r.id, 'versao_status', v_status, 'titulo', r.titulo, 'status', r.status, 'inicio', r.evento_inicio, 'fim', r.evento_fim,
    'valor_total_centavos', case when pode_ver_gastos() or tem_permissao('pagamento.confirmar') then r.valor_total_centavos end,
    'cliente', (select jsonb_build_object('nome', c.nome, 'telefone', c.telefone) from clientes c where c.id = r.cliente_id),
    'orcamento', case when o.id is null then null else jsonb_build_object('id', o.id, 'numero', o.numero, 'tipo', o.tipo,
                   'convidados', o.convidados, 'horario', o.horario, 'local_externo', o.local_externo) end,
    'espacos', coalesce((select jsonb_agg(distinct rc.nome) from reserva_periodos p join recursos rc on rc.id = p.recurso_id
                          where p.reserva_id = r.id and p.ativo), '[]'),
    'itens', coalesce((select jsonb_agg(jsonb_build_object('descricao', i.descricao, 'quantidade', i.quantidade, 'unidade', i.unidade) order by i.ordem)
                         from orcamento_itens i where i.versao_id = v_id), '[]')
  ) into res;
  return res;
end $$;

