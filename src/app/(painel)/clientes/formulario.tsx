"use client";

import { useJanela } from "@/componentes/avisos";

import Link from "next/link";
import { useActionState, useRef, useState, useTransition } from "react";
import { salvarCliente, verificarDuplicados, type Duplicado, type EstadoCliente } from "./actions";
import { formatarDocumento, formatarTelefone } from "@/lib/documentos";

export type ClienteFormulario = {
  id?: string;
  tipo: "PF" | "PJ";
  nome: string;
  nome_fantasia?: string | null;
  responsavel_nome?: string | null;
  documento?: string | null;
  telefone?: string | null;
  email?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  origem?: string | null;
  observacoes?: string | null;
};

const ORIGENS = [
  ["", "Não informado"],
  ["whatsapp", "WhatsApp"],
  ["instagram", "Instagram"],
  ["indicacao", "Indicação"],
  ["balcao", "Balcão"],
  ["telefone", "Telefone"],
  ["outro", "Outro"],
];

export function FormularioCliente({ cliente }: { cliente?: ClienteFormulario }) {
  const janela = useJanela();
  const [estado, acao, salvando] = useActionState<EstadoCliente, FormData>(salvarCliente, {});
  const inicial = estado.campos ?? {
    tipo: cliente?.tipo ?? "PF",
    nome: cliente?.nome ?? "",
    nome_fantasia: cliente?.nome_fantasia ?? "",
    responsavel_nome: cliente?.responsavel_nome ?? "",
    documento: cliente?.documento ? formatarDocumento(cliente.documento) : "",
    telefone: cliente?.telefone ? formatarTelefone(cliente.telefone) : "",
    email: cliente?.email ?? "",
    endereco: cliente?.endereco ?? "",
    cidade: cliente?.cidade ?? "Bacabal",
    uf: cliente?.uf ?? "MA",
    origem: cliente?.origem ?? "",
    observacoes: cliente?.observacoes ?? "",
  };
  const [tipo, setTipo] = useState<string>(inicial.tipo);
  const [duplicados, setDuplicados] = useState<Duplicado[]>([]);
  const [, buscar] = useTransition();
  // Cada checagem tem um número; resposta de uma checagem antiga que chegue atrasada é descartada.
  const ultimaChecagem = useRef(0);

  function conferirDuplicados(form: HTMLFormElement | null) {
    if (!form) return;
    const f = new FormData(form);
    const numero = ++ultimaChecagem.current;
    buscar(async () => {
      const achados = await verificarDuplicados({
        id: cliente?.id,
        nome: String(f.get("nome") ?? ""),
        telefone: String(f.get("telefone") ?? ""),
        documento: String(f.get("documento") ?? ""),
      });
      if (numero === ultimaChecagem.current) setDuplicados(achados);
    });
  }

  return (
    <form action={acao} key={JSON.stringify(estado.campos ?? {})}>
      {cliente?.id && <input type="hidden" name="id" value={cliente.id} />}
      {estado.erro && <p className="aviso erro" role="alert">{estado.erro}</p>}

      <div className="campo">
        <label>Tipo</label>
        <div className="opcoes">
          <label>
            <input type="radio" name="tipo" value="PF" checked={tipo === "PF"} onChange={() => setTipo("PF")} />
            Pessoa física
          </label>
          <label>
            <input type="radio" name="tipo" value="PJ" checked={tipo === "PJ"} onChange={() => setTipo("PJ")} />
            Empresa
          </label>
        </div>
      </div>

      <div className="linha" style={{ marginBottom: 14 }}>
        <div className="campo" style={{ flex: 2 }}>
          <label htmlFor="nome">{tipo === "PJ" ? "Razão social" : "Nome completo"}</label>
          <input id="nome" name="nome" type="text" required defaultValue={inicial.nome}
            onBlur={(e) => conferirDuplicados(e.currentTarget.form)} />
        </div>
        <div className="campo">
          <label htmlFor="documento">{tipo === "PJ" ? "CNPJ" : "CPF"} (opcional no primeiro contato)</label>
          <input id="documento" name="documento" type="text" inputMode="numeric" defaultValue={inicial.documento}
            onBlur={(e) => conferirDuplicados(e.currentTarget.form)} />
        </div>
      </div>

      {tipo === "PJ" && (
        <div className="linha" style={{ marginBottom: 14 }}>
          <div className="campo">
            <label htmlFor="nome_fantasia">Nome fantasia</label>
            <input id="nome_fantasia" name="nome_fantasia" type="text" defaultValue={inicial.nome_fantasia} />
          </div>
          <div className="campo">
            <label htmlFor="responsavel_nome">Responsável pelo contato</label>
            <input id="responsavel_nome" name="responsavel_nome" type="text" defaultValue={inicial.responsavel_nome} />
          </div>
        </div>
      )}

      <div className="linha" style={{ marginBottom: 14 }}>
        <div className="campo">
          <label htmlFor="telefone">Telefone / WhatsApp</label>
          <input id="telefone" name="telefone" type="text" inputMode="tel" placeholder="(99) 99999-9999"
            defaultValue={inicial.telefone} onBlur={(e) => conferirDuplicados(e.currentTarget.form)} />
        </div>
        <div className="campo">
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" defaultValue={inicial.email} />
        </div>
        <div className="campo">
          <label htmlFor="origem">Como conheceu a Delta</label>
          <select id="origem" name="origem" defaultValue={inicial.origem}>
            {ORIGENS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </div>
      </div>

      {duplicados.length > 0 && (
        <div className="aviso info" role="status">
          <strong>Possível cadastro repetido.</strong> Confira antes de salvar:
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {duplicados.map((d) => (
              <li key={d.id}>
                <Link href={`/clientes/${d.id}`} target="_blank">{d.nome}</Link>
                {d.telefone && ` · ${formatarTelefone(d.telefone)}`}
                {d.documento && ` · ${formatarDocumento(d.documento)}`} — {d.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="linha" style={{ marginBottom: 14 }}>
        <div className="campo" style={{ flex: 3 }}>
          <label htmlFor="endereco">Endereço</label>
          <input id="endereco" name="endereco" type="text" defaultValue={inicial.endereco} />
        </div>
        <div className="campo">
          <label htmlFor="cidade">Cidade</label>
          <input id="cidade" name="cidade" type="text" defaultValue={inicial.cidade} />
        </div>
        <div className="campo" style={{ maxWidth: 80 }}>
          <label htmlFor="uf">UF</label>
          <input id="uf" name="uf" type="text" maxLength={2} defaultValue={inicial.uf} />
        </div>
      </div>

      <div className="campo">
        <label htmlFor="observacoes">Observações</label>
        <textarea id="observacoes" name="observacoes" rows={3} defaultValue={inicial.observacoes} />
      </div>

      <div className="linha">
        <button className="botao" disabled={salvando}>{salvando ? "Salvando…" : "Salvar cliente"}</button>
        {janela ? (
          <button type="button" className="botao secundario" onClick={janela.fechar}>Cancelar</button>
        ) : (
          <Link className="botao secundario" href={cliente?.id ? `/clientes/${cliente.id}` : "/clientes"}>Cancelar</Link>
        )}
      </div>
    </form>
  );
}
