"""Teste de tela da Fase 4 (Playwright): cenário 3 completo (data segura → contrato → assinatura → entrada → confirmação),
data ocupada, espaços independentes, bloqueio da agenda, Pix, pagamento duplicado, estorno e cancelamento pela política.
Precisa das contas teste.e2e.adm / .atd / .fin e do servidor em localhost:3100. Veja testes-de-tela/LEIA-ME.md."""
import os, re, random
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "http://localhost:3100")
SENHA = os.environ["SENHA_TESTE"]
SHOTS = os.environ.get("CAPTURAS", "/tmp/capturas")
os.makedirs(SHOTS, exist_ok=True)
resultados = []

# Datas sorteadas a cada rodada (sempre a mais de 120 dias), para rodar de novo sem apagar a rodada anterior.
import datetime as dt
_base = dt.date(2028, random.randint(5, 12), random.randint(14, 24))
DIA = _base.isoformat()                                  # dia do evento
DIA_SEG = (_base + dt.timedelta(days=1)).isoformat()     # dia seguinte (madrugada e limpeza)
DIA_BLOQ = (_base - dt.timedelta(days=12)).isoformat()   # dia do bloqueio da agenda
MES = DIA[:7]
VENC = (_base - dt.timedelta(days=7)).strftime("%d/%m/%Y")
BR = lambda d: f"{d[8:10]}/{d[5:7]}"
PIX1, PIX2 = (f"E2ETESTE{random.randint(10**9, 10**10)}{n}" for n in (1, 2))

def ok(nome, cond, detalhe=""):
    resultados.append((nome, bool(cond), detalhe))
    print(("OK   " if cond else "FALHA"), nome, detalhe, flush=True)

def cpf_valido():
    d = [random.randint(0, 9) for _ in range(9)]
    for n in (9, 10):
        s = sum(d[i] * (n + 1 - i) for i in range(n))
        d.append((s * 10 % 11) % 10)
    return "".join(map(str, d))

def entrar(b, email, largura=1366):
    ctx = b.new_context(viewport={"width": largura, "height": 900}, bypass_csp=True)
    pg = ctx.new_page()
    pg.goto(f"{BASE}/entrar")
    pg.fill("#email", email); pg.fill("#senha", SENHA); pg.click("button:has-text('Entrar')")
    pg.wait_for_url(f"{BASE}/", timeout=20000)
    return ctx, pg

def aviso(pg, timeout=20000):
    pg.wait_for_selector(".aviso.ok, .aviso.erro", timeout=timeout)
    return pg.locator(".aviso.ok, .aviso.erro").last.inner_text()

AVISOS = ".aviso[role=alert], .aviso[role=status]"

def limpa(pg):
    """Recarrega sem o ?aviso= da ação anterior."""
    pg.goto(pg.url.split("?")[0])

def acao(pg, botao, escopo="main"):
    """Clica e espera a ação do servidor: ou volta para a página com ?aviso=, ou mostra o aviso no formulário."""
    n = pg.locator(AVISOS).count()
    antes = pg.url
    ultimo = pg.locator(AVISOS).last.inner_text() if n else ""
    pg.locator(escopo).locator(f"button:has-text('{botao}')").first.click()
    sim = pg.locator(escopo).locator(".confirmacao button:has-text('Sim, ')")
    if sim.count(): sim.first.click()   # ações destrutivas pedem confirmação na tela
    pg.wait_for_function(
        f"""(() => {{ const a = document.querySelectorAll({AVISOS!r});
            return location.href !== {antes!r} || a.length > {n} || (a.length && a[a.length - 1].innerText !== {ultimo!r}); }})()""",
        timeout=20000)
    pg.wait_for_load_state()
    pg.wait_for_selector(AVISOS, timeout=20000)
    return pg.locator(AVISOS).last.inner_text()

def criar_orcamento(pg, cliente, titulo, preco):
    pg.goto(f"{BASE}/orcamentos/novo?cliente={cliente}")
    pg.fill("#titulo", titulo); pg.select_option("#tipo", "espaco_buffet"); pg.fill("#convidados", "150")
    pg.click("button:has-text('Criar orçamento')")
    pg.wait_for_url(re.compile(r".*/orcamentos/[0-9a-f-]+$"), timeout=15000)
    orc = pg.url.rsplit("/", 1)[1]
    if not pg.locator("#descricao-novo").is_visible():
        pg.click("summary:has-text('Incluir um item de cada vez')")
    pg.fill("#descricao-novo", "Locação do espaço com buffet (teste)"); pg.select_option("#unidade-novo", "evento")
    pg.fill("#quantidade-novo", "1"); pg.fill("#preco-novo", preco)
    pg.click("button:has-text('Incluir item')")
    pg.wait_for_function("document.querySelectorAll('td input[name=descricao]').length > 0", timeout=15000)
    return orc

def reservar(pg, orc, data, ini, fim, espacos):
    pg.goto(f"{BASE}/orcamentos/{orc}")
    if not pg.locator("#r-data").is_visible():
        pg.click("summary:has-text('Reservar')")
    pg.fill("#r-data", data); pg.fill("#r-inicio", ini); pg.fill("#r-fim", fim)
    for cb in pg.locator("input[name=recursos]").all():
        cb.uncheck()
    for e in espacos:
        pg.locator("label", has_text=e).locator("input[name=recursos]").check()
    pg.click("button:has-text('Segurar a data')")
    pg.wait_for_function("location.pathname.startsWith('/reservas/') || !!document.querySelector('#data-do-evento .aviso.erro')", timeout=20000)
    if "/reservas/" in pg.url:
        return pg.url.split("/reservas/")[1].split("?")[0], None
    return None, pg.inner_text("#data-do-evento .aviso.erro")

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])

    def chave_pix(pm, valor):
        pm.goto(f"{BASE}/configuracoes")
        campo = pm.locator("[id='empresa.pix_chave']")
        if campo.input_value() != valor:
            campo.fill(valor)
            acao(pm, "Salvar", "form:has([id='empresa.pix_chave'])")
            pm.reload()
        return pm.locator("[id='empresa.pix_chave']").input_value()

    cM, pm = entrar(b, "teste.e2e.adm@delta.test")
    chave_pix(pm, "")  # começa sem chave Pix

    # ------------------------------------------------ atendimento: cliente, orçamento, aceite
    cA, pa = entrar(b, "teste.e2e.atd@delta.test")
    ok("C0 menu tem Agenda e não tem Financeiro para o atendimento",
       "Agenda" in pa.inner_text("nav") and "Financeiro" not in pa.inner_text("nav"))
    pa.goto(f"{BASE}/clientes/novo")
    pa.fill("#nome", "Joana Quatro (teste)"); pa.fill("#documento", cpf_valido())
    pa.fill("#telefone", "(99) 98111-2233"); pa.select_option("#origem", "whatsapp")
    pa.fill("#endereco", "Rua das Flores, 100, Centro"); pa.fill("#cidade", "Bacabal"); pa.fill("#uf", "MA")
    pa.click("button:has-text('Salvar cliente')")
    pa.wait_for_url(re.compile(r".*/clientes/[0-9a-f-]+$"), timeout=15000)
    cliente = pa.url.rsplit("/", 1)[1]

    orc = criar_orcamento(pa, cliente, "Casamento Joana (teste)", "6.000,00")
    pa.click("button:has-text('Enviar ao cliente')")
    pa.wait_for_url(re.compile(r".*enviado=1"), timeout=20000)
    pa.check("input[name=confirmo]"); pa.click("button:has-text('Registrar aceite')")
    pa.wait_for_selector("text=Aceita pelo cliente em", timeout=15000)

    # ------------------------------------------------ data segura (atravessa a madrugada)
    reserva, erro = reservar(pa, orc, DIA, "20:00", "03:00", ["Espaço maior"])
    ok("C1 data segura no Espaço maior", reserva is not None, erro or "")
    pa.locator("main h1").first.wait_for(timeout=20000)   # espera sair do esqueleto de carregamento
    t = pa.inner_text("main")
    ok("C2 período virando a madrugada", f"das 20h00 às 03h00 do dia {DIA_SEG[8:10]}/{DIA_SEG[5:7]}/{DIA_SEG[:4]}" in t, "")
    ok("C3 aviso de data segura com prazo", "Data segura até" in t)
    pa.screenshot(path=f"{SHOTS}/reserva-segura.png", full_page=True)

    # concorrência pela tela: outro orçamento, mesmo espaço, horário que encosta na limpeza
    orc2 = criar_orcamento(pa, cliente, "Aniversário Joana (teste)", "2.000,00")
    r2, erro = reservar(pa, orc2, DIA_SEG, "05:00", "10:00", ["Espaço maior"])
    ok("C4 mesmo espaço dentro da limpeza é recusado e diz quando", r2 is None and "Espaço maior já está ocupado" in (erro or ""), erro or "")
    r2, erro = reservar(pa, orc2, DIA, "18:00", "22:00", ["Espaço menor"])
    ok("C5 outro espaço no mesmo horário é aceito", r2 is not None, erro or "")
    msg = acao(pa, "Liberar a data")
    ok("C6 liberar a data cancela o bloqueio", "Data liberada" in msg and "Cancelada" in pa.inner_text(".cabecalho"), msg)

    # ------------------------------------------------ contrato
    pa.goto(f"{BASE}/reservas/{reserva}")
    pa.select_option("#g-canal", "fora_estabelecimento")
    msg = acao(pa, "Gerar contrato")
    ok("C7 contrato gerado", "Contrato gerado" in msg, msg)
    limpa(pa)
    t = pa.inner_text("main")
    ok("C8 parcelas 50/50 com saldo 7 dias antes", "R$ 3.000,00" in t and f"Vence {VENC}" in t, "")
    ok("C9 sem chave Pix, avisa para cadastrar", "Cadastre a chave Pix" in t)
    r = cA.request.get(f"{BASE}/reservas/{reserva}/contrato")
    open(f"{SHOTS}/contrato.pdf", "wb").write(r.body())
    ok("C10 PDF do contrato", r.status == 200 and r.headers.get("content-type") == "application/pdf" and len(r.body()) > 30000, f"{len(r.body())} bytes")
    ok("C11 atendimento não vê o botão de confirmar", pa.locator("button:has-text('Confirmar a reserva')").count() == 0)
    pa.click("summary:has-text('Registrar assinatura')")
    msg = acao(pa, "Registrar assinatura")
    ok("C12 assinatura registrada", "Assinatura registrada" in msg, msg)
    limpa(pa)
    ok("C13 contrato assinado não pode ser regerado", pa.locator("summary:has-text('Gerar nova versão')").count() == 0 and "Assinado" in pa.inner_text("main"))
    pa.screenshot(path=f"{SHOTS}/reserva-contrato-assinado.png", full_page=True)

    # ------------------------------------------------ administração: chave Pix (teste) e bloqueio da agenda
    chave_pix(pm, "pix.teste@delta.test")
    pm.goto(f"{BASE}/reservas/{reserva}")
    t = pm.inner_text("main")
    codigo = pm.locator("textarea[aria-label='Pix copia e cola']").first.input_value() if pm.locator("textarea[aria-label='Pix copia e cola']").count() else ""
    ok("C14 Pix copia e cola com valor e QR", codigo.startswith("000201") and "5407" + "3000.00" in codigo and pm.locator("[aria-label='QR Code Pix'] svg").count() >= 1, codigo[:60])

    pm.goto(f"{BASE}/agenda?mes={MES}")
    pm.click(f"[data-dia='{DIA_BLOQ}'] .abrir-dia")          # o clique no dia abre o painel lateral
    pm.click(".gaveta button:has-text('Bloquear data ou horário')")
    pm.fill("#b-ini", "08:00"); pm.fill("#b-fim", "18:00")
    pm.locator(".gaveta label.opcao", has_text="Espaço menor").locator("input").check()
    pm.fill("#b-mot", "Manutenção (teste)")
    msg = acao(pm, "Bloquear", ".gaveta")
    ok("C15 bloqueio administrativo criado", "Agenda bloqueada" in msg, msg)
    pm.reload()
    dia10 = pm.locator(f"[data-dia='{DIA_BLOQ}']").inner_text()
    dia22 = pm.locator(f"[data-dia='{DIA}'] .ocupacao").first
    ok("C16 agenda mostra o bloqueio e a data segura", "Manutenção (teste)" in dia10 and "temporario" in (dia22.get_attribute("class") or ""), dia10)
    pm.screenshot(path=f"{SHOTS}/agenda-mes.png", full_page=True)
    r3, erro = reservar(pa, orc2, DIA_BLOQ, "10:00", "12:00", ["Espaço menor"])
    ok("C17 bloqueio da agenda impede reservar", r3 is None and "bloqueio da agenda" in (erro or ""), erro or "")

    # ------------------------------------------------ financeiro: baixa, duplicado, confirmação
    cF, pf = entrar(b, "teste.e2e.fin@delta.test")
    pf.goto(f"{BASE}/financeiro")
    t = pf.inner_text("main")
    ok("C18 financeiro lista a entrada a receber", "Joana Quatro (teste)" in t and "R$ 3.000,00" in t)
    pf.goto(f"{BASE}/reservas/{reserva}")
    ok("C19 confirmar bloqueado sem entrada", "Confirmar fica liberado" in pf.inner_text("main aside"))
    p1 = pf.locator("[data-teste='parcela-1']")
    p1.locator("summary:has-text('Dar baixa')").click()
    p1.locator("input[name=valor]").fill("1.000,00"); p1.locator("input[name=id_externo]").fill(PIX1)
    msg = acao(pf, "Dar baixa", "[data-teste='parcela-1']")
    ok("C20 baixa parcial registrada", "Pagamento registrado" in msg, msg)
    limpa(pf)
    p1 = pf.locator("[data-teste='parcela-1']")
    ok("C21 parcela mostra o que falta", "Falta R$ 2.000,00" in p1.inner_text())
    p1.locator("summary:has-text('Dar baixa')").click()
    p1.locator("input[name=id_externo]").fill(PIX1)
    msg = acao(pf, "Dar baixa", "[data-teste='parcela-1']")
    ok("C22 mesmo identificador Pix recusado", "já foi registrado" in msg, msg)
    p1.locator("input[name=valor]").fill("2.500,00"); p1.locator("input[name=id_externo]").fill(PIX2)
    msg = acao(pf, "Dar baixa", "[data-teste='parcela-1']")
    ok("C23 valor acima do saldo recusado", "no máximo o saldo" in msg, msg)
    p1.locator("input[name=valor]").fill("2.000,00")
    msg = acao(pf, "Dar baixa", "[data-teste='parcela-1']")
    ok("C24 entrada quitada", "Pagamento registrado" in msg, msg)
    ok("C24b identificador digitado não se perde quando o banco recusa", PIX2 in pf.inner_text("main"))
    limpa(pf)
    msg = acao(pf, "Confirmar a reserva")
    ok("C25 reserva confirmada", "Reserva confirmada" in msg, msg)
    limpa(pf)
    ok("C26 situação confirmada", "Confirmada" in pf.inner_text(".cabecalho"))
    pf.screenshot(path=f"{SHOTS}/reserva-confirmada.png", full_page=True)
    pa.goto(f"{BASE}/tarefas"); pa.wait_for_selector("main h1:has-text('Tarefas')"); pa.wait_for_load_state("networkidle")
    ok("C27 tarefa de cobrar o saldo criada", "Cobrar o saldo de Casamento Joana (teste)" in pa.inner_text("main"))
    pm.goto(f"{BASE}/agenda?mes={MES}")
    cls = pm.locator(f"[data-dia='{DIA}'] .ocupacao").first.get_attribute("class")
    ok("C28 agenda mostra a reserva confirmada", cls == "ocupacao", cls or "")

    # ------------------------------------------------ estorno e cancelamento (administração)
    pm.goto(f"{BASE}/reservas/{reserva}")
    pm.locator("summary:has-text('Estornar')").last.click()
    pm.locator("input[name=valor]").last.fill("10,00"); pm.locator("input[name=motivo]").last.fill("Taxa devolvida (teste)")
    msg = acao(pm, "Registrar estorno", "details[open]:has(input[name=motivo])")
    ok("C29 estorno parcial registrado", "Estorno registrado" in msg, msg)
    limpa(pm)
    ok("C30 recebido cai para R$ 2.990,00", "Recebido: R$ 2.990,00" in pm.inner_text("main"))
    pm.click("summary:has-text('Cancelar a reserva')")
    calc = pm.inner_text("[data-teste='calculo-cancelamento']")
    ok("C31 prévia: multa 10% (mais de 120 dias), devolve o resto", "R$ 600,00" in calc and "Devolver ao cliente: R$ 2.390,00" in calc, calc.replace("\n", " | "))
    pm.select_option("#c-ini", "arrependimento")
    calc = pm.inner_text("[data-teste='calculo-cancelamento']")
    ok("C32 arrependimento (fora do estabelecimento, 7 dias): devolve tudo", "R$ 2.990,00" in calc and "art. 49" in calc, calc.replace("\n", " | "))
    pm.select_option("#c-ini", "cliente")
    pm.fill("#c-mot", "Cliente desistiu do casamento (teste)"); pm.check("input[name=ciente]")
    msg = acao(pm, "Cancelar a reserva", "form:has(#c-ini)")
    ok("C33 cancelamento registrado", "Reserva cancelada" in msg, msg)
    limpa(pm)
    ok("C34 página mostra multa e devolução", "Devolver: R$ 2.390,00" in pm.inner_text("main"))
    pm.goto(f"{BASE}/tarefas"); pm.wait_for_selector("main h1:has-text('Tarefas')"); pm.wait_for_load_state("networkidle")
    ok("C35 tarefa de devolução criada", "Devolver R$ 2.390,00 ao cliente" in pm.inner_text("main"))
    r4, erro = reservar(pa, orc2, DIA, "18:00", "23:00", ["Espaço maior"])
    ok("C36 data cancelada volta a ficar livre", r4 is not None, erro or "")

    # remover bloqueio, modelo de contrato e permissões
    pm.goto(f"{BASE}/agenda?mes={MES}")
    pm.click(f"[data-dia='{DIA_BLOQ}'] .abrir-dia")
    msg = acao(pm, "Remover bloqueio", ".gaveta")
    ok("C37 bloqueio removido", "Bloqueio removido" in msg, msg)
    pm.goto(f"{BASE}/contratos/modelo"); pm.wait_for_selector("#m-corpo")
    ok("C38 modelo v1 aparece para a administração", "Versão 1 em uso" in pm.inner_text("main"))
    corpo = pm.locator("#m-corpo").input_value()
    pm.fill("#m-corpo", corpo + "\n{{cliente.apelido}}"); pm.fill("#m-obs", "teste")
    aviso_m = pm.locator("main .aviso.erro", has_text="cliente.apelido")
    ok("C39 marcador desconhecido avisado e salvar bloqueado", aviso_m.count() == 1 and pm.get_by_role("button", name="Salvar como nova versão").is_disabled())
    pa.goto(f"{BASE}/contratos/modelo")
    pa.wait_for_url("**/sem-permissao", timeout=10000)
    ok("C40 atendimento não edita o modelo", "/sem-permissao" in pa.url)
    pa.goto(f"{BASE}/financeiro")
    pa.wait_for_url("**/sem-permissao", timeout=10000)
    ok("C41 atendimento não abre o financeiro", "/sem-permissao" in pa.url)

    # chave Pix de teste removida
    ok("C42 chave Pix de teste apagada", chave_pix(pm, "") == "")

    # celular
    cC, pc = entrar(b, "teste.e2e.adm@delta.test", largura=390)
    pc.goto(f"{BASE}/agenda?mes={MES}")
    pc.screenshot(path=f"{SHOTS}/agenda-celular.png", full_page=True)
    largura = pc.evaluate("document.documentElement.scrollWidth")
    ok("C43 agenda cabe no celular", largura <= 392, f"{largura}px")
    pc.goto(f"{BASE}/reservas/{reserva}")
    largura = pc.evaluate("document.documentElement.scrollWidth")
    pc.screenshot(path=f"{SHOTS}/reserva-celular.png", full_page=True)
    ok("C44 reserva cabe no celular", largura <= 392, f"{largura}px")

    b.close()

passou = sum(1 for _, c, _ in resultados if c)
print(f"\nRESULTADO {passou} de {len(resultados)} verificações passaram")
