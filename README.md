# Delta Gestão

Sistema de gestão da Delta Espaço e Eventos (Bacabal-MA): reservas dos dois espaços, buffet, salgados por cento, contratos e financeiro.

Plano completo e decisões: documento "Delta Gestão – Análise crítica, arquitetura e plano de execução".

## Situação: Fase 3 (Comercial)

| Pronto | Onde |
| --- | --- |
| Clientes PF e PJ com CPF/CNPJ validado, busca sem acento, aviso de cadastro repetido e mesclagem | `/clientes` |
| Catálogo com preço fixo ou faixa, histórico de preço e custo interno restrito | `/catalogo` |
| Orçamentos versionados: itens do catálogo ou livres, desconto com aprovação acima do limite, envio que congela a versão, PDF com impressão digital, nova versão, aceite e perda com motivo | `/orcamentos` |
| Funil por situação e tarefas (retorno automático ao enviar) | `/orcamentos`, `/tarefas` |

Critério de aceite da fase, garantido no banco: orçamento enviado não muda (nem pelo dono do banco), e custo interno só
aparece para quem tem `custo.ver`. Testes: `supabase/tests/fase3_comercial.sql` (27 cenários) e
`testes-de-tela/fase3.py` (32 verificações com navegador).

## Fase 2 (Fundação)

| Pronto | Onde |
| --- | --- |
| Login individual (e-mail e senha), senha provisória com troca obrigatória no 1º acesso | `src/app/entrar`, `src/app/trocar-senha` |
| Só entra quem um administrador cadastrou (o banco recusa qualquer outra conta) | migration `fundacao_login_config_rls` |
| 6 perfis e 27 permissões; menu e páginas conferem a permissão no servidor, e o banco confere de novo (RLS) | `src/lib/acesso.ts`, migrations |
| Usuários: cadastrar, escolher perfis, gerar senha provisória, desativar (nunca excluir) | `/usuarios` |
| Configurações com validação no banco e histórico | `/configuracoes` |
| Auditoria imutável: quem, quando, antes e depois | `/auditoria` |
| Núcleo de reservas e financeiro já protegido no banco (sem sobreposição de horário, pagamento imutável) | migration `nucleo_reservas_financeiro` |

## Rodar no computador

```bash
npm install
cp .env.example .env.local      # preencha SUPABASE_SECRET_KEY
npm run dev                      # http://localhost:3000
```

### Primeiro acesso dos administradores

Leonardo e Marileide já estão cadastrados como administradores no banco, mas ainda sem senha. Para cada um:

```bash
npm run criar-acesso -- email@exemplo.com
```

O comando mostra uma senha provisória. No primeiro login o sistema pede uma senha nova. Depois disso, novas pessoas são cadastradas pela tela Usuários.

## Testes

```bash
npm test          # regras de dinheiro, configurações e menu por permissão
```

Testes do banco (Fase 2: 43 cenários em blocos; Fase 3: 27 cenários em `fase3_comercial.sql`: cada perfil tentando o que não pode, auditoria, conflito de agenda): abra `supabase/tests/fundacao.sql` no SQL Editor do Supabase e execute cada bloco `do $$ … $$;` separadamente (selecione o bloco e rode). Cada um termina sempre com a mensagem `RESULTADO x de y testes passaram` e desfaz tudo, sem deixar dados.

## Estrutura

```
src/
  proxy.ts                 renova a sessão e manda para /entrar quem não está logado
  lib/acesso.ts            sessão + exigirAcesso / exigirPermissao (usar em toda página e ação)
  lib/permissoes.ts        perfis, permissões e menu
  lib/dinheiro.ts          centavos inteiros ↔ reais
  lib/configuracoes.ts     leitura e exibição das configurações
  app/(painel)/            telas internas
supabase/
  migrations/              histórico do banco, na ordem aplicada
  tests/fundacao.sql       testes de permissão e regras do banco
scripts/criar-acesso.mjs   primeiro acesso dos administradores
```

## Regras que valem para todo o código

- Dinheiro em centavos inteiros. Datas exibidas em America/Fortaleza.
- Nenhuma decisão de permissão só na tela: toda ação do servidor chama `exigirPermissao`, e o banco tem RLS.
- Registros financeiros, contratos e usuários não são apagados: são estornados, cancelados ou desativados.
- A chave secreta do Supabase só existe no servidor (`SUPABASE_SECRET_KEY`, sem `NEXT_PUBLIC_`).
