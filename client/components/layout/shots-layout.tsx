import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Home,
  PlusSquare,
  Dumbbell,
  Search,
  Bell,
  Video,
  ShoppingBag,
  Users2,
  PanelLeftOpen,
  PanelLeftClose,
} from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
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
  const [sidebarExpanded, setSidebarExpanded] = React.useState(() => {
    const stored = localStorage.getItem("ritmofit_sidebar_expanded");
    if (stored !== null) return stored === "true";
    return window.innerWidth >= 1024;
  });

  const toggleSidebar = () => {
    setSidebarExpanded((prev) => {
      localStorage.setItem("ritmofit_sidebar_expanded", String(!prev));
      return !prev;
    });
  };

  const [unreadCount, setUnreadCount] = React.useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = React.useState(0);
  const [profilePhoto, setProfilePhoto] = React.useState<string | null>(null);
  const [profileGender, setProfileGender] = React.useState<string | null>(null);
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
      .then((p) => {
        if (p?.photo) setProfilePhoto(p.photo);
        if (p?.gender) setProfileGender(String(p.gender));
      })
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
        <aside
          className={cn(
            "fixed top-0 left-0 z-40 flex h-full flex-col border-r border-border/40 bg-background py-6 transition-all duration-300",
            sidebarExpanded ? "w-[244px] px-3" : "w-[68px] px-2",
          )}
        >
          {/* Logo */}
          <button
            onClick={() => { window.location.href = "/"; }}
            aria-label="Ir para Home"
            className={cn(
              "mb-6 flex items-center rounded-xl py-2 hover:bg-muted/50 transition cursor-pointer",
              sidebarExpanded ? "px-3" : "justify-center px-0",
            )}
          >
            {sidebarExpanded
              ? <img src={logoSrc} alt="LinKa" className="h-7" />
              : <img src={logoSrc} alt="LinKa" className="h-6 w-6 object-contain" />
            }
          </button>

          {/* Nav items */}
          <nav className="flex flex-col gap-1 flex-1">
            {sidebarItems.map((item) => {
              const active = isActivePath(location.pathname, item.to);
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.to}
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ x: sidebarExpanded ? 2 : 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Link
                    to={item.to}
                    aria-label={item.label}
                    title={!sidebarExpanded ? item.label : undefined}
                    className={cn(
                      "flex items-center rounded-xl py-3 text-[15px] font-medium transition-colors",
                      sidebarExpanded ? "gap-4 px-3" : "justify-center px-0",
                      active
                        ? "bg-muted text-foreground"
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
                    {sidebarExpanded && <span>{item.label}</span>}
                  </Link>
                </motion.div>
              );
            })}
          </nav>

          {/* Toggle sidebar button */}
          <button
            onClick={toggleSidebar}
            aria-label={sidebarExpanded ? "Recolher menu" : "Expandir menu"}
            title={sidebarExpanded ? "Recolher menu" : "Expandir menu"}
            className={cn(
              "flex items-center rounded-xl py-3 mb-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors",
              sidebarExpanded ? "gap-4 px-3" : "justify-center px-0",
            )}
          >
            {sidebarExpanded
              ? <><PanelLeftClose className="h-6 w-6 flex-shrink-0" /><span className="text-[15px] font-medium">Recolher</span></>
              : <PanelLeftOpen className="h-6 w-6" />
            }
          </button>

          {/* Profile at bottom */}
          <Link
            to="/perfil"
            aria-label="Perfil"
            title={!sidebarExpanded ? (t("nav_profile") ?? "Perfil") : undefined}
            className={cn(
              "flex items-center rounded-xl py-3 transition hover:bg-muted/50",
              sidebarExpanded ? "gap-3 px-3" : "justify-center px-0",
            )}
          >
            <UserAvatar
              photo={profilePhoto}
              gender={profileGender}
              size="sm"
              className="h-9 w-9 border border-border/60 flex-shrink-0"
            />
            {sidebarExpanded && (
              <span className="text-[15px] font-medium text-muted-foreground truncate">
                {t("nav_profile") ?? "Perfil"}
              </span>
            )}
          </Link>
        </aside>

        {/* Main area: vídeo centralizado */}
        <div
          className={cn(
            "flex flex-1 items-center justify-center transition-all duration-300",
            sidebarExpanded ? "ml-[244px]" : "ml-[68px]",
          )}
        >
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
                    aria-label={item.label}
                    className="relative flex flex-col items-center justify-center py-2 text-[11px]"
                  >
                    <motion.span
                      whileTap={{ scale: 0.78 }}
                      animate={active ? { y: -6, scale: 1 } : { y: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 420, damping: 26 }}
                      className={cn(
                        "relative grid h-12 w-12 place-items-center rounded-2xl transition-colors duration-200",
                        active ? "bg-brand-gradient text-white" : "bg-transparent text-muted-foreground",
                      )}
                      style={active ? {
                        boxShadow: "0 6px 24px rgba(58,141,255,0.45), 0 2px 8px rgba(123,63,242,0.35)",
                      } : undefined}
                    >
                      <Icon className="h-[22px] w-[22px]" />
                    </motion.span>

                    {active && (
                      <motion.span
                        layoutId="shots-nav-glow"
                        className="absolute bottom-0 h-[3px] w-10 rounded-t-full bg-brand-gradient opacity-60 blur-[2px]"
                        initial={{ opacity: 0, scaleX: 0.4 }}
                        animate={{ opacity: 0.6, scaleX: 1 }}
                        transition={{ duration: 0.25 }}
                      />
                    )}
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
