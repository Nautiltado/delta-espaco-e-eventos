-- Bandeja rodada: serviço em que os garçons passam com bandejas; exige no mínimo 2 garçons (regra aplicada no orçamento rápido).
insert into catalogo_itens (nome, categoria, unidade, ordem, preco_tipo, descricao)
values ('Bandeja rodada', 'servico', 'evento', 5, 'a_combinar', 'Garçons servindo com bandejas. Exige no mínimo 2 garçons.')
on conflict (nome) do nothing;

insert into orcamento_modelo_itens (modelo_id, catalogo_item_id, regra, fator, minimo, opcional, ordem)
select m.id, c.id, 'fixa', 1, 0, true, 105
  from orcamento_modelos m, catalogo_itens c
 where m.nome = 'Aniversário infantil' and c.nome = 'Bandeja rodada'
on conflict (modelo_id, catalogo_item_id) do nothing;
