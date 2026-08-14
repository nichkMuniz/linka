/**
 * Supabase Storage image transform helper.
 *
 * Supabase exposes on-the-fly image transforms via the `/render/image/public/`
 * endpoint (mirror of `/object/public/`). We rewrite stored public URLs to hit
 * that endpoint with resize parameters so the WebView downloads thumbnails
 * instead of multi-megabyte originals.
 *
 * Non-Supabase URLs and SVG/data/blob URLs are returned unchanged.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DESLIGADO (2026-08-14) — ver `STORAGE_TRANSFORMS_ENABLED` abaixo.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * A Supabase cobra Image Transformations por **origin image distinta
 * transformada no mês** — não por requisição. Cache de CDN, dedup de request ou
 * menos acessos não movem o contador: o que conta é quantos ARQUIVOS diferentes
 * passaram pelo `/render/image/`. Como o app mandava por ali todo avatar, toda
 * foto de post e todo flow, a métrica crescia linear com a base de usuários e
 * estourou a cota (113/100).
 *
 * A troca: as imagens agora sobem já redimensionadas (ver `MAX_EXPORT`/qualidade
 * em `inline-crop-preview.tsx`, `image-cropper-drawer.tsx` e
 * `flow-creation-dialog.tsx`), então servir o objeto original direto do
 * `/object/public/` custa a mesma banda que a versão transformada custava — com
 * zero transformações faturadas.
 *
 * Os call sites continuam chamando `cdnImg()` de propósito: se um dia a cota
 * deixar de ser problema (ou aparecer um caso que realmente precise de variantes
 * por tamanho), basta voltar esta flag para `true`.
 *
 * ATENÇÃO: imagens publicadas ANTES desta data seguem grandes no bucket. Elas
 * não quebram nada — só gastam mais banda até serem substituídas.
 */
// Tipado como `boolean` (e não inferido como `false`) para o TS não marcar o
// resto da função como código morto enquanto a flag estiver desligada.
const STORAGE_TRANSFORMS_ENABLED: boolean = false;

export type CdnImgOptions = {
  width?: number;
  height?: number;
  quality?: number; // 20..100
  resize?: "cover" | "contain" | "fill";
};

// Devicepixel ratio cap — going above 3 wastes bandwidth on most phones.
const DPR_CAP = 2;

function getDpr(): number {
  if (typeof window === "undefined") return 1;
  const dpr = window.devicePixelRatio || 1;
  return Math.min(DPR_CAP, Math.max(1, Math.round(dpr)));
}

export function cdnImg(
  src: string | null | undefined,
  opts: CdnImgOptions = {},
): string | undefined {
  if (!src) return src ?? undefined;

  // Transformações desligadas: devolve a URL do objeto original.
  if (!STORAGE_TRANSFORMS_ENABLED) return src;

  // Skip non-http URLs (data:, blob:, relative assets, etc.)
  if (!/^https?:\/\//i.test(src)) return src;

  // SVG/GIF: transforms degrade animation; skip.
  if (/\.svg(\?|$)/i.test(src) || /\.gif(\?|$)/i.test(src)) return src;

  // Only Supabase Storage URLs are supported by the render endpoint.
  const objectMarker = "/storage/v1/object/public/";
  const renderMarker = "/storage/v1/render/image/public/";
  let rewritten: string;
  if (src.includes(objectMarker)) {
    rewritten = src.replace(objectMarker, renderMarker);
  } else if (src.includes(renderMarker)) {
    rewritten = src;
  } else {
    return src;
  }

  const dpr = getDpr();
  const params = new URL(rewritten);
  // Preserve existing query (e.g. signed-url token) — Supabase ignores unknown params.
  if (opts.width) params.searchParams.set("width", String(Math.round(opts.width * dpr)));
  if (opts.height) params.searchParams.set("height", String(Math.round(opts.height * dpr)));
  if (opts.quality) params.searchParams.set("quality", String(opts.quality));
  if (opts.resize) params.searchParams.set("resize", opts.resize);

  return params.toString();
}
