"""Agenda nas resoluções 1920 a 390, nos temas claro e escuro: sem rolagem lateral, painel abre e fecha com Esc, vistas, filtros e formulários."""
import os, sys
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from apoio import duas_etapas
from playwright.sync_api import sync_playwright
BASE="http://localhost:3100"; SENHA=os.environ["SENHA_TESTE"]; S=os.environ.get("CAPTURAS","/tmp/capturas"); os.makedirs(S, exist_ok=True)
res=[]
def ok(n,c,d=""): res.append((n,bool(c))); print("OK  " if c else "FALHA",n,d,flush=True)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome")
    ctx=b.new_context(viewport={"width":1440,"height":900}); pg=ctx.new_page()
    erros=[]; pg.on("pageerror", lambda e: erros.append(str(e)))
    pg.goto(f"{BASE}/entrar"); pg.fill("#email", "teste.e2e.adm@delta.test"); pg.fill("#senha",SENHA); pg.click("button:has-text('Entrar')"); duas_etapas(pg, BASE, "teste.e2e.adm@delta.test")
    for tema in ("claro","escuro"):
        pg.evaluate(f"localStorage.setItem('delta-tema','{tema}')")
        for w,h in [(1920,1080),(1600,900),(1440,900),(1366,768),(1024,768),(768,1024),(390,844)]:
            pg.set_viewport_size({"width":w,"height":h})
            pg.goto(f"{BASE}/agenda"); pg.wait_for_selector(".calendario")
            sw=pg.evaluate("document.documentElement.scrollWidth")
            ok(f"{tema} {w} sem rolagem lateral", sw<=w+1, f"{sw}")
            pg.screenshot(path=f"{S}/{tema}-{w}-mes.png")
            pg.click("[data-dia] .abrir-dia >> nth=15")
            pg.wait_for_selector(".gaveta"); pg.wait_for_timeout(350)
            gw=pg.evaluate("document.querySelector('.gaveta').getBoundingClientRect().width")
            ok(f"{tema} {w} gaveta abre", gw>300, f"{gw}")
            pg.screenshot(path=f"{S}/{tema}-{w}-gaveta.png")
            pg.keyboard.press("Escape")
            ok(f"{tema} {w} Esc fecha", pg.locator(".gaveta").count()==0)
    pg.set_viewport_size({"width":1440,"height":900}); pg.evaluate("localStorage.setItem('delta-tema','claro')")
    lat=pg.evaluate("getComputedStyle(document.querySelector('.lateral')||document.querySelector('aside')).backgroundColor")
    ok("lateral verde no claro", "255, 255, 255" not in lat, lat)
    for v in ("semana","dia","lista"):
        pg.goto(f"{BASE}/agenda?vista={v}"); pg.wait_for_load_state("networkidle")
        pg.screenshot(path=f"{S}/vista-{v}.png", full_page=True)
        ok(f"vista {v} carrega", pg.locator("h1:has-text('Agenda')").count()==1)
    pg.goto(f"{BASE}/agenda"); pg.wait_for_selector(".calendario")
    for nome in ("Espaço maior","Eventos externos","Todos"):
        pg.click(f".agenda-filtros button:has-text('{nome}')")
        ok(f"filtro {nome}", pg.locator(f".agenda-filtros button[aria-pressed=true]:has-text('{nome}')").count()==1)
    # formularios
    pg.click("[data-dia] .abrir-dia >> nth=30"); pg.wait_for_selector(".gaveta")
    for bt,shot in [("Novo evento","form-evento"),("Bloquear data ou horário","form-bloqueio"),("Registrar evento externo","form-externo"),("Consultar disponibilidade","form-consulta")]:
        pg.click(f".gaveta-acoes button:has-text('{bt}')"); pg.wait_for_timeout(200)
        pg.screenshot(path=f"{S}/{shot}.png")
        pg.click(".gaveta button:has-text('Voltar ao dia')")
    pg.click(".gaveta-acoes button:has-text('Consultar disponibilidade')")
    pg.click(".gaveta button:has-text('Consultar')>>nth=-1")
    pg.wait_for_selector(".resultado-disp, .aviso.erro", timeout=20000)
    ok("consulta disponibilidade responde", pg.locator(".resultado-disp li").count()>=2, pg.locator(".gaveta-corpo").inner_text()[-200:])
    pg.screenshot(path=f"{S}/consulta-resultado.png")
    pg.goto(f"{BASE}/configuracoes?secao=tempos"); pg.wait_for_selector("text=Tempos de cada espaço")
    ok("configurações mostra tempos por espaço", pg.locator(".tempos-espaco").count()>=2)
    ok("sem erros de página", not erros, str(erros[:3]))
    b.close()
print(f"RESULTADO {sum(c for _,c in res)} de {len(res)}")
