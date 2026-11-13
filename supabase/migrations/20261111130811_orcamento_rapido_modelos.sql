-- Orçamento rápido: modelos de orçamento por tipo de evento, com regra de quantidade por convidado.

insert into catalogo_itens (nome, categoria, unidade, ordem, preco_tipo)
values ('Pipoca', 'lanche', 'pessoa', 170, 'a_combinar')
on conflict (nome) do nothing;

create table orcamento_modelos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(trim(nome)) between 2 and 80),
  descricao text check (descricao is null or length(descricao) <= 300),
  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_por uuid references usuarios(id) default usuario_atual(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- regra: 'fixa'       → quantidade = fator
--        'por_pessoa' → quantidade = convidados × fator (na unidade do item; ex.: 0,1 cento = 10 salgados por pessoa)
--        'a_cada'     → quantidade = convidados ÷ fator, arredondado para cima (ex.: 1 garçom a cada 30)
-- mínimo vale para todas. opcional = vem desmarcado, a pessoa marca se o cliente quiser.
create table orcamento_modelo_itens (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid not null references orcamento_modelos(id) on delete cascade,
  catalogo_item_id uuid not null references catalogo_itens(id),
  regra text not null check (regra in ('fixa', 'por_pessoa', 'a_cada')),
  fator numeric(12,3) not null check (fator > 0),
  minimo numeric(12,2) not null default 0 check (minimo >= 0),
  opcional boolean not null default false,
  preco_centavos bigint check (preco_centavos is null or preco_centavos >= 0),
  ordem integer not null default 0,
  unique (modelo_id, catalogo_item_id)
);
create index on orcamento_modelo_itens (modelo_id, ordem);

alter table orcamento_modelos enable row level security;
alter table orcamento_modelo_itens enable row level security;
create policy modelos_ler on orcamento_modelos for select using (tem_permissao('orcamento.ver'));
create policy modelos_gravar on orcamento_modelos for all using (tem_permissao('catalogo.alterar')) with check (tem_permissao('catalogo.alterar'));
create policy modelo_itens_ler on orcamento_modelo_itens for select using (tem_permissao('orcamento.ver'));
create policy modelo_itens_gravar on orcamento_modelo_itens for all using (tem_permissao('catalogo.alterar')) with check (tem_permissao('catalogo.alterar'));
grant select, insert, update, delete on orcamento_modelos, orcamento_modelo_itens to delta_app;
create trigger aud_orcamento_modelos after insert or update or delete on orcamento_modelos for each row execute function trg_auditar();
create trigger aud_orcamento_modelo_itens after insert or update or delete on orcamento_modelo_itens for each row execute function trg_auditar();

-- Último preço praticado de cada item do catálogo (para sugerir no orçamento rápido).
create view ultimo_preco_catalogo with (security_invoker = true) as
select distinct on (i.catalogo_item_id) i.catalogo_item_id, i.preco_unitario_centavos, v.criado_em
  from orcamento_itens i join orcamento_versoes v on v.id = i.versao_id
 where i.catalogo_item_id is not null and i.preco_unitario_centavos > 0
 order by i.catalogo_item_id, v.criado_em desc;
grant select on ultimo_preco_catalogo to delta_app;

-- Modelo inicial pedido pela Delta: aniversário infantil. Quantidades são ponto de partida, ajustáveis no editor.
with m as (
  insert into orcamento_modelos (nome, descricao, ordem)
  values ('Aniversário infantil', 'Mini lanches, pipoca, salgados fritos, creme de galinha, espaço e equipe.', 10)
  returning id)
insert into orcamento_modelo_itens (modelo_id, catalogo_item_id, regra, fator, minimo, opcional, ordem)
select m.id, c.id, x.regra, x.fator, x.minimo, x.opcional, x.ordem
  from m, (values
    ('Locação do espaço menor',            'fixa',       1,     0, false, 10),
    ('Locação do espaço maior',            'fixa',       1,     0, false, 20),
    ('Mini cachorro-quente',               'por_pessoa', 0.03,  0.5, false, 30),
    ('Mini pizza',                         'por_pessoa', 0.03,  0.5, false, 40),
    ('Pipoca',                             'por_pessoa', 1,     0, false, 50),
    ('Coxinha de frango',                  'por_pessoa', 0.03,  0.5, false, 60),
    ('Bolinha de queijo',                  'por_pessoa', 0.03,  0.5, false, 70),
    ('Risoles de carne',                   'por_pessoa', 0.02,  0.5, true,  80),
    ('Quibe de carne',                     'por_pessoa', 0.02,  0.5, true,  90),
    ('Creme de galinha com batata palha',  'por_pessoa', 1,     0, false, 100),
    ('Garçom',                             'a_cada',     30,    1, false, 110),
    ('Segurança',                          'fixa',       1,     0, true,  120)
  ) as x(nome, regra, fator, minimo, opcional, ordem)
  join catalogo_itens c on c.nome = x.nome;
