# Testes de tela

`fase3.py` percorre a Fase 3 com navegador de verdade (32 verificações): catálogo com custo, cliente com CPF,
aviso de duplicado, mesclagem, busca sem acento, orçamento com desconto e aprovação, envio que congela,
PDF, nova versão, aceite, funil, tarefas, e o perfil Atendimento sem ver custo.

Ele grava dados no banco. Rode só em ambiente de teste, ou crie as contas `teste.e2e.adm@delta.test` (ADM) e
`teste.e2e.atd@delta.test` (ATD) e apague tudo o que elas criaram ao final.

```bash
npm run build && npx next start -p 3100 &
SENHA_TESTE=... python3 testes-de-tela/fase3.py
```

`fase4.py` percorre a Fase 4 (46 verificações) com três perfis (atendimento, financeiro, administração): data segura
atravessando a madrugada, recusa dentro do horário de limpeza, espaços independentes, liberar data, contrato (PDF),
assinatura, Pix copia e cola com QR, baixa parcial, Pix repetido recusado, valor acima do saldo, confirmação,
tarefa de cobrança, estorno, prévia do cancelamento (multa por faixa e arrependimento), cancelamento, bloqueio
da agenda, modelo de contrato e telas no celular. Precisa das contas `teste.e2e.adm`, `teste.e2e.atd` e
`teste.e2e.fin` (perfis ADM, ATD e FIN). As datas são sorteadas em 2028 a cada rodada.

`fase5.py` percorre as encomendas (38 verificações) com atendimento, cozinha e administração: produção somando no
estoque, sortido sem sabor recusado, divisão do sortido, pedido só vai para a cozinha depois de pago, Pix repetido
recusado, pronto, retirada baixando o estoque, cancelamento antes de pronto com devolução e depois de pronto sem devolução (vira perda), mínimo, perda com
motivo, histórico ligado ao pedido, preço e telas no celular. Precisa de `teste.e2e.adm`, `teste.e2e.atd` e `teste.e2e.coz`.

`fase7.py` percorre a ficha do evento (27 verificações) com cozinha, atendimento, administração e financeiro: cardápio na
ficha, checklist marcado com nome e hora, ficha com chegada/traje/observações, equipe do Kaká com diária de R$ 180,
mensagem de WhatsApp, pagamento da equipe, gasto com nota fiscal (foto), gasto a pagar, fechamento e celular.
Precisa de `teste.e2e.fin` além das outras. Se não houver evento nos próximos 180 dias, rode com `EVENTO=<id da reserva>` (por exemplo, uma criada pelo fase4.py).

`orcamento-etapa1.py` percorre os itens do orçamento (17 verificações): item "a combinar" entra com preço pendente e
bloqueia o envio, cento = 100 unidades no formulário, na tabela e no PDF, item personalizado com categoria e descrição,
desconto no item, custo e margem só para a administração, alerta de venda abaixo do custo, aprovação, envio, PDFs sem
custo, unidade de cobrança nova e celular. `supabase/tests/orcamento_etapa1.sql` cobre as mesmas regras no banco (17).

`visitante.py` confere o modo visitante (14 verificações): botão na entrada, faixa, nenhum dado pessoal real nas telas
nem no PDF (os dados reais são lidos com a conta teste.e2e.adm e nunca impressos), valores zerados, encomendas abrem para ver mas a tela de nova encomenda não, cookie
httpOnly sem token do banco, celular e saída. Local, sem a chave secreta, suba o servidor com DELTA_TESTE_LOCAL=1,
VISITANTE_SEGREDO_TESTE e VISITANTE_TESTE_EMAIL/SENHA de uma conta de teste com perfil VIS (essas variáveis não existem na Vercel).

`usuarios.py` confere o módulo de usuários (21 verificações): atendimento não abre Usuários, lista com perfis, situação
e último acesso, filtros, resumo com a soma das permissões, visitante exclusivo, cadastro que gera link de convite (sem
senha provisória), perfis e dados salvos, proteção da própria conta e do próprio administrador, encerrar sessões (a
pessoa é derrubada na hora), desativar com motivo e transferência, reativar, histórico, link cancelado ao desativar,
tentativa sem permissão registrada e celular. A U19 só roda contra a Vercel (a página do convite usa a chave secreta).
`convite.py` (só na Vercel, 12 verificações) faz o convite de ponta a ponta: link, senha fraca recusada, senha criada e
entrada no painel, link usado não abre de novo, "exigir senha nova" derruba a sessão e leva à troca, redefinição por link;
no fim desativa a conta criada (nunca apaga).
O banco tem o teste `supabase/tests/acessos_etapa1.sql` (20 verificações, desfaz tudo no fim).

`salgados-misto.py` percorre o cento misto (14 verificações, computador e celular): até 4 sabores em blocos de 25,
pode repetir, não passa de 100, pedido incompleto recusado, composição no pedido e no resumo do WhatsApp.

`agenda.py` percorre a agenda (20 verificações) com a administração: clique no dia abre o painel lateral, cadastro rápido
cria orçamento sem bloquear a data, opção de segurar a data, verificar disponibilidade, bloqueio recusado por conflito,
bloqueio com observação e responsável, remoção pelo painel, evento externo, vistas Semana/Dia/Lista e filtro de externos.
`agenda-telas.py` confere a agenda em 1920, 1600, 1440, 1366, 1024, 768 e 390 px nos temas claro e escuro (52 verificações).

`concorrencia.mjs` dispara 30 pedidos simultâneos para o mesmo espaço e horário e exige exatamente um aceito.

Ao final, rode `limpar-dados-de-teste.sql` no SQL do Supabase: apaga só o que as contas de teste criaram (e as contas).

Padrões de tela (13/11): os retornos de sucesso aparecem como toast (`.toast`) e ficam também num `role=status`
escondido (só para leitor de tela); formulários de "Novo …" e ações de linha abrem em janela (`dialog.janela[open]`),
que fecha sozinha ao salvar. Listas longas têm paginação (`?pagina=`) e rolagem própria. A agenda troca de período
sem recarregar a página (dados em `/agenda/periodo`), então o teste espera o título mudar, não a URL carregar.
