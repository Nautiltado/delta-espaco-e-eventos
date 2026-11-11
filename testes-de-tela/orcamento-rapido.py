import os, re, random, time
from playwright.sync_api import sync_playwright
B=os.environ.get("BASE","http://localhost:3100"); S=os.environ["SENHA_TESTE"]
def cpf():
    d=[random.randint(0,9) for _ in range(9)]
    for n in (9,10): d.append((sum(d[i]*(n+1-i) for i in range(n))*10%11)%10)
    return "".join(map(str,d))
res=[]
def ok(n,c,d=""): res.append(c); print("OK   " if c else "FALHA", n, d, flush=True)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"])
    pg=b.new_page(viewport={"width":1366,"height":900})
    pg.goto(f"{B}/entrar"); pg.fill("#email","teste.e2e.adm@delta.test"); pg.fill("#senha",S); pg.click("button:has-text('Entrar')"); pg.wait_for_url(f"{B}/", timeout=30000)
    pg.goto(f"{B}/clientes/novo"); pg.fill("#nome","Cliente Rápido (teste)"); pg.fill("#documento",cpf()); pg.fill("#telefone","(99) 98111-0000"); pg.select_option("#origem","whatsapp")
    pg.click("button:has-text('Salvar cliente')"); pg.wait_for_url(re.compile(r".*/clientes/[0-9a-f-]+$")); cli=pg.url.rsplit("/",1)[1]
    pg.goto(f"{B}/orcamentos/novo?cliente={cli}"); pg.fill("#titulo","Aniversário do Pedro (teste)"); pg.fill("#convidados","40"); pg.click("button:has-text('Criar orçamento')")
    pg.wait_for_url(re.compile(r".*/orcamentos/[0-9a-f-]+$"))
    t0=time.time()
    pg.click("button.modelo:has-text('Aniversário infantil')")
    linhas={r.locator("td").nth(1).inner_text().split("\n")[0]: r for r in pg.locator(".tabela-rapida tbody tr").all()}
    chk=lambda n: linhas[n].locator("input[type=checkbox]").is_checked()
    qtd=lambda n: linhas[n].locator("input[aria-label^='Quantidade']").input_value()
    ok("R1 modelo traz os itens", len(linhas)==12, str(len(linhas)))
    ok("R2 espaço menor marcado (40 cabem), maior não", chk("Locação do espaço menor") and not chk("Locação do espaço maior"))
    ok("R3 garçom: 2 para 40 convidados", qtd("Garçom")=="2", qtd("Garçom"))
    ok("R4 coxinha: 1,5 cento (120 un. arredondado)", qtd("Coxinha de frango")=="1,5", qtd("Coxinha de frango"))
    ok("R5 creme de galinha por pessoa = 40", qtd("Creme de galinha com batata palha")=="40")
    ok("R6 segurança e risoles opcionais vêm desmarcados", not chk("Segurança") and not chk("Risoles de carne"))
    ok("R7 preço de catálogo pré-preenchido (garçom)", linhas["Garçom"].locator("input[aria-label^='Preço']").input_value()!="")
    vazios=sum(1 for r in pg.locator(".tabela-rapida tbody tr").all() if r.locator("input[type=checkbox]").is_checked() and not r.locator("input[aria-label^='Preço']").input_value())
    if vazios:
        pg.click("button:has-text('Incluir ')")
        ok("R8 recusa sem preço e diz quantos", "Falta o preço" in pg.inner_text(".montagem .aviso.erro"), pg.inner_text(".montagem .aviso.erro"))
    else:
        ok("R8 último preço usado já preenche os itens a combinar", "último preço usado" in pg.inner_text(".tabela-rapida"))
    for r in pg.locator(".tabela-rapida tbody tr").all():
        if r.locator("input[type=checkbox]").is_checked():
            i=r.locator("input[aria-label^='Preço']")
            if not i.input_value(): i.fill("50,00")
    pg.fill("#busca-rapida","suco caja"); pg.keyboard.press("Enter")
    ok("R9 busca + Enter acrescenta", pg.locator(".tabela-rapida tbody tr", has_text="Suco de cajá").count()==1)
    pg.locator(".tabela-rapida tbody tr", has_text="Suco de cajá").locator("input[aria-label^='Preço']").fill("12,00")
    linhas["Segurança"].locator("input[type=checkbox]").check()
    botao=pg.locator(".montagem button.botao").first.inner_text(); print("   botão:", botao)
    pg.click(".montagem button.botao >> nth=0")
    pg.wait_for_function("document.querySelector('.montagem .aviso.ok')", timeout=20000)
    print("   tempo do modelo à inclusão:", f"{time.time()-t0:.1f}s")
    ok("R10 itens incluídos de uma vez", "10 itens incluídos" in pg.inner_text(".montagem .aviso.ok"), pg.inner_text(".montagem .aviso.ok"))
    pg.reload()
    n=pg.locator("td input[name=descricao]").count(); ok("R11 itens no orçamento", n==10, str(n))
    pg.screenshot(path="/tmp/capturas/orcamento-rapido.png", full_page=True)
    # modelo novo
    pg.goto(f"{B}/orcamentos/modelos"); ok("R12 lista de modelos", "Aniversário infantil" in pg.inner_text("main"))
    pg.click("text=Novo modelo"); pg.wait_for_url("**/modelos/novo")
    pg.fill("#m-nome",f"Jantar {random.randint(100,999)} (teste)")
    for termo in ["arroz branco","strogonoff de frango","salada tropical","farofa","garcom"]:
        pg.fill("input[aria-label='Acrescentar item do catálogo']", termo); pg.keyboard.press("Enter")
    g=pg.locator(".tabela-rapida tbody tr", has_text="Garçom")
    g.locator("select").select_option("a_cada"); g.locator("input[aria-label^='Quanto']").fill("30"); g.locator("input[aria-label^='Mínimo']").fill("1")
    pg.fill("input[aria-label='Convidados para simular']","45")
    ok("R13 simulação mostra 2 garçons para 45", "2 eventos" in g.inner_text() or "2 " in g.locator("td").nth(6).inner_text(), g.locator("td").nth(6).inner_text())
    pg.click("button:has-text('Salvar modelo')"); pg.wait_for_url(re.compile(".*/modelos/[0-9a-f-]+\\?salvo=1"), timeout=20000)
    pg.wait_for_selector("text=Modelo salvo", timeout=15000); ok("R14 modelo salvo", True)
    pg.goto(f"{B}/orcamentos/modelos"); ok("R15 aparece na lista", "(teste)" in pg.inner_text("main"))
    pg.set_viewport_size({"width":390,"height":844})
    pg.goto(f"{B}/orcamentos/novo?cliente={cli}"); pg.fill("#titulo","Celular (teste)"); pg.fill("#convidados","20"); pg.click("button:has-text('Criar orçamento')")
    pg.wait_for_url(re.compile(r".*/orcamentos/[0-9a-f-]+$")); pg.click("button.modelo:has-text('Aniversário infantil')")
    pg.screenshot(path="/tmp/capturas/orcamento-rapido-celular.png", full_page=True)
    ok("R16 cabe no celular", pg.evaluate("document.documentElement.scrollWidth")<=392, str(pg.evaluate("document.documentElement.scrollWidth")))
    b.close()
print(f"RESULTADO {sum(res)} de {len(res)}")
