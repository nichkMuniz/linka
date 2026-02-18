import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, UserPlus, Zap, HeartHandshake, Flame, Trophy, Rocket, Target } from "lucide-react";
import { getNotificationsDb, markNotificationsAsReadDb, type NotificationItem } from "@/lib/ritmofit-db";
import { useAuth } from "@/hooks/useAuth";

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadNotifications = async () => {
      try {
        // Mark all notifications as read when page loads
        await markNotificationsAsReadDb();

        const data = await getNotificationsDb();
        setNotifications(data);
      } catch (err: any) {
        console.error("Error loading notifications:", err);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadNotifications();
      // Refresh notifications every 30 seconds
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    }
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
      case 2:
        const incentiveName = notification.incentiveType
          ? getIncentiveTypeName(notification.incentiveType)
          : "Incentivo";
        return {
          icon: <Heart className="h-5 w-5 text-red-500 fill-red-500" />,
          title: `${incentiveName} recebido`,
          description: `${notification.userNickname} te deu ${incentiveName.toLowerCase()} na sua postagem`,
          bgColor: "bg-red-500/10",
          borderColor: "border-red-200/50",
        };
      case 3:
        return {
          icon: <MessageCircle className="h-5 w-5 text-purple-500" />,
          title: "Novo comentário",
          description: `${notification.userNickname} comentou na sua postagem`,
          bgColor: "bg-purple-500/10",
          borderColor: "border-purple-200/50",
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

  const handleNotificationClick = (notification: NotificationItem) => {
    // Type 1 (new follower) - navigate to user profile
    if (notification.type === 1) {
      navigate(`/usuario/${notification.userId}`);
    }
    // Type 2 and 3 (incentive and comment) - navigate to post
    else if (notification.postId) {
      navigate(`/post/${notification.postId}`);
    } else {
      navigate(`/usuario/${notification.userId}`);
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
          <div className="space-y-2">
            {notifications.map((notification) => {
              const content = getNotificationContent(notification);
              const isRead = notification.read === true;
              const incentiveIcon = notification.type === 2 && notification.incentiveType
                ? getIncentiveIcon(notification.incentiveType)
                : null;

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
                            <p className={`text-sm font-medium mt-0.5 flex items-center gap-1.5 ${isRead ? "text-foreground/60" : "text-foreground"}`}>
                              {content.description}
                              {incentiveIcon && (
                                <>
                                  <incentiveIcon.Icon className={`h-4 w-4 ${incentiveIcon.color}`} />
                                  <span className="text-xs">{getIncentiveTypeName(notification.incentiveType!)}</span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                        <p className={`text-xs flex-shrink-0 whitespace-nowrap ml-2 ${isRead ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
                          {formatTimeAgo(notification.createdAt)}
                        </p>
                      </div>

                      {/* Post Thumbnail - only for incentive and comment notifications */}
                      {notification.postPhoto && (notification.type === 2 || notification.type === 3) && (
                        <div className="mt-3 ml-7">
                          <img
                            src={notification.postPhoto}
                            alt="Post"
                            className={`h-16 w-16 rounded-md object-cover border ${
                              isRead
                                ? "border-border/20 opacity-50"
                                : "border-border/40"
                            }`}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
