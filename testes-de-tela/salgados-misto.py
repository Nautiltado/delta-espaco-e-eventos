"""Cento misto (Playwright): até 4 sabores em blocos de 25, pode repetir, não passa de 100, pedido recusado incompleto,
composição no pedido e no resumo do WhatsApp, celular. Precisa de teste.e2e.atd e do servidor em localhost:3100."""
import os, re
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from apoio import duas_etapas
from playwright.sync_api import sync_playwright
B = os.environ.get("BASE", "http://localhost:3100"); S = os.environ["SENHA_TESTE"]
SHOTS = os.environ.get("CAPTURAS", "/tmp/capturas"); os.makedirs(SHOTS, exist_ok=True)
res = []
def ok(n, c, d=""): res.append(bool(c)); print("OK   " if c else "FALHA", n, str(d)[:200], flush=True)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    for largura in (1366, 390):
        pg = b.new_page(viewport={"width": largura, "height": 900})
        pg.goto(f"{B}/entrar"); pg.fill("#email", "teste.e2e.atd@delta.test"); pg.fill("#senha", S); pg.click("button:has-text('Entrar')"); duas_etapas(pg, B, "teste.e2e.atd@delta.test")
        pg.goto(f"{B}/salgados/novo"); pg.wait_for_selector(".cardapio")
        pg.fill("#p-nome", "Cliente Misto (teste)"); pg.fill("#p-tel", "(99) 98111-0202")
        pg.click("button[aria-label='Mais Salgados de fritura mistos (cento)']")
        item = pg.locator(".cardapio li", has_text="Salgados de fritura mistos (cento)")
        ok(f"X1 {largura} mostra os sabores de fritura com contador de 25", item.locator(".misto-sabores li").count() >= 5 and "Empada" not in item.inner_text())
        mais = lambda s: item.locator(f"button[aria-label='Mais 25 de {s}']").click()
        mais("Coxinha de frango"); mais("Coxinha de frango"); mais("Quibe de carne")
        ok(f"X2 {largura} contagem 75 de 100", "75 de 100" in item.inner_text(), item.inner_text()[:200])
        pg.click("button:has-text('Registrar pedido')")
        ok(f"X3 {largura} incompleto recusado com o que falta", "faltam 25 unidades" in pg.inner_text(".rodape-pedido .aviso.erro"), pg.inner_text(".rodape-pedido"))
        mais("Risoles de carne")
        ok(f"X4 {largura} completo trava o + (não passa de 100)", "100 de 100" in item.inner_text() and item.locator("button[aria-label='Mais 25 de Bolinha de queijo']").is_disabled())
        pg.screenshot(path=f"{SHOTS}/salgados-misto-{largura}.png", full_page=True)
        ok(f"X5 {largura} cabe na tela", pg.evaluate("document.documentElement.scrollWidth") <= largura + 2)
        pg.click("button:has-text('Registrar pedido')"); pg.wait_for_url(re.compile(r".*/salgados/[0-9a-f-]+\?aviso=criado"), timeout=20000)
        pg.wait_for_selector("a:has-text('Enviar resumo no WhatsApp')", timeout=20000)
        t = pg.inner_text("main")
        ok(f"X6 {largura} pedido mostra 50 coxinha, 25 quibe, 25 risoles", "50 coxinha de frango" in t and "25 quibe de carne" in t and "25 risoles de carne" in t, t[:300])
        href = pg.locator("a:has-text('Enviar resumo no WhatsApp')").get_attribute("href") or ""
        from urllib.parse import unquote
        ok(f"X7 {largura} resumo do WhatsApp leva os sabores", "50 coxinha de frango, 25 quibe de carne, 25 risoles de carne" in unquote(href), unquote(href)[:300])
        pg.close()
    b.close()
print(f"RESULTADO {sum(res)} de {len(res)}")
