import React from "react";
import { Check, Loader2, Lock } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  type Badge,
  type BadgeMetrics,
  type UserBadge,
  awardMyBadgesDb,
  getBadgeDisplayDb,
  getViewer,
  isBadgeUnlocked,
  setSelectedBadgeDb,
  setShowBadgeDb,
} from "@/lib/ritmofit-db";
import { BADGE_GROUPS, announceBadges, badgeDescription, badgeGroup, badgeName, visibleBadges } from "@/lib/badges";
import { BadgeMedallion, BADGE_ACCENT_GRADIENT } from "@/components/shared/badge-medallion";
import { GLASS_PANEL_STYLE, GLASS_SHEET_PROPS, GLASS_SHEET_STYLE } from "@/lib/glass-styles";
import { reportHandledError } from "@/lib/monitoring";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/language-context";

interface InsigniasDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userBadges: UserBadge[];
  allBadges: Badge[];
  /** ID do dono do perfil sendo visualizado */
  profileUserId?: string;
  /** ID da insígnia escolhida pelo usuário (persistida em profiles.selected_badge_id) */
  selectedBadgeId?: string | null;
  /**
   * O pai recarrega acervo/insígnia exibida — depois de trocar a exibida ou de
   * a abertura do drawer conceder algo novo.
   */
  onChanged?: () => void | Promise<void>;
}

/**
 * Insígnias v2 (2026-10-06): o catálogo agrupado (Treinos · Conteúdo · Juntos ·
 * Comunidade), o progresso geral e — no PRÓPRIO perfil — quanto falta para cada
 * insígnia bloqueada. Abrir o drawer no próprio perfil roda a avaliação no
 * servidor: é dela que vem o progresso, e o que já tiver sido alcançado (ex.:
 * o 10º seguidor chegou enquanto o app estava fechado) é concedido na hora.
 */
export function InsigniasDrawer({ open, onOpenChange, userBadges, allBadges, profileUserId, selectedBadgeId, onChanged }: InsigniasDrawerProps) {
  const { t } = useLanguage();
  const [isSelecting, setIsSelecting] = React.useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [overrideActiveId, setOverrideActiveId] = React.useState<string | null>(null);
  const [metrics, setMetrics] = React.useState<BadgeMetrics | null>(null);
  // Exibir a insígnia ao lado do nome (profiles.show_badge, 2026-10-08).
  // null = ainda lendo (o interruptor espera para não piscar o estado errado).
  const [showBadge, setShowBadge] = React.useState<boolean | null>(null);
  const [savingShow, setSavingShow] = React.useState(false);

  React.useEffect(() => {
    getViewer().then((u) => setCurrentUserId(u?.id || null));
  }, []);

  // Sem profileUserId = o drawer da tela de Metas, sempre o próprio usuário.
  const isOwn = !!currentUserId && (!profileUserId || profileUserId === currentUserId);
  const isReadOnly = !!currentUserId && !isOwn;

  const activeBadgeId = overrideActiveId ?? selectedBadgeId ?? null;
  const earnedIds = React.useMemo(() => new Set(userBadges.map((ub) => String(ub.badge_id))), [userBadges]);

  React.useEffect(() => {
    if (!open) setOverrideActiveId(null);
  }, [open]);
  React.useEffect(() => {
    setOverrideActiveId(null);
  }, [userBadges]);

  // Progresso (e concessão do que já foi alcançado) ao abrir o próprio drawer.
  const onChangedRef = React.useRef(onChanged);
  onChangedRef.current = onChanged;
  React.useEffect(() => {
    if (!open || !isOwn) return;
    let cancelled = false;
    awardMyBadgesDb()
      .then(({ awarded, metrics: m }) => {
        if (cancelled) return;
        setMetrics(m);
        if (awarded.length > 0) {
          // Mesmo pop up de conquista do resto do app (BadgeCelebrationBanner).
          announceBadges(awarded);
          void onChangedRef.current?.();
        }
      })
      .catch((err) => {
        // Sem progresso o drawer continua útil (acervo + seleção).
        reportHandledError(err, "insignias-drawer:award");
      });
    return () => {
      cancelled = true;
    };
  }, [open, isOwn]);

  React.useEffect(() => {
    if (!open || !isOwn || !currentUserId) return;
    let cancelled = false;
    getBadgeDisplayDb(currentUserId).then((d) => {
      if (!cancelled) setShowBadge(d.visible);
    });
    return () => {
      cancelled = true;
    };
  }, [open, isOwn, currentUserId]);

  // Esconder/mostrar a insígnia: otimista, volta atrás se falhar.
  const toggleShowBadge = async () => {
    if (showBadge === null || savingShow) return;
    const next = !showBadge;
    setShowBadge(next);
    setSavingShow(true);
    try {
      await setShowBadgeDb(next);
      toast.success(next ? t("badges_show_on_toast") : t("badges_show_off_toast"));
      try {
        await onChanged?.();
      } catch {
        // ignore
      }
    } catch (err) {
      setShowBadge(!next);
      reportHandledError(err, "insignias-drawer:show-badge");
      toast.error(t("badges_show_error"));
    } finally {
      setSavingShow(false);
    }
  };
  const badgeHidden = isOwn && showBadge === false;

  const catalog = React.useMemo(() => visibleBadges(allBadges), [allBadges]);
  const earnedCount = catalog.filter((b) => earnedIds.has(String(b.id))).length;
  const allEarned = catalog.length > 0 && earnedCount === catalog.length;

  const handleSelect = async (badge: Badge) => {
    if (isReadOnly || isSelecting) return;
    if (!isBadgeUnlocked(badge, earnedIds)) {
      toast.error(t("badges_not_reached"));
      return;
    }
    if (badge.id === activeBadgeId) return;

    try {
      setIsSelecting(badge.id);
      // Otimista: marca como ativa na hora.
      setOverrideActiveId(badge.id);
      await setSelectedBadgeDb(badge.id);
      toast.success(t("badges_selected").replace("{name}", badgeName(badge, t)));
      try {
        await onChanged?.();
      } catch {
        // ignore
      }
    } catch (err: any) {
      setOverrideActiveId(null);
      if (err?.message !== "BADGE_NOT_UNLOCKED") reportHandledError(err, "insignias-drawer:select");
      toast.error(err?.message === "BADGE_NOT_UNLOCKED" ? t("badges_not_reached") : t("badges_error"));
    } finally {
      setIsSelecting(null);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        {...GLASS_SHEET_PROPS}
        className={`${GLASS_SHEET_PROPS.className} pb-6`}
        style={GLASS_SHEET_STYLE}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DrawerHeader className="shrink-0">
          <DrawerTitle className="flex items-center gap-2" style={{ color: "#fff" }}>
            <span className="text-2xl">🏆</span>
            {t("badges_title")}
          </DrawerTitle>
          <DrawerDescription style={{ color: "rgba(255,255,255,.55)" }}>{t("badges_desc")}</DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-hide">
          {/* Progresso geral */}
          <div className="mb-5 p-4 rounded-2xl" style={GLASS_PANEL_STYLE}>
            <div className="flex items-center justify-between mb-2.5">
              <p className="font-semibold text-sm text-white">
                {allEarned
                  ? t("badges_overall_all")
                  : t("badges_overall").replace("{n}", String(earnedCount)).replace("{total}", String(catalog.length))}
              </p>
              <p className="font-bold text-base tabular-nums text-white">
                {earnedCount}/{catalog.length}
              </p>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.1)" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${catalog.length > 0 ? (earnedCount / catalog.length) * 100 : 0}%`,
                  background: BADGE_ACCENT_GRADIENT,
                }}
              />
            </div>
          </div>

          {/* Mostrar/esconder a insígnia ao lado do nome — só no próprio perfil.
              Esconder não apaga nem troca a escolhida. */}
          {isOwn && (
            <div className="mb-5 flex items-center justify-between gap-3 p-4 rounded-2xl" style={GLASS_PANEL_STYLE}>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{t("badges_show_label")}</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,.55)" }}>
                  {t("badges_show_desc")}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={showBadge !== false}
                aria-label={t("badges_show_label")}
                disabled={showBadge === null || savingShow}
                onClick={toggleShowBadge}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60",
                  showBadge !== false ? "bg-brand" : "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    showBadge !== false ? "translate-x-6" : "translate-x-1",
                  )}
                />
              </button>
            </div>
          )}

          {BADGE_GROUPS.map((group) => {
            const items = catalog.filter((b) => badgeGroup(b) === group.id);
            if (items.length === 0) return null;
            const groupEarned = items.filter((b) => earnedIds.has(String(b.id))).length;
            return (
              <section key={group.id} className="mb-5">
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <h3 className="text-[12px] font-semibold uppercase tracking-wider text-white/55">{t(group.labelKey)}</h3>
                  <span className="text-[12px] font-semibold tabular-nums text-white/45">
                    {groupEarned}/{items.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((badge) => (
                    <BadgeRow
                      key={badge.id}
                      badge={badge}
                      unlocked={earnedIds.has(String(badge.id))}
                      active={activeBadgeId === badge.id}
                      hidden={badgeHidden}
                      busy={isSelecting === badge.id}
                      readOnly={isReadOnly}
                      progress={isOwn && metrics ? metrics[badge.condition_type] ?? 0 : null}
                      onSelect={() => handleSelect(badge)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {!isReadOnly && (
          <div className="px-5 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
            <p className="text-xs font-medium text-center" style={{ color: "rgba(255,255,255,.5)" }}>
              {badgeHidden ? t("badges_bottom_hint_hidden") : t("badges_bottom_hint")}
            </p>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function BadgeRow({
  badge,
  unlocked,
  active,
  hidden,
  busy,
  readOnly,
  progress,
  onSelect,
}: {
  badge: Badge;
  unlocked: boolean;
  active: boolean;
  /** O dono escondeu a insígnia: a escolhida vira "Escolhida", não "Ativo". */
  hidden: boolean;
  busy: boolean;
  readOnly: boolean;
  /** Valor atual da métrica (só no próprio perfil); `null` = não mostrar barra. */
  progress: number | null;
  onSelect: () => void;
}) {
  const { t } = useLanguage();
  const target = Math.max(1, badge.required_checkins);
  // Barra só faz sentido com mais de um passo ("3/10"); para "primeira vez"
  // a descrição já diz o que fazer.
  const showBar = !unlocked && progress !== null && target > 1;
  const pct = Math.min(100, ((progress ?? 0) / target) * 100);

  return (
    <button
      type="button"
      disabled={readOnly || !unlocked || busy}
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-2xl border transition-transform",
        unlocked && !readOnly && "active:scale-[0.98]",
        !unlocked && "opacity-75",
      )}
      style={
        unlocked
          ? {
              background: "linear-gradient(135deg,rgba(255,177,94,.14),rgba(255,122,60,.05))",
              borderColor: active ? "rgba(255,160,80,.85)" : "rgba(255,160,80,.3)",
              boxShadow: active ? "0 0 0 1px rgba(255,160,80,.85)" : undefined,
            }
          : { background: "rgba(255,255,255,.03)", borderColor: "rgba(255,255,255,.08)" }
      }
    >
      <div className="p-3.5 flex items-center gap-3.5">
        <BadgeMedallion emoji={badge.emoji} size="md" locked={!unlocked} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-sm text-white truncate">{badgeName(badge, t)}</p>
            {active && (
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-brand/20 text-brand font-bold uppercase tracking-wider">
                {hidden ? t("badges_chosen") : t("badges_active")}
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "rgba(255,255,255,.55)" }}>
            {badgeDescription(badge, t)}
          </p>
          {showBar && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.1)" }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: BADGE_ACCENT_GRADIENT, opacity: 0.8 }} />
              </div>
              <p className="text-[11px] font-bold tabular-nums text-white/60">
                {Math.min(progress ?? 0, target)}/{target}
              </p>
            </div>
          )}
        </div>
        <div className="shrink-0">
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin text-white/70" />
          ) : !unlocked ? (
            <Lock className="h-4 w-4 text-white/35" />
          ) : active ? (
            <div className="h-5 w-5 rounded-full flex items-center justify-center bg-brand text-white">
              <Check className="h-3.5 w-3.5 stroke-[3]" />
            </div>
          ) : !readOnly ? (
            <div className="h-5 w-5 rounded-full border border-white/30" />
          ) : null}
        </div>
      </div>
    </button>
  );
}
