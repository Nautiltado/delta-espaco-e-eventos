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

`concorrencia.mjs` dispara 30 pedidos simultâneos para o mesmo espaço e horário e exige exatamente um aceito.

Ao final, rode `limpar-dados-de-teste.sql` no SQL do Supabase: apaga só o que as contas de teste criaram (e as contas).
