"use client";

import { useState, useTransition } from "react";
import { DatabaseBackup, Download } from "lucide-react";
import { avisar } from "@/componentes/avisos";
import { fazerBackupAgora, linkDoBackup } from "./actions";

type Arquivo = { nome: string; caminho: string; tamanho: number; criadoEm: string };

const tamanho = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Fortaleza", dateStyle: "short", timeStyle: "short" });

export function SecaoBackups({ arquivos }: { arquivos: Arquivo[] }) {
  const [fazendo, iniciar] = useTransition();
  const [baixando, setBaixando] = useState<string | null>(null);
  return (
    <section className="cartao">
      <div className="linha" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ marginTop: 0 }}>Backups</h2>
          <p className="mudo" style={{ margin: 0, maxWidth: 640 }}>
            Todo dia, às 3h, o sistema guarda uma cópia de todos os dados (clientes, orçamentos, reservas, pagamentos, encomendas,
            eventos, usuários e auditoria). Ficam 35 dias. De vez em quando, baixe um e guarde fora daqui, num pendrive ou no seu
            Google Drive: é a garantia se algo acontecer com o Supabase. O arquivo tem dados pessoais de clientes; guarde em lugar seguro.
          </p>
        </div>
        <button type="button" className="botao secundario" disabled={fazendo}
          onClick={() => iniciar(async () => { const r = await fazerBackupAgora(); avisar(r.ok ?? r.erro ?? "", r.ok ? "ok" : "erro"); })}>
          <DatabaseBackup aria-hidden />{fazendo ? "Fazendo…" : "Fazer backup agora"}
        </button>
      </div>
      {arquivos.length === 0 ? (
        <p className="mudo">Nenhum backup ainda. O primeiro sai hoje às 3h, ou faça um agora.</p>
      ) : (
        <div className="rola-por-dentro" style={{ maxHeight: 420, marginTop: 12 }}>
          <table>
            <thead><tr><th>Quando</th><th>Tipo</th><th className="numero">Tamanho</th><th><span className="sr-only">Baixar</span></th></tr></thead>
            <tbody>
              {arquivos.map((a) => (
                <tr key={a.caminho}>
                  <td>{a.criadoEm ? quando(a.criadoEm) : a.nome}</td>
                  <td>{a.nome.includes("-manual") ? "Feito à mão" : "Automático"}</td>
                  <td className="numero">{tamanho(a.tamanho)}</td>
                  <td className="acoes">
                    <button type="button" className="botao-icone" aria-label="Baixar" data-dica="Baixar" disabled={baixando === a.caminho}
                      onClick={async () => {
                        setBaixando(a.caminho);
                        const r = await linkDoBackup(a.caminho);
                        setBaixando(null);
                        if (r.url) window.location.href = r.url; else avisar(r.erro ?? "Não foi possível baixar.", "erro");
                      }}>
                      <Download aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
