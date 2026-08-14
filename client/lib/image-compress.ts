/**
 * Redimensiona/recomprime uma imagem ANTES do upload.
 *
 * Rede de segurança para os caminhos que sobem o arquivo direto do seletor de
 * fotos, sem passar por um cropper (`ImageCropperDrawer`) nem pela composição em
 * canvas (`applyTransformToBlob`). Sem isso um arquivo de 5MB vindo do rolo da
 * câmera ia para o Storage do jeito que estava — e, como o app não usa mais o
 * endpoint de transform da Supabase (ver `image-url.ts`), seria servido inteiro
 * para exibir uma miniatura.
 *
 * Nunca lança: se o WebView não conseguir decodificar (HEIC exótico, arquivo
 * corrompido), devolve o arquivo original. Melhor subir grande do que impedir o
 * usuário de publicar.
 */

/** Teto padrão do maior lado, em px. Casa com o export do cropper. */
export const UPLOAD_MAX_DIM = 1440;
/** Qualidade JPEG padrão. Casa com o export do cropper. */
export const UPLOAD_QUALITY = 0.82;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode failed"));
    img.src = url;
  });
}

export async function compressImageFile(
  file: File,
  maxDim: number = UPLOAD_MAX_DIM,
  quality: number = UPLOAD_QUALITY,
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  // GIF perde a animação ao passar pelo canvas; SVG não tem por que encolher.
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const ratio = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    // Já está dentro do teto E é JPEG → recomprimir só degradaria a imagem.
    if (ratio === 1 && file.type === "image/jpeg") return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * ratio);
    canvas.height = Math.round(img.naturalHeight * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) return file;
    // Alguns PNGs pequenos e "chapados" ficam maiores como JPEG — nesse caso o
    // original é a melhor escolha.
    if (blob.size >= file.size && ratio === 1) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
