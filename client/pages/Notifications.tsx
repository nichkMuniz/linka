import * as React from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { MessageCircle, UserPlus, Zap, Swords, SmilePlus, ChevronLeft, AtSign, Send, Dumbbell, Heart, Clock, CheckCircle2, XCircle } from "lucide-react";
import { INCENTIVE_CONFIG } from "@/lib/incentive-config";
import { getNotificationsDb, markNotificationsAsReadDb, clearNotificationsDb, getFollowingIdsDb, invalidateQueryCache, type NotificationItem } from "@/lib/ritmofit-db";
import { notificationBody } from "@/lib/notification-copy";
import { supabase } from "@/lib/supabase";
import { UserAvatar } from "@/components/shared/user-avatar";
import { FollowButton } from "@/components/shared/follow-button";
import { NotificationsSkeleton } from "@/components/shared/animated-loading";
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
import { useLanguage } from "@/lib/language-context";
import { hapticLight } from "@/lib/haptics";

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [followingIds, setFollowingIds] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(true);
  const [isClearing, setIsClearing] = React.useState(false);
  const [clearDialogOpen, setClearDialogOpen] = React.useState(false);
  const channelRef = React.useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);

  // Reusable loader so it can be triggered both on mount and via pull-to-refresh.
  const loadNotifications = React.useCallback(async () => {
    try {
      const [data, ids] = await Promise.all([
        getNotificationsDb(),
        getFollowingIdsDb(),
      ]);
      setNotifications(data);
      setFollowingIds(new Set(ids));
      // Só DEPOIS de a lista chegar: marcar como lida invalida o cache de
      // notificações, e uma leitura ainda em voo regravaria o payload antigo
      // (com read=false) por cima da invalidação.
      await markNotificationsAsReadDb();
    } catch (err: any) {
      console.error("Error loading notifications:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!user) return;

    // Always clean up any previous channel before creating a new one.
    // This prevents "cannot add callbacks after subscribe()" on iOS when the
    // effect re-runs (Capacitor app lifecycle) before the previous async
    // removeChannel completes.
    if (channelRef.current) {
      supabase?.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    let isMounted = true;

    (async () => {
      try {
        const [data, ids] = await Promise.all([
          getNotificationsDb(),
          getFollowingIdsDb(),
        ]);
        if (isMounted) {
          setNotifications(data);
          setFollowingIds(new Set(ids));
        }
        // Ver o comentário em loadNotifications: marcar como lido só depois de
        // a lista estar em mãos, senão o fetch em voo repõe o cache velho.
        await markNotificationsAsReadDb();
      } catch (err: any) {
        console.error("Error loading notifications:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    // Use Math.random() instead of Date.now() so the channel name is always
    // unique even when the effect fires twice within the same millisecond
    // (common in Capacitor on iOS when the app comes back from background).
    let realtimeDebounce: ReturnType<typeof setTimeout> | null = null;
    const channelName = `notifications-${user.id.slice(0, 8)}-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      ?.channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          if (!isMounted) return;
          if (realtimeDebounce) clearTimeout(realtimeDebounce);
          realtimeDebounce = setTimeout(async () => {
            if (!isMounted) return;
            // getNotificationsDb() é cacheado (60s): sem invalidar, a nova
            // notificação que acabou de chegar não apareceria na lista.
            invalidateQueryCache("notifications");
            const data = await getNotificationsDb();
            if (isMounted) setNotifications(data);
            // A notificação chegou com a tela aberta: o usuário está vendo, então
            // ela já nasce lida — senão o badge do sino acendia por baixo e
            // continuava aceso depois que ele saísse da tela.
            await markNotificationsAsReadDb();
          }, 1000);
        },
      )
      .subscribe();

    channelRef.current = channel ?? null;

    return () => {
      isMounted = false;
      if (realtimeDebounce) clearTimeout(realtimeDebounce);
      if (channelRef.current) {
        supabase?.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      // Última varredura ao sair da tela: cobre o que chegou nos segundos
      // finais (ou antes do debounce do realtime disparar). Quem sai daqui
      // nunca leva o sinalizador de pendência junto.
      markNotificationsAsReadDb().catch(() => { /* já logado internamente */ });
    };
  }, [user]);

  // Pull-to-refresh — o gesto é conduzido por refs + estilo imperativo no DOM.
  // Um setState por touchmove re-renderizava a lista inteira de notificações a
  // ~60fps durante o arrasto (mesmo padrão já corrigido no Perfil).
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const pullStartY = React.useRef(0);
  const isPullingRef = React.useRef(false);
  const pullDistanceRef = React.useRef(0);
  const pullIndicatorRef = React.useRef<HTMLDivElement>(null);
  const pullSpinnerRef = React.useRef<HTMLDivElement>(null);
  const PULL_THRESHOLD = 72;

  const onTouchStart = React.useCallback((e: React.TouchEvent) => {
    const scrollEl = scrollRef.current?.closest("[data-feed-scroll]") as HTMLElement | null;
    const scrollTop = scrollEl ? scrollEl.scrollTop : window.scrollY;
    if (scrollTop > 0) return;
    pullStartY.current = e.touches[0].clientY;
    isPullingRef.current = true;
    pullDistanceRef.current = 0;
    if (pullIndicatorRef.current) pullIndicatorRef.current.style.transition = "none";
  }, []);

  const onTouchMove = React.useCallback((e: React.TouchEvent) => {
    if (!isPullingRef.current) return;
    const delta = e.touches[0].clientY - pullStartY.current;
    const dist = delta > 0 ? Math.min(delta * 0.4, PULL_THRESHOLD + 20) : 0;
    pullDistanceRef.current = dist;
    if (pullIndicatorRef.current) pullIndicatorRef.current.style.height = `${dist}px`;
    if (pullSpinnerRef.current) {
      pullSpinnerRef.current.style.transform = `rotate(${(dist / PULL_THRESHOLD) * 360}deg)`;
      pullSpinnerRef.current.style.opacity = String(Math.min(dist / PULL_THRESHOLD, 1));
    }
  }, []);

  const onTouchEnd = React.useCallback(() => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;
    if (pullDistanceRef.current >= PULL_THRESHOLD) {
      hapticLight();
      invalidateQueryCache("notifications");
      loadNotifications();
    }
    pullDistanceRef.current = 0;
    if (pullIndicatorRef.current) {
      pullIndicatorRef.current.style.transition = "height .2s ease";
      pullIndicatorRef.current.style.height = "0px";
    }
    if (pullSpinnerRef.current) pullSpinnerRef.current.style.opacity = "0";
  }, [loadNotifications]);

  const getIncentiveTypeName = (type: number): string => {
    const map: Record<number, Parameters<typeof t>[0]> = {
      1: "incentive_1", 2: "incentive_2", 3: "incentive_3",
      4: "incentive_4", 5: "incentive_5", 6: "incentive_6",
    };
    return map[type] ? t(map[type]) : t("incentive_default");
  };

  const getIncentiveIcon = (type: number) => {
    const cfg = INCENTIVE_CONFIG[type as keyof typeof INCENTIVE_CONFIG];
    if (!cfg) return undefined;
    return { Icon: cfg.Icon, color: cfg.color };
  };

  // Só o ícone: o texto de cada notificação é montado (e traduzido) em buildDescription.
  const getNotificationIcon = (notification: NotificationItem): React.ReactElement => {
    switch (notification.type) {
      case 1:
        return <UserPlus className="h-5 w-5 text-blue-500" />;
      case 2: {
        const incentiveIconData = notification.incentiveType
          ? getIncentiveIcon(notification.incentiveType)
          : null;
        const IncentiveIconComponent = incentiveIconData?.Icon;
        return IncentiveIconComponent
          ? <IncentiveIconComponent className={`h-5 w-5 ${incentiveIconData!.color}`} />
          : <Zap className="h-5 w-5 text-yellow-500" />;
      }
      case 3:
        return <MessageCircle className="h-5 w-5 text-purple-500" />;
      case 4:
      case 5:
        return <Swords className="h-5 w-5 text-orange-500" />;
      case 6:
      case 7:
        return <SmilePlus className="h-5 w-5 text-pink-500" />;
      case 8:
        return <MessageCircle className="h-5 w-5 text-brand" />;
      case 9:
        return <AtSign className="h-5 w-5 text-cyan-400" />;
      case 10:
        return <Send className="h-5 w-5 text-sky-400" />;
      case 11:
        return <Dumbbell className="h-5 w-5 text-emerald-400" />;
      case 12:
        return <Heart className="h-5 w-5 text-rose-400" />;
      case 13:
        return <Clock className="h-5 w-5 text-amber-400" />;
      case 14:
        return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
      case 15:
        return <XCircle className="h-5 w-5 text-red-400" />;
      default:
        return <Zap className="h-5 w-5 text-gray-500" />;
    }
  };

  // Formato compacto para notificações ("5m", "2h", "3d") — diferente do formatTimeAgo de utils.ts que usa "dd/mm/yy"
  const formatTimeAgo = (date: string): string => {
    const now = new Date();
    const notifTime = new Date(date);
    const diffMs = now.getTime() - notifTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t("notif_time_now");
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;

    return notifTime.toLocaleDateString(language === "en" ? "en-US" : "pt-BR", {
      month: "short",
      day: "numeric",
    });
  };

  /**
   * Destaca o apelido dentro da descrição sem passar por HTML.
   * A versão anterior usava dangerouslySetInnerHTML: como o apelido é um campo
   * livre do usuário, qualquer markup nele era injetado e executado na WebView.
   */
  const renderDescription = (description: string, nickname: string): React.ReactNode => {
    const idx = nickname ? description.indexOf(nickname) : -1;
    if (idx === -1) return description;
    return (
      <>
        {description.slice(0, idx)}
        <strong>{nickname}</strong>
        {description.slice(idx + nickname.length)}
      </>
    );
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
      if (n.type === 2 && n.incentiveType && (n.postId || n.shotId || n.flowId)) {
        const postKey = n.postId ?? n.shotId ?? n.flowId ?? "";
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
    // Types 8 / 12 / 13 (comentário, curtida e expiração de promoção) — abrem a Vitrine
    if (notification.type === 8 || notification.type === 12 || notification.type === 13) {
      navigate("/vitrine");
      return;
    }
    // Type 10 (mensagem privada) — abre a conversa com o remetente
    if (notification.type === 10) {
      navigate(`/comunidade?user=${notification.userId}`);
      return;
    }
    // Types 14 / 15 (check-in classificado ou desclassificado) — abre o check-in avaliado
    if (notification.type === 14 || notification.type === 15) {
      if (notification.checkInId) {
        navigate("/comunidade", { state: { openCheckIn: notification.checkInId } });
      } else {
        navigate("/comunidade?tab=duels");
      }
      return;
    }
    // Type 11 (check-in de um membro do duelo) — abre o check-in
    if (notification.type === 11) {
      if (notification.checkInId) {
        navigate("/comunidade", { state: { openCheckIn: notification.checkInId } });
      } else {
        navigate("/comunidade?tab=duels");
      }
      return;
    }
    // Type 1 (new follower) - navigate to user profile
    if (notification.type === 1) {
      navigate(`/usuario/${notification.userId}`);
    }
    // Type 4 (duel invite) or type 5 (join request) - navigate to community requests tab
    else if (notification.type === 4 || notification.type === 5) {
      navigate("/comunidade?tab=requests");
    }
    // Type 7 (duel check-in reaction) — abre o check-in que recebeu a reação
    else if (notification.type === 7) {
      if (notification.checkInId) {
        navigate("/comunidade", { state: { openCheckIn: notification.checkInId } });
      } else {
        navigate("/comunidade?tab=duels");
      }
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
        // Incentive on shot → navigate to shots screen with incentives drawer open
        navigate("/shots", { state: { openIncentives: true, shotId: notification.shotId } });
      }
    }
    // Type 3 (comment) - navigate to post and open comments modal
    else if (notification.type === 3) {
      // Comentário em check-in de duelo → abre o check-in com os comentários
      if (notification.checkInId) {
        navigate("/comunidade", { state: { openCheckIn: notification.checkInId } });
      } else if (notification.postId) {
        navigate(`/post/${notification.postId}`, { state: { openComments: true } });
      } else if (notification.flowId) {
        navigate("/", { state: { openFlow: notification.flowId, openComments: true } });
      } else {
        navigate(`/usuario/${notification.userId}`);
      }
    }
    // Type 2 (incentive) - navigate to post and open likes/incentives modal
    else if (notification.type === 2) {
      if (notification.postId) {
        navigate(`/post/${notification.postId}`, { state: { openLikes: true } });
      } else if (notification.flowId) {
        navigate("/", { state: { openFlow: notification.flowId } });
      } else {
        navigate(`/usuario/${notification.userId}`);
      }
    }
    else if (notification.postId) {
      navigate(`/post/${notification.postId}`);
    } else if (notification.flowId) {
      navigate("/", { state: { openFlow: notification.flowId } });
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
          title: t("notif_cleared_title"),
          description: t("notif_cleared_desc"),
        });
      } else {
        toast({
          title: t("error"),
          description: t("notif_clear_error"),
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("Error clearing notifications:", err);
      toast({
        title: t("error"),
        description: t("notif_clear_error"),
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  // Icon circle style and card background per notification type
  const getTypeStyle = (type: number) => {
    switch (type) {
      case 1: return { iconBg: "rgba(95,140,255,.18)", iconColor: "#6ea8ff" };
      case 2: return { iconBg: "rgba(95,214,160,.16)", iconColor: "#5fd6a0" };
      case 3: return { iconBg: "rgba(176,140,255,.16)", iconColor: "#b08cff" };
      case 4:
      case 5: return { iconBg: "rgba(255,138,42,.16)", iconColor: "#ffb15e" };
      case 6:
      case 7: return { iconBg: "rgba(255,122,180,.16)", iconColor: "#ff8cb4" };
      case 8: return { iconBg: "rgba(249,115,22,.16)", iconColor: "#f97316" };
      case 9: return { iconBg: "rgba(34,211,238,.16)", iconColor: "#22d3ee" };
      case 10: return { iconBg: "rgba(56,189,248,.16)", iconColor: "#38bdf8" };
      case 11: return { iconBg: "rgba(52,211,153,.16)", iconColor: "#34d399" };
      case 12: return { iconBg: "rgba(251,113,133,.16)", iconColor: "#fb7185" };
      case 13: return { iconBg: "rgba(251,191,36,.16)", iconColor: "#fbbf24" };
      case 14: return { iconBg: "rgba(52,211,153,.16)", iconColor: "#34d399" };
      case 15: return { iconBg: "rgba(248,113,113,.16)", iconColor: "#f87171" };
      default: return { iconBg: "rgba(255,255,255,.1)", iconColor: "rgba(255,255,255,.7)" };
    }
  };

  const getCardStyle = (type: number, isRead: boolean): React.CSSProperties => {
    if (isRead) {
      return { background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" };
    }
    if (type === 1) {
      return { background: "linear-gradient(90deg,rgba(95,140,255,.12),rgba(255,255,255,.03))", border: "1px solid rgba(95,140,255,.18)" };
    }
    return {
      background: "linear-gradient(rgba(255,255,255,.10),rgba(255,255,255,.04))",
      backdropFilter: "blur(18px) saturate(160%)",
      WebkitBackdropFilter: "blur(18px) saturate(160%)",
      border: "1px solid rgba(255,255,255,.14)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,.22)",
    };
  };

  const buildDescription = (notification: NotificationItem & {
    groupedUsers?: Array<{ userId: string; userNickname: string; userPhoto?: string; incentiveTypes: number[] }>;
    groupedIncentiveTypes?: number[];
  }): string => {
    const name = notification.userNickname;

    // Caso agrupado (só existe na lista, não no banner de push): vários
    // incentivos na mesma publicação.
    if (notification.type === 2) {
      const groupedUsers = notification.groupedUsers ?? [];
      const totalReactions = groupedUsers.reduce((sum, u) => sum + u.incentiveTypes.length, 0);
      if (totalReactions > 1) {
        const others = totalReactions - 1;
        const context = notification.shotId
          ? t("notif_context_shot")
          : notification.flowId
            ? t("notif_context_flow")
            : t("notif_context_post");
        const incentiveName = getIncentiveTypeName(
          groupedUsers[0]?.incentiveTypes[0] ?? notification.incentiveType ?? 1,
        );
        return t("notif_desc_incentive_multi")
          .replace("{name}", name)
          .replace("{incentive}", incentiveName)
          .replace("{n}", String(others))
          .replace("{reactions}", others === 1 ? t("notif_reactions_one") : t("notif_reactions_many"))
          .replace("{context}", context);
      }
    }
    // Demais tipos: mesmo texto que o banner de push monta, via módulo comum.
    return notificationBody(
      t,
      {
        type: notification.type,
        post_id: notification.postId ?? null,
        shots_id: notification.shotId ?? null,
        flow_id: notification.flowId ?? null,
        duel_check_in_id: notification.checkInId ?? null,
        incentive_type: notification.incentiveType ?? null,
      },
      { name, groupName: notification.groupName ?? null },
    );
  };

  const GROUP_KEYS = [
    { key: "Hoje" as const, label: t("notif_group_today") },
    { key: "Ontem" as const, label: t("notif_group_yesterday") },
    { key: "Esta semana" as const, label: t("notif_group_week") },
    { key: "Mais antigas" as const, label: t("notif_group_older") },
  ];

  const getBadgeStyle = (type: number): React.CSSProperties => {
    switch (type) {
      case 1:  return { background: "#5b8cff" };
      case 2:  return { background: "#ffb15e" };
      case 3:  return { background: "#b08cff" };
      case 6:
      case 7:  return { background: "#ff8cb4" };
      case 8:  return { background: "#f97316" };
      case 9:  return { background: "#22d3ee" };
      case 10: return { background: "#38bdf8" };
      case 11: return { background: "#34d399" };
      case 12: return { background: "#fb7185" };
      case 13: return { background: "#fbbf24" };
      case 14: return { background: "#34d399" };
      case 15: return { background: "#f87171" };
      default: return { background: "rgba(255,255,255,.5)" };
    }
  };

  const isUserBased = (type: number) => [1, 2, 3, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].includes(type);

  return (
    <>
      {/* Page-specific fixed header — portalled to body to escape framer-motion transform context */}
      {createPortal(
        <header
          className="md:hidden flex items-center justify-between"
          style={{
            position: "fixed",
            zIndex: 50,
            top: "max(14px, calc(env(safe-area-inset-top) + 6px))",
            left: "14px",
            right: "14px",
            height: "50px",
            borderRadius: "25px",
            padding: "0 8px 0 8px",
            background: "linear-gradient(rgba(255,255,255,.11),rgba(255,255,255,.04))",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            border: "1px solid rgba(255,255,255,.12)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.24), 0 8px 24px -8px rgba(0,0,0,.5)",
          }}
        >
          <button
            onClick={() => {
              // Volta para a tela anterior de verdade. Se a página foi aberta
              // direto (deep link / push), não há histórico — cai no feed.
              if (window.history.length > 1) navigate(-1);
              else navigate("/");
            }}
            aria-label={t("back") ?? "Voltar"}
            className="w-10 h-10 flex items-center justify-center active:opacity-60"
            style={{ color: "#fff" }}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span style={{ fontSize: "16px", fontWeight: 700, color: "#fff" }}>
            {t("nav_notifications") ?? "Notificações"}
          </span>
          <button
            onClick={() => setClearDialogOpen(true)}
            disabled={isClearing}
            className="active:opacity-60 transition-opacity"
            style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,.6)", padding: "6px 12px" }}
          >
            {t("notif_page_clear")}
          </button>
        </header>,
        document.body
      )}

      <div
        ref={scrollRef}
        className="w-full max-w-2xl mx-auto relative"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Ambient aura — gradiente pintado direto, sem filter: blur (ver Index.tsx) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
          style={{ background: "radial-gradient(300px 300px at 8% 20%, rgba(216,86,122,.24), transparent 70%)" }}
        />

        {/* Pull-to-refresh indicator — altura/rotação escritas direto no DOM pelos handlers */}
        <div
          ref={pullIndicatorRef}
          className="flex items-center justify-center overflow-hidden"
          style={{ height: 0 }}
        >
          <div
            ref={pullSpinnerRef}
            className="h-6 w-6 rounded-full border-2 border-brand border-t-transparent"
            style={{ opacity: 0 }}
          />
        </div>

        <div className="relative px-4 pb-6">
          {loading ? (
            <NotificationsSkeleton />
          ) : notifications.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-16 mt-4"
              style={{ borderRadius: "22px", border: "1px dashed rgba(255,255,255,.14)" }}
            >
              <Zap className="h-10 w-10 mb-3" style={{ color: "rgba(255,255,255,.2)" }} />
              <p className="text-sm font-semibold text-white/70">{t("notif_page_empty")}</p>
              <p className="text-xs mt-1 text-center" style={{ color: "rgba(255,255,255,.4)" }}>
                {t("notif_page_empty_sub")}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {(() => {
                const groups = groupNotificationsByDate(notifications);
                return GROUP_KEYS.map(({ key, label }) => {
                  const groupNotifs = collapseIncentives(groups[key]) as Array<NotificationItem & {
                    groupedCount?: number;
                    groupedNicknames?: string[];
                    groupedIncentiveTypes?: number[];
                    groupedUsers?: Array<{ userId: string; userNickname: string; userPhoto?: string; incentiveTypes: number[] }>;
                  }>;
                  if (groupNotifs.length === 0) return null;
                  return (
                    <div key={key}>
                      <p
                        className="px-1 mb-2"
                        style={{ fontSize: "12px", fontWeight: 700, letterSpacing: ".1em", color: "rgba(255,255,255,.4)" }}
                      >
                        {label}
                      </p>

                      <div className="space-y-2">
                        {groupNotifs.map((notification) => {
                          const isRead = notification.read === true;
                          const description = buildDescription(notification);
                          const cardStyle = getCardStyle(notification.type, isRead);
                          const typeStyle = getTypeStyle(notification.type);
                          const badgeStyle = getBadgeStyle(notification.type);
                          const typeIcon = getNotificationIcon(notification);
                          const groupedUsers = notification.groupedUsers ?? [];
                          const isGrouped = (notification.groupedCount ?? 1) > 1;
                          const isFollow = notification.type === 1;
                          const hasThumbnail = (notification.type === 2 || notification.type === 3 || notification.type === 9) && notification.postPhoto;

                          return (
                            /* div (não button): a notificação de novo seguidor precisa
                               conter um FollowButton real, e button dentro de button é
                               HTML inválido — o toque no "Seguir" era engolido pelo card. */
                            <div
                              key={notification.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => handleNotificationClick(notification)}
                              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleNotificationClick(notification); }}
                              className="w-full text-left active:scale-[0.99] transition-all cursor-pointer"
                              style={{ display: "flex", alignItems: "center", gap: "13px", padding: "13px", borderRadius: "18px", ...cardStyle, opacity: isRead ? 0.65 : 1 }}
                            >
                              {/* Left: avatar(s) or icon circle */}
                              {isUserBased(notification.type) ? (
                                isGrouped ? (
                                  /* Stacked avatars: container = 30 + 30 - 16 = 44px, matches single avatar width */
                                  <div className="flex-shrink-0 flex items-center" style={{ width: "44px" }}>
                                    <UserAvatar
                                      photo={groupedUsers[0]?.userPhoto}
                                      nickname={groupedUsers[0]?.userNickname ?? notification.userNickname}
                                      className="!h-[30px] !w-[30px] border-2 border-[#06070c] relative z-[1]"
                                    />
                                    <UserAvatar
                                      photo={groupedUsers[1]?.userPhoto ?? groupedUsers[0]?.userPhoto}
                                      nickname={groupedUsers[1]?.userNickname ?? notification.userNickname}
                                      className="!h-[30px] !w-[30px] border-2 border-[#06070c] -ml-4"
                                    />
                                  </div>
                                ) : (
                                  /* Single avatar + type badge overlay */
                                  <div className="flex-shrink-0 relative" style={{ width: 44, height: 44 }}>
                                    <UserAvatar
                                      photo={notification.userPhoto}
                                      nickname={notification.userNickname}
                                      className="!h-11 !w-11"
                                    />
                                    <span
                                      className="absolute flex items-center justify-center"
                                      style={{ bottom: -2, right: -2, width: 20, height: 20, borderRadius: "50%", border: "2px solid #06070c", ...badgeStyle, color: "#fff" }}
                                    >
                                      {React.cloneElement(typeIcon as React.ReactElement<{ className?: string }>, { className: "w-[10px] h-[10px]" })}
                                    </span>
                                  </div>
                                )
                              ) : (
                                /* Non-user notification: colored icon circle */
                                <span
                                  className="flex-shrink-0 flex items-center justify-center"
                                  style={{ width: 40, height: 40, borderRadius: "50%", background: typeStyle.iconBg, color: typeStyle.iconColor }}
                                >
                                  {typeIcon}
                                </span>
                              )}

                              {/* Text */}
                              <div className="flex-1 min-w-0">
                                <p className="leading-snug" style={{ fontSize: "13.5px", color: "#fff" }}>
                                  {renderDescription(description, notification.userNickname)}
                                </p>
                                <p className="mt-0.5" style={{ fontSize: "11px", color: "rgba(255,255,255,.45)" }}>
                                  {formatTimeAgo(notification.createdAt)}
                                </p>
                              </div>

                              {/* Right side: follow button OR post thumbnail OR unread dot */}
                              {isFollow ? (
                                <span
                                  className="flex-shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <FollowButton
                                    targetUserId={notification.userId}
                                    initialIsFollowing={followingIds.has(notification.userId)}
                                  />
                                </span>
                              ) : hasThumbnail ? (
                                <div className="flex-shrink-0 relative" style={{ width: 44, height: 44 }}>
                                  <img
                                    src={notification.postPhoto!}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    style={{ borderRadius: "13px" }}
                                  />
                                  {notification.type === 2 && (
                                    <span
                                      className="absolute flex items-center justify-center"
                                      style={{ bottom: -4, right: -4, width: 20, height: 20, borderRadius: "50%", border: "2px solid #06070c", background: "#ffb15e", color: "#0a0b12" }}
                                    >
                                      {React.cloneElement(typeIcon as React.ReactElement<{ className?: string }>, { className: "w-[10px] h-[10px]" })}
                                    </span>
                                  )}
                                </div>
                              ) : !isRead ? (
                                <span
                                  className="flex-shrink-0"
                                  style={{ width: 8, height: 8, borderRadius: "50%", background: "#5b8cff", flexShrink: 0 }}
                                />
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>

        <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("notif_page_clear_title")}</AlertDialogTitle>
              <AlertDialogDescription>{t("notif_page_clear_desc")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleClearNotifications}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t("notif_page_clear_confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}
