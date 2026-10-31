const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

function initAndSeedDatabase(dbPath) {
  const db = new DatabaseSync(dbPath);
  const schemaSql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  db.exec(schemaSql);

  const count = db.prepare("SELECT COUNT(*) AS c FROM instituicao").get().c;
  if (count > 0) {
    return db;
  }

  db.exec("BEGIN TRANSACTION");
  try {
    // 1. Dados Institucionais
    db.prepare(`
      INSERT INTO instituicao (
        id, nome_fantasia, razao_social, cnpj, proprietario_gestor, responsavel_comercial,
        telefones, endereco, cidade_uf, cep, banco_codigo, banco_nome, agencia, conta,
        chave_pix, slogan, nbs_padrao, nbs_descricao, regime_tributario, classificacao_ibs_cbs
      ) VALUES (
        1,
        'Delta Espaço e Eventos',
        'Marileide C Melo / M C Melo Santos',
        '06.328.111/0001-08',
        'Leonardo Luís Costa Santos',
        'Leide (Comercial & Atendimento)',
        '(99) 8152-2414 / (98) 98543-8785',
        'Rua Rui Barbosa, 373',
        'Bacabal, MA (Polo Comercial do Vale do Mearim)',
        '65.700-000',
        '077',
        'Banco Inter (077)',
        '0001',
        '42997585-6',
        '93859def-2303-48db-ab92-0dc33f6891bc',
        'Seu evento, nossa missão.',
        '103013100',
        'Fornecimento de alimentação para eventos',
        'Simples Nacional',
        'Opção 1'
      )
    `).run();

    // 2. Espaços Físicos (Venue + Catering)
    const insEspaco = db.prepare(`
      INSERT INTO espacos (id, nome, apelido_comercial, tipo, capacidade_min, capacidade_max, preco_base_locacao, preco_max_locacao, compartilha_cozinha_central, descricao)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insEspaco.run(
      "SALAO_PRINCIPAL",
      "Salão Principal",
      "Espaço Royal / Grande Salão",
      "SALAO_PRINCIPAL",
      150,
      500,
      3000.0,
      6000.0,
      1,
      "Focado em grandes eventos sociais (casamentos, formaturas, bailes de 15 anos) e feiras corporativas de inovação/tecnologia/food service. Capacidade de 400 a 500 pessoas."
    );
    insEspaco.run(
      "SALAO_INTIMISTA",
      "Salão Intimista",
      "Espaço Corporate",
      "SALAO_INTIMISTA",
      15,
      100,
      500.0,
      3000.0,
      1,
      "Focado em reuniões executivas, treinamentos, masterclasses, encontros de gestão ou celebrações reservadas. Capacidade até 100 pessoas."
    );
    insEspaco.run(
      "COMPLEXO_TOTAL",
      "Complexo Completo (Principal + Intimista)",
      "Bloqueio Integral Delta",
      "COMPLEXO_TOTAL",
      200,
      600,
      5500.0,
      9000.0,
      1,
      "Bloqueio simultâneo do Salão Principal + Salão Intimista + Cozinha Central para megaeventos corporativos, congressos ou casamentos de grande porte."
    );
    insEspaco.run(
      "EXTERNO_CATERING",
      "Operação Externa (Catering In-Loco)",
      "Delta Catering & Expedição",
      "EXTERNO_CATERING",
      10,
      1000,
      0.0,
      800.0,
      1,
      "Produção na Cozinha Central Delta com expedição em Hotboxes de alta densidade e finalização in-loco com fogões modulares de alta pressão/indução."
    );

    // 3. Catálogo Gastronômico Master + Tabela de Preços Praticados
    const catalogo = [
      // MÓDULO 1: Jantar Premium (Comfort Food Contemporânea)
      ["PRM-CAR-01", "GASTRONOMIA_PREMIUM", "Jantar Premium · Carnes", "Medalhão de Filé Mignon em Crosta de Castanha de Caju e Ervas", "Corte nobre selado na manteiga de ervas com crosta crocante de castanha de caju", "pessoa", 65.0, 82.0, 100.0, 34.0, "COZINHA_QUENTE", 90],
      ["PRM-CAR-02", "GASTRONOMIA_PREMIUM", "Jantar Premium · Carnes", "Costela Bovina Prensada ao Molho Roti", "Costela assada em baixa temperatura por 12h, prensada e glaceada no próprio roti", "pessoa", 60.0, 78.0, 95.0, 31.0, "COZINHA_QUENTE", 90],
      ["PRM-CAR-03", "GASTRONOMIA_PREMIUM", "Jantar Premium · Carnes", "Fraldinha Braseada na Cerveja Preta", "Fraldinha macia braseada lentamente em redução de cerveja preta artesanal e especiarias", "pessoa", 55.0, 72.0, 90.0, 28.0, "COZINHA_QUENTE", 90],
      ["PRM-CAR-04", "GASTRONOMIA_PREMIUM", "Jantar Premium · Carnes", "Escalopes de Filé (Mostarda Ancienne / Cogumelos / Poivre Vert / Brie com Alho-Poró)", "Escalopes de filé mignon com escolha de molho clássico francês", "pessoa", 60.0, 78.0, 98.0, 32.0, "COZINHA_QUENTE", 90],
      ["PRM-ARR-01", "GASTRONOMIA_PREMIUM", "Jantar Premium · Arrozes", "Arroz Festivo (Castanhas e Damasco)", "Arroz agulhinha premium finalizado com castanhas tostadas, damascos turcos e manteiga", "pessoa", 14.0, 18.0, 24.0, 7.5, "COZINHA_QUENTE", 85],
      ["PRM-ARR-02", "GASTRONOMIA_PREMIUM", "Jantar Premium · Arrozes", "Arroz Negro com Alho-Poró", "Arroz negro de textura al dente salteado com lâminas de alho-poró na manteiga clarificada", "pessoa", 16.0, 22.0, 28.0, 9.0, "COZINHA_QUENTE", 85],
      ["PRM-ARR-03", "GASTRONOMIA_PREMIUM", "Jantar Premium · Arrozes", "Arroz Cremoso de Limão Siciliano", "Arroz envolto em redução cremosa cítrica com raspas frescas de limão siciliano e parmesão", "pessoa", 15.0, 19.0, 25.0, 8.0, "COZINHA_QUENTE", 85],
      ["PRM-ARR-04", "GASTRONOMIA_PREMIUM", "Jantar Premium · Arrozes", "Arroz ao Espumante com Amêndoas", "Cozido em caldo aromático e espumante brut, finalizado com amêndoas laminadas tostadas", "pessoa", 16.0, 21.0, 26.0, 8.5, "COZINHA_QUENTE", 85],

      // MÓDULO 2: Ilha Gastronômica (Grazing Table) e Finger Foods
      ["ILH-EST-01", "GASTRONOMIA_PREMIUM", "Ilha Gastronômica · Estáticos", "Queijo Brie com Favo de Mel, Queijo Coalho Maçaricado, Chips Artesanais e Ceviche de Peixe Branco", "Montagem cenográfica Grazing Table de recepção com frios nobres, favo de mel e ceviche cítrico", "pessoa", 28.0, 38.0, 52.0, 16.0, "GARDE_MANGER_ILHA", 0],
      ["ILH-VOL-01", "GASTRONOMIA_PREMIUM", "Ilha Gastronômica · Volantes", "Passagem Volante Premium: Dadinhos de Tapioca, Mini Bombom de Carne de Sol, Camarão em Panko e Shot de Abóbora", "Serviço volante empratado em mini louças e tacinhas durante o coquetel de boas-vindas", "pessoa", 24.0, 34.0, 45.0, 14.5, "FRITURA_SALGADOS", 30],

      // MÓDULO 3: Sobremesas e Lanche da Madrugada
      ["SOB-PRM-01", "GASTRONOMIA_PREMIUM", "Sobremesas Premium", "Banoffee Desconstruída em Taças / Taça da Felicidade / Mini Pudim com Fava de Baunilha", "Trio de sobremesas autorais servidas em taças e verrines individuais", "pessoa", 8.0, 10.0, 14.0, 4.2, "CONFEITARIA", 135],
      ["MAD-PRM-01", "GASTRONOMIA_PREMIUM", "Lanche da Madrugada", "Mini Hambúrgueres Artesanais + Batata Frita em Cones (Lanche da Madrugada)", "Saída quente na pista de dança com blend bovino artesanal, cheddar e cones de batata crocante", "pessoa", 12.0, 16.0, 22.0, 6.8, "FRITURA_SALGADOS", 210],

      // MÓDULO 4: Coffee Break Corporativo & Kits Lanche Selados
      ["COF-CRP-01", "KITS_CORPORATIVOS", "Coffee Break Corporativo", "Coffee Break Corporativo Completo (Pão Italiano, Sírio, Empadão, Caponata, Salgados, Frutas e Bebidas Quentes/Frias)", "Inclui pão italiano recheado, sanduíches naturais, pão sírio, empadão de frango, barquetes de caponata, coxinha, empadinha, bolinha de queijo, pão de queijo, salada de frutas, sucos, refrigerantes, café e chocolate quente", "pessoa", 28.0, 40.0, 55.0, 16.5, "GARDE_MANGER_ILHA", 0],
      ["KIT-ACR-01", "KITS_CORPORATIVOS", "Kits Lanche Corporativos", "Kit Lanche Corporativo (Caixa Acrílica Selada - Composição Fixa 10 Itens)", "Composição Fixa: 1 Maçã, 1 Batata Frita Freetaz Pocket, 1 Bolinho Bauducco, 1 Wafer Bauducco, 1 Club Social, 1 Amendoim Amendupã, 1 Barra de Cereal Ritter, 3 unidades de Bis", "un", 20.0, 25.0, 35.0, 11.8, "LOGISTICA_OPERACAO", -30],

      // MÓDULO 5: Catálogo Geral & Tabela de Referência de Preços Praticados (72 Orçamentos)
      ["GER-SAL-01", "CATALOGO_GERAL", "Salgados Fritos", "Cento do Mix Tradicional (Coxinha tradicional/gourmet, bolinha de queijo, biquinho, risoles, pastel carne/geleia, quibe)", "R$ 0,65 a R$ 0,80/un (Mais comum: R$ 70,00/cento ou R$ 700/milheiro)", "cento", 65.0, 70.0, 80.0, 28.0, "FRITURA_SALGADOS", 15],
      ["GER-SAL-02", "CATALOGO_GERAL", "Salgados de Forno", "Cento de Assados (Pastel de ricota, pastel húngaro, empada frango/carne, lolita de goiabada)", "R$ 0,80 a R$ 1,00/un (Média praticada: R$ 90,00/cento)", "cento", 80.0, 90.0, 100.0, 36.0, "COZINHA_QUENTE", 15],
      ["GER-SAL-03", "CATALOGO_GERAL", "Salgados Finos", "Cento de Salgados Finos (Barquetes carne de sol/frango/bacalhau/berinjela, Mini Quiches Lorraine/alho-poró, Canudos)", "R$ 1,00 a R$ 1,80/un (Mais comum: R$ 130,00 a R$ 150,00/cento)", "cento", 100.0, 140.0, 180.0, 58.0, "GARDE_MANGER_ILHA", 20],
      ["GER-SAL-04", "CATALOGO_GERAL", "Frutos do Mar", "Cento de Camarão Empanado / Patinha de Caranguejo Crocante / Croquete de Camarão", "R$ 2,10 a R$ 3,50/un (Mais comum: R$ 280,00/cento)", "cento", 210.0, 280.0, 350.0, 130.0, "FRITURA_SALGADOS", 25],
      ["GER-LAN-01", "CATALOGO_GERAL", "Lanches Unitários", "Mini Hambúrguer Artesanal", "Unidade avulsa para eventos e coquetéis (Mais comum: R$ 9,00/un)", "un", 8.0, 9.0, 10.0, 3.8, "COZINHA_QUENTE", 40],
      ["GER-LAN-02", "CATALOGO_GERAL", "Lanches Unitários", "Mini Cachorro-Quente / Mini Pizza / Mini Bauru", "Varia conforme tamanho (Mais comum: R$ 3,00/un)", "un", 2.3, 3.0, 5.0, 1.2, "COZINHA_QUENTE", 35],
      ["GER-LAN-03", "CATALOGO_GERAL", "Lanches Unitários", "Mini Sanduíche Natural (Frango/Atum no Pão Tradicional ou Pão Sírio) / Sanduíche Americano", "Em coffee breaks maiores, cotado também por bandeja/lote", "un", 3.0, 4.0, 5.0, 1.6, "GARDE_MANGER_ILHA", 10],
      ["GER-QNT-01", "CATALOGO_GERAL", "Porções Quentes e Caldos", "Creme de Galinha com Batata Palha / Mini Creme de Camarão na Tacinha / Caldo de Carne / Mingau de Milho", "Mini porção volante quente (Mais comum: R$ 4,00/un)", "un", 3.0, 4.0, 5.0, 1.7, "COZINHA_QUENTE", 45],
      ["GER-BOL-01", "CATALOGO_GERAL", "Bolos Regionais e Confeitaria", "Bolos Regionais e Piscina (Macaxeira, Milho, Tapioca de Caroço, Arroz, Puba, Formigueiro, Piscina Goiaba/Coco, Caseirinhos)", "Bolo inteiro ou bandeja para estação de café regional", "un", 35.0, 55.0, 90.0, 20.0, "CONFEITARIA", 0],
      ["GER-ENT-01", "CATALOGO_GERAL", "Entradas Empratadas", "Escondidinho de Carne de Sol com Macaxeira Gratinada", "Entrada empratada individual (Mais comum: R$ 10,00/pessoa)", "pessoa", 6.0, 10.0, 10.0, 4.2, "COZINHA_QUENTE", 50],
      ["GER-ENT-02", "CATALOGO_GERAL", "Entradas Empratadas", "Filé com Fritas (ou Filé e Frango com Fritas / Rondelli ao Molho Rosé)", "Porção de entrada ou aperitivo de mesa", "pessoa", 3.0, 9.0, 15.0, 4.0, "COZINHA_QUENTE", 50],
      ["GER-BUF-01", "CATALOGO_GERAL", "Buffet Principal", "Jantar / Almoço Completo Tradicional (Filé Demiglace/Madeira/Gorgonzola/Parmegiana, Aves, Pescada, Arrozes, Saladas, Louças e Rechauds)", "Padrão mais frequente: R$ 55,00 a R$ 80,00/pessoa com louças e rechauds inclusos", "pessoa", 42.0, 68.0, 100.0, 29.0, "COZINHA_QUENTE", 90],
      ["GER-BUF-02", "CATALOGO_GERAL", "Buffet Principal", "Feijoada Completa Delta (Arroz Branco, Farofa, Couve, Salada Branca/Maionese, Laranja e Melancia)", "Mais comum: R$ 50,00/pessoa", "pessoa", 28.5, 50.0, 80.0, 21.0, "COZINHA_QUENTE", 90],
      ["GER-BUF-03", "CATALOGO_GERAL", "Buffet Regional Maranhense", "Almoço Regional Maranhense (Arroz de Cuxá, Arroz Maria Izabel, Paçoca de Carne, Torta de Camarão, Vatapá, Bolo de Tapioca e Bacuri)", "Cardápio típico maranhense completo (Ref. R$ 80,00/pessoa)", "pessoa", 65.0, 80.0, 95.0, 33.0, "COZINHA_QUENTE", 90],
      ["GER-BUF-04", "KITS_CORPORATIVOS", "Refeição Corporativa", "Refeição Corporativa Tipo Quentinha Completa (com Bebida e Sobremesa)", "Refeição executiva individual selada para equipes e eventos institucionais", "un", 35.0, 50.0, 60.0, 21.0, "COZINHA_QUENTE", 60],
      ["GER-DOC-01", "CATALOGO_GERAL", "Docinhos e Bem-Vividos", "Cento de Docinhos Tradicionais (Brigadeiro, Segredo de Uva, Olho de Sogra)", "R$ 50,00/cento (R$ 0,50/un)", "cento", 50.0, 50.0, 65.0, 20.0, "CONFEITARIA", 120],
      ["GER-DOC-02", "CATALOGO_GERAL", "Docinhos e Bem-Vividos", "Cento de Bem-Vividos / Bem-Casados Artesanais", "R$ 350,00/cento (R$ 3,50/un)", "cento", 300.0, 350.0, 400.0, 140.0, "CONFEITARIA", 120],
      ["GER-BEB-01", "CATALOGO_GERAL", "Bebidas Não Alcoólicas", "Jarra de Suco Natural (Goiaba, Acerola, Abacaxi c/ Menta, Caju, Cajá, Maracujá, Bacuri)", "R$ 25,00 a R$ 30,00 por jarra (ou pacote de R$ 250 a R$ 525 por evento)", "jarra", 25.0, 28.0, 30.0, 10.0, "COPA_BAR", 0],
      ["GER-BEB-02", "CATALOGO_GERAL", "Bebidas Não Alcoólicas", "Refrigerante 2L (Coca-Cola, Guaraná, Guaraná Jesus) / Água Mineral e Água de Coco", "R$ 15,00 a R$ 18,00 por garrafa 2L", "garrafa", 15.0, 16.5, 18.0, 8.5, "COPA_BAR", 0],
      ["GER-BEB-03", "CATALOGO_GERAL", "Bebidas Quentes", "Garrafa Térmica de Café (Preto/Com Leite) ou Chocolate Quente / Cappuccino", "Café: R$ 20 a R$ 40 | Chocolate Quente: R$ 40 a R$ 70 por garrafa térmica", "garrafa", 20.0, 35.0, 70.0, 12.0, "COPA_BAR", 0],
      ["GER-BEB-04", "CATALOGO_GERAL", "Bebidas Alcoólicas", "Cerveja Premium (Stella Artois 600ml / Heineken) - Lote Evento", "Cotado sob demanda conforme pacote de bar", "evento", 1200.0, 3080.0, 4500.0, 2100.0, "COPA_BAR", 0],

      // MÓDULO 6: Equipe Operacional
      ["EQP-GAR-01", "EQUIPE", "Equipe de Salão", "Diária de Garçom de Salão", "Padrão mais frequente: R$ 160,00 a R$ 180,00", "diaria", 150.0, 180.0, 200.0, 150.0, "LOGISTICA_OPERACAO", -60],
      ["EQP-GAR-02", "EQUIPE", "Equipe de Salão", "Diária de Garçom Chefe / Maitre Coordenador", "Coordenação de salão e protocolo de serviço", "diaria", 220.0, 250.0, 300.0, 200.0, "LOGISTICA_OPERACAO", -90],
      ["EQP-SEG-01", "EQUIPE", "Segurança e Portaria", "Diária de Segurança Patrimonial / Controle de Acesso", "Padrão mais frequente: R$ 160,00 a R$ 180,00", "diaria", 150.0, 180.0, 180.0, 150.0, "LOGISTICA_OPERACAO", -60],
      ["EQP-COZ-01", "EQUIPE", "Equipe de Cozinha", "Diária de Fritadeira / Ajudante de Cozinha / Apoio", "Padrão mais frequente: R$ 140,00 a R$ 160,00", "diaria", 100.0, 150.0, 200.0, 130.0, "FRITURA_SALGADOS", -120],
      ["EQP-BAR-01", "EQUIPE", "Serviços Especiais", "Serviço Completo de Barman / Coquetelaria", "Estrutura de bar e preparação de drinks durante o evento", "evento", 1000.0, 1200.0, 1500.0, 850.0, "COPA_BAR", -60],
      ["EQP-BAN-01", "EQUIPE", "Atração Musical", "Banda Pagode Recomeço (com Estrutura de Som)", "Atração musical completa com sonorização inclusa", "evento", 2200.0, 2500.0, 3000.0, 2000.0, "LOGISTICA_OPERACAO", -120],

      // MÓDULO 7: Locação de Espaço, Equipamentos e Logística
      ["LOC-ESP-01", "LOCACAO_EQUIPAMENTOS", "Locação de Espaço", "Locação Salão Intimista (Espaço Corporate - 50 a 100 pessoas)", "Climatizado; eventos de 50-100p: R$ 800 a R$ 1.500; múltiplos dias: R$ 3.000 a R$ 6.000", "evento", 500.0, 1500.0, 4700.0, 250.0, "LOGISTICA_OPERACAO", -180],
      ["LOC-ESP-02", "LOCACAO_EQUIPAMENTOS", "Locação de Espaço", "Locação Salão Principal (Espaço Royal - até 500 pessoas)", "Salão principal para grandes eventos sociais, formaturas e feiras B2B", "evento", 3000.0, 4500.0, 6000.0, 600.0, "LOGISTICA_OPERACAO", -240],
      ["LOC-EQP-01", "LOCACAO_EQUIPAMENTOS", "Audiovisual e Refrigeração", "Kit Projetor + Telão (R$ 300) / Kit Som + Telão (R$ 600) / Freezer Extra (R$ 400)", "Equipamentos de apoio para treinamentos, palestras e eventos sociais", "evento", 300.0, 400.0, 600.0, 80.0, "LOGISTICA_OPERACAO", -120],
      ["LOG-DSP-01", "LOGISTICA", "Transporte e Expedição", "Taxa de Deslocamento / Logística Hotbox & Cozinha Modular", "Local Bacabal: R$ 50 a R$ 300 | Eventos maiores ou fora da sede: R$ 600 a R$ 800", "evento", 50.0, 200.0, 800.0, 90.0, "LOGISTICA_OPERACAO", -120]
    ];

    const insCat = db.prepare(`
      INSERT INTO catalogo_itens (
        codigo, grupo, categoria, nome, descricao, unidade,
        preco_min, preco_padrao, preco_max, custo_estimado, setor_cozinha, offset_beo_minutos
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of catalogo) {
      insCat.run(...item);
    }

    // 4. Clientes Principais Identificados na Base
    const clientesSeed = [
      ["Biorim", "B2B_CORPORATIVO", "12.450.900/0001-19", "(99) 98111-2200", "Bacabal - MA", "Cliente recorrente corporativo (Coffee breaks multi-dias, coquetéis e locação de espaço com mesas/cadeiras)."],
      ["UFMA (Auditório Campus Bacabal)", "INSTITUCIONAL_EDITAL", "06.279.103/0001-19", "(99) 3621-0000", "Bacabal - MA", "Contrato grande porte: Lanche da Manhã + Lanche da Tarde para 70 pessoas durante 5 dias (R$ 35.000,00)."],
      ["Malwee", "B2B_CORPORATIVO", "84.429.737/0001-14", "(99) 98234-1010", "Bacabal - MA", "Treinamento e encontro corporativo em salão climatizado por 3 diárias + 3 Coffee Breaks."],
      ["Fundação Sousândrade", "INSTITUCIONAL_EDITAL", "07.122.401/0001-80", "(98) 3217-4500", "São Luís / Bacabal - MA", "Projetos institucionais e coffee break corporativo para 100 pessoas."],
      ["Sinhá Moça", "B2B_CORPORATIVO", "18.920.331/0001-55", "(99) 98140-5000", "Bacabal - MA", "Evento corporativo para 100 pessoas com mix completo de salgados, mini hambúrgueres e equipe."],
      ["Thiago Macedo", "B2C_SOCIAL", "041.882.913-00", "(99) 98190-1234", "Bacabal - MA", "Recepção para 100 pessoas com Aluguel do Espaço Royal, jantar e salgados finos."],
      ["Marcelo Monaco", "B2C_SOCIAL", "291.004.812-20", "(99) 98200-4567", "Bacabal - MA", "Encomenda especial de 4.000 salgados especiais (camarão, patinha, barquete, pastel c/ geleia) + fritura."],
      ["Amanda Balby", "B2C_SOCIAL", "610.334.923-11", "(99) 98177-8899", "Bacabal - MA", "Evento para 170 pessoas (R$ 3.000 de sinal pago; restam R$ 4.310)."],
      ["Myralda Damasceno", "B2C_SOCIAL", "502.119.483-90", "(99) 98166-3344", "Bacabal - MA", "Coffee break completo para 150 pessoas."],
      ["Lívia", "B2B_CORPORATIVO", "033.918.273-45", "(99) 98122-7788", "Bacabal - MA", "Cliente recorrente de Coffee Break Regional de 2 dias e recepções para 100 pessoas."],
      ["Leonardo", "B2C_SOCIAL", "019.283.746-55", "(99) 98100-0001", "Bacabal - MA", "Encomenda de 2.100 salgados (fritos, assados e finos) com equipe de fritura e apoio."],
      ["Cliente 99984345733 (Grande Jantar 250p)", "B2C_SOCIAL", "781.220.193-00", "(99) 98434-5733", "Bacabal - MA", "Grande jantar social para 250 pessoas + 4.000 salgados + bebidas e equipe."],
      ["Sebrae Maranhão (Regional Bacabal)", "INSTITUCIONAL_EDITAL", "03.402.005/0001-60", "(99) 3621-1500", "Bacabal - MA", "Parceiro de editais, feiras de gastronomia/food service e capacitações empresariais."]
    ];

    const insCli = db.prepare(`
      INSERT INTO clientes (nome, tipo_cliente, documento, telefone, cidade, observacoes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const c of clientesSeed) {
      insCli.run(...c);
    }

    // 5. Consolidação Completa dos 72 Orçamentos + 8 Orçamentos Adicionais 2025/2026 (Total: 80 Orçamentos)
    const orcamentos72 = [
      ["#01", "Não informado", "CORP_COFFEE", "SOMENTE_CATERING", "EXTERNO_CATERING", "2026-10-06", "Dias 06, 07 e 08", "MANHA", "07:30", 50, "50/dia", "Café da manhã para 3 dias + transporte", 5700.0, 0, "ORCAMENTO"],
      ["#02", "Não informado", "CATERING_EXTERNO", "SOMENTE_CATERING", "EXTERNO_CATERING", null, "A definir", "NOITE", "19:00", null, "N/I", "Salgados, bolo piscina, docinhos, lanches, bebidas e 2 garçons", 3404.0, 0, "ORCAMENTO"],
      ["#03", "Não informado", "CATERING_EXTERNO", "SOMENTE_CATERING", "EXTERNO_CATERING", null, "A definir", "NOITE", "19:00", null, "N/I", "2.000 salgados (croquete camarão, empada, patinha) + fritura", 2400.0, 0, "ORCAMENTO"],
      ["#04", "Não informado", "CORP_COFFEE", "SOMENTE_CATERING", "EXTERNO_CATERING", null, "A definir", "TARDE", "15:00", null, "N/I", "Coffee break (salgados, bolos regionais, mini hot dog e bebidas)", 2700.0, 0, "ORCAMENTO"],
      ["#05", "Não informado", "CORP_COFFEE", "SOMENTE_CATERING", "EXTERNO_CATERING", null, "A definir", "INTEGRAL", "08:00", 30, "30", "Lanche da manhã + Lanche da tarde completos", 1800.0, 0, "ORCAMENTO"],
      ["#06", "Não informado", "SOCIAL_JANTAR", "VENUE_CATERING", "SALAO_INTIMISTA", null, "A definir", "NOITE", "19:30", 120, "120", "2.000 salgados, lanches, jantar (Arroz Primavera/Filé), bebidas, 3 garçons e Espaço Corporate", 11440.0, 0, "ORCAMENTO"],
      ["#07", "Não informado", "SOCIAL_JANTAR", "VENUE_CATERING", "SALAO_INTIMISTA", null, "A definir", "NOITE", "19:30", 55, "55", "600 salgados, lanches, jantar (Filé demiglace/Lasanha), bebidas, 1 garçom e Espaço Corporate", 4195.0, 0, "ORCAMENTO"],
      ["#08", "Não informado", "SOCIAL_CASAMENTO", "VENUE_CATERING", "SALAO_PRINCIPAL", "2026-08-15", "Realizado", "NOITE", "20:00", 150, "150", "Salgados finos, tortas, jantar completo, bebidas, 6 garçons, segurança e Espaço Corporate", 14810.0, 14810.0, "REALIZADO"],
      ["#09", "Não informado", "SOCIAL_JANTAR", "VENUE_CATERING", "SALAO_PRINCIPAL", "2026-08-22", "Realizado", "NOITE", "20:00", 150, "150", "Salgados fritos, jantar regional/filé à parmegiana, bebidas, 6 garçons, segurança e Espaço Corporate", 14430.0, 14430.0, "REALIZADO"],
      ["#10", "Biorim", "CORP_COFFEE", "SOMENTE_CATERING", "EXTERNO_CATERING", "2026-07-18", "Realizado", "TARDE", "16:00", 150, "150", "1.500 salgados fritos, 750 finos, lanches variados, salada de fruta e sucos", 4405.0, 4405.0, "REALIZADO"],
      ["#11", "Não informado", "CATERING_EXTERNO", "SOMENTE_CATERING", "EXTERNO_CATERING", "2026-07-25", "Realizado", "NOITE", "19:00", null, "N/I", "1.250 salgados, creme de galinha, 250 hot dogs, 250 mini pizzas, 80 mini hambúrgueres e suco", 3433.0, 3433.0, "REALIZADO"],
      ["#12", "Thiago Macedo", "SOCIAL_CASAMENTO", "VENUE_CATERING", "SALAO_PRINCIPAL", "2026-10-24", "A definir", "NOITE", "20:00", 100, "100", "1.500 salgados, 500 finos, jantar, bebidas, 3 garçons e Aluguel Espaço Royal", 13370.0, 0, "CONFIRMADO"],
      ["#13", "Não informado", "SOCIAL_FORMATURA", "VENUE_CATERING", "SALAO_PRINCIPAL", "2026-09-05", "Realizado", "NOITE", "20:00", 150, "150", "600 salgados, jantar completo, bebidas, 6 garçons, segurança e Espaço Corporate", 13880.0, 13880.0, "REALIZADO"],
      ["#14", "Biorim", "CORP_COFFEE", "SOMENTE_CATERING", "EXTERNO_CATERING", "2026-07-07", "Dias 7, 8, 9 e 10/07", "MANHA", "08:30", 10, "10", "4 serviços de Coffee Break (R$ 800,00 cada)", 3200.0, 3200.0, "REALIZADO"],
      ["#15", "Biorim", "CORP_FEIRA_B2B", "SOMENTE_LOCACAO", "SALAO_PRINCIPAL", "2026-10-24", "A definir", "INTEGRAL", "08:00", 300, "N/I", "Aluguel do espaço com cadeiras (R$ 6.000) + Aluguel de mesas (R$ 600)", 6600.0, 0, "ORCAMENTO"],
      ["#16", "Biorim", "CORP_FEIRA_B2B", "SOMENTE_LOCACAO", "SALAO_PRINCIPAL", null, "A definir", "INTEGRAL", "08:00", null, "N/I", "Aluguel do espaço com cadeiras (R$ 6.000) + Aluguel de mesas (R$ 600) (duplicado)", 6600.0, 0, "DUPLICADO"],
      ["#17", "Não informado", "CATERING_EXTERNO", "SOMENTE_CATERING", "EXTERNO_CATERING", null, "A definir", "NOITE", "19:00", null, "N/I", "Lanches, caldo de carne, farofa de cuscuz, salgados, bolo, bebidas e 1 garçom", 4100.0, 0, "ORCAMENTO"],
      ["#18", "Não informado", "CATERING_EXTERNO", "SOMENTE_CATERING", "EXTERNO_CATERING", null, "A definir", "NOITE", "19:00", null, "N/I", "2.400 salgados fritos, 500 forno, 300 finos, 600 lanches (sem bebidas) + equipe/deslocamento", 5550.0, 0, "ORCAMENTO"],
      ["#19", "Não informado", "CATERING_EXTERNO", "SOMENTE_CATERING", "EXTERNO_CATERING", null, "A definir", "NOITE", "19:00", null, "N/I", "Mesmo cardápio do item #18 + inclusão de Suco (R$ 450) e Refrigerante (R$ 630)", 6630.0, 0, "ORCAMENTO"],
      ["#20", "Não informado", "SOCIAL_JANTAR", "VENUE_CATERING", "SALAO_INTIMISTA", null, "A definir", "NOITE", "19:30", 100, "100", "1.500 salgados, jantar (100 pessoas - Fricassê/Strogonoff), bebidas, 2 garçons, segurança e Espaço Corporate", 8680.0, 0, "ORCAMENTO"],
      ["#21", "Não informado", "CORP_TREINAMENTO", "VENUE_CATERING", "SALAO_INTIMISTA", null, "A definir", "NOITE", "19:00", 100, "100", "1.500 salgados fritos, 500 finos, bebidas (inclui coco e Heineken), 2 garçons, projetor/telão", 3380.0, 0, "ORCAMENTO"],
      ["#22", "Não informado", "CATERING_EXTERNO", "SOMENTE_CATERING", "EXTERNO_CATERING", null, "A definir", "NOITE", "20:00", 100, "100", "Jantar para 150 porções (Filé demiglace/Strogonoff), bebidas, 3 garçons e deslocamento", 9655.0, 0, "ORCAMENTO"],
      ["#23", "Leonardo", "CATERING_EXTERNO", "SOMENTE_CATERING", "EXTERNO_CATERING", "2026-10-18", "A definir", "NOITE", "19:00", 100, "100", "1.500 salgados fritos, 300 assados, 300 finos, fritura, ajudante e deslocamento", 2120.0, 0, "CONFIRMADO"],
      ["#24", "Lívia", "CORP_COFFEE", "SOMENTE_CATERING", "EXTERNO_CATERING", null, "A definir", "TARDE", "16:00", 100, "100", "1.100 salgados fritos, 300 assados, 300 lanches/creme de galinha, suco, garçom, fritura e apoio", 3255.0, 0, "ORCAMENTO"],
      ["#25", "Não informado", "CATERING_EXTERNO", "SOMENTE_CATERING", "EXTERNO_CATERING", null, "A definir", "NOITE", "19:00", null, "N/I", "1.000 salgados fritos, 300 assados, fritura, ajudante e deslocamento", 1440.0, 0, "ORCAMENTO"],
      ["#26", "Não informado", "SOCIAL_JANTAR", "VENUE_CATERING", "SALAO_INTIMISTA", null, "A definir", "NOITE", "20:00", 100, "100", "2.000 salgados, 400 lanches/filé com fritas, jantar (Filé madeira), bebidas, freezer, garçons e espaço", 11330.0, 0, "ORCAMENTO"],
      ["#27", "Não informado", "SOCIAL_JANTAR", "SOMENTE_CATERING", "EXTERNO_CATERING", null, "A definir", "TARDE", "12:30", 80, "80", "Feijoada completa + assado de panela/frango, bebidas, 1 garçom e deslocamento", 5540.0, 0, "ORCAMENTO"],
      ["#28", "Não informado", "SOCIAL_JANTAR", "VENUE_CATERING", "SALAO_INTIMISTA", null, "A definir", "NOITE", "19:30", 100, "100", "Mesmo escopo do item #20, porém com jantar ajustado para 70 pessoas", 6680.0, 0, "ORCAMENTO"],
      ["#29", "Não informado", "SOCIAL_CASAMENTO", "VENUE_CATERING", "SALAO_INTIMISTA", null, "A definir", "NOITE", "20:00", 100, "100", "800 salgados fritos, 700 finos, escondidinho, jantar (Filé gorgonzola/Pescada), bebidas, equipe e espaço", 9510.0, 0, "ORCAMENTO"],
      ["#30", "Lívia", "CORP_COFFEE", "SOMENTE_CATERING", "EXTERNO_CATERING", null, "A definir", "TARDE", "16:00", 100, "100", "1.500 salgados fritos, 300 assados, 200 lanches (hot dog/pizza), bebidas, garçom e deslocamento", 3615.0, 0, "ORCAMENTO"],
      ["#31", "Lívia", "CORP_COFFEE", "SOMENTE_CATERING", "EXTERNO_CATERING", "2026-10-29", "29/10 e 30/10", "MANHA", "08:00", 50, "50/dia", "2 dias de Coffee Break regional completo (Dia 29: R$ 2.500 / Dia 30: R$ 3.500)", 6000.0, 3000.0, "CONFIRMADO"],
      ["#32", "Não informado", "CATERING_EXTERNO", "SOMENTE_CATERING", "EXTERNO_CATERING", null, "A definir", "NOITE", "19:00", 200, "200", "2.000 salgados fritos, 600 finos, bebidas, transporte, descartáveis e 2 garçons", 3520.0, 0, "ORCAMENTO"],
      ["#33", "Não informado", "CORP_TREINAMENTO", "SOMENTE_CATERING", "EXTERNO_CATERING", null, "A definir", "INTEGRAL", "08:00", 780, "780", "10 dias de Coffee Break Tipo 2 + Serviço de Sala (39 pessoas por turno/dia)", 23400.0, 0, "ORCAMENTO"],
      ["#34", "Não informado", "CORP_COFFEE", "SOMENTE_CATERING", "EXTERNO_CATERING", null, "A definir", "INTEGRAL", "08:00", 100, "100", "Coffee break volante (4 dias / 5 turnos) + 2 garçons e deslocamento", 4820.0, 0, "ORCAMENTO"],
      ["#35", "Não informado", "CORP_COFFEE", "SOMENTE_CATERING", "EXTERNO_CATERING", null, "A definir", "INTEGRAL", "11:30", 50, "50", "50 Kits Lanche (R$ 1.000) + 50 Refeições tipo quentinha com bebida/sobremesa (R$ 2.500)", 3500.0, 0, "ORCAMENTO"],
      ["#36", "Não informado", "CATERING_EXTERNO", "SOMENTE_CATERING", "EXTERNO_CATERING", null, "A definir", "NOITE", "18:00", 500, "N/I", "13.000 salgados variados (R$ 9.750) + equipe de apoio (5), fritura (2) e deslocamento", 10650.0, 0, "ORCAMENTO"],
      ["#37", "Não informado", "CORP_TREINAMENTO", "SOMENTE_LOCACAO", "SALAO_INTIMISTA", "2026-10-01", "01/10 e 02/10", "INTEGRAL", "08:00", 80, "N/I", "Aluguel do Espaço Corporate para 2 dias", 3000.0, 3000.0, "REALIZADO"],
      ["#38", "Não informado", "SOCIAL_CASAMENTO", "VENUE_CATERING", "SALAO_PRINCIPAL", null, "A definir", "NOITE", "20:00", 150, "150", "1.550 salgados fritos, 700 finos, jantar completo, bebidas e Aluguel Espaço Corporate", 14030.0, 0, "ORCAMENTO"],
      ["#39", "Não informado", "SOCIAL_JANTAR", "VENUE_CATERING", "SALAO_PRINCIPAL", null, "A definir", "NOITE", "20:00", 150, "150", "Jantar completo para 150 pessoas (sem salgados), bebidas e Aluguel Espaço Corporate", 12225.0, 0, "ORCAMENTO"],
      ["#40", "Não informado", "SOCIAL_JANTAR", "VENUE_CATERING", "SALAO_PRINCIPAL", null, "A definir", "NOITE", "20:00", 150, "150", "Duplicata exata do orçamento #39", 12225.0, 0, "DUPLICADO"],
      ["#41", "Não informado", "SOCIAL_JANTAR", "VENUE_CATERING", "SALAO_INTIMISTA", null, "A definir", "NOITE", "19:30", 80, "80", "1.200 salgados, jantar completo (80 pessoas), bebidas, 3 garçons e Espaço Corporate", 7845.0, 0, "ORCAMENTO"],
      ["#42", "Não informado", "CORP_COFFEE", "VENUE_CATERING", "SALAO_INTIMISTA", null, "A definir", "TARDE", "15:00", 60, "N/I", "Bolos, salgados e bebidas (R$ 700) + Aluguel do espaço (R$ 2.100)", 2800.0, 0, "ORCAMENTO"],
      ["#43", "Não informado", "CATERING_EXTERNO", "SOMENTE_CATERING", "EXTERNO_CATERING", null, "A definir", "NOITE", "19:00", null, "N/I", "1.000 salgados, 200 mini pizzas, 400 frutos do mar, 200 quiches + aluguel de louças e fritura", 3785.0, 0, "ORCAMENTO"],
      ["#44", "Não informado", "CATERING_EXTERNO", "SOMENTE_CATERING", "EXTERNO_CATERING", null, "A definir", "NOITE", "19:00", null, "N/I", "Equipe avulsa: 6 garçons normais (R$ 1.080), 1 garçom chefe (R$ 250) e 1 segurança (R$ 180)", 1510.0, 0, "ORCAMENTO"],
      ["#45", "Não informado", "CORP_FEIRA_B2B", "SOMENTE_LOCACAO", "SALAO_INTIMISTA", null, "A definir", "INTEGRAL", "08:00", 100, "N/I", "Aluguel do espaço por 3 dias", 6000.0, 0, "ORCAMENTO"],
      ["#46", "Não informado", "CATERING_EXTERNO", "SOMENTE_CATERING", "EXTERNO_CATERING", null, "A definir", "NOITE", "19:00", null, "N/I", "4.000 salgados especiais (camarão, patinha, barquete, pastel c/ geleia, coxinha, queijo) + fritura", 7290.0, 0, "ORCAMENTO"],
      ["#47", "Marcelo Monaco", "CATERING_EXTERNO", "SOMENTE_CATERING", "EXTERNO_CATERING", "2025-11-25", "25/11/2025", "NOITE", "19:00", 200, "N/I", "Mesmo quantitativo e valor do item #46 (4.000 salgados especiais com croquete de camarão + fritura)", 7290.0, 7290.0, "REALIZADO"],
      ["#48", "Não informado", "SOCIAL_JANTAR", "VENUE_CATERING", "SALAO_INTIMISTA", null, "A definir", "NOITE", "19:30", 70, "70", "900 salgados, jantar (70 pessoas), bebidas, 2 garçons, fritura, ajudante e Espaço Corporate", 6525.0, 0, "ORCAMENTO"],
      ["#49", "Não informado", "CORP_COFFEE", "SOMENTE_CATERING", "EXTERNO_CATERING", "2026-10-17", "17/10", "MANHA", "08:30", 30, "30", "Coffee break com salada de fruta, salgados finos (35 de cada), bolos, bebidas e louças", 1700.0, 850.0, "EM_PRODUCAO"],
      ["#50", "Não informado", "SOCIAL_JANTAR", "VENUE_CATERING", "SALAO_INTIMISTA", "2026-10-24", "A definir", "NOITE", "19:30", 120, "120", "1.700 salgados fritos, 300 forno, 300 lanches, bebidas, equipe e Espaço Corporate (R$ 1.000 já pago; restam R$ 4.320)", 5320.0, 1000.0, "CONFIRMADO"],
      ["#51", "Não informado", "CORP_COFFEE", "SOMENTE_CATERING", "EXTERNO_CATERING", null, "A definir", "MANHA", "08:00", 200, "200", "200 Kits Lanche completos a R$ 25,00 por unidade", 5000.0, 0, "ORCAMENTO"],
      ["#52", "Não informado", "CORP_TREINAMENTO", "VENUE_CATERING", "SALAO_INTIMISTA", null, "A definir", "TARDE", "14:00", 30, "30", "600 salgados, 60 lanches, bebidas, aluguel do espaço (R$ 900), telão/projetor e microfone", 2100.0, 0, "ORCAMENTO"],
      ["#53", "Não informado", "CATERING_EXTERNO", "SOMENTE_CATERING", "EXTERNO_CATERING", null, "A definir", "TARDE", "17:00", null, "N/I", "1.500 salgados fritos avulsos", 1050.0, 0, "ORCAMENTO"],
      ["#54", "Não informado", "CORP_COFFEE", "SOMENTE_CATERING", "EXTERNO_CATERING", null, "A definir", "MANHA", "09:00", 30, "30", "Coffee break (salgados fritos/assados, sanduíche, pão de queijo, bolos e bebidas)", 1400.0, 0, "ORCAMENTO"],
      ["#55", "Não informado", "CORP_COFFEE", "SOMENTE_CATERING", "EXTERNO_CATERING", null, "A definir", "MANHA", "09:00", 30, "30", "900 pasteizinhos com carne e geleia, pão de queijo, bolos, pães e bebidas", 1400.0, 0, "ORCAMENTO"],
      ["#56", "Não informado", "CORP_COFFEE", "SOMENTE_CATERING", "EXTERNO_CATERING", null, "A definir", "MANHA", "09:00", 30, "30", "Duplicata do orçamento #55", 1400.0, 0, "DUPLICADO"],
      ["#57", "Não informado", "CORP_COFFEE", "SOMENTE_CATERING", "EXTERNO_CATERING", null, "A definir", "INTEGRAL", "08:00", 30, "30", "Petit Four (20 un: R$ 400) + 2 turnos de Coffee Break para 30 pessoas (R$ 1.050 cada)", 2500.0, 0, "ORCAMENTO"],
      ["#58", "Não informado", "CORP_COFFEE", "VENUE_CATERING", "SALAO_INTIMISTA", null, "A definir", "NOITE", "19:00", 70, "70", "1.000 salgados, lanches variados, empadão, bebidas, garçom e aluguel do espaço", 2945.0, 0, "ORCAMENTO"],
      ["#59", "Não informado", "SOCIAL_JANTAR", "VENUE_CATERING", "SALAO_INTIMISTA", null, "A definir", "NOITE", "19:30", 70, "70", "Duplicata exata do orçamento #48", 6525.0, 0, "DUPLICADO"],
      ["#60", "Não informado", "CATERING_EXTERNO", "SOMENTE_CATERING", "EXTERNO_CATERING", null, "A definir", "NOITE", "19:00", 70, "70", "600 salgados, lanches especiais (creme de camarão, pão sírio, barquete), bebidas e deslocamento", 3005.0, 0, "ORCAMENTO"],
      ["#61", "Não informado", "CORP_COFFEE", "VENUE_CATERING", "SALAO_INTIMISTA", null, "A definir", "NOITE", "19:00", 70, "70", "Duplicata exata do orçamento #58", 2945.0, 0, "DUPLICADO"],
      ["#62", "Não informado", "CORP_COFFEE", "SOMENTE_CATERING", "EXTERNO_CATERING", null, "A definir", "MANHA", "08:00", 160, "160", "Petit Four (40 garrafas de café, biscoitos, água, embalagem e deslocamento) (aparece 2x)", 3200.0, 0, "ORCAMENTO"],
      ["#63", "Não informado", "CORP_COFFEE", "VENUE_CATERING", "SALAO_PRINCIPAL", null, "A definir", "TARDE", "15:00", 240, "240", "Mega Coffee Break para 240 pessoas (salgados, bolos, tortas, lanches e bebidas)", 10800.0, 0, "ORCAMENTO"],
      ["#64", "Não informado", "CORP_COFFEE", "VENUE_CATERING", "SALAO_INTIMISTA", null, "A definir", "NOITE", "19:00", 70, "70", "Variante do orçamento #58 (com 1.500 salgados e 100 patinhas de caranguejo)", 2945.0, 0, "ORCAMENTO"],
      ["#65", "Não informado", "SOCIAL_JANTAR", "VENUE_CATERING", "SALAO_INTIMISTA", null, "A definir", "NOITE", "19:30", 70, "70", "1.500 salgados, 100 patinhas, jantar (70 pessoas), bebidas, 2 garçons, segurança e espaço", 6770.0, 0, "ORCAMENTO"],
      ["#66", "Não informado", "CORP_COFFEE", "SOMENTE_CATERING", "EXTERNO_CATERING", null, "A definir", "TARDE", "16:00", 80, "80", "Coffee break gourmet (80 un de cada salgado fino/frutos do mar, tortas, empadão, bebidas e garçom)", 4000.0, 0, "ORCAMENTO"],
      ["#67", "Não informado", "SOCIAL_JANTAR", "VENUE_CATERING", "SALAO_INTIMISTA", null, "A definir", "NOITE", "19:30", 40, "40", "800 salgados, jantar (40 pessoas), 2 garçons e Espaço Corporate", 4080.0, 0, "ORCAMENTO"],
      ["#68", "Fundação Sousândrade", "CORP_COFFEE", "SOMENTE_CATERING", "EXTERNO_CATERING", "2025-11-27", "27/11/2025", "MANHA", "08:30", 100, "100", "Coffee break corporativo completo", 2300.0, 2300.0, "REALIZADO"],
      ["#69", "Amanda Balby", "SOCIAL_FORMATURA", "SOMENTE_CATERING", "EXTERNO_CATERING", "2026-10-31", "A definir", "NOITE", "20:00", 170, "170", "2.500 salgados fritos, 500 forno, 300 finos, 710 lanches, suco e equipe (Pago: R$ 3.000 / Resta: R$ 4.310)", 7310.0, 3000.0, "CONFIRMADO"],
      ["#70", "Não informado", "CORP_COFFEE", "VENUE_CATERING", "SALAO_INTIMISTA", "2026-10-17", "17/10", "MANHA", "07:30", 16, "15–16", "Café regional (bolos, mingau de milho, caldo de carne, salgados e bebidas) (aparece 2x)", 1280.0, 640.0, "EM_PRODUCAO"],
      ["#71", "Aniversário 15 Anos", "SOCIAL_15ANOS", "VENUE_CATERING", "SALAO_INTIMISTA", "2026-11-07", "A definir", "NOITE", "20:00", 70, "70", "1.200 salgados, jantar (70 pessoas), bebidas, 2 garçons, segurança e Espaço Corporate (aparece 2x)", 7810.0, 2000.0, "CONFIRMADO"],
      ["#72", "Myralda Damasceno", "CORP_COFFEE", "VENUE_CATERING", "SALAO_PRINCIPAL", "2026-11-14", "A definir", "TARDE", "16:00", 150, "150", "Coffee break para 150 pessoas (salgados, barquete, empada, sanduíche, hot dog e bebidas)", 6000.0, 0, "ORCAMENTO"],

      // Orçamentos Adicionais de 2025/2026 (Continuação da Base)
      ["#73", "UFMA (Auditório)", "CORP_COFFEE", "SOMENTE_CATERING", "EXTERNO_CATERING", "2026-04-13", "13/04 a 17/04", "INTEGRAL", "08:00", 70, "70/dia (5 dias)", "Lanche da Manhã (R$ 3.500/dia = R$ 17.500) + Lanche da Tarde (R$ 3.500/dia = R$ 17.500) para 5 dias", 35000.0, 35000.0, "REALIZADO"],
      ["#74", "Malwee", "CORP_TREINAMENTO", "VENUE_CATERING", "SALAO_INTIMISTA", "2026-01-21", "21 a 23/01/2026", "INTEGRAL", "08:00", 45, "45", "3 diárias de salão climatizado (R$ 1.800) + 3 Coffee Breaks (R$ 900)", 2700.0, 2700.0, "REALIZADO"],
      ["#75", "Sinhá Moça", "CORP_COFFEE", "SOMENTE_CATERING", "EXTERNO_CATERING", "2026-10-28", "Out/2026", "NOITE", "19:00", 100, "100", "2.000 salgados fritos, 500 forno, 600 finos, 70 mini hambúrgueres, bebidas e equipe", 5000.0, 2500.0, "CONFIRMADO"],
      ["#76", "Welcome Coffee & Coffee Break Corporativo", "CORP_COFFEE", "VENUE_CATERING", "SALAO_INTIMISTA", "2026-11-05", "A definir", "MANHA", "08:00", 100, "100", "Opção Topo Coffee Break Completo c/ caseirinhos e empadão (R$ 5.300,00) vs Opção Welcome Coffee (R$ 3.500,00)", 5300.0, 0, "ORCAMENTO"],
      ["#77", "Cliente 99984345733 (Grande Jantar)", "SOCIAL_CASAMENTO", "VENUE_CATERING", "SALAO_PRINCIPAL", "2026-11-21", "21/11/2026", "NOITE", "20:00", 250, "250", "4.000 salgados + Jantar para 250 pessoas (R$ 18.750) + bebidas e cozinha", 24110.0, 10000.0, "CONFIRMADO"],
      ["#78", "Feijoada + Pagode Recomeço", "SOCIAL_JANTAR", "VENUE_CATERING", "SALAO_INTIMISTA", "2026-10-25", "25/10/2026", "TARDE", "12:00", 60, "60", "Feijoada completa, Taça da Felicidade, Cerveja Stella Artois (R$ 3.080), espaço e Banda Pagode Recomeço (R$ 2.500) (Versão Jantar + Stella: R$ 15.870)", 10750.0, 5000.0, "CONFIRMADO"],
      ["#79", "Casamento & Jantar Premium 130p", "SOCIAL_CASAMENTO", "VENUE_CATERING", "SALAO_PRINCIPAL", "2026-09-19", "19/09/2026", "NOITE", "20:00", 130, "130", "Pacote Premium com escondidinho, camarão, patinha de caranguejo, jantar completo e sobremesas (Variantes de R$ 8.480 c/ Barman a R$ 15.790 cardápio triplo)", 14700.0, 14700.0, "REALIZADO"],
      ["#80", "Almoço Regional Maranhense", "SOCIAL_JANTAR", "VENUE_CATERING", "SALAO_INTIMISTA", "2026-10-17", "17/10/2026", "TARDE", "12:00", 32, "32", "Arroz de cuxá, arroz Maria Izabel, paçoca de carne, torta de camarão, vatapá, mingau de milho, bolo de tapioca e vitamina de bacuri/cajá", 2560.0, 1280.0, "EM_PRODUCAO"]
    ];

    const insOrc = db.prepare(`
      INSERT INTO eventos_orcamentos (
        numero_historico, cliente_nome, tipo_evento, modalidade_operacao, espaco_id,
        bloqueio_complexo_total, data_evento, data_exibicao, turno, hora_inicio,
        publico_estimado, publico_exibicao, resumo_servico, valor_total, valor_pago_sinal,
        status, token_proposta, pacote_ancoragem_escolhido, observacoes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insPacote = db.prepare(`
      INSERT INTO proposta_pacotes (
        evento_id, ordem_exibicao, tier, titulo, subtitulo, valor_total,
        valor_por_pessoa, destaque_ancoragem, itens_json, selecionado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const row of orcamentos72) {
      const [num, cli, tipo, mod, espaco, dataIso, dataExib, turno, hora, pubNum, pubExib, resumo, valTotal, valPago, status] = row;
      const cleanNum = num.replace("#", "").padStart(2, "0");
      const token = `delta-prop-${cleanNum}`;
      const r = insOrc.run(
        num, cli, tipo, mod, espaco, 0, dataIso, dataExib, turno, hora,
        pubNum, pubExib, resumo, valTotal, valPago, status, token, "OURO_EXECUTIVO",
        `Registro histórico consolidado ${num} (${cli})`
      );
      const eventoId = Number(r.lastInsertRowid);
      const pax = pubNum || 100;

      // Gera os 3 pacotes Top-Down (Efeito Ancoragem) para cada orçamento
      const topVal = Math.round(valTotal * 1.32);
      const midVal = valTotal;
      const baseVal = Math.round(valTotal * 0.78);

      insPacote.run(
        eventoId,
        1,
        "DIAMANTE_MASTER",
        "Pacote Diamante Royal · Experiência Completa (Top-Down Anchor)",
        "Cardápio Triplo de Proteínas + Ilha Gastronômica (Grazing Table) + Camarão/Patinha + Sobremesas em Taças + Lanche da Madrugada",
        topVal,
         +(topVal / pax).toFixed(2),
        "ANCORAGEM TOPO · MAIS COMPLETO",
        JSON.stringify([
          "Ilha Gastronômica (Queijo Brie c/ favo de mel, Coalho maçaricado, Chips artesanais e Ceviche)",
          "Volantes Premium (Camarão em panko, Patinha de caranguejo, Mini bombom de carne de sol, Dadinhos de tapioca)",
          "Jantar Premium: Medalhão de Filé em Crosta de Castanha + Costela Prensada ao Roti + Arroz ao Espumante c/ Amêndoas",
          "Sobremesas: Banoffee desconstruída em taças + Taça da Felicidade + Mini pudim c/ fava de baunilha",
          "Lanche da Madrugada: Mini hambúrgueres artesanais + Batata frita em cones",
          "Equipe Completa (Garçom Chefe + Garçons + Segurança + Fritadeira + Louças e Rechauds)"
        ]),
        0
      );

      insPacote.run(
        eventoId,
        2,
        "OURO_EXECUTIVO",
        "Pacote Ouro Delta · Escopo Recomendado na Proposta",
        resumo,
        midVal,
        +(midVal / pax).toFixed(2),
        "ESCOLHA IDEAL CUSTO-BENEFÍCIO",
        JSON.stringify([
          resumo,
          "Produção na Cozinha Central Delta com insumos selecionados e ficha técnica padronizada",
          "Louças, rechauds, garrafas térmicas e logística de expedição térmica inclusos",
          "Acompanhamento operacional e cronograma BEO sincronizado"
        ]),
        1
      );

      insPacote.run(
        eventoId,
        3,
        "ESSENCIAL_ENXUTO",
        "Pacote Essencial · Formato Enxuto",
        "Cardápio otimizado com foco em salgados tradicionais/assados, 1 proteína principal e serviço enxuto",
        baseVal,
        +(baseVal / pax).toFixed(2),
        "OPÇÃO ENXUTA DE ENTRADA",
        JSON.stringify([
          "Mix de salgados fritos tradicionais e assados de forno",
          "1 opção de prato quente ou estação de lanches/coffee break otimizada",
          "Bebidas não alcoólicas (sucos naturais e refrigerantes)",
          "Logística de entrega puntual"
        ]),
        0
      );
    }

    // 6. Gerar BEO (Banquet Event Order) e Checklists de Logística para os eventos ativos/confirmados/em produção
    const insBeo = db.prepare(`
      INSERT INTO beo_cronograma (evento_id, ordem, horario, setor, etapa, descricao_operacional, temperatura_alvo, responsavel, status_execucao)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insLog = db.prepare(`
      INSERT INTO logistica_expedicao (evento_id, equipamento, categoria_equipamento, especificacao_tecnica, quantidade, checked_saida, checked_retorno, observacao)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Eventos chave para BEO detalhado: #49 (17/10 Coffee Break), #70 (17/10 Café Regional), #80 (17/10 Almoço Regional), #12 (Thiago Macedo), #50 (Sinal R$ 1000), #77 (Grande Jantar 250p)
    const beoTargets = db.prepare(`
      SELECT id, numero_historico, cliente_nome, espaco_id, hora_inicio, resumo_servico, status
      FROM eventos_orcamentos
      WHERE numero_historico IN ('#49', '#70', '#80', '#12', '#50', '#69', '#77', '#78')
    `).all();

    for (const ev of beoTargets) {
      const isEmProducao = ev.status === "EM_PRODUCAO";
      insBeo.run(ev.id, 1, "T-180 min", "COZINHA_CENTRAL", "Mise-en-place e Pré-preparo Térmico", `Separação de insumos e pré-cocção para ${ev.numero_historico} (${ev.cliente_nome}): ${ev.resumo_servico}`, "Refrigeração 4°C / Cocção >74°C", "Chef Cozinha Central", isEmProducao ? "CONCLUIDO" : "PENDENTE");
      insBeo.run(ev.id, 2, "T-90 min", "LOGISTICA", "Acondicionamento em Hotboxes e Expedição", "Pré-aquecimento dos Hotboxes de polietileno/isopor de alta densidade e conferência de fogões modulares, rechauds e louças", "Hotbox >65°C / Frios <5°C", "Coord. Logística Delta", isEmProducao ? "EXPEDIDO" : "PENDENTE");
      insBeo.run(ev.id, 3, "T-30 min", "SALAO_GARCONS", "Montagem de Ilha / Recepção e Bebidas", "Montagem de estação de boas-vindas, Grazing Table / café regional, jarras de sucos naturais e garrafas térmicas", "Bebidas 2°C a 4°C", "Garçom Chefe / Maitre", isEmProducao ? "EM_PREPARO" : "PENDENTE");
      insBeo.run(ev.id, 4, `${ev.hora_inicio}`, "FRITURA", "Saída de Salgados Volantes & Entradas Quentes", "Fritura imediata em fogão modular de alta pressão (camarão em panko, patinha de caranguejo, coxinha gourmet, pastel c/ geleia)", "180°C óleo / Servir a 70°C", "Equipe de Fritura", "PENDENTE");
      insBeo.run(ev.id, 5, "T+60 min", "COZINHA_CENTRAL", "Serviço Principal (Jantar / Almoço / Buffet)", "Abastecimento de rechauds ou empratamento de proteínas (Medalhão de Filé / Costela ao Roti / Almoço Regional Maranhense) e arrozes especiais", "Acima de 65°C constante", "Chef Cozinha Central + Garçons", "PENDENTE");
      insBeo.run(ev.id, 6, "T+120 min", "CONFEITARIA", "Saída de Sobremesas & Lanche da Madrugada", "Serviço de Banoffee desconstruída em taças, Taça da Felicidade, mini pudim de baunilha e saída de mini hambúrgueres com batata em cones", "Taças 4°C / Burgers 68°C", "Confeitaria & Copa", "PENDENTE");

      insLog.run(ev.id, "Hotbox Térmico de Polietileno / Isopor de Alta Densidade (GN 1/1)", "HOTBOX_TERMICO", "Isolamento térmico de poliuretano/alta densidade para retenção acima de 65°C por até 4h", 3, isEmProducao ? 1 : 0, 0, "Conferir travas e vedação de borracha");
      insLog.run(ev.id, "Fogão Modular de Alta Pressão (2 Bocas Industriais + Mangueira Normatizada)", "COZINHA_MODULAR", "Queimadores duplos de alta pressão para fritura in-loco e finalização rápida", 2, isEmProducao ? 1 : 0, 0, "Levar botijão P13 lacrado + regulador industrial");
      insLog.run(ev.id, "Cooktop / Módulo de Indução Portátil de Finalização", "COZINHA_MODULAR", "Módulo 220V para redução de molhos (Roti, Brie c/ Alho-Poró, Mostarda Ancienne) no salão", 2, isEmProducao ? 1 : 0, 0, "Uso sem chama aberta no Salão Intimista/Principal");
      insLog.run(ev.id, "Conjunto de Rechauds Inox + Cubas GN + Louças e Talheres Finos", "RECHAUD_LOUCA", "Rechauds completos com álcool gel combustível e jogo de porcelana/taças", 6, isEmProducao ? 1 : 0, 0, "Conferir contagem na saída e no retorno");
      insLog.run(ev.id, "Kit Garrafas Térmicas Inox + Jarras de Vidro + Suqueira", "RECHAUD_LOUCA", "Identificadas (Café c/ açúcar, Café s/ açúcar, Chocolate Quente, Sucos Naturais)", 4, isEmProducao ? 1 : 0, 0, "Etiquetas de identificação revisadas");
    }

    // 7. Módulo Corporativo B2B (Cotas de Patrocínio Master/Padrão/Apoio, Estandes e Editais Sebrae)
    const insB2B = db.prepare(`
      INSERT INTO b2b_cotas_estandes (evento_id, nome_projeto, tipo_cota, empresa_parceira, valor_cota, status_comercial, contrapartidas)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insB2B.run(15, "Feira Regional de Gastronomia & Food Service do Vale do Mearim", "EDITAL_SEBRAE", "Sebrae Maranhão (Unidade Regional Bacabal)", 45000.0, "FECHADO", "Viabilização via edital de fomento, auditório no Salão Principal (500p), arena gastronômica e rodadas de negócios.");
    insB2B.run(15, "Feira Regional de Gastronomia & Food Service do Vale do Mearim", "PATROCINIO_MASTER", "Distribuidora Vale Alimentos / Biorim", 15000.0, "PAGO", "Logo Master no pórtico de entrada, estande ilha 6x4m no Salão Principal, palestra magna de 40 min e 100 Kits Lanche Acrílicos personalizados.");
    insB2B.run(15, "Feira Regional de Gastronomia & Food Service do Vale do Mearim", "PATROCINIO_PADRAO", "Banco Inter Empresas / Maquininhas", 7500.0, "FECHADO", "Estande esquina 4x3m, inserção de marca no Coffee Break Corporativo e credenciamento VIP.");
    insB2B.run(15, "Feira Regional de Gastronomia & Food Service do Vale do Mearim", "PATROCINIO_APOIO", "Gráfica & Embalagens Mearim", 3000.0, "PROPOSTA_ENVIADA", "Balcão de ativação 2x2m, menção pelo mestre de cerimônias e logo nos totens digitais.");
    insB2B.run(15, "Feira Regional de Gastronomia & Food Service do Vale do Mearim", "ESTANDE_FEIRA", "Lote de 12 Estandes Modulares (Salão Principal)", 24000.0, "FECHADO", "12 estandes de R$ 2.000,00 cada com ponto elétrico 220V, iluminação LED, credenciais de expositor e acesso ao lounge B2B.");

    // 8. Registros Fiscais NFS-e Padrão (NBS 103013100 + IBS/CBS Opção 1)
    const insFiscal = db.prepare(`
      INSERT INTO fiscal_nfse (
        evento_id, numero_rps, tomador_nome, tomador_documento, codigo_nbs, descricao_nbs,
        regime_apuracao, classificacao_ibs_cbs, valor_servico, aliquota_estimada_pct,
        valor_tributo_estimado, discriminacao_nota, status_emissao
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insFiscal.run(
      73,
      "RPS-2026-0073",
      "Universidade Federal do Maranhão - UFMA (Campus Bacabal)",
      "06.279.103/0001-19",
      "103013100",
      "Fornecimento de alimentação para eventos",
      "Simples Nacional",
      "Opção 1 - Operação Padrão Tributada (Simples Nacional)",
      35000.0,
      6.0,
      2100.0,
      "Fornecimento de alimentação corporativa (Lanche da Manhã e Lanche da Tarde para 70 participantes/dia durante 5 dias - 13/04 a 17/04). NBS 103013100. Dados Bancários: Banco Inter (077) Ag 0001 Cc 42997585-6 - CNPJ 06.328.111/0001-08.",
      "EMITIDA"
    );
    insFiscal.run(
      10,
      "RPS-2026-0010",
      "Biorim Serviços Médicos Ltda",
      "12.450.900/0001-19",
      "103013100",
      "Fornecimento de alimentação para eventos",
      "Simples Nacional",
      "Opção 1 - Operação Padrão Tributada (Simples Nacional)",
      4405.0,
      6.0,
      264.3,
      "Fornecimento de coquetel e coffee break corporativo para 150 pessoas (1.500 salgados fritos, 750 salgados finos, lanches variados, salada de frutas e sucos naturais). NBS 103013100.",
      "EMITIDA"
    );
    insFiscal.run(
      74,
      "RPS-2026-0074",
      "Malwee Malhas Ltda",
      "84.429.737/0001-14",
      "103013100",
      "Fornecimento de alimentação para eventos",
      "Simples Nacional",
      "Opção 1 - Operação Padrão Tributada (Simples Nacional)",
      2700.0,
      6.0,
      162.0,
      "Serviço de organização de evento corporativo em salão climatizado (3 diárias - 21 a 23/01/2026) com fornecimento de 3 serviços de Coffee Break. NBS 103013100.",
      "EMITIDA"
    );

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return db;
}

module.exports = { initAndSeedDatabase };
