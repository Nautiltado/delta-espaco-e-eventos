"use client";

import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Copy, KeyRound, LogOut, MailPlus, ShieldCheck, UserPlus, UserX, X } from "lucide-react";
import { linkWhatsApp } from "@/lib/documentos";
import { ACOES_HISTORICO, agruparPorModulo, permissoesDosPerfis, SENSIVEIS, SITUACOES } from "@/lib/usuarios";
import {
  alterarPerfis, atualizarDados, carregarHistorico, criarUsuario, desativar, forcarTrocaSenha, gerarConvite, marcarConviteEnviado,
  reativar, revogarConvite, revogarSessoes, type EstadoUsuario, type ItemHistorico,
} from "./actions";

export type UsuarioLista = {
  id: string; nome: string; email: string; telefone: string | null; cargo: string | null; inicio_em: string | null; observacoes: string | null;
  ativo: boolean; criado_em: string; desativado_em: string | null; desativacao_motivo: string | null; perfis: string[];
  ultimo_acesso: string | null; tem_login: boolean; situacao: string; convite_expira_em: string | null; convite_enviado_em: string | null;
};
export type PerfilComPermissoes = { codigo: string; nome: string; permissoes: string[] };

const data = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Fortaleza" });
const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Fortaleza" });
const iniciais = (n: string) => { const p = n.split(/\s+/).filter((x) => /^\p{L}/u.test(x)); return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase(); };

function Selo({ situacao }: { situacao: string }) {
  const s = SITUACOES[situacao] ?? { rotulo: situacao, selo: "cinza" };
  return <span className={`selo ${s.selo}`}>{s.rotulo}</span>;
}

function Retorno({ estado }: { estado: EstadoUsuario }) {
  if (estado.erro) return <p className="aviso erro" role="alert">{estado.erro}</p>;
  if (estado.ok && !estado.link) return <p className="aviso ok" role="status">{estado.ok}</p>;
  return null;
}

/** Link de convite: aparece uma vez. Copiar ou mandar pelo WhatsApp marca como enviado. */
function LinkGerado({ estado, telefone, nome }: { estado: EstadoUsuario; telefone?: string | null; nome?: string }) {
  const [copiado, setCopiado] = useState(false);
  if (!estado.link) return null;
  const enviar = () => { if (estado.conviteId) void marcarConviteEnviado(estado.conviteId); };
  const msg = `Olá${nome ? `, ${nome.split(" ")[0]}` : ""}! Este é o seu acesso ao Delta Gestão. Abra o link para criar a sua senha (vale por pouco tempo e só uma vez):\n${estado.link}`;
  return (
    <div className="aviso ok link-convite" role="status">
      <p style={{ margin: 0 }}>{estado.ok}</p>
      <code className="link-texto">{estado.link}</code>
      <div className="linha">
        <button type="button" className="botao pequeno" onClick={async () => { await navigator.clipboard.writeText(estado.link!); setCopiado(true); enviar(); }}>
          <Copy aria-hidden /> {copiado ? "Copiado" : "Copiar link"}
        </button>
        {telefone && linkWhatsApp(telefone) && (
          <a className="botao secundario pequeno" href={`${linkWhatsApp(telefone)}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" onClick={enviar}>Enviar pelo WhatsApp</a>
        )}
      </div>
      <small className="mudo">Este link não aparece de novo. Se perder, gere outro (o anterior deixa de valer).</small>
    </div>
  );
}

// ======================================================================== painel principal

export function PainelUsuarios({ usuarios, todosAtivos, perfis, descricoes, euId, filtros, resumo }: {
  usuarios: UsuarioLista[]; todosAtivos: { id: string; nome: string }[]; perfis: PerfilComPermissoes[];
  descricoes: Record<string, string>; euId: string;
  filtros: { q: string; perfil: string; situacao: string; acesso: string };
  resumo: { total: number; ativos: number; pendentes: number; desativados: number };
}) {
  const [aberto, setAberto] = useState<string | "novo" | null>(null);
  const fechar = useCallback(() => setAberto(null), []);
  const usuario = usuarios.find((u) => u.id === aberto);
  const nomePerfil = (c: string) => perfis.find((p) => p.codigo === c)?.nome ?? c;

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Usuários</h1>
          <p>Cada pessoa tem login próprio e só o acesso de que precisa. Ninguém é excluído: quem sai é desativado e o histórico fica.</p>
        </div>
        <button type="button" className="botao" onClick={() => setAberto("novo")}><UserPlus aria-hidden /> Novo usuário</button>
      </div>

      <div className="kpis">
        <div className="kpi"><span>Usuários</span><strong>{resumo.total}</strong></div>
        <div className="kpi tom-sucesso"><span>Ativos</span><strong>{resumo.ativos}</strong></div>
        <div className="kpi tom-alerta"><span>Aguardando acesso</span><strong>{resumo.pendentes}</strong></div>
        <div className="kpi"><span>Desativados</span><strong>{resumo.desativados}</strong></div>
      </div>

      <section className="cartao sem-respiro">
        <form className="filtros-usuarios" method="get">
          <input type="search" name="q" defaultValue={filtros.q} placeholder="Buscar por nome ou e-mail" aria-label="Buscar" />
          <select name="perfil" defaultValue={filtros.perfil} aria-label="Perfil">
            <option value="">Todos os perfis</option>
            {perfis.map((p) => <option key={p.codigo} value={p.codigo}>{p.nome}</option>)}
          </select>
          <select name="situacao" defaultValue={filtros.situacao} aria-label="Situação">
            <option value="">Todas as situações</option>
            {Object.entries(SITUACOES).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
          </select>
          <select name="acesso" defaultValue={filtros.acesso} aria-label="Último acesso">
            <option value="">Qualquer último acesso</option>
            <option value="7">Nos últimos 7 dias</option>
            <option value="30">Há mais de 30 dias</option>
            <option value="nunca">Nunca entrou</option>
          </select>
          <button className="botao secundario pequeno">Filtrar</button>
        </form>
        <div className="tabela-rolavel">
          <table className="tabela-usuarios">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Perfis</th><th>Situação</th><th>Último acesso</th><th>Cadastro</th><th /></tr></thead>
            <tbody>
              {usuarios.length === 0 && <tr><td colSpan={7} className="mudo">Ninguém com esses filtros.</td></tr>}
              {usuarios.map((u) => (
                <tr key={u.id} className={u.ativo ? undefined : "linha-inativa"}>
                  <td>
                    <div className="pessoa"><span className="avatar">{iniciais(u.nome)}</span>
                      <div><strong>{u.nome}</strong>{u.id === euId && <span className="mudo"> (você)</span>}{u.cargo && <div className="mudo pequeno">{u.cargo}</div>}</div>
                    </div>
                  </td>
                  <td className="mudo">{u.email}</td>
                  <td>{u.perfis.map((p) => <span key={p} className={`selo ${p === "ADM" ? "marca" : p === "VIS" ? "cinza" : "info"}`} style={{ marginRight: 4 }}>{nomePerfil(p)}</span>)}</td>
                  <td><Selo situacao={u.situacao} /></td>
                  <td className="mudo">{u.ultimo_acesso ? dataHora.format(new Date(u.ultimo_acesso)) : "nunca"}</td>
                  <td className="mudo">{data.format(new Date(u.criado_em))}</td>
                  <td className="acoes"><button type="button" className="botao secundario pequeno" onClick={() => setAberto(u.id)}>Gerenciar acesso</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {aberto === "novo" && <Gaveta titulo="Novo usuário" subtitulo="A pessoa recebe um convite e cria a própria senha." fechar={fechar}><NovoUsuario perfis={perfis} descricoes={descricoes} /></Gaveta>}
      {usuario && (
        <Gaveta key={usuario.id} titulo={usuario.nome} subtitulo={usuario.email} fechar={fechar}>
          <GerenciarAcesso u={usuario} perfis={perfis} descricoes={descricoes} euId={euId} ativos={todosAtivos} />
        </Gaveta>
      )}
    </>
  );
}

function Gaveta({ titulo, subtitulo, fechar, children }: { titulo: string; subtitulo: string; fechar: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    const t = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    window.addEventListener("keydown", t);
    return () => window.removeEventListener("keydown", t);
  }, [fechar]);
  return (
    <>
      <div className="gaveta-fundo visivel" onClick={fechar} aria-hidden />
      <aside className="gaveta gaveta-larga" role="dialog" aria-modal="true" aria-labelledby="gaveta-usuario">
        <header className="gaveta-topo">
          <div><h2 id="gaveta-usuario">{titulo}</h2><p className="mudo">{subtitulo}</p></div>
          <button ref={ref} type="button" className="botao fantasma pequeno icone" onClick={fechar} aria-label="Fechar (Esc)"><X aria-hidden /></button>
        </header>
        <div className="gaveta-corpo">{children}</div>
      </aside>
    </>
  );
}

// ======================================================================== novo usuário

function EscolhaPerfis({ perfis, marcados, setMarcados }: { perfis: PerfilComPermissoes[]; marcados: string[]; setMarcados: (v: string[]) => void }) {
  return (
    <div className="opcoes-espaco" role="group" aria-label="Perfis">
      {perfis.map((p) => (
        <label key={p.codigo} className="opcao">
          <input type="checkbox" name="perfis" value={p.codigo} checked={marcados.includes(p.codigo)}
            onChange={(e) => {
              if (!e.target.checked) return setMarcados(marcados.filter((x) => x !== p.codigo));
              // visitante não se combina com outros perfis
              setMarcados(p.codigo === "VIS" ? ["VIS"] : [...marcados.filter((x) => x !== "VIS"), p.codigo]);
            }} />
          <span>{p.nome}<span className="mudo pequeno"> · {p.permissoes.length} permissões{p.codigo === "ADM" ? ", acesso total" : p.codigo === "VIS" ? ", só ver" : ""}</span></span>
        </label>
      ))}
    </div>
  );
}

function ResumoPermissoes({ perfisMarcados, perfis, descricoes }: { perfisMarcados: string[]; perfis: PerfilComPermissoes[]; descricoes: Record<string, string> }) {
  const lista = permissoesDosPerfis(perfisMarcados, perfis);
  if (!lista.length) return <p className="mudo pequeno">Escolha um perfil para ver o que a pessoa poderá fazer.</p>;
  return (
    <div className="resumo-permissoes">
      <p className="mudo pequeno" style={{ margin: "0 0 6px" }}>
        {lista.length} permissões. Com mais de um perfil, vale a soma do que cada um permite.
      </p>
      {agruparPorModulo(lista).map(([modulo, ps]) => (
        <div key={modulo} className="modulo-permissoes">
          <strong>{modulo}</strong>
          <ul>{ps.map((p) => <li key={p}>{descricoes[p] ?? p}{SENSIVEIS.has(p) && <span className="selo alerta" style={{ marginLeft: 6 }}>sensível</span>}</li>)}</ul>
        </div>
      ))}
    </div>
  );
}

function NovoUsuario({ perfis, descricoes }: { perfis: PerfilComPermissoes[]; descricoes: Record<string, string> }) {
  const [estado, acao, enviando] = useActionState<EstadoUsuario, FormData>(criarUsuario, {});
  const [marcados, setMarcados] = useState<string[]>([]);
  const [telefone, setTelefone] = useState("");
  const [nome, setNome] = useState("");
  if (estado.link) return <><LinkGerado estado={estado} telefone={telefone} nome={nome} /></>;
  return (
    <form action={acao} className="form-gaveta">
      <fieldset>
        <legend>Funcionário</legend>
        <label className="campo"><span>Nome completo</span><input type="text" name="nome" required minLength={2} value={nome} onChange={(e) => setNome(e.target.value)} /></label>
        <label className="campo"><span>E-mail</span><input type="email" name="email" required autoComplete="off" /></label>
        <div className="grade-2">
          <label className="campo"><span>Telefone (opcional)</span><input type="tel" name="telefone" inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(99) 98111-2233" /></label>
          <label className="campo"><span>Data de início</span><input type="date" name="inicio" /></label>
        </div>
        <label className="campo"><span>Cargo ou função</span><input type="text" name="cargo" placeholder="Ex.: Atendente" /></label>
        <label className="campo"><span>Observações administrativas</span><textarea name="observacoes" rows={2} maxLength={1000} placeholder="Só a administração vê" /></label>
      </fieldset>
      <fieldset>
        <legend>Perfil de acesso</legend>
        <EscolhaPerfis perfis={perfis} marcados={marcados} setMarcados={setMarcados} />
        <ResumoPermissoes perfisMarcados={marcados} perfis={perfis} descricoes={descricoes} />
      </fieldset>
      <Retorno estado={estado} />
      <div className="gaveta-rodape-form"><button className="botao" disabled={enviando}><MailPlus aria-hidden /> {enviando ? "Cadastrando…" : "Cadastrar e gerar convite"}</button></div>
    </form>
  );
}

// ======================================================================== gerenciar acesso

function GerenciarAcesso({ u, perfis, descricoes, euId, ativos }: {
  u: UsuarioLista; perfis: PerfilComPermissoes[]; descricoes: Record<string, string>; euId: string; ativos: { id: string; nome: string }[];
}) {
  const [aba, setAba] = useState<"acesso" | "perfis" | "dados" | "historico">("acesso");
  return (
    <>
      <div className="linha" style={{ gap: 8, alignItems: "center" }}>
        <Selo situacao={u.situacao} />
        <span className="mudo pequeno">Último acesso: {u.ultimo_acesso ? dataHora.format(new Date(u.ultimo_acesso)) : "nunca"}</span>
      </div>
      <div className="abas" role="tablist">
        {([["acesso", "Acesso"], ["perfis", "Perfis e permissões"], ["dados", "Dados"], ["historico", "Histórico"]] as const).map(([k, r]) => (
          <button key={k} type="button" role="tab" aria-selected={aba === k} className={`aba${aba === k ? " ativa" : ""}`} onClick={() => setAba(k)}>{r}</button>
        ))}
      </div>
      {aba === "acesso" && <AbaAcesso u={u} euId={euId} ativos={ativos} />}
      {aba === "perfis" && <AbaPerfis u={u} perfis={perfis} descricoes={descricoes} euId={euId} />}
      {aba === "dados" && <AbaDados u={u} />}
      {aba === "historico" && <AbaHistorico u={u} />}
    </>
  );
}

function AbaAcesso({ u, euId, ativos }: { u: UsuarioLista; euId: string; ativos: { id: string; nome: string }[] }) {
  const [convite, acaoConvite, gerando] = useActionState<EstadoUsuario, FormData>(gerarConvite, {});
  const [revog, acaoRevog] = useActionState<EstadoUsuario, FormData>(revogarConvite, {});
  const [sessoes, acaoSessoes, encerrando] = useActionState<EstadoUsuario, FormData>(revogarSessoes, {});
  const [troca, acaoTroca] = useActionState<EstadoUsuario, FormData>(forcarTrocaSenha, {});
  const [desat, acaoDesat, desativando] = useActionState<EstadoUsuario, FormData>(desativar, {});
  const [reat, acaoReat] = useActionState<EstadoUsuario, FormData>(reativar, {});
  const [confirmar, setConfirmar] = useState(false);
  const eu = u.id === euId;
  const conviteAberto = ["convite_pendente", "convite_enviado", "convite_expirado"].includes(u.situacao);

  if (!u.ativo) {
    return (
      <section className="gaveta-secao">
        <h3>Desativado</h3>
        <Retorno estado={desat} />
        <p className="mudo pequeno">Em {u.desativado_em ? dataHora.format(new Date(u.desativado_em)) : "—"}. Motivo: {u.desativacao_motivo ?? "—"}</p>
        <form action={acaoReat} className="form-gaveta">
          <input type="hidden" name="id" value={u.id} />
          <label className="campo"><span>Motivo da reativação</span><input type="text" name="motivo" required minLength={5} /></label>
          <Retorno estado={reat} />
          <button className="botao secundario">Reativar</button>
        </form>
      </section>
    );
  }

  return (
    <>
      <Retorno estado={reat} />
      <section className="gaveta-secao">
        <h3>Convite e senha</h3>
        {conviteAberto && (
          <p className="mudo pequeno">
            {u.situacao === "convite_expirado" ? "O convite venceu" : `Convite ${u.convite_enviado_em ? "enviado" : "gerado, ainda não enviado"}`}
            {u.convite_expira_em && u.situacao !== "convite_expirado" && `; vale até ${dataHora.format(new Date(u.convite_expira_em))}`}.
          </p>
        )}
        <div className="acoes-acesso">
          <form action={acaoConvite}>
            <input type="hidden" name="id" value={u.id} />
            <input type="hidden" name="tipo" value={u.tem_login && !conviteAberto ? "redefinicao" : "convite"} />
            <button className="botao secundario" disabled={gerando}>
              <MailPlus aria-hidden /> {u.tem_login && !conviteAberto ? "Gerar link de redefinição de senha" : conviteAberto ? "Gerar convite novo" : "Gerar convite"}
            </button>
          </form>
          {conviteAberto && (
            <form action={acaoRevog}><input type="hidden" name="id" value={u.id} /><button className="botao fantasma">Cancelar convite</button></form>
          )}
          {u.tem_login && !eu && (
            <form action={acaoTroca}><input type="hidden" name="id" value={u.id} /><button className="botao fantasma"><KeyRound aria-hidden /> Exigir senha nova no próximo acesso</button></form>
          )}
        </div>
        <LinkGerado estado={convite} telefone={u.telefone} nome={u.nome} />
        <Retorno estado={convite.link ? {} : convite} />
        <Retorno estado={revog} />
        <Retorno estado={troca} />
        <p className="mudo pequeno" style={{ marginBottom: 0 }}>Ninguém vê senhas: a pessoa cria a dela pelo link, que vale uma vez e por pouco tempo.</p>
      </section>

      {u.tem_login && !eu && (
        <section className="gaveta-secao">
          <h3>Sessões</h3>
          <form action={acaoSessoes} className="form-gaveta">
            <input type="hidden" name="id" value={u.id} />
            <label className="campo"><span>Motivo (opcional)</span><input type="text" name="motivo" placeholder="Ex.: celular perdido" /></label>
            <Retorno estado={sessoes} />
            <button className="botao secundario" disabled={encerrando}><LogOut aria-hidden /> Encerrar todas as sessões agora</button>
          </form>
        </section>
      )}

      {!eu && (
        <section className="gaveta-secao zona-perigo">
          <h3>Desativar acesso</h3>
          <p className="mudo pequeno">Corta o acesso na hora e encerra as sessões. Orçamentos, contratos, pagamentos e a autoria de tudo o que a pessoa fez continuam guardados.</p>
          {!confirmar ? (
            <button type="button" className="botao perigo" onClick={() => setConfirmar(true)}><UserX aria-hidden /> Desativar…</button>
          ) : (
            <form action={acaoDesat} className="form-gaveta">
              <input type="hidden" name="id" value={u.id} />
              <label className="campo"><span>Motivo (obrigatório)</span><input type="text" name="motivo" required minLength={5} placeholder="Ex.: saiu da empresa" /></label>
              <label className="campo"><span>Passar tarefas e orçamentos em aberto para</span>
                <select name="transferir_para" defaultValue="">
                  <option value="">Ninguém (ficam com o nome dele)</option>
                  {ativos.filter((a) => a.id !== u.id).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>
              </label>
              <Retorno estado={desat} />
              <div className="linha">
                <button className="botao perigo" disabled={desativando}>{desativando ? "Desativando…" : "Sim, desativar"}</button>
                <button type="button" className="botao fantasma" onClick={() => setConfirmar(false)}>Cancelar</button>
              </div>
            </form>
          )}
        </section>
      )}
      {eu && <p className="mudo pequeno">Esta é a sua conta: você não pode desativá-la nem encerrar as suas sessões por aqui.</p>}
    </>
  );
}

function AbaPerfis({ u, perfis, descricoes, euId }: { u: UsuarioLista; perfis: PerfilComPermissoes[]; descricoes: Record<string, string>; euId: string }) {
  const [estado, acao, salvando] = useActionState<EstadoUsuario, FormData>(alterarPerfis, {});
  const [marcados, setMarcados] = useState(u.perfis);
  const perdeAdm = u.id === euId && u.perfis.includes("ADM") && !marcados.includes("ADM");
  return (
    <form action={acao} className="form-gaveta">
      <input type="hidden" name="id" value={u.id} />
      <EscolhaPerfis perfis={perfis} marcados={marcados} setMarcados={setMarcados} />
      {perdeAdm && <p className="aviso alerta">Você não pode tirar o seu próprio perfil de administrador. Peça a outro administrador.</p>}
      <ResumoPermissoes perfisMarcados={marcados} perfis={perfis} descricoes={descricoes} />
      <Retorno estado={estado} />
      <div className="gaveta-rodape-form"><button className="botao" disabled={salvando || perdeAdm || !marcados.length}><ShieldCheck aria-hidden /> {salvando ? "Salvando…" : "Salvar perfis"}</button></div>
    </form>
  );
}

function AbaDados({ u }: { u: UsuarioLista }) {
  const [estado, acao, salvando] = useActionState<EstadoUsuario, FormData>(atualizarDados, {});
  return (
    <form action={acao} className="form-gaveta">
      <input type="hidden" name="id" value={u.id} />
      <label className="campo"><span>Nome completo</span><input type="text" name="nome" defaultValue={u.nome} required minLength={2} /></label>
      <label className="campo"><span>E-mail (login)</span><input type="email" value={u.email} disabled /></label>
      <div className="grade-2">
        <label className="campo"><span>Telefone</span><input type="tel" name="telefone" defaultValue={u.telefone ?? ""} /></label>
        <label className="campo"><span>Data de início</span><input type="date" name="inicio" defaultValue={u.inicio_em ?? ""} /></label>
      </div>
      <label className="campo"><span>Cargo ou função</span><input type="text" name="cargo" defaultValue={u.cargo ?? ""} /></label>
      <label className="campo"><span>Observações administrativas</span><textarea name="observacoes" rows={3} defaultValue={u.observacoes ?? ""} maxLength={1000} /></label>
      <Retorno estado={estado} />
      <div className="gaveta-rodape-form"><button className="botao" disabled={salvando}>{salvando ? "Salvando…" : "Salvar dados"}</button></div>
    </form>
  );
}

function AbaHistorico({ u }: { u: UsuarioLista }) {
  const [itens, setItens] = useState<ItemHistorico[] | null>(null);
  const [, iniciar] = useTransition();
  useEffect(() => { iniciar(async () => setItens(await carregarHistorico(u.id))); }, [u.id]);
  if (!itens) return <p className="mudo">Carregando…</p>;
  if (!itens.length) return <p className="mudo">Nada registrado ainda.</p>;
  return (
    <ul className="lista-atividade historico-acesso">
      {itens.map((h, n) => {
        const info = h.info ?? {};
        const extra = [info.motivo && `motivo: ${info.motivo}`, info.recurso && `tentou: ${info.recurso}`,
          Array.isArray(info.depois) && `perfis: ${(info.depois as string[]).join(", ")}`, info.perfil && `perfil ${info.perfil}`,
          Number(info.tarefas_transferidas) > 0 && `${info.tarefas_transferidas} tarefa(s) transferida(s)`].filter(Boolean).join(" · ");
        return (
          <li key={n}>
            <strong>{ACOES_HISTORICO[h.acao] ?? h.acao}</strong>
            <span className="mudo pequeno"> · {dataHora.format(new Date(h.em))}{h.por ? ` · por ${h.por}` : ""}</span>
            {extra && <div className="mudo pequeno">{extra}</div>}
          </li>
        );
      })}
    </ul>
  );
}
