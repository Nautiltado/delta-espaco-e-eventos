# Delta Gestão — contexto para continuar o trabalho

Sistema de gestão da Delta Espaço e Eventos (Bacabal-MA): orçamentos, agenda, reservas e contratos, eventos,
encomendas de salgados (cozinha e estoque), financeiro, usuários e auditoria. Usuários reais: Leonardo e Marileide (ADM).
Fale com o usuário em português do Brasil, simples e direto; ele não é programador, mas acompanha.

## Onde está cada coisa
- Código: GitHub `Nautiltado/delta-espaco-e-eventos`, ramo `delta-gestao-fase-2` (a Vercel publica a partir dele).
- Site: https://delta-gestao-tan.vercel.app (Vercel, região gru1). `SUPABASE_SECRET_KEY` só existe na Vercel.
- Banco: Supabase, projeto `hlbkwlrooeffcjmfovlg` (São Paulo). Migrações em `supabase/migrations` (nome = versão registrada no banco).
- Stack: Next.js 16 (App Router, `proxy.ts`, `cacheComponents`), React 19, Supabase com RLS, zod. Leia `AGENTS.md`: este Next tem mudanças.

## Regras combinadas (não quebrar)
- Nenhum dado fictício em produção. Testes usam contas `teste.e2e.*@delta.test` criadas por `testes-de-tela/criar-contas-de-teste.sql`
  e apagadas no fim por `testes-de-tela/limpar-dados-de-teste.sql`. Tudo de teste leva "(teste)" no nome.
- Permissão se decide no banco (RLS + `tem_permissao`), nunca só na tela. Toda ação do servidor valida com zod e chama `exigirPermissao`.
- Ninguém é excluído: usuário é desativado com motivo; histórico e auditoria ficam.
- Não digitar senhas/chaves do usuário em campos; ele mesmo cola. Não alterar metadados de login das contas reais.
- CPFs reais ficam só em configurações restritas, nunca em arquivos do repositório ou documentação.
- Operações destrutivas no Supabase pedem confirmação ao usuário; se não houver resposta, avisar e esperar ("pede de novo").
- Antes do primeiro contrato real, revisão de advogado.
- Segurança: ver `SEGURANCA.md` (checklist de 24 pontos) e rodar `supabase/tests/auditoria_rls.sql` antes de entregar.

## Testes
- `npx tsc --noEmit`, `npx eslint src`, `npx vitest run`, `npm run build`.
- Telas: `testes-de-tela/*.py` (Playwright + pyotp). Ver `testes-de-tela/LEIA-ME.md`. `apoio.py` passa pela verificação em duas etapas
  (segredos dos testes em `/tmp/mfa-segredos`). Banco: `supabase/tests/*.sql` (blocos que desfazem tudo no fim).
- Local: `.env.local` sem chave secreta; partes que usam o cliente admin (convite, backup, remover duas etapas) só testam no site publicado.

## Estado em 13/11/2026
Feito e no ar: módulo comercial (orçamentos etapa 1), agenda com troca instantânea, salgados (cento misto), usuários etapa 1
(convites, perfis, desativação), padrões de tela (janelas, toasts, paginação), contratos com editor, segurança (cookies httpOnly,
CSP, limite de tentativas, BotID em observação, colunas protegidas), modo visitante DESLIGADO.

Também no ar (13/11 à noite):
- Verificação em duas etapas obrigatória para ADM e FIN, conferida também no banco (`tem_permissao` exige aal2 desses perfis).
  `/seguranca/duas-etapas`, `/entrar/codigo`, remoção em Usuários. Teste `testes-de-tela/duas-etapas.py` (16/16 no site);
  antes de rodar, apagar os fatores das contas de teste em auth.mfa_factors. Testes do banco com ADM usam `'aal': 'aal2'` nas claims.
- Backup diário às 3h (`/api/backup`, cron em `vercel.json`, bucket privado `backups`, 35 dias) e Configurações → Backups.
- Avisos de segurança na Visão geral (bloqueios por tentativas, acessos negados, backup atrasado).
- Modo visitante desligado: `visitante.py` não roda mais (só se o usuário Visitante for reativado).

Pendências do usuário: tornar o repositório privado; ligar Leaked Password Protection no Supabase; ligar 2FA no GitHub, Vercel e Supabase;
conferir BotID com navegador real e então definir `BOTID_BLOQUEAR=1` na Vercel; preços/custos do catálogo; chave Pix; revisão do advogado.
Próximas ideias: modo cozinha (tela de toque), impressora de pedidos na cozinha, orçamentos etapas 2–5, matriz de permissões editável.
