"""Teste de tela da Fase 3 (Playwright). Precisa das contas teste.e2e.adm e teste.e2e.atd no banco
e do servidor rodando em localhost:3100. Veja testes-de-tela/LEIA-ME.md."""
import re, sys, random
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:3100"
import os
SENHA = os.environ["SENHA_TESTE"]  # senha das contas teste.e2e.*@delta.test, criadas só para o teste e apagadas depois
SHOTS = os.environ.get("CAPTURAS", "/tmp/capturas")
resultados = []

def ok(nome, cond, detalhe=""):
    resultados.append((nome, bool(cond), detalhe))
    print(("OK   " if cond else "FALHA"), nome, detalhe, flush=True)

def entrar(ctx, email):
    pg = ctx.new_page()
    pg.goto(f"{BASE}/entrar")
    pg.fill("#email", email); pg.fill("#senha", SENHA); pg.click("button:has-text('Entrar')")
    pg.wait_for_url(f"{BASE}/", timeout=20000)
    return pg

def selecionar(pg, seletor, trecho):
    rotulos = pg.locator(f"{seletor} option").all_inner_texts()
    escolhido = next(r for r in rotulos if trecho in r)
    pg.select_option(seletor, label=escolhido)

def esperar_ok(pg, texto, timeout=15000):
    pg.wait_for_selector(f".aviso:has-text('{texto}'), .toast:has-text('{texto}')", timeout=timeout)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 1366, "height": 900}, bypass_csp=True)
    pg = entrar(ctx, "teste.e2e.adm@delta.test")
    pg.wait_for_selector("main h1")
    ok("A1 login do administrador cai no início", "Teste" in pg.inner_text("main h1"))
    JANTAR = f"Jantar completo {random.randint(100, 999)} (teste)"
    _d = [random.randint(0, 9) for _ in range(9)]
    for _n in (9, 10): _d.append((sum(_d[i] * (_n + 1 - i) for i in range(_n)) * 10 % 11) % 10)
    SUF = random.randint(1000, 9999); TEL = f"(99) 9{random.randint(1000, 9999)}-{random.randint(1000, 9999)}"
    CPF = "".join(map(str, _d)); CPF_FMT = f"{CPF[:3]}.{CPF[3:6]}.{CPF[6:9]}-{CPF[9:]}"

    # ---------------- catálogo
    pg.goto(f"{BASE}/catalogo?q=Gar%C3%A7om"); pg.click("text=Garçom")
    pg.fill("#custo", "120,00"); pg.click("button:has-text('Salvar item')")
    pg.wait_for_url(re.compile(r".*salvo=1"), timeout=15000)
    ok("A2 custo do garçom salvo", "Item salvo" in pg.inner_text("main"))
    pg.goto(f"{BASE}/catalogo/novo")
    pg.fill("#nome", JANTAR); pg.select_option("#categoria", "alimentacao"); pg.select_option("#unidade", "pessoa")
    pg.fill("#descricao", "Duas carnes, arroz, salada e sobremesa")
    pg.fill("#preco", "45,50"); pg.fill("#custo", "28,00"); pg.click("button:has-text('Salvar item')")
    pg.wait_for_url(re.compile(r".*/catalogo/[0-9a-f-]+\?salvo=1"), timeout=15000)
    pg.goto(f"{BASE}/catalogo?q=Jantar%20completo"); pg.wait_for_selector("table")
    txt = pg.inner_text("main")
    ok("A3 catálogo mostra custo e margem ao admin", "MARGEM" in txt.upper() and "R$ 28,00" in txt and "38%" in txt, "")
    pg.screenshot(path=f"{SHOTS}/catalogo-admin.png", full_page=True)

    # ---------------- clientes e duplicados
    pg.goto(f"{BASE}/clientes/novo")
    pg.fill("#nome", f"Maria José da Silva Teste {SUF}"); pg.fill("#documento", CPF_FMT)
    pg.fill("#telefone", TEL); pg.select_option("#origem", "whatsapp")
    pg.click("button:has-text('Salvar cliente')")
    pg.wait_for_url(re.compile(r".*/clientes/[0-9a-f-]+$"), timeout=15000)
    cliente1 = pg.url.rsplit("/", 1)[1]
    pg.wait_for_selector(f"main h1:has-text('Maria José da Silva Teste {SUF}')")
    ok("A4 cliente PF cadastrado com CPF formatado", CPF_FMT in pg.inner_text("main"))
    pg.goto(f"{BASE}/clientes/novo")
    pg.fill("#documento", "111.111.111-11"); pg.fill("#nome", "CPF Ruim Teste"); pg.click("button:has-text('Salvar cliente')")
    pg.wait_for_selector(".aviso.erro", timeout=10000)
    ok("A5 CPF inválido recusado", "CPF inválido" in pg.inner_text(".aviso.erro"))
    pg.goto(f"{BASE}/clientes/novo")
    pg.fill("#nome", f"Maria Jose Silva Teste {SUF}"); pg.fill("#telefone", TEL.replace("(", "").replace(")", "")); pg.press("#telefone", "Tab")
    pg.wait_for_selector(".aviso:has-text('Possível cadastro repetido')", timeout=10000)
    ok("A6 aviso de cadastro repetido aparece", "Mesmo telefone" in pg.inner_text(".aviso.info"))
    pg.screenshot(path=f"{SHOTS}/cliente-duplicado.png", full_page=True)
    pg.click("button:has-text('Salvar cliente')")
    pg.wait_for_url(re.compile(r".*/clientes/[0-9a-f-]+$"), timeout=15000)
    cliente2 = pg.url.rsplit("/", 1)[1]
    pg.goto(f"{BASE}/clientes/{cliente1}")
    try:
        pg.wait_for_selector("#origem", timeout=10000)
    except Exception:
        pg.screenshot(path=f"{SHOTS}/falha-origem.png", full_page=True); raise
    pg.select_option("#origem", value=cliente2); pg.check("input[name=confirmo]"); pg.click("button:has-text('Mesclar cadastros')")
    try:
        pg.wait_for_url(re.compile(r".*mesclado=1"), timeout=15000)
    except Exception:
        pg.screenshot(path=f"{SHOTS}/falha-mesclar.png", full_page=True); raise
    ok("A7 mesclagem de cadastros", "Cadastros mesclados" in pg.inner_text("main"))
    pg.goto(f"{BASE}/clientes?q=jose%20silva%20{SUF}")
    pg.wait_for_selector("tbody tr")
    ok("A8 busca sem acento acha o cliente e esconde o mesclado",
       pg.locator(f"tbody a[href='/clientes/{cliente1}']").count() == 1 and pg.locator(f"tbody a[href='/clientes/{cliente2}']").count() == 0)

    # ---------------- orçamento
    pg.goto(f"{BASE}/orcamentos/novo?cliente={cliente1}")
    pg.fill("#titulo", "Aniversário de 15 anos (teste)"); pg.select_option("#tipo", "espaco_buffet")
    pg.fill("#data_evento", "2027-05-20"); pg.fill("#horario", "19h às 2h"); pg.fill("#convidados", "90")
    selecionar(pg, "#recurso_id", "Espaço menor")
    pg.click("button:has-text('Criar orçamento')")
    pg.wait_for_url(re.compile(r".*/orcamentos/[0-9a-f-]+$"), timeout=15000)
    orc = pg.url.rsplit("/", 1)[1]
    pg.wait_for_selector("summary:has-text('Incluir um item de cada vez')")
    ok("A9 orçamento criado com número", re.search(r"ORC-\d{4}-\d{4}", pg.inner_text("main")) is not None)

    def incluir(catalogo_rotulo=None, descricao=None, qtd="1", preco=None, unidade=None):
        if not pg.locator("#escolha").is_visible():
            pg.click("summary:has-text('Incluir um item de cada vez')")
        if catalogo_rotulo:
            selecionar(pg, "#escolha", catalogo_rotulo)
        if descricao:
            pg.fill("#descricao-novo", descricao)
        if unidade:
            pg.select_option("#unidade-novo", unidade)
        pg.fill("#quantidade-novo", qtd)
        if preco:
            pg.fill("#preco-novo", preco)
        n = pg.locator("td input[name=descricao]").count()
        pg.click("button:has-text('Incluir item')")
        pg.wait_for_function(f"document.querySelectorAll('td input[name=descricao]').length > {n} || !!document.querySelector('.aviso.erro')", timeout=15000)
        if pg.locator(".aviso.erro").count():
            print("   erro ao incluir:", pg.inner_text(".aviso.erro"))

    incluir("Locação do espaço menor", preco="1.000,00")
    incluir("Garçom", qtd="2")
    incluir(JANTAR, qtd="90")
    incluir(descricao="Decoração simples", preco="250,50", unidade="evento")
    corpo = pg.inner_text("main")
    ok("A10 total = 1.000 + 360 + 4.095 + 250,50", "R$ 5.705,50" in corpo, "")
    ok("A11 margem visível ao admin", "Lucro bruto estimado" in corpo)
    pg.fill("#desconto", "300,00"); pg.click("button:has-text('Salvar condições')")
    esperar_ok(pg, "Condições salvas")
    ok("A12 desconto de 5,3% pede aprovação", "Precisa de aprovação" in pg.inner_text("main aside"))
    ok("A13 botão de envio bloqueado sem aprovação", pg.locator("button:has-text('Enviar ao cliente')").is_disabled())
    pg.fill("#justificativa", "Cliente indicado por outro cliente (teste)"); pg.click("button:has-text('Aprovar condições')")
    esperar_ok(pg, "Condições aprovadas")
    pg.screenshot(path=f"{SHOTS}/orcamento-rascunho.png", full_page=True)
    r = ctx.request.get(f"{BASE}/orcamentos/{orc}/pdf?versao=1")
    ok("A14 prévia do PDF", r.status == 200 and r.headers.get("content-type") == "application/pdf", f"{r.status}")
    pg.click("button:has-text('Enviar ao cliente')")
    pg.wait_for_url(re.compile(r".*enviado=1"), timeout=20000)
    ok("A15 envio congela a versão", "enviada e congelada" in pg.inner_text("main"))
    ok("A16 itens não são mais editáveis", pg.locator("button:has-text('Incluir item')").count() == 0)
    r = ctx.request.get(f"{BASE}/orcamentos/{orc}/pdf?versao=1")
    open(f"{SHOTS}/orcamento-v1.pdf", "wb").write(r.body())
    ok("A17 PDF oficial da versão 1", r.status == 200 and len(r.body()) > 20000, f"{len(r.body())} bytes")

    # nova versão
    pg.click("button:has-text('criar versão 2')")
    pg.wait_for_url(re.compile(rf".*/orcamentos/{orc}$"), timeout=15000)
    ok("A18 versão 2 em rascunho com itens copiados", "versão 2" in pg.inner_text("main") and "R$ 5.705,50" in pg.inner_text("main"))
    linha = pg.locator("tr", has=pg.locator("input[value='Garçom']"))
    linha.locator("input[name=quantidade]").fill("3"); linha.locator("button:has-text('Salvar')").click()
    pg.wait_for_function("document.body.innerText.includes('R$ 5.885,50')", timeout=15000)
    ok("A19 alterar quantidade recalcula (3 garçons)", True)
    ok("A20 aprovação não passa para a versão nova", "Precisa de aprovação" in pg.inner_text("main aside"))
    pg.fill("#justificativa", "Mantido desconto (teste)"); pg.click("button:has-text('Aprovar condições')")
    esperar_ok(pg, "Condições aprovadas")
    pg.click("button:has-text('Enviar ao cliente')")
    pg.wait_for_url(re.compile(r".*enviado=1"), timeout=20000)
    pg.goto(f"{BASE}/orcamentos/{orc}?versao=1")
    ok("A21 versão 1 aparece como substituída", "Substituída" in pg.inner_text("main"))
    pg.goto(f"{BASE}/orcamentos/{orc}")
    pg.check("input[name=confirmo]"); pg.click("button:has-text('Registrar aceite')")
    pg.wait_for_selector("text=Aceita pelo cliente em", timeout=15000)
    pg.reload()
    ok("A22 orçamento aprovado", "Aprovado" in pg.inner_text(".cabecalho"))
    pg.screenshot(path=f"{SHOTS}/orcamento-aprovado.png", full_page=True)
    pg.goto(f"{BASE}/orcamentos")
    ok("A23 funil mostra o orçamento em Aprovado", "Aniversário de 15 anos (teste)" in pg.locator(".funil-coluna").nth(2).inner_text())
    pg.screenshot(path=f"{SHOTS}/funil.png", full_page=True)
    pg.goto(f"{BASE}/tarefas?aba=concluidas"); pg.wait_for_selector(".cartao .abas")
    ok("A24 tarefa de retorno concluída pelo aceite", "Retornar ao cliente" in pg.inner_text("main"))
    pg.goto(f"{BASE}/tarefas"); pg.wait_for_selector(".cartao .abas")
    pg.click("button:has-text('Nova tarefa')")
    pg.fill("#titulo", "Ligar para confirmar convidados (teste)"); pg.click("button:has-text('Criar tarefa')")
    esperar_ok(pg, "Tarefa criada")
    ok("A25 tarefa manual criada", "Ligar para confirmar convidados (teste)" in pg.inner_text("main"))
    pg.screenshot(path=f"{SHOTS}/tarefas.png", full_page=True)

    # ---------------- atendimento
    ctx2 = b.new_context(viewport={"width": 1366, "height": 900}, bypass_csp=True)
    pa = entrar(ctx2, "teste.e2e.atd@delta.test")
    pa.goto(f"{BASE}/orcamentos/{orc}")
    t = pa.inner_text("main")
    ok("B1 atendimento não vê custo nem margem", all(x not in t.upper() for x in ["MARGEM", "CUSTO", "RESTRITO"]))
    pa.goto(f"{BASE}/catalogo")
    t = pa.inner_text("main")
    ok("B2 catálogo sem custo para o atendimento", "CUSTO" not in t.upper() and "28,00" not in t and "Novo item" not in t)
    def negado(caminho):
        pa.goto(f"{BASE}{caminho}")
        try:
            pa.wait_for_url("**/sem-permissao", timeout=10000)
            return True
        except Exception:
            return False
    ok("B3 atendimento não acessa cadastro de catálogo", negado("/catalogo/novo"))
    ok("B4 atendimento não acessa usuários", negado("/usuarios"))
    pa.goto(f"{BASE}/orcamentos/novo?cliente={cliente1}")
    pa.fill("#titulo", "Coffee break (teste atendimento)"); pa.select_option("#tipo", "buffet_externo")
    pa.fill("#local_externo", "Escritório do cliente"); pa.click("button:has-text('Criar orçamento')")
    pa.wait_for_url(re.compile(r".*/orcamentos/[0-9a-f-]+$"), timeout=15000)
    pa.click("summary:has-text('Incluir um item de cada vez')")
    selecionar(pa, "#escolha", "Jantar completo"); pa.fill("#quantidade-novo", "10")
    pa.click("button:has-text('Incluir item')")
    pa.wait_for_function("document.body.innerText.includes('R$ 455,00')", timeout=15000)
    def descontar(valor, espera):
        pa.fill("#desconto", valor)
        with pa.expect_response(lambda r: r.request.method == "POST"):
            pa.click("button:has-text('Salvar condições')")
        pa.wait_for_load_state("networkidle")
        pa.wait_for_function(f"document.querySelector('main aside').innerText.includes({espera!r})", timeout=15000)
    descontar("20,00", "Válido até")
    ok("B5 desconto de 4,4% sem aprovação para o atendimento", "Precisa de aprovação" not in pa.inner_text("main aside"))
    descontar("100,00", "Peça a um administrador")
    ok("B6 desconto de 22% pede administrador", pa.locator("button:has-text('Enviar ao cliente')").is_disabled())
    pa.screenshot(path=f"{SHOTS}/atendimento-desconto.png", full_page=True)
    pa.fill("#desconto", "20,00"); pa.click("button:has-text('Salvar condições')")
    pa.wait_for_function("!document.querySelector('main aside').innerText.includes('Peça a um administrador')", timeout=15000)
    pa.click("button:has-text('Enviar ao cliente')")
    pa.wait_for_url(re.compile(r".*enviado=1"), timeout=20000)
    ok("B7 atendimento envia dentro do limite", "enviada e congelada" in pa.inner_text("main"))
    b.close()

falhas = [r for r in resultados if not r[1]]
print(f"\nRESULTADO {len(resultados) - len(falhas)} de {len(resultados)}")
sys.exit(1 if falhas else 0)
