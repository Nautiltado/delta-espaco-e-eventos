import Link from "next/link";
import { formatarDataHora } from "@/lib/datas";
import { concluirTarefa } from "./actions";

export type Tarefa = {
  id: string;
  titulo: string;
  descricao: string | null;
  vence_em: string | null;
  responsavel: string | null;
  concluida_em: string | null;
  clientes: { id: string; nome: string } | null;
  orcamentos: { id: string; numero: string } | null;
};

export function ListaTarefas({ tarefas, agora }: { tarefas: Tarefa[]; agora: number }) {
  if (tarefas.length === 0) return <p className="mudo">Nada pendente.</p>;
  return (
    <table>
      <tbody>
        {tarefas.map((t) => {
          const atrasada = !t.concluida_em && t.vence_em && Date.parse(t.vence_em) < agora;
          return (
            <tr key={t.id}>
              <td style={{ width: 36 }}>
                <form action={concluirTarefa}>
                  <input type="hidden" name="id" value={t.id} />
                  {t.concluida_em && <input type="hidden" name="reabrir" value="1" />}
                  <button className="botao secundario pequeno" aria-label={t.concluida_em ? "Reabrir" : "Concluir"} title={t.concluida_em ? "Reabrir" : "Concluir"}>
                    {t.concluida_em ? "↺" : "✓"}
                  </button>
                </form>
              </td>
              <td style={t.concluida_em ? { textDecoration: "line-through", opacity: 0.6 } : undefined}>
                <strong>{t.titulo}</strong>
                {t.descricao && <div className="mudo">{t.descricao}</div>}
                <div className="mudo" style={{ fontSize: ".82rem" }}>
                  {t.clientes && <Link href={`/clientes/${t.clientes.id}`}>{t.clientes.nome}</Link>}
                  {t.orcamentos && <> · <Link href={`/orcamentos/${t.orcamentos.id}`}>{t.orcamentos.numero}</Link></>}
                </div>
              </td>
              <td style={{ whiteSpace: "nowrap" }} className={atrasada ? "atrasada" : "mudo"}>
                {t.vence_em ? `${atrasada ? "Atrasada · " : ""}${formatarDataHora(t.vence_em)}` : "sem prazo"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export const SELECT_TAREFA = "id, titulo, descricao, vence_em, responsavel, concluida_em, clientes(id, nome), orcamentos(id, numero)";

