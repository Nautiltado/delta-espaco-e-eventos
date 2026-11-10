-- Política de cancelamento, remarcação e inadimplemento (documento da Delta de 10/11/2026)
-- e signatários do contrato. Os dados pessoais ficam em configurações restritas.

alter table configuracoes add column restrita boolean not null default false;

drop policy config_ler on configuracoes;
create policy config_ler on configuracoes for select using (
  usuario_atual() is not null
  and (not restrita or tem_permissao('config.critica') or tem_permissao('contrato.gerar'))
);

insert into configuracoes (chave, grupo, descricao, tipo, valor, ordem, restrita) values
  ('cancelamento.multa_faixa_a', 'Cancelamento', 'Multa: mais de 90 dias antes do evento',      'percentual', '10', 10, false),
  ('cancelamento.multa_faixa_b',  'Cancelamento', 'Multa: de 61 a 90 dias antes',                'percentual', '15', 20, false),
  ('cancelamento.multa_faixa_c',  'Cancelamento', 'Multa: de 31 a 60 dias antes',                'percentual', '20', 30, false),
  ('cancelamento.multa_faixa_d',   'Cancelamento', 'Multa: de 8 a 30 dias antes',                 'percentual', '25', 40, false),
  ('cancelamento.multa_faixa_e',    'Cancelamento', 'Multa: 7 dias ou menos antes (e ausência)',   'percentual', '30', 50, false),
  ('remarcacao.antecedencia_dias',     'Remarcação',   'Pedido de remarcação com antecedência mínima', 'dias', '30', 10, false),
  ('remarcacao.prazo_maximo_meses',    'Remarcação',   'Nova data em até quantos meses (contados da data original)', 'inteiro', '6', 20, false),
  ('remarcacao.quantidade_sem_multa',  'Remarcação',   'Remarcações permitidas sem multa',            'inteiro', '1', 30, false),
  ('evento.confirmacao_convidados_dias','Remarcação',  'Confirmação final de convidados e cardápio, dias antes', 'dias', '7', 40, false),
  ('inadimplencia.prazo_horas',        'Financeiro',   'Prazo para regularizar após notificação de atraso', 'horas', '48', 30, false),
  ('contrato.signatario_principal',    'Contrato',     'Assina pela Delta (nome e CPF)', 'texto', '"Marileide Costa Melo Santos, CPF 278.299.013-68"', 10, true),
  ('contrato.signatario_alternativo',  'Contrato',     'Assina pela Delta na ausência da titular (nome e CPF)', 'texto', '"Leonardo Luis Costa Santos, CPF 620.814.073-02"', 20, true);
