"""Usuários e acessos (Playwright): atendimento barrado e registrado, cadastro com convite por link, situação do convite,
perfis (visitante não combina; ninguém tira o próprio administrador), dados, encerrar sessões derruba o outro na hora,
desativar com motivo e transferência, reativar, histórico e celular. Contas teste.e2e.adm e teste.e2e.atd."""
import os, random, re
from playwright.sync_api import sync_playwright

B = os.environ.get("BASE", "http://localhost:3100"); S = os.environ["SENHA_TESTE"]
SHOTS = os.environ.get("CAPTURAS", "/tmp/capturas"); os.makedirs(SHOTS, exist_ok=True)
res = []
def ok(n, c, d=""): res.append(bool(c)); print("OK   " if c else "FALHA", n, str(d)[:220], flush=True)
def entrar(b, email, w=1440):
    ctx = b.new_context(viewport={"width": w, "height": 900}); pg = ctx.new_page()
    pg.goto(f"{B}/entrar"); pg.fill("#email", email); pg.fill("#senha", S); pg.click("button:has-text('Entrar')"); pg.wait_for_url(f"{B}/", timeout=30000)
    return ctx, pg
def abrir(pg, nome):
    pg.goto(f"{B}/usuarios?q={nome.split()[0]}"); pg.wait_for_selector(".tabela-usuarios")
    pg.locator(".tabela-usuarios tr", has_text=nome).first.locator("button[aria-label='Gerenciar acesso']").click()
    pg.wait_for_selector(".gaveta")
def aviso(pg):
    try:
        pg.wait_for_selector(".gaveta .aviso.ok, .gaveta .aviso.erro", timeout=20000)
    except Exception:
        pg.screenshot(path=f"{SHOTS}/usuarios-falha.png"); raise
    return pg.locator(".gaveta .aviso.ok, .gaveta .aviso.erro").last.inner_text()

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    catd, pa = entrar(b, "teste.e2e.atd@delta.test")
    pa.goto(f"{B}/usuarios"); pa.wait_for_load_state("networkidle")
    ok("U1 atendimento não abre Usuários", "/sem-permissao" in pa.url, pa.url)

    cadm, pg = entrar(b, "teste.e2e.adm@delta.test")
    pg.goto(f"{B}/usuarios"); pg.wait_for_selector(".tabela-usuarios")
    ok("U2 lista com perfis em etiqueta, situação e último acesso", pg.locator(".tabela-usuarios .selo").count() >= 4 and "Último acesso" in pg.inner_text("thead"))
    pg.goto(f"{B}/usuarios?perfil=VIS"); pg.wait_for_selector(".tabela-usuarios")
    linhas = pg.locator(".tabela-usuarios tbody tr").count()
    ok("U3 filtro por perfil", linhas >= 1 and all("Visitante" in pg.locator(".tabela-usuarios tbody tr").nth(i).inner_text() for i in range(linhas)))

    # novo usuário com convite
    n = random.randint(1000, 9999); nome = f"Fulana Teste{n} (teste)"; email = f"fulana.{n}@delta.test"
    pg.goto(f"{B}/usuarios"); pg.click("button:has-text('Novo usuário')"); pg.wait_for_selector(".gaveta")
    g = pg.locator(".gaveta")
    g.locator("input[name=nome]").fill(nome); g.locator("input[name=email]").fill(email); g.locator("input[name=telefone]").fill("(99) 98111-0404")
    g.locator("input[name=cargo]").fill("Atendente"); g.locator("label.opcao", has_text="Atendimento").locator("input").check()
    g.locator("label.opcao", has_text="Cozinha").locator("input").check()
    ok("U4 resumo soma as permissões dos dois perfis", "Clientes" in g.inner_text() and "Encomendas e cozinha" in g.inner_text())
    g.locator("label.opcao", has_text="Visitante").locator("input").check()
    marcados = [l for l in ["Atendimento", "Cozinha", "Visitante"] if g.locator("label.opcao", has_text=l).locator("input").is_checked()]
    ok("U5 visitante não se combina com outros perfis", marcados == ["Visitante"], marcados)
    g.locator("label.opcao", has_text="Atendimento").locator("input").check()
    g.locator("button:has-text('Cadastrar e gerar convite')").click()
    pg.wait_for_selector(".gaveta .link-convite", timeout=20000)
    link = pg.inner_text(".gaveta .link-texto")
    ok("U6 cadastro gera link de convite de uso único", re.match(r"^https?://.+/convite/[A-Za-z0-9_-]{40,}$", link), link[:60])
    ok("U7 nenhuma senha aparece para o administrador", "senha provisória" not in pg.inner_text(".gaveta").lower())
    pg.keyboard.press("Escape")
    pg.goto(f"{B}/usuarios?q=Fulana"); pg.wait_for_selector(".tabela-usuarios")
    ok("U8 situação: convite pendente", "Convite pendente" in pg.locator(".tabela-usuarios tr", has_text=nome).inner_text())

    # perfis e dados
    abrir(pg, nome); pg.click(".gaveta button[role=tab]:has-text('Perfis')")
    g.locator("label.opcao", has_text="Cozinha").locator("input").check(); g.locator("button:has-text('Salvar perfis')").click()
    ok("U9 perfis salvos", "Perfis salvos" in aviso(pg))
    pg.click(".gaveta button[role=tab]:has-text('Dados')"); g.locator("input[name=cargo]").fill("Atendente sênior"); g.locator("button:has-text('Salvar dados')").click()
    ok("U10 dados salvos", "Dados salvos" in aviso(pg))
    pg.keyboard.press("Escape")

    # a própria conta
    abrir(pg, "Teste ADM")
    ok("U11 própria conta sem desativar nem encerrar sessões", g.locator("button:has-text('Desativar')").count() == 0 and g.locator("button:has-text('Encerrar todas')").count() == 0)
    pg.click(".gaveta button[role=tab]:has-text('Perfis')"); g.locator("label.opcao", has_text="Administrador").locator("input").uncheck()
    ok("U12 não dá para tirar o próprio administrador", g.locator("button:has-text('Salvar perfis')").is_disabled() and "não pode tirar" in g.inner_text())
    pg.keyboard.press("Escape")

    # encerrar sessões do atendimento (que está logado em outro navegador)
    abrir(pg, "Teste ATD"); g.locator("input[name=motivo]").first.fill("Teste de sessão (teste)")
    g.locator("button:has-text('Encerrar todas as sessões')").click()
    ok("U13 sessões encerradas", "Sessões encerradas" in aviso(pg))
    pa.goto(f"{B}/clientes"); pa.wait_for_load_state("networkidle")
    ok("U14 atendimento é derrubado na hora", "/entrar" in pa.url, pa.url)
    pg.keyboard.press("Escape")

    # desativar com motivo e transferência, reativar
    abrir(pg, nome)
    g.locator("button:has-text('Desativar…')").click()
    g.locator("input[name=motivo]").last.fill("Teste de desativação (teste)")
    g.locator("select[name=transferir_para]").select_option(label="Teste ADM")
    g.locator("button:has-text('Sim, desativar')").click()
    ok("U15 desativado com histórico preservado", "Usuário desativado" in aviso(pg))
    pg.keyboard.press("Escape"); pg.goto(f"{B}/usuarios?q=Fulana"); pg.wait_for_selector(".tabela-usuarios")
    ok("U16 situação: desativado", "Desativado" in pg.locator(".tabela-usuarios tr", has_text=nome).inner_text())
    abrir(pg, nome); g.locator("input[name=motivo]").fill("Voltou (teste)"); g.locator("button:has-text('Reativar')").click()
    ok("U17 reativado", "reativado" in aviso(pg))
    pg.click(".gaveta button[role=tab]:has-text('Histórico')"); pg.wait_for_selector(".historico-acesso li", timeout=20000)
    h = pg.inner_text(".historico-acesso")
    ok("U18 histórico com cadastro, convite, perfis, desativação e reativação",
       all(x in h for x in ["Cadastro criado", "Convite gerado", "Perfis alterados", "Desativado", "Reativado"]), h[:300])
    pg.screenshot(path=f"{SHOTS}/usuarios-gaveta.png")
    pg.keyboard.press("Escape")

    # o link do convite foi cancelado na desativação
    if "localhost" in B:
        print("PULADO U19 (a página do convite usa a chave secreta, que só existe na Vercel)")
    else:
      pc = b.new_context().new_page(); pc.goto(link); pc.wait_for_load_state("networkidle")
      ok("U19 convite cancelado ao desativar não abre", "Link sem validade" in pc.inner_text("main") or "/entrar" in pc.url, pc.inner_text("main")[:120])

    # tentativa negada registrada no histórico do atendimento
    abrir(pg, "Teste ATD"); pg.click(".gaveta button[role=tab]:has-text('Histórico')"); pg.wait_for_selector(".historico-acesso li", timeout=20000)
    ok("U20 tentativa sem permissão registrada", "Tentou abrir algo sem permissão" in pg.inner_text(".historico-acesso"))
    pg.keyboard.press("Escape")
    pg.goto(f"{B}/usuarios"); pg.wait_for_selector(".tabela-usuarios"); pg.screenshot(path=f"{SHOTS}/usuarios-lista.png")

    cm, pm = entrar(b, "teste.e2e.adm@delta.test", 390)
    pm.goto(f"{B}/usuarios"); pm.wait_for_selector(".tabela-usuarios")
    ok("U21 celular sem rolagem lateral", pm.evaluate("document.documentElement.scrollWidth") <= 392)
    b.close()
print(f"RESULTADO {sum(res)} de {len(res)}")
