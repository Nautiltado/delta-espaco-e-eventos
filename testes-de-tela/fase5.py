"""Fase 5 (encomendas de salgados): cozinha registra produção, atendimento faz o pedido e recebe,
cozinha marca pronto e entrega, estoque baixa, cancelamento de pedido pago cria a devolução,
Pix repetido é recusado, ajustes de estoque e preço, e quem não pode não entra."""
import os, random, re
from playwright.sync_api import sync_playwright, expect

B = os.environ.get("BASE", "http://localhost:3100"); S = os.environ["SENHA_TESTE"]
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

def produto(pg, nome):
    return pg.locator(".cardapio li").filter(has=pg.locator(f"strong:text-is('{nome}')"))

def novo_pedido(pg, cliente, itens, sabores=None):
    pg.goto(f"{B}/salgados/novo")
    pg.fill("#p-nome", cliente); pg.fill("#p-tel", "99981112233")
    pg.click(".chip:has-text('Balcão')"); pg.click(".chip:has-text('Amanhã')"); pg.fill("#p-hora", "15:00")
    for nome, q in itens:
        for _ in range(q): produto(pg, nome).get_by_role("button", name=f"Mais {nome}").click()
    for nome, ss in (sabores or {}).items():
        for s in ss: produto(pg, nome).locator(f".chip:has-text('{s}')").click()

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    coz, atd, adm = entrar(b, "coz"), entrar(b, "atd"), entrar(b, "adm")

    # permissões
    check(coz.locator(".lateral a:has-text('Cozinha')").count() == 1, "cozinha vê o menu Cozinha")
    check(atd.locator(".lateral a:has-text('Encomendas')").count() == 1, "atendimento vê o menu Encomendas")
    atd.goto(f"{B}/salgados/cozinha"); atd.wait_for_url("**/sem-permissao"); check(True, "atendimento não entra na tela da cozinha")
    coz.goto(f"{B}/salgados/novo"); coz.wait_for_url("**/sem-permissao"); check(True, "cozinha não registra pedido")

    # cozinha registra produção
    coz.goto(f"{B}/salgados/cozinha")
    def produzir(nome, qtd):
        coz.select_option("#pr-item", label=nome); coz.locator("form .chip", has_text=re.compile(f"^{qtd}$")).click()
        coz.click("button:has-text('Registrar produção')")
        expect(coz.get_by_role("status").filter(has_text=f"+{qtd} {nome.lower()}")).to_be_visible()
    def disp(nome):
        coz.goto(f"{B}/salgados/cozinha")
        return int(coz.locator(".estoque-item").filter(has_text=nome).locator(".num").inner_text())
    antes = disp("Coxinha de frango"); antes_pastel = disp("Pastelzinho de carne")
    produzir("Coxinha de frango", 200); produzir("Pastelzinho de carne", 100)
    check(disp("Coxinha de frango") == antes + 200, "produção soma no estoque da coxinha")

    # atendimento: sortido sem sabor é recusado
    novo_pedido(atd, "Cliente Salgado (teste)", [("Coxinha de frango (cento)", 1), ("Salgados de fritura sortidos (meio cento)", 1), ("Jarra de suco 1,5 L", 2)])
    atd.click(".rodape-pedido .botao")
    ver(atd.get_by_role("alert").filter(has_text="sabores"), "sortido sem sabor é recusado")
    for s in ["Coxinha de frango", "Pastelzinho de carne"]:
        produto(atd, "Salgados de fritura sortidos (meio cento)").locator(f".chip:has-text('{s}')").click()
    check("R$ 170,00" in atd.locator(".rodape-pedido .botao").inner_text().replace("\xa0", " "), "total do pedido R$ 170,00")
    atd.click(".rodape-pedido .botao"); atd.wait_for_url(re.compile(r"/salgados/[0-9a-f-]{36}\?aviso=criado"))
    url1 = atd.url.split("?")[0]
    ver(atd.get_by_text("Aguardando pagamento").first, "pedido nasce aguardando pagamento")
    ver(atd.get_by_text("25 coxinha de frango · 25 pastelzinho de carne"), "sortido dividido 25/25")

    # cozinha ainda não vê
    coz.goto(f"{B}/salgados/cozinha")
    check(coz.locator(".cozinha-pedido", has_text="Cliente Salgado (teste)").count() == 0, "cozinha não vê pedido sem pagamento")

    # pagamento
    pix = f"E2E{random.randint(10**9, 10**10)}"
    atd.fill("#pp-id", pix); atd.click("button:has-text('Pagamento recebido')")
    atd.wait_for_url(re.compile(r"aviso=pago"))
    ver(atd.get_by_text("Pago, na fila da cozinha").first, "pagamento registrado: pedido pago")

    # segundo pedido com o mesmo Pix é recusado
    novo_pedido(atd, "Cliente Salgado 2 (teste)", [("Quibe de carne (cento)", 1)])
    atd.click(".rodape-pedido .botao"); atd.wait_for_url(re.compile(r"aviso=criado")); url2 = atd.url.split("?")[0]
    atd.fill("#pp-id", pix); atd.click("button:has-text('Pagamento recebido')")
    ver(atd.get_by_role("alert").filter(has_text="já foi registrado"), "Pix repetido é recusado")
    atd.fill("#pp-id", pix + "B"); atd.click("button:has-text('Pagamento recebido')"); atd.wait_for_url(re.compile(r"aviso=pago"))

    # cozinha: vê, marca pronto, entrega
    coz.goto(f"{B}/salgados/cozinha")
    card = coz.locator(".cozinha-pedido", has_text="Cliente Salgado (teste)")
    check(card.count() == 1, "cozinha vê o pedido pago")
    check(card.get_by_text("25 coxinha de frango").count() == 1, "cozinha vê os sabores do sortido")
    card.get_by_role("button", name="Pronto").click()
    expect(coz.locator(".cozinha-pedido.pronto", has_text="Cliente Salgado (teste)")).to_be_visible()
    check(True, "marcado como pronto")
    reservado_antes = disp("Coxinha de frango")
    check(reservado_antes == antes + 200 - 125, "vendido sai do disponível (200 − 125)")
    coz.locator(".cozinha-pedido", has_text="Cliente Salgado (teste)").get_by_role("button", name="Cliente retirou").click()
    expect(coz.locator(".cozinha-pedido", has_text="Cliente Salgado (teste)")).to_have_count(0)
    check(disp("Coxinha de frango") == antes + 75, "retirada baixa o estoque e mantém o disponível")
    check(disp("Pastelzinho de carne") == antes_pastel + 75, "pastelzinho: 100 − 25")
    atd.goto(url1); ver(atd.get_by_text("Entregue").first, "pedido aparece como entregue")

    # cancelamento do pedido pago cria tarefa
    atd.goto(url2); atd.click("summary:has-text('Cancelar pedido')")
    atd.click("button:has-text('Cancelar pedido')")
    check(atd.get_by_text("Preencha este campo").count() == 0, "motivo é obrigatório no navegador")
    atd.fill("#pc-motivo", "cliente desistiu"); atd.click("button:has-text('Cancelar pedido')"); atd.wait_for_url(re.compile(r"aviso=cancelado"))
    ver(atd.get_by_text("cliente desistiu"), "pedido cancelado com motivo")
    atd.goto(f"{B}/tarefas"); ver(atd.get_by_text(re.compile(r"Devolver R\$\s?80,00 ao cliente do pedido PED-")).first, "tarefa de devolver o dinheiro criada")

    # estoque e preços (administração)
    adm.goto(f"{B}/salgados/estoque")
    linha = adm.locator("tr", has_text="Quibe de carne").first
    linha.locator("input[name=minimo]").fill("50"); linha.get_by_role("button", name="Salvar").click()
    expect(linha.get_by_text("✓")).to_be_visible(); check(True, "mínimo ajustado na tela")
    linha.locator("input[name=minimo]").fill("100"); linha.get_by_role("button", name="Salvar").click(); expect(linha.get_by_text("✓")).to_be_visible()
    linha.locator("summary:has-text('Registrar')").click()
    linha.locator("input[name=quantidade]").fill("5"); linha.get_by_role("button", name="Registrar").click()
    ver(linha.get_by_role("alert").filter(has_text="motivo"), "perda sem motivo é recusada")
    linha.locator("input[name=observacao]").fill("teste e2e"); linha.get_by_role("button", name="Registrar").click()
    ver(linha.get_by_role("status").filter(has_text="ajustado"), "perda com motivo registrada (o campo não se apaga após o erro)")
    adm.goto(f"{B}/salgados/estoque")
    ver(adm.locator(".pedidos-lista li", has_text="quibe de carne · Perda").first, "histórico mostra a perda")
    ver(adm.locator(".pedidos-lista li a", has_text="PED-").first, "histórico liga a retirada ao pedido")
    agua = adm.locator("tr", has_text="Água mineral").first
    agua.locator("input[name=preco]").fill("2,50"); agua.get_by_role("button", name="Salvar").click(); expect(agua.get_by_text("✓")).to_be_visible()
    adm.goto(f"{B}/salgados/estoque"); agua = adm.locator("tr", has_text="Água mineral").first
    check("2,50" in agua.inner_text(), "preço novo aparece")
    agua.locator("input[name=preco]").fill("2,00"); agua.get_by_role("button", name="Salvar").click(); expect(agua.get_by_text("✓")).to_be_visible()

    # celular
    cel = entrar(b, "atd", celular=True)
    cel.goto(f"{B}/salgados/novo"); cel.wait_for_timeout(800)
    check(cel.evaluate("document.documentElement.scrollWidth") <= 392, "novo pedido cabe no celular")
    os.makedirs("/tmp/f5", exist_ok=True); cel.screenshot(path="/tmp/f5/novo-celular.png")
    produto(cel, "Coxinha de frango (cento)").get_by_role("button", name="Mais Coxinha de frango (cento)").click()
    ver(cel.locator(".rodape-pedido .botao"), "botão de registrar fica visível no celular")
    cel.screenshot(path="/tmp/f5/novo-celular-item.png")
    coz2 = entrar(b, "coz", celular=True); coz2.goto(f"{B}/salgados/cozinha"); coz2.wait_for_timeout(800)
    check(coz2.evaluate("document.documentElement.scrollWidth") <= 392, "cozinha cabe no celular"); coz2.screenshot(path="/tmp/f5/cozinha-celular.png", full_page=True)
    b.close()
print(f"\n{ok} verificações OK")
