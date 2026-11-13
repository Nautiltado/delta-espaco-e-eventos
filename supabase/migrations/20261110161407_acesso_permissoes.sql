create table usuarios (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (length(trim(nome)) > 0),
  email       text not null unique check (email = lower(email)),
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table perfis (
  codigo    text primary key check (codigo ~ '^[A-Z]{2,10}$'),
  nome      text not null,
  descricao text
);

create table permissoes (
  codigo    text primary key check (codigo ~ '^[a-z_]+\.[a-z_]+$'),
  descricao text not null
);

create table perfis_permissoes (
  perfil    text not null references perfis(codigo),
  permissao text not null references permissoes(codigo),
  primary key (perfil, permissao)
);

create table usuarios_perfis (
  usuario uuid not null references usuarios(id),
  perfil  text not null references perfis(codigo),
  primary key (usuario, perfil)
);

create function usuario_atual() returns uuid language sql stable set search_path = public as $$
  select nullif(current_setting('app.usuario', true), '')::uuid
$$;

create function tem_permissao(p_permissao text, p_usuario uuid default usuario_atual())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from usuarios u
      join usuarios_perfis up on up.usuario = u.id
      join perfis_permissoes pp on pp.perfil = up.perfil
     where u.id = p_usuario and u.ativo and pp.permissao = p_permissao)
$$;

insert into permissoes (codigo, descricao) values
  ('cliente.ver','Ver dados pessoais de clientes'),
  ('cliente.editar','Criar e editar cliente'),
  ('cliente.mesclar','Mesclar cadastros duplicados'),
  ('orcamento.ver','Ver orçamentos'),
  ('orcamento.criar','Criar e enviar orçamento'),
  ('desconto.dar','Dar desconto dentro do limite'),
  ('desconto.aprovar','Aprovar desconto e preço fora da faixa'),
  ('custo.ver','Ver custo interno e margem'),
  ('catalogo.alterar','Alterar preços e catálogo'),
  ('contrato.editar','Editar modelo de contrato'),
  ('contrato.gerar','Gerar contrato de orçamento aprovado'),
  ('pagamento.confirmar','Confirmar pagamento (baixa)'),
  ('pagamento.estornar','Estornar ou ajustar lançamento'),
  ('reserva.confirmar','Confirmar reserva'),
  ('bloqueio.criar','Criar bloqueio administrativo'),
  ('bloqueio.remover','Remover bloqueio'),
  ('reserva.cancelar','Cancelar reserva aplicando a política'),
  ('evento.fechar','Fechar evento financeiramente'),
  ('salgados.criar','Criar pedido de salgados'),
  ('producao.status','Mudar status de produção'),
  ('retirada.registrar','Registrar retirada'),
  ('capacidade.autorizar','Autorizar excesso de capacidade'),
  ('estoque.movimentar','Movimentar estoque e materiais'),
  ('escala.gerir','Montar escala e contratar terceirizados'),
  ('whatsapp.atender','Ver e responder conversas de WhatsApp'),
  ('auditoria.ver','Ver auditoria'),
  ('config.critica','Gerenciar usuários, perfis e configurações críticas');

insert into perfis (codigo, nome) values
  ('ADM','Administrador'),('GER','Gerência'),('ATD','Atendimento'),
  ('FIN','Financeiro'),('COZ','Cozinha'),('OPE','Operacional');

insert into perfis_permissoes select 'ADM', codigo from permissoes;

insert into perfis_permissoes select 'GER', unnest(array[
  'cliente.ver','cliente.editar','cliente.mesclar','orcamento.ver','orcamento.criar','desconto.dar',
  'custo.ver','contrato.gerar','reserva.confirmar','bloqueio.criar','bloqueio.remover','reserva.cancelar',
  'salgados.criar','producao.status','retirada.registrar','capacidade.autorizar','estoque.movimentar',
  'escala.gerir','whatsapp.atender','auditoria.ver']);

insert into perfis_permissoes select 'ATD', unnest(array[
  'cliente.ver','cliente.editar','orcamento.ver','orcamento.criar','desconto.dar','contrato.gerar',
  'salgados.criar','retirada.registrar','whatsapp.atender']);

insert into perfis_permissoes select 'FIN', unnest(array[
  'cliente.ver','orcamento.ver','custo.ver','pagamento.confirmar','reserva.confirmar','evento.fechar']);

insert into perfis_permissoes select 'COZ', unnest(array['producao.status','retirada.registrar','estoque.movimentar']);

insert into perfis_permissoes select 'OPE', unnest(array['bloqueio.criar','estoque.movimentar','escala.gerir']);

alter function trg_auditar() security definer set search_path = public;

create trigger aud_usuarios after insert or update or delete on usuarios
  for each row execute function trg_auditar();
create trigger aud_usuarios_perfis after insert or update or delete on usuarios_perfis
  for each row execute function trg_auditar();
create trigger aud_perfis_permissoes after insert or update or delete on perfis_permissoes
  for each row execute function trg_auditar();

create function trg_sem_exclusao_usuario() returns trigger language plpgsql as $$
begin raise exception 'REGISTRO_IMUTAVEL: usuário não é excluído, apenas desativado'; end $$;
create trigger usuarios_sem_delete before delete on usuarios
  for each row execute function trg_sem_exclusao_usuario();

create function trg_manter_administrador() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from usuarios u join usuarios_perfis up on up.usuario = u.id
                  where u.ativo and up.perfil = 'ADM') then
    raise exception 'SEM_ADMINISTRADOR: é preciso manter ao menos um administrador ativo';
  end if;
  return null;
end $$;
create constraint trigger mantem_admin_usuarios after update or delete on usuarios
  deferrable initially immediate for each row execute function trg_manter_administrador();
create constraint trigger mantem_admin_perfis after delete or update on usuarios_perfis
  deferrable initially immediate for each row execute function trg_manter_administrador();

alter table usuarios          enable row level security;
alter table usuarios_perfis   enable row level security;
alter table perfis            enable row level security;
alter table permissoes        enable row level security;
alter table perfis_permissoes enable row level security;

create policy usuarios_ler on usuarios for select
  using (id = usuario_atual() or tem_permissao('config.critica'));
create policy usuarios_gerir on usuarios for all
  using (tem_permissao('config.critica')) with check (tem_permissao('config.critica'));

create policy up_ler on usuarios_perfis for select
  using (usuario = usuario_atual() or tem_permissao('config.critica'));
create policy up_gerir on usuarios_perfis for all
  using (tem_permissao('config.critica')) with check (tem_permissao('config.critica'));

create policy perfis_ler on perfis for select using (usuario_atual() is not null);
create policy permissoes_ler on permissoes for select using (usuario_atual() is not null);
create policy pp_ler on perfis_permissoes for select using (usuario_atual() is not null);
create policy pp_gerir on perfis_permissoes for all
  using (tem_permissao('config.critica')) with check (tem_permissao('config.critica'));

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'delta_app') then
    create role delta_app nologin;
  end if;
end $$;
grant usage on schema public to delta_app;
grant select, insert, update, delete on usuarios, usuarios_perfis, perfis_permissoes to delta_app;
grant select on perfis, permissoes to delta_app;
grant execute on function usuario_atual(), tem_permissao(text, uuid) to delta_app;
