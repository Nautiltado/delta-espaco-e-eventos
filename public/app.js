// ============================================================================
// DELTA ESPAÇO E EVENTOS — SITE COMERCIAL REFATORADO (6 BLOCOS PRINCIPAIS + PÁGINAS INTERNAS)
// ============================================================================

const CONFIG_DELTA = {
  name: "Delta Espaço e Eventos",
  brandSubtitle: "Espaço de Eventos, Buffet & Alimentação Corporativa",
  instagramHandle: "@delta_eventos_e_buffet",
  instagramUrl: "https://www.instagram.com/delta_eventos_e_buffet/",
  phoneFormatted: "(99) 98152-2414",
  phoneRaw: "5599981522414",
  address: "Rua Rui Barbosa, 373, Centro",
  city: "Bacabal – MA",
  cep: "65700-000",
  fullAddress: "Rua Rui Barbosa, 373, Centro, Bacabal – MA, CEP 65700-000",
  googleRating: "4.6",
  googleReviewCount: 60,
  googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=Rua+Rui+Barbosa+373+Centro+Bacabal+MA",
  wazeUrl: "https://waze.com/ul?q=Rua+Rui+Barbosa+373+Centro+Bacabal+MA",
  hoursNote: "Atendimento comercial e visitas presenciais mediante agendamento via WhatsApp."
};

function isIllustrativeImage(src) {
  return typeof src === "string" && src.includes("images.unsplash.com");
}

// 1. ESPAÇOS FÍSICOS CONCISOS (DADOS REAIS DA EMPRESA)
const AMBIENTES_ESPACO = [
  {
    id: "delta-royal",
    title: "Delta Royal",
    subtitle: "Capacidade para 400 a 500 pessoas",
    tag: "Grandes Eventos & Feiras",
    description:
      "Espaço maior amplo e 100% climatizado, ideal para casamentos, formaturas, bailes de 15 anos, convenções e feiras corporativas em Bacabal.",
    image: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=80",
    highlights: [
      "Capacidade para 400 a 500 convidados com circulação confortável",
      "Cadeiras e mesas de plástico, base de metal retrátil e tampão de madeira",
      "Atendido diretamente pela Cozinha Central Delta"
    ]
  },
  {
    id: "delta-corporate",
    title: "Delta Corporate",
    subtitle: "Capacidade para até 100 pessoas",
    tag: "Corporativo & Celebrações Reservadas",
    description:
      "Segundo espaço físico independente do complexo, compartilhando a mesma cozinha central. Dimensionado para treinamentos, reuniões empresariais, masterclasses e eventos familiares.",
    image: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80",
    highlights: [
      "Capacidade para até 100 participantes em formato auditório ou mesas",
      "Operação independente (permite eventos simultâneos no complexo)",
      "Estrutura ideal para coffee breaks, almoços executivos e capacitações"
    ]
  },
  {
    id: "escadaria-e-cenografia",
    title: "Escadaria & Área de Bolos",
    subtitle: "Estrutura integrada ao salão",
    tag: "Recepção & Cenografia",
    description:
      "Escadaria interna para entradas solenes e área dedicada à composição da mesa principal de bolos e doces finos.",
    image: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80",
    highlights: [
      "Acesso para entrada solene em casamentos, 15 anos e formaturas",
      "Área de destaque para mesa de bolo e confeitaria",
      "Integração direta entre cerimônia, recepção e jantar no mesmo local"
    ]
  }
];

// 2. BUFFET ORGANIZADO EM 4 CATEGORIAS (VISIBILIDADE EQUIVALENTE CORPORATIVO & SOCIAL)
const BUFFET_CATEGORIAS = [
  {
    id: "coffee-break",
    badge: "Corporativo & Institucional",
    title: "Coffee Break",
    description:
      "Soluções práticas e pontuais para treinamentos, reuniões empresariais, eventos Sebrae, palestras e encontros de gestão no espaço ou externos.",
    items: [
      "Pão italiano recheado, sanduíches naturais, pão sírio e empadão de frango",
      "Salgados de forno e fritura, pão de queijo e bolos regionais (macaxeira, milho, tapioca)",
      "Salada de frutas, sucos naturais, refrigerantes, café e chocolate quente",
      "Opção de Kits Lanche Corporativos individuais em caixa acrílica selada"
    ]
  },
  {
    id: "almocos-jantares",
    badge: "Eventos Sociais & Empresariais",
    title: "Almoços e Jantares",
    description:
      "Cardápios completos preparados na Cozinha Central Delta para recepções, confraternizações de empresas, formaturas e casamentos.",
    items: [
      "Carnes: Filé bovino (madeira, demiglace, mostarda ou gorgonzola), costela e fraldinha",
      "Aves e Peixes: Frango à delícia, filé de pescada ao molho de camarão e peixe à delícia",
      "Arrozes e Guarnições: Arroz festivo, arroz de cuxá, Maria Izabel, farofas e saladas",
      "Opção de Feijoada Completa com acompanhamentos tradicionais"
    ]
  },
  {
    id: "coqueteis-salgados",
    badge: "Recepção & Serviço Volante",
    title: "Coquetéis e Salgados",
    description:
      "Salgados fritos na hora, assados finos e ilha gastronômica (Grazing Table) para recepções dinâmicas, coquetéis de lançamento e festas.",
    items: [
      "Salgados tradicionais: Coxinha de frango, bolinha de queijo, quibe e pastel com geleia",
      "Especiais: Camarão empanado, patinha de caranguejo, barquetes e mini quiches",
      "Ilha Gastronômica: Queijo brie com mel, frios, antepastos, caponata e pães",
      "Caldos, cremes na tacinha (camarão/galinha) e mini hambúrgueres"
    ]
  },
  {
    id: "doces-confeitaria",
    badge: "Confeitaria Própria",
    title: "Doces e Confeitaria",
    description:
      "Sobremesas empratadas ou em taças, docinhos tradicionais e confeitaria para encerrar almoços, jantares e celebrações.",
    items: [
      "Sobremesas: Taça da Felicidade, Banoffee, Delícia de Abacaxi e pudim tradicional/zero lactose",
      "Mousses: Maracujá, cajá e limão siciliano",
      "Docinhos de festa: Brigadeiro, segredo de uva, olho de sogra e bem-vivido",
      "Bolos confeitados, caseirinhos e tortas doces sob encomenda"
    ]
  }
];

// 3. TIPOS DE EVENTOS (TRANSFERIDOS PARA PÁGINA INTERNA #/eventos PARA NÃO POLUIR A HOME)
const TIPOS_EVENTOS = [
  {
    id: "eventos-corporativos",
    title: "Encontros Corporativos, Treinamentos & Feiras",
    category: "B2B & Institucional",
    description:
      "Estrutura no Delta Royal (até 500p) ou Delta Corporate (até 100p) para treinamentos empresariais, projetos Sebrae, feiras de negócios e confraternizações com emissão de NFS-e.",
    image: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=900&q=80",
    features: [
      "Espaços Delta Royal ou Delta Corporate climatizados",
      "Coffee break completo ou Kits Lanche em caixa acrílica",
      "Almoços e jantares executivos para equipes",
      "Emissão de NFS-e (Código NBS 103013100)"
    ]
  },
  {
    id: "casamentos",
    title: "Casamentos & Recepções",
    category: "Eventos Sociais",
    description:
      "Cerimônia e recepção integradas no mesmo espaço climatizado, com escadaria interna, mesas e cadeiras inclusas e buffet completo de jantar ou coquetel.",
    image: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=900&q=80",
    features: [
      "Cerimônia e recepção no mesmo local",
      "Escadaria para entrada solene",
      "Jantar completo, ilha gastronômica e doces",
      "Acomodação para até 500 convidados no Delta Royal"
    ]
  },
  {
    id: "formaturas",
    title: "Formaturas & Aulas da Saudade",
    category: "Eventos Acadêmicos",
    description:
      "Espaço versátil para colação de grau, Aula da Saudade no Delta Corporate ou grande baile de formatura no Delta Royal.",
    image: "https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=900&q=80",
    features: [
      "Formatos no Delta Corporate (até 100p) ou Delta Royal (até 500p)",
      "Serviço de jantar, coquetel volante e lanche da madrugada",
      "Mesas com tampão de madeira e bases retráteis",
      "Localização central de fácil acesso em Bacabal"
    ]
  },
  {
    id: "15-anos",
    title: "Bailes de 15 Anos",
    category: "Eventos Sociais",
    description:
      "Recepção completa com entrada pela escadaria, espaço para pista de dança e cardápio personalizado com coquetel, jantar e sobremesas.",
    image: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=900&q=80",
    features: [
      "Escadaria para entrada da debutante",
      "Coquetel de salgados, finger foods e doces",
      "Ambiente 100% climatizado",
      "Apoio operacional durante todo o evento"
    ]
  },
  {
    id: "aniversarios-bodas",
    title: "Aniversários, Bodas & Celebrações Familiares",
    category: "Eventos Sociais",
    description:
      "Almoços festivos, feijoadas completas, jantares ou coquetéis para comemorar aniversários e bodas com conforto térmico e buffet próprio.",
    image: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=900&q=80",
    features: [
      "Opções de almoço, feijoada, coquetel ou jantar",
      "Delta Corporate (até 100p) ou Delta Royal (até 500p)",
      "Bolos, tortas, salgados e doces próprios",
      "Mesas e cadeiras inclusas na locação"
    ]
  },
  {
    id: "catering-externo",
    title: "Buffet Externo & Encomendas Corporativas",
    category: "Catering & Entrega",
    description:
      "Fornecimento de coffee breaks, refeições, salgados, doces e kits lanche para eventos realizados na sede da sua empresa ou instituição em Bacabal.",
    image: "https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=900&q=80",
    features: [
      "Transporte térmico em Hotboxes de alta densidade",
      "Kits Lanche em caixa acrílica selada",
      "Coffee breaks montados no local do cliente",
      "Atendimento para empresas, bancos, órgãos e escolas"
    ]
  }
];

// 4. REGISTRO VISUAL (6 EXIBIDOS NA HOME + GALERIA COMPLETA NA PÁGINA INTERNA #/galeria)
let GALERIA_FOTOS = [
  {
    id: "gal-1",
    title: "Delta Royal (400 a 500 Pessoas)",
    category: "Delta Royal",
    image: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1000&q=80",
    extraImages: [],
    description: "Espaço maior climatizado para grandes recepções sociais, formaturas e feiras corporativas.",
    fullContent: `O espaço Delta Royal comporta de 400 a 500 pessoas com conforto térmico e excelente circulação.\n\nDisponibilizamos cadeiras e mesas de plástico, além de bases de metal retráteis e tampões de madeira para configurar o salão de acordo com o formato do seu evento — seja jantar, coquetel ou auditório corporativo.`
  },
  {
    id: "gal-2",
    title: "Coffee Break & Kits Lanche Corporativos",
    category: "Buffet & Gastronomia",
    image: "https://images.unsplash.com/photo-1505236858219-8359eb29e329?auto=format&fit=crop&w=1000&q=80",
    extraImages: [],
    description: "Mesas de coffee break, salgados, bolos regionais, sucos naturais e kits em caixa acrílica.",
    fullContent: `Atendemos empresas, treinamentos, encontros de gestão e projetos institucionais (como Sebrae) com coffee breaks completos e pontuais.\n\nO cardápio inclui pão italiano recheado, sanduíches naturais, pão sírio, empadão de frango, coxinha, empadinha, bolinha de queijo, pão de queijo, bolos regionais, salada de frutas, sucos, café e chocolate quente, além da opção de Kits Lanche em caixa acrílica selada.`
  },
  {
    id: "gal-3",
    title: "Almoços, Jantares & Pratos Principais",
    category: "Buffet & Gastronomia",
    image: "https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1000&q=80",
    extraImages: [],
    description: "Gastronomia própria com carnes, aves, peixes, arrozes especiais e feijoada para eventos.",
    fullContent: `Nossa Cozinha Central prepara refeições completas para almoços e jantares de negócios, confraternizações, casamentos e formaturas.\n\nServimos filé bovino (aos molhos madeira, demiglace, mostarda, gorgonzola ou parmegiana), frango à delícia, filé de pescada ao molho de camarão, arrozes especiais (festivo, cuxá, Maria Izabel, primavera) e saladas nobres.`
  },
  {
    id: "gal-4",
    title: "Delta Corporate & Eventos Empresariais",
    category: "Delta Corporate",
    image: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1000&q=80",
    extraImages: [],
    description: "Espaço reservado para até 100 pessoas, ideal para reuniões, palestras e celebrações intimistas.",
    fullContent: `O espaço Delta Corporate acomoda até 100 pessoas com total independência do Delta Royal, permitindo locação exclusiva para treinamentos, workshops, aulas da saudade, batizados e aniversários.\n\nO ambiente é totalmente climatizado e atendido diretamente pela nossa Cozinha Central.`
  },
  {
    id: "gal-5",
    title: "Escadaria & Cenário para Fotos",
    category: "Escadaria",
    image: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1000&q=80",
    extraImages: [],
    description: "Estrutura de escadaria interna para entrada solene e registros fotográficos.",
    fullContent: `A escadaria interna do salão permite entradas solenes em casamentos, festas de 15 anos e formaturas, integrando cerimônia e recepção no mesmo ambiente climatizado no Centro de Bacabal.`
  },
  {
    id: "gal-6",
    title: "Doces, Sobremesas & Confeitaria",
    category: "Mesa de Doces",
    image: "https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=1000&q=80",
    extraImages: [],
    description: "Taça da Felicidade, Banoffee, pudins, mousses, docinhos de festa e bolos.",
    fullContent: `Produzimos sobremesas e doces para eventos sociais e corporativos: Taça da Felicidade, Banoffee, Delícia de Abacaxi, pudins, mousses (maracujá, cajá, limão siciliano) e docinhos tradicionais (brigadeiro, segredo de uva, olho de sogra e bem-vivido).`
  },
  {
    id: "gal-7",
    title: "Mesa de Bolos & Doces Finos",
    category: "Mesa de Doces",
    image: "https://images.unsplash.com/photo-1532712938310-34cb3982ef74?auto=format&fit=crop&w=1000&q=80",
    extraImages: [],
    description: "Área dedicada à montagem da mesa principal de bolo e doces.",
    fullContent: `Espaço planejado no salão para destacar a mesa do bolo e doces finos com excelente iluminação e espaço para fotos com os convidados.`
  },
  {
    id: "gal-8",
    title: "Montagem de Mesas com Tampão de Madeira",
    category: "Delta Royal",
    image: "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1000&q=80",
    extraImages: [],
    description: "Cadeiras e mesas de plástico, bases de metal retráteis e tampão de madeira inclusos.",
    fullContent: `Disponibilizamos cadeiras e mesas de plástico, além de bases de metal retráteis com tampão de madeira para acomodar seus convidados com praticidade e organização.`
  }
];

const OPCOES_SERVICO_ORCAMENTO = [
  "Espaço + Buffet Completo (Almoço, Jantar ou Coquetel)",
  "Somente Locação do Espaço Climatizado (Delta Royal ou Corporate)",
  "Encomenda de Salgados Fritos, Doces & Confeitaria",
  "Coffee Break / Kits Lanche Corporativos",
  "Buffet / Refeição para Evento Corporativo"
];

// 5. CARDÁPIO DE SALGADOS FRITOS & ENCOMENDAS RÁPIDAS (PRONTO PARA IMAGEM OFICIAL + LISTA INTERATIVA)
const STORAGE_KEY_CARDAPIO_SALGADOS = "delta_cardapio_salgados_v1";
const STORAGE_KEY_KANBAN_LEADS = "delta_whatsapp_kanban_v1";
const STORAGE_KEY_IGNORED_CONTACTS = "delta_whatsapp_ignored_v1";

let CARDAPIO_SALGADOS = {
  menuImages: [], // Imagens do cardápio pronto enviadas pelo Leonardo
  observacaoTopo: "Encomendas de salgados fritos na hora, assados e doces. Escolha os itens abaixo ou consulte a imagem do nosso cardápio oficial:",
  items: [
    { id: "salg-1", nome: "Cento de Salgados Fritos Sortidos (Tradicionais)", unidade: "Cento (100 un.)", categoria: "Salgados Fritos", precoTexto: "Consultar valor do cento", desc: "Coxinha de frango, bolinha de queijo, quibe tradicional e pastelzinho." },
    { id: "salg-2", nome: "Meio Cento de Salgados Fritos (50 unidades)", unidade: "50 unidades", categoria: "Salgados Fritos", precoTexto: "Consultar valor", desc: "Ideal para reuniões rápidas, lanches da tarde e pequenas comemorações." },
    { id: "salg-3", nome: "Coxinha de Frango Tradicional (Frita na Hora)", unidade: "Porção / Cento", categoria: "Salgados Fritos", precoTexto: "Sob encomenda", desc: "Massa leve e crocante com recheio temperado da Cozinha Central Delta." },
    { id: "salg-4", nome: "Bolinha de Queijo / Misto / Presunto e Queijo", unidade: "Porção / Cento", categoria: "Salgados Fritos", precoTexto: "Sob encomenda", desc: "Fritos na hora para retirada na Delta ou entrega combinada." },
    { id: "salg-5", nome: "Pastel de Carne com Geleia / Quibe Frito", unidade: "Porção / Cento", categoria: "Salgados Fritos", precoTexto: "Sob encomenda", desc: "Opções clássicas para festas, aniversários e coffee breaks." },
    { id: "salg-6", nome: "Salgados Finos & Especiais (Camarão, Caranguejo, Quiches)", unidade: "Porção / Cento", categoria: "Especiais & Forno", precoTexto: "Sob encomenda", desc: "Camarão empanado, patinha de caranguejo, barquetes, empadinhas e mini quiches." },
    { id: "salg-7", nome: "Empadão de Frango / Pão Italiano Recheado", unidade: "Unidade / Forma", categoria: "Especiais & Forno", precoTexto: "Sob encomenda", desc: "Assados na nossa confeitaria para lanches, famílias e empresas." },
    { id: "salg-8", nome: "Docinhos Tradicionais & Sobremesas (Brigadeiro, Bem-Vivido, Taças)", unidade: "Cento / Unidade", categoria: "Doces & Confeitaria", precoTexto: "Sob encomenda", desc: "Brigadeiro, olho de sogra, segredo de uva, Taça da Felicidade e Banoffee." }
  ]
};

// 6. ETIQUETAS OFICIAIS DO FUNIL DE WHATSAPP (KANBAN DO PROPRIETÁRIO)
const KANBAN_ETIQUETAS = [
  {
    id: "fazer_orcamento",
    nome: "Fazer Orçamento",
    emoji: "🟡",
    bg: "#fef9c3",
    border: "#fde047",
    text: "#854d0e",
    desc: "Clientes pedindo orçamento de Espaço (Delta Royal / Corporate) ou Buffet"
  },
  {
    id: "orcamento_aprovacao",
    nome: "Orçamento para Aprovação",
    emoji: "🔵",
    bg: "#dbeafe",
    border: "#93c5fd",
    text: "#1e40af",
    desc: "Proposta já enviada ao cliente — aguardando retorno/aprovação"
  },
  {
    id: "aprovado",
    nome: "Aprovado",
    emoji: "🟢",
    bg: "#dcfce7",
    border: "#86efac",
    text: "#166534",
    desc: "Evento, buffet ou encomenda fechada e confirmada"
  },
  {
    id: "encomenda_salgados",
    nome: "Encomenda de Salgados",
    emoji: "🟠",
    bg: "#ffedd5",
    border: "#fdba74",
    text: "#9a3412",
    desc: "Frente rápida: pedidos de salgados fritos, doces e retiradas"
  },
  {
    id: "fornecer_informacoes",
    nome: "Fornecer Informações (Cardápio / Fotos)",
    emoji: "🟣",
    bg: "#f3e8ff",
    border: "#d8b4fe",
    text: "#6b21a8",
    desc: "Solicitou cardápio de salgados ou fotos dos espaços Delta Royal / Corporate"
  },
  {
    id: "fornecedor_parente",
    nome: "Fornecedor / Parente (Robô Pausado)",
    emoji: "⚪",
    bg: "#f5f5f4",
    border: "#d6d3d1",
    text: "#44403c",
    desc: "Contatos pessoais e fornecedores ignorados pelo robô automático"
  }
];

let KANBAN_LEADS = [
  {
    id: "lead-1",
    nome: "Cliente Exemplo — Casamento (250p)",
    telefone: "(99) 98111-0000",
    etiqueta: "fazer_orcamento",
    resumo: "Pediu orçamento para Delta Royal + Buffet Completo em Novembro.",
    dataHora: "Hoje, 10:15"
  },
  {
    id: "lead-2",
    nome: "Encomenda Rápida — Salgados Fritos",
    telefone: "(99) 98222-0000",
    etiqueta: "encomenda_salgados",
    resumo: "Pediu cardápio de salgados fritos (2 centos sortidos para sábado às 17h).",
    dataHora: "Hoje, 10:40"
  },
  {
    id: "lead-3",
    nome: "Treinamento Corporativo (80p)",
    telefone: "(99) 98333-0000",
    etiqueta: "orcamento_aprovacao",
    resumo: "Proposta enviada para locação do Delta Corporate + Coffee Break.",
    dataHora: "Ontem"
  },
  {
    id: "lead-4",
    nome: "Consulta Fotos dos Espaços",
    telefone: "(99) 98444-0000",
    etiqueta: "fornecer_informacoes",
    resumo: "Robô enviou link das fotos do Delta Royal, Delta Corporate e Cardápio.",
    dataHora: "Hoje, 09:20"
  }
];

let IGNORED_CONTACTS = [
  { id: "ig-1", nome: "Fornecedor Bebidas / Gelo", telefone: "(99) 99999-1111", tipo: "Fornecedor" },
  { id: "ig-2", nome: "Contato Familiar (Parente)", telefone: "(99) 99999-2222", tipo: "Parente / Pessoal" }
];

// ÍCONES SVG LUCIDE
const ICONS = {
  mapPin: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="CLASSES"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>`,
  wind: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="CLASSES"><path d="M12.8 19.6A2 2 0 1 0 14 16H2"/><path d="M17.5 8a2.5 2.5 0 1 1 2 4H2"/><path d="M9.8 4.4A2 2 0 1 1 11 8H2"/></svg>`,
  instagram: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="CLASSES"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>`,
  phone: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="CLASSES"><path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/></svg>`,
  chevronRight: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="CLASSES"><path d="m9 18 6-6-6-6"/></svg>`,
  chevronLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="CLASSES"><path d="m15 18-6-6 6-6"/></svg>`,
  menu: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="CLASSES"><path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h16"/></svg>`,
  x: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="CLASSES"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
  star: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="CLASSES"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>`,
  messageCircle: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="CLASSES"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/></svg>`,
  sparkles: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="CLASSES"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/></svg>`,
  circleCheck: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="CLASSES"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`,
  utensils: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="CLASSES"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`,
  building2: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="CLASSES"><path d="M10 12h4"/><path d="M10 8h4"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"/><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/></svg>`,
  arrowUpRight: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="CLASSES"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>`,
  users: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="CLASSES"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/></svg>`,
  calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="CLASSES"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>`,
  clock: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="CLASSES"><path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="10"/></svg>`,
  compass: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="CLASSES"><path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/><circle cx="12" cy="12" r="10"/></svg>`,
  send: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="CLASSES"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></svg>`,
  check: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="CLASSES"><path d="M20 6 9 17l-5-5"/></svg>`,
  copy: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="CLASSES"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`
};

function icon(name, cls = "w-4 h-4") {
  return (ICONS[name] || ICONS.sparkles).replace("CLASSES", cls);
}

function getWhatsAppUrl(customMsg) {
  const msg =
    customMsg ||
    "Olá equipe Delta Espaço e Eventos! Gostaria de consultar disponibilidade e solicitar um orçamento em Bacabal.";
  return `https://wa.me/${CONFIG_DELTA.phoneRaw}?text=${encodeURIComponent(msg)}`;
}

// ESTADO GLOBAL
window.state = {
  isAdminAuthenticated: false,
  adminPreviewAsClient: false,
  adminLoginModalOpen: false,
  mobileMenuOpen: false,
  activeSection: "espaco",
  espacoTabIndex: 0,
  galeriaFilter: "Todos",

  // Páginas Internas (#/registro/:id, #/eventos, #/galeria)
  activeRegistroId: null,
  activeRegistroPhotoIndex: 0,
  internalPage: null, // "eventos" | "galeria" | null

  // Editor do Registro Visual
  galeriaManagerOpen: false,
  galeriaEditorItem: null,

  // Triagem Inteligente WhatsApp, Cardápio de Salgados & Kanban do Proprietário
  triageModalOpen: false,
  salgadosMenuModalOpen: false,
  salgadosCart: {},
  salgadosDataEntrega: "",
  salgadosNomeCliente: "",
  salgadosObs: "",
  botKanbanModalOpen: false,
  botKanbanActiveTab: "kanban", // "kanban" | "robo" | "cardapio" | "fornecedores"
  botSimMessages: [
    {
      from: "bot",
      text: "Olá! Bem-vindo(a) à *Delta Espaço e Eventos* 🏛️✨\nSou o assistente virtual da Delta. Para agilizar seu atendimento, digite o número da opção desejada:\n\n1️⃣ *Encomendar Salgados Fritos / Ver Cardápio Pronto*\n2️⃣ *Fazer Orçamento de Espaço (Delta Royal ou Corporate) / Buffet*\n3️⃣ *Ver Fotos dos Espaços & Informações*\n4️⃣ *Sou Fornecedor / Assunto Administrativo*"
    }
  ],

  // Formulário de Orçamento Simplificado
  formServico: OPCOES_SERVICO_ORCAMENTO[0],
  formDataPrevisao: "",
  formConvidados: "100 a 150 pessoas",
  formNome: "",
  formContato: "",
  formObservacoes: "",
  generatedWhatsAppUrl: null,
  copiedSuccess: false
};

// ============================================================================
// AUTENTICAÇÃO DO MODO EDITOR & PERSISTÊNCIA DO REGISTRO VISUAL
// ============================================================================
const STORAGE_KEY_GALERIA = "delta_galeria_custom_v1";
const ADMIN_SESSION_KEY = "delta_admin_logged_in";
const ADMIN_PASSWORD_DEFAULT = "delta2026";

function isEditorMode() {
  return Boolean(window.state.isAdminAuthenticated && !window.state.adminPreviewAsClient);
}

window.promptAdminLogin = function () {
  window.state.adminLoginModalOpen = true;
  renderAdminLoginModal();
};

window.closeAdminLoginModal = function () {
  window.state.adminLoginModalOpen = false;
  renderAdminLoginModal();
};

window.confirmAdminPassword = function () {
  const input = document.getElementById("deltaAdminPassInput");
  const val = input ? input.value.trim() : "";
  if (val === ADMIN_PASSWORD_DEFAULT) {
    window.state.isAdminAuthenticated = true;
    window.state.adminPreviewAsClient = false;
    window.state.adminLoginModalOpen = false;
    try {
      sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
    } catch (_) {}
    renderFullApp();
    renderRegistroDedicatedPage();
    renderInternalSubpage();
  } else {
    alert("Senha incorreta! Digite a senha do administrador.");
  }
};

window.setAdminViewMode = function (previewAsClient) {
  window.state.adminPreviewAsClient = Boolean(previewAsClient);
  renderFullApp();
  renderRegistroDedicatedPage();
  renderInternalSubpage();
};

window.logoutAdminMode = function () {
  window.state.isAdminAuthenticated = false;
  window.state.adminPreviewAsClient = false;
  try {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
  } catch (_) {}
  if (window.location.search.includes("admin")) {
    history.replaceState(null, "", window.location.pathname + window.location.hash);
  }
  renderFullApp();
  renderRegistroDedicatedPage();
  renderInternalSubpage();
};

function renderAdminLoginModal() {
  const modalEl = document.getElementById("adminLoginModalRoot");
  if (!modalEl) return;
  if (!window.state.adminLoginModalOpen) {
    modalEl.innerHTML = "";
    return;
  }
  modalEl.innerHTML = `
    <div class="delta-editor-backdrop" onclick="window.closeAdminLoginModal()">
      <div class="delta-editor-modal" style="max-width: 420px;" onclick="event.stopPropagation()">
        <div class="delta-editor-header">
          <div>
            <h3>🔒 Acesso do Editor (Delta)</h3>
            <p>Área exclusiva para alterar fotos e páginas do site.</p>
          </div>
          <button type="button" onclick="window.closeAdminLoginModal()" class="delta-reg-back-btn" style="padding: 6px 10px;">
            ${icon("x", "w-4 h-4")}
          </button>
        </div>
        <div class="delta-editor-body">
          <div>
            <label class="delta-editor-label">Senha do Administrador</label>
            <input
              id="deltaAdminPassInput"
              type="password"
              placeholder="Digite sua senha..."
              class="delta-editor-input"
              onkeydown="if(event.key==='Enter') window.confirmAdminPassword()"
              autofocus
            />
          </div>
          <button
            type="button"
            onclick="window.confirmAdminPassword()"
            class="delta-action-btn-primary"
            style="width: 100%; justify-content: center; padding: 12px;"
          >
            Entrar no Modo Editor
          </button>
        </div>
      </div>
    </div>
  `;
}

function migrateGaleriaSpaceNames(items) {
  if (!Array.isArray(items)) return items;
  return items.map(item => {
    const copy = { ...item };
    if (copy.title) {
      copy.title = copy.title
        .replace(/Salão Principal/g, "Delta Royal")
        .replace(/Salão Intimista/g, "Delta Corporate");
    }
    if (copy.category) {
      copy.category = copy.category
        .replace(/Salão Principal/g, "Delta Royal")
        .replace(/Salão Intimista/g, "Delta Corporate");
    }
    if (copy.fullContent) {
      copy.fullContent = copy.fullContent
        .replace(/Salão Principal/g, "Delta Royal")
        .replace(/Salão Intimista/g, "Delta Corporate");
    }
    return copy;
  });
}

async function loadSavedGaleriaData() {
  try {
    const res = await fetch("./galeria-data.json?t=" + Date.now(), { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) {
        GALERIA_FOTOS = migrateGaleriaSpaceNames(json);
        localStorage.setItem(STORAGE_KEY_GALERIA, JSON.stringify(GALERIA_FOTOS));
        return;
      }
    }
  } catch (_) {}

  try {
    const saved = localStorage.getItem(STORAGE_KEY_GALERIA);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        GALERIA_FOTOS = migrateGaleriaSpaceNames(parsed);
        localStorage.setItem(STORAGE_KEY_GALERIA, JSON.stringify(GALERIA_FOTOS));
      }
    }
  } catch (_) {}
}

async function saveGaleriaDataToSite(newItems) {
  GALERIA_FOTOS = newItems;
  try {
    localStorage.setItem(STORAGE_KEY_GALERIA, JSON.stringify(GALERIA_FOTOS));
  } catch (_) {}

  try {
    await fetch("/api/galeria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: GALERIA_FOTOS })
    });
  } catch (_) {}
}

async function initApp() {
  try {
    if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "true") {
      window.state.isAdminAuthenticated = true;
    }
  } catch (_) {}

  const params = new URLSearchParams(window.location.search);
  if (params.has("admin") || params.has("editor")) {
    if (!window.state.isAdminAuthenticated) {
      window.state.adminLoginModalOpen = true;
    }
  }

  await loadSavedGaleriaData();
  loadSavedSalgadosAndKanban();
  renderFullApp();
  renderAdminLoginModal();
  setupScrollSpy();
  setupKeyboardShortcuts();
  handleHashRoute();
  window.addEventListener("hashchange", handleHashRoute);
}

function loadSavedSalgadosAndKanban() {
  try {
    const savedCardapio = localStorage.getItem(STORAGE_KEY_CARDAPIO_SALGADOS);
    if (savedCardapio) {
      const parsed = JSON.parse(savedCardapio);
      if (parsed && Array.isArray(parsed.items)) {
        CARDAPIO_SALGADOS = parsed;
      }
    }
  } catch (_) {}

  try {
    const savedLeads = localStorage.getItem(STORAGE_KEY_KANBAN_LEADS);
    if (savedLeads) {
      const parsedLeads = JSON.parse(savedLeads);
      if (Array.isArray(parsedLeads)) {
        KANBAN_LEADS = parsedLeads;
      }
    }
  } catch (_) {}

  try {
    const savedIgnored = localStorage.getItem(STORAGE_KEY_IGNORED_CONTACTS);
    if (savedIgnored) {
      const parsedIg = JSON.parse(savedIgnored);
      if (Array.isArray(parsedIg)) {
        IGNORED_CONTACTS = parsedIg;
      }
    }
  } catch (_) {}
}

function saveSalgadosAndKanbanData() {
  try {
    localStorage.setItem(STORAGE_KEY_CARDAPIO_SALGADOS, JSON.stringify(CARDAPIO_SALGADOS));
    localStorage.setItem(STORAGE_KEY_KANBAN_LEADS, JSON.stringify(KANBAN_LEADS));
    localStorage.setItem(STORAGE_KEY_IGNORED_CONTACTS, JSON.stringify(IGNORED_CONTACTS));
  } catch (_) {}
}

function handleHashRoute() {
  const h = window.location.hash || "";
  if (h.startsWith("#/registro/")) {
    const id = decodeURIComponent(h.replace("#/registro/", ""));
    window.state.internalPage = null;
    renderInternalSubpage();
    window.openRegistroPage(id, false);
  } else if (h === "#/eventos" || h === "#eventos") {
    window.closeRegistroPage(false);
    window.openInternalSubpage("eventos", false);
  } else if (h === "#/galeria") {
    window.closeRegistroPage(false);
    window.openInternalSubpage("galeria", false);
  } else {
    if (window.state.activeRegistroId) window.closeRegistroPage(false);
    if (window.state.internalPage) window.closeInternalSubpage(false);
  }
}

function setupScrollSpy() {
  const sections = ["espaco", "buffet", "galeria", "orcamento", "avaliacoes", "localizacao"];
  window.addEventListener(
    "scroll",
    () => {
      const pos = window.scrollY + 140;
      for (const id of sections) {
        const el = document.getElementById(id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (pos >= top && pos < top + height) {
            if (window.state.activeSection !== id) {
              window.state.activeSection = id;
              updateNavbarActiveState();
            }
            break;
          }
        }
      }
    },
    { passive: true }
  );
}

window.setActiveNav = function (secId) {
  window.state.activeSection = secId;
  updateNavbarActiveState();
};

function updateNavbarActiveState() {
  document.querySelectorAll("[data-nav-section]").forEach(a => {
    const sec = a.getAttribute("data-nav-section");
    const isAct = sec === window.state.activeSection;
    a.className = `delta-nav-link py-1 transition-colors relative ${isAct ? "active" : ""}`;
  });
}

function setupKeyboardShortcuts() {
  window.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (window.state.activeRegistroId) {
        window.closeRegistroPage();
      } else if (window.state.internalPage) {
        window.closeInternalSubpage();
      } else if (window.state.mobileMenuOpen) {
        window.toggleMobileMenu(false);
      }
    }
  });
}

// ============================================================================
// RENDERIZAÇÃO DA PÁGINA INICIAL (NOVA IDENTIDADE VISUAL OFICIAL DELTA)
// ============================================================================
function renderFullApp() {
  const root = document.getElementById("root");
  if (!root) return;

  root.innerHTML = `
    <div class="delta-page-shell">
      ${
        window.state.isAdminAuthenticated
          ? `
        <div class="delta-admin-bar">
          <div class="delta-admin-bar-inner">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span>🔓 <strong>Painel do Proprietário (Leonardo)</strong></span>
              <span style="opacity: 0.7;" class="hidden sm:inline">— Alterne entre editar o site ou ver como o cliente vê:</span>
            </div>
            <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px;">
              <button
                type="button"
                onclick="window.openBotKanbanModal('kanban')"
                class="delta-admin-pill"
                style="background-color: var(--delta-gold); color: var(--delta-graphite); border-color: var(--delta-gold-light);"
              >
                🤖 Robô WhatsApp & Kanban de Etiquetas
              </button>
              <button
                type="button"
                onclick="window.openBotKanbanModal('cardapio')"
                class="delta-admin-pill"
              >
                🥟 Subir / Editar Cardápio de Salgados
              </button>
              <button
                type="button"
                onclick="window.setAdminViewMode(false)"
                class="delta-admin-pill ${!window.state.adminPreviewAsClient ? "active-mode" : ""}"
              >
                ✏️ Modo Editor (Alterar Fotos/Textos)
              </button>
              <button
                type="button"
                onclick="window.setAdminViewMode(true)"
                class="delta-admin-pill ${window.state.adminPreviewAsClient ? "active-mode" : ""}"
              >
                👁️ Ver como Cliente
              </button>
              <button
                type="button"
                onclick="window.openGaleriaManagerModal()"
                class="delta-admin-pill"
              >
                ⚙️ Gerenciar Fotos & Páginas
              </button>
              <button
                type="button"
                onclick="window.logoutAdminMode()"
                class="delta-admin-pill"
                style="background-color: rgba(220, 38, 38, 0.35); border-color: rgba(252, 165, 165, 0.4);"
              >
                🔒 Sair
              </button>
            </div>
          </div>
        </div>
      `
          : ""
      }
      <div id="adminLoginModalRoot"></div>

      <!-- TOP BAR INSTITUCIONAL (GRAFITE & DOURADO ENVELHECIDO) -->
      <div class="delta-topbar-inst">
        <div class="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          <div class="flex items-center gap-2 min-w-0">
            <span class="inline-flex items-center gap-1.5 delta-topbar-gold font-medium truncate">
              ${icon("mapPin", "w-3.5 h-3.5 shrink-0")}
              <span class="truncate">${CONFIG_DELTA.address} • ${CONFIG_DELTA.city}</span>
            </span>
          </div>

          <div class="flex items-center gap-3 sm:gap-4 shrink-0">
            <a href="${CONFIG_DELTA.instagramUrl}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-1.5 hover:text-white transition-colors" style="color:#e2dfd5;text-decoration:none;" title="Instagram Oficial">
              ${icon("instagram", "w-3.5 h-3.5 delta-topbar-gold shrink-0")}
              <span class="hidden sm:inline">${CONFIG_DELTA.instagramHandle}</span>
            </a>
            <span style="opacity:0.35;" class="hidden sm:inline">|</span>
            <a href="${getWhatsAppUrl()}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-1.5 font-semibold transition-colors" style="color:#d4bc7c;text-decoration:none;" title="WhatsApp Comercial">
              ${icon("phone", "w-3.5 h-3.5 shrink-0")}
              <span>${CONFIG_DELTA.phoneFormatted}</span>
            </a>
          </div>
        </div>
      </div>

      <!-- CABEÇALHO EDITORIAL COM A NOVA LOGO OFICIAL (HORIZONTAL DESKTOP / COMPACTA MOBILE) -->
      <header class="delta-header">
        <div class="delta-header-inner">
          <a href="#" class="delta-brand-link" title="Delta Espaço e Eventos — Início">
            <!-- Aplicação Horizontal Desktop/Tablet (Brasão à esquerda + DELTA Espaço e Eventos à direita, fundo transparente) -->
            <img
              src="./logo-horizontal.png"
              alt="Delta Espaço e Eventos"
              class="delta-logo-desktop"
            />
            <!-- Aplicação Compacta Mobile (Brasão + Lettering preservando proporções e legibilidade) -->
            <div class="delta-logo-mobile">
              <img
                src="./logo-brasao.png"
                alt="Brasão Delta"
                class="delta-logo-mobile-crest"
              />
              <img
                src="./logo-lettering.png"
                alt="Delta Espaço e Eventos"
                class="delta-logo-mobile-lettering"
              />
            </div>
          </a>

          <nav class="delta-main-nav" aria-label="Navegação Principal">
            <a href="#espaco" onclick="window.setActiveNav('espaco')" data-nav-section="espaco" class="delta-nav-link active">
              Espaços
            </a>
            <a href="#buffet" onclick="window.setActiveNav('buffet')" data-nav-section="buffet" class="delta-nav-link">
              Gastronomia & Buffet
            </a>
            <a href="#/eventos" onclick="window.openInternalSubpage('eventos')" class="delta-nav-link">
              Tipos de Eventos
            </a>
            <a href="#galeria" onclick="window.setActiveNav('galeria')" data-nav-section="galeria" class="delta-nav-link">
              Galeria
            </a>
            <a href="#orcamento" onclick="window.setActiveNav('orcamento')" data-nav-section="orcamento" class="delta-nav-link">
              Orçamento
            </a>
            <a href="#localizacao" onclick="window.setActiveNav('localizacao')" data-nav-section="localizacao" class="delta-nav-link">
              Localização & Avaliações
            </a>
          </nav>

          <div class="hidden sm:flex items-center gap-3">
            <a href="#orcamento" class="delta-btn-emerald">
              <span>Solicitar Orçamento</span>
              ${icon("chevronRight", "w-4 h-4")}
            </a>
          </div>

          <button
            type="button"
            id="mobileMenuBtn"
            onclick="window.toggleMobileMenu()"
            aria-label="Abrir menu de navegação"
            class="lg:hidden p-2.5 rounded-xl transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
            style="color: var(--delta-emerald); background-color: rgba(7, 86, 56, 0.06); border: 1px solid rgba(7, 86, 56, 0.16);"
          >
            ${icon("menu", "w-6 h-6")}
          </button>
        </div>

        <!-- MENU MOBILE -->
        <div id="mobileMenuContainer" style="display:none;">
          <div class="lg:hidden fixed inset-0 top-16 sm:top-20 bg-black/40 backdrop-blur-2xs z-30" onclick="window.toggleMobileMenu(false)"></div>
          <div class="lg:hidden relative z-40 px-5 py-5 shadow-2xl max-h-[85vh] overflow-y-auto" style="background-color: var(--delta-warm-white); border-bottom: 1px solid rgba(185, 154, 75, 0.3);">
            <nav class="flex flex-col gap-2 text-base font-medium" style="color: var(--delta-graphite);">
              <a href="#espaco" onclick="window.toggleMobileMenu(false)" class="py-2.5 border-b border-stone-200/70 min-h-[44px] flex items-center">Espaços (Delta Royal & Corporate)</a>
              <a href="#buffet" onclick="window.toggleMobileMenu(false)" class="py-2.5 border-b border-stone-200/70 min-h-[44px] flex items-center">Gastronomia, Coffee Break & Refeições</a>
              <a href="#/eventos" onclick="window.toggleMobileMenu(false); window.openInternalSubpage('eventos');" class="py-2.5 border-b border-stone-200/70 min-h-[44px] flex items-center">Tipos de Eventos Atendidos</a>
              <a href="#galeria" onclick="window.toggleMobileMenu(false)" class="py-2.5 border-b border-stone-200/70 min-h-[44px] flex items-center">Galeria de Eventos</a>
              <a href="#localizacao" onclick="window.toggleMobileMenu(false)" class="py-2.5 border-b border-stone-200/70 min-h-[44px] flex items-center">Avaliações & Localização</a>
              <div class="pt-3">
                <a href="#orcamento" onclick="window.toggleMobileMenu(false)" class="delta-btn-emerald w-full py-3.5">
                  <span>Solicitar Orçamento</span>
                  ${icon("chevronRight", "w-4 h-4")}
                </a>
              </div>
            </nav>
          </div>
        </div>
      </header>

      <!-- ======================================================================
           BLOCO 1: APRESENTAÇÃO INSTITUCIONAL (HERO EM VERDE-ESMERALDA PROFUNDO)
           ====================================================================== -->
      <section class="delta-hero-section">
        <div class="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=2000&q=85"
            alt="Delta Espaço e Eventos Bacabal"
            loading="eager"
            class="w-full h-full object-cover object-center opacity-20"
          />
          <div class="delta-hero-bg-overlay"></div>
        </div>

        <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="delta-hero-layout">
            <div class="delta-hero-content">
              <div class="delta-hero-eyebrow">
                <span>Locação de Espaços</span>
                <span aria-hidden="true" style="opacity:0.5;">·</span>
                <span>Coffee Breaks</span>
                <span aria-hidden="true" style="opacity:0.5;">·</span>
                <span>Almoços, Jantares & Coquetéis</span>
              </div>

              <h1 class="delta-hero-title">
                Tradição, hospitalidade e gastronomia própria para eventos corporativos e celebrações em Bacabal.
              </h1>

              <div class="delta-hero-divider"></div>

              <p class="delta-hero-desc">
                Dois salões climatizados independentes — para até 500 e até 100 convidados — aliados à Cozinha Central Delta para coffee breaks, refeições executivas, recepções sociais e confeitaria.
              </p>

              <div class="delta-hero-actions">
                <a
                  href="#orcamento"
                  class="delta-btn-emerald"
                  style="background-color: var(--delta-gold); border-color: var(--delta-gold); color: var(--delta-graphite); padding: 13px 26px; font-size: 0.92rem; font-weight: 700;"
                >
                  <span>Solicitar Orçamento</span>
                  ${icon("chevronRight", "w-4 h-4")}
                </a>
                <button
                  type="button"
                  onclick="window.openSalgadosMenuModal()"
                  class="delta-btn-hero-secondary"
                  style="cursor: pointer;"
                >
                  ${icon("utensils", "w-4 h-4")}
                  <span>Cardápio de Salgados & Encomendas</span>
                </button>
                <button
                  type="button"
                  onclick="window.openWhatsAppTriageModal()"
                  class="delta-btn-hero-secondary"
                  style="cursor: pointer;"
                >
                  ${icon("messageCircle", "w-4 h-4")}
                  <span>Atendimento via WhatsApp</span>
                </button>
              </div>
            </div>

            <!-- Símbolo Oficial em Destaque Discreto à Direita no Desktop -->
            <div class="delta-hero-emblem-col">
              <div style="padding: 28px; border-radius: 20px; background: rgba(251, 250, 246, 0.05); border: 1px solid rgba(185, 154, 75, 0.28); backdrop-filter: blur(8px);">
                <img
                  src="./logo-brasao.png"
                  alt="Brasão Oficial Delta Espaço e Eventos"
                  style="width: 196px; height: auto; display: block; margin: 0 auto;"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- FAIXA ÚNICA E COMPACTA DE DIFERENCIAIS (EM GRAFITE #282923 E DOURADO ENVELHECIDO) -->
      <section class="delta-highlights-strip">
        <div class="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 items-center">
          <div class="flex items-center gap-3.5">
            <div class="delta-highlight-icon-box">
              ${icon("wind", "w-4 h-4")}
            </div>
            <div>
              <div class="font-semibold text-xs sm:text-sm" style="color: var(--delta-warm-white);">Dois Salões Climatizados</div>
              <div class="text-[11px]" style="color: #c2beb2;">Delta Royal (400–500p) e Corporate (até 100p)</div>
            </div>
          </div>
          <div class="flex items-center gap-3.5">
            <div class="delta-highlight-icon-box">
              ${icon("sparkles", "w-4 h-4")}
            </div>
            <div>
              <div class="font-semibold text-xs sm:text-sm" style="color: var(--delta-warm-white);">Mobiliário Incluso</div>
              <div class="text-[11px]" style="color: #c2beb2;">Plástico, base de metal retrátil e tampão de madeira</div>
            </div>
          </div>
          <div class="flex items-center gap-3.5">
            <div class="delta-highlight-icon-box">
              ${icon("utensils", "w-4 h-4")}
            </div>
            <div>
              <div class="font-semibold text-xs sm:text-sm" style="color: var(--delta-warm-white);">Gastronomia Própria</div>
              <div class="text-[11px]" style="color: #c2beb2;">Coffee break, almoços, jantares e confeitaria</div>
            </div>
          </div>
          <div class="flex items-center gap-3.5">
            <div class="delta-highlight-icon-box">
              ${icon("mapPin", "w-4 h-4")}
            </div>
            <div>
              <div class="font-semibold text-xs sm:text-sm" style="color: var(--delta-warm-white);">Localização Central</div>
              <div class="text-[11px]" style="color: #c2beb2;">Rua Rui Barbosa, 373 • Nota 4,6 ★ no Google</div>
            </div>
          </div>
        </div>
      </section>

      <!-- ======================================================================
           BLOCO 2: APRESENTAÇÃO CONCISA DOS ESPAÇOS (#espaco — FUNDO MARFIM)
           ====================================================================== -->
      <section id="espaco" class="delta-section-ivory">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <span class="delta-eyebrow">Infraestrutura & Ambientes</span>
              <h2 class="text-2xl xs:text-3xl sm:text-4xl delta-section-title">
                Espaços Planejados para Receber com Conforto
              </h2>
              <div class="delta-gold-rule"></div>
            </div>
            <button
              type="button"
              onclick="window.openInternalSubpage('eventos')"
              class="delta-btn-secondary"
              style="width: fit-content;"
            >
              <span>Formatos de eventos atendidos</span>
              ${icon("chevronRight", "w-4 h-4")}
            </button>
          </div>

          <div id="espacoTabsContainer"></div>
        </div>
      </section>

      <!-- ======================================================================
           BLOCO 3: BUFFET & SERVIÇOS EM 4 CATEGORIAS (#buffet — BRANCO QUENTE)
           ====================================================================== -->
      <section id="buffet" class="delta-section-warm-white">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div class="max-w-2xl">
              <span class="delta-eyebrow">Cozinha Central Delta</span>
              <h2 class="text-2xl xs:text-3xl sm:text-4xl delta-section-title">
                Excelência em Gastronomia Corporativa e Social
              </h2>
              <div class="delta-gold-rule"></div>
              <p class="text-xs sm:text-sm md:text-base font-light" style="color: var(--delta-graphite-muted);">
                Cardápios elaborados para eventos nos nossos salões ou fornecimento externo para empresas, instituições e celebrações em Bacabal.
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onclick="window.openSalgadosMenuModal()"
                class="delta-btn-secondary"
                style="width: fit-content;"
              >
                <span>🥟 Cardápio de Salgados & Encomendas</span>
              </button>
              <a
                href="#orcamento"
                class="delta-btn-emerald"
                style="width: fit-content;"
              >
                ${icon("utensils", "w-4 h-4")}
                <span>Solicitar Proposta Gastronômica</span>
              </a>
            </div>
          </div>

          <div class="delta-buffet-grid-4">
            ${BUFFET_CATEGORIAS.map(
              cat => `
              <div class="delta-buffet-card">
                <div>
                  <span class="delta-buffet-badge">${cat.badge}</span>
                  <h3 class="text-xl font-serif font-semibold mb-2" style="color: var(--delta-graphite);">${cat.title}</h3>
                  <p class="text-xs sm:text-sm leading-relaxed mb-4 font-light" style="color: var(--delta-graphite-muted);">${cat.description}</p>
                  <div class="space-y-2.5 pt-3.5" style="border-top: 1px solid rgba(185, 154, 75, 0.2);">
                    ${cat.items
                      .map(
                        it => `
                      <div class="flex items-start gap-2 text-xs leading-snug" style="color: var(--delta-graphite);">
                        ${icon("circleCheck", "w-3.5 h-3.5 delta-gold-check shrink-0 mt-0.5")}
                        <span>${it}</span>
                      </div>
                    `
                      )
                      .join("")}
                  </div>
                </div>
                <div class="pt-4 mt-5" style="border-top: 1px solid rgba(185, 154, 75, 0.2);">
                  <a
                    href="#orcamento"
                    onclick="window.preselectBuffetCategory('${cat.title}')"
                    class="delta-emerald-link"
                  >
                    <span>Orçar ${cat.title}</span>
                    ${icon("chevronRight", "w-3.5 h-3.5")}
                  </a>
                </div>
              </div>
            `
            ).join("")}
          </div>
        </div>
      </section>

      <!-- ======================================================================
           BLOCO 4: GALERIA ENXUTA (6 IMAGENS SELECIONADAS — FUNDO MARFIM)
           ====================================================================== -->
      <section id="galeria" class="delta-section-ivory">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <span class="delta-eyebrow">Registro Visual</span>
              <h2 class="text-2xl xs:text-3xl sm:text-4xl delta-section-title">
                Ambientes, Eventos & Gastronomia
              </h2>
              <div class="delta-gold-rule"></div>
              <p class="text-xs sm:text-sm" style="color: var(--delta-graphite-muted);">
                Selecione uma categoria para conhecer os detalhes de estrutura e cardápio.
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2.5">
              ${
                isEditorMode()
                  ? `
                <button
                  type="button"
                  onclick="window.openGaleriaEditorModal(null)"
                  class="delta-btn-emerald"
                >
                  <span>+ Adicionar Foto / Página</span>
                </button>
                <button
                  type="button"
                  onclick="window.openGaleriaManagerModal()"
                  class="delta-btn-secondary"
                >
                  <span>⚙️ Gerenciar Galeria</span>
                </button>
              `
                  : ""
              }
              <button
                type="button"
                onclick="window.openInternalSubpage('galeria')"
                class="delta-btn-secondary"
              >
                <span>Ver Galeria Completa (${GALERIA_FOTOS.length})</span>
                ${icon("chevronRight", "w-4 h-4")}
              </button>
            </div>
          </div>

          <div id="galeriaSectionContainer"></div>
        </div>
      </section>

      <!-- PÁGINAS INTERNAS E MODAIS -->
      <div id="internalSubpageRoot"></div>
      <div id="registroDedicatedPageRoot"></div>
      <div id="galeriaEditorModalRoot"></div>
      <div id="whatsappTriageModalRoot"></div>
      <div id="salgadosMenuModalRoot"></div>
      <div id="botKanbanModalRoot"></div>

      <!-- ======================================================================
           BLOCO 5: FORMULÁRIO DE ORÇAMENTO SIMPLIFICADO (#orcamento — BRANCO QUENTE)
           ====================================================================== -->
      <section id="orcamento" class="delta-section-warm-white">
        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="text-center mb-8">
            <span class="delta-eyebrow">Atendimento Comercial</span>
            <h2 class="text-2xl xs:text-3xl sm:text-4xl delta-section-title mt-1">
              Solicite uma Proposta Personalizada
            </h2>
            <div class="delta-gold-rule" style="margin-left: auto; margin-right: auto;"></div>
            <p class="text-xs sm:text-sm max-w-xl mx-auto" style="color: var(--delta-graphite-muted);">
              Preencha as informações essenciais do seu evento ou pedido corporativo para iniciar o atendimento direto pelo WhatsApp.
            </p>
          </div>

          <div id="orcamentoFormContainer"></div>
        </div>
      </section>

      <!-- ======================================================================
           BLOCO 6: AVALIAÇÕES REAIS & LOCALIZAÇÃO CENTRAL (#localizacao — FUNDO MARFIM)
           ====================================================================== -->
      <section id="localizacao" class="delta-section-ivory">
        <div id="avaliacoes" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-stretch">
            <div class="lg:col-span-5 flex flex-col justify-between space-y-4">
              <div>
                <span class="delta-eyebrow">Credibilidade & Localização</span>
                <h2 class="text-2xl xs:text-3xl delta-section-title mt-1">
                  No Centro de Bacabal
                </h2>
                <div class="delta-gold-rule"></div>

                <!-- BLOCO DE REPUTAÇÃO VERIFICADA NO GOOGLE MAPS -->
                <div class="flex items-center justify-between gap-4 p-4 rounded-xl mb-4" style="background-color: var(--delta-warm-white); border: 1px solid rgba(185, 154, 75, 0.28);">
                  <div class="flex items-center gap-3.5">
                    <div class="text-3xl font-serif font-bold tabular-nums" style="color: var(--delta-emerald);">${CONFIG_DELTA.googleRating}</div>
                    <div class="pl-3.5" style="border-left: 1px solid rgba(185, 154, 75, 0.28);">
                      <div class="flex mb-0.5" style="color: var(--delta-gold);">
                        ${[1, 2, 3, 4, 5].map(() => icon("star", "w-3.5 h-3.5 fill-amber-400")).join("")}
                      </div>
                      <div class="text-xs font-bold" style="color: var(--delta-graphite);">Avaliação no Google Maps</div>
                      <div class="text-[11px]" style="color: var(--delta-graphite-muted);">${CONFIG_DELTA.googleReviewCount} avaliações públicas verificadas</div>
                    </div>
                  </div>
                  <a
                    href="${CONFIG_DELTA.googleMapsUrl}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="delta-emerald-link shrink-0"
                  >
                    <span>Ver no Google</span>
                    ${icon("arrowUpRight", "w-3.5 h-3.5")}
                  </a>
                </div>

                <!-- DADOS DE ENDEREÇO E CONTATO -->
                <div class="space-y-2.5">
                  <div class="flex items-start gap-3 p-3.5 rounded-xl" style="background-color: var(--delta-warm-white); border: 1px solid rgba(185, 154, 75, 0.24);">
                    ${icon("mapPin", "w-5 h-5 delta-gold-check shrink-0 mt-0.5")}
                    <div>
                      <div class="text-[10px] font-bold uppercase tracking-wider" style="color: var(--delta-graphite-muted);">Endereço Oficial</div>
                      <div class="font-bold text-sm mt-0.5" style="color: var(--delta-graphite);">${CONFIG_DELTA.address}</div>
                      <div class="text-xs" style="color: var(--delta-graphite-muted);">${CONFIG_DELTA.city} • CEP ${CONFIG_DELTA.cep}</div>
                    </div>
                  </div>

                  <div class="flex items-start gap-3 p-3.5 rounded-xl" style="background-color: var(--delta-warm-white); border: 1px solid rgba(185, 154, 75, 0.24);">
                    ${icon("phone", "w-5 h-5 shrink-0 mt-0.5")}
                    <div>
                      <div class="text-[10px] font-bold uppercase tracking-wider" style="color: var(--delta-graphite-muted);">WhatsApp Comercial & Agendamentos</div>
                      <div class="font-bold text-sm mt-0.5" style="color: var(--delta-graphite);">${CONFIG_DELTA.phoneFormatted}</div>
                      <div class="text-xs" style="color: var(--delta-graphite-muted);">${CONFIG_DELTA.hoursNote}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex flex-col sm:flex-row gap-2.5 pt-2">
                <a href="${CONFIG_DELTA.googleMapsUrl}" target="_blank" rel="noopener noreferrer" class="delta-btn-emerald w-full sm:w-auto">
                  ${icon("compass", "w-4 h-4")}
                  <span>Abrir no Google Maps</span>
                </a>
                <a href="${CONFIG_DELTA.wazeUrl}" target="_blank" rel="noopener noreferrer" class="delta-btn-secondary w-full sm:w-auto">
                  ${icon("mapPin", "w-4 h-4")}
                  <span>Abrir no Waze</span>
                </a>
              </div>
            </div>

            <div class="lg:col-span-7 flex flex-col">
              <div class="relative rounded-2xl overflow-hidden shadow-md h-full min-h-[300px] sm:min-h-[360px] flex-1" style="border: 1px solid rgba(185, 154, 75, 0.3);">
                <iframe
                  title="Mapa de Localização Delta Espaço e Eventos"
                  src="https://maps.google.com/maps?q=Rua+Rui+Barbosa+373+Bacabal+MA&t=&z=16&ie=UTF8&iwloc=&output=embed"
                  class="w-full h-full border-0 filter contrast-105"
                  loading="lazy"
                  referrerpolicy="no-referrer-when-downgrade"
                  sandbox="allow-scripts allow-same-origin allow-popups"
                ></iframe>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- RODAPÉ INSTITUCIONAL (GRAFITE #282923 COM BRASÃO OFICIAL) -->
      <footer class="delta-footer">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pb-8" style="border-bottom: 1px solid rgba(185, 154, 75, 0.22);">
            <div>
              <div class="flex items-center gap-3 mb-3">
                <img
                  src="./logo-brasao.png"
                  alt="Brasão Delta Espaço e Eventos"
                  style="width: 52px; height: auto; flex-shrink: 0;"
                />
                <div>
                  <div class="text-lg font-serif font-bold tracking-widest" style="color: var(--delta-gold-light); line-height: 1.1;">
                    DELTA
                  </div>
                  <div class="text-[11px] tracking-wider uppercase mt-0.5" style="color: var(--delta-ivory);">
                    Espaço e Eventos
                  </div>
                </div>
              </div>
              <p class="text-xs leading-relaxed mb-4" style="color: #c8c4b7;">
                Locação de espaços climatizados, coffee breaks, almoços, jantares, coquetéis e confeitaria para eventos corporativos e sociais em Bacabal – MA.
              </p>
              <div class="flex items-center gap-2.5">
                <a href="${CONFIG_DELTA.instagramUrl}" target="_blank" rel="noopener noreferrer" class="w-9 h-9 rounded-full flex items-center justify-center transition-colors" style="background-color: rgba(251,250,246,0.07); border: 1px solid rgba(185,154,75,0.3); color: var(--delta-gold-light);" aria-label="Instagram da Delta">
                  ${icon("instagram", "w-4 h-4")}
                </a>
                <a href="${getWhatsAppUrl()}" target="_blank" rel="noopener noreferrer" class="w-9 h-9 rounded-full flex items-center justify-center transition-colors" style="background-color: rgba(251,250,246,0.07); border: 1px solid rgba(185,154,75,0.3); color: var(--delta-gold-light);" aria-label="WhatsApp da Delta">
                  ${icon("messageCircle", "w-4 h-4")}
                </a>
                <a href="${CONFIG_DELTA.googleMapsUrl}" target="_blank" rel="noopener noreferrer" class="w-9 h-9 rounded-full flex items-center justify-center transition-colors" style="background-color: rgba(251,250,246,0.07); border: 1px solid rgba(185,154,75,0.3); color: var(--delta-gold-light);" aria-label="Google Maps da Delta">
                  ${icon("mapPin", "w-4 h-4")}
                </a>
              </div>
            </div>

            <div>
              <div class="delta-footer-heading">Navegação</div>
              <ul class="space-y-2">
                <li><a href="#espaco" class="delta-footer-link">Espaços (Delta Royal & Corporate)</a></li>
                <li><a href="#buffet" class="delta-footer-link">Gastronomia & Coffee Break</a></li>
                <li><a href="#/eventos" onclick="window.openInternalSubpage('eventos')" class="delta-footer-link">Tipos de Eventos Atendidos</a></li>
                <li><a href="#/galeria" onclick="window.openInternalSubpage('galeria')" class="delta-footer-link">Galeria Completa de Fotos</a></li>
                <li><a href="#orcamento" class="delta-footer-link">Solicitar Orçamento</a></li>
              </ul>
            </div>

            <div>
              <div class="delta-footer-heading">Serviços</div>
              <ul class="space-y-2" style="color: #c8c4b7;">
                <li>Delta Royal (400–500p) e Delta Corporate (até 100p)</li>
                <li>Coffee Breaks & Kits Corporativos</li>
                <li>Almoços, Jantares & Feijoadas</li>
                <li>Coquetéis, Salgados & Confeitaria</li>
              </ul>
            </div>

            <div>
              <div class="delta-footer-heading">Contato & Dados</div>
              <div class="space-y-2">
                <p style="color: #e2dfd5;">${CONFIG_DELTA.address}<br/>${CONFIG_DELTA.city} • CEP ${CONFIG_DELTA.cep}</p>
                <p style="color: #e2dfd5;">WhatsApp: <a href="${getWhatsAppUrl()}" target="_blank" rel="noopener noreferrer" style="color: var(--delta-gold-light); text-decoration: underline; font-weight: 600;">${CONFIG_DELTA.phoneFormatted}</a></p>
                <p class="text-[11px]" style="color: #9e9b90;">CNPJ: 06.328.111/0001-08 · Gestor: Leonardo Luís Costa Santos</p>
              </div>
            </div>
          </div>

          <div class="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-center sm:text-left" style="color: #9e9b90;">
            <div>© ${new Date().getFullYear()} Delta Espaço e Eventos. Todos os direitos reservados.</div>
            <div class="flex items-center gap-3">
              <span>Rua Rui Barbosa, 373, Centro • Bacabal – Maranhão</span>
              <button
                type="button"
                onclick="window.promptAdminLogin()"
                title="Acesso restrito da gestão"
                class="cursor-pointer"
                style="background:transparent;border:none;font-size:11px;color:#9e9b90;"
              >
                🔒 Gestor
              </button>
            </div>
          </div>
        </div>
      </footer>

      <!-- BOTÃO FLUTUANTE DO WHATSAPP COM TRIAGEM AUTOMÁTICA -->
      <button
        type="button"
        onclick="window.openWhatsAppTriageModal()"
        aria-label="Atendimento e Encomendas via WhatsApp"
        class="delta-whatsapp-fab"
        style="cursor: pointer;"
      >
        ${icon("messageCircle", "w-5 h-5 shrink-0")}
        <span class="hidden sm:inline font-semibold text-xs sm:text-sm tracking-wide">Atendimento & Encomendas</span>
      </button>
    </div>
  `;

  renderEspacoTabs();
  renderGaleriaSection();
  renderOrcamentoForm();
  renderWhatsAppTriageModal();
  renderSalgadosMenuModal();
  renderBotKanbanModal();
}

// ============================================================================
// COMPONENTES INTERATIVOS DA HOME
// ============================================================================

window.toggleMobileMenu = function (forceVal) {
  window.state.mobileMenuOpen = typeof forceVal === "boolean" ? forceVal : !window.state.mobileMenuOpen;
  const menuEl = document.getElementById("mobileMenuContainer");
  const btnEl = document.getElementById("mobileMenuBtn");
  if (menuEl) menuEl.style.display = window.state.mobileMenuOpen ? "block" : "none";
  if (btnEl) btnEl.innerHTML = window.state.mobileMenuOpen ? icon("x", "w-6 h-6") : icon("menu", "w-6 h-6");
};

// BLOCO 2: ABAS DE ESPAÇOS CONCISAS
function renderEspacoTabs() {
  const container = document.getElementById("espacoTabsContainer");
  if (!container) return;

  const idx = window.state.espacoTabIndex;
  const activeAmb = AMBIENTES_ESPACO[idx] || AMBIENTES_ESPACO[0];

  container.innerHTML = `
    <div class="flex justify-start mb-6 overflow-x-auto no-scrollbar">
      <div class="delta-tabs-bar" style="background-color: var(--delta-warm-white);">
        ${AMBIENTES_ESPACO.map(
          (amb, i) => `
          <button
            type="button"
            onclick="window.selectEspacoTab(${i})"
            class="delta-tab-btn ${i === idx ? "active" : ""}"
          >
            ${amb.title}
          </button>
        `
        ).join("")}
      </div>
    </div>

    <div class="delta-surface-card grid grid-cols-1 lg:grid-cols-12">
      <div class="lg:col-span-7 relative min-h-[250px] sm:min-h-[330px] lg:min-h-[380px] overflow-hidden" style="background-color: var(--delta-graphite);">
        <img src="${activeAmb.image}" alt="${activeAmb.title}" loading="lazy" decoding="async" class="w-full h-full object-cover" />
        ${
          isIllustrativeImage(activeAmb.image) && isEditorMode()
            ? `<span class="delta-photo-flag">Imagem ilustrativa — substitua no Modo Editor</span>`
            : ""
        }
      </div>

      <div class="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-center">
        <div class="flex items-center gap-2 text-[11px] sm:text-xs uppercase tracking-widest font-bold mb-2 flex-wrap" style="color: var(--delta-emerald);">
          <span>${activeAmb.tag}</span>
          <span aria-hidden="true" style="color: var(--delta-gold);">·</span>
          <span class="normal-case tracking-normal font-normal" style="color: var(--delta-graphite-muted);">${activeAmb.subtitle}</span>
        </div>
        <h3 class="text-xl sm:text-2xl font-serif font-semibold mb-3" style="color: var(--delta-graphite);">${activeAmb.title}</h3>
        <p class="text-xs sm:text-sm leading-relaxed mb-5 font-light" style="color: var(--delta-graphite-muted);">${activeAmb.description}</p>
        <div class="space-y-2.5 mb-6">
          ${activeAmb.highlights
            .map(
              h => `
            <div class="flex items-start gap-2.5">
              ${icon("circleCheck", "w-4 h-4 delta-gold-check shrink-0 mt-0.5")}
              <span class="text-xs sm:text-sm" style="color: var(--delta-graphite);">${h}</span>
            </div>
          `
            )
            .join("")}
        </div>
        <div class="pt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3" style="border-top: 1px solid rgba(185, 154, 75, 0.22);">
          <a href="#orcamento" class="delta-btn-emerald">
            <span>Consultar Disponibilidade</span>
            ${icon("chevronRight", "w-4 h-4")}
          </a>
          <a href="${getWhatsAppUrl(`Olá! Gostaria de consultar disponibilidade e valores do ${activeAmb.title}.`)}" target="_blank" rel="noopener noreferrer" class="delta-btn-secondary">
            ${icon("messageCircle", "w-4 h-4")}
            <span>Falar no WhatsApp</span>
          </a>
        </div>
      </div>
    </div>
  `;
}

window.selectEspacoTab = function (i) {
  window.state.espacoTabIndex = i;
  renderEspacoTabs();
};

window.preselectBuffetCategory = function (catTitle) {
  if (catTitle.includes("Coffee")) {
    window.state.formServico = "Coffee Break / Kits Lanche Corporativos";
  } else if (catTitle.includes("Almoços")) {
    window.state.formServico = "Espaço + Buffet Completo (Almoço, Jantar ou Coquetel)";
  } else {
    window.state.formServico = "Coquetel, Salgados, Doces e Confeitaria";
  }
  renderOrcamentoForm();
};

// BLOCO 4: GALERIA INICIAL ENXUTA (ATÉ 6 IMAGENS NA HOME + LINK P/ GALERIA COMPLETA)
function getAllGalleryCategories() {
  const base = ["Todos", "Delta Royal", "Delta Corporate", "Buffet & Gastronomia", "Escadaria", "Mesa de Doces"];
  for (const item of GALERIA_FOTOS) {
    if (item.category && !base.includes(item.category)) {
      base.push(item.category);
    }
  }
  return base;
}

function getFilteredGalleryImages(limitForHome = false) {
  const list =
    window.state.galeriaFilter === "Todos"
      ? GALERIA_FOTOS
      : GALERIA_FOTOS.filter(img => img.category === window.state.galeriaFilter);
  return limitForHome ? list.slice(0, 6) : list;
}

function renderGalleryCardHtml(img) {
  const illustrative = isIllustrativeImage(img.image);
  return `
    <div
      onclick="window.openRegistroPage('${img.id}')"
      class="delta-gallery-card"
    >
      <img src="${img.image}" alt="${img.title}" loading="lazy" decoding="async" class="delta-gallery-card-img" />
      <div class="delta-gallery-card-gradient"></div>
      ${
        illustrative && isEditorMode()
          ? `<span class="delta-photo-flag">Foto ilustrativa — substituir</span>`
          : ""
      }
      <div class="delta-gallery-card-body">
        <span class="delta-gallery-card-cat">${img.category}</span>
        <h4 class="delta-gallery-card-title">${img.title}</h4>
        <p class="delta-gallery-card-desc">${img.description || ""}</p>
        <div class="delta-gallery-card-more">
          <span>Ver detalhes</span>
          ${icon("chevronRight", "w-3.5 h-3.5")}
        </div>
      </div>
      ${
        isEditorMode()
          ? `
        <button
          type="button"
          title="Editar foto, título e texto deste card"
          onclick="event.stopPropagation(); window.openGaleriaEditorModal('${img.id}')"
          class="delta-gallery-card-edit-btn"
          style="opacity: 1;"
        >
          ✏️ Editar
        </button>
      `
          : ""
      }
    </div>
  `;
}

function renderGaleriaSection() {
  const container = document.getElementById("galeriaSectionContainer");
  if (!container) return;

  const images = getFilteredGalleryImages(true); // Exibe 6 imagens selecionadas na Home

  container.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      ${images.map(img => renderGalleryCardHtml(img)).join("")}
    </div>
  `;
}

window.setGaleriaFilter = function (cat) {
  window.state.galeriaFilter = cat;
  renderGaleriaSection();
  renderInternalSubpage();
};

// ============================================================================
// PÁGINAS INTERNAS (#/eventos E #/galeria) — PRESERVA CONTEÚDO E SEO SEM POLUIR A HOME
// ============================================================================
window.openInternalSubpage = function (pageName, updateHash = true) {
  window.state.internalPage = pageName;
  document.body.style.overflow = "hidden";
  if (updateHash) {
    history.pushState(null, "", `#/${pageName}`);
  }
  renderInternalSubpage();
};

window.closeInternalSubpage = function (updateHash = true) {
  window.state.internalPage = null;
  document.body.style.overflow = "unset";
  if (updateHash && (window.location.hash === "#/eventos" || window.location.hash === "#eventos" || window.location.hash === "#/galeria")) {
    history.pushState(null, "", "#");
  }
  renderInternalSubpage();
};

function renderInternalSubpage() {
  const rootEl = document.getElementById("internalSubpageRoot");
  if (!rootEl) return;

  const page = window.state.internalPage;
  if (!page) {
    rootEl.innerHTML = "";
    return;
  }

  if (page === "eventos") {
    rootEl.innerHTML = `
      <div class="delta-reg-page-overlay">
        <header class="delta-reg-topbar">
          <div class="delta-reg-topbar-inner">
            <button type="button" onclick="window.closeInternalSubpage()" class="delta-reg-back-btn">
              ${icon("chevronLeft", "w-4 h-4 text-amber-400")}
              <span>Voltar à Página Inicial</span>
            </button>
            <span class="text-xs text-stone-300 font-serif tracking-wider uppercase">Delta Espaço e Eventos • Formatos Atendidos</span>
            <button type="button" onclick="window.closeInternalSubpage()" class="delta-reg-back-btn" style="padding: 8px 10px;">
              ${icon("x", "w-5 h-5")}
            </button>
          </div>
        </header>

        <main class="delta-reg-main">
          <div class="delta-reg-header">
            <span class="delta-reg-badge">Eventos Corporativos & Sociais</span>
            <h1 class="delta-reg-title">Formatos de Eventos Atendidos pela Delta</h1>
            <p class="delta-reg-subtitle">
              Atuamos com locação do Salão Principal (400–500 pessoas), Salão Intimista (até 100 pessoas) e serviço próprio de buffet, coffee break e catering externo em Bacabal.
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${TIPOS_EVENTOS.map(
              ev => `
              <div class="delta-surface-card flex flex-col justify-between">
                <div>
                  <div class="relative h-48 overflow-hidden" style="background-color: var(--delta-graphite);">
                    <img src="${ev.image}" alt="${ev.title}" class="w-full h-full object-cover" />
                    <div class="delta-gallery-card-gradient"></div>
                    <div class="absolute bottom-3 left-4 right-4">
                      <span class="text-[10px] font-bold uppercase tracking-wider" style="color: var(--delta-gold-light);">${ev.category}</span>
                      <h3 class="text-lg font-serif font-semibold text-white mt-0.5">${ev.title}</h3>
                    </div>
                  </div>
                  <div class="p-5">
                    <p class="text-xs sm:text-sm leading-relaxed mb-4 font-light" style="color: var(--delta-graphite-muted);">${ev.description}</p>
                    <div class="space-y-2 mb-4">
                      ${ev.features
                        .map(
                          f => `
                        <div class="flex items-center gap-2 text-xs" style="color: var(--delta-graphite);">
                          <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background-color: var(--delta-gold);"></span>
                          <span>${f}</span>
                        </div>
                      `
                        )
                        .join("")}
                    </div>
                  </div>
                </div>
                <div class="p-5 pt-0">
                  <button
                    type="button"
                    onclick="window.closeInternalSubpage(); setTimeout(() => { const el = document.getElementById('orcamento'); if(el) el.scrollIntoView({ behavior: 'smooth' }); }, 100);"
                    class="delta-btn-emerald w-full"
                  >
                    <span>Solicitar Orçamento para este Formato</span>
                    ${icon("chevronRight", "w-4 h-4")}
                  </button>
                </div>
              </div>
            `
            ).join("")}
          </div>
        </main>
      </div>
    `;
    return;
  }

  if (page === "galeria") {
    const categories = getAllGalleryCategories();
    const allImages = getFilteredGalleryImages(false);
    rootEl.innerHTML = `
      <div class="delta-reg-page-overlay">
        <header class="delta-reg-topbar">
          <div class="delta-reg-topbar-inner">
            <button type="button" onclick="window.closeInternalSubpage()" class="delta-reg-back-btn">
              ${icon("chevronLeft", "w-4 h-4")}
              <span>Voltar à Página Inicial</span>
            </button>
            <span class="text-xs font-serif tracking-wider uppercase" style="color: var(--delta-gold-light);">Galeria Completa • Delta Espaço e Eventos</span>
            <div class="flex items-center gap-2">
              ${
                isEditorMode()
                  ? `
                <button type="button" onclick="window.openGaleriaEditorModal(null)" class="delta-reg-edit-top-btn">
                  + Nova Foto / Página
                </button>
              `
                  : ""
              }
              <button type="button" onclick="window.closeInternalSubpage()" class="delta-reg-back-btn" style="padding: 8px 10px;">
                ${icon("x", "w-5 h-5")}
              </button>
            </div>
          </div>
        </header>

        <main class="delta-reg-main">
          <div class="delta-reg-header">
            <span class="delta-reg-badge">Galeria Completa</span>
            <h1 class="delta-reg-title">Todos os Ambientes, Eventos & Serviços</h1>
            <p class="delta-reg-subtitle">
              Filtre por categoria ou clique em qualquer cartão para abrir a página detalhada.
            </p>
          </div>

          <div class="flex justify-start mb-6 overflow-x-auto no-scrollbar">
            <div class="delta-tabs-bar" style="background-color: var(--delta-warm-white);">
              ${categories
                .map(
                  cat => `
                <button
                  type="button"
                  onclick="window.setGaleriaFilter('${cat.replace(/'/g, "\\'")}')"
                  class="delta-tab-btn ${window.state.galeriaFilter === cat ? "active" : ""}"
                >
                  ${cat}
                </button>
              `
                )
                .join("")}
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            ${allImages.map(img => renderGalleryCardHtml(img)).join("")}
          </div>
        </main>
      </div>
    `;
  }
}

// ============================================================================
// PÁGINA EXCLUSIVA DE CADA CARD DO REGISTRO VISUAL (#/registro/:id)
// ============================================================================
window.openRegistroPage = function (id, updateHash = true) {
  const item = GALERIA_FOTOS.find(x => x.id === id);
  if (!item) return;

  window.state.activeRegistroId = id;
  window.state.activeRegistroPhotoIndex = 0;
  document.body.style.overflow = "hidden";
  if (updateHash) {
    history.pushState(null, "", `#/registro/${encodeURIComponent(id)}`);
  }
  renderRegistroDedicatedPage();
};

window.closeRegistroPage = function (updateHash = true) {
  window.state.activeRegistroId = null;
  document.body.style.overflow = "unset";
  if (updateHash && window.location.hash.startsWith("#/registro/")) {
    history.pushState(null, "", "#galeria");
  }
  renderRegistroDedicatedPage();
};

window.selectRegistroPhoto = function (photoIdx) {
  window.state.activeRegistroPhotoIndex = photoIdx;
  renderRegistroDedicatedPage();
};

function renderRegistroDedicatedPage() {
  const rootEl = document.getElementById("registroDedicatedPageRoot");
  if (!rootEl) return;

  const id = window.state.activeRegistroId;
  if (!id) {
    rootEl.innerHTML = "";
    return;
  }

  const item = GALERIA_FOTOS.find(x => x.id === id);
  if (!item) {
    rootEl.innerHTML = "";
    return;
  }

  const allPhotos = [item.image, ...(Array.isArray(item.extraImages) ? item.extraImages : [])].filter(Boolean);
  const activePhoto = allPhotos[window.state.activeRegistroPhotoIndex || 0] || item.image;
  const rawParagraphs = (item.fullContent || item.description || "")
    .split(/\n+/)
    .map(p => p.trim())
    .filter(Boolean);

  const related = GALERIA_FOTOS.filter(x => x.id !== item.id).slice(0, 3);

  rootEl.innerHTML = `
    <div class="delta-reg-page-overlay">
      <header class="delta-reg-topbar">
        <div class="delta-reg-topbar-inner">
          <div class="flex items-center gap-3">
            <button
              type="button"
              onclick="window.closeRegistroPage()"
              class="delta-reg-back-btn"
            >
              ${icon("chevronLeft", "w-4 h-4 text-amber-400")}
              <span>Voltar ao Site Principal</span>
            </button>
            <span class="hidden sm:inline text-stone-600">|</span>
            <span class="hidden sm:inline text-xs text-stone-300 font-serif tracking-wider uppercase">Delta Espaço e Eventos • ${item.category}</span>
          </div>

          <div class="flex items-center gap-2">
            ${
              isEditorMode()
                ? `
              <button
                type="button"
                onclick="window.openGaleriaEditorModal('${item.id}')"
                class="delta-reg-edit-top-btn"
              >
                <span>✏️ Editar esta Página / Fotos</span>
              </button>
            `
                : ""
            }
            <button
              type="button"
              onclick="window.closeRegistroPage()"
              aria-label="Fechar página"
              class="delta-reg-back-btn"
              style="padding: 8px 10px;"
            >
              ${icon("x", "w-5 h-5")}
            </button>
          </div>
        </div>
      </header>

      <main class="delta-reg-main">
        <div class="delta-reg-header">
          <span class="delta-reg-badge">${item.category}</span>
          <h1 class="delta-reg-title">${item.title}</h1>
          <p class="delta-reg-subtitle">${item.description || ""}</p>
        </div>

        <div class="delta-reg-photo-showcase">
          <div class="delta-reg-main-img-box" style="position: relative;">
            <img
              src="${activePhoto}"
              alt="${item.title}"
              class="delta-reg-main-img"
            />
            ${
              isIllustrativeImage(activePhoto) && isEditorMode()
                ? `<span class="delta-photo-flag">Imagem ilustrativa — substitua por foto real da Delta</span>`
                : ""
            }
          </div>
          ${
            allPhotos.length > 1
              ? `
            <div class="delta-reg-thumbs-bar">
              ${allPhotos
                .map(
                  (ph, pIdx) => `
                <button
                  type="button"
                  onclick="window.selectRegistroPhoto(${pIdx})"
                  class="delta-reg-thumb-btn ${(window.state.activeRegistroPhotoIndex || 0) === pIdx ? "active" : ""}"
                >
                  <img src="${ph}" alt="Foto ${pIdx + 1}" class="w-full h-full object-cover" />
                </button>
              `
                )
                .join("")}
            </div>
          `
              : ""
          }
        </div>

        <div class="delta-reg-content-grid">
          <div class="delta-reg-article-box">
            <h2 class="delta-reg-article-heading">
              Detalhes sobre ${item.title}
            </h2>
            <div class="delta-reg-paragraphs">
              ${rawParagraphs.map(p => `<p>${p}</p>`).join("")}
            </div>

            ${
              allPhotos.length > 1
                ? `
              <div class="delta-reg-extra-gallery">
                <h3 class="delta-reg-article-heading" style="font-size: 1.2rem; margin-bottom: 12px;">Mais Fotos deste Ambiente / Serviço</h3>
                <div class="delta-reg-extra-grid">
                  ${allPhotos
                    .map(
                      (ph, idx) => `
                    <div class="delta-reg-extra-photo">
                      <img src="${ph}" alt="${item.title} - Foto ${idx + 1}" />
                    </div>
                  `
                    )
                    .join("")}
                </div>
              </div>
            `
                : ""
            }
          </div>

          <div class="delta-reg-sidebar">
            <div class="delta-reg-cta-card">
              <span class="delta-reg-cta-tag">Atendimento Delta • Bacabal</span>
              <h3 class="delta-reg-cta-title">Solicite um orçamento</h3>
              <p class="delta-reg-cta-text">
                Consulte disponibilidade de data e valores para <strong>${item.title}</strong> diretamente com nossa equipe comercial.
              </p>

              <div class="delta-reg-cta-buttons">
                <a
                  href="${getWhatsAppUrl(`Olá! Vi a página "${item.title}" (${item.category}) no site da Delta e gostaria de solicitar um orçamento.`)}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="delta-reg-btn-wa"
                >
                  ${icon("messageCircle", "w-4 h-4 fill-white text-emerald-600")}
                  <span>Orçar pelo WhatsApp</span>
                </a>
                <button
                  type="button"
                  onclick="window.closeRegistroPage(); setTimeout(() => { const el = document.getElementById('orcamento'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }, 100);"
                  class="delta-reg-btn-sim"
                >
                  <span>Preencher Formulário Rápido</span>
                  ${icon("chevronRight", "w-4 h-4")}
                </button>
              </div>
            </div>

            ${
              isEditorMode()
                ? `
              <div class="delta-reg-admin-hint">
                <div style="font-size: 0.82rem; color: #57534e; line-height: 1.45;">
                  <strong style="color: #1c1917; display: block; margin-bottom: 2px;">Modo Editor Ativo</strong>
                  Altere as fotos, o título ou os parágrafos desta página.
                </div>
                <button
                  type="button"
                  onclick="window.openGaleriaEditorModal('${item.id}')"
                  class="delta-action-btn-secondary"
                  style="padding: 8px 14px; flex-shrink: 0;"
                >
                  ✏️ Editar
                </button>
              </div>
            `
                : ""
            }
          </div>
        </div>

        <div class="delta-reg-related-section">
          <div class="flex items-center justify-between" style="margin-bottom: 16px;">
            <h3 style="font-family: var(--font-serif); font-size: 1.35rem; font-weight: 700; color: #1c1917; margin: 0;">
              Outras categorias e ambientes
            </h3>
            <button
              type="button"
              onclick="window.closeRegistroPage()"
              class="delta-action-btn-secondary"
              style="padding: 7px 14px; font-size: 0.78rem;"
            >
              Voltar ao início →
            </button>
          </div>
          <div class="delta-reg-related-grid">
            ${related
              .map(
                rel => `
              <div
                onclick="window.openRegistroPage('${rel.id}')"
                class="delta-reg-related-card"
              >
                <img src="${rel.image}" alt="${rel.title}" class="delta-reg-related-img" />
                <div class="delta-reg-related-body">
                  <span style="font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #92400e; display: block; margin-bottom: 4px;">
                    ${rel.category}
                  </span>
                  <h4 style="font-family: var(--font-serif); font-size: 1.02rem; font-weight: 700; color: #1c1917; margin: 0 0 6px 0;">
                    ${rel.title}
                  </h4>
                  <p style="font-size: 0.8rem; color: #57534e; margin: 0; line-height: 1.45;">
                    ${rel.description || ""}
                  </p>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      </main>
    </div>
  `;
}

// ============================================================================
// GERENCIADOR E EDITOR DO REGISTRO VISUAL (EXCLUSIVO DO ADMINISTRADOR)
// ============================================================================
function compressImageFile(file, maxWidth = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

window.openGaleriaManagerModal = function () {
  if (!window.state.isAdminAuthenticated) {
    window.promptAdminLogin();
    return;
  }
  window.state.galeriaManagerOpen = true;
  window.state.galeriaEditorItem = null;
  renderGaleriaEditorModal();
};

window.openGaleriaEditorModal = function (itemId) {
  if (!window.state.isAdminAuthenticated) {
    window.promptAdminLogin();
    return;
  }
  window.state.galeriaManagerOpen = false;
  if (itemId) {
    const found = GALERIA_FOTOS.find(x => x.id === itemId);
    window.state.galeriaEditorItem = found
      ? JSON.parse(JSON.stringify(found))
      : {
          id: "gal-" + Date.now(),
          title: "",
          category: "Salão Principal",
          image: "",
          extraImages: [],
          description: "",
          fullContent: ""
        };
  } else {
    window.state.galeriaEditorItem = {
      id: "gal-" + Date.now(),
      title: "",
      category: "Salão Principal",
      image: "",
      extraImages: [],
      description: "",
      fullContent: ""
    };
  }
  renderGaleriaEditorModal();
};

window.closeGaleriaEditorModal = function () {
  window.state.galeriaManagerOpen = false;
  window.state.galeriaEditorItem = null;
  renderGaleriaEditorModal();
};

window.handleEditorMainImageUpload = async function (inputEl) {
  const file = inputEl.files && inputEl.files[0];
  if (!file || !window.state.galeriaEditorItem) return;
  syncEditorInputsFromDom();
  const dataUrl = await compressImageFile(file, 1280, 0.82);
  window.state.galeriaEditorItem.image = dataUrl;
  renderGaleriaEditorModal();
};

window.handleEditorExtraImagesUpload = async function (inputEl) {
  const files = inputEl.files ? Array.from(inputEl.files) : [];
  if (!files.length || !window.state.galeriaEditorItem) return;
  syncEditorInputsFromDom();
  if (!Array.isArray(window.state.galeriaEditorItem.extraImages)) {
    window.state.galeriaEditorItem.extraImages = [];
  }
  for (const file of files) {
    const dataUrl = await compressImageFile(file, 1280, 0.8);
    window.state.galeriaEditorItem.extraImages.push(dataUrl);
  }
  renderGaleriaEditorModal();
};

window.removeEditorExtraImage = function (idx) {
  if (!window.state.galeriaEditorItem || !Array.isArray(window.state.galeriaEditorItem.extraImages)) return;
  syncEditorInputsFromDom();
  window.state.galeriaEditorItem.extraImages.splice(idx, 1);
  renderGaleriaEditorModal();
};

function syncEditorInputsFromDom() {
  const ed = window.state.galeriaEditorItem;
  if (!ed) return;
  const tEl = document.getElementById("edGalTitle");
  const cEl = document.getElementById("edGalCategory");
  const imgEl = document.getElementById("edGalImageUrl");
  const dEl = document.getElementById("edGalDesc");
  const fEl = document.getElementById("edGalFullContent");
  if (tEl) ed.title = tEl.value;
  if (cEl) ed.category = cEl.value;
  if (imgEl && imgEl.value.trim()) ed.image = imgEl.value.trim();
  if (dEl) ed.description = dEl.value;
  if (fEl) ed.fullContent = fEl.value;
}

window.saveGaleriaEditorItem = async function () {
  syncEditorInputsFromDom();
  const ed = window.state.galeriaEditorItem;
  if (!ed) return;

  if (!ed.title.trim()) {
    alert("Por favor, digite um Título para o card/página.");
    return;
  }
  if (!ed.image.trim()) {
    alert("Por favor, envie uma foto do seu computador/celular ou cole o link de uma imagem.");
    return;
  }

  const existingIndex = GALERIA_FOTOS.findIndex(x => x.id === ed.id);
  const updated = [...GALERIA_FOTOS];
  if (existingIndex >= 0) {
    updated[existingIndex] = ed;
  } else {
    updated.unshift(ed);
  }

  await saveGaleriaDataToSite(updated);
  window.state.galeriaEditorItem = null;
  window.state.galeriaManagerOpen = true;
  renderGaleriaSection();
  renderRegistroDedicatedPage();
  renderInternalSubpage();
  renderGaleriaEditorModal();
};

window.deleteGaleriaItem = async function (itemId) {
  if (!confirm("Tem certeza que deseja remover este item do Registro Visual?")) return;
  const updated = GALERIA_FOTOS.filter(x => x.id !== itemId);
  await saveGaleriaDataToSite(updated);
  renderGaleriaSection();
  renderInternalSubpage();
  renderGaleriaEditorModal();
};

window.publishGaleriaToVercel = async function () {
  const btn = document.getElementById("btnPublishVercel");
  const statusEl = document.getElementById("vercelPublishStatus");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "⏳ Publicando na Vercel (aguarde ~15s)...";
  }
  if (statusEl) {
    statusEl.innerHTML = `<span style="color:#b45309;font-weight:600;">Enviando atualizações para https://delta-espaco-e-eventos.vercel.app ...</span>`;
  }
  try {
    await saveGaleriaDataToSite(GALERIA_FOTOS);
    const res = await fetch("/api/publish-vercel", { method: "POST" });
    const data = await res.json();
    if (res.ok && data.ok) {
      if (statusEl) {
        statusEl.innerHTML = `<span style="color:#047857;font-weight:700;">✅ Publicado! Acesse: <a href="${data.url}" target="_blank" style="text-decoration:underline;">${data.url}</a></span>`;
      }
    } else {
      if (statusEl) {
        statusEl.innerHTML = `<span style="color:#dc2626;font-weight:600;">Para publicar na Vercel com 1 clique, execute a partir de http://localhost:4080.</span>`;
      }
    }
  } catch (_) {
    if (statusEl) {
      statusEl.innerHTML = `<span style="color:#dc2626;font-weight:600;">Salvo neste navegador! Para publicar na Vercel, use http://localhost:4080 no seu computador.</span>`;
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "🚀 Atualizar Site Público na Vercel Agora";
    }
  }
};

function renderGaleriaEditorModal() {
  const rootEl = document.getElementById("galeriaEditorModalRoot");
  if (!rootEl) return;

  if (!window.state.galeriaManagerOpen && !window.state.galeriaEditorItem) {
    rootEl.innerHTML = "";
    return;
  }

  if (window.state.galeriaManagerOpen && !window.state.galeriaEditorItem) {
    rootEl.innerHTML = `
      <div class="delta-editor-backdrop">
        <div class="delta-editor-modal">
          <div class="delta-editor-header">
            <div>
              <h3>Gerenciar Registro Visual (Fotos & Páginas)</h3>
              <p>Substitua imagens ilustrativas por fotos reais da Delta e edite textos.</p>
            </div>
            <button type="button" onclick="window.closeGaleriaEditorModal()" class="delta-reg-back-btn" style="padding: 8px 10px;">
              ${icon("x", "w-5 h-5")}
            </button>
          </div>

          <div class="delta-editor-subbar">
            <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 10px;">
              <button type="button" onclick="window.openGaleriaEditorModal(null)" class="delta-action-btn-primary">
                + Adicionar Nova Foto / Página
              </button>
              <button
                type="button"
                id="btnPublishVercel"
                onclick="window.publishGaleriaToVercel()"
                class="delta-action-btn-primary"
                style="background-color: #059669;"
              >
                🚀 Atualizar Site Público na Vercel Agora
              </button>
            </div>
            <div id="vercelPublishStatus" style="font-size: 0.8rem;"></div>
          </div>

          <div class="delta-editor-body">
            ${GALERIA_FOTOS.map(
              item => `
              <div class="delta-editor-row-card">
                <div class="delta-editor-row-info">
                  <img src="${item.image}" alt="${item.title}" class="delta-editor-row-thumb" />
                  <div style="min-width: 0;">
                    <span style="font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #92400e; display: block;">
                      ${item.category} ${isIllustrativeImage(item.image) ? "· (Foto ilustrativa)" : "· (Foto real)"}
                    </span>
                    <h4 style="font-family: var(--font-serif); font-size: 1rem; font-weight: 700; color: #1c1917; margin: 2px 0;">
                      ${item.title}
                    </h4>
                    <p style="font-size: 0.78rem; color: #57534e; margin: 0;">${item.description || ""}</p>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                  <button
                    type="button"
                    onclick="window.closeGaleriaEditorModal(); window.openRegistroPage('${item.id}')"
                    class="delta-action-btn-secondary"
                    style="padding: 7px 12px; font-size: 0.76rem;"
                  >
                    Ver Página
                  </button>
                  <button
                    type="button"
                    onclick="window.openGaleriaEditorModal('${item.id}')"
                    class="delta-action-btn-primary"
                    style="padding: 7px 12px; font-size: 0.76rem;"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    type="button"
                    onclick="window.deleteGaleriaItem('${item.id}')"
                    class="delta-action-btn-secondary"
                    style="padding: 7px 12px; font-size: 0.76rem; color: #b91c1c; border-color: #fecaca; background-color: #fef2f2;"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            `
            ).join("")}
          </div>
        </div>
      </div>
    `;
    return;
  }

  const ed = window.state.galeriaEditorItem;
  const extraImages = Array.isArray(ed.extraImages) ? ed.extraImages : [];

  rootEl.innerHTML = `
    <div class="delta-editor-backdrop">
      <div class="delta-editor-modal">
        <div class="delta-editor-header">
          <div>
            <h3>${ed.title ? `Editar: ${ed.title}` : "Nova Foto & Página Explicativa"}</h3>
            <p>Envie fotografias reais da Delta, defina o título e escreva os parágrafos explicativos.</p>
          </div>
          <button type="button" onclick="window.closeGaleriaEditorModal()" class="delta-reg-back-btn" style="padding: 8px 10px;">
            ${icon("x", "w-5 h-5")}
          </button>
        </div>

        <div class="delta-editor-body">
          <div class="delta-editor-form-row">
            <div>
              <label class="delta-editor-label">Título do Card e da Página *</label>
              <input
                id="edGalTitle"
                type="text"
                value="${(ed.title || "").replace(/"/g, "&quot;")}"
                placeholder="Ex: Coffee Break Sebrae no Salão Intimista"
                class="delta-editor-input"
              />
            </div>

            <div>
              <label class="delta-editor-label">Categoria *</label>
              <input
                id="edGalCategory"
                type="text"
                list="edGalCategoryList"
                value="${(ed.category || "Salão Principal").replace(/"/g, "&quot;")}"
                class="delta-editor-input"
              />
              <datalist id="edGalCategoryList">
                <option value="Salão Principal"></option>
                <option value="Buffet & Gastronomia"></option>
                <option value="Eventos Corporativos"></option>
                <option value="Escadaria"></option>
                <option value="Mesa de Doces"></option>
              </datalist>
            </div>
          </div>

          <div class="delta-editor-upload-box">
            <label class="delta-editor-label" style="margin-bottom: 2px;">
              1. Foto Principal de Capa (Computador/Celular ou Link) *
            </label>
            <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 16px;">
              ${
                ed.image
                  ? `<img src="${ed.image}" alt="Preview" style="width: 120px; height: 84px; border-radius: 12px; object-fit: cover; border: 1px solid #d6d3d1; flex-shrink: 0;" />`
                  : `<div style="width: 120px; height: 84px; border-radius: 12px; background-color: #e7e5e4; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; color: #78716c; flex-shrink: 0;">Sem foto</div>`
              }
              <div style="flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 10px;">
                <label class="delta-action-btn-primary" style="width: fit-content;">
                  <span>📁 Escolher Foto do Computador / Celular</span>
                  <input type="file" accept="image/*" class="hidden" onchange="window.handleEditorMainImageUpload(this)" />
                </label>
                <input
                  id="edGalImageUrl"
                  type="text"
                  value="${ed.image && !ed.image.startsWith("data:") ? ed.image.replace(/"/g, "&quot;") : ""}"
                  placeholder="Ou cole aqui o link (URL) de uma imagem..."
                  class="delta-editor-input"
                  style="font-size: 0.82rem; padding: 8px 12px;"
                />
              </div>
            </div>
          </div>

          <div class="delta-editor-upload-box">
            <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px;">
              <label class="delta-editor-label" style="margin-bottom: 0;">
                2. Mais Fotos deste Evento / Categoria (Opcional)
              </label>
              <label class="delta-action-btn-secondary" style="padding: 7px 14px; font-size: 0.78rem;">
                <span>📸 + Adicionar Fotos Extras</span>
                <input type="file" accept="image/*" multiple class="hidden" onchange="window.handleEditorExtraImagesUpload(this)" />
              </label>
            </div>
            ${
              extraImages.length > 0
                ? `
              <div style="display: flex; align-items: center; gap: 12px; overflow-x: auto; padding-top: 6px;">
                ${extraImages
                  .map(
                    (imgSrc, idx) => `
                  <div style="position: relative; width: 92px; height: 68px; border-radius: 10px; overflow: hidden; border: 1px solid #d6d3d1; flex-shrink: 0;">
                    <img src="${imgSrc}" style="width: 100%; height: 100%; object-fit: cover;" />
                    <button
                      type="button"
                      onclick="window.removeEditorExtraImage(${idx})"
                      style="position: absolute; top: 4px; right: 4px; width: 20px; height: 20px; border-radius: 999px; background-color: #dc2626; color: #fff; border: none; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;"
                      title="Remover foto"
                    >✕</button>
                  </div>
                `
                  )
                  .join("")}
              </div>
            `
                : `<p style="font-size: 0.8rem; color: #78716c; margin: 0;">Nenhuma foto extra adicionada.</p>`
            }
          </div>

          <div>
            <label class="delta-editor-label">3. Resumo Curto (Aparece no card)</label>
            <input
              id="edGalDesc"
              type="text"
              value="${(ed.description || "").replace(/"/g, "&quot;")}"
              placeholder="Resumo objetivo em 1 frase..."
              class="delta-editor-input"
            />
          </div>

          <div>
            <label class="delta-editor-label">4. Texto Explicativo Completo (Parágrafos da página)</label>
            <textarea
              id="edGalFullContent"
              rows="5"
              placeholder="Descreva os detalhes deste espaço, cardápio ou evento..."
              class="delta-editor-textarea"
            >${ed.fullContent || ""}</textarea>
          </div>
        </div>

        <div class="delta-editor-footer">
          <button type="button" onclick="window.openGaleriaManagerModal()" class="delta-action-btn-secondary">
            ← Voltar para a Lista
          </button>
          <button
            type="button"
            onclick="window.saveGaleriaEditorItem()"
            class="delta-action-btn-primary"
            style="background-color: #059669; padding: 12px 24px; font-size: 0.9rem;"
          >
            ✅ Aceitar e Salvar no Site
          </button>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// BLOCO 5: FORMULÁRIO DE ORÇAMENTO SIMPLIFICADO (DIRETO E TRANSPARENTE)
// ============================================================================
window.syncSimpleBudgetForm = function () {
  const srvEl = document.getElementById("budget-service");
  const dtEl = document.getElementById("budget-date");
  const guestsEl = document.getElementById("budget-guests");
  const nameEl = document.getElementById("budget-name");
  const phoneEl = document.getElementById("budget-contact");
  const notesEl = document.getElementById("budget-notes");

  if (srvEl) window.state.formServico = srvEl.value;
  if (dtEl) window.state.formDataPrevisao = dtEl.value;
  if (guestsEl) window.state.formConvidados = guestsEl.value;
  if (nameEl) window.state.formNome = nameEl.value;
  if (phoneEl) window.state.formContato = phoneEl.value;
  if (notesEl) window.state.formObservacoes = notesEl.value;
};

window.submitSimpleOrcamento = function (e) {
  e.preventDefault();
  window.syncSimpleBudgetForm();

  const clean = (str, max) => (str || "").replace(/[\u0000-\u001F\u007F-\u009F]/g, "").slice(0, max);
  const servico = clean(window.state.formServico, 120);
  const dataPrev = clean(window.state.formDataPrevisao.trim(), 80);
  const convidados = clean(window.state.formConvidados.trim(), 60);
  const nome = clean(window.state.formNome.trim(), 80);
  const contato = clean(window.state.formContato.trim(), 60);
  const obs = clean(window.state.formObservacoes.trim(), 350);

  const isSalgadoOrder = servico.toLowerCase().includes("salgado") || servico.toLowerCase().includes("encomenda");
  const tagHeader = isSalgadoOrder
    ? "🏷️ *[ETIQ: ENCOMENDA DE SALGADOS]*"
    : "🏷️ *[ETIQ: FAZER ORÇAMENTO]*";

  const msg = `${tagHeader}
${nome ? `Olá equipe Delta Espaço e Eventos! Meu nome é *${nome}*.` : `Olá equipe Delta Espaço e Eventos!`}
Gostaria de solicitar um orçamento:

• *Serviço de interesse:* ${servico}
• *Data prevista:* ${dataPrev || "A definir"}
• *Nº estimado de convidados:* ${convidados || "A definir"}${contato ? `\n• *Contato/WhatsApp:* ${contato}` : ""}${obs ? `\n• *Observações:* ${obs}` : ""}

Aguardo retorno sobre disponibilidade e proposta. Obrigado(a)!`;

  // Registra automaticamente no Kanban local do gestor
  KANBAN_LEADS.unshift({
    id: "lead-" + Date.now(),
    nome: nome || "Cliente via Site",
    telefone: contato || "WhatsApp Direto",
    etiqueta: isSalgadoOrder ? "encomenda_salgados" : "fazer_orcamento",
    resumo: `${servico} • Data: ${dataPrev || "A definir"} (${convidados})`,
    dataHora: "Agora"
  });
  saveSalgadosAndKanbanData();

  const waUrl = `https://wa.me/${CONFIG_DELTA.phoneRaw}?text=${encodeURIComponent(msg)}`;
  window.state.generatedWhatsAppUrl = waUrl;
  renderOrcamentoForm();

  const a = document.createElement("a");
  a.href = waUrl;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

function renderOrcamentoForm() {
  const container = document.getElementById("orcamentoFormContainer");
  if (!container) return;

  container.innerHTML = `
    <div class="delta-surface-card w-full" style="background-color: var(--delta-ivory);">
      <form onsubmit="window.submitSimpleOrcamento(event)" class="p-6 sm:p-8 space-y-4">
        ${
          window.state.generatedWhatsAppUrl
            ? `
          <div class="p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5" style="background-color: rgba(7, 86, 56, 0.08); border: 1px solid rgba(7, 86, 56, 0.28); color: var(--delta-graphite);">
            <div class="flex items-center gap-2 text-xs sm:text-sm font-medium">
              ${icon("check", "w-4 h-4 shrink-0")}
              <span>Resumo formatado para o WhatsApp comercial <strong>${CONFIG_DELTA.phoneFormatted}</strong>.</span>
            </div>
            <a
              href="${window.state.generatedWhatsAppUrl}"
              target="_blank"
              rel="noopener noreferrer"
              class="delta-btn-emerald shrink-0"
              style="padding: 8px 16px; font-size: 0.78rem;"
            >
              Abrir Conversa no WhatsApp
            </a>
          </div>
        `
            : ""
        }

        <div>
          <label for="budget-service" class="delta-editor-label">1. Tipo de Serviço *</label>
          <select
            id="budget-service"
            onchange="window.syncSimpleBudgetForm()"
            class="delta-editor-input"
          >
            ${OPCOES_SERVICO_ORCAMENTO.map(
              op => `<option value="${op}" ${window.state.formServico === op ? "selected" : ""}>${op}</option>`
            ).join("")}
          </select>
        </div>

        <div class="delta-simple-form-grid">
          <div>
            <label for="budget-date" class="delta-editor-label">2. Data Prevista (ou Mês)</label>
            <input
              id="budget-date"
              type="text"
              maxlength="80"
              value="${window.state.formDataPrevisao.replace(/"/g, "&quot;")}"
              oninput="window.syncSimpleBudgetForm()"
              placeholder="Ex: 14/11/2026 ou Novembro"
              class="delta-editor-input"
            />
          </div>

          <div>
            <label for="budget-guests" class="delta-editor-label">3. Nº Estimado de Convidados *</label>
            <select
              id="budget-guests"
              onchange="window.syncSimpleBudgetForm()"
              class="delta-editor-input"
            >
              ${[
                "Até 50 pessoas (Reunião / Coffee Break)",
                "50 a 100 pessoas (Delta Corporate)",
                "100 a 150 pessoas",
                "150 a 300 pessoas",
                "300 a 500 pessoas (Delta Royal)",
                "Somente Encomenda / Kits Corporativos"
              ]
                .map(
                  fx => `<option value="${fx}" ${window.state.formConvidados === fx ? "selected" : ""}>${fx}</option>`
                )
                .join("")}
            </select>
          </div>
        </div>

        <div class="delta-simple-form-grid">
          <div>
            <label for="budget-name" class="delta-editor-label">4. Seu Nome ou Empresa *</label>
            <input
              id="budget-name"
              type="text"
              required
              maxlength="80"
              value="${window.state.formNome.replace(/"/g, "&quot;")}"
              oninput="window.syncSimpleBudgetForm()"
              placeholder="Informe seu nome ou empresa"
              class="delta-editor-input"
            />
          </div>

          <div>
            <label for="budget-contact" class="delta-editor-label">5. Seu Telefone / WhatsApp</label>
            <input
              id="budget-contact"
              type="tel"
              maxlength="60"
              value="${window.state.formContato.replace(/"/g, "&quot;")}"
              oninput="window.syncSimpleBudgetForm()"
              placeholder="(99) 98152-2414"
              class="delta-editor-input"
            />
          </div>
        </div>

        <div>
          <label for="budget-notes" class="delta-editor-label">Observações (opcional)</label>
          <textarea
            id="budget-notes"
            rows="2"
            maxlength="350"
            oninput="window.syncSimpleBudgetForm()"
            placeholder="Ex: Evento corporativo pela manhã, necessidade de nota fiscal, ou dúvida específica..."
            class="delta-editor-textarea"
          >${window.state.formObservacoes}</textarea>
        </div>

        <div class="pt-2">
          <button
            type="submit"
            class="delta-btn-emerald w-full py-3.5 text-sm sm:text-base min-h-[48px]"
          >
            ${icon("messageCircle", "w-5 h-5 shrink-0")}
            <span>Enviar Pedido de Orçamento via WhatsApp</span>
          </button>
        </div>
      </form>
    </div>
  `;
}

// ============================================================================
// 1. CENTRAL DE TRIAGEM INTELIGENTE DO WHATSAPP (SEPARA AS FRENTES DE ATENDIMENTO)
// ============================================================================
window.openWhatsAppTriageModal = function () {
  window.state.triageModalOpen = true;
  renderWhatsAppTriageModal();
};

window.closeWhatsAppTriageModal = function () {
  window.state.triageModalOpen = false;
  renderWhatsAppTriageModal();
};

function renderWhatsAppTriageModal() {
  const rootEl = document.getElementById("whatsappTriageModalRoot");
  if (!rootEl) return;
  if (!window.state.triageModalOpen) {
    rootEl.innerHTML = "";
    return;
  }

  rootEl.innerHTML = `
    <div class="delta-editor-backdrop" onclick="window.closeWhatsAppTriageModal()">
      <div class="delta-editor-modal" style="max-width: 780px;" onclick="event.stopPropagation()">
        <div class="delta-editor-header">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="./logo-brasao.png" alt="Brasão Delta" style="width: 42px; height: auto;" />
            <div>
              <h3>Central de Atendimento & Triagem Rápida</h3>
              <p>Escolha o assunto para direcionarmos seu atendimento sem fila de espera:</p>
            </div>
          </div>
          <button type="button" onclick="window.closeWhatsAppTriageModal()" class="delta-reg-back-btn" style="padding: 6px 10px;">
            ${icon("x", "w-5 h-5")}
          </button>
        </div>

        <div class="delta-editor-body">
          <div class="delta-triage-choice-grid">
            <!-- FRENTE 1: ENCOMENDA DE SALGADOS FRITOS E CARDÁPIO -->
            <div class="delta-triage-card" onclick="window.closeWhatsAppTriageModal(); window.openSalgadosMenuModal();">
              <div>
                <span class="delta-tag-pill" style="background:#ffedd5;color:#9a3412;border:1px solid #fdba74;margin-bottom:10px;">
                  🟠 Encomenda Rápida
                </span>
                <h4 style="font-family:var(--font-serif);font-size:1.15rem;font-weight:700;color:var(--delta-graphite);margin:0 0 6px 0;">
                  🥟 Salgados Fritos, Doces & Cardápio
                </h4>
                <p style="font-size:0.8rem;color:var(--delta-graphite-muted);line-height:1.5;margin:0;">
                  Consulte o cardápio pronto de salgados fritos na hora, assados e doces, escolha as quantidades e envie sua encomenda pronta.
                </p>
              </div>
              <div class="delta-emerald-link" style="margin-top:8px;">
                <span>Abrir Cardápio de Salgados</span>
                ${icon("chevronRight", "w-4 h-4")}
              </div>
            </div>

            <!-- FRENTE 2: ORÇAMENTO DE ESPAÇO (DELTA ROYAL / CORPORATE) OU BUFFET -->
            <div
              class="delta-triage-card"
              onclick="window.closeWhatsAppTriageModal(); const el = document.getElementById('orcamento'); if(el) el.scrollIntoView({ behavior: 'smooth' });"
            >
              <div>
                <span class="delta-tag-pill" style="background:#fef9c3;color:#854d0e;border:1px solid #fde047;margin-bottom:10px;">
                  🟡 Fazer Orçamento
                </span>
                <h4 style="font-family:var(--font-serif);font-size:1.15rem;font-weight:700;color:var(--delta-graphite);margin:0 0 6px 0;">
                  🏛️ Orçamento de Espaço ou Buffet
                </h4>
                <p style="font-size:0.8rem;color:var(--delta-graphite-muted);line-height:1.5;margin:0;">
                  Locação do <strong>Delta Royal</strong> (até 500p), <strong>Delta Corporate</strong> (até 100p), Coffee Breaks, Almoços, Jantares e Casamentos.
                </p>
              </div>
              <div class="delta-emerald-link" style="margin-top:8px;">
                <span>Montar Pedido de Orçamento</span>
                ${icon("chevronRight", "w-4 h-4")}
              </div>
            </div>

            <!-- FRENTE 3: FOTOS DOS ESPAÇOS & INFORMAÇÕES IMEDIATAS -->
            <div
              class="delta-triage-card"
              onclick="window.closeWhatsAppTriageModal(); window.openInternalSubpage('galeria');"
            >
              <div>
                <span class="delta-tag-pill" style="background:#f3e8ff;color:#6b21a8;border:1px solid #d8b4fe;margin-bottom:10px;">
                  🟣 Informações & Fotos
                </span>
                <h4 style="font-family:var(--font-serif);font-size:1.15rem;font-weight:700;color:var(--delta-graphite);margin:0 0 6px 0;">
                  📸 Ver Fotos dos Espaços & Estrutura
                </h4>
                <p style="font-size:0.8rem;color:var(--delta-graphite-muted);line-height:1.5;margin:0;">
                  Veja agora mesmo as fotos do Delta Royal, Delta Corporate, escadaria, mesas e gastronomia sem precisar esperar resposta.
                </p>
              </div>
              <div class="delta-emerald-link" style="margin-top:8px;">
                <span>Acessar Galeria Completa</span>
                ${icon("chevronRight", "w-4 h-4")}
              </div>
            </div>
          </div>

          <div style="padding: 14px 16px; border-radius: 12px; background-color: var(--delta-ivory); border: 1px solid rgba(185,154,75,0.28); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px;">
            <div style="font-size: 0.8rem; color: var(--delta-graphite);">
              <strong>Já possui orçamento em andamento ou outro assunto?</strong> Fale diretamente com nossa recepção comercial:
            </div>
            <a
              href="${getWhatsAppUrl('🏷️ *[ETIQ: FORNECER INFORMAÇÕES]*\nOlá! Gostaria de tirar uma dúvida com o atendimento da Delta Espaço e Eventos.')}"
              target="_blank"
              rel="noopener noreferrer"
              class="delta-btn-secondary"
              style="padding: 8px 14px; font-size: 0.78rem;"
            >
              ${icon("messageCircle", "w-4 h-4")}
              <span>Abrir WhatsApp Direto</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// 2. CARDÁPIO DIGITAL DE SALGADOS FRITOS & ENCOMENDAS (FRENTE SEPARADA)
// ============================================================================
window.openSalgadosMenuModal = function () {
  window.state.salgadosMenuModalOpen = true;
  renderSalgadosMenuModal();
};

window.closeSalgadosMenuModal = function () {
  window.state.salgadosMenuModalOpen = false;
  renderSalgadosMenuModal();
};

window.changeSalgadoQty = function (itemId, delta) {
  syncSalgadosFormInputs();
  const current = window.state.salgadosCart[itemId] || 0;
  const next = Math.max(0, current + delta);
  if (next === 0) {
    delete window.state.salgadosCart[itemId];
  } else {
    window.state.salgadosCart[itemId] = next;
  }
  renderSalgadosMenuModal();
};

function syncSalgadosFormInputs() {
  const dtEl = document.getElementById("salgDataHora");
  const nmEl = document.getElementById("salgNomeCliente");
  const obEl = document.getElementById("salgObservacoes");
  if (dtEl) window.state.salgadosDataEntrega = dtEl.value;
  if (nmEl) window.state.salgadosNomeCliente = nmEl.value;
  if (obEl) window.state.salgadosObs = obEl.value;
}

window.sendSalgadosOrderWhatsApp = function () {
  syncSalgadosFormInputs();
  const selectedLines = [];
  for (const it of CARDAPIO_SALGADOS.items) {
    const q = window.state.salgadosCart[it.id] || 0;
    if (q > 0) {
      selectedLines.push(`• *${q}x* ${it.nome} (${it.unidade})`);
    }
  }

  const nome = (window.state.salgadosNomeCliente || "").trim();
  const dataHora = (window.state.salgadosDataEntrega || "").trim();
  const obs = (window.state.salgadosObs || "").trim();

  const itensTexto =
    selectedLines.length > 0
      ? selectedLines.join("\n")
      : "• Gostaria de receber o cardápio atualizado e fazer uma encomenda de salgados";

  const msg = `🏷️ *[ETIQ: ENCOMENDA DE SALGADOS]*
Olá equipe Delta! ${nome ? `Meu nome é *${nome}*. ` : ""}Gostaria de fazer uma encomenda de salgados/confeitaria:

*ITENS SELECIONADOS:*
${itensTexto}

• *Data e Horário para Retirada/Entrega:* ${dataHora || "A combinar"}${obs ? `\n• *Observações / Sabores:* ${obs}` : ""}

Aguardo confirmação do pedido e chave PIX/valores. Obrigado(a)!`;

  // Registra automaticamente na coluna "Encomenda de Salgados" do Kanban do Gestor
  KANBAN_LEADS.unshift({
    id: "lead-" + Date.now(),
    nome: nome || "Cliente Encomenda Salgados",
    telefone: "Via Cardápio Digital",
    etiqueta: "encomenda_salgados",
    resumo: `${selectedLines.length > 0 ? selectedLines.join(", ") : "Solicitou encomenda de salgados"} • Para: ${dataHora || "A combinar"}`,
    dataHora: "Agora"
  });
  saveSalgadosAndKanbanData();

  const waUrl = `https://wa.me/${CONFIG_DELTA.phoneRaw}?text=${encodeURIComponent(msg)}`;
  window.open(waUrl, "_blank", "noopener,noreferrer");
};

function renderSalgadosMenuModal() {
  const rootEl = document.getElementById("salgadosMenuModalRoot");
  if (!rootEl) return;
  if (!window.state.salgadosMenuModalOpen) {
    rootEl.innerHTML = "";
    return;
  }

  const menuImages = Array.isArray(CARDAPIO_SALGADOS.menuImages) ? CARDAPIO_SALGADOS.menuImages : [];
  const totalSelected = Object.values(window.state.salgadosCart).reduce((a, b) => a + b, 0);

  rootEl.innerHTML = `
    <div class="delta-editor-backdrop" onclick="window.closeSalgadosMenuModal()">
      <div class="delta-editor-modal" style="max-width: 860px;" onclick="event.stopPropagation()">
        <div class="delta-editor-header">
          <div>
            <h3>🥟 Cardápio de Salgados Fritos, Assados & Encomendas</h3>
            <p>Cozinha Central Delta • Encomende direto pelo site com etiqueta prioritária no WhatsApp</p>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            ${
              window.state.isAdminAuthenticated
                ? `
              <button
                type="button"
                onclick="window.closeSalgadosMenuModal(); window.openBotKanbanModal('cardapio');"
                class="delta-reg-edit-top-btn"
              >
                ✏️ Editar Cardápio / Subir Imagem
              </button>
            `
                : ""
            }
            <button type="button" onclick="window.closeSalgadosMenuModal()" class="delta-reg-back-btn" style="padding: 6px 10px;">
              ${icon("x", "w-5 h-5")}
            </button>
          </div>
        </div>

        <div class="delta-editor-body">
          ${
            menuImages.length > 0
              ? `
            <div style="background:var(--delta-ivory);padding:14px;border-radius:14px;border:1px solid rgba(185,154,75,0.35);">
              <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--delta-emerald);margin-bottom:10px;">
                📋 Cardápio Oficial Delta (Clique na imagem para ampliar)
              </div>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;">
                ${menuImages
                  .map(
                    (imgSrc, idx) => `
                  <a href="${imgSrc}" target="_blank" rel="noopener noreferrer" style="display:block;border-radius:10px;overflow:hidden;border:1px solid rgba(185,154,75,0.35);background:#fff;">
                    <img src="${imgSrc}" alt="Cardápio Oficial Delta ${idx + 1}" style="width:100%;height:auto;max-height:420px;object-fit:contain;display:block;margin:0 auto;" />
                  </a>
                `
                  )
                  .join("")}
              </div>
            </div>
          `
              : ""
          }

          <div style="font-size:0.86rem;color:var(--delta-graphite);line-height:1.5;">
            ${CARDAPIO_SALGADOS.observacaoTopo}
          </div>

          <div class="delta-salgados-grid">
            ${CARDAPIO_SALGADOS.items
              .map(it => {
                const qty = window.state.salgadosCart[it.id] || 0;
                return `
                <div class="delta-salgado-item-card" style="${qty > 0 ? "border-color:var(--delta-emerald);background:#f4fbf7;" : ""}">
                  <div style="min-width:0;flex:1;">
                    <span style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--delta-emerald);">
                      ${it.categoria} · ${it.precoTexto}
                    </span>
                    <div style="font-family:var(--font-serif);font-size:0.98rem;font-weight:700;color:var(--delta-graphite);margin:2px 0;">
                      ${it.nome}
                    </div>
                    <div style="font-size:0.75rem;color:var(--delta-graphite-muted);line-height:1.35;">
                      ${it.desc}
                    </div>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                    <button type="button" class="delta-qty-btn" onclick="window.changeSalgadoQty('${it.id}', -1)">−</button>
                    <span style="min-width:22px;text-align:center;font-weight:700;font-size:0.92rem;color:var(--delta-graphite);">${qty}</span>
                    <button type="button" class="delta-qty-btn" onclick="window.changeSalgadoQty('${it.id}', 1)">+</button>
                  </div>
                </div>
              `;
              })
              .join("")}
          </div>

          <div class="delta-editor-form-row" style="padding-top:8px;border-top:1px solid rgba(185,154,75,0.25);">
            <div>
              <label class="delta-editor-label">Seu Nome *</label>
              <input
                id="salgNomeCliente"
                type="text"
                value="${(window.state.salgadosNomeCliente || "").replace(/"/g, "&quot;")}"
                placeholder="Ex: Maria Silva"
                class="delta-editor-input"
              />
            </div>
            <div>
              <label class="delta-editor-label">Data e Horário para Retirada / Entrega *</label>
              <input
                id="salgDataHora"
                type="text"
                value="${(window.state.salgadosDataEntrega || "").replace(/"/g, "&quot;")}"
                placeholder="Ex: Sábado (07/11) às 16h30"
                class="delta-editor-input"
              />
            </div>
          </div>

          <div>
            <label class="delta-editor-label">Sabores Escolhidos / Detalhes do Pedido</label>
            <input
              id="salgObservacoes"
              type="text"
              value="${(window.state.salgadosObs || "").replace(/"/g, "&quot;")}"
              placeholder="Ex: 50 coxinhas, 50 bolinhas de queijo, fritos na hora para retirar..."
              class="delta-editor-input"
            />
          </div>
        </div>

        <div class="delta-editor-footer">
          <div style="font-size:0.82rem;color:var(--delta-graphite);">
            <strong>Itens selecionados:</strong> ${totalSelected} ${totalSelected === 1 ? "item" : "itens"}
            <span style="display:block;font-size:0.72rem;color:var(--delta-graphite-muted);">
              Etiqueta automática: 🟠 [ETIQ: ENCOMENDA DE SALGADOS]
            </span>
          </div>
          <button
            type="button"
            onclick="window.sendSalgadosOrderWhatsApp()"
            class="delta-btn-emerald"
            style="padding: 12px 24px;"
          >
            ${icon("messageCircle", "w-5 h-5")}
            <span>Enviar Encomenda de Salgados no WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// 3. PAINEL DO PROPRIETÁRIO: ROBÔ WHATSAPP, KANBAN DE ETIQUETAS & CARDÁPIO
// ============================================================================
window.openBotKanbanModal = function (tab = "kanban") {
  if (!window.state.isAdminAuthenticated) {
    window.promptAdminLogin();
    return;
  }
  window.state.botKanbanModalOpen = true;
  window.state.botKanbanActiveTab = tab;
  renderBotKanbanModal();
};

window.closeBotKanbanModal = function () {
  window.state.botKanbanModalOpen = false;
  renderBotKanbanModal();
};

window.setBotKanbanTab = function (tab) {
  window.state.botKanbanActiveTab = tab;
  renderBotKanbanModal();
};

window.moveKanbanLead = function (leadId, newTag) {
  const found = KANBAN_LEADS.find(l => l.id === leadId);
  if (found) {
    found.etiqueta = newTag;
    saveSalgadosAndKanbanData();
    renderBotKanbanModal();
  }
};

window.deleteKanbanLead = function (leadId) {
  KANBAN_LEADS = KANBAN_LEADS.filter(l => l.id !== leadId);
  saveSalgadosAndKanbanData();
  renderBotKanbanModal();
};

window.addNewKanbanLead = function () {
  const nEl = document.getElementById("newLeadNome");
  const tEl = document.getElementById("newLeadTel");
  const eEl = document.getElementById("newLeadEtiqueta");
  const rEl = document.getElementById("newLeadResumo");

  const nome = nEl ? nEl.value.trim() : "";
  const tel = tEl ? tEl.value.trim() : "";
  const etiq = eEl ? eEl.value : "fazer_orcamento";
  const resumo = rEl ? rEl.value.trim() : "";

  if (!nome) {
    alert("Informe o nome do cliente ou contato.");
    return;
  }

  KANBAN_LEADS.unshift({
    id: "lead-" + Date.now(),
    nome,
    telefone: tel || "(99) 9...",
    etiqueta: etiq,
    resumo: resumo || "Atendimento registrado no painel.",
    dataHora: "Agora"
  });
  saveSalgadosAndKanbanData();
  renderBotKanbanModal();
};

window.sendQuickWhatsAppReply = function (telefone, tipoResposta, nomeCliente) {
  const cleanPhone = (telefone || "").replace(/\D/g, "");
  const destPhone = cleanPhone.length >= 10 ? (cleanPhone.startsWith("55") ? cleanPhone : "55" + cleanPhone) : "";
  const baseUrl = destPhone ? `https://wa.me/${destPhone}` : `https://wa.me/`;

  let msg = "";
  const siteLink = window.location.origin;

  if (tipoResposta === "cardapio_salgados") {
    msg = `Olá *${nomeCliente || ""}*! Tudo bem? 🥟✨\nSegue o nosso *Cardápio de Salgados Fritos, Assados e Doces* da Delta Espaço e Eventos:\n\n👉 Acesse e escolha os itens aqui: ${siteLink}/#buffet\n\nMe informe os itens, a quantidade (cento/meio cento) e o horário para retirada que já deixamos tudo agendado!`;
  } else if (tipoResposta === "fotos_espacos") {
    msg = `Olá *${nomeCliente || ""}*! 🏛️✨\nAqui estão as fotos e detalhes dos nossos dois espaços climatizados em Bacabal:\n\n• *Delta Royal* (400 a 500 pessoas)\n• *Delta Corporate* (até 100 pessoas)\n\n👉 Veja as fotos em: ${siteLink}/#/galeria\n\nQual a data prevista e o número estimado de convidados do seu evento?`;
  } else if (tipoResposta === "orcamento_aprovacao") {
    msg = `Olá *${nomeCliente || ""}*! 📄✨\nElaboramos a sua proposta personalizada da *Delta Espaço e Eventos*.\n\nEstou enviando os detalhes para sua avaliação (Etiqueta: *Orçamento para Aprovação*). Ficou alguma dúvida sobre o cardápio ou estrutura?`;
  } else if (tipoResposta === "aprovado") {
    msg = `Olá *${nomeCliente || ""}*! 🟢🎉\nSeu orçamento/pedido foi *APROVADO e CONFIRMADO* em nossa agenda da Delta Espaço e Eventos!\n\nMuito obrigado pela confiança. Qualquer dúvida estamos à disposição!`;
  }

  window.open(`${baseUrl}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
};

// SIMULADOR DO ROBÔ DE AUTO-RESPOSTA
window.simulateBotIncomingMessage = function (presetText) {
  const inputEl = document.getElementById("botSimInput");
  const rawText = (presetText || (inputEl ? inputEl.value : "")).trim();
  if (!rawText) return;
  if (inputEl) inputEl.value = "";

  window.state.botSimMessages.push({ from: "client", text: rawText });

  const lower = rawText.toLowerCase();
  let botReply = "";
  let appliedTag = "";

  if (lower.includes("fornecedor") || lower.includes("parente") || lower === "4") {
    appliedTag = "⚪ Fornecedor / Parente (Robô Pausado)";
    botReply = `🛡️ *[ROBÔ PAUSADO AUTOMATICAMENTE]*\nContato identificado como *Fornecedor / Pessoal*. O robô não enviará menus automáticos para este contato.`;
  } else if (
    lower === "1" ||
    lower.includes("salgado") ||
    lower.includes("cardapio") ||
    lower.includes("cardápio") ||
    lower.includes("coxinha") ||
    lower.includes("cento") ||
    lower.includes("frito")
  ) {
    appliedTag = "🟠 Encomenda de Salgados + 🟣 Fornecer Informações";
    botReply = `🥟 *Atendimento Automático — Encomenda de Salgados Delta*\n\nAqui está o nosso *Cardápio de Salgados Fritos e Confeitaria*:\n• Cento / Meio Cento de Salgados Fritos Sortidos (Coxinha, Bolinha de Queijo, Quibe, Pastelzinho)\n• Salgados Especiais (Camarão Empanado, Patinha de Caranguejo, Mini Quiches)\n• Empadão, Pão Italiano e Docinhos\n\n👉 *Monte seu pedido rápido ou veja a foto do cardápio em:* ${window.location.origin}/#buffet\n\nPor favor, informe:\n1. Quais salgados e quantidade?\n2. Qual a data e horário para retirada?\n\n🏷️ *Etiqueta aplicada automaticamente:* \`🟠 Encomenda de Salgados\``;
  } else if (
    lower === "3" ||
    lower.includes("foto") ||
    lower.includes("imagem") ||
    lower.includes("conhecer") ||
    lower.includes("ver o espaço") ||
    lower.includes("ver o salão")
  ) {
    appliedTag = "🟣 Fornecer Informações (Cardápio / Fotos)";
    botReply = `📸 *Fotos & Estrutura — Delta Espaço e Eventos*\n\nContamos com dois espaços climatizados independentes na Rua Rui Barbosa, 373, Centro:\n🏛️ *Delta Royal:* para 400 a 500 convidados\n🏢 *Delta Corporate:* para até 100 convidados\n\n👉 *Veja todas as fotos dos salões, escadaria e buffet aqui:* ${window.location.origin}/#/galeria\n\nDeseja aproveitar para fazer um orçamento de data? Digite *2*!\n\n🏷️ *Etiqueta aplicada automaticamente:* \`🟣 Fornecer Informações\``;
  } else if (
    lower === "2" ||
    lower.includes("orçamento") ||
    lower.includes("orcamento") ||
    lower.includes("royal") ||
    lower.includes("corporate") ||
    lower.includes("casamento") ||
    lower.includes("evento") ||
    lower.includes("buffet") ||
    lower.includes("coffee")
  ) {
    appliedTag = "🟡 Fazer Orçamento";
    botReply = `🏛️ *Solicitação de Orçamento — Delta Espaço e Eventos*\n\nPerfeito! Já marquei sua conversa com a etiqueta prioritária *🟡 Fazer Orçamento* para o Leonardo elaborar sua proposta.\n\nPara adiantarmos, me informe por favor:\n1️⃣ Qual o formato (Delta Royal até 500p, Delta Corporate até 100p, ou somente Buffet/Coffee Break)?\n2️⃣ Qual a *data prevista*?\n3️⃣ Qual a *quantidade estimada de pessoas*?\n\n🏷️ *Etiqueta aplicada automaticamente:* \`🟡 Fazer Orçamento\``;
  } else {
    botReply = `Olá! Sou o assistente automático da *Delta Espaço e Eventos* 🏛️\nPara eu colocar a etiqueta certa e te atender na hora, escolha uma opção:\n\n1️⃣ *Encomendar Salgados Fritos / Cardápio Pronto*\n2️⃣ *Fazer Orçamento de Evento / Espaço (Delta Royal ou Corporate) / Buffet*\n3️⃣ *Receber Fotos dos Espaços e Informações*\n4️⃣ *Sou Fornecedor / Contato Pessoal*`;
  }

  window.state.botSimMessages.push({ from: "bot", text: botReply, tag: appliedTag });
  renderBotKanbanModal();
};

// UPLOAD DA IMAGEM DO CARDÁPIO PRONTO DO LEONARDO
window.handleUploadCardapioImage = async function (inputEl) {
  const files = inputEl.files ? Array.from(inputEl.files) : [];
  if (!files.length) return;
  if (!Array.isArray(CARDAPIO_SALGADOS.menuImages)) {
    CARDAPIO_SALGADOS.menuImages = [];
  }
  for (const file of files) {
    const dataUrl = await compressImageFile(file, 1400, 0.85);
    CARDAPIO_SALGADOS.menuImages.push(dataUrl);
  }
  saveSalgadosAndKanbanData();
  renderBotKanbanModal();
};

window.removeCardapioImage = function (idx) {
  if (!Array.isArray(CARDAPIO_SALGADOS.menuImages)) return;
  CARDAPIO_SALGADOS.menuImages.splice(idx, 1);
  saveSalgadosAndKanbanData();
  renderBotKanbanModal();
};

window.addCardapioSalgadoItem = function () {
  const nEl = document.getElementById("newSalgNome");
  const uEl = document.getElementById("newSalgUnid");
  const pEl = document.getElementById("newSalgPreco");
  const dEl = document.getElementById("newSalgDesc");

  const nome = nEl ? nEl.value.trim() : "";
  if (!nome) {
    alert("Digite o nome do salgado ou item do cardápio.");
    return;
  }
  CARDAPIO_SALGADOS.items.push({
    id: "salg-" + Date.now(),
    nome,
    unidade: (uEl && uEl.value.trim()) || "Cento / Porção",
    categoria: "Cardápio Delta",
    precoTexto: (pEl && pEl.value.trim()) || "Sob consulta",
    desc: (dEl && dEl.value.trim()) || "Preparado na Cozinha Central Delta."
  });
  saveSalgadosAndKanbanData();
  renderBotKanbanModal();
};

window.deleteCardapioSalgadoItem = function (id) {
  CARDAPIO_SALGADOS.items = CARDAPIO_SALGADOS.items.filter(x => x.id !== id);
  saveSalgadosAndKanbanData();
  renderBotKanbanModal();
};

window.addIgnoredContact = function () {
  const nEl = document.getElementById("igNome");
  const tEl = document.getElementById("igTel");
  const tpEl = document.getElementById("igTipo");
  const nome = nEl ? nEl.value.trim() : "";
  const telefone = tEl ? tEl.value.trim() : "";
  const tipo = tpEl ? tpEl.value : "Fornecedor";
  if (!nome) {
    alert("Informe o nome do fornecedor ou parente.");
    return;
  }
  IGNORED_CONTACTS.unshift({
    id: "ig-" + Date.now(),
    nome,
    telefone: telefone || "—",
    tipo
  });
  saveSalgadosAndKanbanData();
  renderBotKanbanModal();
};

window.removeIgnoredContact = function (id) {
  IGNORED_CONTACTS = IGNORED_CONTACTS.filter(x => x.id !== id);
  saveSalgadosAndKanbanData();
  renderBotKanbanModal();
};

function renderBotKanbanModal() {
  const rootEl = document.getElementById("botKanbanModalRoot");
  if (!rootEl) return;
  if (!window.state.botKanbanModalOpen) {
    rootEl.innerHTML = "";
    return;
  }

  const tab = window.state.botKanbanActiveTab || "kanban";

  let tabContentHtml = "";

  if (tab === "kanban") {
    tabContentHtml = `
      <!-- ADICIONAR NOVO CLIENTE / PEDIDO AO KANBAN -->
      <div style="background:var(--delta-ivory);padding:14px 16px;border-radius:12px;border:1px solid rgba(185,154,75,0.3);">
        <div style="font-size:0.74rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--delta-emerald);margin-bottom:10px;">
          + Cadastrar Cliente / Pedido em uma Etiqueta
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;align-items:end;">
          <div>
            <label class="delta-editor-label">Nome do Cliente</label>
            <input id="newLeadNome" type="text" placeholder="Ex: Ana Paula" class="delta-editor-input" style="padding:8px 10px;font-size:0.82rem;" />
          </div>
          <div>
            <label class="delta-editor-label">WhatsApp</label>
            <input id="newLeadTel" type="text" placeholder="(99) 981..." class="delta-editor-input" style="padding:8px 10px;font-size:0.82rem;" />
          </div>
          <div>
            <label class="delta-editor-label">Etiqueta Inicial</label>
            <select id="newLeadEtiqueta" class="delta-editor-input" style="padding:8px 10px;font-size:0.82rem;">
              ${KANBAN_ETIQUETAS.map(e => `<option value="${e.id}">${e.emoji} ${e.nome}</option>`).join("")}
            </select>
          </div>
          <div>
            <label class="delta-editor-label">Resumo (Salgados / Evento)</label>
            <input id="newLeadResumo" type="text" placeholder="Ex: 2 centos salgados sáb 17h" class="delta-editor-input" style="padding:8px 10px;font-size:0.82rem;" />
          </div>
          <button type="button" onclick="window.addNewKanbanLead()" class="delta-btn-emerald" style="padding:9px 14px;font-size:0.8rem;">
            + Adicionar
          </button>
        </div>
      </div>

      <!-- QUADRO KANBAN COM AS 6 ETIQUETAS EXATAS -->
      <div class="delta-kanban-board">
        ${KANBAN_ETIQUETAS.map(col => {
          const cards = KANBAN_LEADS.filter(l => l.etiqueta === col.id);
          return `
            <div class="delta-kanban-col">
              <div class="delta-kanban-col-header">
                <span class="delta-tag-pill" style="background:${col.bg};color:${col.text};border:1px solid ${col.border};">
                  ${col.emoji} ${col.nome}
                </span>
                <span style="font-size:0.75rem;font-weight:700;color:var(--delta-graphite-muted);">${cards.length}</span>
              </div>
              <div style="font-size:0.72rem;color:var(--delta-graphite-muted);margin-bottom:4px;">
                ${col.desc}
              </div>

              ${
                cards.length === 0
                  ? `<div style="padding:16px 10px;text-align:center;font-size:0.75rem;color:#9e9b90;border:1px dashed rgba(185,154,75,0.3);border-radius:8px;">Sem contatos nesta etiqueta</div>`
                  : cards
                      .map(
                        c => `
                    <div class="delta-kanban-card">
                      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
                        <div>
                          <div style="font-weight:700;font-size:0.86rem;color:var(--delta-graphite);">${c.nome}</div>
                          <div style="font-size:0.72rem;color:var(--delta-graphite-muted);">${c.telefone} · ${c.dataHora || ""}</div>
                        </div>
                        <button
                          type="button"
                          onclick="window.deleteKanbanLead('${c.id}')"
                          title="Remover card"
                          style="background:transparent;border:none;color:#a8a29e;cursor:pointer;font-size:0.8rem;"
                        >✕</button>
                      </div>
                      <div style="font-size:0.78rem;color:#44403c;line-height:1.4;background:#fafaf9;padding:8px;border-radius:6px;border:1px solid #e7e5e4;">
                        ${c.resumo}
                      </div>

                      <!-- MUDAR ETIQUETA COM 1 CLIQUE -->
                      <div style="display:flex;align-items:center;gap:6px;">
                        <span style="font-size:0.68rem;font-weight:600;color:var(--delta-graphite-muted);">Mover p/:</span>
                        <select
                          onchange="window.moveKanbanLead('${c.id}', this.value)"
                          style="flex:1;font-size:0.72rem;padding:4px 6px;border-radius:6px;border:1px solid #d6d3d1;background:#fff;"
                        >
                          ${KANBAN_ETIQUETAS.map(
                            opt => `<option value="${opt.id}" ${opt.id === c.etiqueta ? "selected" : ""}>${opt.emoji} ${opt.nome}</option>`
                          ).join("")}
                        </select>
                      </div>

                      <!-- RESPOSTAS AUTOMÁTICAS DE 1 CLIQUE NO WHATSAPP -->
                      <div style="display:flex;flex-wrap:wrap;gap:5px;padding-top:4px;border-top:1px solid #f5f5f4;">
                        <button type="button" onclick="window.sendQuickWhatsAppReply('${c.telefone}', 'cardapio_salgados', '${c.nome.replace(/'/g, "")}')" class="delta-quick-reply-btn" title="Enviar Cardápio de Salgados">
                          🥟 Enviar Cardápio
                        </button>
                        <button type="button" onclick="window.sendQuickWhatsAppReply('${c.telefone}', 'fotos_espacos', '${c.nome.replace(/'/g, "")}')" class="delta-quick-reply-btn" title="Enviar Fotos Delta Royal & Corporate">
                          📸 Enviar Fotos
                        </button>
                        <button type="button" onclick="window.sendQuickWhatsAppReply('${c.telefone}', 'orcamento_aprovacao', '${c.nome.replace(/'/g, "")}'); window.moveKanbanLead('${c.id}', 'orcamento_aprovacao');" class="delta-quick-reply-btn" title="Enviar Orçamento para Aprovação">
                          🔵 P/ Aprovação
                        </button>
                        <button type="button" onclick="window.sendQuickWhatsAppReply('${c.telefone}', 'aprovado', '${c.nome.replace(/'/g, "")}'); window.moveKanbanLead('${c.id}', 'aprovado');" class="delta-quick-reply-btn" title="Confirmar Aprovação">
                          🟢 Aprovar
                        </button>
                      </div>
                    </div>
                  `
                      )
                      .join("")
              }
            </div>
          `;
        }).join("")}
      </div>
    `;
  } else if (tab === "robo") {
    tabContentHtml = `
      <div class="delta-editor-form-row">
        <div style="background:var(--delta-ivory);padding:18px;border-radius:14px;border:1px solid rgba(185,154,75,0.3);">
          <h4 style="font-family:var(--font-serif);font-size:1.1rem;font-weight:700;color:var(--delta-graphite);margin:0 0 8px 0;">
            🤖 Como o Robô Resolve sua Frente Dupla
          </h4>
          <p style="font-size:0.8rem;color:var(--delta-graphite-muted);line-height:1.55;margin:0 0 12px 0;">
            Assim que o cliente manda mensagem (ou clica no botão do site), o robô separa automaticamente quem quer <strong>Salgados Fritos</strong> de quem quer <strong>Orçamento de Evento / Espaço</strong>:
          </p>
          <ul style="font-size:0.78rem;color:var(--delta-graphite);line-height:1.65;padding-left:18px;margin:0;display:flex;flex-direction:column;gap:6px;">
            <li><strong>Opção 1 (Salgados Fritos):</strong> Envia o Cardápio de Salgados na hora, pergunta quantidade/horário de retirada e aplica a etiqueta <code>🟠 Encomenda de Salgados</code>.</li>
            <li><strong>Opção 2 (Orçamento Delta Royal / Corporate / Buffet):</strong> Pergunta data, nº de convidados e formato do evento e aplica a etiqueta <code>🟡 Fazer Orçamento</code>.</li>
            <li><strong>Opção 3 (Fotos dos Espaços & Informações):</strong> Envia o link direto com as fotos do Delta Royal e Delta Corporate e aplica a etiqueta <code>🟣 Fornecer Informações</code>.</li>
            <li><strong>Fornecedores e Parentes:</strong> Contatos na sua lista de exceção recebem <code>⚪ Robô Pausado</code> para nunca serem incomodados.</li>
          </ul>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          <div style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--delta-emerald);">
            💬 Teste o Robô Agora (Simulador ao Vivo)
          </div>
          <div class="delta-bot-chat-box">
            ${window.state.botSimMessages
              .map(
                m => `
              <div class="${m.from === "bot" ? "delta-bot-msg-out" : "delta-bot-msg-in"}">
                ${m.text}
              </div>
            `
              )
              .join("")}
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            <button type="button" onclick="window.simulateBotIncomingMessage('Quero o cardápio de salgados fritos')" class="delta-quick-reply-btn">
              Testar: "Quero cardápio de salgados"
            </button>
            <button type="button" onclick="window.simulateBotIncomingMessage('Quero fazer orçamento pro Delta Royal')" class="delta-quick-reply-btn">
              Testar: "Orçamento Delta Royal"
            </button>
            <button type="button" onclick="window.simulateBotIncomingMessage('Tem fotos do espaço?')" class="delta-quick-reply-btn">
              Testar: "Tem fotos do espaço?"
            </button>
            <button type="button" onclick="window.simulateBotIncomingMessage('Sou fornecedor de bebidas')" class="delta-quick-reply-btn">
              Testar: "Sou fornecedor"
            </button>
          </div>
          <div style="display:flex;gap:8px;">
            <input
              id="botSimInput"
              type="text"
              placeholder="Digite uma mensagem como se fosse um cliente..."
              class="delta-editor-input"
              style="padding:8px 12px;font-size:0.82rem;"
              onkeydown="if(event.key==='Enter') window.simulateBotIncomingMessage()"
            />
            <button type="button" onclick="window.simulateBotIncomingMessage()" class="delta-btn-emerald" style="padding:8px 16px;font-size:0.82rem;">
              Enviar
            </button>
          </div>
        </div>
      </div>
    `;
  } else if (tab === "cardapio") {
    const imgs = Array.isArray(CARDAPIO_SALGADOS.menuImages) ? CARDAPIO_SALGADOS.menuImages : [];
    tabContentHtml = `
      <div class="delta-editor-upload-box">
        <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;">
          <div>
            <div class="delta-editor-label" style="margin-bottom:2px;">
              1. Enviar Imagem do Seu Cardápio Pronto de Salgados / Confeitaria
            </div>
            <p style="font-size:0.8rem;color:var(--delta-graphite-muted);margin:0;">
              Você pode subir aqui a imagem/arte pronta do seu cardápio (ou enviar no chat para colocarmos para você).
            </p>
          </div>
          <label class="delta-btn-emerald" style="cursor:pointer;">
            <span>📁 Escolher Imagem do Cardápio Pronto</span>
            <input type="file" accept="image/*" multiple class="hidden" onchange="window.handleUploadCardapioImage(this)" />
          </label>
        </div>

        ${
          imgs.length > 0
            ? `
          <div style="display:flex;gap:14px;overflow-x:auto;padding-top:10px;">
            ${imgs
              .map(
                (src, idx) => `
              <div style="position:relative;width:160px;height:200px;border-radius:10px;overflow:hidden;border:1px solid rgba(185,154,75,0.4);background:#fff;flex-shrink:0;">
                <img src="${src}" style="width:100%;height:100%;object-fit:cover;" />
                <button
                  type="button"
                  onclick="window.removeCardapioImage(${idx})"
                  style="position:absolute;top:6px;right:6px;background:#dc2626;color:#fff;border:none;border-radius:999px;width:24px;height:24px;cursor:pointer;font-size:12px;"
                >✕</button>
              </div>
            `
              )
              .join("")}
          </div>
        `
            : `<div style="font-size:0.8rem;color:#78716c;">Nenhuma imagem de cardápio enviada ainda. Clique no botão verde acima ou envie a imagem aqui no chat!</div>`
        }
      </div>

      <div style="background:var(--delta-ivory);padding:14px 16px;border-radius:12px;border:1px solid rgba(185,154,75,0.3);">
        <div class="delta-editor-label">2. Adicionar Item / Preço na Lista Interativa de Salgados</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;align-items:end;">
          <div>
            <label class="delta-editor-label">Nome do Item</label>
            <input id="newSalgNome" type="text" placeholder="Ex: Cento de Coxinha" class="delta-editor-input" style="padding:8px 10px;font-size:0.82rem;" />
          </div>
          <div>
            <label class="delta-editor-label">Unidade</label>
            <input id="newSalgUnid" type="text" placeholder="Ex: 100 unidades" class="delta-editor-input" style="padding:8px 10px;font-size:0.82rem;" />
          </div>
          <div>
            <label class="delta-editor-label">Valor / Preço</label>
            <input id="newSalgPreco" type="text" placeholder="Ex: R$ 95,00" class="delta-editor-input" style="padding:8px 10px;font-size:0.82rem;" />
          </div>
          <div>
            <label class="delta-editor-label">Descrição curta</label>
            <input id="newSalgDesc" type="text" placeholder="Ex: Fritos na hora" class="delta-editor-input" style="padding:8px 10px;font-size:0.82rem;" />
          </div>
          <button type="button" onclick="window.addCardapioSalgadoItem()" class="delta-btn-emerald" style="padding:9px 14px;font-size:0.8rem;">
            + Adicionar Item
          </button>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;">
        ${CARDAPIO_SALGADOS.items
          .map(
            it => `
          <div class="delta-editor-row-card">
            <div>
              <div style="font-weight:700;font-size:0.9rem;color:var(--delta-graphite);">${it.nome} <span style="color:var(--delta-emerald);">(${it.precoTexto})</span></div>
              <div style="font-size:0.76rem;color:var(--delta-graphite-muted);">${it.unidade} · ${it.desc}</div>
            </div>
            <button
              type="button"
              onclick="window.deleteCardapioSalgadoItem('${it.id}')"
              class="delta-btn-secondary"
              style="padding:6px 12px;font-size:0.75rem;color:#b91c1c;border-color:#fecaca;"
            >
              Remover
            </button>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  } else if (tab === "fornecedores") {
    tabContentHtml = `
      <div style="background:var(--delta-ivory);padding:16px;border-radius:12px;border:1px solid rgba(185,154,75,0.3);">
        <h4 style="font-family:var(--font-serif);font-size:1.05rem;font-weight:700;color:var(--delta-graphite);margin:0 0 6px 0;">
          🛡️ Lista de Fornecedores & Parentes (Robô Pausado)
        </h4>
        <p style="font-size:0.8rem;color:var(--delta-graphite-muted);margin:0 0 12px 0;">
          Cadastre aqui os contatos de parentes e fornecedores para que o robô <strong>não</strong> envie mensagens automáticas de orçamento ou cardápio para eles.
        </p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;align-items:end;">
          <div>
            <label class="delta-editor-label">Nome (Parente ou Fornecedor)</label>
            <input id="igNome" type="text" placeholder="Ex: Distribuidora São José / Mãe" class="delta-editor-input" style="padding:8px 10px;font-size:0.82rem;" />
          </div>
          <div>
            <label class="delta-editor-label">Telefone / WhatsApp</label>
            <input id="igTel" type="text" placeholder="(99) 9..." class="delta-editor-input" style="padding:8px 10px;font-size:0.82rem;" />
          </div>
          <div>
            <label class="delta-editor-label">Categoria</label>
            <select id="igTipo" class="delta-editor-input" style="padding:8px 10px;font-size:0.82rem;">
              <option value="Fornecedor">Fornecedor</option>
              <option value="Parente / Familiar">Parente / Familiar</option>
              <option value="Equipe Interna">Equipe Interna</option>
            </select>
          </div>
          <button type="button" onclick="window.addIgnoredContact()" class="delta-btn-emerald" style="padding:9px 14px;font-size:0.8rem;">
            + Pausar Robô p/ este Contato
          </button>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;">
        ${IGNORED_CONTACTS.map(
          ig => `
          <div class="delta-editor-row-card">
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="delta-tag-pill" style="background:#f5f5f4;color:#44403c;border:1px solid #d6d3d1;">⚪ ${ig.tipo}</span>
              <div>
                <div style="font-weight:700;font-size:0.88rem;color:var(--delta-graphite);">${ig.nome}</div>
                <div style="font-size:0.75rem;color:var(--delta-graphite-muted);">${ig.telefone}</div>
              </div>
            </div>
            <button
              type="button"
              onclick="window.removeIgnoredContact('${ig.id}')"
              class="delta-btn-secondary"
              style="padding:6px 12px;font-size:0.75rem;"
            >
              Remover da Exceção
            </button>
          </div>
        `
        ).join("")}
      </div>
    `;
  }

  rootEl.innerHTML = `
    <div class="delta-editor-backdrop" onclick="window.closeBotKanbanModal()">
      <div class="delta-editor-modal" style="max-width: 1120px;" onclick="event.stopPropagation()">
        <div class="delta-editor-header">
          <div>
            <h3>🤖 Central WhatsApp Delta: Robô de Triagem, Etiquetas & Cardápio de Salgados</h3>
            <p>Organize orçamentos de eventos, encomendas de salgados fritos e fornecedores em um só lugar.</p>
          </div>
          <button type="button" onclick="window.closeBotKanbanModal()" class="delta-reg-back-btn" style="padding: 8px 10px;">
            ${icon("x", "w-5 h-5")}
          </button>
        </div>

        <div class="delta-editor-subbar">
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            <button
              type="button"
              onclick="window.setBotKanbanTab('kanban')"
              class="delta-tab-btn ${tab === "kanban" ? "active" : ""}"
            >
              📋 Quadro de Etiquetas (Kanban)
            </button>
            <button
              type="button"
              onclick="window.setBotKanbanTab('robo')"
              class="delta-tab-btn ${tab === "robo" ? "active" : ""}"
            >
              🤖 Robô de Auto-Resposta (Simulador)
            </button>
            <button
              type="button"
              onclick="window.setBotKanbanTab('cardapio')"
              class="delta-tab-btn ${tab === "cardapio" ? "active" : ""}"
            >
              🥟 Cardápio de Salgados (${CARDAPIO_SALGADOS.items.length})
            </button>
            <button
              type="button"
              onclick="window.setBotKanbanTab('fornecedores')"
              class="delta-tab-btn ${tab === "fornecedores" ? "active" : ""}"
            >
              🛡️ Fornecedores & Parentes (${IGNORED_CONTACTS.length})
            </button>
          </div>

          <button
            type="button"
            onclick="window.closeBotKanbanModal(); window.openSalgadosMenuModal();"
            class="delta-btn-secondary"
            style="padding:7px 14px;font-size:0.76rem;"
          >
            👁️ Ver Cardápio como Cliente
          </button>
        </div>

        <div class="delta-editor-body">
          ${tabContentHtml}
        </div>
      </div>
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", initApp);
