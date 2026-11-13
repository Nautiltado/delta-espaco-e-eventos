-- Orçamentos, etapa 1: unidades configuráveis, item completo (categoria, descrição para o cliente, desconto próprio,
-- preço pendente), alertas de custo e trilha de alterações dos itens.

----------------------------------------------------------------------- unidades de cobrança
create table unidades (
  codigo     text primary key check (codigo ~ '^[a-z_]{2,20}$'),
  singular   text not null check (length(trim(singular)) between 1 and 30),
  plural     text not null check (length(trim(plural)) between 1 and 30),
  -- equivalência: 1 cento = 100 unidade
  equivale_quantidade numeric(12,3) check (equivale_quantidade > 0),
  equivale_unidade    text references unidades(codigo),
  -- passo de arredondamento das quantidades calculadas (modelos)
  passo      numeric(8,2) not null default 1 check (passo > 0),
  ativo      boolean not null default true,
  ordem      integer not null default 0,
  check ((equivale_quantidade is null) = (equivale_unidade is null)),
  check (equivale_unidade is distinct from codigo)
);
insert into unidades (codigo, singular, plural, passo, ordem) values ('unidade', 'unidade', 'unidades', 1, 10);
insert into unidades (codigo, singular, plural, equivale_quantidade, equivale_unidade, passo, ordem) values
  ('cento', 'cento', 'centos', 100, 'unidade', 0.5, 20);
insert into unidades (codigo, singular, plural, passo, ordem) values
  ('pessoa',   'pessoa',   'pessoas',   1,   30),
  ('evento',   'evento',   'eventos',   1,   40),
  ('servico',  'serviço',  'serviços',  1,   50),
  ('hora',     'hora',     'horas',     1,   60),
  ('diaria',   'diária',   'diárias',   1,   70),
  ('kg',       'kg',       'kg',        0.5, 80),
  ('grama',    'g',        'g',         50,  90),
  ('litro',    'litro',    'litros',    1,   100),
  ('bandeja',  'bandeja',  'bandejas',  1,   110),
  ('travessa', 'travessa', 'travessas', 1,   120);

alter table unidades enable row level security;
create policy unidades_ler on unidades for select using (usuario_atual() is not null);
create policy unidades_gravar on unidades for all using (tem_permissao('catalogo.alterar')) with check (tem_permissao('catalogo.alterar'));
grant select, insert, update on unidades to delta_app;
revoke all on unidades from anon, authenticated;
create trigger aud_unidades after insert or update on unidades for each row execute function trg_auditar();

-- catálogo e itens passam a apontar para a tabela (os valores atuais já existem nela)
alter table catalogo_itens drop constraint catalogo_itens_unidade_check;
alter table catalogo_itens add constraint catalogo_itens_unidade_fk foreign key (unidade) references unidades(codigo);

----------------------------------------------------------------------- item do orçamento completo
drop view ultimo_preco_catalogo;

alter table orcamento_itens disable trigger item_so_em_rascunho;
alter table orcamento_itens disable trigger item_recalcula;

alter table orcamento_itens drop column total_centavos;
alter table orcamento_itens
  alter column preco_unitario_centavos drop not null,                       -- null = preço pendente
  add column categoria text,                                                -- do catálogo, ou escolhida no item livre
  add column detalhe text check (detalhe is null or length(detalhe) <= 500), -- descrição para o cliente
  add column desconto_centavos bigint not null default 0 check (desconto_centavos >= 0),
  add column bruto_centavos bigint generated always as (round(quantidade * coalesce(preco_unitario_centavos, 0))::bigint) stored,
  add column total_centavos bigint generated always as
    (round(quantidade * coalesce(preco_unitario_centavos, 0))::bigint - desconto_centavos) stored,
  add constraint item_desconto_ate_bruto check (desconto_centavos <= round(quantidade * coalesce(preco_unitario_centavos, 0))),
  add constraint item_pendente_sem_desconto check (preco_unitario_centavos is not null or desconto_centavos = 0),
  add constraint item_unidade_fk foreign key (unidade) references unidades(codigo);

update orcamento_itens i set categoria = c.categoria from catalogo_itens c where c.id = i.catalogo_item_id and i.categoria is null;

alter table orcamento_itens enable trigger item_so_em_rascunho;
alter table orcamento_itens enable trigger item_recalcula;

create view ultimo_preco_catalogo with (security_invoker = true) as
select distinct on (i.catalogo_item_id) i.catalogo_item_id, i.preco_unitario_centavos, v.criado_em
  from orcamento_itens i join orcamento_versoes v on v.id = i.versao_id
 where i.catalogo_item_id is not null and i.preco_unitario_centavos > 0
 order by i.catalogo_item_id, v.criado_em desc;
grant select on ultimo_preco_catalogo to delta_app;

-- Item do catálogo herda a categoria; desconto no item exige permissão de desconto.
create function trg_item_regras() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.categoria is null and new.catalogo_item_id is not null then
    select categoria into new.categoria from catalogo_itens where id = new.catalogo_item_id;
  end if;
  new.detalhe := nullif(trim(coalesce(new.detalhe, '')), '');
  if new.desconto_centavos > 0 and (tg_op = 'INSERT' or new.desconto_centavos is distinct from old.desconto_centavos)
     and not (tem_permissao('desconto.dar') or tem_permissao('desconto.aprovar')) then
    raise exception 'SEM_PERMISSAO: seu perfil não dá desconto' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger item_regras before insert or update on orcamento_itens for each row execute function trg_item_regras();

-- Qualquer mudança nos itens recalcula a versão e desfaz uma aprovação anterior (ela valia para outros valores).
create or replace function trg_item_recalcula() returns trigger
language plpgsql security definer set search_path = public as $$
declare v uuid := coalesce(new.versao_id, old.versao_id);
begin
  update orcamento_versoes
     set subtotal_centavos = x.soma, desconto_centavos = least(desconto_centavos, x.soma),
         aprovado_por = null, aprovado_em = null, aprovacao_justificativa = null, aprovacao_motivos = null
    from (select coalesce(sum(total_centavos), 0)::bigint as soma from orcamento_itens where versao_id = v) x
   where id = v and status = 'rascunho';
  if tg_op = 'INSERT' and new.catalogo_item_id is not null then
    insert into orcamento_itens_custos (item_id, custo_unitario_centavos)
    select new.id, custo_centavos from catalogo_custos where item_id = new.catalogo_item_id
    on conflict (item_id) do nothing;
  end if;
  return null;
end $$;

-- Trilha: quem incluiu, mudou preço, desconto ou removeu cada item; e quem mexeu no custo.
create trigger aud_orcamento_itens after insert or update or delete on orcamento_itens for each row execute function trg_auditar();
create function trg_auditar_custo_item() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into auditoria (tabela, registro_id, acao, usuario, antes, depois)
  values (tg_table_name, coalesce(new.item_id, old.item_id)::text, tg_op, usuario_atual(),
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;
create trigger aud_orcamento_itens_custos after insert or update or delete on orcamento_itens_custos
  for each row execute function trg_auditar_custo_item();

----------------------------------------------------------------------- pendências e aprovação
-- Pendências impedem o envio (não se resolvem com aprovação): itens sem preço definido.
create function pendencias_orcamento(p_versao uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(format('%s sem preço definido', descricao) order by ordem, descricao), '{}')
    from orcamento_itens where versao_id = p_versao and preco_unitario_centavos is null
$$;

-- Motivos que exigem aprovação da administração: desconto total acima do teto, preço abaixo do catálogo e venda abaixo do custo.
create or replace function motivos_aprovacao(p_versao uuid) returns text[]
language plpgsql stable security definer set search_path = public as $$
declare v orcamento_versoes%rowtype; m text[] := '{}'; r record; teto int := coalesce(cfg_int('orcamento.desconto_teto_percentual'), 0);
        bruto bigint; desc_itens bigint; desc_total bigint;
begin
  select * into v from orcamento_versoes where id = p_versao;
  select coalesce(sum(bruto_centavos), 0), coalesce(sum(desconto_centavos), 0) into bruto, desc_itens
    from orcamento_itens where versao_id = p_versao;
  desc_total := desc_itens + v.desconto_centavos;
  if desc_total > 0 and desc_total * 100 > bruto * teto then
    m := m || format('Desconto de %s%% acima do limite de %s%%',
                     replace(round(desc_total * 100.0 / nullif(bruto, 0), 1)::text, '.', ','), teto);
  end if;
  for r in select i.descricao, i.preco_unitario_centavos, c.preco_tipo, c.preco_centavos, c.preco_min_centavos
             from orcamento_itens i join catalogo_itens c on c.id = i.catalogo_item_id
            where i.versao_id = p_versao and i.preco_unitario_centavos is not null loop
    if r.preco_tipo = 'faixa' and r.preco_unitario_centavos < r.preco_min_centavos then
      m := m || format('%s abaixo da faixa do catálogo', r.descricao);
    elsif r.preco_tipo = 'fixo' and r.preco_unitario_centavos < r.preco_centavos then
      m := m || format('%s abaixo do preço do catálogo', r.descricao);
    end if;
  end loop;
  -- abaixo do custo: o valor do item (já com o desconto dele) não cobre o custo
  for r in select i.descricao from orcamento_itens i join orcamento_itens_custos k on k.item_id = i.id
            where i.versao_id = p_versao and i.preco_unitario_centavos is not null
              and i.total_centavos < round(i.quantidade * k.custo_unitario_centavos)
            order by i.ordem loop
    m := m || format('%s vendido abaixo do custo', r.descricao);
  end loop;
  return m;
end $$;

----------------------------------------------------------------------- envio: congela também detalhe, desconto e equivalência
create or replace function enviar_versao(p_versao uuid, p_validade date default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v orcamento_versoes%rowtype; o orcamentos%rowtype; m text[]; p text[]; s jsonb; n_itens int;
begin
  if not tem_permissao('orcamento.criar') then
    raise exception 'SEM_PERMISSAO: seu perfil não envia orçamentos' using errcode = '42501';
  end if;
  select * into v from orcamento_versoes where id = p_versao for update;
  if not found or v.status <> 'rascunho' then
    raise exception 'ORCAMENTO_IMUTAVEL: esta versão já foi enviada' using errcode = 'P0001';
  end if;
  select * into o from orcamentos where id = v.orcamento_id for update;
  if o.status in ('aprovado','perdido') then
    raise exception 'STATUS_INVALIDO: orçamento %', o.status using errcode = 'P0001';
  end if;
  select count(*) into n_itens from orcamento_itens where versao_id = p_versao;
  if n_itens = 0 then
    raise exception 'ORCAMENTO_VAZIO: inclua ao menos um item com valor' using errcode = 'P0001';
  end if;
  p := pendencias_orcamento(p_versao);
  if coalesce(array_length(p, 1), 0) > 0 then
    raise exception 'PRECO_PENDENTE: %', array_to_string(p, '; ') using errcode = 'P0001';
  end if;
  if v.subtotal_centavos - v.desconto_centavos <= 0 then
    raise exception 'ORCAMENTO_VAZIO: inclua ao menos um item com valor' using errcode = 'P0001';
  end if;
  if (v.desconto_centavos > 0 or exists (select 1 from orcamento_itens where versao_id = p_versao and desconto_centavos > 0))
     and not (tem_permissao('desconto.dar') or tem_permissao('desconto.aprovar')) then
    raise exception 'SEM_PERMISSAO: seu perfil não dá desconto' using errcode = '42501';
  end if;
  m := motivos_aprovacao(p_versao);
  if coalesce(array_length(m, 1), 0) > 0 and v.aprovado_por is null then
    raise exception 'APROVACAO_NECESSARIA: %', array_to_string(m, '; ') using errcode = 'P0001';
  end if;

  s := jsonb_build_object(
    'orcamento', jsonb_build_object('numero', o.numero, 'titulo', o.titulo, 'tipo', o.tipo, 'data_evento', o.data_evento,
                                    'horario', o.horario, 'convidados', o.convidados, 'local_externo', o.local_externo,
                                    'espaco', (select nome from recursos where id = o.recurso_id)),
    'versao', v.numero,
    'cliente', (select jsonb_build_object('tipo', tipo, 'nome', nome, 'nome_fantasia', nome_fantasia, 'documento', documento,
                                          'responsavel', responsavel_nome, 'telefone', telefone, 'email', email,
                                          'endereco', endereco, 'cidade', cidade, 'uf', uf)
                  from clientes where id = o.cliente_id),
    'empresa', (select jsonb_object_agg(replace(chave, 'empresa.', ''), valor #>> '{}') from configuracoes where chave like 'empresa.%'),
    'itens', (select coalesce(jsonb_agg(jsonb_build_object(
                'descricao', i.descricao, 'detalhe', i.detalhe, 'unidade', i.unidade,
                'unidade_singular', u.singular, 'unidade_plural', u.plural,
                'quantidade', i.quantidade,
                'equivalencia', case when u.equivale_quantidade is not null
                                     then trim_scale(i.quantidade * u.equivale_quantidade)::text || ' ' ||
                                          case when i.quantidade * u.equivale_quantidade = 1 then b.singular else b.plural end end,
                'preco_unitario_centavos', i.preco_unitario_centavos, 'bruto_centavos', i.bruto_centavos,
                'desconto_centavos', i.desconto_centavos, 'total_centavos', i.total_centavos,
                'catalogo_item_id', i.catalogo_item_id, 'categoria', coalesce(i.categoria, c.categoria))
              order by i.ordem, i.descricao), '[]')
                from orcamento_itens i
                join unidades u on u.codigo = i.unidade
                left join unidades b on b.codigo = u.equivale_unidade
                left join catalogo_itens c on c.id = i.catalogo_item_id
               where i.versao_id = p_versao),
    'subtotal_centavos', v.subtotal_centavos, 'desconto_centavos', v.desconto_centavos,
    'descontos_itens_centavos', (select coalesce(sum(desconto_centavos), 0) from orcamento_itens where versao_id = p_versao),
    'total_centavos', v.subtotal_centavos - v.desconto_centavos,
    'condicoes', v.condicoes, 'observacoes', v.observacoes, 'apresentacao', v.apresentacao,
    'validade', coalesce(p_validade, (now() at time zone 'America/Fortaleza')::date + coalesce(cfg_int('orcamento.validade_dias'), 7)),
    'enviada_em', now());

  update orcamento_versoes set status = 'substituida'
   where orcamento_id = o.id and status = 'enviada';
  update orcamento_versoes
     set status = 'enviada', enviada_em = now(), enviada_por = usuario_atual(), snapshot = s,
         validade = (s ->> 'validade')::date,
         conteudo_hash = encode(extensions.digest(s::text, 'sha256'), 'hex')
   where id = p_versao;
  update orcamentos set status = 'enviado' where id = o.id;

  insert into tarefas (titulo, vence_em, responsavel, cliente_id, orcamento_id, criado_por)
  values (format('Retornar ao cliente sobre o orçamento %s', o.numero),
          now() + make_interval(days => coalesce(cfg_int('orcamento.retorno_dias'), 2)),
          coalesce(o.responsavel, usuario_atual()), o.cliente_id, o.id, usuario_atual());
end $$;

----------------------------------------------------------------------- nova versão copia os campos novos
create or replace function nova_versao(p_orcamento uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_ult orcamento_versoes%rowtype; v_id uuid; r record; novo uuid;
begin
  if not tem_permissao('orcamento.criar') then
    raise exception 'SEM_PERMISSAO: seu perfil não edita orçamentos' using errcode = '42501';
  end if;
  if (select status from orcamentos where id = p_orcamento for update) in ('aprovado','perdido') then
    raise exception 'STATUS_INVALIDO: orçamento encerrado' using errcode = 'P0001';
  end if;
  select id into v_id from orcamento_versoes where orcamento_id = p_orcamento and status = 'rascunho';
  if found then return v_id; end if;
  select * into v_ult from orcamento_versoes where orcamento_id = p_orcamento order by numero desc limit 1;
  insert into orcamento_versoes (orcamento_id, numero, condicoes, observacoes, apresentacao, desconto_centavos)
  values (p_orcamento, v_ult.numero + 1, v_ult.condicoes, v_ult.observacoes, v_ult.apresentacao, 0)
  returning id into v_id;
  for r in select i.*, c.custo_unitario_centavos from orcamento_itens i
             left join orcamento_itens_custos c on c.item_id = i.id
            where i.versao_id = v_ult.id order by i.ordem loop
    insert into orcamento_itens (versao_id, ordem, catalogo_item_id, descricao, detalhe, categoria, unidade, quantidade,
                                 preco_unitario_centavos, desconto_centavos)
    values (v_id, r.ordem, r.catalogo_item_id, r.descricao, r.detalhe, r.categoria, r.unidade, r.quantidade,
            r.preco_unitario_centavos, r.desconto_centavos)
    returning id into novo;
    if r.custo_unitario_centavos is not null then
      insert into orcamento_itens_custos (item_id, custo_unitario_centavos) values (novo, r.custo_unitario_centavos)
      on conflict (item_id) do update set custo_unitario_centavos = excluded.custo_unitario_centavos;
    end if;
  end loop;
  update orcamento_versoes set desconto_centavos = v_ult.desconto_centavos where id = v_id;
  return v_id;
end $$;

revoke execute on function trg_item_regras(), trg_auditar_custo_item() from public, anon, authenticated;
revoke all on function pendencias_orcamento(uuid) from public, anon, authenticated;
grant execute on function pendencias_orcamento(uuid) to delta_app;
