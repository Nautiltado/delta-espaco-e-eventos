"""Orçamentos, etapa 1 (Playwright): item do catálogo com preço pendente bloqueando o envio, cento = 100 unidades,
item personalizado com categoria e descrição, desconto no item, custo e margem só para quem pode, alerta abaixo do custo,
aprovação, envio, PDF sem custo e com equivalência, unidade nova configurável e celular.
Precisa de teste.e2e.adm e teste.e2e.atd e do servidor em localhost:3100. Veja testes-de-tela/LEIA-ME.md."""
import os, re, random, subprocess, tempfile
import sys as _sys, os as _os
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from apoio import duas_etapas
from playwright.sync_api import sync_playwright

B = os.environ.get("BASE", "http://localhost:3100"); S = os.environ["SENHA_TESTE"]
SHOTS = os.environ.get("CAPTURAS", "/tmp/capturas"); os.makedirs(SHOTS, exist_ok=True)
res = []
def ok(n, c, d=""): res.append(bool(c)); print("OK   " if c else "FALHA", n, str(d)[:240], flush=True)
def cpf():
    d = [random.randint(0, 9) for _ in range(9)]
    for n in (9, 10): d.append((sum(d[i] * (n + 1 - i) for i in range(n)) * 10 % 11) % 10)
    return "".join(map(str, d))
def entrar(b, email, w=1440):
    pg = b.new_page(viewport={"width": w, "height": 900})
    pg.goto(f"{B}/entrar"); pg.fill("#email", email); pg.fill("#senha", S); pg.click("button:has-text('Entrar')"); duas_etapas(pg, B, email)
    return pg
def aviso(pg, escopo="main"):
    pg.wait_for_selector(f"{escopo} .aviso.ok, {escopo} .aviso.erro", timeout=20000)
    return pg.locator(f"{escopo} .aviso.ok, {escopo} .aviso.erro").last.inner_text()
def linha(pg, nome):
    return pg.locator(".tabela-itens tbody tr").filter(has=pg.locator(f"input[name=descricao][value='{nome}']")).first
def salvar_linha(pg, nome, **campos):
    l = linha(pg, nome)
    for k, v in campos.items(): l.locator(f"input[name={k}]").fill(v)
    l.locator("button:has-text('Salvar')").click()
    pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(800)
    pg.reload(); pg.wait_for_selector(".tabela-itens")

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    pg = entrar(b, "teste.e2e.adm@delta.test")
    pg.goto(f"{B}/clientes/novo"); pg.fill("#nome", "Cliente Etapa 1 (teste)"); pg.fill("#documento", cpf()); pg.fill("#telefone", "(99) 98111-0101")
    pg.select_option("#origem", "whatsapp"); pg.click("button:has-text('Salvar cliente')"); pg.wait_for_url(re.compile(r".*/clientes/[0-9a-f-]+$")); cli = pg.url.rsplit("/", 1)[1]
    pg.goto(f"{B}/orcamentos/novo?cliente={cli}"); pg.fill("#titulo", "Aniversário 100 pessoas (teste)"); pg.fill("#convidados", "100")
    pg.click("button:has-text('Criar orçamento')"); pg.wait_for_url(re.compile(r".*/orcamentos/[0-9a-f-]+$")); orc = pg.url

    # item do catálogo "a combinar" entra pendente
    pg.click("summary:has-text('Incluir um item de cada vez')")
    opt = pg.locator("#escolha option", has_text="Coxinha de frango").first.get_attribute("value")
    pg.select_option("#escolha", opt); pg.fill("#quantidade-novo", "2")
    ok("O1 formulário mostra a equivalência do cento", "= 200 unidades" in pg.inner_text("form:has(#escolha)"))
    pg.click("button:has-text('Incluir item')")
    pg.wait_for_selector(".tabela-itens input[name=descricao][value='Coxinha de frango']", timeout=20000)
    ok("O2 item entra com preço pendente", linha(pg, "Coxinha de frango").locator("input[name=preco]").input_value() == "")
    pg.reload(); pg.wait_for_selector(".tabela-itens")
    t = pg.inner_text(".tabela-itens")
    ok("O3 tabela mostra 200 unidades e o pendente", "= 200 unidades" in t and "preço pendente" in t and "preço(s) pendente(s)" in t, t[:200])
    ok("O4 envio bloqueado com a pendência listada", pg.locator("button:has-text('Enviar ao cliente')").is_disabled()
       and "Coxinha de frango sem preço definido" in pg.inner_text(".painel-lateral > aside"))

    # preço abaixo do custo
    salvar_linha(pg, "Coxinha de frango", preco="90,00", custo="95,00")
    ok("O5 venda abaixo do custo pede aprovação", "Coxinha de frango vendido abaixo do custo" in pg.inner_text(".painel-lateral > aside"), pg.inner_text(".painel-lateral > aside")[:300])
    ok("O6 margem negativa aparece em vermelho para quem vê custo", linha(pg, "Coxinha de frango").locator(".texto-erro").count() == 1)

    # item personalizado com categoria e descrição para o cliente
    pg.click("summary:has-text('Incluir um item de cada vez')")
    pg.select_option("#escolha", ""); pg.fill("#descricao-novo", "Decoração temática"); pg.select_option("#categoria-novo", "servico")
    pg.fill("#detalhe-novo", "Balões e painel"); pg.select_option("#unidade-novo", "servico"); pg.fill("#quantidade-novo", "1"); pg.fill("#preco-novo", "500,00")
    pg.click("button:has-text('Incluir item')"); pg.wait_for_selector(".tabela-itens input[name=descricao][value='Decoração temática']", timeout=20000)
    pg.reload(); pg.wait_for_selector(".tabela-itens")
    salvar_linha(pg, "Decoração temática", desconto="50,00")
    t = pg.inner_text(".tabela-itens")
    ok("O7 desconto no item e linhas de total", "de R$ 500,00" in t and "Descontos nos itens" in t and "- R$ 50,00" in t, t[-300:])
    salvar_linha(pg, "Coxinha de frango", custo="60,00")
    a = pg.inner_text(".painel-lateral > aside")
    ok("O8 sem venda abaixo do custo; desconto acima do teto pede aprovação", "abaixo do custo" not in a and "Desconto de 7,4% acima do limite" in a, repr(a[:600]))
    ok("O9 lucro bruto estimado só sobre itens com custo", "Lucro bruto estimado" in pg.inner_text("main") and "1 item está sem custo" in pg.inner_text("main"))

    pg.fill("#justificativa", "Cliente fecha dois eventos (teste)"); pg.click("button:has-text('Aprovar condições')")
    pg.wait_for_selector("aside .aviso.ok:has-text('Condições aprovadas')", timeout=20000)
    pg.click("button:has-text('Enviar ao cliente')"); pg.wait_for_url(re.compile(r".*enviado=1.*"), timeout=20000)
    ok("O10 versão enviada com total líquido", "R$ 630,00" in pg.inner_text(".total-linha"), pg.inner_text(".total-linha"))

    # PDFs: detalhado com equivalência e descrição; nenhum mostra custo
    textos = {}
    for fmt in ("", "&formato=detalhado"):
        r = pg.request.get(f"{orc}/pdf?versao=1{fmt}")
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f: f.write(r.body()); caminho = f.name
        textos[fmt] = subprocess.run(["pdftotext", "-layout", caminho, "-"], capture_output=True, text=True).stdout
    d = textos["&formato=detalhado"]
    ok("O11 PDF detalhado: 200 unidades, descrição e desconto do item", "200 unidades" in d and "Balões e painel" in d and "Desconto de R$ 50,00" in d, d[:400])
    ok("O12 nenhum PDF mostra custo ou margem", all("custo" not in t.lower() and "margem" not in t.lower() for t in textos.values()))
    ok("O13 proposta soma o desconto do item", "Desconto" in textos[""] and "R$ 680,00" in textos[""] and "R$ 630,00" in textos[""], textos[""][-600:])
    pg.screenshot(path=f"{SHOTS}/orcamento-etapa1.png", full_page=True)

    # atendimento não vê custo
    pa = entrar(b, "teste.e2e.atd@delta.test")
    pa.goto(orc); pa.wait_for_selector(".tabela-itens")
    ok("O14 atendimento não vê custo nem margem", "Custo" not in pa.inner_text(".tabela-itens thead") and "Lucro bruto" not in pa.inner_text("main"))

    # unidade configurável
    pg.goto(f"{B}/catalogo/unidades"); pg.wait_for_selector("main h1:has-text('Unidades de cobrança')"); pg.wait_for_selector(".tabela-rolavel tbody tr")
    ok("O15 lista mostra 1 cento = 100 unidades", "1 cento = 100 unidades" in pg.inner_text("main"))
    sufixo = "".join(random.choice("abcdefghij") for _ in range(4))
    pg.click("button:has-text('Nova unidade')"); pg.wait_for_selector("#u-codigo")
    pg.fill("#u-codigo", f"teste_{sufixo}"); pg.fill("#u-sing-nova", f"dúzia teste {sufixo}"); pg.fill("#u-plu-nova", f"dúzias teste {sufixo}")
    pg.fill("#u-eq-nova", "12"); pg.select_option("#u-equ-nova", "unidade")
    pg.click("button:has-text('Criar unidade')"); pg.wait_for_selector(".toast:has-text('Unidade criada.')", timeout=20000)
    pg.reload(); pg.wait_for_selector(".tabela-rolavel tbody tr"); ok("O16 unidade nova com equivalência", f"1 dúzia teste {sufixo} = 12 unidades" in pg.inner_text("main"), pg.inner_text("main")[-500:])

    # celular
    pc = entrar(b, "teste.e2e.adm@delta.test", 390)
    pc.goto(orc); pc.wait_for_selector(".tabela-itens")
    pc.screenshot(path=f"{SHOTS}/orcamento-etapa1-celular.png", full_page=True)
    ok("O17 orçamento cabe no celular", pc.evaluate("document.documentElement.scrollWidth") <= 392, pc.evaluate("document.documentElement.scrollWidth"))
    b.close()
print(f"RESULTADO {sum(res)} de {len(res)}")
