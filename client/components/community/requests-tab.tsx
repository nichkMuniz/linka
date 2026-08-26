import * as React from "react";
import { Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useLanguage } from "@/lib/language-context";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  acceptGroupInviteDb,
  declineGroupInviteDb,
  approveGroupRequestDb,
  rejectGroupRequestDb,
  getDuelGroupDb,
  type GroupJoinRequest,
} from "@/lib/ritmofit-db";

/** Convite de duelo que o usuário recebeu e ainda não respondeu. */
export interface PendingInvite {
  groupId: string;
  groupName: string;
  groupGoal: string;
  groupLocation: string;
}

const CARD_STYLE: React.CSSProperties = {
  background: "linear-gradient(rgba(255,255,255,.09),rgba(255,255,255,.03))",
  backdropFilter: "blur(20px) saturate(160%)",
  WebkitBackdropFilter: "blur(20px) saturate(160%)",
  border: "1px solid rgba(255,255,255,.10)",
};

interface RequestsTabProps {
  pendingInvites: PendingInvite[];
  setPendingInvites: React.Dispatch<React.SetStateAction<PendingInvite[]>>;
  pendingGroupRequests: GroupJoinRequest[];
  setPendingGroupRequests: React.Dispatch<React.SetStateAction<GroupJoinRequest[]>>;
  /** Recarrega grupos e solicitações (sem cache) após recusar um convite. */
  onReloadGroups: () => void;
  /** Vai para a aba Duelos e abre o grupo recém-aceito. */
  onOpenAcceptedGroup: (group: any) => void;
  /** Volta para a aba Duelos quando a caixa fica vazia. */
  onGoToDuels: () => void;
}

/**
 * Aba **Solicitações** — convites de duelo recebidos e pedidos de entrada nos
 * grupos que o usuário criou.
 *
 * O estado vive na tela porque pertence ao domínio de Duelos: `loadGroupsAndRequests`
 * carrega as duas listas de uma vez e o contador do ícone da aba depende delas.
 */
export function RequestsTab({
  pendingInvites,
  setPendingInvites,
  pendingGroupRequests,
  setPendingGroupRequests,
  onReloadGroups,
  onOpenAcceptedGroup,
  onGoToDuels,
}: RequestsTabProps) {
  const { t } = useLanguage();

  const fail = (err: any) =>
    toast({
      title: t("error"),
      description: err?.message || t("retry"),
      variant: "destructive",
    });

  const acceptInvite = async (invite: PendingInvite) => {
    try {
      await acceptGroupInviteDb(invite.groupId);
      setPendingInvites((prev) => prev.filter((i) => i.groupId !== invite.groupId));
      toast({
        title: t("duels_requests_invite_accepted_title"),
        description: t("duels_requests_invite_accepted_desc").replace(
          "{group}",
          invite.groupName,
        ),
      });

      // Navigate directly to the group detail view (open instantly)
      const group = await getDuelGroupDb(invite.groupId);
      if (group) onOpenAcceptedGroup(group);
    } catch (err: any) {
      fail(err);
    }
  };

  const declineInvite = async (invite: PendingInvite) => {
    try {
      await declineGroupInviteDb(invite.groupId);
      const updated = pendingInvites.filter((i) => i.groupId !== invite.groupId);
      setPendingInvites(updated);
      // Refresh groups so duels tab reflects the declined invite
      onReloadGroups();
      if (updated.length === 0 && pendingGroupRequests.length === 0) onGoToDuels();
      toast({ title: t("duels_requests_invite_declined") });
    } catch (err: any) {
      fail(err);
    }
  };

  const dropRequest = (groupId: string, userId: string) =>
    setPendingGroupRequests((prev) =>
      prev.filter((r) => !(r.groupId === groupId && r.userId === userId)),
    );

  const approveRequest = async (req: GroupJoinRequest) => {
    try {
      await approveGroupRequestDb(req.groupId, req.userId);
      dropRequest(req.groupId, req.userId);
      toast({
        title: t("duels_requests_approved_title"),
        description: t("duels_requests_approved_desc")
          .replace("{name}", req.userNickname)
          .replace("{group}", req.groupName),
      });
    } catch (err: any) {
      fail(err);
    }
  };

  const rejectRequest = async (req: GroupJoinRequest) => {
    try {
      await rejectGroupRequestDb(req.groupId, req.userId);
      dropRequest(req.groupId, req.userId);
      toast({ title: t("duels_requests_rejected") });
    } catch (err: any) {
      fail(err);
    }
  };

  return (
    <>
      <div className="flex-shrink-0 px-4 pt-4 pb-0">
        <h1 className="text-2xl font-bold tracking-tight">{t("duels_requests_title")}</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4 space-y-3">
        {/* Convites recebidos pelo usuário */}
        {pendingInvites.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-2">
              {t("duels_requests_invites_section")}
            </p>
            {pendingInvites.map((invite) => (
              <div key={invite.groupId} className="rounded-xl p-4 mb-3" style={CARD_STYLE}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚔️</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{invite.groupName}</p>
                    <p className="text-xs text-white/50 truncate">{invite.groupGoal}</p>
                    <p className="text-xs text-white/50">{invite.groupLocation}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    className="flex-1 rounded-full text-xs h-11"
                    onClick={() => void acceptInvite(invite)}
                  >
                    {t("duels_requests_accept")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-full text-xs h-11"
                    onClick={() => void declineInvite(invite)}
                  >
                    {t("duels_requests_decline")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Solicitações de entrada nos grupos do usuário (dono) */}
        {pendingGroupRequests.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-2">
              {t("duels_requests_joins_section")}
            </p>
            {pendingGroupRequests.map((req) => (
              <div
                key={`${req.groupId}-${req.userId}`}
                className="rounded-xl p-4 mb-3"
                style={CARD_STYLE}
              >
                <div className="flex items-center gap-3">
                  <UserAvatar
                    photo={req.userPhoto}
                    nickname={req.userNickname}
                    size="md"
                    className="flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{req.userNickname}</p>
                    <p className="text-xs text-white/50 truncate">
                      {t("duels_requests_wants_to_join")}{" "}
                      <span className="font-medium">{req.groupName}</span>
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Users className="h-3 w-3 text-white/40" />
                      <span className="text-xs text-white/40">
                        {t(
                          req.participants === 1
                            ? "duels_requests_participants_one"
                            : "duels_requests_participants",
                        ).replace("{n}", String(req.participants))}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    className="flex-1 rounded-full text-xs h-11"
                    onClick={() => void approveRequest(req)}
                  >
                    {t("duels_requests_approve")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-full text-xs h-11"
                    onClick={() => void rejectRequest(req)}
                  >
                    {t("duels_requests_decline")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {pendingInvites.length === 0 && pendingGroupRequests.length === 0 && (
          <p className="text-sm text-white/40 text-center py-8">
            {t("duels_requests_empty")}
          </p>
        )}
      </div>
    </>
  );
}
