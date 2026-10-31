# Delta Espaço e Eventos — Site Oficial & Sistema de Gestão (DELTA OS)

Repositório oficial do site comercial, painel do proprietário (Modo Editor), cardápio de salgados fritos e sistema de triagem/Kanban de WhatsApp da **Delta Espaço e Eventos** (Bacabal – MA).

- **Site em Produção (Vercel):** https://delta-espaco-e-eventos.vercel.app
- **Espaços:** Delta Royal (400–500 pessoas) e Delta Corporate (até 100 pessoas)

## Como rodar em outro computador

1. Clone este repositório:
   ```bash
   git clone https://github.com/SEU_USUARIO/delta-espaco-e-eventos.git
   cd delta-espaco-e-eventos
   ```
2. Inicie o servidor local (Node.js):
   ```bash
   node server.js
   ```
3. Acesse no navegador:
   - **Visão do Cliente:** `http://localhost:4080`
   - **Painel do Proprietário (Modo Editor + Robô WhatsApp & Kanban):** `http://localhost:4080/?admin=1` (Senha: `delta2026`)

## Publicar alterações na Vercel

```bash
cd public
npx vercel --prod --yes
```
