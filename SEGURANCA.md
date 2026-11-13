# Segurança do Delta Gestão

Como cada proteção está feita. Revisado em 13/11/2026.

| Item | Como está |
|---|---|
| Chaves de API | Só a chave **publicável** vai ao navegador (é pública por natureza; quem decide o acesso é o banco). A chave **secreta** existe só na Vercel (`SUPABASE_SECRET_KEY`, sem `NEXT_PUBLIC`) e só é lida no servidor (`server-only`). |
| Segredos no git | `.env*` fora do git (só `.env.example`, sem segredo). Nenhuma chave secreta no histórico. Os CPFs reais foram tirados dos arquivos; os testes usam CPFs fictícios válidos. |
| RLS | Ligado em **todas** as tabelas (o teste `supabase/tests/seguranca.sql` falha se alguma ficar sem). Anônimo não executa nenhuma função nem lê tabela. |
| Login no servidor | Login, sessão e permissões são conferidos no servidor (`proxy.ts`, `lib/acesso.ts`) e de novo no banco (`tem_permissao`). A tela nunca decide sozinha. |
| Restringir acesso | Perfis e permissões por ação; visitante só lê, com dados pessoais e valores escondidos; tentativas sem permissão ficam registradas. |
| Mass assignment | As ações aceitam só os campos do formulário (zod descarta o resto) e o banco só deixa gravar direto as colunas editáveis: status, número, autor, totais e datas de envio mudam só pelas funções do sistema. |
| Cookies | Sessão em cookie **httpOnly**, `Secure` e `SameSite=Lax`: código no navegador não lê o token. Cookie do visitante assinado (HMAC). |
| Senhas | Guardadas pelo Supabase com hash (bcrypt); mínimo de 10 caracteres com letras e números. Links de convite guardados só como hash SHA-256, de uso único e com validade. "Exigir senha nova" fica em `app_metadata`, que a pessoa não consegue desligar. |
| Limite de tentativas | Login (20 por IP e 6 por e-mail a cada 10–15 min), visitante, convite e troca de senha. Contado no banco; guarda só um resumo cifrado do IP/e-mail. |
| Robôs | Vercel BotID (desafio invisível) no login, no visitante e no convite, **em modo observação**: registra nos logs da Vercel (`[botid]`) mas não bloqueia. Para bloquear, criar a variável `BOTID_BLOQUEAR=1` na Vercel depois de conferir que a equipe não aparece como robô. O limite de tentativas já barra o chute de senhas. |
| Consultas | Todas pela biblioteca do Supabase ou por funções do banco, com parâmetros; nada de SQL montado com texto do usuário. |
| Validação | Toda ação do servidor valida os campos (zod) antes de gravar; o banco tem as próprias regras (check, gatilhos). |
| Vazamento de conteúdo | Mensagens de erro traduzidas, sem detalhe técnico; política de conteúdo (CSP) só permite o próprio site e o Supabase; o site não pode ser embutido em outro (`frame-ancestors 'none'`); HSTS, nosniff, Referrer-Policy. |
| Uploads | Só PDF e imagem (JPG, PNG, WEBP, HEIC), até 10 MB, conferido no servidor e no próprio armazenamento; buckets privados; link de envio assinado pelo servidor e caminho gerado por ele; leitura só com permissão. |
| Criptografia | Banco e arquivos cifrados em disco (AES-256) pelo Supabase e tudo trafega em HTTPS/TLS. CPF fica legível para o sistema poder buscar e montar contrato; a proteção é por permissão (próxima etapa: esconder CPF e telefone de quem não precisa). |

## Checklist de 24 pontos (conferido em 13/11/2026)

| # | Ponto | Situação |
|---|---|---|
| 1 | Chaves em variáveis de ambiente | ✅ nenhuma chave no código |
| 2 | Nada de segredo no histórico do git | ✅ nenhuma chave em nenhum commit (os CPFs antigos continuam no histórico: por isso o repositório deve ficar privado) |
| 3 | Chave secreta nunca no navegador | ✅ conferido no pacote publicado |
| 4 | Chave pública não passa do RLS | ✅ testado: sem login, a API nega todas as tabelas, funções e arquivos |
| 5 | RLS em todas as tabelas | ✅ todas |
| 6 | Nenhuma política "true" genérica | ✅ nenhuma; cada uma exige permissão (sistema de uma empresa só: o escopo é por perfil) |
| 7 | Acesso por papel, sem excesso | ✅ perfis e permissões por ação |
| 8 | Mass assignment | ✅ campos permitidos no servidor e no banco |
| 9 | Consultas parametrizadas | ✅ |
| 10 | Validação de entrada | ✅ em toda ação e rota |
| 11 | Telas sensíveis só com login | ✅ testado: tudo manda para /entrar |
| 12 | Sessão conferida no servidor | ✅ |
| 13 | Cookies httpOnly, secure, sameSite | ✅ |
| 14 | Senhas com hash | ✅ (Supabase/bcrypt; convites em SHA-256) |
| 15 | HTTPS em tudo | ✅ http → https (308) + HSTS |
| 16 | Cabeçalhos de segurança | ✅ CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy |
| 17 | Limite de tentativas | ✅ login, visitante, convite, troca de senha (não há rota de IA) |
| 18 | Proteção contra robôs | 🟡 BotID ligado em observação; bloquear depois de conferir com o navegador da equipe |
| 19 | Uploads restritos | ✅ tipo e tamanho no servidor e no armazenamento |
| 20 | Respostas enxutas | ✅ telas buscam no servidor; o navegador recebe só o que a tela mostra (configurações restritas só para quem pode) |
| 21 | Erros sem detalhe interno | ✅ mensagens traduzidas; o site publicado não mostra stack trace |
| 22 | Pacotes conferidos | ✅ `npm audit`: 0 vulnerabilidades; pacotes de autores oficiais |
| 23 | Dados sensíveis cifrados | ✅ não guardamos senha nem token de terceiros; links de convite só como hash; disco cifrado pelo Supabase |
| 24 | Auditoria do banco antes de entregar | ✅ `supabase/tests/auditoria_rls.sql` |
