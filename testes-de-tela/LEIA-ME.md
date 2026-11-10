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
