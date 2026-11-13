-- Quando o limite de tentativas bloqueia alguém, fica registrado na auditoria (sem IP nem e-mail: só o tipo).
create or replace function consumir_tentativa(p_chave text, p_maximo integer, p_janela_s integer, p_castigo_s integer)
returns integer language plpgsql security definer set search_path = public as $$
declare r limites_tentativas;
begin
  insert into limites_tentativas as l (chave) values (left(p_chave, 200))
  on conflict (chave) do update set chave = l.chave
  returning * into r;
  if r.bloqueado_ate is not null and r.bloqueado_ate > now() then
    return ceil(extract(epoch from r.bloqueado_ate - now()))::integer;
  end if;
  if r.janela_inicio < now() - make_interval(secs => p_janela_s) or r.bloqueado_ate is not null then
    update limites_tentativas set janela_inicio = now(), tentativas = 1, bloqueado_ate = null where chave = r.chave;
    return 0;
  end if;
  if r.tentativas + 1 > p_maximo then
    update limites_tentativas set bloqueado_ate = now() + make_interval(secs => p_castigo_s) where chave = r.chave;
    insert into auditoria (tabela, registro_id, acao, usuario, antes, depois)
    values ('acessos', split_part(r.chave, ':', 1) || ':' || split_part(r.chave, ':', 2), 'BLOQUEIO_TENTATIVAS', null, null,
            jsonb_build_object('tipo', split_part(r.chave, ':', 1) || ' por ' || split_part(r.chave, ':', 2),
                               'tentativas', r.tentativas + 1, 'bloqueado_minutos', round(p_castigo_s / 60.0)));
    return p_castigo_s;
  end if;
  update limites_tentativas set tentativas = r.tentativas + 1 where chave = r.chave;
  return 0;
end $$;
revoke execute on function consumir_tentativa(text, integer, integer, integer) from public, anon, authenticated, delta_app;
grant execute on function consumir_tentativa(text, integer, integer, integer) to service_role;
