import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Plus } from "lucide-react";
import { getNotificationsDb, type NotificationItem } from "@/lib/ritmofit-db";
import { useAuth } from "@/hooks/useAuth";

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadNotifications = async () => {
      try {
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

  const getNotificationText = (notification: NotificationItem) => {
    switch (notification.type) {
      case "like":
        return `${notification.userNickname} deu um incentivo na sua postagem`;
      case "comment":
        return `${notification.userNickname} comentou: "${notification.text}"`;
      case "post":
        return `${notification.userNickname} postou algo novo`;
      default:
        return "";
    }
  };

  const getNotificationIcon = (notification: NotificationItem) => {
    switch (notification.type) {
      case "like":
        return <Heart className="h-5 w-5 text-red-500 fill-red-500" />;
      case "comment":
        return <MessageCircle className="h-5 w-5 text-blue-500" />;
      case "post":
        return <Plus className="h-5 w-5 text-green-500" />;
      default:
        return null;
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
    if (notification.postId) {
      navigate(`/post/${notification.postId}`);
    } else {
      navigate(`/usuario/${notification.userId}`);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="space-y-4 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Notificações</h1>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">Carregando notificações...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 rounded-lg border border-border/60 bg-muted/30">
            <p className="text-sm text-muted-foreground">
              Nenhuma notificação ainda
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Suas atividades aparecerão aqui
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className="w-full text-left transition-colors hover:bg-muted/50 rounded-lg p-3 border border-border/40"
              >
                <div className="flex items-start gap-3">
                  {/* User Avatar */}
                  {notification.userPhoto ? (
                    <img
                      src={notification.userPhoto}
                      alt={notification.userNickname}
                      className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-muted flex-shrink-0" />
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <div className="flex-shrink-0 mt-1">
                          {getNotificationIcon(notification)}
                        </div>
                        <p className="text-sm text-foreground break-words">
                          {getNotificationText(notification)}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground flex-shrink-0">
                        {formatTimeAgo(notification.createdAt)}
                      </p>
                    </div>

                    {/* Post Thumbnail */}
                    {notification.postPhoto && (
                      <div className="mt-2">
                        <img
                          src={notification.postPhoto}
                          alt="Post"
                          className="h-20 w-20 rounded-md object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
