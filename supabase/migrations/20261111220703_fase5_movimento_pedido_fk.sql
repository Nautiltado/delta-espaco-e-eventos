-- Liga cada saída de estoque ao pedido que a causou (o histórico mostra o número do pedido).
alter table estoque_movimentos
  add constraint estoque_movimentos_pedido_id_fkey foreign key (pedido_id) references pedidos(id);
create index if not exists estoque_movimentos_pedido_idx on estoque_movimentos (pedido_id) where pedido_id is not null;
notify pgrst, 'reload schema';
