-- Busca de clientes sem diferenciar acentos e maiúsculas; números procuram em telefone e CPF/CNPJ.
-- SECURITY INVOKER: só devolve o que a política de quem chama permite (cliente.ver).
create function buscar_clientes(p_texto text default null, p_inativos boolean default false, p_limite integer default 100)
returns setof clientes
language sql stable security invoker set search_path = public, extensions as $$
  select c.* from clientes c
   where c.mesclado_em is null
     and (p_inativos or c.ativo)
     and (coalesce(trim(p_texto), '') = ''
          or normaliza_texto(c.nome) like '%' || normaliza_texto(trim(p_texto)) || '%'
          or normaliza_texto(c.nome_fantasia) like '%' || normaliza_texto(trim(p_texto)) || '%'
          or (length(regexp_replace(p_texto, '\D', '', 'g')) >= 4
              and (c.telefone like '%' || regexp_replace(p_texto, '\D', '', 'g') || '%'
                   or c.documento like '%' || regexp_replace(p_texto, '\D', '', 'g') || '%')))
   order by c.nome
   limit least(greatest(p_limite, 1), 500)
$$;
grant execute on function buscar_clientes(text, boolean, integer) to delta_app;
