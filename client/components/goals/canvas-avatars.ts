import { FONT } from "@/lib/canvas-card";
import { isThumbEligible, loadThumb } from "@/lib/thumb-cache";

/**
 * Fotos de perfil nos cards de canvas (2026-10-02) — "Treino em conjunto" e
 * "Desafio". Saíram do `workout-summary-overlay.tsx` para o card do desafio
 * também ser gerado fora do resumo (resultado de quem desafiou).
 */

/** Foto de perfil já decodificada para o canvas. */
export type CanvasAvatar = { source: CanvasImageSource; width: number; height: number };

const avatarCache = new Map<string, Promise<CanvasAvatar | null>>();

/**
 * Foto de perfil pronta para o canvas SEM "sujá-lo": desenhar uma imagem de
 * outro domínio direto (<img src="https://…supabase…">) marca o canvas como
 * tainted e o `toBlob` da publicação falha. Por isso a foto chega sempre por
 * `blob:` local — a miniatura do `thumb-cache` (que já baixa com CORS) ou, se a
 * original for pequena demais para ganhar miniatura, um `fetch` CORS direto.
 * Qualquer falha (rede, CORS, timeout de 4 s) → `null` e o card usa a inicial.
 */
export function loadCanvasAvatar(url: string | null): Promise<CanvasAvatar | null> {
  if (!url) return Promise.resolve(null);
  const cached = avatarCache.get(url);
  if (cached) return cached;

  const decodeBlobUrl = async (blobUrl: string): Promise<CanvasAvatar> => {
    const img = new Image();
    img.src = blobUrl;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight };
  };

  const task = (async (): Promise<CanvasAvatar | null> => {
    try {
      const thumb = isThumbEligible(url) ? await loadThumb(url, 48) : null;
      if (thumb) return await decodeBlobUrl(thumb);
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) return null;
      const blob = await res.blob();
      return await decodeBlobUrl(URL.createObjectURL(blob));
    } catch {
      return null;
    }
  })();
  const withTimeout = Promise.race([
    task,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
  ]).then((avatar) => {
    // Falhou/expirou: não fixa o null — a próxima tentativa (realtime redesenha)
    // pode conseguir.
    if (!avatar) avatarCache.delete(url);
    return avatar;
  });
  avatarCache.set(url, withTimeout);
  return withTimeout;
}

/**
 * Foto de perfil num círculo (cover) com anel na cor dada; sem foto (ou se ela
 * não carregou), a inicial no círculo colorido. Usado pelos canvas
 * `together` e `challenge` — a foto chega sempre por `loadCanvasAvatar`.
 */
export function drawCanvasAvatar(
  ctx: CanvasRenderingContext2D,
  avatar: CanvasAvatar | null,
  cx: number, cy: number, r: number,
  color: string,
  name: string,
) {
  if (avatar && avatar.width > 0 && avatar.height > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    const scale = Math.max((r * 2) / avatar.width, (r * 2) / avatar.height);
    const dw = avatar.width * scale, dh = avatar.height * scale;
    ctx.drawImage(avatar.source, cx - dw / 2, cy - dh / 2, dw, dh);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, r + 1.5, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    return;
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = "#0b0b10";
  ctx.font = `900 ${Math.round(r * 0.85)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText((name.trim()[0] ?? "?").toUpperCase(), cx, cy + r * 0.3);
}
