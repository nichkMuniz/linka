// Primitivas compartilhadas dos "cards" gerados em canvas e publicados no feed
// (resumo de treino, meta concluída). Extraído de workout-summary-overlay.tsx
// para que novos cards reaproveitem o mesmo shell visual — fundo, glow de
// acento, header com logo, divisores e rodapé — em vez de redesenhá-lo.
//
// Todo o layout é calculado no espaço lógico CANVAS_W × CANVAS_H; o backing
// store é desenhado em CANVAS_SCALE× via ctx.scale (ver createCardCanvas).

import { SHARE_DOMAIN } from "@shared/share-config";

export const CANVAS_W = 540;
export const CANVAS_H = 540;
// Backing store em 3x a resolução lógica (1620px) para não pixelar em telas
// @3x: o card ocupa ~430px CSS no card do feed, ou ~1290px de device pixel num
// iPhone Retina @3x. 2x (1080px) ficaria ABAIXO disso e amaciaria o texto —
// por isso a escala não desceu quando as transformações do Storage saíram
// (2026-08-14). O que mudou foi só o formato do arquivo, ver `cardCanvasToBlob`.
export const CANVAS_SCALE = 3;
export const FONT = `"Inter", -apple-system, system-ui, sans-serif`;

/**
 * Qualidade JPEG dos cards. Mais alta que a das fotos (0.82) de propósito: o
 * card é texto de alto contraste sobre fundo chapado, que é justamente onde o
 * JPEG produz ringing. Em 0.92, num desenho já supersampleado em 3x e exibido
 * reduzido, o artefato fica abaixo de um pixel de tela.
 */
export const CARD_JPEG_QUALITY = 0.92;

/**
 * Serializa um card para upload.
 *
 * **JPEG, não PNG.** O card é majoritariamente gradiente, e gradiente é o pior
 * caso do PNG: o DEFLATE não acha repetição em 1620px de cor mudando devagar,
 * então o arquivo ia a vários MB. É exatamente o caso ótimo do JPEG. Como os
 * cards de resumo são as imagens mais publicadas do app, o formato errado aqui
 * custava mais banda que todo o resto somado.
 *
 * O texto — a parte em que o JPEG é fraco — é desenhado em 3x e exibido
 * reduzido, então o ringing some na reamostragem. Mesmo raciocínio (e mesma
 * conclusão) do mapa de trajeto em `route-map.tsx`, que já sobe JPEG.
 */
export function cardCanvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar imagem"))),
      "image/jpeg",
      CARD_JPEG_QUALITY,
    );
  });
}

/**
 * Data URL do card para a pré-visualização na tela. Também JPEG: em PNG, a
 * string base64 de um canvas 1620x1620 passa de vários MB presos no state do
 * React enquanto o drawer está aberto — custo de memória real no WebView do
 * iOS, por uma imagem que o usuário vê reduzida.
 */
export function cardCanvasPreviewUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/jpeg", CARD_JPEG_QUALITY);
}

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "").match(/.{2}/g)!;
  return [parseInt(m[0], 16), parseInt(m[1], 16), parseInt(m[2], 16)];
}

// Reduz o tamanho da fonte até o texto caber em maxW (mantém peso/família,
// nunca abaixo de 16px). Se ainda assim não couber, trunca com reticências.
// Deixa ctx.font já configurado no tamanho final; retorna o texto a desenhar.
export function fitFontSize(
  ctx: CanvasRenderingContext2D, text: string, maxW: number,
  base: number, weight = 900,
): string {
  let size = base;
  ctx.font = `${weight} ${size}px ${FONT}`;
  while (size > 16 && ctx.measureText(text).width > maxW) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${FONT}`;
  }
  let out = text;
  while (ctx.measureText(out).width > maxW && out.length > 3) {
    out = out.slice(0, -2) + "…";
  }
  return out;
}

// Trunca com reticências no tamanho de fonte já configurado em ctx.font.
export function truncateToWidth(
  ctx: CanvasRenderingContext2D, text: string, maxW: number,
): string {
  let out = text;
  while (ctx.measureText(out).width > maxW && out.length > 3) {
    out = out.slice(0, -2) + "…";
  }
  return out;
}

// Logo oficial (branco) desenhado no header dos cards. Carregado uma vez e
// cacheado; mesma origem do app, então não tinge o canvas (toBlob continua ok).
let logoImgPromise: Promise<HTMLImageElement | null> | null = null;
export function loadLogo(): Promise<HTMLImageElement | null> {
  if (logoImgPromise) return logoImgPromise;
  logoImgPromise = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = "/logo-branco.png";
  });
  return logoImgPromise;
}

// Canvas off-screen já escalado — o chamador desenha em coordenadas lógicas.
export function createCardCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W * CANVAS_SCALE;
  canvas.height = CANVAS_H * CANVAS_SCALE;
  canvas.getContext("2d")?.scale(CANVAS_SCALE, CANVAS_SCALE);
  return canvas;
}

// Fundo em gradiente + clip arredondado + glow de acento no topo.
export function canvasSetup(
  canvas: HTMLCanvasElement,
  bgTop: string, bgBot: string,
  accent: string, glowStrength: number,
): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const W = CANVAS_W, H = CANVAS_H;

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, bgTop);
  bg.addColorStop(1, bgBot);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Rounded clip
  roundRectPath(ctx, 0, 0, W, H, 20);
  ctx.clip();

  const [r, g, b] = hexToRgb(accent);
  const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, H * 0.5);
  glow.addColorStop(0, `rgba(${r},${g},${b},${glowStrength})`);
  glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  return ctx;
}

export function drawCanvasHeader(
  ctx: CanvasRenderingContext2D, W: number, accent: string,
  logo: HTMLImageElement | null, locale = "pt-BR",
) {
  // Logo oficial branco (ou fallback ao wordmark em texto se não carregar)
  if (logo && logo.width > 0 && logo.height > 0) {
    const h = 26;
    const w = (logo.width / logo.height) * h;
    ctx.drawImage(logo, 28, 24, w, h);
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 18px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillText("LinKa", 28, 44);
  }

  const today = new Date().toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
  ctx.fillStyle = "rgba(255,255,255,0.32)";
  ctx.font = `500 11px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(today, W - 28, 41);
}

export function drawCanvasDivider(ctx: CanvasRenderingContext2D, W: number, y: number) {
  // Linha que esmaece nas pontas — mais elegante que um traço chapado.
  const grad = ctx.createLinearGradient(28, 0, W - 28, 0);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.14)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.strokeStyle = grad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(28, y); ctx.lineTo(W - 28, y);
  ctx.stroke();
}

export function drawCanvasFooter(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.font = `500 11px ${FONT}`;
  ctx.textAlign = "center";
  // O domínio fica DESENHADO na imagem publicada — sai da mesma constante dos
  // links para não virar um rodapé apontando para um domínio que já trocou.
  ctx.fillText(SHARE_DOMAIN, W / 2, H - 18);
}

// Painéis de "vidro" lado a lado com valor grande + rótulo no acento. Usado pelo
// bloco de stats dos cards. Retorna o y da base do bloco.
export function drawCanvasStatPanels(
  ctx: CanvasRenderingContext2D, W: number, y: number,
  items: Array<{ l: string; v: string }>, accent: string,
): number {
  const cols = items.length;
  if (cols === 0) return y;
  const colW = (W - 40 - (cols - 1) * 8) / cols;
  const h = 58;
  const [ar, ag, ab] = hexToRgb(accent);
  items.forEach(({ l, v }, i) => {
    const x = 20 + i * (colW + 8), xC = x + colW / 2;
    // Painel de "vidro" com leve realce superior + borda translúcida
    const fill = ctx.createLinearGradient(0, y, 0, y + h);
    fill.addColorStop(0, "rgba(255,255,255,0.09)");
    fill.addColorStop(1, "rgba(255,255,255,0.04)");
    roundRectPath(ctx, x, y, colW, h, 14);
    ctx.fillStyle = fill;
    ctx.fill();
    roundRectPath(ctx, x + 0.5, y + 0.5, colW - 1, h - 1, 13.5);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 19px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(v, xC, y + 26);
    ctx.fillStyle = `rgba(${ar},${ag},${ab},0.65)`;
    ctx.font = `700 9px ${FONT}`;
    ctx.fillText(l, xC, y + 43);
  });
  return y + h;
}
