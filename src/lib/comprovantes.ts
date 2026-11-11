// Comprovantes de pagamento: regras compartilhadas entre a tela e o servidor.

export const TIPOS_COMPROVANTE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

export const TAMANHO_MAXIMO = 10 * 1024 * 1024;

export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/** Caminho no armazenamento: pasta da reserva + nome aleatório (o nome original fica só no registro). */
export function caminhoDoComprovante(reservaId: string, tipo: string, aleatorio: string): string | null {
  const ext = TIPOS_COMPROVANTE[tipo];
  if (!ext) return null;
  return `${reservaId}/${aleatorio}.${ext}`;
}
