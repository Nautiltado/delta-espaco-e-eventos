const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");
const { initAndSeedDatabase } = require("./db/seed");

const PORT = process.env.PORT || 4080;
const DB_PATH = path.join(__dirname, "db", "delta-os.sqlite");
const db = initAndSeedDatabase(DB_PATH);

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 35 * 1024 * 1024) reject(new Error("Payload too large"));
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function ensureBeoAndLogistica(eventoId) {
  const existing = db.prepare("SELECT COUNT(*) AS c FROM beo_cronograma WHERE evento_id = ?").get(eventoId).c;
  if (existing > 0) return;

  const ev = db.prepare("SELECT * FROM eventos_orcamentos WHERE id = ?").get(eventoId);
  if (!ev) return;

  const insBeo = db.prepare(`
    INSERT INTO beo_cronograma (evento_id, ordem, horario, setor, etapa, descricao_operacional, temperatura_alvo, responsavel, status_execucao)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insBeo.run(eventoId, 1, "T-180 min", "COZINHA_CENTRAL", "Mise-en-place e Pré-preparo Térmico", `Separação de insumos e pré-cocção para ${ev.numero_historico} (${ev.cliente_nome}): ${ev.resumo_servico}`, "Refrigeração 4°C / Cocção >74°C", "Chef Cozinha Central", "PENDENTE");
  insBeo.run(eventoId, 2, "T-90 min", "LOGISTICA", "Acondicionamento em Hotboxes e Expedição", "Pré-aquecimento dos Hotboxes de polietileno/isopor de alta densidade e conferência de fogões modulares, rechauds e louças", "Hotbox >65°C / Frios <5°C", "Coord. Logística Delta", "PENDENTE");
  insBeo.run(eventoId, 3, "T-30 min", "SALAO_GARCONS", "Montagem de Ilha Gastronômica / Recepção e Bebidas", "Montagem de estação de boas-vindas, Grazing Table / café regional, jarras de sucos naturais e garrafas térmicas", "Bebidas 2°C a 4°C", "Garçom Chefe / Maitre", "PENDENTE");
  insBeo.run(eventoId, 4, `${ev.hora_inicio || "19:00"}`, "FRITURA", "Saída de Salgados Volantes & Entradas Quentes", "Fritura imediata em fogão modular de alta pressão (camarão em panko, patinha de caranguejo, coxinha gourmet, pastel c/ geleia)", "180°C óleo / Servir a 70°C", "Equipe de Fritura", "PENDENTE");
  insBeo.run(eventoId, 5, "T+60 min", "COZINHA_CENTRAL", "Serviço Principal (Jantar / Almoço / Buffet)", "Abastecimento de rechauds ou empratamento de proteínas e arrozes especiais", "Acima de 65°C constante", "Chef Cozinha Central + Garçons", "PENDENTE");
  insBeo.run(eventoId, 6, "T+120 min", "CONFEITARIA", "Saída de Sobremesas & Lanche da Madrugada", "Serviço de Banoffee desconstruída em taças, Taça da Felicidade, mini pudim de baunilha e saída de mini hambúrgueres com batata em cones", "Taças 4°C / Burgers 68°C", "Confeitaria & Copa", "PENDENTE");

  const insLog = db.prepare(`
    INSERT INTO logistica_expedicao (evento_id, equipamento, categoria_equipamento, especificacao_tecnica, quantidade, checked_saida, checked_retorno, observacao)
    VALUES (?, ?, ?, ?, ?, 0, 0, ?)
  `);
  insLog.run(eventoId, "Hotbox Térmico de Polietileno / Isopor de Alta Densidade (GN 1/1)", "HOTBOX_TERMICO", "Isolamento térmico de alta densidade para retenção acima de 65°C por até 4h", 3, "Conferir travas e vedação");
  insLog.run(eventoId, "Fogão Modular de Alta Pressão (2 Bocas Industriais + Mangueira Normatizada)", "COZINHA_MODULAR", "Queimadores duplos de alta pressão para fritura in-loco e finalização rápida", 2, "Botijão P13 lacrado + regulador industrial");
  insLog.run(eventoId, "Cooktop / Módulo de Indução Portátil de Finalização", "COZINHA_MODULAR", "Módulo 220V para redução de molhos (Roti, Brie c/ Alho-Poró, Mostarda Ancienne) no salão", 2, "Finalização limpa no salão");
  insLog.run(eventoId, "Conjunto de Rechauds Inox + Cubas GN + Louças e Talheres Finos", "RECHAUD_LOUCA", "Rechauds completos com álcool gel combustível e jogo de porcelana/taças", 6, "Conferir contagem na saída e retorno");
}

function checkAgendaDisponibilidade(dataEvento, turno, espacoId, ignoreEventoId = null) {
  if (!dataEvento) {
    return { disponivel: true, modo_simultaneo: false, conflitos: [], eventos_mesmo_dia: [] };
  }
  const eventosDia = db.prepare(`
    SELECT id, numero_historico, cliente_nome, espaco_id, bloqueio_complexo_total, turno, hora_inicio, status, resumo_servico, valor_total, publico_exibicao
    FROM eventos_orcamentos
    WHERE data_evento = ? AND status NOT IN ('DUPLICADO', 'CANCELADO')
      AND (? IS NULL OR id != ?)
  `).all(dataEvento, ignoreEventoId, ignoreEventoId);

  const conflitos = [];
  for (const ev of eventosDia) {
    const mesmoTurno = ev.turno === "INTEGRAL" || turno === "INTEGRAL" || ev.turno === turno;
    if (!mesmoTurno) continue;

    if (espacoId === "EXTERNO_CATERING" || ev.espaco_id === "EXTERNO_CATERING") {
      continue;
    }

    if (
      espacoId === "COMPLEXO_TOTAL" ||
      ev.espaco_id === "COMPLEXO_TOTAL" ||
      ev.bloqueio_complexo_total === 1 ||
      ev.espaco_id === espacoId
    ) {
      conflitos.push(ev);
    }
  }

  return {
    disponivel: conflitos.length === 0,
    modo_simultaneo: conflitos.length === 0 && eventosDia.length > 0,
    conflitos,
    eventos_mesmo_dia: eventosDia
  };
}

// Garantir que tenhamos diversas datas distribuídas em Outubro e Novembro de 2026 para o calendário ficar rico em exemplos
function enrichCalendarSampleDates() {
  const sampleDates = [
    ["#06", "2026-10-03", "03/10/2026"],
    ["#07", "2026-10-10", "10/10/2026"],
    ["#08", "2026-10-10", "10/10/2026"],
    ["#09", "2026-10-15", "15/10/2026"],
    ["#20", "2026-10-20", "20/10/2026"],
    ["#26", "2026-10-22", "22/10/2026"],
    ["#29", "2026-10-27", "27/10/2026"],
    ["#38", "2026-11-03", "03/11/2026"],
    ["#41", "2026-11-10", "10/11/2026"],
    ["#63", "2026-11-18", "18/11/2026"],
    ["#65", "2026-11-25", "25/11/2026"]
  ];
  const stmt = db.prepare("UPDATE eventos_orcamentos SET data_evento = ?, data_exibicao = ? WHERE numero_historico = ? AND data_evento IS NULL");
  for (const [num, iso, exib] of sampleDates) {
    stmt.run(iso, exib, num);
  }
}
enrichCalendarSampleDates();

const server = http.createServer(async (req, res) => {
  try {
    const urlObj = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = urlObj.pathname;

    // 1. GET /api/public/calendario (Visão Pública do Cliente: Mostra Marcações/Ocupação MAS OCULTA QUEM MARCOU)
    if (req.method === "GET" && pathname === "/api/public/calendario") {
      const rows = db.prepare(`
        SELECT id, data_evento, turno, hora_inicio, espaco_id, bloqueio_complexo_total, status, modalidade_operacao
        FROM eventos_orcamentos
        WHERE data_evento IS NOT NULL AND status NOT IN ('DUPLICADO', 'CANCELADO')
        ORDER BY data_evento ASC, hora_inicio ASC
      `).all();

      const marcacoesAnonimizadas = rows.map(r => {
        const espacoLabel =
          r.espaco_id === "SALAO_PRINCIPAL" ? "Salão Principal (Espaço Royal)" :
          r.espaco_id === "SALAO_INTIMISTA" ? "Salão Intimista (Espaço Corporate)" :
          r.espaco_id === "COMPLEXO_TOTAL" ? "Complexo Completo" : "Catering Externo";

        return {
          slot_id: `slot-${r.id}`,
          data_evento: r.data_evento,
          turno: r.turno,
          hora_inicio: r.hora_inicio,
          espaco_id: r.espaco_id,
          espaco_label: espacoLabel,
          bloqueio_complexo_total: r.bloqueio_complexo_total,
          situacao_publica: ["CONFIRMADO", "EM_PRODUCAO", "REALIZADO"].includes(r.status) ? "RESERVADO" : "PRE_RESERVA",
          rotulo_publico: ["CONFIRMADO", "EM_PRODUCAO", "REALIZADO"].includes(r.status)
            ? `Reservado · ${espacoLabel}`
            : `Pré-Reserva · ${espacoLabel}`
          // NENHUM dado de cliente_nome, valor_total, resumo_servico ou telefone é exposto ao público!
        };
      });

      return sendJson(res, 200, {
        modo: "PUBLICO_ANONIMIZADO",
        marcacoes: marcacoesAnonimizadas
      });
    }

    // 2. GET /api/bootstrap (Visão Completa + Admin)
    if (req.method === "GET" && pathname === "/api/bootstrap") {
      const instituicao = db.prepare("SELECT * FROM instituicao WHERE id = 1").get();
      const espacos = db.prepare("SELECT * FROM espacos").all();
      const catalogo = db.prepare("SELECT * FROM catalogo_itens WHERE ativo = 1 ORDER BY id ASC").all();
      const clientes = db.prepare("SELECT * FROM clientes ORDER BY id ASC").all();
      const orcamentos = db.prepare("SELECT * FROM eventos_orcamentos ORDER BY id ASC").all();
      const b2b = db.prepare("SELECT * FROM b2b_cotas_estandes ORDER BY id ASC").all();
      const fiscal = db.prepare("SELECT * FROM fiscal_nfse ORDER BY id DESC").all();
      const beo = db.prepare(`
        SELECT b.*, e.numero_historico, e.cliente_nome, e.data_exibicao, e.espaco_id
        FROM beo_cronograma b
        JOIN eventos_orcamentos e ON e.id = b.evento_id
        ORDER BY b.evento_id ASC, b.ordem ASC
      `).all();
      const logistica = db.prepare(`
        SELECT l.*, e.numero_historico, e.cliente_nome, e.data_exibicao, e.espaco_id
        FROM logistica_expedicao l
        JOIN eventos_orcamentos e ON e.id = l.evento_id
        ORDER BY l.evento_id ASC, l.id ASC
      `).all();

      const validOrcs = orcamentos.filter(o => o.status !== "DUPLICADO");
      const volumeTotalOrcado = validOrcs.reduce((acc, o) => acc + o.valor_total, 0);
      const receitaConfirmadaRealizada = validOrcs
        .filter(o => ["CONFIRMADO", "EM_PRODUCAO", "REALIZADO"].includes(o.status))
        .reduce((acc, o) => acc + o.valor_total, 0);
      const totalSinalRecebido = validOrcs.reduce((acc, o) => acc + o.valor_pago_sinal, 0);
      const saldoAReceberConfirmados = validOrcs
        .filter(o => ["CONFIRMADO", "EM_PRODUCAO"].includes(o.status))
        .reduce((acc, o) => acc + Math.max(0, o.valor_total - o.valor_pago_sinal), 0);

      return sendJson(res, 200, {
        instituicao,
        espacos,
        catalogo,
        clientes,
        orcamentos,
        b2b,
        fiscal,
        beo,
        logistica,
        kpis: {
          total_registros_base: orcamentos.length,
          orcamentos_unicos_ativos: validOrcs.length,
          volume_total_orcado: volumeTotalOrcado,
          receita_confirmada_realizada: receitaConfirmadaRealizada,
          total_sinal_recebido: totalSinalRecebido,
          saldo_a_receber: saldoAReceberConfirmados,
          ticket_medio: +(volumeTotalOrcado / (validOrcs.length || 1)).toFixed(2)
        }
      });
    }

    // 3. GET /api/agenda/check (Público/Admin - Sem expor nomes se public=1)
    if (req.method === "GET" && pathname === "/api/agenda/check") {
      const dataEvento = urlObj.searchParams.get("data") || null;
      const turno = urlObj.searchParams.get("turno") || "NOITE";
      const espacoId = urlObj.searchParams.get("espaco_id") || "SALAO_INTIMISTA";
      const isPublic = urlObj.searchParams.get("public") === "1";
      const result = checkAgendaDisponibilidade(dataEvento, turno, espacoId);

      if (isPublic) {
        return sendJson(res, 200, {
          disponivel: result.disponivel,
          modo_simultaneo: result.modo_simultaneo,
          conflitos: result.conflitos.map(c => ({
            espaco_id: c.espaco_id,
            turno: c.turno,
            hora_inicio: c.hora_inicio,
            rotulo: "Horário já possui marcação neste espaço"
          })),
          eventos_mesmo_dia: result.eventos_mesmo_dia.map(e => ({
            espaco_id: e.espaco_id,
            turno: e.turno,
            hora_inicio: e.hora_inicio,
            rotulo: "Reservado"
          }))
        });
      }

      return sendJson(res, 200, result);
    }

    // 4. GET /api/proposta/:token
    if (req.method === "GET" && pathname.startsWith("/api/proposta/")) {
      const token = pathname.replace("/api/proposta/", "");
      const evento = db.prepare(`
        SELECT e.*, s.nome AS espaco_nome, s.apelido_comercial AS espaco_apelido
        FROM eventos_orcamentos e
        JOIN espacos s ON s.id = e.espaco_id
        WHERE e.token_proposta = ? OR e.numero_historico = ?
      `).get(token, `#${token.replace("delta-prop-", "")}`);

      if (!evento) {
        return sendJson(res, 404, { erro: "Proposta não encontrada" });
      }
      const instituicao = db.prepare("SELECT * FROM instituicao WHERE id = 1").get();
      const pacotes = db.prepare(`
        SELECT * FROM proposta_pacotes
        WHERE evento_id = ?
        ORDER BY ordem_exibicao ASC
      `).all(evento.id).map(p => ({
        ...p,
        itens: JSON.parse(p.itens_json || "[]")
      }));

      return sendJson(res, 200, { instituicao, evento, pacotes });
    }

    // 5. POST /api/proposta/:token/aprovar
    if (req.method === "POST" && pathname.endsWith("/aprovar") && pathname.startsWith("/api/proposta/")) {
      const token = pathname.slice("/api/proposta/".length, -"/aprovar".length);
      const body = await parseBody(req);
      const evento = db.prepare("SELECT * FROM eventos_orcamentos WHERE token_proposta = ?").get(token);
      if (!evento) return sendJson(res, 404, { erro: "Proposta não encontrada" });

      const tier = body.tier || "OURO_EXECUTIVO";
      const pacote = db.prepare("SELECT * FROM proposta_pacotes WHERE evento_id = ? AND tier = ?").get(evento.id, tier);
      const novoValor = pacote ? pacote.valor_total : evento.valor_total;

      db.prepare("UPDATE proposta_pacotes SET selecionado = CASE WHEN tier = ? THEN 1 ELSE 0 END WHERE evento_id = ?").run(tier, evento.id);
      db.prepare(`
        UPDATE eventos_orcamentos
        SET status = 'CONFIRMADO',
            valor_total = ?,
            pacote_ancoragem_escolhido = ?
        WHERE id = ?
      `).run(novoValor, tier, evento.id);

      ensureBeoAndLogistica(evento.id);
      return sendJson(res, 200, { ok: true, evento_id: evento.id, tier_aprovado: tier, novo_valor: novoValor });
    }

    // 6. POST /api/orcamentos (Usado tanto pelo Site do Cliente quanto pelo Admin)
    if (req.method === "POST" && pathname === "/api/orcamentos") {
      const body = await parseBody(req);
      const espacoId = body.espaco_id || "SALAO_INTIMISTA";
      const dataEvento = body.data_evento || null;
      const turno = body.turno || "NOITE";

      if (dataEvento) {
        const check = checkAgendaDisponibilidade(dataEvento, turno, espacoId);
        if (!check.disponivel) {
          return sendJson(res, 409, {
            erro: "Este espaço e turno já possuem uma marcação no calendário. Escolha outro turno, outro salão disponível (Salão Principal / Salão Intimista / Catering Externo) ou outra data.",
            conflitos: check.conflitos.map(c => ({ espaco_id: c.espaco_id, turno: c.turno }))
          });
        }
      }

      const totalCount = db.prepare("SELECT COUNT(*) AS c FROM eventos_orcamentos").get().c;
      const numHist = body.numero_historico || `#${String(totalCount + 1).padStart(2, "0")}`;
      const token = `delta-prop-${totalCount + 1}-${Date.now().toString(36)}`;
      const valorTotal = Number(body.valor_total) || 5000;
      const valorSinal = Number(body.valor_pago_sinal) || 0;
      const publico = Number(body.publico_estimado) || 80;
      const status = body.status || "ORCAMENTO";
      const telInfo = body.telefone ? ` · WhatsApp: ${body.telefone}` : "";

      const r = db.prepare(`
        INSERT INTO eventos_orcamentos (
          numero_historico, cliente_nome, tipo_evento, modalidade_operacao, espaco_id,
          bloqueio_complexo_total, data_evento, data_exibicao, turno, hora_inicio,
          publico_estimado, publico_exibicao, resumo_servico, valor_total, valor_pago_sinal,
          status, token_proposta, pacote_ancoragem_escolhido, observacoes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OURO_EXECUTIVO', ?)
      `).run(
        numHist,
        `${body.cliente_nome || "Cliente Site"}${telInfo}`,
        body.tipo_evento || "SOCIAL_JANTAR",
        espacoId === "EXTERNO_CATERING" ? "SOMENTE_CATERING" : "VENUE_CATERING",
        espacoId,
        body.bloqueio_complexo_total ? 1 : 0,
        dataEvento,
        dataEvento ? dataEvento.split("-").reverse().join("/") : "A definir",
        turno,
        body.hora_inicio || "19:30",
        publico,
        String(publico),
        body.resumo_servico || "Cardápio personalizado Delta Espaço e Eventos",
        valorTotal,
        valorSinal,
        status,
        token,
        body.observacoes || "Solicitado pelo Calendário Online do Site"
      );

      const eventoId = Number(r.lastInsertRowid);
      const topVal = Math.round(valorTotal * 1.32);
      const baseVal = Math.round(valorTotal * 0.78);

      const insPacote = db.prepare(`
        INSERT INTO proposta_pacotes (
          evento_id, ordem_exibicao, tier, titulo, subtitulo, valor_total,
          valor_por_pessoa, destaque_ancoragem, itens_json, selecionado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insPacote.run(
        eventoId, 1, "DIAMANTE_MASTER",
        "Pacote Diamante Royal · Experiência Completa (Top-Down Anchor)",
        "Cardápio Triplo + Ilha Gastronômica (Grazing Table) + Camarão em Panko + Sobremesas em Taças + Lanche da Madrugada",
        topVal, +(topVal / publico).toFixed(2), "ANCORAGEM TOPO · MAIS COMPLETO",
        JSON.stringify([
          "Ilha Gastronômica (Queijo Brie c/ favo de mel, Coalho maçaricado, Chips artesanais e Ceviche)",
          "Volantes Premium (Camarão em panko, Patinha de caranguejo, Mini bombom de carne de sol, Dadinhos de tapioca)",
          "Jantar Premium: Medalhão de Filé em Crosta de Castanha + Costela Prensada ao Roti + Arroz ao Espumante c/ Amêndoas",
          "Sobremesas: Banoffee desconstruída em taças + Taça da Felicidade + Mini pudim c/ fava de baunilha",
          "Lanche da Madrugada: Mini hambúrgueres artesanais + Batata frita em cones"
        ]), 0
      );
      insPacote.run(
        eventoId, 2, "OURO_EXECUTIVO",
        "Pacote Ouro Delta · Escopo Solicitado",
        body.resumo_servico || "Cardápio completo Delta",
        valorTotal, +(valorTotal / publico).toFixed(2), "ESCOLHA IDEAL CUSTO-BENEFÍCIO",
        JSON.stringify([
          body.resumo_servico || "Cardápio completo Delta",
          "Louças finas, rechauds, garrafas térmicas e logística de expedição térmica inclusos"
        ]), 1
      );
      insPacote.run(
        eventoId, 3, "ESSENCIAL_ENXUTO",
        "Pacote Essencial · Formato Enxuto",
        "Cardápio otimizado com mix de salgados tradicionais/forno e 1 proteína principal",
        baseVal, +(baseVal / publico).toFixed(2), "OPÇÃO ENXUTA DE ENTRADA",
        JSON.stringify([
          "Mix de salgados fritos tradicionais e assados de forno",
          "1 opção de proteína principal ou estação de coffee break otimizada",
          "Bebidas não alcoólicas (sucos naturais e refrigerantes)"
        ]), 0
      );

      if (["CONFIRMADO", "EM_PRODUCAO"].includes(status)) {
        ensureBeoAndLogistica(eventoId);
      }

      return sendJson(res, 201, { ok: true, id: eventoId, numero_historico: numHist, token_proposta: token });
    }

    // 7. POST /api/beo/:eventoId/gerar
    if (req.method === "POST" && pathname.startsWith("/api/beo/") && pathname.endsWith("/gerar")) {
      const eventoId = Number(pathname.split("/")[3]);
      ensureBeoAndLogistica(eventoId);
      return sendJson(res, 200, { ok: true, evento_id: eventoId });
    }

    // 8. PATCH /api/beo/item/:id
    if (req.method === "PATCH" && pathname.startsWith("/api/beo/item/")) {
      const id = Number(pathname.replace("/api/beo/item/", ""));
      const body = await parseBody(req);
      db.prepare("UPDATE beo_cronograma SET status_execucao = ? WHERE id = ?").run(body.status_execucao || "CONCLUIDO", id);
      return sendJson(res, 200, { ok: true });
    }

    // 9. PATCH /api/logistica/item/:id
    if (req.method === "PATCH" && pathname.startsWith("/api/logistica/item/")) {
      const id = Number(pathname.replace("/api/logistica/item/", ""));
      const body = await parseBody(req);
      const row = db.prepare("SELECT * FROM logistica_expedicao WHERE id = ?").get(id);
      if (!row) return sendJson(res, 404, { erro: "Item não encontrado" });
      const saida = body.checked_saida !== undefined ? (body.checked_saida ? 1 : 0) : row.checked_saida;
      const retorno = body.checked_retorno !== undefined ? (body.checked_retorno ? 1 : 0) : row.checked_retorno;
      db.prepare("UPDATE logistica_expedicao SET checked_saida = ?, checked_retorno = ? WHERE id = ?").run(saida, retorno, id);
      return sendJson(res, 200, { ok: true, checked_saida: saida, checked_retorno: retorno });
    }

    // 10. POST /api/fiscal/emitir
    if (req.method === "POST" && pathname === "/api/fiscal/emitir") {
      const body = await parseBody(req);
      const eventoId = Number(body.evento_id);
      const ev = db.prepare("SELECT * FROM eventos_orcamentos WHERE id = ?").get(eventoId);
      if (!ev) return sendJson(res, 404, { erro: "Evento não encontrado" });

      const rps = `RPS-2026-${String(eventoId).padStart(4, "0")}-${Math.floor(100 + Math.random() * 900)}`;
      const aliquota = 6.0;
      const tributo = +(ev.valor_total * (aliquota / 100)).toFixed(2);
      const disc = `Fornecimento de alimentação para eventos (${ev.numero_historico} - ${ev.resumo_servico}). Código NBS: 103013100. Classificação IBS/CBS: Opção 1 (Simples Nacional). Recebedor: Marileide C Melo / M C Melo Santos - CNPJ 06.328.111/0001-08 | Banco Inter (077) Ag 0001 Cc 42997585-6 | Pix: 93859def-2303-48db-ab92-0dc33f6891bc.`;

      db.prepare(`
        INSERT INTO fiscal_nfse (
          evento_id, numero_rps, tomador_nome, tomador_documento, codigo_nbs, descricao_nbs,
          regime_apuracao, classificacao_ibs_cbs, valor_servico, aliquota_estimada_pct,
          valor_tributo_estimado, discriminacao_nota, status_emissao
        ) VALUES (?, ?, ?, ?, '103013100', 'Fornecimento de alimentação para eventos', 'Simples Nacional', 'Opção 1 - Operação Padrão Tributada (Simples Nacional)', ?, ?, ?, ?, 'EMITIDA')
      `).run(
        eventoId,
        rps,
        body.tomador_nome || ev.cliente_nome,
        body.tomador_documento || "Não informado / Consumidor",
        ev.valor_total,
        aliquota,
        tributo,
        disc
      );

      return sendJson(res, 201, { ok: true, numero_rps: rps });
    }

    // 11. GET /api/galeria — Carrega os cards e páginas personalizadas do Registro Visual
    const galeriaJsonPath = path.join(__dirname, "public", "galeria-data.json");
    if (req.method === "GET" && pathname === "/api/galeria") {
      if (fs.existsSync(galeriaJsonPath)) {
        const data = JSON.parse(fs.readFileSync(galeriaJsonPath, "utf-8"));
        return sendJson(res, 200, { ok: true, items: data });
      }
      return sendJson(res, 200, { ok: true, items: null });
    }

    // 12. POST /api/galeria — Salva novas fotos, títulos e parágrafos no site (public/galeria-data.json)
    if (req.method === "POST" && pathname === "/api/galeria") {
      const body = await parseBody(req);
      if (!Array.isArray(body.items)) {
        return sendJson(res, 400, { erro: "Formato inválido de itens da galeria." });
      }
      fs.writeFileSync(galeriaJsonPath, JSON.stringify(body.items, null, 2), "utf-8");
      return sendJson(res, 200, { ok: true, total: body.items.length });
    }

    // 13. POST /api/publish-vercel — Publica o site atualizado (com as novas fotos e páginas) direto na Vercel
    if (req.method === "POST" && pathname === "/api/publish-vercel") {
      const { exec } = require("node:child_process");
      const publicFolder = path.join(__dirname, "public");
      return new Promise(resolve => {
        exec(
          "npx.cmd --yes vercel --prod --yes",
          { cwd: publicFolder, timeout: 120000 },
          (error, stdout, stderr) => {
            if (error) {
              sendJson(res, 500, {
                ok: false,
                erro: error.message,
                detalhes: stderr || stdout
              });
              return resolve();
            }
            sendJson(res, 200, {
              ok: true,
              url: "https://delta-espaco-e-eventos.vercel.app",
              log: stdout
            });
            resolve();
          }
        );
      });
    }

    // Arquivos Estáticos da SPA (public/)
    const publicDir = path.join(__dirname, "public");
    let filePath = path.join(publicDir, pathname === "/" ? "index.html" : pathname);
    if (!filePath.startsWith(publicDir)) {
      res.writeHead(403);
      return res.end("Forbidden");
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(publicDir, "index.html");
    }
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".ico": "image/x-icon"
    };
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error("Erro no servidor DELTA OS:", err);
    sendJson(res, 500, { erro: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`⚙️ DELTA OS + Portal do Cliente rodando em http://localhost:${PORT}`);
});
