-- ============================================================================
-- DELTA OS - ERP/CRM & Venue/Catering Management System
-- Delta Espaço e Eventos (Bacabal - MA)
-- Arquitetura de Dados Relacional (SQLite / PostgreSQL Compatible)
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 1. Dados Institucionais, Bancários e Parâmetros Fiscais
CREATE TABLE IF NOT EXISTS instituicao (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    nome_fantasia TEXT NOT NULL,
    razao_social TEXT NOT NULL,
    cnpj TEXT NOT NULL,
    proprietario_gestor TEXT NOT NULL,
    responsavel_comercial TEXT NOT NULL,
    telefones TEXT NOT NULL,
    endereco TEXT NOT NULL,
    cidade_uf TEXT NOT NULL,
    cep TEXT NOT NULL,
    banco_codigo TEXT NOT NULL,
    banco_nome TEXT NOT NULL,
    agencia TEXT NOT NULL,
    conta TEXT NOT NULL,
    chave_pix TEXT NOT NULL,
    slogan TEXT NOT NULL,
    nbs_padrao TEXT NOT NULL DEFAULT '103013100',
    nbs_descricao TEXT NOT NULL DEFAULT 'Fornecimento de alimentação para eventos',
    regime_tributario TEXT NOT NULL DEFAULT 'Simples Nacional',
    classificacao_ibs_cbs TEXT NOT NULL DEFAULT 'Opção 1'
);

-- 2. Espaços Físicos (Gestão de Agenda Simultânea + Cozinha Central Compartilhada)
CREATE TABLE IF NOT EXISTS espacos (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    apelido_comercial TEXT NOT NULL,
    tipo TEXT NOT NULL, -- 'SALAO_PRINCIPAL' | 'SALAO_INTIMISTA' | 'COMPLEXO_TOTAL' | 'EXTERNO_CATERING'
    capacidade_min INTEGER NOT NULL DEFAULT 1,
    capacidade_max INTEGER NOT NULL,
    preco_base_locacao REAL NOT NULL DEFAULT 0,
    preco_max_locacao REAL NOT NULL DEFAULT 0,
    compartilha_cozinha_central INTEGER NOT NULL DEFAULT 1,
    descricao TEXT NOT NULL
);

-- 3. Catálogo Gastronômico, Equipe, Equipamentos e Logística
CREATE TABLE IF NOT EXISTS catalogo_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE NOT NULL,
    grupo TEXT NOT NULL, -- 'GASTRONOMIA_PREMIUM' | 'CATALOGO_GERAL' | 'KITS_CORPORATIVOS' | 'EQUIPE' | 'LOCACAO_EQUIPAMENTOS' | 'LOGISTICA'
    categoria TEXT NOT NULL,
    nome TEXT NOT NULL,
    descricao TEXT,
    unidade TEXT NOT NULL, -- 'pessoa' | 'cento' | 'un' | 'jarra' | 'garrafa' | 'diaria' | 'evento'
    preco_min REAL NOT NULL,
    preco_padrao REAL NOT NULL,
    preco_max REAL NOT NULL,
    custo_estimado REAL NOT NULL,
    setor_cozinha TEXT NOT NULL, -- 'COZINHA_QUENTE' | 'GARDE_MANGER_ILHA' | 'FRITURA_SALGADOS' | 'CONFEITARIA' | 'COPA_BAR' | 'LOGISTICA_OPERACAO'
    offset_beo_minutos INTEGER NOT NULL DEFAULT 0, -- Minutos relativos ao início do evento para o BEO
    ativo INTEGER NOT NULL DEFAULT 1
);

-- 4. Clientes (Sociais Alto Padrão & Corporativos B2B / Institucionais)
CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    tipo_cliente TEXT NOT NULL DEFAULT 'B2C_SOCIAL', -- 'B2C_SOCIAL' | 'B2B_CORPORATIVO' | 'INSTITUCIONAL_EDITAL'
    documento TEXT,
    telefone TEXT,
    cidade TEXT DEFAULT 'Bacabal - MA',
    observacoes TEXT,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 5. Orçamentos, Eventos e Agenda Simultânea
CREATE TABLE IF NOT EXISTS eventos_orcamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_historico TEXT UNIQUE NOT NULL, -- Ex: '#01'..'#72', '#2026-01'..
    cliente_id INTEGER,
    cliente_nome TEXT NOT NULL,
    tipo_evento TEXT NOT NULL, -- 'SOCIAL_CASAMENTO' | 'SOCIAL_15ANOS' | 'SOCIAL_FORMATURA' | 'SOCIAL_JANTAR' | 'CORP_COFFEE' | 'CORP_FEIRA_B2B' | 'CORP_TREINAMENTO' | 'CATERING_EXTERNO'
    modalidade_operacao TEXT NOT NULL DEFAULT 'HIBRIDO', -- 'VENUE_CATERING' | 'SOMENTE_CATERING' | 'SOMENTE_LOCACAO'
    espaco_id TEXT NOT NULL REFERENCES espacos(id),
    bloqueio_complexo_total INTEGER NOT NULL DEFAULT 0, -- 1 se bloqueia Principal + Intimista simultaneamente
    data_evento TEXT, -- YYYY-MM-DD ou NULL se 'A definir'
    data_exibicao TEXT NOT NULL, -- Texto original ('Dias 06, 07 e 08', '25/11/2025', 'A definir')
    turno TEXT NOT NULL DEFAULT 'NOITE', -- 'MANHA' | 'TARDE' | 'NOITE' | 'INTEGRAL'
    hora_inicio TEXT NOT NULL DEFAULT '19:00',
    publico_estimado INTEGER,
    publico_exibicao TEXT NOT NULL,
    resumo_servico TEXT NOT NULL,
    valor_total REAL NOT NULL,
    valor_pago_sinal REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ORCAMENTO', -- 'ORCAMENTO' | 'CONFIRMADO' | 'EM_PRODUCAO' | 'REALIZADO' | 'DUPLICADO'
    token_proposta TEXT UNIQUE NOT NULL,
    pacote_ancoragem_escolhido TEXT DEFAULT 'OURO', -- 'DIAMANTE_TOP' | 'OURO' | 'ESSENCIAL'
    observacoes TEXT,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 6. Pacotes de Proposta Interativa (Motor Top-Down de Efeito Ancoragem)
CREATE TABLE IF NOT EXISTS proposta_pacotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evento_id INTEGER NOT NULL REFERENCES eventos_orcamentos(id) ON DELETE CASCADE,
    ordem_exibicao INTEGER NOT NULL, -- 1 = Topo (Mais caro/Completo), 2 = Intermediário, 3 = Enxuto
    tier TEXT NOT NULL, -- 'DIAMANTE_MASTER' | 'OURO_EXECUTIVO' | 'ESSENCIAL_ENXUTO'
    titulo TEXT NOT NULL,
    subtitulo TEXT NOT NULL,
    valor_total REAL NOT NULL,
    valor_por_pessoa REAL,
    destaque_ancoragem TEXT NOT NULL,
    itens_json TEXT NOT NULL, -- Lista estruturada de pratos/serviços inclusos
    selecionado INTEGER NOT NULL DEFAULT 0
);

-- 7. BEO (Banquet Event Order) - Cronograma Automático de Cozinha e Salão
CREATE TABLE IF NOT EXISTS beo_cronograma (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evento_id INTEGER NOT NULL REFERENCES eventos_orcamentos(id) ON DELETE CASCADE,
    ordem INTEGER NOT NULL,
    horario TEXT NOT NULL,
    setor TEXT NOT NULL, -- 'COZINHA_CENTRAL' | 'SALAO_GARCONS' | 'FRITURA' | 'CONFEITARIA' | 'LOGISTICA'
    etapa TEXT NOT NULL,
    descricao_operacional TEXT NOT NULL,
    temperatura_alvo TEXT,
    responsavel TEXT NOT NULL,
    status_execucao TEXT NOT NULL DEFAULT 'PENDENTE' -- 'PENDENTE' | 'EM_PREPARO' | 'EXPEDIDO' | 'CONCLUIDO'
);

-- 8. Checklist de Logística e Expedição de Equipamentos
CREATE TABLE IF NOT EXISTS logistica_expedicao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evento_id INTEGER NOT NULL REFERENCES eventos_orcamentos(id) ON DELETE CASCADE,
    equipamento TEXT NOT NULL,
    categoria_equipamento TEXT NOT NULL, -- 'HOTBOX_TERMICO' | 'COZINHA_MODULAR' | 'RECHAUD_LOUCA' | 'AUDIOVISUAL_REFRIGERACAO'
    especificacao_tecnica TEXT NOT NULL,
    quantidade INTEGER NOT NULL DEFAULT 1,
    checked_saida INTEGER NOT NULL DEFAULT 0,
    checked_retorno INTEGER NOT NULL DEFAULT 0,
    observacao TEXT
);

-- 9. Módulo B2B: Feiras Corporativas, Editais (Sebrae) e Cotas de Patrocínio / Estandes
CREATE TABLE IF NOT EXISTS b2b_cotas_estandes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evento_id INTEGER REFERENCES eventos_orcamentos(id) ON DELETE SET NULL,
    nome_projeto TEXT NOT NULL,
    tipo_cota TEXT NOT NULL, -- 'PATROCINIO_MASTER' | 'PATROCINIO_PADRAO' | 'PATROCINIO_APOIO' | 'ESTANDE_FEIRA' | 'EDITAL_SEBRAE'
    empresa_parceira TEXT NOT NULL,
    valor_cota REAL NOT NULL,
    status_comercial TEXT NOT NULL DEFAULT 'PROSPECCAO', -- 'PROSPECCAO' | 'PROPOSTA_ENVIADA' | 'FECHADO' | 'PAGO'
    contrapartidas TEXT NOT NULL
);

-- 10. Módulo Fiscal Padrão (NFS-e Simples Nacional + NBS 103013100 + IBS/CBS Opção 1)
CREATE TABLE IF NOT EXISTS fiscal_nfse (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evento_id INTEGER NOT NULL REFERENCES eventos_orcamentos(id) ON DELETE CASCADE,
    numero_rps TEXT UNIQUE NOT NULL,
    tomador_nome TEXT NOT NULL,
    tomador_documento TEXT NOT NULL,
    codigo_nbs TEXT NOT NULL DEFAULT '103013100',
    descricao_nbs TEXT NOT NULL DEFAULT 'Fornecimento de alimentação para eventos',
    regime_apuracao TEXT NOT NULL DEFAULT 'Simples Nacional',
    classificacao_ibs_cbs TEXT NOT NULL DEFAULT 'Opção 1 - Operação Padrão Tributada',
    valor_servico REAL NOT NULL,
    aliquota_estimada_pct REAL NOT NULL DEFAULT 6.0,
    valor_tributo_estimado REAL NOT NULL,
    discriminacao_nota TEXT NOT NULL,
    status_emissao TEXT NOT NULL DEFAULT 'PRONTO_PARA_TRANSMISSAO', -- 'PRONTO_PARA_TRANSMISSAO' | 'EMITIDA' | 'CANCELADA'
    emitida_em TEXT NOT NULL DEFAULT (datetime('now'))
);
