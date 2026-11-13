"""Verificação em duas etapas: Administração cadastra o app no primeiro acesso, depois entra com código;
código errado é recusado; sem o código não abre tela nem dados; Atendimento não é obrigado;
a administração remove de outra pessoa. Contas teste.e2e.adm, .fin e .atd (o segredo fica em /tmp/mfa-segredos)."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from apoio import duas_etapas, PASTA
from playwright.sync_api import sync_playwright

B = os.environ.get("BASE", "http://localhost:3100"); S = os.environ["SENHA_TESTE"]
res = []
def ok(n, c, d=""): res.append(bool(c)); print("OK   " if c else "FALHA", n, str(d)[:200], flush=True)
def senha(pg, email):
    pg.goto(f"{B}/entrar"); pg.fill("#email", email); pg.fill("#senha", S); pg.click("button:has-text('Entrar')")
    pg.wait_for_url(re.compile(r".*/(seguranca/duas-etapas|entrar/codigo)?(\?.*)?$"), timeout=30000)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    adm = "teste.e2e.adm@delta.test"; fin = "teste.e2e.fin@delta.test"; atd = "teste.e2e.atd@delta.test"

    # 1. primeiro acesso da administração: obrigada a cadastrar
    for f in (adm, fin):
        for x in (os.path.join(PASTA, f), os.path.join(PASTA, f) + ".ultimo"):
            if os.path.exists(x): os.remove(x)
    c1 = b.new_context(); pg = c1.new_page(); senha(pg, adm)
    ok("D1 administração sem app vai para o cadastro", pg.url.endswith("/seguranca/duas-etapas"), pg.url)
    pg.goto(f"{B}/clientes"); pg.wait_for_load_state("networkidle")
    ok("D2 sem cadastrar não abre telas", "/seguranca/duas-etapas" in pg.url, pg.url)
    r = pg.request.get(f"{B}/agenda/periodo?vista=mes&data=2026-11-01")
    ok("D3 sem o código, a rota de dados nega", r.status in (401, 403), r.status)
    pg.click("button:has-text('Mostrar o QR code')"); pg.wait_for_selector("img.qr-mfa")
    ok("D4 QR code aparece", pg.locator("img.qr-mfa").count() == 1)
    pg.fill("#codigo", "000000"); pg.click("button:has-text('Ativar e entrar')")
    pg.wait_for_selector(".aviso.erro", timeout=20000)
    ok("D5 código errado recusado no cadastro", "errado" in pg.inner_text(".aviso.erro").lower(), pg.inner_text(".aviso.erro"))
    pg.goto(f"{B}/seguranca/duas-etapas"); duas_etapas(pg, B, adm)
    ok("D6 cadastra e entra no painel", pg.url == f"{B}/", pg.url)
    pg.goto(f"{B}/clientes"); pg.wait_for_selector("main h1")
    ok("D7 com o código, telas abrem", "/clientes" in pg.url, pg.url)
    c1.close()

    # 2. próximo login: pede o código
    c2 = b.new_context(); pg = c2.new_page(); senha(pg, adm)
    ok("D8 segundo acesso pede o código", "/entrar/codigo" in pg.url, pg.url)
    pg.goto(f"{B}/financeiro"); pg.wait_for_load_state("networkidle")
    ok("D9 sem o código não abre telas", "/entrar/codigo" in pg.url, pg.url)
    pg.fill("#codigo", "123456"); pg.click("button:has-text('Entrar')"); pg.wait_for_selector(".aviso.erro", timeout=20000)
    ok("D10 código errado recusado", "/entrar/codigo" in pg.url)
    duas_etapas(pg, B, adm)
    ok("D11 código certo entra", pg.url == f"{B}/", pg.url)

    # 3. atendimento não é obrigado
    c3 = b.new_context(); p3 = c3.new_page(); senha(p3, atd)
    ok("D12 atendimento entra direto", p3.url == f"{B}/", p3.url)
    c3.close()

    # 4. financeiro também é obrigado; administração remove de outra pessoa
    c4 = b.new_context(); p4 = c4.new_page(); senha(p4, fin)
    ok("D13 financeiro também cadastra", p4.url.endswith("/seguranca/duas-etapas"), p4.url)
    duas_etapas(p4, B, fin); c4.close()
    pg.goto(f"{B}/usuarios?q=Teste"); pg.wait_for_selector(".tabela-usuarios")
    pg.locator(".tabela-usuarios tr", has_text="Teste FIN").first.locator("button[aria-label='Gerenciar acesso']").click()
    pg.wait_for_selector(".gaveta")
    ok("D14 painel mostra duas etapas ativa", "Duas etapas ativa" in pg.inner_text(".gaveta"))
    pg.click(".gaveta button:has-text('Remover (trocou ou perdeu o celular)')")
    pg.wait_for_selector(".gaveta .aviso.ok, .gaveta .aviso.erro", state="attached", timeout=20000)
    t = pg.locator(".gaveta .aviso.ok, .gaveta .aviso.erro").last.inner_text()
    ok("D15 administração remove a verificação de outra pessoa", "removida" in t.lower(), t)
    c5 = b.new_context(); p5 = c5.new_page(); senha(p5, fin)
    ok("D16 depois de removida, cadastra de novo", p5.url.endswith("/seguranca/duas-etapas"), p5.url)
    for x in (os.path.join(PASTA, fin), os.path.join(PASTA, fin) + ".ultimo"):
        if os.path.exists(x): os.remove(x)
    duas_etapas(p5, B, fin); c5.close()
    b.close()
print(f"RESULTADO {sum(res)} de {len(res)}")
