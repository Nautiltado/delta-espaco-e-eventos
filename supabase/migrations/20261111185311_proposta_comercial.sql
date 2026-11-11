-- Proposta comercial no modelo da Delta: apresentação editável por versão, categoria de cada item e telefones no rodapé.
alter table orcamento_versoes add column apresentacao text check (apresentacao is null or length(apresentacao) <= 1500);

insert into configuracoes (chave, grupo, descricao, tipo, valor, ordem)
values ('empresa.telefones', 'empresa', 'Telefones no rodapé das propostas', 'texto_opcional', '"(99) 8152-2414 • (98) 98543-8785"', 7)
on conflict (chave) do nothing;

-- enviar_versao: o conteúdo congelado passa a guardar a categoria de cada item e a apresentação.
create or replace function enviar_versao(p_versao uuid, p_validade date default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v orcamento_versoes%rowtype; o orcamentos%rowtype; m text[]; s jsonb; n_itens int;
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
  if n_itens = 0 or v.subtotal_centavos - v.desconto_centavos <= 0 then
    raise exception 'ORCAMENTO_VAZIO: inclua ao menos um item com valor' using errcode = 'P0001';
  end if;
  if v.desconto_centavos > 0 and not (tem_permissao('desconto.dar') or tem_permissao('desconto.aprovar')) then
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
    'itens', (select coalesce(jsonb_agg(jsonb_build_object('descricao', i.descricao, 'unidade', i.unidade, 'quantidade', i.quantidade,
                                                           'preco_unitario_centavos', i.preco_unitario_centavos, 'total_centavos', i.total_centavos,
                                                           'catalogo_item_id', i.catalogo_item_id, 'categoria', c.categoria)
                                        order by i.ordem, i.descricao), '[]')
                from orcamento_itens i left join catalogo_itens c on c.id = i.catalogo_item_id where i.versao_id = p_versao),
    'subtotal_centavos', v.subtotal_centavos, 'desconto_centavos', v.desconto_centavos,
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
