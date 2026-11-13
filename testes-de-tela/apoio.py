"""Ajuda comum dos testes: passar pela verificação em duas etapas depois da senha.
Administração e Financeiro cadastram o app autenticador no primeiro acesso; o segredo do teste fica em
/tmp/mfa-segredos/<email> e os códigos saem do pyotp (pip install pyotp)."""
import os, re, time
import pyotp

PASTA = "/tmp/mfa-segredos"


def _codigo(segredo, ultimo=None):
    t = pyotp.TOTP(segredo)
    c = t.now()
    if c == ultimo:  # mesmo código de antes: espera virar a janela de 30 s (o servidor não aceita repetido)
        time.sleep(31 - (time.time() % 30))
        c = t.now()
    return c


def duas_etapas(pg, base, email, timeout=30000):
    """Depois de clicar em Entrar: resolve o cadastro ou o código, se aparecer, e espera chegar ao painel."""
    pg.wait_for_url(re.compile(r".*/(seguranca/duas-etapas|entrar/codigo|trocar-senha)?(\?.*)?$"), timeout=timeout)
    os.makedirs(PASTA, exist_ok=True)
    arq = os.path.join(PASTA, email)
    for _ in range(3):
        if pg.url.rstrip("/").endswith("/seguranca/duas-etapas"):
            pg.wait_for_selector("button:has-text('Mostrar o QR code'), img.qr-mfa", timeout=timeout)
            if pg.locator("img.qr-mfa").count() == 0:
                pg.click("button:has-text('Mostrar o QR code')")
            pg.wait_for_selector("[data-segredo]", state="attached", timeout=timeout)
            segredo = pg.get_attribute("[data-segredo]", "data-segredo")
            open(arq, "w").write(segredo)
            c = _codigo(segredo)
            open(arq + ".ultimo", "w").write(c)
            pg.fill("#codigo", c)
            pg.click("button:has-text('Ativar e entrar')")
        elif "/entrar/codigo" in pg.url:
            segredo = open(arq).read().strip()
            ultimo = open(arq + ".ultimo").read() if os.path.exists(arq + ".ultimo") else None
            c = _codigo(segredo, ultimo)
            open(arq + ".ultimo", "w").write(c)
            try:
                pg.fill("#codigo", c, timeout=10000)
            except Exception:
                pg.screenshot(path="/tmp/capturas/apoio-falha.png"); print("APOIO", pg.url, pg.inner_text("body")[:300]); raise
            pg.click("button:has-text('Entrar')")
        else:
            break
        # espera sair da tela atual (ou aparecer erro de código, que mantém a tela)
        antes = pg.url
        for i in range(int(timeout / 250)):
            if pg.url != antes:
                break
            if i > 24 and pg.locator(".aviso.erro").count():  # 6 s sem sair da tela e com erro: código recusado
                break
            pg.wait_for_timeout(250)
        if pg.url.rstrip("/") == base.rstrip("/"):
            break
    pg.wait_for_url(f"{base}/", timeout=timeout)
