-- Ninguém tira o próprio perfil de administrador, por nenhum caminho (nem apagando a linha direto).
create or replace function trg_nao_tira_proprio_adm() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.perfil = 'ADM' and old.usuario = usuario_atual() then
    raise exception 'PERFIL_PROTEGIDO: você não pode tirar o seu próprio perfil de administrador; peça a outro administrador' using errcode = 'P0001';
  end if;
  return old;
end $$;

create trigger nao_tira_proprio_adm before delete on usuarios_perfis
  for each row execute function trg_nao_tira_proprio_adm();
