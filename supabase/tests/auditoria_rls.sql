-- Auditoria de acesso do banco: rodar antes de cada entrega. O resultado esperado é SÓ esta linha:
--   sem_policy | limites_tentativas   (de propósito: só o servidor mexe nela)
-- Qualquer outra linha é problema a corrigir antes de publicar.
select 'policy_true' tipo, tablename || '.' || policyname || ' ' || cmd detalhe from pg_policies
 where schemaname in ('public', 'storage') and (coalesce(qual, '') = 'true' or coalesce(with_check, '') = 'true')
union all select 'sem_policy', c.relname from pg_class c
 where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relrowsecurity
   and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)
union all select 'sem_rls', tablename from pg_tables where schemaname = 'public' and not rowsecurity
union all select 'anon_le_tabela', c.relname from pg_class c
 where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'm') and has_any_column_privilege('anon', c.oid, 'select')
union all select 'anon_executa', p.proname from pg_proc p
 where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')
union all select 'definer_sem_search_path', p.proname from pg_proc p
 where p.pronamespace = 'public'::regnamespace and p.prosecdef
   and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) x where x like 'search_path=%')
union all select 'view_sem_invoker', c.relname from pg_class c
 where c.relnamespace = 'public'::regnamespace and c.relkind = 'v' and not coalesce('security_invoker=true' = any(c.reloptions), false)
union all select 'bucket_publico', id from storage.buckets where public
union all select 'bucket_sem_limite', id from storage.buckets where file_size_limit is null or allowed_mime_types is null;
