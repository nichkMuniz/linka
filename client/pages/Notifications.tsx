import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, UserPlus, Zap, Flame, Trophy, TrendingUp, Dumbbell, Swords, Video, SmilePlus } from "lucide-react";
import { getNotificationsDb, markNotificationsAsReadDb, clearNotificationsDb, type NotificationItem } from "@/lib/ritmofit-db";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import { LoadingSpinner } from "@/components/shared/animated-loading";
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
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isClearing, setIsClearing] = React.useState(false);
  const [clearDialogOpen, setClearDialogOpen] = React.useState(false);

  React.useEffect(() => {
    if (!user) return;

    let isMounted = true;

    const loadNotifications = async () => {
      try {
        await markNotificationsAsReadDb();
        const data = await getNotificationsDb();
        if (isMounted) setNotifications(data);
      } catch (err: any) {
        console.error("Error loading notifications:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadNotifications();

    // Subscribe to new notifications via Realtime instead of polling every 30s
    const channel = supabase
      ?.channel("notifications-page")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        async () => {
          if (!isMounted) return;
          // Re-fetch the full list to stay in sync with read-state
          const data = await getNotificationsDb();
          if (isMounted) setNotifications(data);
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      channel?.unsubscribe();
    };
  }, [user]);

  const getIncentiveTypeName = (type: number): string => {
    const incentiveNames: { [key: number]: string } = {
      1: "Apoio",
      2: "Tá pegando fogo!",
      3: "Vencedor!",
      4: "Evolução!",
      5: "Força total!",
      6: "Energia máxima!",
    };
    return incentiveNames[type] || "Incentivo";
  };

  const getIncentiveIcon = (type: number) => {
    const incentiveIcons: { [key: number]: { Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>, color: string } } = {
      1: { Icon: Heart, color: "text-rose-500" },
      2: { Icon: Flame, color: "text-orange-500" },
      3: { Icon: Trophy, color: "text-amber-500" },
      4: { Icon: TrendingUp, color: "text-emerald-500" },
      5: { Icon: Dumbbell, color: "text-blue-500" },
      6: { Icon: Zap, color: "text-yellow-500" },
    };
    return incentiveIcons[type];
  };

  const getNotificationContent = (notification: NotificationItem) => {
    switch (notification.type) {
      case 1:
        return {
          icon: <UserPlus className="h-5 w-5 text-blue-500" />,
          title: "Novo seguidor",
          description: `${notification.userNickname} começou a te seguir`,
          bgColor: "bg-blue-500/10",
          borderColor: "border-blue-200/50",
        };
      case 2: {
        const incentiveName = notification.incentiveType
          ? getIncentiveTypeName(notification.incentiveType)
          : "Incentivo";
        const incentiveIconData = notification.incentiveType
          ? getIncentiveIcon(notification.incentiveType)
          : null;
        const IncentiveIconComponent = incentiveIconData?.Icon;
        const context = notification.shotId ? "no seu reels" : "na sua postagem";
        return {
          icon: IncentiveIconComponent
            ? <IncentiveIconComponent className={`h-5 w-5 ${incentiveIconData!.color}`} />
            : <Zap className="h-5 w-5 text-yellow-500" />,
          title: `${incentiveName} recebido`,
          description: `${notification.userNickname} te deu "${incentiveName}" ${context}`,
          bgColor: "bg-yellow-500/10",
          borderColor: "border-yellow-200/50",
        };
      }
      case 3: {
        const commentContext = notification.shotId ? "no seu reels" : "na sua postagem";
        return {
          icon: <MessageCircle className="h-5 w-5 text-purple-500" />,
          title: "Novo comentário",
          description: `${notification.userNickname} comentou ${commentContext}`,
          bgColor: "bg-purple-500/10",
          borderColor: "border-purple-200/50",
        };
      }
      case 4:
        return {
          icon: <Swords className="h-5 w-5 text-orange-500" />,
          title: "Convite para duelo",
          description: `${notification.userNickname} te adicionou ao grupo "${notification.groupName ?? "Duelo"}"`,
          bgColor: "bg-orange-500/10",
          borderColor: "border-orange-200/50",
        };
      case 5:
        return {
          icon: <Swords className="h-5 w-5 text-yellow-500" />,
          title: "Solicitação de entrada",
          description: `${notification.userNickname} quer entrar no grupo "${notification.groupName ?? "Duelo"}"`,
          bgColor: "bg-yellow-500/10",
          borderColor: "border-yellow-200/50",
        };
      case 6:
        return {
          icon: <SmilePlus className="h-5 w-5 text-pink-500" />,
          title: "Reação no comentário",
          description: `${notification.userNickname} reagiu ao seu comentário`,
          bgColor: "bg-pink-500/10",
          borderColor: "border-pink-200/50",
        };
      case 7:
        return {
          icon: <SmilePlus className="h-5 w-5 text-orange-400" />,
          title: "Reação no check-in",
          description: `${notification.userNickname} reagiu ao seu check-in`,
          bgColor: "bg-orange-400/10",
          borderColor: "border-orange-200/50",
        };
      default:
        return {
          icon: <Zap className="h-5 w-5 text-gray-500" />,
          title: "Notificação",
          description: "Nova atividade",
          bgColor: "bg-gray-500/10",
          borderColor: "border-gray-200/50",
        };
    }
  };

  const formatTimeAgo = (date: string): string => {
    const now = new Date();
    const notifTime = new Date(date);
    const diffMs = now.getTime() - notifTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "agora";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;

    return notifTime.toLocaleDateString("pt-BR", {
      month: "short",
      day: "numeric",
    });
  };

  // Collapse incentive notifications for the same post/shot into one grouped entry per unique sender.
  // A single user sending multiple incentive types on the same post becomes one notification
  // listing all incentive types they sent. Multiple users sending incentives on the same post
  // are also merged, showing stacked avatars and a combined description.
  const collapseIncentives = (notifs: NotificationItem[]): Array<NotificationItem & {
    groupedCount?: number;
    groupedNicknames?: string[];
    groupedIncentiveTypes?: number[];
    groupedUsers?: Array<{ userId: string; userNickname: string; userPhoto?: string; incentiveTypes: number[] }>;
  }> => {
    type GroupedNotif = NotificationItem & {
      groupedCount?: number;
      groupedNicknames?: string[];
      groupedIncentiveTypes?: number[];
      groupedUsers?: Array<{ userId: string; userNickname: string; userPhoto?: string; incentiveTypes: number[] }>;
    };

    const result: GroupedNotif[] = [];
    // Key: postId/shotId → index in result (one group per post/shot regardless of incentive type)
    const seenPost = new Map<string, number>();

    for (const n of notifs) {
      if (n.type === 2 && n.incentiveType && (n.postId || n.shotId)) {
        const postKey = n.postId ?? n.shotId ?? "";
        if (seenPost.has(postKey)) {
          const idx = seenPost.get(postKey)!;
          const existing = result[idx];
          // Track per-user incentive types
          const users = existing.groupedUsers!;
          const existingUser = users.find(u => u.userId === n.userId);
          if (existingUser) {
            if (!existingUser.incentiveTypes.includes(n.incentiveType!)) {
              existingUser.incentiveTypes.push(n.incentiveType!);
            }
          } else {
            users.push({ userId: n.userId, userNickname: n.userNickname, userPhoto: n.userPhoto, incentiveTypes: [n.incentiveType!] });
            existing.groupedNicknames = users.map(u => u.userNickname);
            existing.groupedCount = users.length;
          }
          // Accumulate all incentive types seen across all users for icon display
          if (!existing.groupedIncentiveTypes!.includes(n.incentiveType!)) {
            existing.groupedIncentiveTypes!.push(n.incentiveType!);
          }
        } else {
          seenPost.set(postKey, result.length);
          result.push({
            ...n,
            groupedCount: 1,
            groupedNicknames: [n.userNickname],
            groupedIncentiveTypes: [n.incentiveType!],
            groupedUsers: [{ userId: n.userId, userNickname: n.userNickname, userPhoto: n.userPhoto, incentiveTypes: [n.incentiveType!] }],
          });
        }
      } else {
        result.push(n);
      }
    }

    return result;
  };

  const localDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const groupNotificationsByDate = (notifs: NotificationItem[]) => {
    const now = new Date();
    const todayStr = localDateStr(now);
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = localDateStr(yesterdayDate);
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const groups: Record<string, NotificationItem[]> = {
      Hoje: [],
      Ontem: [],
      "Esta semana": [],
      "Mais antigas": [],
    };

    for (const n of notifs) {
      const dateStr = localDateStr(new Date(n.createdAt));
      if (dateStr === todayStr) {
        groups["Hoje"].push(n);
      } else if (dateStr === yesterdayStr) {
        groups["Ontem"].push(n);
      } else if (new Date(n.createdAt) >= weekAgo) {
        groups["Esta semana"].push(n);
      } else {
        groups["Mais antigas"].push(n);
      }
    }

    return groups;
  };

  const handleNotificationClick = (notification: NotificationItem) => {
    // Type 1 (new follower) - navigate to user profile
    if (notification.type === 1) {
      navigate(`/usuario/${notification.userId}`);
    }
    // Type 4 (duel invite) or type 5 (join request) - navigate to community requests tab
    else if (notification.type === 4 || notification.type === 5) {
      navigate("/comunidade?tab=requests");
    }
    // Type 7 (duel check-in reaction) — navigate to duels tab, no modal
    else if (notification.type === 7) {
      navigate("/comunidade?tab=duels");
    }
    // Type 6 (comment reaction) — navigate to the exact screen/modal where the comment lives
    else if (notification.type === 6) {
      if (notification.shotId) {
        // Reaction on a shot comment → open shots with comment drawer
        navigate("/shots", { state: { openComments: true, shotId: notification.shotId } });
      } else if (notification.flowId) {
        // Reaction on a flow comment → go to feed, which hosts flows
        navigate("/", { state: { openFlow: notification.flowId } });
      } else if (notification.checkInId) {
        // Reaction on a check-in comment → open community with that check-in expanded
        navigate("/comunidade", { state: { openCheckIn: notification.checkInId } });
      } else if (notification.postId) {
        // Reaction on a post comment → open post with comments modal
        navigate(`/post/${notification.postId}`, { state: { openComments: true } });
      } else {
        navigate(`/usuario/${notification.userId}`);
      }
    }
    // Shot notifications (shots_id populated)
    else if (notification.shotId) {
      if (notification.type === 3) {
        // Comment on shot → open shots screen with comment drawer open for that shot
        navigate("/shots", { state: { openComments: true, shotId: notification.shotId } });
      } else {
        // Incentive on shot → navigate to shots screen
        navigate("/shots", { state: { shotId: notification.shotId } });
      }
    }
    // Type 3 (comment) - navigate to post and open comments modal
    else if (notification.type === 3 && notification.postId) {
      navigate(`/post/${notification.postId}`, { state: { openComments: true } });
    }
    // Type 2 (incentive) - navigate to post and open likes/incentives modal
    else if (notification.type === 2 && notification.postId) {
      navigate(`/post/${notification.postId}`, { state: { openLikes: true } });
    }
    else if (notification.postId) {
      navigate(`/post/${notification.postId}`);
    } else {
      navigate(`/usuario/${notification.userId}`);
    }
  };

  const handleClearNotifications = async () => {
    setIsClearing(true);
    try {
      const success = await clearNotificationsDb();
      if (success) {
        setNotifications([]);
        toast({
          title: "Notificações limpas",
          description: "Todas as suas notificações foram removidas.",
        });
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível limpar as notificações.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("Error clearing notifications:", err);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao limpar as notificações.",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="space-y-4 pb-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Notificações</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Fique por dentro das atividades dos usuários que segue
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <LoadingSpinner className="h-8 w-8" />
            <p className="text-sm text-muted-foreground">Carregando notificações...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-border/60 bg-muted/30">
            <Zap className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              Nenhuma notificação ainda
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Quando alguém te seguir ou interagir com seus posts,
              <br />
              você verá as notificações aqui
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Clear Notifications Button */}
            <div className="flex justify-end">
              <Button
                onClick={() => setClearDialogOpen(true)}
                disabled={isClearing}
                variant="outline"
                size="sm"
                className="rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                Limpar Notificações
              </Button>
            </div>

            <div className="space-y-4">
            {(() => {
              const groups = groupNotificationsByDate(notifications);
              const groupKeys = ["Hoje", "Ontem", "Esta semana", "Mais antigas"] as const;
              return groupKeys.map((label) => {
                const groupNotifs = collapseIncentives(groups[label]);
                if (groupNotifs.length === 0) return null;
                return (
                  <div key={label}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2 sticky top-0 bg-background/80 backdrop-blur py-1">
                      {label}
                    </p>
                    <div className="space-y-2">
                      {groupNotifs.map((notification) => {
                        const grouped = (notification as any);
                        const groupedCount: number = grouped.groupedCount ?? 1;
                        const groupedNicknames: string[] = grouped.groupedNicknames ?? [notification.userNickname];
                        const groupedIncentiveTypes: number[] = grouped.groupedIncentiveTypes ?? (notification.incentiveType ? [notification.incentiveType] : []);
                        const groupedUsers: Array<{ userId: string; userNickname: string; userPhoto?: string; incentiveTypes: number[] }> = grouped.groupedUsers ?? [];
                        const rawContent = getNotificationContent(notification);
                        const context = notification.shotId ? "no seu reels" : "na sua postagem";

                        // Build description for grouped incentives
                        let groupedDescription = rawContent.description;
                        if (notification.type === 2) {
                          const totalReactions = groupedUsers.reduce((sum, u) => sum + u.incentiveTypes.length, 0);
                          const firstUser = groupedUsers[0];
                          const firstName = firstUser?.userNickname ?? notification.userNickname;
                          const firstIncentiveName = firstUser?.incentiveTypes[0]
                            ? `"${getIncentiveTypeName(firstUser.incentiveTypes[0])}"`
                            : `"${getIncentiveTypeName(notification.incentiveType ?? 1)}"`;

                          if (totalReactions === 1) {
                            // Single reaction — use default description
                          } else {
                            const othersCount = totalReactions - 1;
                            groupedDescription = `${firstName} te deu ${firstIncentiveName} e outras ${othersCount} ${othersCount === 1 ? "reação" : "reações"} ${context}`;
                          }
                        }

                        const content = notification.type === 2
                          ? { ...rawContent, description: groupedDescription }
                          : rawContent;
                        const isRead = notification.read === true;

                        return (
                          <button
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={`w-full text-left transition-all hover:shadow-md rounded-lg p-4 border ${
                              isRead
                                ? "border-transparent bg-transparent hover:bg-muted/30"
                                : `border ${content.borderColor} ${content.bgColor}`
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {/* User Avatar — stacked for grouped incentives */}
                              <div className="flex-shrink-0 relative" style={{ width: groupedCount > 1 ? "52px" : "48px", height: "48px" }}>
                                {groupedCount > 1 ? (
                                  <>
                                    {/* Back avatar (second user or same user repeated) */}
                                    <div className={`absolute top-0 right-0 h-9 w-9 rounded-full border-2 bg-muted ${isRead ? "border-background/60 opacity-50" : "border-background"} overflow-hidden`}>
                                      {(groupedUsers[1]?.userPhoto ?? groupedUsers[0]?.userPhoto) ? (
                                        <ImageWithFallback src={groupedUsers[1]?.userPhoto ?? groupedUsers[0]?.userPhoto ?? ""} alt="" className="h-full w-full object-cover" fallback="/placeholder.svg" />
                                      ) : null}
                                    </div>
                                    {/* Front avatar (first user) */}
                                    <div className={`absolute bottom-0 left-0 h-9 w-9 rounded-full border-2 bg-muted ${isRead ? "border-background/60 opacity-60" : "border-background"} overflow-hidden`}>
                                      {groupedUsers[0]?.userPhoto ? (
                                        <ImageWithFallback src={groupedUsers[0].userPhoto} alt={groupedUsers[0].userNickname} className="h-full w-full object-cover" fallback="/placeholder.svg" />
                                      ) : null}
                                    </div>
                                  </>
                                ) : notification.userPhoto ? (
                                  <ImageWithFallback
                                    src={notification.userPhoto}
                                    alt={notification.userNickname}
                                    className={`h-12 w-12 rounded-full object-cover border ${
                                      isRead
                                        ? "border-border/20 opacity-60"
                                        : "border-border/40"
                                    }`}
                                    fallback="/placeholder.svg"
                                  />
                                ) : (
                                  <div className={`h-12 w-12 rounded-full bg-muted ${isRead ? "opacity-40" : ""} border ${isRead ? "border-border/20" : "border-border/40"}`} />
                                )}
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <div className="flex items-start gap-2 flex-1 min-w-0">
                                    <div className="flex-shrink-0 mt-0.5">
                                      {content.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-xs font-semibold ${isRead ? "text-foreground/50" : "text-foreground/70"}`}>
                                        {content.title}
                                      </p>
                                      <p className={`text-sm font-medium mt-0.5 ${isRead ? "text-foreground/60" : "text-foreground"}`}>
                                        {content.description}
                                      </p>
                                    </div>
                                  </div>
                                  <p className={`text-xs flex-shrink-0 whitespace-nowrap ml-2 ${isRead ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
                                    {formatTimeAgo(notification.createdAt)}
                                  </p>
                                </div>

                                {/* Post Thumbnail - only for incentive and comment notifications */}
                                {notification.postPhoto && (notification.type === 2 || notification.type === 3) && (() => {
                                  const isVideo = /\.(mp4|webm|mov|avi)(\?|$)/i.test(notification.postPhoto);
                                  return (
                                    <div className="mt-3 ml-7">
                                      {isVideo ? (
                                        <div className={`h-16 w-16 rounded-md border flex items-center justify-center bg-muted ${isRead ? "border-border/20 opacity-50" : "border-border/40"}`}>
                                          <Video className="h-6 w-6 text-muted-foreground/60" />
                                        </div>
                                      ) : (
                                        <img
                                          src={notification.postPhoto}
                                          alt="Post"
                                          className={`h-16 w-16 rounded-md object-cover border ${
                                            isRead
                                              ? "border-border/20 opacity-50"
                                              : "border-border/40"
                                          }`}
                                        />
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
            </div>
          </div>
        )}
      </div>
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar notificações</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja limpar todas as notificações? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearNotifications}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Limpar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
