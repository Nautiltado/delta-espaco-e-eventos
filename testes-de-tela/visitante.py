"""Modo visitante (Playwright): entra sem login pelo botão, vê as telas, nenhum dado pessoal real aparece, valores zerados,
nada pode ser alterado, o navegador não recebe token do banco, e Sair volta para a entrada.
Os dados reais a proteger são lidos com a conta teste.e2e.adm (só na memória do teste, nunca impressos).
Servidor local: DELTA_TESTE_LOCAL=1 VISITANTE_SEGREDO_TESTE=<qualquer> VISITANTE_TESTE_EMAIL=teste.e2e.vis@delta.test VISITANTE_TESTE_SENHA=<senha>."""
import json, os, re, urllib.request
from playwright.sync_api import sync_playwright

B = os.environ.get("BASE", "http://localhost:3100"); S = os.environ["SENHA_TESTE"]
SHOTS = os.environ.get("CAPTURAS", "/tmp/capturas"); os.makedirs(SHOTS, exist_ok=True)
URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]; CHAVE = os.environ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]
res = []
def ok(n, c, d=""): res.append(bool(c)); print("OK   " if c else "FALHA", n, str(d)[:160], flush=True)

def http(metodo, caminho, corpo=None, token=None):
    req = urllib.request.Request(URL + caminho, method=metodo, data=json.dumps(corpo).encode() if corpo else None,
                                 headers={"apikey": CHAVE, "Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    with urllib.request.urlopen(req) as r: return json.loads(r.read() or "null")

# dados reais que não podem aparecer
tok = http("POST", "/auth/v1/token?grant_type=password", {"email": "teste.e2e.adm@delta.test", "password": S})["access_token"]
proibidos = []  # (valor, tipo): o tipo é o que o teste imprime se vazar, nunca o valor
for c in http("GET", "/rest/v1/clientes?select=nome,documento,telefone,email&nome=not.ilike.*teste*", token=tok):
    proibidos += [(c["nome"], "nome de cliente"), (c["documento"], "documento"), (c["telefone"], "telefone"), (c["email"], "e-mail")]
    if c["nome"] and " " in c["nome"]: proibidos.append((c["nome"].split()[0], "primeiro nome de cliente"))
for u in http("GET", "/rest/v1/usuarios?select=nome&email=not.like.*delta.test&email=not.like.*visitante*", token=tok):
    proibidos.append((u["nome"], "nome de usuário"))
    if " " in u["nome"]: proibidos.append((u["nome"].split()[0], "primeiro nome de usuário"))
for r in http("GET", "/rest/v1/reservas?select=titulo&titulo=not.is.null", token=tok): proibidos.append((r["titulo"], "título de evento"))
proibidos = [(str(x), t) for x, t in proibidos if x and len(str(x)) >= 5]
ok("V0 há dados reais para conferir", len(proibidos) >= 3, len(proibidos))

PAGINAS = ["/", "/clientes", "/orcamentos", "/agenda", "/agenda?vista=lista", "/eventos", "/salgados", "/salgados/cozinha",
           "/salgados/estoque", "/financeiro", "/contratos", "/catalogo", "/tarefas", "/reservas", "/configuracoes", "/catalogo/unidades", "/usuarios", "/auditoria"]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 1440, "height": 900}); pg = ctx.new_page()
    erros = []; pg.on("pageerror", lambda e: erros.append(str(e)))
    pg.goto(f"{B}/entrar")
    ok("V1 botão na tela de entrada", pg.locator("button:has-text('Conhecer o sistema sem login')").count() == 1)
    pg.screenshot(path=f"{SHOTS}/visitante-entrada.png")
    pg.click("button:has-text('Conhecer o sistema sem login')"); pg.wait_for_url(f"{B}/", timeout=30000); pg.wait_for_selector("main h1")
    ok("V2 entra no painel com a faixa de visitante", "Modo visitante" in pg.inner_text(".faixa-visitante"))
    cks = ctx.cookies()
    ok("V3 navegador não recebe token do banco; cookie do visitante é httpOnly",
       not any(c["name"].startswith("sb-") for c in cks) and any(c["name"] == "delta_visitante" and c["httpOnly"] for c in cks), [c["name"] for c in cks])
    vazou = []; zeros = 0
    links = []
    for caminho in PAGINAS:
        r = pg.goto(f"{B}{caminho}"); pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(300)
        t = pg.inner_text("body")
        vazou += [f"{caminho}: {tipo}" for x, tipo in proibidos if x in t]
        if "R$" in t and re.search(r"R\$\s?[1-9]", t) is None: zeros += 1
        if r and r.status >= 500: vazou.append(f"{caminho}: erro {r.status}")
        if caminho == "/orcamentos":
            links = [a.get_attribute("href") for a in pg.locator("a[href^='/orcamentos/']").all()][:5]
        if caminho == "/agenda?vista=lista": pg.screenshot(path=f"{SHOTS}/visitante-agenda.png", full_page=True)
    for href in [h for h in links if h and re.match(r"^/orcamentos/[0-9a-f-]{36}$", h)][:2]:
        pg.goto(f"{B}{href}"); pg.wait_for_load_state("networkidle"); t = pg.inner_text("body")
        vazou += [f"orçamento: {tipo}" for x, tipo in proibidos if x in t]
        pg.screenshot(path=f"{SHOTS}/visitante-orcamento.png", full_page=True)
        r = pg.request.get(f"{B}{href}/pdf?versao=1")
        if r.ok and r.headers.get("content-type", "").startswith("application/pdf"):
            corpo = r.body()
            vazou += [f"pdf: {tipo}" for x, tipo in proibidos if x.encode() in corpo]
    ok("V4 nenhum dado pessoal real aparece nas telas nem no PDF", not vazou, sorted(set(vazou)))
    ok("V5 valores aparecem zerados", zeros >= 3, zeros)
    ok("V6 sem erro de JavaScript", not erros, erros[:2])

    # tentar alterar: registrar uma encomenda (a tela abre para ver, mas gravar é recusado)
    pg.goto(f"{B}/salgados/novo"); pg.wait_for_selector(".cardapio")
    pg.fill("#p-nome", "Tentativa do visitante")
    pg.click("button[aria-label='Mais Coxinha de frango (cento)']")
    pg.click("button:has-text('Registrar pedido')")
    pg.wait_for_selector(".rodape-pedido .aviso.erro", timeout=20000)
    ok("V7 alteração recusada com aviso de modo visitante", "Modo visitante" in pg.inner_text(".rodape-pedido .aviso.erro"), pg.inner_text(".rodape-pedido .aviso.erro"))
    ok("V7b agenda não oferece bloquear nem criar evento", (pg.goto(f"{B}/agenda") and pg.wait_for_selector(".calendario")) is not None
       and pg.locator("button:has-text('Bloquear data')").count() == 0 and pg.locator("button:has-text('Novo evento')").count() == 0)
    # tentar criar orçamento
    pg.goto(f"{B}/orcamentos/novo"); pg.wait_for_load_state("networkidle")
    ok("V8 tela de novo orçamento não abre para o visitante", "/sem-permissao" in pg.url or "Novo orçamento" not in pg.inner_text("main"), pg.url)
    # o valor do cookie não serve de token no banco
    valor = next(c["value"] for c in ctx.cookies() if c["name"] == "delta_visitante")
    try:
        dados = http("GET", "/rest/v1/clientes?select=nome", token=valor); ok("V9 cookie não abre o banco", not dados, dados)
    except Exception as e:
        ok("V9 cookie não abre o banco", True, type(e).__name__)
    # celular
    pc = ctx.new_page(); pc.set_viewport_size({"width": 390, "height": 844}); pc.goto(f"{B}/"); pc.wait_for_selector("main h1")
    pc.screenshot(path=f"{SHOTS}/visitante-celular.png")
    ok("V10 faixa no celular sem rolagem lateral", pc.evaluate("document.documentElement.scrollWidth") <= 392)
    pg.goto(f"{B}/"); pg.wait_for_selector(".faixa-visitante")
    pg.click(".faixa-visitante button:has-text('Sair')"); pg.wait_for_url(re.compile(r".*/entrar.*"), timeout=20000)
    pg.goto(f"{B}/clientes"); pg.wait_for_load_state("networkidle")
    ok("V11 depois de sair não entra mais", "/entrar" in pg.url, pg.url)
    b.close()
print(f"RESULTADO {sum(res)} de {len(res)}")
