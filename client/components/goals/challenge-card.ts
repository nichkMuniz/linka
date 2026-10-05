import {
  CANVAS_W,
  CANVAS_H,
  FONT,
  roundRectPath,
  fitFontSize,
  loadLogo,
  createCardCanvas,
  cardCanvasToBlob,
  canvasSetup,
  drawCanvasHeader,
  drawCanvasDivider,
  drawCanvasFooter,
} from "@/lib/canvas-card";
import { tUi } from "@/lib/i18n";
import type { ChallengeOutcome } from "@/lib/workout-challenge";
import { drawCanvasAvatar, loadCanvasAvatar, type CanvasAvatar } from "@/components/goals/canvas-avatars";

/**
 * Card de canvas do DESAFIO de treino (2026-10-02). Vive fora do resumo para
 * servir aos dois lados: o resumo de quem cumpriu (template `challenge`) e o
 * resultado de quem desafiou (`ChallengeResultDialog` → "Compartilhar no feed").
 */

/** O que o card precisa — o mesmo `challengeResult` do resumo, com placar. */
export type ChallengeCardInput = {
  challengerNickname: string;
  challengedNickname?: string;
  challengerPhoto?: string | null;
  challengedPhoto?: string | null;
  outcome: ChallengeOutcome;
};

/**
 * Card "Desafio" (2026-10-02): quem desafiou quem, quem VENCEU, o placar e, por
 * exercício, de que lado ficou a vitória. Sem nenhum número de carga ou
 * repetição — o card vai para o feed, e o desafio existe justamente para
 * ninguém expor quanto levantou.
 */
export function drawChallengeCanvas(
  canvas: HTMLCanvasElement, result: ChallengeCardInput, logo: HTMLImageElement | null,
  avatars: Map<string, CanvasAvatar | null> = new Map(),
) {
  const outcome = result.outcome;
  const ACCENT = "#f43f5e";
  const ctx = canvasSetup(canvas, "#2a0a12", "#110508", ACCENT, 0.18);
  if (!ctx) return;
  const W = CANVAS_W, H = CANVAS_H;
  const challenger = result.challengerNickname;
  const challenged = result.challengedNickname ?? tUi("card_together_you");

  const clip = (text: string, max: number) => {
    let out = text;
    while (ctx.measureText(out).width > max && out.length > 3) out = out.slice(0, -2) + "…";
    return out;
  };

  ctx.save();
  drawCanvasHeader(ctx, W, ACCENT, logo);
  drawCanvasDivider(ctx, W, 62);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 18px ${FONT}`;
  ctx.fillText(`⚔️ ${tUi("card_challenge_title")}`, W / 2, 100);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText(
    clip(tUi("card_challenge_line").replace("{challenger}", challenger).replace("{challenged}", challenged), W - 60),
    W / 2, 122,
  );

  // Veredito
  const verdict =
    outcome.winner === "tie"
      ? tUi("card_challenge_tie")
      : tUi("card_challenge_won").replace("{name}", (outcome.winner === "challenger" ? challenger : challenged).toUpperCase());
  ctx.fillStyle = outcome.winner === "tie" ? "#fbbf24" : ACCENT;
  ctx.font = fitFontSize(ctx, verdict, W - 60, 34, 900);
  ctx.fillText(verdict, W / 2, 168);

  // Placar entre as fotos dos dois lados (nome embaixo de cada uma). O anel
  // do vencedor fica na cor do card; o de quem perdeu, apagado; empate, âmbar.
  const ringFor = (side: "challenger" | "challenged") =>
    outcome.winner === "tie" ? "#fbbf24" : outcome.winner === side ? ACCENT : "rgba(255,255,255,0.35)";
  const avatarY = 200, avatarR = 24, sideX = 130;
  const challengerPhoto = result.challengerPhoto ? avatars.get(result.challengerPhoto) ?? null : null;
  const challengedPhoto = result.challengedPhoto ? avatars.get(result.challengedPhoto) ?? null : null;
  drawCanvasAvatar(ctx, challengerPhoto, W / 2 - sideX, avatarY, avatarR, ringFor("challenger"), challenger);
  drawCanvasAvatar(ctx, challengedPhoto, W / 2 + sideX, avatarY, avatarR, ringFor("challenged"), challenged);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 42px ${FONT}`;
  ctx.fillText(`${outcome.challengerScore} × ${outcome.challengedScore}`, W / 2, avatarY + 15);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `700 12px ${FONT}`;
  ctx.fillText(clip(challenger, 150), W / 2 - sideX, avatarY + avatarR + 17);
  ctx.fillText(clip(challenged, 150), W / 2 + sideX, avatarY + avatarR + 17);

  // Exercício a exercício: só de que lado ficou a vitória.
  drawCanvasDivider(ctx, W, 254);
  const rows = outcome.rows.slice(0, 6);
  const rowH = 29;
  let y = 279;
  rows.forEach((row) => {
    const fill = ctx.createLinearGradient(0, y - 18, 0, y + 8);
    fill.addColorStop(0, "rgba(255,255,255,0.07)");
    fill.addColorStop(1, "rgba(255,255,255,0.03)");
    roundRectPath(ctx, 24, y - 18, W - 48, rowH - 5, 10);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `600 12.5px ${FONT}`;
    ctx.fillText(clip(row.name, W - 170), W / 2, y);
    ctx.font = `14px ${FONT}`;
    const left = row.winner === "challenger" ? "🏆" : row.winner === "tie" ? "=" : "";
    const right = row.winner === "challenged" ? "🏆" : row.winner === "tie" ? "=" : "";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    if (left) ctx.fillText(left, 52, y);
    if (right) ctx.fillText(right, W - 52, y);
    y += rowH;
  });
  if (outcome.rows.length > rows.length) {
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = `600 11px ${FONT}`;
    ctx.fillText(`+${outcome.rows.length - rows.length}`, W / 2, y - 6);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = `600 10.5px ${FONT}`;
  ctx.fillText(tUi("card_challenge_rule"), W / 2, 466);

  drawCanvasFooter(ctx, W, H);
  ctx.restore();
}

/**
 * Gera o card pronto (Blob PNG) — fontes, logo e fotos carregados antes de
 * desenhar, como no resumo. Usado por quem desafiou para publicar o resultado.
 */
export async function renderChallengeCardBlob(input: ChallengeCardInput): Promise<Blob> {
  const canvas = createCardCanvas();
  const photos = [input.challengerPhoto, input.challengedPhoto].filter((u): u is string => !!u);
  const [, logo, entries] = await Promise.all([
    document.fonts.ready,
    loadLogo(),
    Promise.all(photos.map(async (u) => [u, await loadCanvasAvatar(u)] as const)),
  ]);
  drawChallengeCanvas(canvas, input, logo, new Map<string, CanvasAvatar | null>(entries));
  return cardCanvasToBlob(canvas);
}
