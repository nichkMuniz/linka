import {
  addMembersToGroupDb,
  sendGroupJoinRequestNotificationDb,
} from "@/lib/ritmofit-db";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/use-toast";
import { Plus, ChevronRight, Swords } from "lucide-react";
import {
  DEFAULT_TRANSFORM,
} from "@/components/shared/inline-crop-preview";
import { useNavigate } from "react-router-dom";
import { usePremium } from "@/lib/premium-context";
import { useLanguage } from "@/lib/language-context";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";

import type { DuelsController } from "./use-duels";

/** Aba **Duelos** — CTA de criação, seus duelos e duelos disponíveis. */
export function DuelsTab({ ctl }: { ctl: DuelsController }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isPremium } = usePremium();
  const navigate = useNavigate();
  const {
    setIsCreateGroupModalOpen,
    setGroupStep,
    setGroupConfig,
    setGroupCoverTransform,
    setSelectedInvitees,
    userCreatedGroups,
    availableGroups,
    setAvailableGroups,
    setDuelPaywallOpen,
    duelGateBlocked,
    joinedGroupIds,
    joiningGroupId,
    setJoiningGroupId,
    activeGroupIndex,
    setActiveGroupIndex,
    openGroupView,
  } = ctl;

  return (
    <>
          <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4 space-y-5 min-h-0">

            {/* CTA: Criar um duelo */}
            <button
              onClick={() => {
                if (duelGateBlocked) {
                  setDuelPaywallOpen(true);
                  return;
                }
                setGroupStep(1);
                setGroupConfig({ name: "", location: "", goal: "", durationDays: "", photo: "", scoringType: "check_in_count", memeRule: "" });
                setGroupCoverTransform(DEFAULT_TRANSFORM);
                setSelectedInvitees(new Set());
                setIsCreateGroupModalOpen(true);
              }}
              className="w-full flex items-center gap-3 rounded-[20px] p-3.5 text-left active:opacity-80 transition-opacity"
              style={{
                background: "linear-gradient(135deg,rgba(91,140,255,.18),rgba(157,107,255,.1))",
                border: "1px solid rgba(123,99,242,.32)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.14)",
              }}
            >
              <span
                className="w-[46px] h-[46px] rounded-[14px] flex-shrink-0 flex items-center justify-center text-white"
                style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", boxShadow: "0 6px 16px -4px rgba(123,63,242,.5)" }}
              >
                <Plus className="h-6 w-6" />
              </span>
              <div className="flex-1">
                <div className="text-[15px] font-bold text-white">{t("duels_create")}</div>
                <div className="text-[11.5px] mt-0.5" style={{ color: "rgba(255,255,255,.6)" }}>{t("duels_create_subtitle")}</div>
              </div>
              <ChevronRight className="h-5 w-5 flex-shrink-0" style={{ color: "rgba(255,255,255,.45)" }} />
            </button>

            {/* Meus grupos ativos */}
            {userCreatedGroups.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-bold text-white">{t("duels_my_groups")}</span>
                  <span className="text-[12px] font-semibold" style={{ color: "rgba(255,255,255,.45)" }}>{userCreatedGroups.length}</span>
                </div>

                {/* Todos os grupos — card expande/colapsa in-place ao clicar */}
                {userCreatedGroups.map((group, i) => {
                  const isActive = i === Math.min(activeGroupIndex, userCreatedGroups.length - 1);
                  const daysRemaining = group.endDate
                    ? Math.ceil((new Date(group.endDate).getTime() - Date.now()) / 86400000)
                    : null;
                  return (
                    <div
                      key={group.id}
                      onClick={!isActive ? () => setActiveGroupIndex(i) : undefined}
                      style={{
                        borderRadius: 24,
                        overflow: "hidden",
                        cursor: isActive ? "default" : "pointer",
                        WebkitTapHighlightColor: "transparent",
                        transition: "background 0.35s ease, border-color 0.35s ease",
                        background: isActive
                          ? "linear-gradient(rgba(255,255,255,.07),rgba(255,255,255,.03))"
                          : "rgba(255,255,255,.04)",
                        border: isActive
                          ? "1px solid rgba(255,255,255,.09)"
                          : "1px solid rgba(255,255,255,.08)",
                      }}
                    >
                      {/* Banner — aparece com animação de altura */}
                      <div
                        style={{
                          height: isActive ? 110 : 0,
                          overflow: "hidden",
                          position: "relative",
                          transition: "height 0.38s cubic-bezier(0.4,0,0.2,1)",
                          flexShrink: 0,
                        }}
                      >
                        {group.photo ? (
                          <ImageWithFallback src={group.photo} alt={group.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full" style={{ background: "radial-gradient(circle at 40% 35%,#ffd07a,#ff7a3c 80%)" }} />
                        )}
                        <span
                          style={{ position: "absolute", top: 10, left: 10, padding: "5px 11px", borderRadius: 13, fontSize: 11, fontWeight: 700, color: "#0a0b12", background: "#fff" }}
                        >
                          {group.createdBy === user?.id ? t("duels_your_group") : t("duels_participant")}
                        </span>
                        {daysRemaining !== null && (
                          <span
                            style={{ position: "absolute", top: 10, right: 10, display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 13, fontSize: 11, fontWeight: 700, color: "#fff", background: "rgba(0,0,0,.35)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
                          >
                            ⏳ {daysRemaining > 0 ? `${daysRemaining} ${t("duels_days_remaining")}` : t("duels_ended")}
                          </span>
                        )}
                      </div>

                      {/* Linha de corpo — thumbnail some quando o banner abre */}
                      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 14 }}>
                        {/* Thumbnail (visível só quando colapsado) */}
                        <div
                          style={{
                            width: isActive ? 0 : 50,
                            height: isActive ? 0 : 50,
                            flexShrink: 0,
                            borderRadius: 16,
                            overflow: "hidden",
                            opacity: isActive ? 0 : 1,
                            transition: "width 0.32s cubic-bezier(0.4,0,0.2,1), height 0.32s cubic-bezier(0.4,0,0.2,1), opacity 0.22s ease",
                          }}
                        >
                          {group.photo ? (
                            <ImageWithFallback src={group.photo} alt={group.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[22px]" style={{ background: "rgba(255,255,255,.1)" }}>
                              {group.icon}
                            </div>
                          )}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: isActive ? 15.5 : 14,
                              fontWeight: 700,
                              color: "#fff",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              transition: "font-size 0.3s ease",
                            }}
                          >
                            {group.name}
                          </div>
                          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.55)", marginTop: 2 }}>
                            {group.participants} participantes · {group.city}
                            {!isActive && daysRemaining !== null && ` · ${daysRemaining > 0 ? `${daysRemaining}d` : t("duels_ended")}`}
                          </div>
                        </div>

                        {/* Chevron (visível só quando colapsado) */}
                        <ChevronRight
                          className="flex-shrink-0"
                          style={{
                            width: 20,
                            height: 20,
                            color: "rgba(255,255,255,.4)",
                            opacity: isActive ? 0 : 1,
                            transition: "opacity 0.2s ease",
                          }}
                        />
                      </div>

                      {/* Botão check-in — expande junto com o banner */}
                      <div
                        style={{
                          maxHeight: isActive ? 70 : 0,
                          overflow: "hidden",
                          paddingLeft: 14,
                          paddingRight: 14,
                          transition: "max-height 0.38s cubic-bezier(0.4,0,0.2,1), padding-bottom 0.38s ease",
                          paddingBottom: isActive ? 14 : 0,
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openGroupView(group);
                          }}
                          style={{
                            width: "100%",
                            height: 42,
                            borderRadius: 21,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            fontSize: 14,
                            fontWeight: 600,
                            color: "#0a0b12",
                            background: "linear-gradient(rgba(255,255,255,.95),rgba(255,255,255,.82))",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          {t("duels_view")}
                          <ChevronRight className="h-[17px] w-[17px]" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Da comunidade */}
            {availableGroups.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-bold text-white">{t("duels_community_groups")}</span>
                  <span className="text-[12px] font-semibold" style={{ color: "#9d6bff" }}>{availableGroups.length}</span>
                </div>

                {availableGroups.map((group) => (
                  <div
                    key={group.id}
                    className="flex items-center gap-3 p-3.5 rounded-[22px]"
                    style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}
                  >
                    <div className="w-[50px] h-[50px] rounded-[16px] flex-shrink-0 overflow-hidden">
                      {group.photo ? (
                        <ImageWithFallback src={group.photo} alt={group.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[22px]" style={{ background: "rgba(255,255,255,.1)" }}>
                          {group.icon}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold text-white truncate">{group.name}</div>
                      <div className="text-[11.5px]" style={{ color: "rgba(255,255,255,.5)" }}>
                        {group.participants} participantes · por {group.creatorNickname}
                      </div>
                    </div>
                    {group.isPending ? (
                      <span
                        className="text-[12px] font-semibold shrink-0 px-3.5 py-1.5 rounded-[14px]"
                        style={{ color: "rgba(255,255,255,.5)", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)" }}
                      >
                        ⏳ {t("duels_pending")}
                      </span>
                    ) : joinedGroupIds.has(group.id) ? (
                      <button
                        onClick={() => openGroupView(group)}
                        className="text-[12px] font-semibold shrink-0 px-3.5 py-1.5 rounded-[14px] active:opacity-80 transition-opacity"
                        style={{ color: "#fff", background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.14)" }}
                      >
                        {t("duels_view")}
                      </button>
                    ) : (
                      <button
                        disabled={joiningGroupId === group.id}
                        onClick={async () => {
                          if (!user) return;
                          setJoiningGroupId(group.id);
                          try {
                            await addMembersToGroupDb(group.id, [user.id]);
                            if (group.createdBy) {
                              await sendGroupJoinRequestNotificationDb(group.id, group.createdBy);
                            }
                            setAvailableGroups((prev) =>
                              prev.map((g) => g.id === group.id ? { ...g, isPending: true } : g)
                            );
                            toast({ title: t("duels_request_sent_title"), description: t("duels_request_sent_desc") });
                          } catch (err: any) {
                            console.error("Error joining group:", err);
                          } finally {
                            setJoiningGroupId(null);
                          }
                        }}
                        className="text-[12px] font-semibold shrink-0 px-3.5 py-1.5 rounded-[14px] disabled:opacity-50 active:opacity-80 transition-opacity"
                        style={{ color: "#fff", background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.14)" }}
                      >
                        {joiningGroupId === group.id ? "..." : t("duels_join")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {userCreatedGroups.length === 0 && availableGroups.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                <div className="h-16 w-16 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,.05)" }}>
                  <Swords className="h-8 w-8" style={{ color: "rgba(255,255,255,.2)" }} />
                </div>
                <p className="text-sm font-semibold text-white">{t("duels_empty")}</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,.4)" }}>{t("duels_empty_desc")}</p>
              </div>
            )}
          </div>
    </>
  );
}
