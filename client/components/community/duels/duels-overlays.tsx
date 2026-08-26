import {
  createDuelGroupDb,
  addGroupCheckInDb,
  getEnrichedDuelGroupsDb,
  leaveGroupDb,
  deleteGroupCheckInDb,
  deleteGroupDb,
  getGroupParticipantsDb,
  updateGroupPhotoDb,
  updateGroupInfoDb,
  removeGroupMemberDb,
  getCheckInVotesDb,
  setCheckInVoteDb,
  type SearchUser,
  type GroupCheckIn,
  type DuelCheckInVoteType,
} from "@/lib/ritmofit-db";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { Send, Check, Plus, X, ChevronRight, Trash2, Edit3, Search, ChevronLeft, Camera, Image, Crop, CheckCircle2, XCircle, Pencil } from "lucide-react";
import { CommentReactions } from "@/components/shared/comment-reactions";
import { ClassificationsDrawer } from "@/components/community/classifications-drawer";
import { MemberCheckInsDrawer } from "@/components/community/member-checkins-drawer";
import { AddMembersDrawer } from "@/components/community/add-members-drawer";
import { EditCheckInDrawer } from "@/components/community/edit-checkin-drawer";
import { ImageCropperDrawer } from "@/components/shared/image-cropper-drawer";
import {
  InlineCropPreview,
  applyTransformToBlob,
  DEFAULT_TRANSFORM,
} from "@/components/shared/inline-crop-preview";
import { PostCarousel } from "@/components/post/post-carousel";
import { compressImageFile } from "@/lib/image-compress";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  GLASS_SHEET_STYLE,
  GLASS_FIELD_STYLE,
  GLASS_PRIMARY_BTN_STYLE,
  GLASS_PANEL_STYLE,
  GLASS_SHEET_PROPS,
  GLASS_LABEL_CLASS,
  GLASS_FIELD_CLASS,
} from "@/lib/glass-styles";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PaywallDrawer } from "@/components/shared/paywall-drawer";
import { usePremium } from "@/lib/premium-context";
import { useLanguage } from "@/lib/language-context";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  DEFAULT_CHECKIN_PHOTO,
  DUEL_SCORING_TYPE_OPTIONS,
} from "@/components/community/community-helpers";

import type { DuelsController } from "./use-duels";

/**
 * Todos os drawers, modais e diálogos da aba Duelos: criação de grupo,
 * novo check-in, detalhe do check-in, detalhes/edição do grupo, participantes,
 * classificações, adicionar membros e as confirmações.
 */
export function DuelsOverlays({
  ctl,
  followers,
}: {
  ctl: DuelsController;
  /** Quem o usuário segue — alimenta o seletor de convidados. */
  followers: SearchUser[];
}) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { isPremium } = usePremium();
  const navigate = useNavigate();
  const {
    setSearchParams,
    setActiveTab,
    isCreateGroupModalOpen,
    setIsCreateGroupModalOpen,
    groupStep,
    setGroupStep,
    isCreatingGroup,
    setIsCreatingGroup,
    groupConfig,
    setGroupConfig,
    checkInMetricValue,
    setCheckInMetricValue,
    checkInVotes,
    setCheckInVotes,
    selectedMemberForCheckIns,
    setSelectedMemberForCheckIns,
    groupPhotoFile,
    setGroupPhotoFile,
    groupCoverTransform,
    setGroupCoverTransform,
    groupCoverWRef,
    groupCoverHRef,
    selectedInvitees,
    setSelectedInvitees,
    setUserCreatedGroups,
    duelPaywallOpen,
    setDuelPaywallOpen,
    duelGateBlocked,
    selectedGroupForView,
    setSelectedGroupForView,
    groupCheckIns,
    setGroupCheckIns,
    groupParticipants,
    setGroupParticipants,
    selectedMemberCheckIns,
    setActiveGroupViewTab,
    isAddCheckInModalOpen,
    setIsAddCheckInModalOpen,
    isSubmittingCheckIn,
    setIsSubmittingCheckIn,
    checkInForm,
    setCheckInForm,
    checkInPhotoFiles,
    setCheckInPhotoFiles,
    checkInPhotoPreviewUrls,
    setCheckInPhotoPreviewUrls,
    activePhotoPreviewIndex,
    setActivePhotoPreviewIndex,
    thumbDragState,
    thumbDragOverRef,
    draggingThumbIndex,
    setDraggingThumbIndex,
    dragOverThumbIndex,
    setDragOverThumbIndex,
    pendingCropSrc,
    setPendingCropSrc,
    pendingCropIndex,
    setPendingCropIndex,
    checkInCameraInputRef,
    checkInGalleryInputRef,
    handleCheckInPhotoSelected,
    completedRoutines,
    selectedRoutineKey,
    setSelectedRoutineKey,
    checkedInRoutineDayKeys,
    routineDayKey,
    participantsSearch,
    setParticipantsSearch,
    selectedCheckInForDetail,
    setSelectedCheckInForDetail,
    isCheckInDetailOpen,
    setIsCheckInDetailOpen,
    isGroupDetailsOpen,
    setIsGroupDetailsOpen,
    isEditingGroupInfo,
    setIsEditingGroupInfo,
    editGroupName,
    setEditGroupName,
    editGroupGoal,
    setEditGroupGoal,
    editGroupRule,
    setEditGroupRule,
    isSavingGroupInfo,
    setIsSavingGroupInfo,
    deleteGroupConfirmOpen,
    setDeleteGroupConfirmOpen,
    leaveGroupConfirmOpen,
    setLeaveGroupConfirmOpen,
    isClassificationsOpen,
    setIsClassificationsOpen,
    isParticipantsModalOpen,
    setIsParticipantsModalOpen,
    participantDetailsId,
    setParticipantDetailsId,
    isAddMembersModalOpen,
    setIsAddMembersModalOpen,
    isEditCheckInOpen,
    setIsEditCheckInOpen,
    confirmDialog,
    setConfirmDialog,
    checkInComments,
    isLoadingComments,
    commentText,
    setCommentText,
    isSendingComment,
    deletingCommentId,
    editingCommentId,
    editCommentDraft,
    setEditCommentDraft,
    isSavingEditComment,
    checkInReactions,
    reactionViewerState,
    setReactionViewerState,
    removeMemberConfirm,
    setRemoveMemberConfirm,
    handleSendComment,
    handleStartEditComment,
    handleCancelEditComment,
    handleSaveEditComment,
    isLoadingRoutines,
    showConfirm,
    formatApprovals,
    formatAnnulments,
    handleDeleteCheckInComment,
    loadGroupsAndRequests,
  } = ctl;

  return (
    <>
      {/* Create Group Drawer */}
      <Drawer
        open={isCreateGroupModalOpen}
        onOpenChange={(open) => {
          setIsCreateGroupModalOpen(open);
          if (!open) {
            // Reset form when closing
            setGroupConfig({
              name: "",
              location: "",
              goal: "",
              durationDays: "",
              photo: "",
              scoringType: "check_in_count",
              memeRule: "",
            });
            setGroupPhotoFile(null);
            setSelectedInvitees(new Set());
            setGroupStep(1);
            setParticipantsSearch("");
          }
        }}
      >
        <DrawerContent
          {...GLASS_SHEET_PROPS}
          style={GLASS_SHEET_STYLE}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DrawerHeader className="shrink-0">
            {/* Progress indicator */}
            <div className="flex items-center gap-2 mb-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${s <= groupStep ? "bg-brand" : ""}`}
                  style={s <= groupStep ? undefined : { background: "rgba(255,255,255,.12)" }}
                />
              ))}
            </div>
            <DrawerTitle className="text-white">{t(`duels_wizard_step${groupStep}_title`)}</DrawerTitle>
            <DrawerDescription className="sr-only">{t("duels_wizard_sr_desc")}</DrawerDescription>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,.5)" }}>
              {t(`duels_wizard_step${groupStep}_subtitle`)}
            </p>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {/* Step 1 — Nome, Meta e Foto */}
            {groupStep === 1 && (
              <div className="space-y-4">
                {/* Group Photo */}
                <div className="space-y-2">
                  <label className={GLASS_LABEL_CLASS}>{t("duels_wizard_cover_label")}</label>
                  <div className="relative w-full h-36 rounded-xl overflow-hidden flex items-center justify-center" style={GLASS_PANEL_STYLE}>
                    {groupConfig.photo ? (
                      <>
                        {/* Enquadra no próprio frame: o que se vê aqui é o que
                            sobe, porque o recorte usa estas mesmas medidas. */}
                        <InlineCropPreview
                          imageSrc={groupConfig.photo}
                          transform={groupCoverTransform}
                          onTransformChange={setGroupCoverTransform}
                          containerWidthRef={groupCoverWRef}
                          containerHeightRef={groupCoverHRef}
                        />
                        <button
                          onClick={() => {
                            setGroupConfig({ ...groupConfig, photo: "" });
                            setGroupPhotoFile(null);
                            setGroupCoverTransform(DEFAULT_TRANSFORM);
                          }}
                          className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      // `absolute inset-0`: o label preenche o frame todo, então
                      // qualquer ponto da capa abre o seletor — antes só o
                      // retângulo do ícone+texto, centralizado pelo pai, era
                      // clicável.
                      <label className="absolute inset-0 cursor-pointer flex flex-col items-center justify-center gap-2 text-white/50 active:opacity-70 transition-opacity">
                        <span className="text-3xl">📷</span>
                        <span className="text-xs">{t("duels_wizard_cover_add")}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setGroupPhotoFile(file);
                              setGroupCoverTransform(DEFAULT_TRANSFORM);
                              const reader = new FileReader();
                              reader.onloadend = () => setGroupConfig({ ...groupConfig, photo: reader.result as string });
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                  {groupConfig.photo && (
                    <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{t("duels_cover_crop_hint")}</p>
                  )}
                </div>

                {/* Group Name */}
                <div className="space-y-2">
                  <label className={GLASS_LABEL_CLASS}>{t("duels_wizard_name_label")}</label>
                  <Input
                    value={groupConfig.name}
                    onChange={(e) => setGroupConfig({ ...groupConfig, name: e.target.value })}
                    placeholder={t("duels_wizard_name_placeholder")}
                    className={GLASS_FIELD_CLASS}
                    style={GLASS_FIELD_STYLE}
                  />
                </div>

                {/* Goal — opcional; a coluna `goal` é NOT NULL, então vazio grava "" */}
                <div className="space-y-2">
                  <label className={GLASS_LABEL_CLASS}>{t("duels_wizard_goal_label")}</label>
                  <Textarea
                    value={groupConfig.goal}
                    onChange={(e) => setGroupConfig({ ...groupConfig, goal: e.target.value })}
                    placeholder={t("duels_wizard_goal_placeholder")}
                    className={`min-h-20 ${GLASS_FIELD_CLASS}`}
                    style={GLASS_FIELD_STYLE}
                  />
                </div>

                <Button
                  onClick={() => {
                    if (groupConfig.name.trim()) {
                      setGroupStep(2);
                    } else {
                      toast({ title: t("duels_wizard_required_title"), description: t("duels_wizard_name_required"), variant: "destructive" });
                    }
                  }}
                  className="w-full rounded-full mt-4 border-0"
                  style={GLASS_PRIMARY_BTN_STYLE}
                >
                  {t("duels_wizard_next")}
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}

            {/* Step 2 — UF */}
            {groupStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className={GLASS_LABEL_CLASS}>{t("duels_wizard_state_label")}</label>
                  <Select value={groupConfig.location} onValueChange={(value) => setGroupConfig({ ...groupConfig, location: value })}>
                    <SelectTrigger className={`rounded-lg ${GLASS_FIELD_CLASS}`} style={GLASS_FIELD_STYLE}>
                      <SelectValue placeholder={t("duels_wizard_state_placeholder")} />
                    </SelectTrigger>
                    <SelectContent className="z-[500]">
                      <SelectItem value="AC">Acre (AC)</SelectItem>
                      <SelectItem value="AL">Alagoas (AL)</SelectItem>
                      <SelectItem value="AP">Amapá (AP)</SelectItem>
                      <SelectItem value="AM">Amazonas (AM)</SelectItem>
                      <SelectItem value="BA">Bahia (BA)</SelectItem>
                      <SelectItem value="CE">Ceará (CE)</SelectItem>
                      <SelectItem value="DF">Distrito Federal (DF)</SelectItem>
                      <SelectItem value="ES">Espírito Santo (ES)</SelectItem>
                      <SelectItem value="GO">Goiás (GO)</SelectItem>
                      <SelectItem value="MA">Maranhão (MA)</SelectItem>
                      <SelectItem value="MT">Mato Grosso (MT)</SelectItem>
                      <SelectItem value="MS">Mato Grosso do Sul (MS)</SelectItem>
                      <SelectItem value="MG">Minas Gerais (MG)</SelectItem>
                      <SelectItem value="PA">Pará (PA)</SelectItem>
                      <SelectItem value="PB">Paraíba (PB)</SelectItem>
                      <SelectItem value="PR">Paraná (PR)</SelectItem>
                      <SelectItem value="PE">Pernambuco (PE)</SelectItem>
                      <SelectItem value="PI">Piauí (PI)</SelectItem>
                      <SelectItem value="RJ">Rio de Janeiro (RJ)</SelectItem>
                      <SelectItem value="RN">Rio Grande do Norte (RN)</SelectItem>
                      <SelectItem value="RS">Rio Grande do Sul (RS)</SelectItem>
                      <SelectItem value="RO">Rondônia (RO)</SelectItem>
                      <SelectItem value="RR">Roraima (RR)</SelectItem>
                      <SelectItem value="SC">Santa Catarina (SC)</SelectItem>
                      <SelectItem value="SP">São Paulo (SP)</SelectItem>
                      <SelectItem value="SE">Sergipe (SE)</SelectItem>
                      <SelectItem value="TO">Tocantins (TO)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button onClick={() => setGroupStep(1)} variant="outline" className="flex-1 rounded-full bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white">{t("duels_wizard_back")}</Button>
                  <Button
                    onClick={() => {
                      if (groupConfig.location) {
                        setGroupStep(3);
                      } else {
                        toast({ title: t("duels_wizard_required_title"), description: t("duels_wizard_state_required"), variant: "destructive" });
                      }
                    }}
                    className="flex-1 rounded-full border-0"
                    style={GLASS_PRIMARY_BTN_STYLE}
                  >
                    {t("duels_wizard_next")} <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3 — Duração */}
            {groupStep === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className={GLASS_LABEL_CLASS}>{t("duels_wizard_duration_label")}</label>
                  <Select value={groupConfig.durationDays} onValueChange={(value) => setGroupConfig({ ...groupConfig, durationDays: value })}>
                    <SelectTrigger className={`rounded-lg ${GLASS_FIELD_CLASS}`} style={GLASS_FIELD_STYLE}>
                      <SelectValue placeholder={t("duels_wizard_duration_placeholder")} />
                    </SelectTrigger>
                    <SelectContent className="z-[500]">
                      {["30", "60", "90", "120", "180", "360"].map((d) => (
                        <SelectItem key={d} value={d}>{t("duels_wizard_duration_days").replace("{n}", d)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {groupConfig.durationDays && (
                    <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                      {t("duels_wizard_end_forecast").replace("{date}", (() => {
                        const d = new Date();
                        d.setDate(d.getDate() + parseInt(groupConfig.durationDays));
                        return d.toLocaleDateString(language === "pt" ? "pt-BR" : "en-US", { day: "2-digit", month: "long", year: "numeric" });
                      })())}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  <Button onClick={() => setGroupStep(2)} variant="outline" className="flex-1 rounded-full bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white">{t("duels_wizard_back")}</Button>
                  <Button
                    onClick={() => {
                      if (groupConfig.durationDays) {
                        setGroupStep(4);
                      } else {
                        toast({ title: t("duels_wizard_required_title"), description: t("duels_wizard_duration_required"), variant: "destructive" });
                      }
                    }}
                    className="flex-1 rounded-full border-0"
                    style={GLASS_PRIMARY_BTN_STYLE}
                  >
                    {t("duels_wizard_next")} <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4 — Sistema de Pontuação */}
            {groupStep === 4 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  {DUEL_SCORING_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setGroupConfig({ ...groupConfig, scoringType: opt.value })}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left"
                      style={groupConfig.scoringType === opt.value
                        ? { borderColor: "#5b8cff", background: "rgba(91,140,255,.12)" }
                        : { borderColor: "rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)" }}
                    >
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xl shrink-0" style={{ background: groupConfig.scoringType === opt.value ? "rgba(91,140,255,.2)" : "rgba(255,255,255,.06)" }}>
                        {opt.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">{t(opt.titleKey)}</p>
                        <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{t(opt.descKey)}</p>
                      </div>
                      <div className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors" style={groupConfig.scoringType === opt.value ? { borderColor: "#5b8cff", background: "#5b8cff" } : { borderColor: "rgba(255,255,255,.4)" }}>
                        {groupConfig.scoringType === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Meme rule input — shown only when memes is selected */}
                {groupConfig.scoringType === "memes" && (
                  <div className="space-y-2 pt-1">
                    <label className={GLASS_LABEL_CLASS}>{t("duels_wizard_meme_rule_label")}</label>
                    <Input
                      placeholder={t("duels_group_meme_rule_placeholder")}
                      value={groupConfig.memeRule}
                      onChange={(e) => setGroupConfig({ ...groupConfig, memeRule: e.target.value })}
                      maxLength={200}
                      className={GLASS_FIELD_CLASS}
                      style={GLASS_FIELD_STYLE}
                    />
                    <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{t("duels_group_meme_rule_hint")}</p>
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  <Button onClick={() => setGroupStep(3)} variant="outline" className="flex-1 rounded-full bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white">{t("duels_wizard_back")}</Button>
                  <Button
                    onClick={() => {
                      if (groupConfig.scoringType === "memes" && !groupConfig.memeRule.trim()) {
                        toast({ title: t("duels_wizard_required_title"), description: t("duels_group_meme_rule_required"), variant: "destructive" });
                        return;
                      }
                      setGroupStep(5);
                    }}
                    className="flex-1 rounded-full border-0"
                    style={GLASS_PRIMARY_BTN_STYLE}
                  >
                    {t("duels_wizard_next")} <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 5 — Convidar Participantes */}
            {groupStep === 5 && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="p-4 rounded-xl space-y-1" style={{ background: "rgba(91,140,255,.1)", border: "1px solid rgba(91,140,255,.25)" }}>
                  <p className="text-sm font-semibold text-brand">{groupConfig.name}</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                    {t("duels_wizard_summary_line").replace("{loc}", groupConfig.location).replace("{n}", groupConfig.durationDays)}
                  </p>
                  {groupConfig.goal.trim() && (
                    <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,.5)" }}>{groupConfig.goal}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className={GLASS_LABEL_CLASS}>{t("duels_wizard_invite_label").replace("{n}", String(selectedInvitees.size))}</label>
                    {followers.length > 0 && (
                      <Button
                        onClick={() => {
                          const filteredFollowers = followers.filter((f) =>
                            f.nickname.toLowerCase().includes(participantsSearch.toLowerCase())
                          );
                          if (selectedInvitees.size === filteredFollowers.length) {
                            setSelectedInvitees(new Set());
                          } else {
                            setSelectedInvitees(new Set(filteredFollowers.map(f => f.id)));
                          }
                        }}
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 text-white/70 hover:text-white hover:bg-white/10"
                      >
                        {selectedInvitees.size === followers.length ? t("duels_wizard_deselect_all") : t("duels_wizard_select_all")}
                      </Button>
                    )}
                  </div>

                  {followers.length > 0 && (
                    <Input
                      placeholder={t("duels_wizard_search_follower")}
                      value={participantsSearch}
                      onChange={(e) => setParticipantsSearch(e.target.value)}
                      className={`rounded-lg ${GLASS_FIELD_CLASS}`}
                      style={GLASS_FIELD_STYLE}
                    />
                  )}

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {followers.length > 0 ? (
                      followers
                        .filter((f) => f.nickname.toLowerCase().includes(participantsSearch.toLowerCase()))
                        .map((follower) => (
                          <button
                            key={follower.id}
                            onClick={() => {
                              const newSelected = new Set(selectedInvitees);
                              if (newSelected.has(follower.id)) {
                                newSelected.delete(follower.id);
                              } else {
                                newSelected.add(follower.id);
                              }
                              setSelectedInvitees(newSelected);
                            }}
                            className="w-full p-3 rounded-lg border transition-all text-left flex items-center gap-2"
                            style={selectedInvitees.has(follower.id)
                              ? { borderColor: "#5b8cff", background: "rgba(91,140,255,.12)" }
                              : { borderColor: "rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)" }}
                          >
                            <div className="h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0" style={selectedInvitees.has(follower.id) ? { background: "#5b8cff", borderColor: "#5b8cff" } : { borderColor: "rgba(255,255,255,.4)" }}>
                              {selectedInvitees.has(follower.id) && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate text-white">{follower.nickname}</div>
                            </div>
                          </button>
                        ))
                    ) : (
                      <div className="flex flex-col items-center gap-3 py-4">
                        <p className="text-sm text-center" style={{ color: "rgba(255,255,255,.5)" }}>{t("duels_wizard_no_following")}</p>
                        <Button variant="outline" size="sm" className="rounded-full gap-2 bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white" onClick={() => { setIsCreateGroupModalOpen(false); navigate("/buscar"); }}>
                          <Search className="h-4 w-4" />
                          {t("duels_wizard_search_users")}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => setGroupStep(4)} variant="outline" className="flex-1 rounded-full bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white">{t("duels_wizard_back")}</Button>
                  <Button
                    onClick={async () => {
                      if (!user || isCreatingGroup) return;
                      if (duelGateBlocked) {
                        setIsCreateGroupModalOpen(false);
                        setDuelPaywallOpen(true);
                        return;
                      }
                      setIsCreatingGroup(true);
                      try {
                        let endDate: string | undefined;
                        if (groupConfig.durationDays) {
                          const now = new Date();
                          now.setDate(now.getDate() + parseInt(groupConfig.durationDays));
                          endDate = now.toISOString();
                        }

                        const savedGroup = await createDuelGroupDb(
                          user.id,
                          groupConfig.name.trim(),
                          groupConfig.location,
                          // Meta é opcional, mas a coluna é NOT NULL: vazio grava "".
                          groupConfig.goal.trim(),
                          Array.from(selectedInvitees),
                          endDate,
                          groupConfig.scoringType,
                          groupConfig.memeRule || undefined
                        );

                        // Upload group photo if provided — after group ID is known
                        let photoUrl: string | null = null;
                        if (groupPhotoFile) {
                          try {
                            // Sobe o recorte que o usuário enquadrou no frame do
                            // Passo 1. As refs guardam a medida mesmo com o passo
                            // já desmontado; se nunca mediram, sobe o original.
                            const cw = groupCoverWRef.current;
                            const ch = groupCoverHRef.current;
                            const toUpload = groupConfig.photo && cw > 0 && ch > 0
                              ? new File(
                                  [await applyTransformToBlob(groupConfig.photo, groupCoverTransform, cw, ch)],
                                  "cover.jpg",
                                  { type: "image/jpeg" },
                                )
                              // Sem medida do frame não há recorte: o arquivo é o
                              // original do seletor, então encolhe antes de subir.
                              : await compressImageFile(groupPhotoFile);
                            photoUrl = await updateGroupPhotoDb(savedGroup.id, toUpload);
                          } catch (photoErr) {
                            console.error("Error uploading group photo:", photoErr);
                          }
                        }

                        const newGroup = {
                          ...savedGroup,
                          icon: "⚔️",
                          photo: photoUrl || null,
                          description: groupConfig.goal.trim(),
                          participants: selectedInvitees.size + 1,
                          city: groupConfig.location,
                          isOfficial: false,
                        };

                        // Reset form
                        setIsCreateGroupModalOpen(false);
                        setGroupConfig({ name: "", location: "", goal: "", durationDays: "", photo: "", scoringType: "check_in_count", memeRule: "" });
                        setGroupCoverTransform(DEFAULT_TRANSFORM);
                        setGroupPhotoFile(null);
                        setSelectedInvitees(new Set());
                        setGroupStep(1);

                        // Refresh groups list
                        getEnrichedDuelGroupsDb(user.id).then(({ myGroups }) => {
                          setUserCreatedGroups(myGroups.map((g: any) => ({
                            ...g, icon: "⚔️", description: g.goal, city: g.location, isOfficial: false,
                          })));
                        }).catch(console.error);

                        // Navigate to new group
                        setSelectedGroupForView(newGroup);
                        setActiveGroupViewTab("check-ins");
                        setGroupCheckIns([]);
                        setGroupParticipants([]);

                        toast({ title: t("duels_wizard_created_title"), description: t("duels_wizard_created_desc").replace("{name}", newGroup.name) });
                      } catch (err: any) {
                        toast({ title: t("duels_wizard_create_error"), description: err?.message || t("retry"), variant: "destructive" });
                      } finally {
                        setIsCreatingGroup(false);
                      }
                    }}
                    className="flex-1 rounded-full border-0"
                    style={GLASS_PRIMARY_BTN_STYLE}
                    disabled={isCreatingGroup}
                  >
                    {isCreatingGroup ? t("duels_wizard_creating") : t("duels_create")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Add Check-in Modal */}
      <Drawer
        open={isAddCheckInModalOpen}
        onOpenChange={setIsAddCheckInModalOpen}
      >
        <DrawerContent
          {...GLASS_SHEET_PROPS}
          style={GLASS_SHEET_STYLE}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DrawerHeader className="shrink-0">
            <DrawerTitle className="text-white">Adicionar Check-in</DrawerTitle>
            <DrawerDescription className="sr-only">Registre seu check-in de treino</DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="space-y-4">
              {/* Photo Upload Carousel */}
              <div className="space-y-2">
                <label className={GLASS_LABEL_CLASS}>Fotos do Treino ({checkInPhotoFiles.length})</label>
                <div className="relative border-2 border-dashed border-brand/40 rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,.03)" }}>
                  {checkInPhotoPreviewUrls.length > 0 ? (
                    <div className="space-y-3 p-4">
                      {/* Preview Carousel */}
                      <div className="relative group aspect-square rounded-lg overflow-hidden border border-white/10 bg-black/20">
                        <img
                          src={checkInPhotoPreviewUrls[activePhotoPreviewIndex]}
                          alt={`Preview ${activePhotoPreviewIndex + 1}`}
                          className="w-full h-full object-contain"
                        />

                        {/* Edit (crop) current photo */}
                        <button
                          onClick={() => {
                            const src = checkInPhotoPreviewUrls[activePhotoPreviewIndex];
                            if (src) {
                              setPendingCropIndex(activePhotoPreviewIndex);
                              setPendingCropSrc(src);
                            }
                          }}
                          className="absolute top-2 left-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full shadow-lg transition-colors"
                        >
                          <Crop className="h-4 w-4" />
                        </button>

                        {/* Remove Current Photo */}
                        <button
                          onClick={() => {
                            const newFiles = [...checkInPhotoFiles];
                            newFiles.splice(activePhotoPreviewIndex, 1);
                            setCheckInPhotoFiles(newFiles);
                            if (activePhotoPreviewIndex >= newFiles.length && newFiles.length > 0) {
                              setActivePhotoPreviewIndex(newFiles.length - 1);
                            }
                          }}
                          className="absolute top-2 right-2 bg-destructive/80 hover:bg-destructive text-white p-1.5 rounded-full shadow-lg transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>

                        {/* Navigation */}
                        {checkInPhotoPreviewUrls.length > 1 && (
                          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                            {checkInPhotoPreviewUrls.map((_, i) => (
                              <div
                                key={i}
                                className={`h-1.5 rounded-full transition-all ${i === activePhotoPreviewIndex ? "w-4 bg-brand" : "w-1.5 bg-brand/30"}`}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Thumbnails + Add More */}
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {checkInPhotoPreviewUrls.map((url, i) => (
                          <button
                            key={i}
                            data-thumb-index={i}
                            onClick={() => {
                              if (!thumbDragState.current?.started) setActivePhotoPreviewIndex(i);
                            }}
                            onTouchStart={(e) => {
                              const touch = e.touches[0];
                              thumbDragState.current = { index: i, started: false, startX: touch.clientX, startY: touch.clientY };
                            }}
                            onTouchMove={(e) => {
                              if (!thumbDragState.current) return;
                              const touch = e.touches[0];
                              if (!thumbDragState.current.started) {
                                const dx = Math.abs(touch.clientX - thumbDragState.current.startX);
                                const dy = Math.abs(touch.clientY - thumbDragState.current.startY);
                                if (dx < 8 && dy < 8) return;
                                thumbDragState.current.started = true;
                                setDraggingThumbIndex(thumbDragState.current.index);
                                setDragOverThumbIndex(thumbDragState.current.index);
                              }
                              const el = document.elementFromPoint(touch.clientX, touch.clientY);
                              const thumbEl = el?.closest('[data-thumb-index]') as HTMLElement | null;
                              if (thumbEl) {
                                const idx = parseInt(thumbEl.dataset.thumbIndex!, 10);
                                if (!isNaN(idx)) {
                                  thumbDragOverRef.current = idx;
                                  setDragOverThumbIndex(idx);
                                }
                              }
                            }}
                            onTouchEnd={() => {
                              if (thumbDragState.current?.started) {
                                const fromIndex = thumbDragState.current.index;
                                const toIndex = thumbDragOverRef.current;
                                if (toIndex !== null && fromIndex !== toIndex) {
                                  const newFiles = [...checkInPhotoFiles];
                                  const [removed] = newFiles.splice(fromIndex, 1);
                                  newFiles.splice(toIndex, 0, removed);
                                  setCheckInPhotoFiles(newFiles);
                                  setActivePhotoPreviewIndex(toIndex);
                                }
                              }
                              thumbDragState.current = null;
                              thumbDragOverRef.current = null;
                              setDraggingThumbIndex(null);
                              setDragOverThumbIndex(null);
                            }}
                            className={`relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all select-none ${
                              i === draggingThumbIndex
                                ? "opacity-40 scale-90 border-brand"
                                : i === dragOverThumbIndex && draggingThumbIndex !== null
                                ? "border-brand scale-105 ring-2 ring-brand/50"
                                : i === activePhotoPreviewIndex
                                ? "border-brand scale-95"
                                : "border-transparent opacity-60"
                            }`}
                          >
                            <img src={url} alt={`Thumb ${i}`} className="w-full h-full object-cover" />
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => checkInCameraInputRef.current?.click()}
                          className="shrink-0 w-14 h-14 rounded-lg border-2 border-dashed border-brand/40 flex items-center justify-center cursor-pointer hover:bg-brand/5"
                          title={t("duels_checkin_camera")}
                        >
                          <Camera className="h-5 w-5 text-brand" />
                        </button>
                        <button
                          type="button"
                          onClick={() => checkInGalleryInputRef.current?.click()}
                          className="shrink-0 w-14 h-14 rounded-lg border-2 border-dashed border-brand/40 flex items-center justify-center cursor-pointer hover:bg-brand/5"
                          title={t("duels_checkin_gallery")}
                        >
                          <Image className="h-5 w-5 text-brand" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center">
                        <Plus className="h-8 w-8 text-brand" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-white">Adicionar Fotos</p>
                        <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,.5)" }}>{t("duels_checkin_photo_hint")}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-full text-xs h-9 px-4 bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white"
                          onClick={() => checkInCameraInputRef.current?.click()}
                        >
                          <Camera className="h-4 w-4 mr-1.5" />
                          {t("duels_checkin_camera")}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-full text-xs h-9 px-4 bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white"
                          onClick={() => checkInGalleryInputRef.current?.click()}
                        >
                          <Image className="h-4 w-4 mr-1.5" />
                          {t("duels_checkin_gallery")}
                        </Button>
                      </div>
                    </div>
                  )}
                  {/* Front camera capture mirrors the resulting photo on iOS WebKit;
                      forcing the rear camera here (matches NewPost.tsx) avoids it. */}
                  <input
                    ref={checkInCameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleCheckInPhotoSelected}
                    className="hidden"
                  />
                  <input
                    ref={checkInGalleryInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCheckInPhotoSelected}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className={GLASS_LABEL_CLASS}>Descrição</label>
                <Textarea
                  value={checkInForm.description}
                  onChange={(e) =>
                    setCheckInForm({ ...checkInForm, description: e.target.value })
                  }
                  placeholder="Como foi seu treino? Deixe uma mensagem..."
                  className={`min-h-20 ${GLASS_FIELD_CLASS}`}
                  style={GLASS_FIELD_STYLE}
                />
              </div>

              {/* Completed Routine Selector */}
              <div className="space-y-2">
                <label className={GLASS_LABEL_CLASS}>O que você treinou? *</label>
                {isLoadingRoutines ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <div key={i} className="animate-pulse rounded-xl p-3" style={GLASS_PANEL_STYLE}>
                        <div className="flex gap-3">
                          <div className="w-5 h-5 rounded-full bg-white/10 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3 bg-white/10 rounded w-2/3" />
                            <div className="h-2 bg-white/10 rounded w-1/3" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : completedRoutines.length === 0 ? (
                  <div className="rounded-xl p-4 text-center space-y-3" style={GLASS_PANEL_STYLE}>
                    <div>
                      <p className="text-sm font-medium text-white">{t("duels_checkin_no_routines_title")}</p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,.5)" }}>{t("duels_checkin_no_routines_subtitle")}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full text-xs h-8 px-4 bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white"
                      onClick={() => {
                        setIsAddCheckInModalOpen(false);
                        navigate("/metas");
                      }}
                    >
                      {t("duels_checkin_goto_goals")}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {completedRoutines.map((routine, idx) => {
                      const key = String(idx);
                      const isSelected = selectedRoutineKey === key;
                      const completedDate = new Date(routine.completedAt);
                      const today = new Date();
                      const isToday = completedDate.toDateString() === today.toDateString();
                      const dateLabel = isToday
                        ? "Hoje " + completedDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                        : completedDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) + " " + completedDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                      const alreadyCheckedIn = checkedInRoutineDayKeys.has(routineDayKey(routine.routineName, routine.completedAt));

                      return (
                        <button
                          key={key}
                          onClick={() => {
                            if (alreadyCheckedIn) {
                              toast({ title: t("duels_checkin_duplicate_error_title"), description: t("duels_checkin_duplicate_error_desc"), variant: "destructive" });
                              return;
                            }
                            setSelectedRoutineKey(isSelected ? null : key);
                            // Duelo pontuado por CALORIAS: o treino já registrou
                            // o gasto ao ser finalizado, então o campo obrigatório
                            // vem preenchido em vez de exigir que a pessoa lembre
                            // o número. Continua editável.
                            if (
                              !isSelected &&
                              selectedGroupForView?.scoringType === "calories" &&
                              routine.caloriesKcal != null
                            ) {
                              setCheckInMetricValue(String(Math.round(routine.caloriesKcal)));
                            }
                          }}
                          className={`w-full text-left rounded-xl border overflow-hidden transition-colors ${alreadyCheckedIn ? "cursor-not-allowed" : ""}`}
                          style={alreadyCheckedIn
                            ? { borderColor: "rgba(255,255,255,.08)", background: "rgba(255,255,255,.02)", opacity: 0.55 }
                            : isSelected
                            ? { borderColor: "#5b8cff", background: "rgba(91,140,255,.1)" }
                            : { borderColor: "rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)" }}
                        >
                          <div className="flex items-start gap-3 px-3 py-2.5">
                            <div className="shrink-0 mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors" style={isSelected ? { borderColor: "#5b8cff", background: "#5b8cff" } : { borderColor: "rgba(255,255,255,.3)" }}>
                              {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate text-white">{routine.routineName}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {routine.primaryMuscleGroup && (
                                  <span className="text-xs bg-brand/15 text-brand px-1.5 py-0.5 rounded-full">{routine.primaryMuscleGroup}</span>
                                )}
                                <span className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{routine.exercises.length} exerc. · {dateLabel}</span>
                                {alreadyCheckedIn && (
                                  <span className="text-xs flex items-center gap-1" style={{ color: "rgba(255,255,255,.45)" }}>
                                    <CheckCircle2 className="h-3 w-3" />
                                    {t("duels_checkin_already_posted")}
                                  </span>
                                )}
                              </div>
                              {/* Exercise list preview */}
                              <div className="mt-1.5 space-y-0.5">
                                {routine.exercises.slice(0, 3).map((ex, i) => (
                                  <p key={i} className="text-xs truncate" style={{ color: "rgba(255,255,255,.5)" }}>• {ex.workoutName}{ex.kilos ? ` — ${ex.kilos}kg` : ""}</p>
                                ))}
                                {routine.exercises.length > 3 && (
                                  <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>+{routine.exercises.length - 3} mais</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Metric input for scoring types that need manual value */}
              {selectedGroupForView?.scoringType && ["duration", "distance", "steps", "calories"].includes(selectedGroupForView.scoringType) && (() => {
                const metricConfig = {
                  duration:  { label: "Duração do treino *",   placeholder: "Ex: 45",  unit: "min",    type: "number" },
                  distance:  { label: "Distância percorrida *", placeholder: "Ex: 5.2", unit: "km",     type: "number" },
                  steps:     { label: "Passos dados *",         placeholder: "Ex: 8000", unit: "passos", type: "number" },
                  calories:  { label: "Calorias queimadas *",   placeholder: "Ex: 350", unit: "kcal",   type: "number" },
                }[selectedGroupForView.scoringType as "duration" | "distance" | "steps" | "calories"];
                return (
                  <div className="space-y-2">
                    <label className={GLASS_LABEL_CLASS}>{metricConfig?.label}</label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        placeholder={metricConfig?.placeholder}
                        value={checkInMetricValue}
                        onChange={(e) => setCheckInMetricValue(e.target.value)}
                        className={`flex-1 ${GLASS_FIELD_CLASS}`}
                        style={GLASS_FIELD_STYLE}
                      />
                      <span className="text-sm shrink-0" style={{ color: "rgba(255,255,255,.5)" }}>{metricConfig?.unit}</span>
                    </div>
                  </div>
                );
              })()}

              <Button
                onClick={async () => {
                  if (!user || !selectedGroupForView || isSubmittingCheckIn) return;
                  if (!selectedRoutineKey) {
                    toast({ title: "Selecione um treino", description: "Escolha o treino que você realizou", variant: "destructive" });
                    return;
                  }
                  const routineToSubmit = completedRoutines[parseInt(selectedRoutineKey)];
                  if (routineToSubmit && checkedInRoutineDayKeys.has(routineDayKey(routineToSubmit.routineName, routineToSubmit.completedAt))) {
                    toast({ title: t("duels_checkin_duplicate_error_title"), description: t("duels_checkin_duplicate_error_desc"), variant: "destructive" });
                    return;
                  }
                  const needsMetric = ["duration", "distance", "steps", "calories"].includes(selectedGroupForView.scoringType || "");
                  if (needsMetric && !checkInMetricValue) {
                    toast({ title: "Campo obrigatório", description: "Informe o valor da métrica para este desafio", variant: "destructive" });
                    return;
                  }
                  setIsSubmittingCheckIn(true);
                  try {
                    const selectedRoutine = completedRoutines[parseInt(selectedRoutineKey)];
                    const exerciseName = selectedRoutine?.routineName || "Treino";

                    // Upload all photos to storage
                    const uploadedUrls: string[] = [];
                    for (let i = 0; i < checkInPhotoFiles.length; i++) {
                      const file = checkInPhotoFiles[i];
                      const timestamp = Date.now();
                      const extension = file.name.split(".").pop() || "jpg";
                      const filePath = `checkins/${user.id}/${timestamp}-${i}.${extension}`;

                      const { error: uploadError } = await supabase.storage
                        .from("posts") // Re-using the posts bucket
                        .upload(filePath, file, {
                          contentType: file.type,
                          upsert: false,
                        });

                      if (!uploadError) {
                        const { data: urlData } = supabase.storage
                          .from("posts")
                          .getPublicUrl(filePath);
                        uploadedUrls.push(urlData.publicUrl);
                      }
                    }

                    const metricVal = checkInMetricValue ? parseFloat(checkInMetricValue) : null;
                    const scoringType = selectedGroupForView.scoringType || "check_in_count";
                    // No photo uploaded → fall back to the default check-in
                    // mascot image instead of leaving the photo slot empty.
                    const finalPhotos = uploadedUrls.length > 0 ? uploadedUrls : [DEFAULT_CHECKIN_PHOTO];
                    const checkIn = await addGroupCheckInDb(
                      selectedGroupForView.id,
                      user.id,
                      finalPhotos[0],
                      checkInForm.description,
                      exerciseName,
                      selectedRoutine?.totalSeries || 0,
                      selectedRoutine?.totalVolume || 0,
                      selectedRoutine?.primaryMuscleGroup || null,
                      selectedRoutine?.exercises || [],
                      finalPhotos,
                      scoringType === "duration" ? metricVal : null,
                      scoringType === "distance" ? metricVal : null,
                      scoringType === "steps" ? metricVal : null,
                      scoringType === "calories" ? metricVal : null,
                      selectedRoutine?.completedAt || null,
                    );

                    setGroupCheckIns((prev) => [checkIn, ...prev]);
                    setIsAddCheckInModalOpen(false);
                    setCheckInForm({ photo: "", photos: [], description: "", workoutId: "" });
                    setCheckInPhotoFiles([]);
                    setCheckInPhotoPreviewUrls([]);
                    setActivePhotoPreviewIndex(0);
                    setSelectedRoutineKey(null);
                    setCheckInMetricValue("");

                    toast({
                      title: "Check-in adicionado!",
                      description: "Seu check-in foi registrado com sucesso.",
                    });
                  } catch (err: any) {
                    toast({
                      title: "Erro ao adicionar check-in",
                      description: err.message || "Tente novamente",
                      variant: "destructive",
                    });
                  } finally {
                    setIsSubmittingCheckIn(false);
                  }
                }}
                className="w-full rounded-full border-0"
                style={GLASS_PRIMARY_BTN_STYLE}
                disabled={!selectedRoutineKey || !user || isSubmittingCheckIn}
              >
                Adicionar Check-in
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Image Cropper for Check-in photos */}
      <ImageCropperDrawer
        imageSrc={pendingCropSrc}
        aspectRatio={1}
        onConfirm={(_dataUrl, blob) => {
          const file = new File([blob], `checkin-${Date.now()}.jpg`, { type: "image/jpeg" });
          if (pendingCropIndex === -1) {
            setCheckInPhotoFiles(prev => {
              const next = [...prev, file];
              setActivePhotoPreviewIndex(next.length - 1);
              return next;
            });
          } else {
            setCheckInPhotoFiles(prev => {
              const next = [...prev];
              next[pendingCropIndex] = file;
              return next;
            });
          }
          setPendingCropSrc(null);
          setPendingCropIndex(-1);
        }}
        onCancel={() => {
          setPendingCropSrc(null);
          setPendingCropIndex(-1);
        }}
      />

      {/* Reaction Viewer — who reacted with a specific emoji. Same z-index
          fix as the Participant Details Modal below: the base DrawerContent
          defaults to z-[310] with a z-[300] overlay (see
          client/components/ui/drawer.tsx) — the old z-[110] here put this
          drawer's own content *under* its own backdrop. */}
      <Drawer open={!!reactionViewerState} onOpenChange={(open) => { if (!open) setReactionViewerState(null); }}>
        <DrawerContent
          {...GLASS_SHEET_PROPS}
          className="flex flex-col !rounded-t-[32px] !border-0 z-[330]"
          overlayClassName="z-[320]"
          style={{ ...GLASS_SHEET_STYLE, maxHeight: "60dvh" }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {reactionViewerState && (
            <>
              <DrawerHeader className="shrink-0">
                <DrawerTitle className="text-base flex items-center gap-2 text-white">
                  <span className="text-xl">{reactionViewerState.emoji}</span>
                  {!reactionViewerState.loading && (
                    <span>{reactionViewerState.users.filter(u => u.emoji === reactionViewerState.emoji).length} {reactionViewerState.users.filter(u => u.emoji === reactionViewerState.emoji).length === 1 ? "reação" : "reações"}</span>
                  )}
                </DrawerTitle>
                <DrawerDescription className="sr-only">Pessoas que reagiram</DrawerDescription>
              </DrawerHeader>
              <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
                {reactionViewerState.loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 animate-pulse">
                        <div className="w-9 h-9 rounded-full bg-white/10 flex-shrink-0" />
                        <div className="h-3 bg-white/10 rounded w-28" />
                      </div>
                    ))}
                  </div>
                ) : (
                  reactionViewerState.users
                    .filter(u => u.emoji === reactionViewerState.emoji)
                    .map((u) => (
                      <div key={u.userId} className="flex items-center gap-3">
                        <UserAvatar
                          photo={u.userPhoto}
                          nickname={u.userName}
                          className="w-9 h-9 flex-shrink-0"
                        />
                        <span className="text-sm font-medium text-white">{u.userName}</span>
                      </div>
                    ))
                )}
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>

      {/* Check-in Detail Modal */}
      <Drawer open={isCheckInDetailOpen} onOpenChange={setIsCheckInDetailOpen}>
        <DrawerContent
          {...GLASS_SHEET_PROPS}
          style={{ ...GLASS_SHEET_STYLE, maxHeight: "80dvh" }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DrawerHeader className="shrink-0 flex items-center justify-between">
            <DrawerTitle className="text-white">Detalhes do Check-in</DrawerTitle>
            <DrawerDescription className="sr-only">Veja detalhes e comentários do check-in</DrawerDescription>
            {selectedCheckInForDetail && selectedCheckInForDetail.userId === user?.id && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (selectedCheckInForDetail) {
                      setIsEditCheckInOpen(true);
                    }
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  title="Editar check-in"
                >
                  <Edit3 className="h-4 w-4 text-white/60 hover:text-white" />
                </button>
                <button
                  onClick={() => {
                    if (selectedCheckInForDetail) {
                      showConfirm(
                        "Excluir check-in",
                        "Tem certeza que deseja excluir este check-in? Esta ação é irreversível.",
                        async () => {
                          try {
                            await deleteGroupCheckInDb(selectedCheckInForDetail.id);
                            setGroupCheckIns(groupCheckIns.filter((c) => c.id !== selectedCheckInForDetail.id));
                            setIsCheckInDetailOpen(false);
                            toast({ title: "Check-in excluído!", description: "O check-in foi removido com sucesso." });
                          } catch (error: any) {
                            toast({ title: "Erro ao excluir check-in", description: error.message || "Tente novamente.", variant: "destructive" });
                          }
                        },
                      );
                    }
                  }}
                  className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                  title="Excluir check-in"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              </div>
            )}
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {selectedCheckInForDetail && (
              <div className="space-y-3">
                {/* User + meta inline */}
                <div className="flex items-center gap-2">
                  <UserAvatar
                    photo={selectedCheckInForDetail.userPhoto}
                    nickname={selectedCheckInForDetail.userName}
                    className="h-8 w-8 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold truncate text-white">{selectedCheckInForDetail.userName}</span>
                      {selectedCheckInForDetail.muscleGroups.map((mg) => (
                        <span key={mg} className="text-[10px] bg-brand/15 text-brand px-1 py-0.5 rounded-full shrink-0 leading-none">{mg}</span>
                      ))}
                    </div>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                      {new Date(selectedCheckInForDetail.createdAt).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} · {new Date(selectedCheckInForDetail.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>

                {/* Photo — Carousel support for multiple images */}
                {(selectedCheckInForDetail.photos?.length || 0) > 0 ? (
                  <PostCarousel
                    photos={selectedCheckInForDetail.photos || [selectedCheckInForDetail.photo]}
                    alt="check-in"
                    objectFit="contain"
                    priority
                  />
                ) : selectedCheckInForDetail.photo ? (
                  <div className="relative rounded-2xl overflow-hidden aspect-square md:aspect-auto md:h-[400px] bg-slate-950/40 flex-shrink-0 flex items-center justify-center">
                    <img
                      src={selectedCheckInForDetail.photo}
                      alt="check-in"
                      className="max-w-full max-h-full w-auto h-auto object-contain"
                    />
                  </div>
                ) : null}

                {/* Description */}
                {selectedCheckInForDetail.description && (
                  <p className="text-sm" style={{ color: "rgba(255,255,255,.85)" }}>{selectedCheckInForDetail.description}</p>
                )}

                {/* Rotina + stats numa linha */}
                <div className="flex items-center gap-3 py-1" style={{ borderTop: "1px solid rgba(255,255,255,.1)" }}>
                  <span className="text-xs shrink-0" style={{ color: "rgba(255,255,255,.5)" }}>Rotina</span>
                  <span className="text-xs font-medium text-brand truncate flex-1">{selectedCheckInForDetail.workoutInfo}</span>
                  {selectedCheckInForDetail.exercises?.length > 0 && (
                    <span className="text-xs shrink-0" style={{ color: "rgba(255,255,255,.5)" }}>{selectedCheckInForDetail.exercises.length} exerc.</span>
                  )}
                  {selectedCheckInForDetail.volume > 0 && (
                    <span className="text-xs shrink-0" style={{ color: "rgba(255,255,255,.5)" }}>{selectedCheckInForDetail.volume}kg</span>
                  )}
                </div>

                {/* Exercises list — grouped */}
                {selectedCheckInForDetail.exercises && selectedCheckInForDetail.exercises.length > 0 && (() => {
                  const grouped: { name: string; sets: string[] }[] = [];
                  for (const ex of selectedCheckInForDetail.exercises) {
                    const existing = grouped.find(g => g.name === ex.workoutName);
                    if (existing) {
                      if (ex.kilos) existing.sets.push(`${ex.kilos}kg`);
                    } else {
                      grouped.push({ name: ex.workoutName, sets: ex.kilos ? [`${ex.kilos}kg`] : [] });
                    }
                  }
                  return (
                    <div className="space-y-2 pt-0.5">
                      {grouped.map((ex, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-xs flex-1 leading-5 truncate" style={{ color: "rgba(255,255,255,.7)" }}>{ex.name}</span>
                          {ex.sets.length > 0 && (
                            <div className="flex flex-wrap gap-1 justify-end shrink-0 max-w-[55%]">
                              {ex.sets.map((s, j) => (
                                <span key={j} className="text-[10px] font-medium text-brand bg-brand/15 rounded px-1.5 py-0.5 leading-none">{s}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Memes voting section — shown in detail view */}
                {selectedGroupForView?.scoringType === "memes" && selectedCheckInForDetail && (() => {
                  const votes = checkInVotes.filter((v) => v.checkInId === selectedCheckInForDetail.id);
                  const classifyCount = votes.filter((v) => v.voteType === "classify").length;
                  const disqualifyCount = votes.filter((v) => v.voteType === "disqualify").length;
                  const userVote = votes.find((v) => v.userId === user?.id)?.voteType ?? null;
                  const disqualified = disqualifyCount > classifyCount && disqualifyCount > 0;
                  const isOwn = selectedCheckInForDetail.userId === user?.id;
                  return (
                    <div className="py-3 space-y-2" style={{ borderTop: "1px solid rgba(255,255,255,.1)" }}>
                      {selectedGroupForView.memeRule && (
                        <div className="flex items-start gap-2 p-2.5 rounded-lg" style={GLASS_PANEL_STYLE}>
                          <span className="text-base shrink-0">🎭</span>
                          <p className="text-xs" style={{ color: "rgba(255,255,255,.6)" }}>{selectedGroupForView.memeRule}</p>
                        </div>
                      )}
                      {disqualified && (
                        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                          <XCircle className="h-4 w-4 text-destructive shrink-0" />
                          <p className="text-xs font-semibold text-destructive">
                            {t("duels_group_annulled_detail")
                              .replace("{dq}", formatAnnulments(disqualifyCount))
                              .replace("{cl}", formatApprovals(classifyCount))}
                          </p>
                        </div>
                      )}
                      {!isOwn && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const next: DuelCheckInVoteType | null = userVote === "classify" ? null : "classify";
                              setCheckInVotes((prev) => {
                                const filtered = prev.filter((v) => !(v.checkInId === selectedCheckInForDetail.id && v.userId === user!.id));
                                return next ? [...filtered, { checkInId: selectedCheckInForDetail.id, userId: user!.id, voteType: next }] : filtered;
                              });
                              setCheckInVoteDb(selectedCheckInForDetail.id, next).catch(() => {
                                getCheckInVotesDb(selectedGroupForView.id).then(setCheckInVotes).catch(() => {});
                              });
                            }}
                            aria-label="Aprovar check-in"
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-colors ${userVote === "classify" ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-400" : "bg-white/5 border-white/15 text-white/60 hover:border-emerald-500/40 hover:text-emerald-400"}`}
                          >
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            Aprovar
                            {classifyCount > 0 && <span className="text-xs opacity-70">({classifyCount})</span>}
                          </button>
                          <button
                            onClick={() => {
                              const next: DuelCheckInVoteType | null = userVote === "disqualify" ? null : "disqualify";
                              setCheckInVotes((prev) => {
                                const filtered = prev.filter((v) => !(v.checkInId === selectedCheckInForDetail.id && v.userId === user!.id));
                                return next ? [...filtered, { checkInId: selectedCheckInForDetail.id, userId: user!.id, voteType: next }] : filtered;
                              });
                              setCheckInVoteDb(selectedCheckInForDetail.id, next).catch(() => {
                                getCheckInVotesDb(selectedGroupForView.id).then(setCheckInVotes).catch(() => {});
                              });
                            }}
                            aria-label="Anular check-in"
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-colors ${userVote === "disqualify" ? "bg-destructive/15 border-destructive/50 text-destructive" : "bg-white/5 border-white/15 text-white/60 hover:border-destructive/40 hover:text-destructive"}`}
                          >
                            <XCircle className="h-4 w-4 shrink-0" />
                            Anular
                            {disqualifyCount > 0 && <span className="text-xs opacity-70">({disqualifyCount})</span>}
                          </button>
                        </div>
                      )}
                      {isOwn && (
                        <div className="flex gap-4 text-sm text-white/60">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            {formatApprovals(classifyCount)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <XCircle className="h-4 w-4 text-destructive" />
                            {formatAnnulments(disqualifyCount)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Comments Section */}
                <div className="pt-2 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,.1)" }}>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,.5)" }}>
                    Comentários {checkInComments.length > 0 ? `(${checkInComments.length})` : ""}
                  </p>

                  {isLoadingComments ? (
                    <div className="space-y-2">
                      {[1, 2].map((i) => (
                        <div key={i} className="animate-pulse flex gap-2">
                          <div className="w-7 h-7 rounded-full bg-white/10 flex-shrink-0" />
                          <div className="flex-1 space-y-1">
                            <div className="h-2.5 bg-white/10 rounded w-1/4" />
                            <div className="h-2 bg-white/10 rounded w-3/4" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : checkInComments.length > 0 ? (
                    <div className="space-y-2.5">
                      {checkInComments.map((comment) => (
                        <div key={comment.id} className="flex gap-2">
                          <UserAvatar
                            photo={comment.userPhoto}
                            nickname={comment.userNickname}
                            className="w-7 h-7 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <div className="flex items-baseline gap-1.5 flex-wrap flex-1 min-w-0">
                                <span className="text-xs font-semibold text-white">{comment.userNickname}</span>
                                <span className="text-[10px]" style={{ color: "rgba(255,255,255,.4)" }}>{new Date(comment.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                              </div>
                              {user?.id === comment.userId && editingCommentId !== comment.id && (
                                <div className="flex shrink-0 gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditComment(comment)}
                                    className="rounded-lg p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                                    aria-label="Editar comentário"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCheckInComment(comment.id)}
                                    disabled={deletingCommentId === comment.id}
                                    className="rounded-lg p-1 text-white/50 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50 disabled:cursor-not-allowed"
                                    aria-label={t("comments_delete_title")}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                            {editingCommentId === comment.id ? (
                              <div className="mt-1 flex flex-col gap-1.5">
                                <textarea
                                  value={editCommentDraft}
                                  onChange={(e) => setEditCommentDraft(e.target.value)}
                                  className="w-full resize-none rounded-md px-2 py-1.5 text-xs text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-ring min-h-14"
                                  style={GLASS_FIELD_STYLE}
                                  disabled={isSavingEditComment}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey && editCommentDraft.trim()) {
                                      e.preventDefault();
                                      handleSaveEditComment(comment.id);
                                    }
                                    if (e.key === "Escape") handleCancelEditComment();
                                  }}
                                />
                                <div className="flex gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditComment(comment.id)}
                                    disabled={!editCommentDraft.trim() || isSavingEditComment}
                                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                  >
                                    <Check className="h-3 w-3" />
                                    Salvar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCancelEditComment}
                                    disabled={isSavingEditComment}
                                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium bg-white/10 text-white/70 hover:bg-white/20 disabled:opacity-50 transition-colors"
                                  >
                                    <X className="h-3 w-3" />
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs break-words" style={{ color: "rgba(255,255,255,.85)" }}>{comment.text}</p>
                            )}
                            <CommentReactions commentType="checkin" commentId={comment.id} commentOwnerId={comment.userId} sourceId={selectedCheckInForDetail?.id} isOwnComment={!!(user?.id === comment.userId)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{t("comments_empty")}</p>
                  )}

                </div>
              </div>
            )}
          </div>

          {/* Input de comentário — rodapé fixo, FORA do container rolável.
              Dentro do scroll, o lift do teclado erguia a folha mas nada rolava
              até o campo: ele só aparecia quando o WebKit levava o cursor à
              vista, na primeira tecla. Colado na borda inferior da folha, subir
              a folha já basta — mesmo padrão de post-comments-dialog e
              promotion-comments-drawer. */}
          {selectedCheckInForDetail && (
            <div
              className="shrink-0 flex gap-2 items-center px-4 pt-2.5 pb-4"
              style={{ borderTop: "1px solid rgba(255,255,255,.1)" }}
            >
              <Input
                placeholder={t("comments_placeholder")}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendComment(selectedCheckInForDetail.id);
                  }
                }}
                className={`rounded-full text-xs h-9 ${GLASS_FIELD_CLASS}`}
                style={GLASS_FIELD_STYLE}
                disabled={isSendingComment}
              />
              <Button
                size="sm"
                className="rounded-full flex-shrink-0 h-9 w-9 p-0 border-0"
                style={GLASS_PRIMARY_BTN_STYLE}
                disabled={!commentText.trim() || isSendingComment}
                onClick={() => handleSendComment(selectedCheckInForDetail.id)}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* Group Details Modal */}
      <Drawer open={isGroupDetailsOpen} onOpenChange={(open) => { setIsGroupDetailsOpen(open); if (!open) setIsEditingGroupInfo(false); }}>
        <DrawerContent
          {...GLASS_SHEET_PROPS}
          style={{ ...GLASS_SHEET_STYLE, maxHeight: "80dvh" }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DrawerHeader className="shrink-0 flex flex-row items-center justify-between pr-4">
            <div>
              <DrawerTitle className="text-white">{t("duels_group_details_title")}</DrawerTitle>
              <DrawerDescription className="sr-only">{t("duels_group_details_desc")}</DrawerDescription>
            </div>
            {selectedGroupForView?.createdBy === user?.id && !isEditingGroupInfo && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-white/60 hover:text-white hover:bg-white/10"
                onClick={() => {
                  setEditGroupName(selectedGroupForView.name);
                  setEditGroupGoal(selectedGroupForView.goal ?? "");
                  setEditGroupRule(selectedGroupForView.memeRule ?? "");
                  setIsEditingGroupInfo(true);
                }}
              >
                <Edit3 className="h-3.5 w-3.5" />
                {t("duels_group_edit")}
              </Button>
            )}
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {selectedGroupForView && (
              <div className="space-y-4">
                {/* Group Name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">{t("duels_group_name_label")}</label>
                  {isEditingGroupInfo ? (
                    <Input
                      value={editGroupName}
                      onChange={(e) => setEditGroupName(e.target.value)}
                      className="rounded-lg"
                      maxLength={80}
                    />
                  ) : (
                    <div className="p-3 rounded-lg bg-muted/20">
                      <p className="text-sm font-medium">{selectedGroupForView.name}</p>
                    </div>
                  )}
                </div>

                {/* Location */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">{t("duels_group_location_label")}</label>
                  <div className="p-3 rounded-lg bg-muted/20">
                    <p className="text-sm">📍 {selectedGroupForView.city}</p>
                  </div>
                </div>

                {/* Goal */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">{t("duels_group_goal_label")}</label>
                  {isEditingGroupInfo ? (
                    <Textarea
                      value={editGroupGoal}
                      onChange={(e) => setEditGroupGoal(e.target.value)}
                      className="rounded-lg resize-none"
                      rows={3}
                      maxLength={300}
                    />
                  ) : (
                    <div className="p-3 rounded-lg bg-muted/20">
                      {/* Meta é opcional — sem ela, a caixa ficaria vazia. */}
                      {selectedGroupForView.goal?.trim() ? (
                        <p className="text-sm">{selectedGroupForView.goal}</p>
                      ) : (
                        <p className="text-sm italic text-muted-foreground">{t("duels_group_no_goal")}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Modality — scoring type used by the group */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">{t("duels_group_modality_label")}</label>
                  <div className="p-3 rounded-lg bg-muted/20 flex items-center gap-2.5">
                    {(() => {
                      const opt = DUEL_SCORING_TYPE_OPTIONS.find((o) => o.value === (selectedGroupForView.scoringType || "check_in_count")) ?? DUEL_SCORING_TYPE_OPTIONS[0];
                      return (
                        <>
                          <span className="text-base leading-none">{opt.icon}</span>
                          <p className="text-sm font-medium">{t(opt.titleKey)}</p>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Regra do desafio — só existe na modalidade memes. Em edição o
                    campo aparece mesmo sem regra salva, para poder preencher. */}
                {selectedGroupForView?.scoringType === "memes" && (isEditingGroupInfo || selectedGroupForView?.memeRule) && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">{t("duels_group_meme_rule_label")}</label>
                    {isEditingGroupInfo ? (
                      <>
                        <Textarea
                          value={editGroupRule}
                          onChange={(e) => setEditGroupRule(e.target.value)}
                          placeholder={t("duels_group_meme_rule_placeholder")}
                          className="rounded-lg resize-none"
                          rows={2}
                          maxLength={200}
                        />
                        <p className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{t("duels_group_meme_rule_hint")}</p>
                      </>
                    ) : (
                      <div className="p-3 rounded-lg bg-brand/5 border border-brand/20">
                        <p className="text-sm">{selectedGroupForView.memeRule}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">{t("duels_group_start_label")}</label>
                    <div className="p-3 rounded-lg bg-muted/20">
                      <p className="text-sm">
                        {selectedGroupForView.createdAt
                          ? new Date(selectedGroupForView.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">{t("duels_group_end_label")}</label>
                    <div className="p-3 rounded-lg bg-muted/20">
                      <p className="text-sm">
                        {selectedGroupForView.endDate
                          ? new Date(selectedGroupForView.endDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
                          : t("duels_group_no_deadline")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Edit action buttons */}
                {isEditingGroupInfo && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1 rounded-full bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white"
                      onClick={() => setIsEditingGroupInfo(false)}
                      disabled={isSavingGroupInfo}
                    >
                      {t("cancel")}
                    </Button>
                    <Button
                      className="flex-1 rounded-full border-0"
                      style={GLASS_PRIMARY_BTN_STYLE}
                      disabled={isSavingGroupInfo || !editGroupName.trim()}
                      onClick={async () => {
                        if (!selectedGroupForView) return;
                        const isMemes = selectedGroupForView.scoringType === "memes";
                        // Mesma exigência do wizard: memes sem regra não faz sentido.
                        if (isMemes && !editGroupRule.trim()) {
                          toast({ title: t("duels_group_meme_rule_required"), variant: "destructive" });
                          return;
                        }
                        setIsSavingGroupInfo(true);
                        try {
                          // `undefined` fora de memes: não encosta na coluna.
                          const nextRule = isMemes ? editGroupRule.trim() : undefined;
                          await updateGroupInfoDb(selectedGroupForView.id, editGroupName.trim(), editGroupGoal.trim(), nextRule);
                          setSelectedGroupForView({
                            ...selectedGroupForView,
                            name: editGroupName.trim(),
                            goal: editGroupGoal.trim(),
                            ...(isMemes ? { memeRule: editGroupRule.trim() } : {}),
                          });
                          // Update the group in the lists
                          setUserCreatedGroups((prev) => prev.map((g) => g.id === selectedGroupForView.id ? { ...g, name: editGroupName.trim(), goal: editGroupGoal.trim(), description: editGroupGoal.trim(), ...(isMemes ? { memeRule: editGroupRule.trim() } : {}) } : g));
                          setIsEditingGroupInfo(false);
                          toast({ title: t("duels_group_updated_title"), description: t("duels_group_updated_desc") });
                        } catch (error: any) {
                          toast({ title: t("duels_group_save_error"), description: error?.message || t("duels_group_retry"), variant: "destructive" });
                        } finally {
                          setIsSavingGroupInfo(false);
                        }
                      }}
                    >
                      {isSavingGroupInfo ? t("duels_group_saving") : t("duels_group_save")}
                    </Button>
                  </div>
                )}

                {/* Action Buttons */}
                {!isEditingGroupInfo && (
                  <div className="space-y-2 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,.1)" }}>
                    {selectedGroupForView.createdBy === user?.id ? (
                      <>
                        <Button
                          onClick={() => setDeleteGroupConfirmOpen(true)}
                          variant="destructive"
                          className="w-full rounded-full gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          {t("duels_group_delete_btn")}
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => setLeaveGroupConfirmOpen(true)}
                        variant="outline"
                        className="w-full rounded-full gap-2 bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white"
                      >
                        {t("duels_group_leave_btn")}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Delete group confirmation — inside drawer to avoid focus trap issues */}
          <AlertDialog open={deleteGroupConfirmOpen} onOpenChange={setDeleteGroupConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("duels_group_delete_confirm_title")}</AlertDialogTitle>
                <AlertDialogDescription>{t("duels_group_delete_confirm_desc")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={async (e) => {
                    e.preventDefault();
                    setDeleteGroupConfirmOpen(false);
                    if (!selectedGroupForView) return;
                    const groupId = selectedGroupForView.id;
                    try {
                      await deleteGroupDb(groupId);
                      toast({ title: t("duels_group_deleted_title"), description: t("duels_group_deleted_desc") });
                      setIsGroupDetailsOpen(false);
                      setSelectedGroupForView(null);
                      setGroupCheckIns([]);
                      await loadGroupsAndRequests({ fresh: true });
                    } catch (error: any) {
                      toast({ title: t("duels_group_delete_error"), description: error?.message || t("duels_group_retry"), variant: "destructive" });
                    }
                  }}
                >
                  {t("duels_group_delete_action")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Leave group confirmation — inside drawer */}
          <AlertDialog open={leaveGroupConfirmOpen} onOpenChange={setLeaveGroupConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("duels_group_leave_confirm_title")}</AlertDialogTitle>
                <AlertDialogDescription>{t("duels_group_leave_confirm_desc")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async (e) => {
                    e.preventDefault();
                    setLeaveGroupConfirmOpen(false);
                    if (!selectedGroupForView) return;
                    const groupId = selectedGroupForView.id;
                    try {
                      await leaveGroupDb(groupId);
                      toast({ title: t("duels_group_left_title"), description: t("duels_group_left_desc") });
                      setIsGroupDetailsOpen(false);
                      setSelectedGroupForView(null);
                      setGroupCheckIns([]);
                      setSearchParams((prev) => { const next = new URLSearchParams(prev); next.delete("group"); next.set("tab", "duels"); return next; }, { replace: true });
                      setActiveTab("duels");
                      // Full refresh of groups
                      void loadGroupsAndRequests({ fresh: true });
                    } catch (error: any) {
                      toast({ title: t("duels_group_leave_error"), description: error?.message || t("duels_group_retry"), variant: "destructive" });
                    }
                  }}
                >
                  {t("duels_group_leave_action")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DrawerContent>
      </Drawer>

      {/* Classifications Modal */}
      <ClassificationsDrawer
        open={isClassificationsOpen}
        onOpenChange={setIsClassificationsOpen}
        groupCheckIns={groupCheckIns}
        scoringType={selectedGroupForView?.scoringType}
        checkInVotes={checkInVotes}
        memeRule={selectedGroupForView?.memeRule}
        onSelectMember={setSelectedMemberForCheckIns}
      />

      {/* Calendário de check-ins de um participante — abre por cima das
          Classificações, ao tocar no nome. */}
      <MemberCheckInsDrawer
        open={!!selectedMemberForCheckIns}
        onOpenChange={(open) => { if (!open) setSelectedMemberForCheckIns(null); }}
        memberName={selectedMemberForCheckIns?.userName ?? ""}
        memberPhoto={selectedMemberForCheckIns?.userPhoto ?? null}
        checkIns={selectedMemberCheckIns}
      />

      {/* Participants Modal */}
      <Drawer open={isParticipantsModalOpen} onOpenChange={(open) => {
        setIsParticipantsModalOpen(open);
        if (!open) setParticipantDetailsId(null);
      }}>
        <DrawerContent
          {...GLASS_SHEET_PROPS}
          style={{ ...GLASS_SHEET_STYLE, maxHeight: "80dvh" }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DrawerHeader className="shrink-0">
            <DrawerTitle className="text-white">Participantes ({groupParticipants.length})</DrawerTitle>
            <DrawerDescription className="sr-only">Lista de participantes do grupo</DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {/* Estatísticas do Grupo */}
            {(() => {
              const totalCheckIns = groupCheckIns.length;

              let avgCheckInsPerDay = 0;
              if (selectedGroupForView?.createdAt) {
                const start = new Date(selectedGroupForView.createdAt).getTime();
                const now = new Date().getTime();
                const diffDays = Math.max(1, Math.ceil((now - start) / (1000 * 60 * 60 * 24)));
                avgCheckInsPerDay = totalCheckIns / diffDays;
              }

              const userReactionsCount: Record<string, { count: number; userName: string; userPhoto: string | null }> = {};
              groupCheckIns.forEach(checkIn => {
                const reactions = checkInReactions[checkIn.id] || [];
                if (!userReactionsCount[checkIn.userId]) {
                  userReactionsCount[checkIn.userId] = {
                    count: 0,
                    userName: checkIn.userName,
                    userPhoto: checkIn.userPhoto
                  };
                }
                userReactionsCount[checkIn.userId].count += reactions.length;
              });

              const topReactionUser = Object.values(userReactionsCount).sort((a, b) => b.count - a.count)[0];

              return (
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="p-3 rounded-lg flex flex-col items-center justify-center text-center" style={GLASS_PANEL_STYLE}>
                    <span className="text-xl font-bold text-brand mb-1">{totalCheckIns}</span>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-white/50">Total Check-ins</span>
                  </div>
                  <div className="p-3 rounded-lg flex flex-col items-center justify-center text-center" style={GLASS_PANEL_STYLE}>
                    <span className="text-xl font-bold text-brand mb-1">{avgCheckInsPerDay.toFixed(1)}</span>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-white/50">Média / Dia</span>
                  </div>
                  <div className="p-3 rounded-lg flex flex-col items-center justify-center text-center" style={GLASS_PANEL_STYLE}>
                    {topReactionUser && topReactionUser.count > 0 ? (
                      <>
                        <div className="flex items-center justify-center gap-1.5 mb-1">
                          <span className="text-xl font-bold text-brand leading-none">{topReactionUser.count}</span>
                          <UserAvatar
                            photo={topReactionUser.userPhoto}
                            nickname={topReactionUser.userName}
                            className="h-6 w-6 border border-white/15"
                          />
                        </div>
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-white/50">Mais Reações</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xl font-bold text-brand mb-1">0</span>
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-white/50">Mais Reações</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="space-y-2">
              {groupParticipants.length > 0 ? (
                groupParticipants.map((participant) => (
                  <div
                    key={participant.userId}
                    onClick={() => setParticipantDetailsId(participant.userId)}
                    className="p-3 rounded-lg flex items-center gap-3 cursor-pointer transition-colors hover:brightness-125" style={GLASS_PANEL_STYLE}
                  >
                    <UserAvatar
                      photo={participant.userPhoto}
                      nickname={participant.userNickname}
                      size="md"
                      className="flex-shrink-0"
                    />
                    <p className="text-sm font-medium flex-1 text-white">{participant.userNickname}</p>
                    {selectedGroupForView?.createdBy === user?.id && participant.userId !== user?.id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setRemoveMemberConfirm({ open: true, participant }); }}
                        className="p-1.5 rounded-full hover:bg-destructive/10 transition-colors text-white/50 hover:text-destructive flex-shrink-0"
                        title="Remover do grupo"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-center py-4" style={{ color: "rgba(255,255,255,.5)" }}>Nenhum participante ainda</p>
              )}
            </div>
          </div>
          {selectedGroupForView?.createdBy === user?.id && (
            <div className="p-4" style={{ borderTop: "1px solid rgba(255,255,255,.1)" }}>
              <Button
                className="w-full rounded-full gap-2 border-0"
                style={GLASS_PRIMARY_BTN_STYLE}
                onClick={() => {
                  setIsParticipantsModalOpen(false);
                  setIsAddMembersModalOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Adicionar Membros
              </Button>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* Participant Details Modal — opens while the Participants list Drawer
          (default z-300/310, see client/components/ui/drawer.tsx) stays open
          behind it, so it needs to sit strictly above that, not below it. */}
      <Drawer open={!!participantDetailsId} onOpenChange={(open) => !open && setParticipantDetailsId(null)}>
        <DrawerContent
          {...GLASS_SHEET_PROPS}
          className="flex flex-col !rounded-t-[32px] !border-0 z-[330]"
          overlayClassName="z-[320]"
          style={{ ...GLASS_SHEET_STYLE, height: "95dvh", maxHeight: "95dvh" }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {(() => {
            if (!participantDetailsId) return null;
            const pInfo = groupParticipants.find(p => p.userId === participantDetailsId);
            const pCheckIns = groupCheckIns.filter(c => c.userId === participantDetailsId);

            // Get month dates
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

            const monthNames = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
            const dayNames = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'];

            const monthTitle = `${monthNames[currentMonth]} ${currentYear}`;

            const checkInsByDay: Record<number, GroupCheckIn> = {};
            pCheckIns.forEach(c => {
              const d = new Date(c.createdAt);
              if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                checkInsByDay[d.getDate()] = c;
              }
            });

            const activeDays = new Set(pCheckIns.map(c => {
              const d = new Date(c.createdAt);
              return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            })).size;

            const totalDurationMins = pCheckIns.reduce((acc, c) => acc + (c.exercises?.length || 1) * 15, 0);
            const hours = Math.floor(totalDurationMins / 60);
            const mins = totalDurationMins % 60;
            const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

            return (
              <>
                <DrawerHeader className="shrink-0 flex items-center justify-between pb-2">
                  <button onClick={() => setParticipantDetailsId(null)} className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"><ChevronLeft className="h-6 w-6 text-white" /></button>
                  <div className="flex-1" />
                </DrawerHeader>

                <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col justify-center">
                  <div className="flex flex-col items-center mb-4">
                    <UserAvatar
                      photo={pInfo?.userPhoto}
                      nickname={pInfo?.userNickname}
                      size="xl"
                      className="mb-2 border-2 border-white/15"
                    />
                    <h2 className="text-lg font-bold text-white">{pInfo?.userNickname}</h2>
                  </div>

                  <div className="flex justify-between w-full mb-6 px-2">
                    <div className="text-center flex-1">
                      <p className="text-lg font-bold leading-none mb-1 text-white">{pCheckIns.length}</p>
                      <p className="text-[11px] text-white/50">Check-ins</p>
                    </div>
                    <div className="text-center flex-1">
                      <p className="text-lg font-bold leading-none mb-1 text-white">{activeDays}</p>
                      <p className="text-[11px] text-white/50">Dias ativos</p>
                    </div>
                    <div className="text-center flex-1">
                      <p className="text-lg font-bold leading-none mb-1 text-white">{durationStr}</p>
                      <p className="text-[11px] text-white/50">Duração</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h3 className="text-center font-bold text-base mb-3 text-white">{monthTitle}</h3>
                    <div className="grid grid-cols-7 gap-y-2 text-center mb-1">
                      {dayNames.map(d => (
                        <div key={d} className="text-[10px] text-white/50">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-y-2 text-center items-center justify-items-center">
                      {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                        <div key={`empty-${i}`} className="w-8 h-8" />
                      ))}
                      {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const checkIn = checkInsByDay[day];
                        return (
                          <div key={day} className="w-8 h-8 flex items-center justify-center relative">
                            {checkIn ? (
                              <div className="w-8 h-8 rounded-full overflow-hidden border border-brand/50 flex-shrink-0">
                                <ImageWithFallback src={checkIn.photo} alt="Check-in" className="w-8 h-8 object-cover" fallback="/placeholder.svg" />
                              </div>
                            ) : (
                              <span className="text-xs font-medium opacity-80 text-white">{day}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-center mt-2 pb-2">
                    <Button variant="secondary" size="sm" className="rounded-full px-8 opacity-50 cursor-not-allowed">
                      Ver todos os check-ins
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DrawerContent>
      </Drawer>

      {/* Add Members Modal */}
      <AddMembersDrawer
        open={isAddMembersModalOpen}
        onOpenChange={setIsAddMembersModalOpen}
        groupId={selectedGroupForView?.id ?? ""}
        followers={followers}
        existingMemberIds={groupParticipants.map((p) => p.userId)}
        onMembersAdded={() => {
          if (selectedGroupForView) {
            getGroupParticipantsDb(selectedGroupForView.id)
              .then(setGroupParticipants)
              .catch((err: any) => {
                console.error("Error refreshing participants:", err);
                toast({ title: "Erro ao atualizar participantes", description: err?.message || "Tente novamente.", variant: "destructive" });
              });
          }
        }}
      />

      <EditCheckInDrawer
        open={isEditCheckInOpen}
        onOpenChange={setIsEditCheckInOpen}
        checkIn={selectedCheckInForDetail}
        onUpdated={({ id, workoutInfo, description, photo, photos }) => {
          setGroupCheckIns((prev) =>
            prev.map((c) => c.id === id ? { ...c, workoutInfo, description, photo: photo ?? c.photo, photos: photos ?? c.photos } : c)
          );
          if (selectedCheckInForDetail?.id === id) {
            setSelectedCheckInForDetail({ ...selectedCheckInForDetail, workoutInfo, description, photo: photo ?? selectedCheckInForDetail.photo, photos: photos ?? selectedCheckInForDetail.photos });
          }
        }}
      />

      {/* Remove Member Confirm Dialog */}
      <AlertDialog open={removeMemberConfirm.open} onOpenChange={(open) => setRemoveMemberConfirm((prev) => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover participante</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover {removeMemberConfirm.participant?.userNickname} do grupo?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRemoveMemberConfirm({ open: false, participant: null })}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                if (!removeMemberConfirm.participant || !selectedGroupForView) return;
                const { userId, userNickname } = removeMemberConfirm.participant;
                setRemoveMemberConfirm({ open: false, participant: null });
                try {
                  await removeGroupMemberDb(selectedGroupForView.id, userId);
                  setGroupParticipants((prev) => prev.filter((p) => p.userId !== userId));
                  setSelectedGroupForView((prev: any) => prev ? { ...prev, participants: Math.max(0, (prev.participants ?? 1) - 1) } : prev);
                  toast({ title: "Participante removido", description: `${userNickname} foi removido do grupo.` });
                } catch (err: any) {
                  toast({ title: "Erro ao remover", description: err?.message || "Tente novamente.", variant: "destructive" });
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* Centralized Confirm Dialog */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                setConfirmDialog((prev) => ({ ...prev, open: false }));
                await confirmDialog.onConfirm();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Paywall: limite de duelos criados no plano grátis */}
      <PaywallDrawer open={duelPaywallOpen} onOpenChange={setDuelPaywallOpen} feature="duels" />
    </>
  );
}
