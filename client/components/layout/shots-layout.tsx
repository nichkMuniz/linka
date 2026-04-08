import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  PlusSquare,
  Dumbbell,
  Search,
  Bell,
  Video,
  ShoppingBag,
  Users2,
} from "lucide-react";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import { getUnreadMessageCountDb, getUnreadNotificationsCountDb, getUserProfileDb, subscribeToUnreadNotificationsDb } from "@/lib/ritmofit-db";
import { useAuth } from "@/hooks/useAuth";
import { useLayoutMode } from "@/hooks/useLayoutMode";
import { useLanguage } from "@/lib/language-context";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import Shots from "@/pages/Shots";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
};

const mobileNavItems: NavItem[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/shots", label: "Clips", icon: Video },
  { to: "/postar", label: "Nova", icon: PlusSquare },
  { to: "/metas", label: "Metas", icon: Dumbbell },
  { to: "/vitrine", label: "Vitrine", icon: ShoppingBag },
];

function isActivePath(currentPath: string, to: string) {
  if (to === "/") return currentPath === "/";
  return currentPath === to || currentPath.startsWith(`${to}/`);
}

export function ShotsLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const { layoutMode } = useLayoutMode();
  const { t } = useLanguage();
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = React.useState(0);
  const [profilePhoto, setProfilePhoto] = React.useState<string | null>(null);
  const { resolvedTheme } = useTheme();
  const logoSrc = resolvedTheme === "dark" ? "/logo-branco.png" : "/logo.png";
  const footerRef = React.useRef<HTMLDivElement>(null);
  const [footerHeight, setFooterHeight] = React.useState(0);

  React.useEffect(() => {
    const load = async () => {
      try {
        const [msg, notif] = await Promise.all([
          getUnreadMessageCountDb(),
          getUnreadNotificationsCountDb(),
        ]);
        setUnreadCount(msg);
        setUnreadNotificationsCount(notif);
      } catch (err) {
        console.error("Error loading unread counts:", err);
      }
    };
    load();
    const unsubscribe = subscribeToUnreadNotificationsDb(setUnreadNotificationsCount);
    const interval = setInterval(() => {
      getUnreadMessageCountDb().then(setUnreadCount).catch(console.error);
    }, 30000);
    return () => { clearInterval(interval); if (unsubscribe) unsubscribe(); };
  }, []);

  React.useEffect(() => {
    if (!user) return;
    getUserProfileDb(user.id)
      .then((p) => { if (p?.photo) setProfilePhoto(p.photo); })
      .catch(console.error);
  }, [user]);

  React.useEffect(() => {
    if (footerRef.current) setFooterHeight(footerRef.current.offsetHeight);
  }, []);

  const sidebarItems: NavItem[] = React.useMemo(() => [
    { to: "/", label: t("nav_home"), icon: Home },
    { to: "/shots", label: t("nav_clips"), icon: Video },
    { to: "/postar", label: t("nav_new"), icon: PlusSquare },
    { to: "/metas", label: t("nav_goals"), icon: Dumbbell },
    { to: "/vitrine", label: t("nav_store"), icon: ShoppingBag },
    { to: "/buscar", label: t("nav_search") ?? "Buscar", icon: Search },
    { to: "/notificacoes", label: "Notificações", icon: Bell, badge: unreadNotificationsCount },
    { to: "/comunidade", label: t("nav_community") ?? "Comunidade", icon: Users2, badge: unreadCount },
  ], [t, unreadNotificationsCount, unreadCount]);

  return (
    <>
      {/* ── DESKTOP LAYOUT (md+): sidebar + vídeo centralizado ── */}
      <div className="hidden md:flex h-screen bg-background overflow-hidden">

        {/* Sidebar — uses app theme */}
        <aside className="fixed top-0 left-0 z-40 flex h-full w-[244px] flex-col border-r border-border/40 bg-background px-3 py-6">
          {/* Logo */}
          <button
            onClick={() => { window.location.href = "/"; }}
            aria-label="Ir para Home"
            className="mb-6 flex items-center px-3 py-2 rounded-xl hover:bg-muted/50 transition cursor-pointer"
          >
            <img src={logoSrc} alt="LinKa" className="h-7" />
          </button>

          {/* Nav items */}
          <nav className="flex flex-col gap-1 flex-1">
            {sidebarItems.map((item) => {
              const active = isActivePath(location.pathname, item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-label={item.label}
                  className={cn(
                    "flex items-center gap-4 rounded-xl px-3 py-3 text-[15px] font-medium transition-colors",
                    active
                      ? "bg-muted text-foreground font-bold"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <span className="relative flex-shrink-0">
                    <Icon className="h-6 w-6" />
                    {item.badge && item.badge > 0 ? (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
                        {item.badge > 9 ? "9+" : item.badge}
                      </span>
                    ) : null}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Profile at bottom */}
          <Link
            to="/perfil"
            aria-label="Perfil"
            className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-muted/50"
          >
            {profilePhoto ? (
              <ImageWithFallback
                src={profilePhoto}
                alt="Seu Perfil"
                fallback="/placeholder.svg"
                className="h-9 w-9 rounded-full object-cover border border-border/40 flex-shrink-0"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-muted border border-border/40 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-muted-foreground">{t("nav_you")}</span>
              </div>
            )}
            <span className="text-[15px] font-medium text-muted-foreground truncate">
              {t("nav_profile") ?? "Perfil"}
            </span>
          </Link>
        </aside>

        {/* Main area: vídeo centralizado */}
        <div className="ml-[244px] flex flex-1 items-center justify-center">
          {/* Vídeo em proporção 9:16 */}
          <div
            className="relative bg-black rounded-xl overflow-hidden"
            style={{ height: "calc(100vh - 48px)", aspectRatio: "9/16" }}
          >
            <Shots footerHeight={0} isDesktop={true} />
          </div>
        </div>
      </div>

      {/* ── MOBILE LAYOUT (< md): fullscreen + bottom nav ── */}
      <div className="flex flex-col h-screen bg-background md:hidden overflow-hidden">
        <main className="flex-1 overflow-hidden relative">
          <Shots footerHeight={footerHeight} />
        </main>

        {layoutMode === "default" && (
          <nav
            ref={footerRef}
            className="fixed bottom-[env(safe-area-inset-bottom)] left-0 right-0 z-40 border-t border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/65"
          >
            <div className="grid w-full grid-cols-5 px-1">
              {mobileNavItems.map((item) => {
                const active = isActivePath(location.pathname, item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 py-2 text-[11px] transition-colors",
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className={cn(
                      "grid h-11 w-11 place-items-center rounded-2xl ring-1 transition",
                      active ? "bg-brand-gradient text-white ring-transparent" : "bg-transparent ring-transparent",
                    )}>
                      <Icon className="h-6 w-6" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </>
  );
}
