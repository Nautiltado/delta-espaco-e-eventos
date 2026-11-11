"use client";

/**
 * Foto de celular costuma ter 3 a 8 MB. Reduz para no máximo 2000 px no lado maior, em JPEG,
 * o que deixa o comprovante legível com uns 300 a 600 KB. PDF e formatos que o navegador
 * não consegue abrir (HEIC fora do iPhone) seguem como estão.
 */
export async function comprimirImagem(arquivo: File): Promise<{ blob: Blob; tipo: string; nome: string }> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(arquivo.type)) {
    return { blob: arquivo, tipo: arquivo.type, nome: arquivo.name };
  }
  try {
    const imagem = await createImageBitmap(arquivo);
    const escala = Math.min(1, 2000 / Math.max(imagem.width, imagem.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(imagem.width * escala);
    canvas.height = Math.round(imagem.height * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("sem canvas");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imagem, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.82));
    if (!blob || blob.size >= arquivo.size) return { blob: arquivo, tipo: arquivo.type, nome: arquivo.name };
    return { blob, tipo: "image/jpeg", nome: arquivo.name.replace(/\.[^.]+$/, "") + ".jpg" };
  } catch {
    return { blob: arquivo, tipo: arquivo.type, nome: arquivo.name };
  }
}
