-- Agenda: tempos de montagem/desmontagem/limpeza/reorganização configuráveis (geral, por espaço e por evento),
-- consulta de disponibilidade sem gravar, detalhes da agenda numa chamada só e bloqueio com período e observações.
-- Nenhuma regra comercial muda: os padrões continuam 0 h de montagem e 4 h de limpeza; a trava de sobreposição
-- no banco (exclusão por espaço) segue sendo a garantia final.

insert into configuracoes (chave, grupo, descricao, tipo, valor, ordem) values
  ('espaco.desmontagem_horas', 'Reservas', 'Tempo de desmontagem bloqueado depois do término', 'horas', '0', 21),
  ('espaco.intervalo_horas', 'Reservas', 'Intervalo de reorganização entre eventos', 'horas', '0', 22)
on conflict (chave) do nothing;

-- tempos por espaço (vazio = usa o valor geral de Configurações)
alter table recursos
  add column montagem_horas numeric(4,1) check (montagem_horas between 0 and 48),
  add column desmontagem_horas numeric(4,1) check (desmontagem_horas between 0 and 48),
  add column limpeza_horas numeric(4,1) check (limpeza_horas between 0 and 48),
  add column intervalo_horas numeric(4,1) check (intervalo_horas between 0 and 48);

alter table reservas add column observacoes text check (observacoes is null or length(observacoes) <= 1000);

-- Folga antes e depois de um evento num espaço: evento > espaço > geral.
create function folga_recurso(p_recurso uuid, p_montagem numeric default null, p_desmontagem numeric default null,
  out antes interval, out depois interval)
language sql stable security definer set search_path = public as $$
  select make_interval(mins => round(60 * coalesce(p_montagem, rc.montagem_horas, cfg_int('espaco.montagem_horas'), 0))::int),
         make_interval(mins => round(60 * (coalesce(p_desmontagem, rc.desmontagem_horas, cfg_int('espaco.desmontagem_horas'), 0)
                                          + coalesce(rc.limpeza_horas, cfg_int('espaco.limpeza_horas'), 4)
                                          + coalesce(rc.intervalo_horas, cfg_int('espaco.intervalo_horas'), 0)))::int)
    from recursos rc where rc.id = p_recurso
$$;

----------------------------------------------------------------------- reservar a data (mesmas regras; folga por espaço)
drop function reservar_data(uuid, timestamptz, timestamptz, uuid[]);
create function reservar_data(p_orcamento uuid, p_inicio timestamptz, p_fim timestamptz, p_recursos uuid[],
  p_montagem_horas numeric default null, p_desmontagem_horas numeric default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare o orcamentos%rowtype; v_id uuid; v_total bigint; n int := coalesce(array_length(p_recursos, 1), 0); r uuid; f record;
begin
  if not tem_permissao('orcamento.criar') then
    raise exception 'SEM_PERMISSAO: seu perfil não reserva datas' using errcode = '42501';
  end if;
  select * into o from orcamentos where id = p_orcamento for update;
  if not found or o.status = 'perdido' then
    raise exception 'STATUS_INVALIDO: orçamento inexistente ou perdido' using errcode = 'P0001';
  end if;
  if p_fim <= p_inicio or p_fim - p_inicio > interval '24 hours' then
    raise exception 'HORARIO_INVALIDO: o término precisa ser depois do início e o evento durar até 24 horas' using errcode = 'P0001';
  end if;
  if p_inicio < now() then
    raise exception 'HORARIO_INVALIDO: o início já passou' using errcode = 'P0001';
  end if;
  if (p_montagem_horas is not null and p_montagem_horas not between 0 and 48)
     or (p_desmontagem_horas is not null and p_desmontagem_horas not between 0 and 48) then
    raise exception 'HORARIO_INVALIDO: montagem e desmontagem entre 0 e 48 horas' using errcode = 'P0001';
  end if;
  if o.tipo = 'buffet_externo' and n > 0 then
    raise exception 'HORARIO_INVALIDO: buffet em local externo não ocupa espaço da Delta' using errcode = 'P0001';
  end if;
  if o.tipo <> 'buffet_externo' and n = 0 then
    raise exception 'HORARIO_INVALIDO: escolha o espaço' using errcode = 'P0001';
  end if;
  if n > 1 and not tem_permissao('capacidade.autorizar') then
    raise exception 'SEM_PERMISSAO: evento nos dois espaços precisa de aprovação da gerência' using errcode = '42501';
  end if;
  if exists (select 1 from reservas where orcamento_id = p_orcamento
              and status in ('bloqueio_temporario','confirmada','em_preparacao','realizada')) then
    raise exception 'STATUS_INVALIDO: este orçamento já tem a data reservada' using errcode = 'P0001';
  end if;
  perform expirar_bloqueios();

  select total_centavos into v_total from orcamento_versoes
   where orcamento_id = p_orcamento and status in ('aprovada','enviada','rascunho')
   order by (status = 'aprovada') desc, numero desc limit 1;

  insert into reservas (tipo, cliente_id, orcamento_id, titulo, evento_inicio, evento_fim, status, expira_em,
                        valor_total_centavos, criado_por)
  values ('evento', o.cliente_id, o.id, o.titulo, p_inicio, p_fim, 'bloqueio_temporario',
          now() + make_interval(hours => coalesce(cfg_int('reserva.bloqueio_horas'), 24)),
          nullif(v_total, 0), usuario_atual())
  returning id into v_id;

  foreach r in array coalesce(p_recursos, '{}') loop
    select * into f from folga_recurso(r, p_montagem_horas, p_desmontagem_horas);
    perform gravar_periodos(v_id, array[r], tstzrange(p_inicio - f.antes, p_fim + f.depois, '[)'));
  end loop;

  update orcamentos set data_evento = (p_inicio at time zone 'America/Fortaleza')::date,
                        recurso_id = case when n = 1 then p_recursos[1] else recurso_id end
   where id = o.id;
  return v_id;
end $$;

----------------------------------------------------------------------- bloqueio da agenda: período de vários dias e observações
drop function bloquear_agenda(uuid[], timestamptz, timestamptz, text);
create function bloquear_agenda(p_recursos uuid[], p_inicio timestamptz, p_fim timestamptz, p_motivo text,
  p_observacoes text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not tem_permissao('bloqueio.criar') then
    raise exception 'SEM_PERMISSAO: seu perfil não bloqueia a agenda' using errcode = '42501';
  end if;
  if coalesce(array_length(p_recursos, 1), 0) = 0 or p_fim <= p_inicio then
    raise exception 'HORARIO_INVALIDO: escolha o espaço e um período válido' using errcode = 'P0001';
  end if;
  if p_fim - p_inicio > interval '366 days' then
    raise exception 'HORARIO_INVALIDO: bloqueio de no máximo um ano' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'JUSTIFICATIVA_OBRIGATORIA: informe o motivo do bloqueio' using errcode = 'P0001';
  end if;
  perform expirar_bloqueios();
  insert into reservas (tipo, titulo, motivo, observacoes, evento_inicio, evento_fim, status, criado_por)
  values ('bloqueio_administrativo', 'Agenda bloqueada', trim(p_motivo), nullif(trim(coalesce(p_observacoes, '')), ''),
          p_inicio, p_fim, 'confirmada', usuario_atual())
  returning id into v_id;
  perform gravar_periodos(v_id, p_recursos, tstzrange(p_inicio, p_fim, '[)'));
  return v_id;
end $$;

----------------------------------------------------------------------- consultar disponibilidade (não grava nada)
create function verificar_disponibilidade(p_recursos uuid[], p_inicio timestamptz, p_fim timestamptz,
  p_com_folga boolean default true, p_montagem_horas numeric default null, p_desmontagem_horas numeric default null)
returns table (recurso_id uuid, recurso_nome text, livre boolean, conflito text, ocupado_de timestamptz, ocupado_ate timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare r uuid; f record; faixa tstzrange;
begin
  if not pode_ver_reservas() then
    raise exception 'SEM_PERMISSAO: seu perfil não consulta a agenda' using errcode = '42501';
  end if;
  if p_fim <= p_inicio then
    raise exception 'HORARIO_INVALIDO: o término precisa ser depois do início' using errcode = 'P0001';
  end if;
  foreach r in array coalesce(p_recursos, '{}') loop
    if p_com_folga then
      select * into f from folga_recurso(r, p_montagem_horas, p_desmontagem_horas);
      faixa := tstzrange(p_inicio - f.antes, p_fim + f.depois, '[)');
    else
      faixa := tstzrange(p_inicio, p_fim, '[)');
    end if;
    return query
      select rc.id, rc.nome,
             not exists (select 1 from reserva_periodos rp where rp.recurso_id = rc.id and rp.ativo and rp.periodo && faixa),
             texto_conflito(rc.id, faixa), lower(faixa), upper(faixa)
        from recursos rc where rc.id = r;
  end loop;
end $$;

----------------------------------------------------------------------- tudo o que a agenda mostra, numa chamada
create function agenda_detalhes(p_inicio timestamptz, p_fim timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare ver_valores boolean := tem_permissao('orcamento.ver') or tem_permissao('pagamento.confirmar');
begin
  if not pode_ver_reservas() then
    raise exception 'SEM_PERMISSAO: seu perfil não vê a agenda' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(x order by x->>'inicio')
      from (
        select jsonb_build_object(
          'id', r.id, 'tipo', r.tipo, 'status', r.status, 'titulo', r.titulo, 'motivo', r.motivo, 'observacoes', r.observacoes,
          'inicio', r.evento_inicio, 'fim', r.evento_fim, 'expira_em', r.expira_em, 'criado_em', r.criado_em,
          'criado_por', (select u.nome from usuarios u where u.id = r.criado_por),
          'cliente', c.nome,
          'orcamento', case when o.id is null then null else jsonb_build_object(
              'id', o.id, 'numero', o.numero, 'tipo', o.tipo, 'convidados', o.convidados, 'local_externo', o.local_externo) end,
          'espacos', coalesce((select jsonb_agg(jsonb_build_object('id', rc.id, 'nome', rc.nome, 'de', lower(rp.periodo), 'ate', upper(rp.periodo))
                                                order by rc.capacidade)
                                 from reserva_periodos rp join recursos rc on rc.id = rp.recurso_id
                                where rp.reserva_id = r.id and rp.ativo), '[]'::jsonb),
          'valor_total', case when ver_valores then r.valor_total_centavos end,
          'pago', case when ver_valores then (select coalesce(sum(ps.pago_centavos), 0) from parcelas_situacao ps where ps.reserva_id = r.id) end,
          'entrada_paga', case when ver_valores then (select ps.saldo_centavos = 0 from parcelas_situacao ps where ps.reserva_id = r.id and ps.numero = 1) end,
          'contrato', (select ct.status::text from contratos ct where ct.reserva_id = r.id order by ct.criado_em desc limit 1)
        ) x
          from reservas r
          left join clientes c on c.id = r.cliente_id
          left join orcamentos o on o.id = r.orcamento_id
         where r.status in ('bloqueio_temporario', 'confirmada', 'em_preparacao', 'realizada')
           and r.evento_inicio < p_fim and r.evento_fim > p_inicio
      ) s
  ), '[]'::jsonb);
end $$;

-- quem pode ser responsável pelo atendimento (para o cadastro rápido de evento)
create function usuarios_atendimento() returns table (id uuid, nome text)
language sql stable security definer set search_path = public as $$
  select u.id, u.nome from usuarios u
   where u.ativo and tem_permissao('orcamento.criar')
     and exists (select 1 from usuarios_perfis up join perfis_permissoes pp on pp.perfil = up.perfil
                  where up.usuario = u.id and pp.permissao = 'orcamento.criar')
   order by u.nome
$$;

-- tempos por espaço, pela tela de Configurações
create function definir_tempos_espaco(p_recurso uuid, p_montagem numeric, p_desmontagem numeric, p_limpeza numeric, p_intervalo numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('config.critica') then
    raise exception 'SEM_PERMISSAO: só a administração muda os tempos dos espaços' using errcode = '42501';
  end if;
  update recursos set montagem_horas = p_montagem, desmontagem_horas = p_desmontagem, limpeza_horas = p_limpeza, intervalo_horas = p_intervalo
   where id = p_recurso;
  if not found then raise exception 'STATUS_INVALIDO: espaço não encontrado' using errcode = 'P0001'; end if;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'folga_recurso(uuid, numeric, numeric)', 'reservar_data(uuid, timestamptz, timestamptz, uuid[], numeric, numeric)',
    'bloquear_agenda(uuid[], timestamptz, timestamptz, text, text)',
    'verificar_disponibilidade(uuid[], timestamptz, timestamptz, boolean, numeric, numeric)',
    'agenda_detalhes(timestamptz, timestamptz)', 'usuarios_atendimento()',
    'definir_tempos_espaco(uuid, numeric, numeric, numeric, numeric)']
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    if f <> 'folga_recurso(uuid, numeric, numeric)' then execute format('grant execute on function %s to delta_app', f); end if;
  end loop;
end $$;
