import os
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from apoio import duas_etapas
from playwright.sync_api import sync_playwright
B=os.environ.get("BASE","http://localhost:3100"); S=os.environ["SENHA_TESTE"]
paginas=["/","/agenda","/orcamentos","/orcamentos/41562889-7f06-428d-bde3-37511f966179","/reservas/dd444697-55b6-462c-9a23-5f3931beb389","/clientes","/catalogo","/configuracoes"]
os.makedirs("/tmp/cel",exist_ok=True)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"])
    ctx=b.new_context(viewport={"width":390,"height":844},device_scale_factor=1,is_mobile=True,has_touch=True)
    pg=ctx.new_page()
    pg.goto(f"{B}/entrar"); pg.screenshot(path="/tmp/cel/00-entrar.png")
    pg.fill("#email", "teste.e2e.adm@delta.test"); pg.fill("#senha",S); pg.click("button:has-text('Entrar')"); duas_etapas(pg, B, "teste.e2e.adm@delta.test")
    for n,u in enumerate(paginas,1):
        pg.goto(B+u); pg.wait_for_timeout(1500)
        w=pg.evaluate("document.documentElement.scrollWidth")
        largos=pg.evaluate("""[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>392).slice(0,4).map(e=>e.tagName+'.'+e.className)""")
        print(f"{n:02d} {u[:40]:40} largura={w} {largos}")
        pg.screenshot(path=f"/tmp/cel/{n:02d}.png", full_page=True)
    b.close()
# menu aberto
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"])
    ctx=b.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True); pg=ctx.new_page()
    pg.goto(f"{B}/entrar"); pg.fill("#email", "teste.e2e.adm@delta.test"); pg.fill("#senha",S); pg.click("button:has-text('Entrar')"); duas_etapas(pg, B, "teste.e2e.adm@delta.test")
    pg.click(".botao-menu"); pg.wait_for_timeout(300); pg.screenshot(path="/tmp/cel/90-menu.png")
    pg.click(".lateral a:has-text('Catálogo')"); pg.wait_for_url("**/catalogo"); pg.wait_for_timeout(800)
    print("menu fecha ao navegar:", not pg.locator(".lateral").is_visible())
    pg.click(".barra-inferior a:has-text('Agenda')"); pg.wait_for_url("**/agenda"); print("barra inferior navega: ok")
    b.close()
