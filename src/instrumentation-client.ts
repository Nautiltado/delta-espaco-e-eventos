import { initBotId } from "botid/client/core";

// Desafio invisível contra robôs nas telas públicas que mandam dados (entrar, visitante e convite).
// As ações do servidor são POST para o próprio endereço da página.
// Só no site publicado: o desafio é servido pela Vercel e não existe no computador de testes.
if (!["localhost", "127.0.0.1"].includes(window.location.hostname)) {
  initBotId({
    protect: [
      { path: "/entrar", method: "POST" },
      { path: "/convite/*", method: "POST" },
    ],
  });
}
