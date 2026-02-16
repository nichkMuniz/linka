import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  PlusSquare,
  Dumbbell,
  Search,
  MessageCircle,
  Bell,
  Video,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageWithFallback } from "@/components/image-with-fallback";
import { getUnreadMessageCountDb, getUserProfileDb } from "@/lib/ritmofit-db";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import Reels from "@/pages/Reels";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/reels", label: "Clips", icon: Video },
  { to: "/postar", label: "Nova", icon: PlusSquare },
  { to: "/metas", label: "Metas", icon: Dumbbell },
  { to: "/loja", label: "Loja", icon: ShoppingBag },
];

function isActivePath(currentPath: string, to: string) {
  if (to === "/") return currentPath === "/";
  return currentPath === to || currentPath.startsWith(`${to}/`);
}

export function ReelsLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [profilePhoto, setProfilePhoto] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadUnreadCount = async () => {
      try {
        const count = await getUnreadMessageCountDb();
        setUnreadCount(count);
      } catch (err) {
        console.error("Error loading unread message count:", err);
      }
    };

    loadUnreadCount();

    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    const loadProfilePhoto = async () => {
      if (!user) return;
      try {
        const profile = await getUserProfileDb(user.id);
        if (profile?.photo) {
          setProfilePhoto(profile.photo);
        }
      } catch (err) {
        console.error("Error loading profile photo:", err);
      }
    };

    loadProfilePhoto();
  }, [user]);

  return (
    <div className="w-screen h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-border/60 bg-background/75 backdrop-blur supports-[backdrop-filter]:bg-background/55">
        <div className="relative mx-auto flex h-16 w-full max-w-6xl items-center justify-center gap-4 px-4">
          {/* Left: Profile Avatar */}
          <div className="absolute left-4">
            <Link
              to="/perfil"
              aria-label="Perfil"
              className="flex-shrink-0 rounded-full hover:opacity-80 transition"
            >
              {profilePhoto ? (
                <ImageWithFallback
                  src={profilePhoto}
                  alt="Seu Perfil"
                  fallback="/placeholder.svg"
                  className="h-10 w-10 rounded-full object-cover border-2 border-border/60"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-muted border-2 border-border/60 flex items-center justify-center">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Você
                  </span>
                </div>
              )}
            </Link>
          </div>

          {/* Center: Brand */}
          <button
            onClick={() => {
              window.location.href = "/";
            }}
            aria-label="Ir para Home"
            className="flex items-center justify-center rounded-2xl px-3 py-1 transition hover:bg-muted/50 cursor-pointer"
          >
            <span className="text-lg font-bold tracking-tight text-foreground">
              Ritmo
              <span className="text-brand">Fit</span>
            </span>
          </button>

          {/* Right: Search and Notifications */}
          <div className="absolute right-4 flex items-center gap-1">
            <Link to="/buscar">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-full"
                aria-label="Buscar"
              >
                <Search className="h-5 w-5" />
              </Button>
            </Link>

            <Link to="/notificacoes">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-full"
                aria-label="Notificações"
              >
                <Bell className="h-5 w-5" />
              </Button>
            </Link>

            <Link to="/mensagens">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-full relative"
                aria-label="Mensagens"
              >
                <MessageCircle className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-xs font-semibold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
            </Link>
          </div>

          <nav className="hidden items-center justify-center gap-2 lg:flex">
            {navItems.map((item) => {
              const active = isActivePath(location.pathname, item.to);
              const Icon = item.icon;

              return (
                <Button
                  key={item.to}
                  asChild
                  variant={active ? "secondary" : "ghost"}
                  className="h-11 w-11 rounded-full p-0"
                >
                  <Link to={item.to} aria-label={item.label}>
                    <Icon className="h-5 w-5" />
                  </Link>
                </Button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content - Reels */}
      <main className="flex-1 w-full overflow-hidden">
        <Reels />
      </main>

      {/* Footer Navigation */}
      <nav className="fixed bottom-[env(safe-area-inset-bottom)] left-0 right-0 z-40 border-t border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/65 lg:hidden">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-5 px-1">
          {navItems.map((item) => {
            const active = isActivePath(location.pathname, item.to);
            const Icon = item.icon;

            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2 text-[11px] transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid h-11 w-11 place-items-center rounded-2xl ring-1 transition",
                    active
                      ? "bg-brand text-white ring-brand/30"
                      : "bg-transparent ring-transparent",
                  )}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <span className="hidden md:block">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
