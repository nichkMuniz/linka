import * as React from "react";
import * as ReactDOM from "react-dom";
import {
  getGroupCheckInDetailDb,
  getRecentCompletedRoutinesDb,
  updateGroupPhotoDb,
  getCheckInCommentsDb,
  getCheckInReactionsDb,
  getCheckInReactionUsersDb,
  setCheckInReactionDb,
  sendCheckInReactionNotificationDb,
  getCheckInVotesDb,
  setCheckInVoteDb,
  type DuelCheckInVoteType,
} from "@/lib/ritmofit-db";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { ArrowLeft, Plus, X, ChevronRight, Edit3, CheckCircle2, XCircle } from "lucide-react";
import {
  InlineCropPreview,
  applyTransformToBlob,
  DEFAULT_TRANSFORM,
} from "@/components/shared/inline-crop-preview";
import {
  GLASS_PRIMARY_BTN_STYLE,
  GLASS_CARD_STYLE,
} from "@/lib/glass-styles";
import { useNavigate } from "react-router-dom";
import { usePremium } from "@/lib/premium-context";
import { useLanguage } from "@/lib/language-context";
import { UserAvatar } from "@/components/shared/user-avatar";

import type { DuelsController } from "./use-duels";

/**
 * Vista de um duelo em tela cheia (portal): capa, abas de check-ins e
 * participantes, pull-to-refresh e rolagem paginada do histórico.
 */
export function DuelGroupView({ ctl }: { ctl: DuelsController }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isPremium } = usePremium();
  const navigate = useNavigate();
  const {
    setSearchParams,
    checkInVotes,
    setCheckInVotes,
    editCoverInputRef,
    coverCropSrc,
    setCoverCropSrc,
    coverCropTransform,
    setCoverCropTransform,
    coverCropWRef,
    coverCropHRef,
    isSavingCover,
    setIsSavingCover,
    setUserCreatedGroups,
    selectedGroupForView,
    setSelectedGroupForView,
    groupCheckIns,
    setGroupCheckIns,
    visibleCheckInCount,
    activeGroupViewTab,
    setIsAddCheckInModalOpen,
    setCheckInForm,
    setCheckInPhotoFiles,
    setCheckInPhotoPreviewUrls,
    setCompletedRoutines,
    setSelectedRoutineKey,
    setSelectedCheckInForDetail,
    setIsCheckInDetailOpen,
    setIsGroupDetailsOpen,
    setIsClassificationsOpen,
    setIsParticipantsModalOpen,
    setCheckInComments,
    setIsLoadingComments,
    setCommentText,
    checkInReactions,
    setCheckInReactions,
    CHECKIN_QUICK_EMOJIS,
    setReactionViewerState,
    longPressedCheckIn,
    setLongPressedCheckIn,
    handleCheckInTouchStart,
    handleCheckInTouchEnd,
    isLoadingCheckIns,
    setIsLoadingRoutines,
    onGroupViewScroll,
    groupViewScrollRef,
    groupPullDistance,
    isGroupRefreshing,
    GROUP_PULL_THRESHOLD,
    onGroupTouchStart,
    onGroupTouchMove,
    onGroupTouchEnd,
  } = ctl;

  return (
    <>
      {/* Duels Tab - Full Screen Group View */}
      {selectedGroupForView && ReactDOM.createPortal(
        <div
          className="fixed top-0 right-0 bottom-0 flex flex-col z-[100]"
          style={{
            left: "var(--sidebar-width, 0px)",
            // Fundo = token da página + aura da marca pintada direto (radial-gradient,
            // nunca um div com filter: blur — design system §0.3).
            background:
              "radial-gradient(120% 70% at 50% -10%, rgba(91,140,255,.12), rgba(157,107,255,.06) 45%, transparent 70%), hsl(var(--background))",
            fontFamily: "'Manrope', sans-serif",
            // Accents da marca + superfícies translúcidas. O roxo saturado que
            // essa tela usava (#7c3aed/#a855f7) não vinha da paleta; as
            // superfícies de card agora vêm de GLASS_CARD_STYLE (vidro).
            "--surface2": "rgba(255,255,255,.08)",
            "--line": "rgba(255,255,255,.10)",
            "--muted": "rgba(255,255,255,.55)",
            "--accent": "#5b8cff",
            "--accent2": "#9d6bff",
          } as React.CSSProperties}
        >
          {/* Header: voltar · "Grupo" · espaçador */}
          <div
            className="flex-shrink-0 px-5 pb-3 flex items-center justify-between"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.9rem)" }}
          >
            <button
              onClick={() => {
                setSelectedGroupForView(null);
                setGroupCheckIns([]);
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.delete("group");
                  return next;
                }, { replace: true });
              }}
              className="h-9 w-9 rounded-[11px] flex items-center justify-center text-white transition-transform active:scale-90"
              style={GLASS_CARD_STYLE}
            >
              <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </button>
            <span className="text-[13px] font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--muted)" }}>
              {t("duels_group_header")}
            </span>
            {/* Espaçador: equilibra o botão de voltar e mantém "Grupo" no centro.
                O botão de trocar a capa vive dentro do frame da capa. */}
            <span className="h-9 w-9" />
          </div>

          {/* Content */}
          <div
            ref={groupViewScrollRef}
            className="flex-1 overflow-y-auto"
            onScroll={onGroupViewScroll}
            onTouchStart={onGroupTouchStart}
            onTouchMove={onGroupTouchMove}
            onTouchEnd={onGroupTouchEnd}
          >
            {/* Pull-to-refresh indicator */}
            {(groupPullDistance > 0 || isGroupRefreshing) && (
              <div
                className="flex items-center justify-center overflow-hidden transition-all"
                style={{ height: `${isGroupRefreshing ? GROUP_PULL_THRESHOLD : groupPullDistance}px` }}
              >
                <div
                  className={`h-6 w-6 rounded-full border-2 border-t-transparent ${isGroupRefreshing ? "animate-spin" : "transition-transform"}`}
                  style={{
                    borderColor: "var(--accent)",
                    borderTopColor: "transparent",
                    transform: isGroupRefreshing ? undefined : `rotate(${(groupPullDistance / GROUP_PULL_THRESHOLD) * 360}deg)`,
                    opacity: isGroupRefreshing ? 1 : groupPullDistance / GROUP_PULL_THRESHOLD,
                  }}
                />
              </div>
            )}
            <div className="pb-24">
              {/* Hero cover card */}
              <div className="px-5 pt-1">
                <div className="relative h-[130px] rounded-[22px] overflow-hidden" style={{ background: "linear-gradient(135deg,rgba(91,140,255,.28),rgba(157,107,255,.18))", border: "1px solid rgba(255,255,255,.10)" }}>
                  {coverCropSrc ? (
                    // Modo de ajuste: enquadra no próprio hero. Sem scrim nem
                    // título por cima — o frame precisa mostrar o recorte cru,
                    // que é exatamente o que vai subir.
                    <InlineCropPreview
                      imageSrc={coverCropSrc}
                      transform={coverCropTransform}
                      onTransformChange={setCoverCropTransform}
                      containerWidthRef={coverCropWRef}
                      containerHeightRef={coverCropHRef}
                    />
                  ) : (
                    <>
                      {selectedGroupForView.photo ? (
                        <img
                          src={selectedGroupForView.photo}
                          alt={selectedGroupForView.name}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-5xl">{selectedGroupForView.icon}</div>
                      )}
                      <div className="absolute inset-0" style={{ background: "linear-gradient(to top,rgba(0,0,0,.65),rgba(0,0,0,0) 62%)" }} />
                      <h1
                        className="absolute left-[18px] right-[18px] bottom-[14px] text-[24px] font-extrabold leading-tight text-white truncate"
                        style={{ fontFamily: "'Space Grotesk', sans-serif", textShadow: "0 2px 12px rgba(0,0,0,.6)" }}
                      >
                        {selectedGroupForView.name}
                      </h1>
                    </>
                  )}

                  {/* Trocar capa — só o criador. Fica no canto da própria capa,
                      onde a ação se aplica. O scrim do card só escurece a base,
                      então este canto precisa de fundo próprio para o ícone não
                      sumir em fotos claras. */}
                  {selectedGroupForView.createdBy === user?.id && (
                    <>
                      <input
                        ref={editCoverInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          // Permite escolher o mesmo arquivo de novo depois de um erro.
                          e.target.value = "";
                          if (!file) return;
                          // Não sobe ainda: entra em modo de ajuste no hero.
                          setCoverCropTransform(DEFAULT_TRANSFORM);
                          const reader = new FileReader();
                          reader.onloadend = () => setCoverCropSrc(reader.result as string);
                          reader.readAsDataURL(file);
                        }}
                      />
                      {!coverCropSrc && (
                        <button
                          onClick={() => editCoverInputRef.current?.click()}
                          title={t("duels_group_edit_cover")}
                          aria-label={t("duels_group_edit_cover")}
                          className="absolute top-[10px] right-[10px] h-9 w-9 rounded-[11px] flex items-center justify-center text-white transition-transform active:scale-90"
                          style={{
                            background: "rgba(0,0,0,.42)",
                            backdropFilter: "blur(14px) saturate(150%)",
                            WebkitBackdropFilter: "blur(14px) saturate(150%)",
                            border: "1px solid rgba(255,255,255,.22)",
                          }}
                        >
                          <Edit3 className="h-[15px] w-[15px]" strokeWidth={2.2} />
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Ações do modo de ajuste da capa */}
                {coverCropSrc && (
                  <div className="pt-2 space-y-2">
                    <p className="text-[11px] text-center" style={{ color: "var(--muted)" }}>{t("duels_cover_crop_hint")}</p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 rounded-full bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white"
                        disabled={isSavingCover}
                        onClick={() => setCoverCropSrc(null)}
                      >
                        {t("cancel")}
                      </Button>
                      <Button
                        className="flex-1 rounded-full border-0"
                        style={GLASS_PRIMARY_BTN_STYLE}
                        disabled={isSavingCover}
                        onClick={async () => {
                          if (!selectedGroupForView || !coverCropSrc) return;
                          const groupId = selectedGroupForView.id;
                          setIsSavingCover(true);
                          try {
                            const blob = await applyTransformToBlob(
                              coverCropSrc,
                              coverCropTransform,
                              coverCropWRef.current,
                              coverCropHRef.current,
                            );
                            const photoUrl = await updateGroupPhotoDb(
                              groupId,
                              new File([blob], "cover.jpg", { type: "image/jpeg" }),
                            );
                            // Pré-carrega a URL remota antes de trocar, senão a
                            // capa pisca ao sair do modo de ajuste.
                            await new Promise<void>((resolve) => {
                              // `Image` aqui é o ícone do lucide — usar o global.
                              const img = new window.Image();
                              img.onload = () => resolve();
                              img.onerror = () => resolve();
                              img.src = photoUrl;
                            });
                            setSelectedGroupForView((prev: any) =>
                              prev && prev.id === groupId ? { ...prev, photo: photoUrl } : prev
                            );
                            setUserCreatedGroups((prev) =>
                              prev.map((g) => g.id === groupId ? { ...g, photo: photoUrl } : g)
                            );
                            setCoverCropSrc(null);
                            toast({ title: t("duels_group_cover_updated") });
                          } catch {
                            toast({ title: t("duels_group_cover_error"), variant: "destructive" });
                          } finally {
                            setIsSavingCover(false);
                          }
                        }}
                      >
                        {isSavingCover ? t("duels_group_saving") : t("duels_group_save")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Stats Section */}
              <div className="px-5 pt-[18px]">
                {(() => {
                  // Calculate scores respecting scoring type
                  const scoringType = selectedGroupForView.scoringType || "check_in_count";
                  const scoreMap: Record<string, { userName: string; score: number; dates?: Set<string> }> = {};
                  for (const c of groupCheckIns) {
                    if (!scoreMap[c.userId]) scoreMap[c.userId] = { userName: c.userName, score: 0, dates: new Set() };
                    const e = scoreMap[c.userId];
                    // For memes: skip disqualified check-ins
                    if (scoringType === "memes") {
                      const votes = checkInVotes.filter((v) => v.checkInId === c.id);
                      const dq = votes.filter((v) => v.voteType === "disqualify").length;
                      const cl = votes.filter((v) => v.voteType === "classify").length;
                      if (dq > cl && dq > 0) continue;
                      e.score += 1;
                    } else if (scoringType === "check_in_count") e.score += 1;
                    else if (scoringType === "active_days") { e.dates!.add(c.createdAt.slice(0, 10)); e.score = e.dates!.size; }
                    else if (scoringType === "hustle_points") e.score += c.volume || 0;
                    else if (scoringType === "duration") e.score += c.durationMinutes || 0;
                    else if (scoringType === "distance") e.score += c.distanceKm || 0;
                    else if (scoringType === "steps") e.score += c.steps || 0;
                    else if (scoringType === "calories") e.score += c.calories || 0;
                  }
                  const sorted = Object.entries(scoreMap).sort((a, b) => b[1].score - a[1].score);
                  const leaderStats = sorted.length > 0 ? { userId: sorted[0][0], ...sorted[0][1] } : null;
                  const userRanking = sorted.findIndex(([uid]) => uid === user?.id) + 1;

                  // Calculate days remaining
                  const daysRemaining = selectedGroupForView.endDate
                    ? Math.ceil(
                      (new Date(selectedGroupForView.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                    )
                    : null;

                  const SURFACE_CARD_STYLE = GLASS_CARD_STYLE;
                  return (
                    <div className="grid grid-cols-2 gap-[9px]">
                      {/* Your ranking — big gradient hero card */}
                      <button
                        onClick={() => setIsClassificationsOpen(true)}
                        className="row-span-2 rounded-[20px] p-[18px] flex flex-col justify-between items-start text-left min-h-[124px] active:scale-[.98] transition-transform"
                        style={{
                          ...GLASS_PRIMARY_BTN_STYLE,
                          boxShadow: "0 12px 30px -10px rgba(123,63,242,.45), inset 0 1px 0 rgba(255,255,255,.2)",
                        }}
                      >
                        <span className="text-[10.5px] font-semibold uppercase tracking-[.03em]" style={{ color: "rgba(255,255,255,.75)" }}>
                          {t("duels_group_your_ranking")}
                        </span>
                        <span className="text-[38px] font-extrabold leading-none text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                          {userRanking > 0 ? `#${userRanking}` : "–"}
                        </span>
                      </button>

                      {/* Leader */}
                      <button
                        onClick={() => setIsClassificationsOpen(true)}
                        className="rounded-[20px] px-4 py-[14px] text-left active:scale-[.98] transition-transform"
                        style={SURFACE_CARD_STYLE}
                      >
                        <div className="text-[24px] font-extrabold leading-none" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--accent2)" }}>
                          {leaderStats ? Math.round(leaderStats.score) : 0}
                        </div>
                        <div className="text-[10.5px] font-semibold mt-[3px] truncate" style={{ color: "var(--muted)" }}>
                          {leaderStats?.userName ? `${leaderStats.userName} · ${t("duels_group_leader_suffix")}` : t("duels_group_leader")}
                        </div>
                      </button>

                      {/* Days remaining */}
                      <button
                        onClick={() => setIsGroupDetailsOpen(true)}
                        className="rounded-[20px] px-4 py-[14px] text-left active:scale-[.98] transition-transform"
                        style={SURFACE_CARD_STYLE}
                      >
                        <div className="text-[24px] font-extrabold leading-none" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--accent2)" }}>
                          {daysRemaining !== null ? (daysRemaining > 0 ? daysRemaining : t("duels_group_ended_short")) : "–"}
                        </div>
                        <div className="text-[10.5px] font-semibold mt-[3px]" style={{ color: "var(--muted)" }}>
                          {daysRemaining !== null && daysRemaining <= 0 ? t("duels_ended") : t("duels_group_days_left")}
                        </div>
                      </button>
                    </div>
                  );
                })()}
              </div>

              {/* NÃO é um tab bar, apesar do formato segmentado: os três abrem
                  DRAWERS, ninguém troca o conteúdo da tela (o histórico abaixo é
                  sempre o mesmo). Nenhum leva destaque justamente por isso — os
                  três são atalhos equivalentes, e um deles pintado sugeriria
                  "você está aqui", que é falso. O chevron marca "abre painel". */}
              <div className="px-5 pt-5">
                <div className="flex gap-1 p-1 rounded-[15px]" style={GLASS_CARD_STYLE}>
                  <button
                    onClick={() => setIsGroupDetailsOpen(true)}
                    className="flex-1 min-w-0 flex items-center justify-center gap-0.5 py-[9px] rounded-[12px] text-[12.5px] font-semibold transition-transform active:scale-95"
                    style={{ color: "var(--muted)" }}
                  >
                    <span className="truncate">{t("duels_group_tab_details")}</span>
                    <ChevronRight className="h-3 w-3 shrink-0 opacity-60" strokeWidth={2.5} />
                  </button>
                  <button
                    onClick={() => setIsParticipantsModalOpen(true)}
                    className="flex-1 min-w-0 flex items-center justify-center gap-0.5 py-[9px] rounded-[12px] text-[12.5px] font-semibold transition-transform active:scale-95"
                    style={{ color: "var(--muted)" }}
                  >
                    <span className="truncate">{t("duels_group_tab_participants")}</span>
                    <ChevronRight className="h-3 w-3 shrink-0 opacity-60" strokeWidth={2.5} />
                  </button>
                  <button
                    onClick={() => setIsClassificationsOpen(true)}
                    className="flex-1 min-w-0 flex items-center justify-center gap-0.5 py-[9px] rounded-[12px] text-[12.5px] font-semibold transition-transform active:scale-95"
                    style={{ color: "var(--muted)" }}
                  >
                    <span className="truncate">{t("duels_group_tab_ranking_short")}</span>
                    <ChevronRight className="h-3 w-3 shrink-0 opacity-60" strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              {/* History section header */}
              <div className="px-5 pt-5 pb-1 flex items-center justify-between">
                <span className="text-[14px] font-bold text-white">{t("duels_group_history")}</span>
                <span className="text-[11.5px] font-semibold" style={{ color: "var(--muted)" }}>{t("duels_group_records").replace("{n}", String(groupCheckIns.length))}</span>
              </div>

              {/* Check-ins Tab */}
              {activeGroupViewTab === "check-ins" && (
                <div className="space-y-4 px-5 pt-1 pb-4">
                  {isLoadingCheckIns ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="animate-pulse flex gap-[11px] items-center rounded-[17px]" style={{ ...GLASS_CARD_STYLE, padding: "11px 11px 11px 13px", borderLeft: "3px solid var(--line)" }}>
                          <div className="w-10 h-10 rounded-[12px] bg-white/10 flex-none" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3 bg-white/10 rounded w-1/3" />
                            <div className="h-2 bg-white/10 rounded w-1/2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : groupCheckIns.length > 0 ? (() => {
                    // Sort newest first, recorta no lote visível, então agrupa
                    // por dia — cortar antes do sort traria os dias errados.
                    const sorted = [...groupCheckIns]
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .slice(0, visibleCheckInCount);
                    const grouped: { label: string; items: typeof sorted }[] = [];
                    const seenDays = new Map<string, typeof sorted>();
                    for (const checkIn of sorted) {
                      const d = new Date(checkIn.createdAt);
                      const dayKey = d.toDateString();
                      const today = new Date();
                      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
                      const label = dayKey === today.toDateString() ? t("goals_today_label") : dayKey === yesterday.toDateString() ? t("goals_dash_yesterday") : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
                      if (!seenDays.has(dayKey)) {
                        seenDays.set(dayKey, []);
                        grouped.push({ label, items: seenDays.get(dayKey)! });
                      }
                      seenDays.get(dayKey)!.push(checkIn);
                    }
                    const remaining = groupCheckIns.length - sorted.length;
                    return (
                      <>
                        {grouped.map((group) => (
                          <div key={group.label}>
                            <p className="text-[10.5px] font-semibold mb-2 uppercase tracking-[.04em]" style={{ color: "var(--muted)" }}>{group.label}</p>
                            <div className="space-y-2">
                          {group.items.map((checkIn) => {
                            const reactions = checkInReactions[checkIn.id] ?? [];
                            const groupedReactions = CHECKIN_QUICK_EMOJIS
                              .map((emoji) => ({ emoji, count: reactions.filter((r) => r.emoji === emoji).length }))
                              .filter((g) => g.count > 0);
                            return (
                              <div
                                key={checkIn.id}
                                className={`relative ${(() => {
                                  if (selectedGroupForView?.scoringType !== "memes") return "";
                                  const votes = checkInVotes.filter((v) => v.checkInId === checkIn.id);
                                  const dq = votes.filter((v) => v.voteType === "disqualify").length;
                                  const cl = votes.filter((v) => v.voteType === "classify").length;
                                  return dq > cl && dq > 0 ? "opacity-50" : "";
                                })()}`}
                              >
                                <div
                                  className="flex items-center gap-[11px] rounded-[17px] active:opacity-80 transition-opacity cursor-pointer select-none"
                                  style={{
                                    ...GLASS_CARD_STYLE,
                                    // Faixa da marca só no check-in do próprio usuário
                                    borderLeft: `3px solid ${checkIn.userId === user?.id ? "var(--accent)" : "var(--line)"}`,
                                    padding: "11px 11px 11px 13px",
                                  }}
                                  onTouchStart={() => handleCheckInTouchStart(checkIn)}
                                  onTouchEnd={handleCheckInTouchEnd}
                                  onTouchMove={handleCheckInTouchEnd}
                                  onContextMenu={(e) => { e.preventDefault(); setLongPressedCheckIn(checkIn); }}
                                  onClick={async () => {
                                    if (longPressedCheckIn) return;
                                    setSelectedCheckInForDetail(checkIn);
                                    setCheckInComments([]);
                                    setCommentText("");
                                    setIsCheckInDetailOpen(true);
                                    setIsLoadingComments(true);
                                    const [detail, comments, reactions] = await Promise.all([
                                      getGroupCheckInDetailDb(checkIn.id),
                                      getCheckInCommentsDb(checkIn.id),
                                      getCheckInReactionsDb([checkIn.id]),
                                    ]);
                                    if (detail) setSelectedCheckInForDetail(detail);
                                    setCheckInComments(comments);
                                    setCheckInReactions((prev) => ({ ...prev, ...reactions }));
                                    setIsLoadingComments(false);
                                  }}
                                >
                                  {/* Thumbnail / avatar tile */}
                                  {checkIn.photo ? (
                                    <div className="w-10 h-10 rounded-[12px] overflow-hidden flex-none" style={{ background: "var(--surface2)" }}>
                                      <img src={checkIn.photo} alt="check-in" className="w-full h-full object-cover" />
                                    </div>
                                  ) : (
                                    <UserAvatar
                                      photo={checkIn.userPhoto}
                                      nickname={checkIn.userName}
                                      size="md"
                                      className="rounded-[12px]"
                                    />
                                  )}
                                  {/* Content */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-bold truncate text-white">
                                      {checkIn.description || checkIn.workoutInfo}
                                    </p>
                                    <p className="text-[11px] font-medium truncate" style={{ color: "var(--muted)" }}>
                                      {checkIn.userName} · {new Date(checkIn.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>
                                  {/* Muscle group count pill */}
                                  {checkIn.muscleGroups.length > 0 && (
                                    <span className="text-[10px] font-bold px-2 py-1 rounded-full flex-none leading-none" style={{ background: "rgba(157,107,255,.16)", border: "1px solid rgba(157,107,255,.28)", color: "var(--accent2)" }}>
                                      +{checkIn.muscleGroups.length}
                                    </span>
                                  )}
                                </div>
                                {/* Emoji reactions — all users */}
                                {groupedReactions.length > 0 && (
                                  <div className="flex items-center gap-1 flex-wrap pt-1 pl-16">
                                    {groupedReactions.map(({ emoji, count }) => (
                                      <button
                                        key={emoji}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setReactionViewerState({ checkInId: checkIn.id, emoji, users: [], loading: true });
                                          getCheckInReactionUsersDb(checkIn.id).then((users) => {
                                            setReactionViewerState((prev) => prev ? { ...prev, users, loading: false } : null);
                                          }).catch(() => {
                                            setReactionViewerState((prev) => prev ? { ...prev, loading: false } : null);
                                          });
                                        }}
                                        className="flex items-center gap-0.5 px-2 py-1 rounded-full text-xs leading-none active:opacity-70 transition-opacity text-white/80"
                                        style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}
                                      >
                                        {emoji} {count > 1 && <span className="font-medium">{count}</span>}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                {/* Memes — evaluation bar, visually separated from emoji reactions */}
                                {selectedGroupForView?.scoringType === "memes" && (() => {
                                  const votes = checkInVotes.filter((v) => v.checkInId === checkIn.id);
                                  const classifyCount = votes.filter((v) => v.voteType === "classify").length;
                                  const disqualifyCount = votes.filter((v) => v.voteType === "disqualify").length;
                                  const userVote = votes.find((v) => v.userId === user?.id)?.voteType ?? null;
                                  const disqualified = disqualifyCount > classifyCount && disqualifyCount > 0;
                                  const isOwn = checkIn.userId === user?.id;
                                  // Quem postou não avalia o próprio check-in: só acompanha.
                                  // Anulado já é dito pelo selo à direita — não cabe "pendente" junto.
                                  const label = isOwn
                                    ? (disqualified ? null : `⏳ ${t("duels_group_pending_review")}`)
                                    : `🎭 ${t("duels_group_evaluate")}`;
                                  return (
                                    <div className="ml-16 mt-1.5 flex items-center gap-2 pt-1.5" style={{ borderTop: "1px solid var(--line)" }}>
                                      {label && (
                                        <span className="text-[10px] font-medium shrink-0 tracking-wide" style={{ color: "var(--muted)" }}>{label}</span>
                                      )}
                                      <div className="flex items-center gap-1.5 flex-1">
                                        {!isOwn ? (
                                          <>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const next: DuelCheckInVoteType | null = userVote === "classify" ? null : "classify";
                                                setCheckInVotes((prev) => {
                                                  const filtered = prev.filter((v) => !(v.checkInId === checkIn.id && v.userId === user!.id));
                                                  return next ? [...filtered, { checkInId: checkIn.id, userId: user!.id, voteType: next }] : filtered;
                                                });
                                                setCheckInVoteDb(checkIn.id, next).catch(() => {
                                                  getCheckInVotesDb(selectedGroupForView.id).then(setCheckInVotes).catch(() => {});
                                                });
                                              }}
                                              aria-label="Classificar check-in"
                                              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition-colors min-h-[28px] ${userVote === "classify" ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400" : "bg-transparent border-border/40 text-muted-foreground hover:border-emerald-500/40 hover:text-emerald-600"}`}
                                            >
                                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                              {classifyCount > 0 && <span>{classifyCount}</span>}
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const next: DuelCheckInVoteType | null = userVote === "disqualify" ? null : "disqualify";
                                                setCheckInVotes((prev) => {
                                                  const filtered = prev.filter((v) => !(v.checkInId === checkIn.id && v.userId === user!.id));
                                                  return next ? [...filtered, { checkInId: checkIn.id, userId: user!.id, voteType: next }] : filtered;
                                                });
                                                setCheckInVoteDb(checkIn.id, next).catch(() => {
                                                  getCheckInVotesDb(selectedGroupForView.id).then(setCheckInVotes).catch(() => {});
                                                });
                                              }}
                                              aria-label="Desclassificar check-in"
                                              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition-colors min-h-[28px] ${userVote === "disqualify" ? "bg-destructive/15 border-destructive/40 text-destructive" : "bg-transparent border-border/40 text-muted-foreground hover:border-destructive/40 hover:text-destructive"}`}
                                            >
                                              <XCircle className="h-3.5 w-3.5 shrink-0" />
                                              {disqualifyCount > 0 && <span>{disqualifyCount}</span>}
                                            </button>
                                          </>
                                        ) : (classifyCount > 0 || disqualifyCount > 0) ? (
                                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" />{classifyCount}</span>
                                            <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-destructive" />{disqualifyCount}</span>
                                          </div>
                                        ) : null}
                                      </div>
                                      {disqualified && (
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-destructive bg-destructive/10 border border-destructive/20 px-1.5 py-0.5 rounded shrink-0">
                                          {t("duels_group_annulled")}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                              })}
                            </div>
                          </div>
                        ))}
                        {remaining > 0 && (
                          <p className="text-[11.5px] font-medium text-center py-3" style={{ color: "var(--muted)" }}>
                            {t("duels_group_more_records").replace("{n}", String(remaining))}
                          </p>
                        )}
                      </>
                    );
                  })() : (
                    <p className="text-sm text-center py-8" style={{ color: "var(--muted)" }}>{t("duels_group_no_checkins")}</p>
                  )}

                </div>
              )}

            </div>
          </div>

          {/* Centered Add Check-in Button at Bottom */}
          {(() => {
            const isGroupExpired = selectedGroupForView?.endDate
              ? new Date(selectedGroupForView.endDate) <= new Date()
              : false;
            return (
              <div className="fixed right-[18px] z-[101]" style={{ bottom: "calc(20px + env(safe-area-inset-bottom))" }}>
                <button
                  disabled={isGroupExpired}
                  onClick={() => {
                    if (!user?.id || isGroupExpired) return;
                    // Open modal immediately — load routines in background
                    setSelectedRoutineKey(null);
                    setCheckInForm({ photo: "", photos: [], description: "", workoutId: "" });
                    setCheckInPhotoFiles([]);
                    setCheckInPhotoPreviewUrls([]);
                    setCompletedRoutines([]);
                    setIsAddCheckInModalOpen(true);
                    setIsLoadingRoutines(true);
                    getRecentCompletedRoutinesDb(user.id)
                      .then(setCompletedRoutines)
                      .catch((err: any) => { console.error("Error loading completed routines:", err); })
                      .finally(() => setIsLoadingRoutines(false));
                  }}
                  className="flex items-center gap-[7px] rounded-full text-white transition-transform active:scale-95"
                  style={
                    isGroupExpired
                      ? { padding: "13px 20px", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.1)", color: "rgba(255,255,255,.35)", cursor: "not-allowed" }
                      : { padding: "13px 20px", ...GLASS_PRIMARY_BTN_STYLE, boxShadow: "0 12px 26px -6px rgba(123,63,242,.5), inset 0 1px 0 rgba(255,255,255,.3)" }
                  }
                  title={isGroupExpired ? t("duels_ended") : t("duels_checkin_today")}
                >
                  <Plus className="h-4 w-4" strokeWidth={2.6} />
                  <span className="text-[13px] font-bold">{t("duels_group_checkin_btn")}</span>
                </button>
              </div>
            );
          })()}

          {/* Check-in Emoji Long-Press Overlay */}
          {longPressedCheckIn && (
            <div
              className="fixed inset-0 z-[100] bg-black/40 flex items-end justify-center pb-12"
              onClick={() => setLongPressedCheckIn(null)}
            >
              <div
                className="rounded-[28px] w-full max-w-sm mx-4 overflow-hidden"
                style={{
                  background: "linear-gradient(rgba(30,28,40,.92),rgba(14,13,20,.97))",
                  backdropFilter: "blur(40px) saturate(180%)",
                  WebkitBackdropFilter: "blur(40px) saturate(180%)",
                  border: "1px solid rgba(255,255,255,.12)",
                  boxShadow: "0 24px 60px -12px rgba(0,0,0,.7)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Preview */}
                <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                  <p className="text-xs mb-0.5" style={{ color: "rgba(255,255,255,.5)" }}>{t("duels_group_checkin_of").replace("{name}", longPressedCheckIn.userName)}</p>
                  <p className="text-sm line-clamp-2 font-medium text-white/90">{longPressedCheckIn.description || longPressedCheckIn.workoutInfo}</p>
                </div>

                {/* Emoji rápido */}
                <div className="flex items-center justify-around px-4 py-3">
                  {CHECKIN_QUICK_EMOJIS.map((emoji) => {
                    const reactions = checkInReactions[longPressedCheckIn.id] ?? [];
                    const myReaction = reactions.find((r) => r.userId === user?.id);
                    const isActive = myReaction?.emoji === emoji;
                    return (
                      <button
                        key={emoji}
                        onClick={async () => {
                          const newEmoji = isActive ? null : emoji;
                          const checkInId = longPressedCheckIn.id;
                          const checkInOwnerId = longPressedCheckIn.userId;
                          setLongPressedCheckIn(null);
                          // Optimistic update
                          setCheckInReactions((prev) => {
                            const current = (prev[checkInId] ?? []).filter((r) => r.userId !== user?.id);
                            if (newEmoji) current.push({ checkInId, userId: user!.id, emoji: newEmoji });
                            return { ...prev, [checkInId]: current };
                          });
                          await setCheckInReactionDb(checkInId, newEmoji);
                          // Notify check-in owner when adding a reaction (not removing)
                          if (newEmoji && checkInOwnerId) {
                            sendCheckInReactionNotificationDb(checkInId, checkInOwnerId).catch(() => { });
                          }
                          // Reload from DB so reactions from all users are up to date
                          getCheckInReactionsDb([checkInId]).then((fresh) => {
                            setCheckInReactions((prev) => ({ ...prev, ...fresh }));
                          }).catch(() => { });
                        }}
                        className={`text-2xl active:scale-125 transition-transform relative ${isActive ? "scale-110" : ""}`}
                      >
                        {emoji}
                        {isActive && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: "var(--accent2)" }} />}
                      </button>
                    );
                  })}
                </div>

                {/* Cancelar */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-left text-white/80 hover:bg-white/[.06]"
                  style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}
                  onClick={() => setLongPressedCheckIn(null)}
                >
                  <X className="h-5 w-5 text-white/60" />
                  <span className="text-sm font-medium">{t("duels_group_cancel")}</span>
                </button>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
