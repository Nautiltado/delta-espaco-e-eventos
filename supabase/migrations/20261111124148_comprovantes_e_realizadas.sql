-- Comprovantes de pagamento por evento (pedido de 11/11/2026) e passagem automática para "realizada".

-- Arquivos: bucket privado; só quem cuida do financeiro envia e abre.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprovantes', 'comprovantes', false, 10485760,
        array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'])
on conflict (id) do nothing;

create policy comprovantes_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'comprovantes' and public.tem_permissao('pagamento.confirmar'));
create policy comprovantes_ler on storage.objects for select to authenticated
  using (bucket_id = 'comprovantes' and public.tem_permissao('pagamento.confirmar'));
-- Sem update nem delete: arquivo enviado não é trocado nem apagado pelo sistema.

create table comprovantes (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references reservas(id),
  pagamento_id uuid references pagamentos(id),
  caminho text not null unique,
  nome_arquivo text not null check (length(nome_arquivo) between 1 and 200),
  tipo text not null,
  tamanho integer not null check (tamanho > 0),
  descricao text check (descricao is null or length(descricao) <= 300),
  enviado_por uuid references usuarios(id) default usuario_atual(),
  enviado_em timestamptz not null default now(),
  removido_em timestamptz,
  removido_por uuid references usuarios(id),
  removido_motivo text
);
create index on comprovantes (reserva_id);
alter table comprovantes enable row level security;
create policy comprovantes_ler on comprovantes for select using (tem_permissao('pagamento.confirmar'));
grant select on comprovantes to delta_app;
create trigger comprovantes_sem_delete before delete on comprovantes for each row execute function trg_bloquear_alteracao();
create trigger aud_comprovantes after insert or update on comprovantes for each row execute function trg_auditar();

create function registrar_comprovante(p_reserva uuid, p_caminho text, p_nome text, p_tipo text, p_tamanho integer,
  p_pagamento uuid default null, p_descricao text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not tem_permissao('pagamento.confirmar') then
    raise exception 'SEM_PERMISSAO: só o financeiro anexa comprovantes' using errcode = '42501';
  end if;
  if not exists (select 1 from reservas where id = p_reserva and tipo = 'evento') then
    raise exception 'STATUS_INVALIDO: reserva inexistente' using errcode = 'P0001';
  end if;
  if p_caminho is null or split_part(p_caminho, '/', 1) <> p_reserva::text
     or not exists (select 1 from storage.objects where bucket_id = 'comprovantes' and name = p_caminho) then
    raise exception 'STATUS_INVALIDO: arquivo não encontrado; envie de novo' using errcode = 'P0001';
  end if;
  if p_pagamento is not null and not exists (
       select 1 from pagamentos g join parcelas p on p.id = g.parcela_id where g.id = p_pagamento and p.reserva_id = p_reserva) then
    raise exception 'STATUS_INVALIDO: o pagamento escolhido não é desta reserva' using errcode = 'P0001';
  end if;
  insert into comprovantes (reserva_id, pagamento_id, caminho, nome_arquivo, tipo, tamanho, descricao)
  values (p_reserva, p_pagamento, p_caminho, left(trim(p_nome), 200), p_tipo, p_tamanho, nullif(trim(p_descricao), ''))
  returning id into v_id;
  return v_id;
end $$;

-- Tirar da lista (enviado por engano). O arquivo e o registro continuam guardados.
create function remover_comprovante(p_comprovante uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not tem_permissao('pagamento.estornar') then
    raise exception 'SEM_PERMISSAO: só a administração tira comprovantes da lista' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'JUSTIFICATIVA_OBRIGATORIA: diga por que o comprovante sai da lista' using errcode = 'P0001';
  end if;
  update comprovantes set removido_em = now(), removido_por = usuario_atual(), removido_motivo = trim(p_motivo)
   where id = p_comprovante and removido_em is null;
  if not found then raise exception 'STATUS_INVALIDO: comprovante inexistente ou já removido' using errcode = 'P0001'; end if;
end $$;

-- Evento que já terminou passa para "realizada" sozinho.
create function marcar_realizadas() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update reservas set status = 'realizada', atualizado_em = now()
   where tipo = 'evento' and status in ('confirmada', 'em_preparacao') and evento_fim < now();
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function registrar_comprovante(uuid, text, text, text, integer, uuid, text) from public, anon, authenticated;
revoke all on function remover_comprovante(uuid, text) from public, anon, authenticated;
revoke all on function marcar_realizadas() from public, anon, authenticated;
grant execute on function registrar_comprovante(uuid, text, text, text, integer, uuid, text) to delta_app;
grant execute on function remover_comprovante(uuid, text) to delta_app;

select cron.schedule('delta-marcar-realizadas', '7 * * * *', 'select public.marcar_realizadas()');
select public.marcar_realizadas();
