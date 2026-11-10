import { describe, expect, it } from "vitest";
import { menuDoUsuario, pode, type Acesso } from "./permissoes";

const cozinha: Acesso = {
  id: "1",
  nome: "Cozinha",
  email: "c@x",
  perfis: ["COZ"],
  permissoes: ["producao.status", "retirada.registrar", "estoque.movimentar"],
};
const admin: Acesso = { ...cozinha, perfis: ["ADM"], permissoes: ["config.critica", "auditoria.ver", "cliente.ver"] };

describe("menu por permissão", () => {
  it("cozinha não vê usuários, auditoria nem clientes", () => {
    const rotas = menuDoUsuario(cozinha).map((i) => i.href);
    expect(rotas).not.toContain("/usuarios");
    expect(rotas).not.toContain("/auditoria");
    expect(rotas).not.toContain("/clientes");
    expect(rotas).toContain("/salgados");
  });
  it("administrador vê usuários e auditoria", () => {
    const rotas = menuDoUsuario(admin).map((i) => i.href);
    expect(rotas).toEqual(expect.arrayContaining(["/usuarios", "/auditoria", "/configuracoes"]));
  });
  it("sem sessão, nada", () => {
    expect(menuDoUsuario(null)).toEqual([]);
    expect(pode(null, "config.critica")).toBe(false);
  });
});
