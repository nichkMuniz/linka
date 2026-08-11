import * as React from "react";
import { Share2, X } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/hooks/useAuth";
import { useKeyboardInputScroll } from "@/hooks/use-keyboard-input-scroll";
import { createPostDb, uploadWorkoutImageDb, type UserGoal } from "@/lib/ritmofit-db";
import { addNetworkStatusListener, getNetworkStatus } from "@/lib/network-status";
import {
  CANVAS_W,
  CANVAS_H,
  FONT,
  loadLogo,
  createCardCanvas,
  canvasSetup,
  drawCanvasHeader,
  drawCanvasDivider,
  drawCanvasFooter,
  drawCanvasStatPanels,
  fitFontSize,
  truncateToWidth,
} from "@/lib/canvas-card";

// Acento verde — mesmo do card de treino concluído (drawStandardCanvas) e do
// estado "concluída" da strip de metas do perfil.
const ACCENT = "#22c55e";

// Textos do card vêm de fora (i18n) porque as funções de desenho vivem fora do
// componente — mesmo padrão de renderRouteMapImage({ labels }).
type GoalCardLabels = {
  completed: string;
  daysDone: string;
  duration: string;
  progress: string;
  daysUnit: string;
};

// ─── Canvas: meta concluída (green accent) ──────────────────────────────────

function drawGoalCanvas(
  canvas: HTMLCanvasElement,
  goal: UserGoal,
  logo: HTMLImageElement | null,
  labels: GoalCardLabels,
  locale: string,
) {
  const ctx = canvasSetup(canvas, "#0d1f14", "#070d09", ACCENT, 0.20);
  if (!ctx) return;
  const W = CANVAS_W, H = CANVAS_H;

  ctx.save();
  drawCanvasHeader(ctx, W, ACCENT, logo, locale);
  drawCanvasDivider(ctx, W, 62);

  // Troféu com halo de acento
  const cX = W / 2, cY = 132, R = 40;
  const halo = ctx.createRadialGradient(cX, cY, R, cX, cY, R + 34);
  halo.addColorStop(0, "rgba(34,197,94,0.22)");
  halo.addColorStop(1, "rgba(34,197,94,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cX, cY, R + 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cX, cY, R, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(34,197,94,0.14)";
  ctx.fill();
  ctx.strokeStyle = "rgba(34,197,94,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = `40px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("🏆", cX, cY + 2);
  ctx.textBaseline = "alphabetic";

  // "META CONCLUIDA"
  ctx.fillStyle = "rgba(34,197,94,0.75)";
  ctx.font = `700 12px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(labels.completed, W / 2, 208);

  // Descrição da meta em destaque — até 2 linhas, quebrando por palavra
  const maxW = W - 80;
  ctx.font = `900 30px ${FONT}`;
  const words = goal.description.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxW && current) {
      lines.push(current);
      current = word;
      if (lines.length === 2) break;
    } else {
      current = candidate;
    }
  }
  if (lines.length < 2 && current) lines.push(current);
  // Sobrou texto sem espaço para uma 3ª linha → reticências na última
  const consumed = lines.join(" ").length;
  if (consumed < goal.description.trim().length && lines.length === 2) {
    lines[1] = truncateToWidth(ctx, `${lines[1]}…`, maxW);
  }

  let y = 254;
  if (lines.length === 1) {
    // Linha única pode crescer mais — mais impacto no feed
    const single = fitFontSize(ctx, lines[0], maxW, 38);
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(34,197,94,0.40)";
    ctx.shadowBlur = 24;
    ctx.fillText(single, W / 2, y + 6);
    ctx.shadowBlur = 0;
    y += 40;
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(34,197,94,0.40)";
    ctx.shadowBlur = 24;
    lines.forEach((line) => {
      ctx.font = `900 30px ${FONT}`;
      ctx.fillText(truncateToWidth(ctx, line, maxW), W / 2, y);
      y += 36;
    });
    ctx.shadowBlur = 0;
    y += 4;
  }

  // Frequência da meta (ex.: "3x por semana" já vem embutido na descrição em
  // muitas metas, então aqui só o resumo de constância)
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = `500 13px ${FONT}`;
  ctx.fillText(
    `${goal.days_completed} ${labels.daysUnit} • 100%`,
    W / 2,
    y + 18,
  );

  drawCanvasStatPanels(ctx, W, 380, [
    { l: labels.daysDone, v: String(goal.days_completed) },
    { l: labels.duration, v: `${goal.duration}` },
    { l: labels.progress, v: "100%" },
  ], ACCENT);

  drawCanvasDivider(ctx, W, 462);
  drawCanvasFooter(ctx, W, H);
  ctx.restore();
}

// Sem descrição (ex.: falha ao reler a meta), a legenda cai na variante sem
// nome — melhor que publicar "Meta concluída: !".
function generateDefaultDescription(goal: UserGoal, t: (key: string) => string): string {
  const name = goal.description?.trim();
  return t(name ? "goals_share_caption" : "goals_share_caption_noname")
    .replace("{name}", name ?? "")
    .replace("{days}", String(goal.days_completed));
}

// ─── Component ──────────────────────────────────────────────────────────────

interface GoalShareDrawerProps {
  /** Meta concluída a compartilhar. null fecha o drawer. */
  goal: UserGoal | null;
  onClose: () => void;
  /** Chamado após publicar no feed com sucesso (ex.: navegar para o feed). */
  onShared?: () => void;
}

export function GoalShareDrawer({ goal, onClose, onShared }: GoalShareDrawerProps) {
  const { t, language } = useLanguage();
  const { user } = useAuth();

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  // A legenda fica abaixo do preview do card — no iOS o teclado a cobria.
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  useKeyboardInputScroll(scrollRef, !!goal);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [description, setDescription] = React.useState("");
  const [isSharing, setIsSharing] = React.useState(false);
  // Compartilhar exige internet (upload da imagem + insert do post). Offline, o
  // botão fica desabilitado com um aviso — a meta em si já está salva.
  const [isOffline, setIsOffline] = React.useState(() => {
    const s = getNetworkStatus();
    return !s.isOnline || !s.isSupabaseReachable;
  });
  React.useEffect(
    () =>
      addNetworkStatusListener((s) =>
        setIsOffline(!s.isOnline || !s.isSupabaseReachable),
      ),
    [],
  );

  // Legenda padrão é regerada a cada meta aberta (e reseta uma edição anterior)
  React.useEffect(() => {
    if (goal) setDescription(generateDefaultDescription(goal, t));
  }, [goal?.id, language]); // eslint-disable-line react-hooks/exhaustive-deps

  // Desenha o card off-screen. Canvas é recriado a cada meta para não herdar
  // clip/scale do desenho anterior (criação é barata e rara).
  React.useEffect(() => {
    if (!goal) {
      setPreviewUrl(null);
      return;
    }
    const canvas = createCardCanvas();
    canvasRef.current = canvas;
    let cancelled = false;
    // Aguarda fontes E logo antes de desenhar, para o card sair completo.
    Promise.all([document.fonts.ready, loadLogo()]).then(([, logo]) => {
      if (cancelled) return;
      drawGoalCanvas(
        canvas,
        goal,
        logo,
        {
          completed: t("goals_share_card_label"),
          daysDone: t("goals_share_card_stat_days"),
          duration: t("goals_share_card_stat_duration"),
          progress: t("goals_share_card_stat_progress"),
          daysUnit: t("goals_share_card_days_unit"),
        },
        language === "en" ? "en-US" : "pt-BR",
      );
      setPreviewUrl(canvas.toDataURL("image/png"));
    });
    return () => { cancelled = true; };
  }, [goal?.id, language]); // eslint-disable-line react-hooks/exhaustive-deps

  const getCanvasBlob = (): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const canvas = canvasRef.current;
      if (!canvas) return reject(new Error("Canvas não pronto"));
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar imagem"))),
        "image/png",
      );
    });

  const handleShare = async () => {
    if (!goal || !user) return;
    setIsSharing(true);
    try {
      const blob = await getCanvasBlob();
      const url = await uploadWorkoutImageDb(user.id, blob);
      // Post fica vinculado à meta (user_goal_id) — mesma associação usada pelo
      // seletor de meta do NewPost/edição de post.
      await createPostDb([url], description.trim() || t("goals_share_default_desc"), goal.id);
      toast({ title: t("goals_share_shared"), description: t("goals_share_shared_desc") });
      onClose();
      onShared?.();
    } catch (err) {
      console.error("Erro ao compartilhar meta:", err);
      toast({
        title: t("goals_share_error"),
        description: t("goals_share_error_desc"),
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Drawer open={!!goal} onOpenChange={(open) => !open && !isSharing && onClose()}>
      <DrawerContent
        handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
        className="!rounded-t-[32px] !border-0"
        style={{
          background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderTop: "1px solid rgba(255,255,255,.14)",
        }}
      >
        <DrawerHeader className="pb-0">
          <DrawerTitle className="text-left text-base font-bold" style={{ color: "#fff" }}>
            {t("goals_share_title")}
          </DrawerTitle>
        </DrawerHeader>

        <div
          ref={scrollRef}
          className="px-4 pt-4 space-y-4 overflow-y-auto"
          style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom) + var(--keyboard-height, 0px))" }}
        >
          {/* Preview do card gerado */}
          <div
            className="rounded-2xl overflow-hidden aspect-square w-full max-w-[320px] mx-auto flex items-center justify-center"
            style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)" }}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="" className="w-full h-full object-contain" />
            ) : (
              <span className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                {t("goals_share_generating")}
              </span>
            )}
          </div>

          {/* Legenda */}
          <div className="space-y-1.5">
            <Label htmlFor="goal-share-desc" style={{ color: "#fff" }}>
              {t("goals_share_description_label")}
            </Label>
            <Textarea
              id="goal-share-desc"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("goals_share_description_placeholder")}
              className="rounded-xl resize-none"
              style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
            />
          </div>

          {isOffline && (
            <p className="text-xs text-center" style={{ color: "rgba(255,255,255,.5)" }}>
              {t("goals_share_offline")}
            </p>
          )}

          <div className="space-y-2.5 pt-1">
            <Button
              className="w-full rounded-full gap-2"
              style={{ background: ACCENT, color: "#fff" }}
              disabled={isSharing || isOffline || !previewUrl}
              onClick={handleShare}
            >
              <Share2 className="h-4 w-4" />
              {isSharing ? t("goals_share_publishing") : t("goals_share_feed")}
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-full gap-2"
              style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.12)" }}
              disabled={isSharing}
              onClick={onClose}
            >
              <X className="h-4 w-4" />
              {t("goals_share_cancel")}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
