"""Fase 7 (1ª parte): ficha do evento, equipe do Kaká, checklist, gastos com nota fiscal e fechamento.
Usa o primeiro evento da lista e as contas teste.e2e.{adm,atd,coz,fin}. Rode limpar-dados-de-teste.sql no fim."""
import os, re
from playwright.sync_api import sync_playwright, expect

B = os.environ.get("BASE", "http://localhost:3100"); S = os.environ["SENHA_TESTE"]
NOTA = os.environ.get("NOTA", "/tmp/nota-teste.png")
ok = 0
def check(cond, msg):
    global ok
    if not cond: raise AssertionError(msg)
    ok += 1; print("✓", msg)
def ver(loc, msg):
    expect(loc).to_be_visible(); check(True, msg)

def entrar(b, quem, celular=False):
    ctx = b.new_context(**({"viewport": {"width": 390, "height": 844}, "is_mobile": True, "has_touch": True} if celular else {}))
    pg = ctx.new_page(); pg.set_default_timeout(20000)
    pg.goto(f"{B}/entrar"); pg.fill("#email", f"teste.e2e.{quem}@delta.test"); pg.fill("#senha", S)
    pg.click("button:has-text('Entrar')"); pg.wait_for_url(f"{B}/")
    return pg

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    coz, atd, adm, fin = entrar(b, "coz"), entrar(b, "atd"), entrar(b, "adm"), entrar(b, "fin")

    # cozinha: vê a lista e a ficha, sem gastos nem equipe
    check(coz.locator(".lateral a:has-text('Eventos')").count() == 1, "cozinha vê o menu Eventos")
    if os.environ.get("EVENTO"):   # evento fora da janela da lista (ex.: criado pelo fase4 em 2028)
        coz.goto(f"{B}/eventos/{os.environ['EVENTO']}")
    else:
        coz.goto(f"{B}/eventos")
        link = coz.locator(".pedidos-lista li a").first
        expect(link).to_be_visible(); link.click()
    coz.wait_for_url(re.compile(r"/eventos/[0-9a-f-]{36}$"))
    url = coz.url
    ver(coz.get_by_role("heading", name="Ficha do dia"), "cozinha abre a ficha do evento")
    check(coz.locator(".cartao li").count() > 0, "ficha mostra o cardápio do orçamento")
    check(coz.get_by_role("heading", name=re.compile("Gastos do evento")).count() == 0, "cozinha não vê gastos")
    check(coz.get_by_text("Adicionar à equipe").count() == 0, "cozinha não monta equipe")
    check(coz.locator(".item-check").count() >= 16, "checklist padrão (16 itens)")
    primeiro = coz.locator(".item-check button").first
    primeiro.click()
    expect(coz.locator(".item-check button").first).to_have_attribute("aria-checked", "true")
    coz.reload(); expect(coz.locator(".item-check button").first).to_have_attribute("aria-checked", "true")
    ver(coz.locator(".item-check button").first.get_by_text("Teste"), "item marcado guarda quem marcou")
    coz.locator(".item-check button").first.click()
    expect(coz.locator(".item-check button").first).to_have_attribute("aria-checked", "false"); check(True, "desmarca")
    coz.locator("input[name=item]").first.fill("Gelo comprado"); coz.locator("form.form-inline button:has-text('+')").first.click()
    ver(coz.locator(".item-check", has_text="Gelo comprado").last, "inclui item novo no checklist")

    # atendimento: escreve a ficha
    atd.goto(url); atd.click("summary:has-text('Editar chegada')")
    atd.fill("#f-chegada", "17:30"); atd.fill("#f-traje", "Camisa preta"); atd.fill("#f-obs", "Bolo chega às 18h pela lateral")
    atd.click("button:has-text('Salvar ficha')")
    ver(atd.get_by_text("Bolo chega às 18h pela lateral").first, "ficha salva com observações")
    check(atd.get_by_text("Adicionar à equipe").count() == 0, "atendimento não monta equipe")

    # administração: equipe do Kaká (começa sem equipe, para os totais baterem a cada rodada)
    adm.goto(url); expect(adm.get_by_role("heading", name="Checklist")).to_be_visible()
    for _ in range(10):
        linhas = adm.locator(".pedidos-lista li", has=adm.get_by_role("button", name=re.compile("Desmarcar pago|Remover")))
        if not linhas.count(): break
        l = linhas.first
        if l.get_by_role("button", name="Desmarcar pago").count(): l.get_by_role("button", name="Desmarcar pago").click(); adm.wait_for_timeout(1500); continue
        l.get_by_role("button", name="Remover").click(); adm.get_by_role("button", name=re.compile("^Sim, remover")).first.click(); adm.wait_for_timeout(1500)
    adm.goto(url); expect(adm.get_by_role("heading", name="Checklist")).to_be_visible()
    if not adm.locator("#e-qtd").is_visible(): adm.click("summary:has-text('Adicionar à equipe')")
    check(adm.locator("#e-forn").input_value() == "Kaká", "quem traz a equipe já vem como Kaká")
    check(adm.locator("#e-valor").input_value() == "180,00", "diária do garçom já vem R$ 180,00")
    adm.fill("#e-qtd", "3"); adm.locator("button", has_text="Adicionar 3 garçons · R$ 540,00").click()
    ver(adm.get_by_text("3 garçons").first, "3 garçons na equipe")
    adm.select_option("#e-funcao", "seguranca") if adm.locator("#e-funcao").is_visible() else None
    if not adm.locator("#e-funcao").is_visible(): adm.click("summary:has-text('Adicionar à equipe')"); adm.select_option("#e-funcao", "seguranca")
    adm.fill("#e-qtd", "1"); adm.locator("button", has_text="Adicionar 1 segurança").click()
    ver(adm.get_by_text("1 segurança").first, "segurança na equipe")
    ver(adm.get_by_role("heading", name=re.compile(r"Equipe · R\$\s?720,00")), "total da equipe R$ 720,00")
    wa = adm.get_by_role("link", name=re.compile("Mandar para Kaká"))
    href = wa.get_attribute("href") or ""
    from urllib.parse import unquote
    texto = unquote(href)
    check("Precisamos de: 3 garçons, 1 segurança" in texto and "chegar às 17:30" in texto and "Camisa preta" in texto, "mensagem do WhatsApp para o Kaká completa")
    adm.locator(".pedidos-lista li", has_text="3 garçons").get_by_role("button", name="Marcar pago hoje").click()
    ver(adm.locator(".pedidos-lista li", has_text="3 garçons").get_by_text(re.compile("^Pago ")), "equipe marcada como paga")

    # financeiro: gasto com nota e fechamento
    fin.goto(url); expect(fin.get_by_role("heading", name="Checklist")).to_be_visible()
    ver(fin.get_by_role("heading", name="Fechamento"), "financeiro vê o fechamento")
    for _ in range(10):  # tira gastos de rodadas anteriores
        velhos = fin.locator(".pedidos-lista li", has=fin.locator("summary:has-text('Tirar da conta')"))
        if not velhos.count(): break
        v = velhos.first; v.locator("summary:has-text('Tirar da conta')").click(); v.locator("input[name=motivo]").fill("rodada anterior do teste")
        v.get_by_role("button", name="Tirar da conta").click(); fin.wait_for_timeout(1500)
        fin.goto(url); expect(fin.get_by_role("heading", name="Checklist")).to_be_visible()
    if not fin.locator("#g-desc").is_visible(): fin.click("summary:has-text('Lançar gasto')")
    fin.select_option("#g-cat", "compras"); fin.fill("#g-desc", "Carne e frango (teste)"); fin.fill("#g-forn", "Atacadão")
    fin.fill("#g-valor", "450,90"); fin.set_input_files("#g-nota", NOTA)
    fin.click("button:has-text('Lançar gasto')")
    expect(fin.get_by_role("status").filter(has_text="Gasto lançado com a nota")).to_be_visible(timeout=40000); check(True, "gasto lançado com a nota fiscal")
    li = fin.locator(".pedidos-lista li", has_text="Carne e frango (teste)")
    ver(li.get_by_role("link", name=re.compile(r"nota-teste")), "nota aparece no gasto e abre")
    fin.click("summary:has-text('Lançar gasto')") if not fin.locator("#g-desc").is_visible() else None
    fin.select_option("#g-cat", "gas"); fin.fill("#g-desc", "Botijão (teste)"); fin.fill("#g-valor", "120"); fin.uncheck("text=Já foi pago")
    fin.click("button:has-text('Lançar gasto')"); expect(fin.get_by_role("status").filter(has_text="Gasto lançado.")).to_be_visible(timeout=20000); check(True, "gasto a pagar lançado")
    fin.reload()
    fecha = fin.locator(".fechamento")
    t = fecha.inner_text().replace("\xa0", " ")
    check("− R$ 720,00" in t and "− R$ 570,90" in t, "fechamento soma equipe e gastos")
    check("Ainda a pagar: R$ 300,00" in t, "a pagar = segurança + botijão (R$ 300,00)")
    li2 = fin.locator(".pedidos-lista li", has_text="Botijão (teste)")
    li2.locator("summary:has-text('Tirar da conta')").click(); li2.locator("input[name=motivo]").fill("lançado errado")
    li2.get_by_role("button", name="Tirar da conta").click()
    expect(fin.locator(".pedidos-lista li", has_text="Botijão (teste)")).to_have_count(0); check(True, "gasto tirado da conta com motivo")

    # reserva leva à ficha
    adm.goto(url.replace("/eventos/", "/reservas/"))
    ver(adm.get_by_role("link", name="Ficha, equipe e gastos"), "reserva tem atalho para a ficha")

    # celular
    cel = entrar(b, "adm", celular=True); cel.goto(url); cel.wait_for_timeout(1000)
    check(cel.evaluate("document.documentElement.scrollWidth") <= 392, "ficha cabe no celular")
    os.makedirs("/tmp/f7", exist_ok=True); cel.screenshot(path="/tmp/f7/evento-celular.png", full_page=True)
    adm.goto(url); adm.emulate_media(media="print"); adm.screenshot(path="/tmp/f7/evento-impressao.png", full_page=True)
    b.close()
print(f"\n{ok} verificações OK")
