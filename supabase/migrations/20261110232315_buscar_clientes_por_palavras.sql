-- Busca por palavras: "jose silva" encontra "Maria José da Silva" (cada palavra precisa aparecer, em qualquer ordem).
create or replace function buscar_clientes(p_texto text default null, p_inativos boolean default false, p_limite integer default 100)
returns setof clientes
language sql stable security invoker set search_path = public, extensions as $$
  with termo as (
    select normaliza_texto(trim(coalesce(p_texto, ''))) as t,
           regexp_replace(coalesce(p_texto, ''), '\D', '', 'g') as digitos
  )
  select c.* from clientes c, termo
   where c.mesclado_em is null
     and (p_inativos or c.ativo)
     and (termo.t = ''
          or not exists (
               select 1 from unnest(regexp_split_to_array(termo.t, '\s+')) w
                where w <> ''
                  and normaliza_texto(c.nome || ' ' || coalesce(c.nome_fantasia, '')) not like '%' || w || '%')
          or (length(termo.digitos) >= 4
              and (c.telefone like '%' || termo.digitos || '%' or c.documento like '%' || termo.digitos || '%')))
   order by c.nome
   limit least(greatest(p_limite, 1), 500)
$$;
