import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, UserPlus, Zap, HeartHandshake, Flame, Trophy, Rocket, Target, Swords, Video } from "lucide-react";
import { getNotificationsDb, markNotificationsAsReadDb, clearNotificationsDb, type NotificationItem } from "@/lib/ritmofit-db";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
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
      2: "Continua",
      3: "Ganhador",
      4: "Consegue Mais",
      5: "Limite Maior",
      6: "Mais Algum",
    };
    return incentiveNames[type] || "Incentivo";
  };

  const getIncentiveIcon = (type: number) => {
    const incentiveIcons: { [key: number]: { Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>, color: string } } = {
      1: { Icon: HeartHandshake, color: "text-rose-500" },
      2: { Icon: Flame, color: "text-orange-500" },
      3: { Icon: Trophy, color: "text-emerald-500" },
      4: { Icon: Rocket, color: "text-blue-500" },
      5: { Icon: Target, color: "text-purple-500" },
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
            : <Heart className="h-5 w-5 text-red-500 fill-red-500" />,
          title: `${incentiveName} recebido`,
          description: `${notification.userNickname} te deu "${incentiveName}" ${context}`,
          bgColor: IncentiveIconComponent ? "bg-yellow-500/10" : "bg-red-500/10",
          borderColor: IncentiveIconComponent ? "border-yellow-200/50" : "border-red-200/50",
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

  const groupNotificationsByDate = (notifs: NotificationItem[]) => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split("T")[0];
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const groups: Record<string, NotificationItem[]> = {
      Hoje: [],
      Ontem: [],
      "Esta semana": [],
      "Mais antigas": [],
    };

    for (const n of notifs) {
      const dateStr = new Date(n.createdAt).toISOString().split("T")[0];
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
          <div className="flex items-center justify-center py-12">
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
                const groupNotifs = groups[label];
                if (groupNotifs.length === 0) return null;
                return (
                  <div key={label}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2 sticky top-0 bg-background/80 backdrop-blur py-1">
                      {label}
                    </p>
                    <div className="space-y-2">
                      {groupNotifs.map((notification) => {
                        const content = getNotificationContent(notification);
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
                              {/* User Avatar */}
                              <div className="flex-shrink-0">
                                {notification.userPhoto ? (
                                  <img
                                    src={notification.userPhoto}
                                    alt={notification.userNickname}
                                    className={`h-12 w-12 rounded-full object-cover border ${
                                      isRead
                                        ? "border-border/20 opacity-60"
                                        : "border-border/40"
                                    }`}
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
