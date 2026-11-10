"use client";

import { useActionState } from "react";
import {
  alterarPerfis,
  alternarAtivo,
  criarUsuario,
  redefinirSenha,
  type EstadoUsuario,
} from "./actions";

type Perfil = { codigo: string; nome: string };

function Retorno({ estado }: { estado: EstadoUsuario }) {
  if (estado.erro) return <p className="aviso erro" role="alert">{estado.erro}</p>;
  if (estado.senhaProvisoria) {
    return (
      <div className="aviso ok" role="status">
        {estado.ok} Senha provisória para <strong>{estado.para}</strong>:{" "}
        <code style={{ fontSize: "1.05rem", fontWeight: 700 }}>{estado.senhaProvisoria}</code>
        <br />
        Ela aparece só agora. Entregue pessoalmente; no primeiro acesso a pessoa escolhe a senha dela.
      </div>
    );
  }
  if (estado.ok) return <p className="aviso ok" role="status">{estado.ok}</p>;
  return null;
}

function CaixasPerfis({ perfis, marcados = [] }: { perfis: Perfil[]; marcados?: string[] }) {
  return (
    <div className="opcoes">
      {perfis.map((p) => (
        <label key={p.codigo}>
          <input type="checkbox" name="perfis" value={p.codigo} defaultChecked={marcados.includes(p.codigo)} />
          {p.nome}
        </label>
      ))}
    </div>
  );
}

export function NovoUsuario({ perfis }: { perfis: Perfil[] }) {
  const [estado, acao, enviando] = useActionState<EstadoUsuario, FormData>(criarUsuario, {});
  return (
    <form action={acao}>
      <Retorno estado={estado} />
      <div className="linha" style={{ marginBottom: 14 }}>
        <div className="campo">
          <label htmlFor="nome">Nome</label>
          <input id="nome" name="nome" type="text" required />
        </div>
        <div className="campo">
          <label htmlFor="email-novo">E-mail</label>
          <input id="email-novo" name="email" type="email" required />
        </div>
      </div>
      <div className="campo">
        <label>Perfis</label>
        <CaixasPerfis perfis={perfis} />
      </div>
      <button className="botao" disabled={enviando}>{enviando ? "Salvando…" : "Cadastrar e gerar senha"}</button>
    </form>
  );
}

export function LinhaUsuario({
  usuario,
  perfis,
  ehVoce,
}: {
  usuario: { id: string; nome: string; email: string; ativo: boolean; temLogin: boolean; perfis: string[] };
  perfis: Perfil[];
  ehVoce: boolean;
}) {
  const [ePerfis, aPerfis, pPerfis] = useActionState<EstadoUsuario, FormData>(alterarPerfis, {});
  const [eAtivo, aAtivo, pAtivo] = useActionState<EstadoUsuario, FormData>(alternarAtivo, {});
  const [eSenha, aSenha, pSenha] = useActionState<EstadoUsuario, FormData>(redefinirSenha, {});
  return (
    <tr style={usuario.ativo ? undefined : { opacity: 0.6 }}>
      <td style={{ minWidth: 190 }}>
        <strong>{usuario.nome}</strong> {ehVoce && <span className="selo dourado">você</span>}
        <div className="mudo">{usuario.email}</div>
        <div style={{ marginTop: 4 }}>
          {!usuario.ativo ? (
            <span className="selo erro">Desativado</span>
          ) : usuario.temLogin ? (
            <span className="selo">Acesso ativo</span>
          ) : (
            <span className="selo cinza">Sem senha ainda</span>
          )}
        </div>
      </td>
      <td>
        <form action={aPerfis}>
          <input type="hidden" name="id" value={usuario.id} />
          <CaixasPerfis perfis={perfis} marcados={usuario.perfis} />
          <button className="botao secundario pequeno" style={{ marginTop: 8 }} disabled={pPerfis}>
            Salvar perfis
          </button>
          <Retorno estado={ePerfis} />
        </form>
      </td>
      <td style={{ whiteSpace: "nowrap" }}>
        {usuario.ativo && (
          <form action={aSenha} style={{ marginBottom: 6 }}>
            <input type="hidden" name="id" value={usuario.id} />
            <button className="botao secundario pequeno" disabled={pSenha}>
              {usuario.temLogin ? "Nova senha provisória" : "Criar acesso"}
            </button>
          </form>
        )}
        {!ehVoce && (
          <form action={aAtivo}>
            <input type="hidden" name="id" value={usuario.id} />
            <input type="hidden" name="ativar" value={usuario.ativo ? "0" : "1"} />
            <button className="botao secundario pequeno" disabled={pAtivo}>
              {usuario.ativo ? "Desativar" : "Reativar"}
            </button>
          </form>
        )}
        <Retorno estado={eSenha} />
        <Retorno estado={eAtivo} />
      </td>
    </tr>
  );
}
