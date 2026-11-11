-- Fase 4: agenda por espaço e horário, bloqueio temporário e administrativo, contrato versionado,
-- parcelas, pagamentos (baixa e estorno), confirmação transacional e cancelamento pela política.

create extension if not exists pg_cron;

----------------------------------------------------------------------- configurações novas
alter table configuracoes drop constraint configuracoes_tipo_check;
alter table configuracoes add constraint configuracoes_tipo_check
  check (tipo in ('inteiro','percentual','horas','dias','centavos','faixa_centavos','texto','texto_opcional'));

create or replace function trg_configuracao_valida() returns trigger
language plpgsql set search_path = public as $$
declare v jsonb := new.valor;
begin
  if new.tipo in ('inteiro','horas','dias','centavos') then
    if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric <> trunc((v #>> '{}')::numeric) or (v #>> '{}')::numeric < 0 then
      raise exception 'CONFIG_INVALIDA: % precisa ser um número inteiro maior ou igual a zero', new.chave;
    end if;
  elsif new.tipo = 'percentual' then
    if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric not between 0 and 100
       or (v #>> '{}')::numeric <> trunc((v #>> '{}')::numeric) then
      raise exception 'CONFIG_INVALIDA: % precisa ser um percentual inteiro de 0 a 100', new.chave;
    end if;
  elsif new.tipo = 'faixa_centavos' then
    if jsonb_typeof(v) <> 'object' or jsonb_typeof(v -> 'min') <> 'number' or jsonb_typeof(v -> 'max') <> 'number'
       or (v ->> 'min')::numeric < 0 or (v ->> 'min')::numeric > (v ->> 'max')::numeric then
      raise exception 'CONFIG_INVALIDA: % precisa de mínimo e máximo, com mínimo até o máximo', new.chave;
    end if;
  elsif new.tipo = 'texto' then
    if jsonb_typeof(v) <> 'string' or length(trim(v #>> '{}')) = 0 then
      raise exception 'CONFIG_INVALIDA: % precisa de um texto', new.chave;
    end if;
  elsif new.tipo = 'texto_opcional' then
    if jsonb_typeof(v) <> 'string' then
      raise exception 'CONFIG_INVALIDA: % precisa ser um texto (pode ficar vazio)', new.chave;
    end if;
  end if;
  if tg_op = 'UPDATE' then
    if new.chave <> old.chave or new.tipo <> old.tipo then
      raise exception 'CONFIG_INVALIDA: chave e tipo não mudam';
    end if;
    new.atualizado_em := now();
    new.atualizado_por := usuario_atual();
  end if;
  return new;
end $$;

insert into configuracoes (chave, grupo, descricao, tipo, valor, ordem) values
  ('espaco.montagem_horas',   'Reservas',   'Tempo de montagem bloqueado antes do evento', 'horas', '0', 15),
  ('reserva.prorrogacao_horas','Reservas',  'Prorrogação de um bloqueio temporário',       'horas', '24', 12),
  ('empresa.pix_chave',       'Empresa',    'Chave Pix (Banco Inter) para cobrança',        'texto_opcional', '""', 50),
  ('empresa.cidade',          'Empresa',    'Cidade (para o Pix e o contrato)',             'texto', '"Bacabal"', 45);

----------------------------------------------------------------------- reservas
alter table reservas
  alter column cliente_id drop not null,
  alter column valor_total_centavos drop not null,
  drop constraint reservas_valor_total_centavos_check,
  add constraint reservas_valor_positivo check (valor_total_centavos is null or valor_total_centavos > 0),
  add column tipo text not null default 'evento' check (tipo in ('evento','bloqueio_administrativo')),
  add column orcamento_id uuid references orcamentos(id),
  add column titulo text,
  add column evento_inicio timestamptz,
  add column evento_fim timestamptz,
  add column motivo text,
  add column prorrogacoes integer not null default 0,
  add column confirmada_em timestamptz,
  add column confirmada_por uuid references usuarios(id),
  add column cancelada_em timestamptz,
  add column cancelada_por uuid references usuarios(id),
  add column cancelamento jsonb,
  add constraint reservas_cliente_obrigatorio check (tipo = 'bloqueio_administrativo' or cliente_id is not null),
  add constraint reservas_periodo_valido check (evento_fim is null or evento_fim > evento_inicio);

create unique index uq_reserva_ativa_por_orcamento on reservas (orcamento_id)
  where orcamento_id is not null and status in ('bloqueio_temporario','confirmada','em_preparacao','realizada');
create index ix_reservas_inicio on reservas (evento_inicio);

----------------------------------------------------------------------- contratos
create table contrato_modelos (
  id          uuid primary key default gen_random_uuid(),
  versao      integer not null unique,
  titulo      text not null,
  corpo       text not null check (length(corpo) > 200),
  anexo       text,
  observacao  text,
  criado_por  uuid references usuarios(id) default usuario_atual(),
  criado_em   timestamptz not null default now()
);
create trigger contrato_modelos_imutavel before update or delete on contrato_modelos
  for each row execute function trg_bloquear_alteracao();
create trigger aud_contrato_modelos after insert on contrato_modelos for each row execute function trg_auditar();

alter table contratos
  add column modelo_versao integer,
  add column conteudo jsonb,
  add column texto text,
  add column conteudo_hash text,
  add column signatario_delta text,
  add column gerado_por uuid references usuarios(id) default usuario_atual(),
  add column assinatura_forma text check (assinatura_forma in ('presencial','gov_br','eletronica','outra')),
  add column canal_venda text check (canal_venda in ('estabelecimento','fora_estabelecimento')),
  add column assinatura_obs text,
  add column assinatura_registrada_por uuid references usuarios(id),
  add column cancelado_em timestamptz;
create unique index uq_contrato_ativo on contratos (reserva_id) where status in ('rascunho','enviado','assinado');

-- Contrato gerado não muda: só troca de situação (enviado → assinado/substituído/cancelado; assinado → cancelado/substituído)
-- e, na assinatura, os dados da assinatura.
create or replace function trg_contrato_imutavel() returns trigger
language plpgsql set search_path = public as $$
declare livres text[] := array['status','assinado_em','assinatura_forma','canal_venda','assinatura_obs','assinatura_registrada_por','cancelado_em'];
begin
  if old.status = 'rascunho' then return new; end if;
  if (to_jsonb(new) - livres) <> (to_jsonb(old) - livres) then
    raise exception 'CONTRATO_IMUTAVEL: contrato gerado não pode ser alterado; gere uma nova versão' using errcode = 'P0001';
  end if;
  if old.status = 'enviado' and new.status not in ('enviado','assinado','substituido','cancelado') then
    raise exception 'CONTRATO_IMUTAVEL: transição inválida' using errcode = 'P0001';
  end if;
  if old.status = 'assinado' and (new.status not in ('assinado','cancelado','substituido')
       or (new.assinado_em, new.assinatura_forma, new.canal_venda) is distinct from (old.assinado_em, old.assinatura_forma, old.canal_venda)) then
    raise exception 'CONTRATO_ASSINADO_IMUTAVEL: contrato assinado não muda; cancele ou substitua por aditivo' using errcode = 'P0001';
  end if;
  if old.status in ('cancelado','substituido') and new.status <> old.status then
    raise exception 'CONTRATO_IMUTAVEL: contrato encerrado' using errcode = 'P0001';
  end if;
  return new;
end $$;

----------------------------------------------------------------------- pagamentos
alter table pagamentos
  add column recebido_em date,
  add column observacao text,
  add column estorno_de uuid references pagamentos(id);
alter table parcelas add column criado_em timestamptz not null default now();

drop view if exists parcelas_situacao;
create view parcelas_situacao with (security_invoker = true) as
select p.id as parcela_id, p.reserva_id, p.numero, p.valor_centavos, p.vencimento,
       coalesce(sum(case g.tipo when 'recebimento' then g.valor_centavos else -g.valor_centavos end), 0)::bigint as pago_centavos,
       p.valor_centavos - coalesce(sum(case g.tipo when 'recebimento' then g.valor_centavos else -g.valor_centavos end), 0)::bigint as saldo_centavos
  from parcelas p left join pagamentos g on g.parcela_id = p.id
 group by p.id;

----------------------------------------------------------------------- funções auxiliares
create function hoje_delta() returns date language sql stable set search_path = public as $$ select (now() at time zone 'America/Fortaleza')::date $$;

-- 150050 → "R$ 1.500,50" (independe da configuração regional do banco)
create function formatar_reais(c bigint) returns text language sql immutable set search_path = public as $$
  select 'R$ ' || translate(to_char(c / 100.0, 'FM999,999,990.00'), ',.', '.,')
$$;

create function texto_conflito(p_recurso uuid, p_periodo tstzrange) returns text
language sql stable security definer set search_path = public as $$
  select format('%s já está ocupado de %s a %s (%s)', rc.nome,
                to_char(lower(rp.periodo) at time zone 'America/Fortaleza', 'DD/MM HH24:MI'),
                to_char(upper(rp.periodo) at time zone 'America/Fortaleza', 'DD/MM HH24:MI'),
                case r.tipo when 'bloqueio_administrativo' then 'bloqueio da agenda'
                            else case r.status when 'bloqueio_temporario' then 'data segura por outro orçamento' else 'reserva confirmada' end end)
    from reserva_periodos rp join reservas r on r.id = rp.reserva_id join recursos rc on rc.id = rp.recurso_id
   where rp.recurso_id = p_recurso and rp.ativo and rp.periodo && p_periodo
   order by lower(rp.periodo) limit 1
$$;

-- Grava os períodos de uma reserva; em conflito, diz qual espaço e quando.
create function gravar_periodos(p_reserva uuid, p_recursos uuid[], p_periodo tstzrange) returns void
language plpgsql security definer set search_path = public as $$
declare r uuid;
begin
  foreach r in array coalesce(p_recursos, '{}') loop
    begin
      insert into reserva_periodos (reserva_id, recurso_id, periodo) values (p_reserva, r, p_periodo);
    exception when exclusion_violation then
      raise exception 'DATA_INDISPONIVEL: %', coalesce(texto_conflito(r, p_periodo), 'o espaço já está ocupado nesse período') using errcode = 'P0001';
    end;
  end loop;
end $$;

drop function if exists criar_bloqueio_temporario(uuid, bigint, uuid[], tstzrange, integer, uuid);
drop function if exists confirmar_reserva(uuid, uuid);
drop function if exists gerar_parcelas(uuid, date, integer, integer);

----------------------------------------------------------------------- reservar a data (bloqueio temporário)
create function reservar_data(p_orcamento uuid, p_inicio timestamptz, p_fim timestamptz, p_recursos uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare o orcamentos%rowtype; v_id uuid; v_total bigint; n int := coalesce(array_length(p_recursos, 1), 0);
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

  perform gravar_periodos(v_id, p_recursos,
    tstzrange(p_inicio - make_interval(hours => coalesce(cfg_int('espaco.montagem_horas'), 0)),
              p_fim + make_interval(hours => coalesce(cfg_int('espaco.limpeza_horas'), 4)), '[)'));

  update orcamentos set data_evento = (p_inicio at time zone 'America/Fortaleza')::date,
                        recurso_id = case when n = 1 then p_recursos[1] else recurso_id end
   where id = o.id;
  return v_id;
end $$;

create function prorrogar_bloqueio(p_reserva uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('reserva.confirmar') then
    raise exception 'SEM_PERMISSAO: só gerência, financeiro ou administração prorrogam' using errcode = '42501';
  end if;
  update reservas set expira_em = greatest(expira_em, now()) + make_interval(hours => coalesce(cfg_int('reserva.prorrogacao_horas'), 24)),
                      prorrogacoes = prorrogacoes + 1, atualizado_em = now()
   where id = p_reserva and status = 'bloqueio_temporario' and expira_em > now();
  if not found then
    raise exception 'STATUS_INVALIDO: o bloqueio já expirou ou não está ativo' using errcode = 'P0001';
  end if;
end $$;

create function liberar_bloqueio(p_reserva uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('orcamento.criar') then
    raise exception 'SEM_PERMISSAO: seu perfil não libera datas' using errcode = '42501';
  end if;
  if exists (select 1 from contratos where reserva_id = p_reserva and status = 'assinado')
     or exists (select 1 from parcelas_situacao where reserva_id = p_reserva and pago_centavos > 0) then
    raise exception 'STATUS_INVALIDO: há contrato assinado ou pagamento; use o cancelamento pela política' using errcode = 'P0001';
  end if;
  update reservas set status = 'cancelada', cancelada_em = now(), cancelada_por = usuario_atual(), atualizado_em = now(),
                      cancelamento = jsonb_build_object('iniciativa', 'liberacao', 'multa_centavos', 0)
   where id = p_reserva and tipo = 'evento' and status in ('bloqueio_temporario','expirada');
  if not found then raise exception 'STATUS_INVALIDO: não há bloqueio para liberar' using errcode = 'P0001'; end if;
  update contratos set status = 'cancelado', cancelado_em = now() where reserva_id = p_reserva and status = 'enviado';
end $$;

----------------------------------------------------------------------- bloqueio administrativo da agenda
create function bloquear_agenda(p_recursos uuid[], p_inicio timestamptz, p_fim timestamptz, p_motivo text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not tem_permissao('bloqueio.criar') then
    raise exception 'SEM_PERMISSAO: seu perfil não bloqueia a agenda' using errcode = '42501';
  end if;
  if coalesce(array_length(p_recursos, 1), 0) = 0 or p_fim <= p_inicio then
    raise exception 'HORARIO_INVALIDO: escolha o espaço e um período válido' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'JUSTIFICATIVA_OBRIGATORIA: informe o motivo do bloqueio' using errcode = 'P0001';
  end if;
  perform expirar_bloqueios();
  insert into reservas (tipo, titulo, motivo, evento_inicio, evento_fim, status, criado_por)
  values ('bloqueio_administrativo', 'Agenda bloqueada', trim(p_motivo), p_inicio, p_fim, 'confirmada', usuario_atual())
  returning id into v_id;
  perform gravar_periodos(v_id, p_recursos, tstzrange(p_inicio, p_fim, '[)'));
  return v_id;
end $$;

create function remover_bloqueio_agenda(p_reserva uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('bloqueio.remover') then
    raise exception 'SEM_PERMISSAO: seu perfil não remove bloqueios' using errcode = '42501';
  end if;
  update reservas set status = 'cancelada', cancelada_em = now(), cancelada_por = usuario_atual(), atualizado_em = now()
   where id = p_reserva and tipo = 'bloqueio_administrativo' and status = 'confirmada';
  if not found then raise exception 'STATUS_INVALIDO: bloqueio não encontrado' using errcode = 'P0001'; end if;
end $$;

----------------------------------------------------------------------- contrato
create function criar_modelo_contrato(p_titulo text, p_corpo text, p_anexo text, p_observacao text) returns integer
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if not tem_permissao('contrato.editar') then
    raise exception 'SEM_PERMISSAO: só a administração edita o modelo de contrato' using errcode = '42501';
  end if;
  select coalesce(max(versao), 0) + 1 into v from contrato_modelos;
  insert into contrato_modelos (versao, titulo, corpo, anexo, observacao)
  values (v, trim(p_titulo), p_corpo, nullif(trim(p_anexo), ''), nullif(trim(p_observacao), ''));
  return v;
end $$;

-- Grava o contrato montado pelo servidor e gera as parcelas. O texto final fica congelado com impressão digital.
create function gerar_contrato(p_reserva uuid, p_modelo_versao integer, p_signatario text, p_texto text, p_conteudo jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare r reservas%rowtype; o orcamentos%rowtype; v orcamento_versoes%rowtype; c clientes%rowtype;
        v_id uuid; v_versao int; v_sinal bigint; v_dias int; n_parc int; pago bigint; integral boolean;
        venc2 date;
begin
  if not tem_permissao('contrato.gerar') then
    raise exception 'SEM_PERMISSAO: seu perfil não gera contratos' using errcode = '42501';
  end if;
  select * into r from reservas where id = p_reserva for update;
  if not found or r.tipo <> 'evento' or r.status not in ('bloqueio_temporario','expirada','confirmada') then
    raise exception 'STATUS_INVALIDO: a reserva precisa estar com a data segura' using errcode = 'P0001';
  end if;
  select * into o from orcamentos where id = r.orcamento_id;
  if o.status <> 'aprovado' then
    raise exception 'STATUS_INVALIDO: registre antes o aceite do cliente no orçamento' using errcode = 'P0001';
  end if;
  select * into v from orcamento_versoes where orcamento_id = o.id and status = 'aprovada';
  select * into c from clientes where id = r.cliente_id;
  if c.documento is null or coalesce(trim(c.endereco), '') = '' then
    raise exception 'CONTRATO_DADOS_CLIENTE: complete o CPF/CNPJ e o endereço do cliente antes de gerar o contrato' using errcode = 'P0001';
  end if;
  if c.tipo = 'PJ' and coalesce(trim(c.responsavel_nome), '') = '' then
    raise exception 'CONTRATO_DADOS_CLIENTE: informe o responsável que assina pela empresa' using errcode = 'P0001';
  end if;
  if exists (select 1 from contratos where reserva_id = p_reserva and status = 'assinado') then
    raise exception 'CONTRATO_ASSINADO_IMUTAVEL: já existe contrato assinado; para mudar, cancele ou faça aditivo' using errcode = 'P0001';
  end if;
  if not exists (select 1 from contrato_modelos where versao = p_modelo_versao) then
    raise exception 'STATUS_INVALIDO: modelo de contrato inexistente' using errcode = 'P0001';
  end if;
  if length(coalesce(p_texto, '')) < 500 or p_texto ~ '\{\{' then
    raise exception 'STATUS_INVALIDO: texto do contrato incompleto' using errcode = 'P0001';
  end if;

  update contratos set status = 'substituido' where reserva_id = p_reserva and status in ('rascunho','enviado');
  select coalesce(max(versao), 0) + 1 into v_versao from contratos where reserva_id = p_reserva;
  insert into contratos (reserva_id, versao, status, modelo_versao, conteudo, texto, conteudo_hash, signatario_delta)
  values (p_reserva, v_versao, 'enviado', p_modelo_versao, p_conteudo, p_texto,
          encode(extensions.digest(p_texto, 'sha256'), 'hex'), trim(p_signatario))
  returning id into v_id;

  update reservas set valor_total_centavos = v.total_centavos, atualizado_em = now() where id = p_reserva;

  -- parcelas: 50%/50% (saldo até X dias antes) ou integral se o evento está perto
  v_dias := (r.evento_inicio at time zone 'America/Fortaleza')::date - hoje_delta();
  integral := v_dias < coalesce(cfg_int('financeiro.pagamento_integral_dias'), 7);
  v_sinal := case when integral then v.total_centavos
                  else (v.total_centavos * coalesce(cfg_int('financeiro.sinal_percentual'), 50) + 99) / 100 end;
  venc2 := (r.evento_inicio at time zone 'America/Fortaleza')::date - coalesce(cfg_int('financeiro.saldo_dias_antes'), 7);
  select count(*), coalesce(sum(pago_centavos), 0) into n_parc, pago from parcelas_situacao where reserva_id = p_reserva;
  if n_parc = 0 then
    insert into parcelas (reserva_id, numero, valor_centavos, vencimento) values (p_reserva, 1, v_sinal, hoje_delta());
    if not integral then
      insert into parcelas (reserva_id, numero, valor_centavos, vencimento) values (p_reserva, 2, v.total_centavos - v_sinal, venc2);
    end if;
  elsif pago = 0 and n_parc = (case when integral then 1 else 2 end) then
    update parcelas set valor_centavos = v_sinal where reserva_id = p_reserva and numero = 1;
    update parcelas set valor_centavos = v.total_centavos - v_sinal, vencimento = venc2 where reserva_id = p_reserva and numero = 2;
  elsif (select sum(valor_centavos) from parcelas where reserva_id = p_reserva) <> v.total_centavos then
    raise exception 'PARCELAS_COM_PAGAMENTO: o valor mudou e já há pagamento registrado; ajuste com o financeiro' using errcode = 'P0001';
  end if;
  return v_id;
end $$;

create function registrar_assinatura(p_contrato uuid, p_data date, p_forma text, p_canal text, p_obs text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('contrato.gerar') then
    raise exception 'SEM_PERMISSAO: seu perfil não registra assinatura' using errcode = '42501';
  end if;
  if p_data > hoje_delta() then
    raise exception 'HORARIO_INVALIDO: a data da assinatura não pode ser futura' using errcode = 'P0001';
  end if;
  update contratos set status = 'assinado',
         assinado_em = (p_data::timestamp + time '12:00') at time zone 'America/Fortaleza',
         assinatura_forma = p_forma, canal_venda = p_canal, assinatura_obs = nullif(trim(p_obs), ''),
         assinatura_registrada_por = usuario_atual()
   where id = p_contrato and status = 'enviado';
  if not found then raise exception 'STATUS_INVALIDO: só um contrato gerado e ainda não assinado pode ser assinado' using errcode = 'P0001'; end if;
end $$;

----------------------------------------------------------------------- pagamentos
create function registrar_pagamento(p_parcela uuid, p_valor bigint, p_forma text, p_recebido_em date,
  p_referencia text default null, p_provedor text default null, p_id_externo text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare s parcelas_situacao%rowtype; st reserva_status; v_id uuid;
begin
  if not tem_permissao('pagamento.confirmar') then
    raise exception 'SEM_PERMISSAO: só o financeiro dá baixa em pagamento' using errcode = '42501';
  end if;
  perform 1 from parcelas where id = p_parcela for update;
  select * into s from parcelas_situacao where parcela_id = p_parcela;
  if not found then raise exception 'STATUS_INVALIDO: parcela inexistente' using errcode = 'P0001'; end if;
  select status into st from reservas where id = s.reserva_id;
  if st = 'cancelada' then raise exception 'STATUS_INVALIDO: reserva cancelada' using errcode = 'P0001'; end if;
  if p_valor <= 0 or p_valor > s.saldo_centavos then
    raise exception 'VALOR_INVALIDO: o valor precisa ser maior que zero e no máximo o saldo da parcela (%)', formatar_reais(s.saldo_centavos) using errcode = 'P0001';
  end if;
  if p_recebido_em > hoje_delta() then
    raise exception 'HORARIO_INVALIDO: a data do recebimento não pode ser futura' using errcode = 'P0001';
  end if;
  begin
    insert into pagamentos (parcela_id, tipo, valor_centavos, forma, provedor, id_externo, referencia, confirmado_por, recebido_em)
    values (p_parcela, 'recebimento', p_valor, p_forma, nullif(trim(p_provedor), ''), nullif(trim(p_id_externo), ''),
            nullif(trim(p_referencia), ''), usuario_atual(), p_recebido_em)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'PAGAMENTO_DUPLICADO: este identificador de pagamento já foi registrado' using errcode = 'P0001';
  end;
  return v_id;
end $$;

create function estornar_pagamento(p_pagamento uuid, p_valor bigint, p_motivo text) returns uuid
language plpgsql security definer set search_path = public as $$
declare g pagamentos%rowtype; ja bigint; v_id uuid;
begin
  if not tem_permissao('pagamento.estornar') then
    raise exception 'SEM_PERMISSAO: só a administração estorna pagamentos' using errcode = '42501';
  end if;
  select * into g from pagamentos where id = p_pagamento and tipo = 'recebimento' for update;
  if not found then raise exception 'STATUS_INVALIDO: recebimento não encontrado' using errcode = 'P0001'; end if;
  select coalesce(sum(valor_centavos), 0) into ja from pagamentos where estorno_de = p_pagamento;
  if p_valor <= 0 or p_valor > g.valor_centavos - ja then
    raise exception 'VALOR_INVALIDO: o estorno pode ser de até %', formatar_reais(g.valor_centavos - ja) using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'JUSTIFICATIVA_OBRIGATORIA: informe o motivo do estorno' using errcode = 'P0001';
  end if;
  insert into pagamentos (parcela_id, tipo, valor_centavos, forma, referencia, confirmado_por, recebido_em, observacao, estorno_de)
  values (g.parcela_id, 'estorno', p_valor, g.forma, 'Estorno', usuario_atual(), hoje_delta(), trim(p_motivo), p_pagamento)
  returning id into v_id;
  return v_id;
end $$;

----------------------------------------------------------------------- confirmação (cenário 3)
create function confirmar_reserva(p_reserva uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r reservas%rowtype; v_ok boolean; venc2 date;
begin
  if not tem_permissao('reserva.confirmar') then
    raise exception 'SEM_PERMISSAO: seu perfil não confirma reservas' using errcode = '42501';
  end if;
  select * into r from reservas where id = p_reserva for update;
  if not found then raise exception 'RESERVA_INEXISTENTE' using errcode = 'P0001'; end if;
  if r.status not in ('bloqueio_temporario','expirada') then
    raise exception 'STATUS_INVALIDO: a reserva está %', r.status using errcode = 'P0001';
  end if;
  if not exists (select 1 from contratos where reserva_id = p_reserva and status = 'assinado') then
    raise exception 'CONTRATO_NAO_ASSINADO: registre a assinatura do contrato antes de confirmar' using errcode = 'P0001';
  end if;
  select (pago_centavos >= valor_centavos) into v_ok from parcelas_situacao where reserva_id = p_reserva and numero = 1;
  if v_ok is not true then
    raise exception 'ENTRADA_NAO_CONFIRMADA: dê baixa na primeira parcela antes de confirmar' using errcode = 'P0001';
  end if;
  begin
    update reservas set status = 'confirmada', expira_em = null, confirmada_em = now(), confirmada_por = usuario_atual(),
                        atualizado_em = now()
     where id = p_reserva;
  exception when exclusion_violation then
    raise exception 'DATA_INDISPONIVEL: a data foi ocupada depois que o bloqueio expirou; combine nova data ou devolução' using errcode = 'P0001';
  end;
  select vencimento into venc2 from parcelas where reserva_id = p_reserva and numero = 2;
  if venc2 is not null then
    insert into tarefas (titulo, vence_em, responsavel, cliente_id, orcamento_id, criado_por)
    select format('Cobrar o saldo de %s (vence %s)', coalesce(r.titulo, 'evento'), to_char(venc2, 'DD/MM')),
           ((venc2 - 2)::timestamp + time '10:00') at time zone 'America/Fortaleza',
           coalesce(o.responsavel, usuario_atual()), r.cliente_id, r.orcamento_id, usuario_atual()
      from orcamentos o where o.id = r.orcamento_id;
  end if;
end $$;

----------------------------------------------------------------------- cancelamento pela política
create function calcular_cancelamento(p_reserva uuid, p_iniciativa text, p_data date default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r reservas%rowtype; c contratos%rowtype; d date := coalesce(p_data, hoje_delta());
        dias int; pct int := 0; faixa text := null; base bigint; pago bigint; multa bigint := 0;
        devolver bigint := 0; cobrar bigint := 0; obs text := null; elegivel boolean := true;
begin
  if not (tem_permissao('reserva.cancelar') or tem_permissao('pagamento.confirmar') or tem_permissao('orcamento.ver')) then
    raise exception 'SEM_PERMISSAO' using errcode = '42501';
  end if;
  select * into r from reservas where id = p_reserva;
  select * into c from contratos where reserva_id = p_reserva and status = 'assinado';
  select coalesce(sum(pago_centavos), 0) into pago from parcelas_situacao where reserva_id = p_reserva;
  base := coalesce(r.valor_total_centavos, 0);
  dias := (r.evento_inicio at time zone 'America/Fortaleza')::date - d;

  if c.id is not null and p_iniciativa in ('cliente','delta') then
    if    dias > 120 then pct := cfg_int('cancelamento.multa_faixa_a'); faixa := 'mais de 120 dias';
    elsif dias >= 91 then pct := cfg_int('cancelamento.multa_faixa_b'); faixa := '91 a 120 dias';
    elsif dias >= 61 then pct := cfg_int('cancelamento.multa_faixa_c'); faixa := '61 a 90 dias';
    elsif dias >= 31 then pct := cfg_int('cancelamento.multa_faixa_d'); faixa := '31 a 60 dias';
    elsif dias >= 8  then pct := cfg_int('cancelamento.multa_faixa_e'); faixa := '8 a 30 dias';
    else                  pct := cfg_int('cancelamento.multa_faixa_f'); faixa := '7 dias ou menos';
    end if;
    multa := (base * pct) / 100;
  end if;

  if p_iniciativa = 'cliente' then
    devolver := greatest(pago - multa, 0); cobrar := greatest(multa - pago, 0);
    if c.id is null then obs := 'Sem contrato assinado: não há multa contratual.'; end if;
  elsif p_iniciativa = 'delta' then
    devolver := pago + multa;
    obs := 'Cancelamento pela Delta: devolve o que recebeu e paga ao cliente multa equivalente (cláusula 9.2).';
  elsif p_iniciativa = 'arrependimento' then
    elegivel := c.id is not null and c.canal_venda = 'fora_estabelecimento'
                and d - (c.assinado_em at time zone 'America/Fortaleza')::date <= 7;
    devolver := pago;
    obs := case when elegivel then 'Direito de arrependimento (CDC art. 49): devolução integral, sem multa.'
                else 'Não se aplica: só para contrato fechado fora do estabelecimento e dentro de 7 dias da assinatura.' end;
  elsif p_iniciativa = 'forca_maior' then
    devolver := pago;
    obs := 'Força maior: sem multa automática. Despesas comprovadas podem ser descontadas por acordo (cláusula 10.3).';
  else
    raise exception 'STATUS_INVALIDO: iniciativa inválida' using errcode = 'P0001';
  end if;

  return jsonb_build_object('iniciativa', p_iniciativa, 'data', d, 'dias_antes', dias, 'faixa', faixa, 'percentual', pct,
    'base_centavos', base, 'multa_centavos', multa, 'pago_centavos', pago, 'devolver_centavos', devolver,
    'cobrar_centavos', cobrar, 'elegivel', elegivel, 'contrato_assinado', c.id is not null, 'observacao', obs);
end $$;

create function cancelar_reserva(p_reserva uuid, p_iniciativa text, p_motivo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r reservas%rowtype; calc jsonb; resp uuid;
begin
  if not tem_permissao('reserva.cancelar') then
    raise exception 'SEM_PERMISSAO: seu perfil não cancela reservas' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'JUSTIFICATIVA_OBRIGATORIA: descreva o motivo do cancelamento' using errcode = 'P0001';
  end if;
  select * into r from reservas where id = p_reserva for update;
  if not found or r.tipo <> 'evento' or r.status not in ('bloqueio_temporario','expirada','confirmada','em_preparacao') then
    raise exception 'STATUS_INVALIDO: reserva não pode ser cancelada nesta situação' using errcode = 'P0001';
  end if;
  calc := calcular_cancelamento(p_reserva, p_iniciativa);
  if not (calc ->> 'elegivel')::boolean then
    raise exception 'STATUS_INVALIDO: %', calc ->> 'observacao' using errcode = 'P0001';
  end if;
  calc := calc || jsonb_build_object('motivo', trim(p_motivo));
  update reservas set status = 'cancelada', cancelada_em = now(), cancelada_por = usuario_atual(),
                      cancelamento = calc, atualizado_em = now()
   where id = p_reserva;
  update contratos set status = 'cancelado', cancelado_em = now() where reserva_id = p_reserva and status in ('enviado','assinado');
  update tarefas set concluida_em = now(), concluida_por = usuario_atual()
   where orcamento_id = r.orcamento_id and concluida_em is null;

  select responsavel into resp from orcamentos where id = r.orcamento_id;
  if (calc ->> 'devolver_centavos')::bigint > 0 then
    insert into tarefas (titulo, descricao, vence_em, responsavel, cliente_id, orcamento_id, criado_por)
    values (format('Devolver %s ao cliente (cancelamento de %s)', formatar_reais((calc ->> 'devolver_centavos')::bigint), coalesce(r.titulo, 'evento')),
            'Registrar o estorno no Financeiro depois de fazer a transferência.', now() + interval '3 days',
            coalesce(resp, usuario_atual()), r.cliente_id, r.orcamento_id, usuario_atual());
  end if;
  if (calc ->> 'cobrar_centavos')::bigint > 0 then
    insert into tarefas (titulo, vence_em, responsavel, cliente_id, orcamento_id, criado_por)
    values (format('Cobrar multa de %s (cancelamento de %s)', formatar_reais((calc ->> 'cobrar_centavos')::bigint), coalesce(r.titulo, 'evento')),
            now() + interval '3 days', coalesce(resp, usuario_atual()), r.cliente_id, r.orcamento_id, usuario_atual());
  end if;
  return calc;
end $$;

----------------------------------------------------------------------- agenda (somente leitura)
create view agenda with (security_invoker = true) as
select r.id as reserva_id, r.tipo, r.status, r.titulo, r.motivo, r.evento_inicio, r.evento_fim, r.expira_em,
       r.orcamento_id, r.cliente_id, c.nome as cliente_nome, rp.recurso_id, rc.nome as recurso_nome,
       lower(rp.periodo) as ocupado_de, upper(rp.periodo) as ocupado_ate
  from reservas r
  left join reserva_periodos rp on rp.reserva_id = r.id
  left join recursos rc on rc.id = rp.recurso_id
  left join clientes c on c.id = r.cliente_id
 where r.status in ('bloqueio_temporario','confirmada','em_preparacao','realizada');

----------------------------------------------------------------------- expiração automática
create or replace function expirar_bloqueios() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update reservas set status = 'expirada', atualizado_em = now()
   where status = 'bloqueio_temporario' and expira_em < now();
  get diagnostics n = row_count;
  return n;
end $$;
select cron.schedule('delta-expirar-bloqueios', '*/10 * * * *', 'select public.expirar_bloqueios()');

----------------------------------------------------------------------- políticas e privilégios
alter table contrato_modelos enable row level security;
create policy modelos_ler on contrato_modelos for select using (tem_permissao('contrato.gerar') or tem_permissao('contrato.editar'));

grant select on contrato_modelos, agenda, parcelas_situacao to delta_app;
grant execute on function reservar_data(uuid, timestamptz, timestamptz, uuid[]), prorrogar_bloqueio(uuid), liberar_bloqueio(uuid),
  bloquear_agenda(uuid[], timestamptz, timestamptz, text), remover_bloqueio_agenda(uuid),
  criar_modelo_contrato(text, text, text, text), gerar_contrato(uuid, integer, text, text, jsonb),
  registrar_assinatura(uuid, date, text, text, text), registrar_pagamento(uuid, bigint, text, date, text, text, text),
  estornar_pagamento(uuid, bigint, text), confirmar_reserva(uuid), calcular_cancelamento(uuid, text, date),
  cancelar_reserva(uuid, text, text), hoje_delta(), formatar_reais(bigint) to delta_app;
revoke execute on function texto_conflito(uuid, tstzrange), gravar_periodos(uuid, uuid[], tstzrange), expirar_bloqueios()
  from public, anon, authenticated;
