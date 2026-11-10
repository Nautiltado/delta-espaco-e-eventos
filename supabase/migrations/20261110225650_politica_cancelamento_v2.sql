-- Política contratual revisada (versão de 10/11/2026, anexo contratual).
-- Multa em 6 faixas sobre os serviços ainda não executados; remarcação a critério da Delta em até 180 dias;
-- confirmação de convidados 10 dias antes; contratação com menos de 7 dias exige pagamento integral.

update configuracoes set descricao = 'Multa: mais de 120 dias antes (sobre serviços não executados)', valor = '10' where chave = 'cancelamento.multa_faixa_a';
update configuracoes set descricao = 'Multa: de 91 a 120 dias antes', valor = '15' where chave = 'cancelamento.multa_faixa_b';
update configuracoes set descricao = 'Multa: de 61 a 90 dias antes',  valor = '20' where chave = 'cancelamento.multa_faixa_c';
update configuracoes set descricao = 'Multa: de 31 a 60 dias antes',  valor = '25' where chave = 'cancelamento.multa_faixa_d';
update configuracoes set descricao = 'Multa: de 8 a 30 dias antes',   valor = '30' where chave = 'cancelamento.multa_faixa_e';
insert into configuracoes (chave, grupo, descricao, tipo, valor, ordem) values
  ('cancelamento.multa_faixa_f', 'Cancelamento', 'Multa: 7 dias ou menos antes, ausência no dia ou resolução por falta de pagamento nesse prazo', 'percentual', '35', 60);

update configuracoes set descricao = 'Remarcação: antecedência preferencial (abaixo disso a Delta pode recusar)' where chave = 'remarcacao.antecedencia_dias';
update configuracoes set descricao = 'Remarcações que a Delta pode conceder, a critério dela' where chave = 'remarcacao.quantidade_sem_multa';
update configuracoes set descricao = 'Confirmação final de convidados, produtos e serviços, dias antes', valor = '10' where chave = 'evento.confirmacao_convidados_dias';

-- Prazo de remarcação passa a ser em dias (180). A chave antiga sai; a exclusão fica na auditoria.
alter table configuracoes disable trigger configuracoes_sem_delete;
delete from configuracoes where chave = 'remarcacao.prazo_maximo_meses';
alter table configuracoes enable trigger configuracoes_sem_delete;
insert into configuracoes (chave, grupo, descricao, tipo, valor, ordem) values
  ('remarcacao.prazo_maximo_dias', 'Remarcação', 'Nova data em até quantos dias da data original', 'dias', '180', 20),
  ('financeiro.pagamento_integral_dias', 'Financeiro', 'Contratação com menos de X dias do evento: pagamento integral antes da execução', 'dias', '7', 40);

update configuracoes set descricao = 'Assina pela Delta na ausência da titular, por ela autorizado (nome e CPF)' where chave = 'contrato.signatario_alternativo';
