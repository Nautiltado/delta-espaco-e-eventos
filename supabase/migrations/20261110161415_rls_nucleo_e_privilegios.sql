alter table clientes         enable row level security;
alter table recursos         enable row level security;
alter table reservas         enable row level security;
alter table reserva_periodos enable row level security;
alter table contratos        enable row level security;
alter table parcelas         enable row level security;
alter table pagamentos       enable row level security;
alter table auditoria        enable row level security;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables    in schema public from anon;
    revoke all on all sequences in schema public from anon;
    revoke execute on all functions in schema public from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on all tables    in schema public from authenticated;
    revoke all on all sequences in schema public from authenticated;
    revoke execute on all functions in schema public from authenticated;
  end if;
end $$;
revoke execute on all functions in schema public from public;
grant execute on function usuario_atual(), tem_permissao(text, uuid) to delta_app;
