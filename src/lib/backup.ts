import "server-only";
import { gzipSync } from "node:zlib";
import { criarClienteAdmin } from "@/lib/supabase/admin";

/**
 * Backup: copia todas as tabelas do sistema (e a lista de logins, sem senha) num arquivo .json.gz
 * guardado no armazenamento privado "backups". Guarda 35 dias. Para ter uma cópia fora do Supabase,
 * a administração baixa o arquivo em Configurações > Backups.
 */
export const BUCKET_BACKUP = "backups";
const DIAS_GUARDADOS = 35;
const POR_VEZ = 1000;

export type ArquivoBackup = { nome: string; caminho: string; tamanho: number; criadoEm: string };

export async function fazerBackup(origem: "automatico" | "manual"): Promise<{ caminho: string; tabelas: number; linhas: number }> {
  const admin = criarClienteAdmin();
  const { data: nomes, error } = await admin.rpc("tabelas_para_backup");
  if (error) throw new Error(`lista de tabelas: ${error.message}`);

  const tabelas: Record<string, unknown[]> = {};
  let linhas = 0;
  for (const nome of (nomes ?? []) as string[]) {
    const todas: unknown[] = [];
    for (let de = 0; ; de += POR_VEZ) {
      const { data, error: e } = await admin.from(nome).select("*").range(de, de + POR_VEZ - 1);
      if (e) throw new Error(`${nome}: ${e.message}`);
      todas.push(...(data ?? []));
      if (!data || data.length < POR_VEZ) break;
    }
    tabelas[nome] = todas;
    linhas += todas.length;
  }

  // logins: só o necessário para religar as contas (nada de senha, que nem chega até aqui)
  const contas: unknown[] = [];
  for (let pagina = 1; ; pagina++) {
    const { data, error: e } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (e) throw new Error(`logins: ${e.message}`);
    contas.push(...data.users.map((u) => ({ id: u.id, email: u.email, criado_em: u.created_at, ultimo_acesso: u.last_sign_in_at })));
    if (data.users.length < 200) break;
  }

  const agora = new Date();
  const dia = agora.toISOString().slice(0, 10);
  const hora = agora.toISOString().slice(11, 16).replace(":", "");
  const conteudo = { sistema: "Delta Gestão", versao: 1, origem, gerado_em: agora.toISOString(), tabelas, contas };
  const arquivo = gzipSync(Buffer.from(JSON.stringify(conteudo)));
  const caminho = `${dia.slice(0, 7)}/delta-backup-${dia}-${hora}-${origem}.json.gz`;
  const { error: eu } = await admin.storage.from(BUCKET_BACKUP).upload(caminho, arquivo, { contentType: "application/gzip", upsert: false });
  if (eu) throw new Error(`envio: ${eu.message}`);

  await apagarAntigos();
  return { caminho, tabelas: Object.keys(tabelas).length, linhas };
}

export async function listarBackups(): Promise<ArquivoBackup[]> {
  const admin = criarClienteAdmin();
  const { data: pastas } = await admin.storage.from(BUCKET_BACKUP).list("", { limit: 100, sortBy: { column: "name", order: "desc" } });
  const arquivos: ArquivoBackup[] = [];
  for (const p of pastas ?? []) {
    if (p.id) continue; // só pastas (AAAA-MM)
    const { data } = await admin.storage.from(BUCKET_BACKUP).list(p.name, { limit: 200, sortBy: { column: "name", order: "desc" } });
    for (const a of data ?? []) {
      if (!a.id) continue;
      arquivos.push({ nome: a.name, caminho: `${p.name}/${a.name}`, tamanho: Number(a.metadata?.size ?? 0), criadoEm: a.created_at ?? "" });
    }
  }
  return arquivos.sort((a, b) => b.caminho.localeCompare(a.caminho));
}

/** Já existe backup automático nas últimas 20 horas? (a rota diária não faz dois seguidos) */
export async function backupRecente(): Promise<boolean> {
  const lista = await listarBackups();
  const limite = Date.now() - 20 * 3600_000;
  return lista.some((a) => a.nome.includes("-automatico") && new Date(a.criadoEm).getTime() > limite);
}

/** Algum backup (automático ou manual) nas últimas N horas? */
export async function backupRecenteQualquer(horas: number): Promise<boolean> {
  const limite = Date.now() - horas * 3600_000;
  return (await listarBackups()).some((a) => new Date(a.criadoEm).getTime() > limite);
}

async function apagarAntigos() {
  const limite = Date.now() - DIAS_GUARDADOS * 86400_000;
  const velhos = (await listarBackups()).filter((a) => a.criadoEm && new Date(a.criadoEm).getTime() < limite).map((a) => a.caminho);
  if (velhos.length) await criarClienteAdmin().storage.from(BUCKET_BACKUP).remove(velhos);
}

export async function linkDeDownload(caminho: string): Promise<string | null> {
  if (!/^\d{4}-\d{2}\/delta-backup-[\w-]+\.json\.gz$/.test(caminho)) return null;
  const { data } = await criarClienteAdmin().storage.from(BUCKET_BACKUP).createSignedUrl(caminho, 60, { download: true });
  return data?.signedUrl ?? null;
}
