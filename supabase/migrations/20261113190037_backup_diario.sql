-- Backup diário: arquivos num armazenamento privado sem nenhuma política (só o servidor, com a chave secreta, lê e grava).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('backups', 'backups', false, 52428800, array['application/gzip'])
on conflict (id) do update set public = false, file_size_limit = 52428800, allowed_mime_types = array['application/gzip'];

-- Tabelas a copiar (todas as do sistema, menos o contador de tentativas, que é descartável).
create or replace function tabelas_para_backup() returns setof text
language sql stable security definer set search_path = public as $$
  select tablename::text from pg_tables
   where schemaname = 'public' and tablename <> 'limites_tentativas'
   order by tablename
$$;
revoke execute on function tabelas_para_backup() from public, anon, authenticated, delta_app;
grant execute on function tabelas_para_backup() to service_role;
