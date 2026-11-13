"""Convite de ponta a ponta (só na Vercel, a página usa a chave secreta): administração cadastra, a pessoa abre o link,
cria a senha e entra; o link não serve de novo; senha fraca é recusada; "exigir senha nova" derruba e pede troca;
redefinição por link. Ao fim a conta de teste fica desativada (nunca apagada). Conta teste.e2e.adm."""
import os, random, re
from playwright.sync_api import sync_playwright

B = os.environ.get("BASE", "https://delta-gestao-tan.vercel.app"); S = os.environ["SENHA_TESTE"]
SHOTS = os.environ.get("CAPTURAS", "/tmp/capturas"); os.makedirs(SHOTS, exist_ok=True)
res = []
def ok(n, c, d=""): res.append(bool(c)); print("OK   " if c else "FALHA", n, str(d)[:220], flush=True)
def abrir(pg, nome):
    pg.goto(f"{B}/usuarios?q={nome.split()[0]}"); pg.wait_for_selector(".tabela-usuarios")
    pg.locator(".tabela-usuarios tr", has_text=nome).first.locator("button:has-text('Gerenciar acesso')").click()
    pg.wait_for_selector(".gaveta")
def aviso(pg):
    pg.wait_for_selector(".gaveta .aviso.ok, .gaveta .aviso.erro", timeout=20000)
    return pg.locator(".gaveta .aviso.ok, .gaveta .aviso.erro").last.inner_text()
def criar_senha(b, link, senha):
    ctx = b.new_context(); pc = ctx.new_page(); pc.goto(link); pc.wait_for_selector("main")
    if pc.locator("#senha").count() == 0: return ctx, pc
    pc.fill("#senha", senha); pc.fill("#confirmacao", senha); pc.click("button:has-text('Salvar senha e entrar')")
    try: pc.wait_for_url(f"{B}/", timeout=30000)
    except Exception: pass
    return ctx, pc

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    cadm = b.new_context(viewport={"width": 1440, "height": 900}); pg = cadm.new_page()
    pg.goto(f"{B}/entrar"); pg.fill("#email", "teste.e2e.adm@delta.test"); pg.fill("#senha", S); pg.click("button:has-text('Entrar')"); pg.wait_for_url(f"{B}/")

    n = random.randint(1000, 9999); nome = f"Convidada Teste{n} (teste)"; email = f"convidada.{n}@delta.test"
    pg.goto(f"{B}/usuarios"); pg.click("button:has-text('Novo usuário')"); pg.wait_for_selector(".gaveta")
    g = pg.locator(".gaveta")
    g.locator("input[name=nome]").fill(nome); g.locator("input[name=email]").fill(email)
    g.locator("label.opcao", has_text="Cozinha").locator("input").check()
    g.locator("button:has-text('Cadastrar e gerar convite')").click(); pg.wait_for_selector(".gaveta .link-convite", timeout=20000)
    link = pg.inner_text(".gaveta .link-texto"); pg.keyboard.press("Escape")
    ok("C1 link gerado no endereço da Vercel", link.startswith(B + "/convite/"), link[:50])

    # senha fraca recusada
    c1 = b.new_context(); p1 = c1.new_page(); p1.goto(link); p1.wait_for_selector("#senha")
    ok("C2 página do convite abre com o nome", nome.split()[0] in p1.inner_text("main"), p1.inner_text("main")[:120])
    p1.fill("#senha", "abcdefghij"); p1.fill("#confirmacao", "abcdefghij"); p1.click("button:has-text('Salvar senha e entrar')")
    p1.wait_for_selector("main .aviso.erro, main [role=alert]", timeout=20000)
    ok("C3 senha sem número é recusada", "/convite/" in p1.url)
    c1.close()

    senha1 = "Conv" + "".join(random.choice("abcdefghjk") for _ in range(6)) + str(random.randint(10, 99))
    c2, p2 = criar_senha(b, link, senha1)
    ok("C4 cria a senha e entra no painel", p2.url == f"{B}/", p2.url)
    ok("C5 cozinha vê o menu Cozinha", p2.locator(".lateral a:has-text('Cozinha')").count() >= 1)
    p3 = b.new_context().new_page(); p3.goto(link); p3.wait_for_selector("main")
    ok("C6 link usado não abre de novo", p3.locator("#senha").count() == 0, p3.inner_text("main")[:100])

    pg.goto(f"{B}/usuarios?q=Convidada"); pg.wait_for_selector(".tabela-usuarios")
    ok("C7 situação: ativo", "Ativo" in pg.locator(".tabela-usuarios tr", has_text=nome).inner_text())

    # exigir senha nova: derruba e, ao entrar, pede troca
    abrir(pg, nome); pg.click(".gaveta button:has-text('Exigir senha nova no próximo acesso')")
    ok("C8 troca de senha exigida", "senha" in aviso(pg).lower())
    pg.keyboard.press("Escape")
    p2.goto(f"{B}/agenda"); p2.wait_for_load_state("networkidle")
    ok("C9 sessão dela cai na hora", "/entrar" in p2.url, p2.url)
    p2.goto(f"{B}/entrar"); p2.fill("#email", email); p2.fill("#senha", senha1); p2.click("button:has-text('Entrar')")
    p2.wait_for_load_state("networkidle"); p2.wait_for_timeout(1500)
    ok("C10 ao entrar, pede senha nova", "senha" in p2.url or "Trocar" in p2.inner_text("main") or "nova" in p2.inner_text("main").lower(), p2.url)
    c2.close()

    # redefinição por link
    abrir(pg, nome); pg.click(".gaveta button:has-text('Gerar link de redefinição de senha')")
    pg.wait_for_selector(".gaveta .link-convite", timeout=20000); link2 = pg.inner_text(".gaveta .link-texto")
    pg.keyboard.press("Escape")
    senha2 = senha1 + "x9"
    c4, p4 = criar_senha(b, link2, senha2)
    ok("C11 redefinição por link funciona e entra", p4.url == f"{B}/", p4.url)
    c4.close()

    # limpeza: desativa (nunca apaga)
    abrir(pg, nome); pg.click(".gaveta button:has-text('Desativar…')")
    pg.locator(".gaveta input[name=motivo]").last.fill("Fim do teste de convite (teste)")
    pg.click(".gaveta button:has-text('Sim, desativar')")
    ok("C12 conta de teste desativada", "desativado" in aviso(pg).lower())
    b.close()
print(f"RESULTADO {sum(res)} de {len(res)}")
