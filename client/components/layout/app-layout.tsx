import {
  Home,
  PlusSquare,
  Dumbbell,
  Search,
  Users2,
  Bell,
  Video,
  ShoppingBag,
  Timer,
  Trash2,
} from "lucide-react";
import * as React from "react";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Link, Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/layout/page-transition";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { getUnreadMessageCountDb, getUnreadNotificationsCountDb, getUserProfileDb, subscribeToUnreadNotificationsDb, recordAccessSessionDb } from "@/lib/ritmofit-db";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useLayoutMode } from "@/hooks/useLayoutMode";
import { useLanguage } from "@/lib/language-context";
import { useWorkout } from "@/lib/workout-context";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
};

function isActivePath(currentPath: string, to: string) {
  if (to === "/") return currentPath === "/";
  return currentPath === to || currentPath.startsWith(`${to}/`);
}

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { layoutMode } = useLayoutMode();
  const { t } = useLanguage();
  const { resolvedTheme } = useTheme();
  const logoSrc = resolvedTheme === "dark" ? "/logo-branco.png" : "/logo.png";
  const {
    workoutMinimized, setWorkoutMinimized, setPendingReopen, setWorkoutModalOpen,
    globalRestTimerRemaining, setGlobalRestTimerRemaining, globalRestTimerActive, setGlobalRestTimerActive, globalRestTimerTotal, setGlobalRestTimerTotal,
    workoutSeries, resetWorkoutState,
  } = useWorkout();

  // Auto-reopen workout modal when rest timer reaches 0 while minimized
  const prevRestTimerActiveRef = React.useRef(globalRestTimerActive);
  React.useEffect(() => {
    const wasActive = prevRestTimerActiveRef.current;
    prevRestTimerActiveRef.current = globalRestTimerActive;
    if (wasActive && !globalRestTimerActive && workoutMinimized && globalRestTimerTotal > 0) {
      setGlobalRestTimerTotal(0);
      setWorkoutMinimized(false);
      setPendingReopen(true);
      if (location.pathname !== "/metas") {
        navigate("/metas");
      }
    }
  }, [globalRestTimerActive]);

  const [headerHidden, setHeaderHidden] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = React.useState(0);
  const [profilePhoto, setProfilePhoto] = React.useState<string | null>(null);
  const [profileGender, setProfileGender] = React.useState<string | null>(null);

  // Daily usage timer
  const [usageSecondsElapsed, setUsageSecondsElapsed] = React.useState(0);
  const sessionStartRef = React.useRef<number>(Date.now());
  const [timerBlockVisible, setTimerBlockVisible] = React.useState(false);
  const [timerSnoozeSeconds, setTimerSnoozeSeconds] = React.useState(0); // extra snooze time added
  const [limitIgnoredToday, setLimitIgnoredToday] = React.useState(() => {
    const ignored = localStorage.getItem("ritmofit_limit_ignored_date");
    return ignored === new Date().toDateString();
  });
  const [dailyLimitMinutes, setDailyLimitMinutes] = React.useState(() => {
    const stored = localStorage.getItem("ritmofit_daily_limit_minutes");
    const date = localStorage.getItem("ritmofit_daily_limit_date");
    if (!stored || !date) return 0;
    if (date !== new Date().toDateString()) {
      // New day — reset elapsed but keep limit
      sessionStorage.removeItem("ritmofit_usage_seconds_today");
      return parseInt(stored, 10);
    }
    return parseInt(stored, 10);
  });

  React.useEffect(() => {
    // Reload limit if user changes it in Profile page
    const handleStorage = () => {
      const stored = localStorage.getItem("ritmofit_daily_limit_minutes");
      setDailyLimitMinutes(stored ? parseInt(stored, 10) : 0);
      // Reset ignored flag if it's a new day
      const ignoredDate = localStorage.getItem("ritmofit_limit_ignored_date");
      if (ignoredDate && ignoredDate !== new Date().toDateString()) {
        localStorage.removeItem("ritmofit_limit_ignored_date");
        setLimitIgnoredToday(false);
      }
    };
    window.addEventListener("storage", handleStorage);
    // Also poll every 5s to catch same-tab changes
    const poll = setInterval(handleStorage, 5000);
    return () => { window.removeEventListener("storage", handleStorage); clearInterval(poll); };
  }, []);

  React.useEffect(() => {
    if (!dailyLimitMinutes) return;
    // Restore seconds from today's session
    const stored = sessionStorage.getItem("ritmofit_usage_seconds_today");
    const storedDate = localStorage.getItem("ritmofit_daily_limit_date");
    if (stored && storedDate === new Date().toDateString()) {
      setUsageSecondsElapsed(parseInt(stored, 10));
    }
    sessionStartRef.current = Date.now();
    const interval = setInterval(() => {
      const sessionSeconds = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      const base = parseInt(sessionStorage.getItem("ritmofit_usage_seconds_today") || "0", 10);
      const total = base + sessionSeconds;
      setUsageSecondsElapsed(total);
    }, 1000);
    // Save on unload
    const onUnload = () => {
      const sessionSeconds = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      const base = parseInt(sessionStorage.getItem("ritmofit_usage_seconds_today") || "0", 10);
      sessionStorage.setItem("ritmofit_usage_seconds_today", String(base + sessionSeconds));
      // Record to DB if session was at least 10 seconds
      if (sessionSeconds >= 10 && user) {
        recordAccessSessionDb(user.id, sessionSeconds).catch(() => { });
      }
      sessionStartRef.current = Date.now();
    };
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("visibilitychange", () => { if (document.hidden) onUnload(); else sessionStartRef.current = Date.now(); });
    return () => { clearInterval(interval); window.removeEventListener("beforeunload", onUnload); };
  }, [dailyLimitMinutes]);

  React.useEffect(() => {
    const loadUnreadCounts = async () => {
      try {
        const [messageCount, notificationCount] = await Promise.all([
          getUnreadMessageCountDb(),
          getUnreadNotificationsCountDb(),
        ]);
        setUnreadCount(messageCount);
        setUnreadNotificationsCount(notificationCount);
      } catch (err) {
        console.error("Error loading unread counts:", err);
      }
    };

    loadUnreadCounts();

    const unsubscribe = subscribeToUnreadNotificationsDb(setUnreadNotificationsCount);

    // Native local notification when a new social notification arrives
    const notifChannel = user ? supabase
      ?.channel("app-layout-notif-push")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          // Don't fire if user is already on the notifications page
          if (window.location.pathname === "/notificacoes") return;
          const row = payload.new as { type?: number; [key: string]: unknown } | undefined;
          if (!row) return;
          const titleMap: Record<number, string> = {
            1: "Novo seguidor 👤",
            2: "Novo incentivo 🔥",
            3: "Novo comentário 💬",
            4: "Convite para duelo ⚔️",
            5: "Pedido de entrada no duelo 👊",
            6: "Reação no seu comentário ❤️",
            7: "Reação no seu check-in 🏆",
          };
          const bodyMap: Record<number, string> = {
            1: "Alguém começou a te seguir.",
            2: "Alguém reagiu à sua postagem.",
            3: "Alguém comentou na sua postagem.",
            4: "Você recebeu um convite para duelo.",
            5: "Alguém quer entrar no seu grupo.",
            6: "Alguém reagiu ao seu comentário.",
            7: "Alguém reagiu ao seu check-in.",
          };
          const type = row.type as number ?? 0;
          LocalNotifications.schedule({
            notifications: [{
              id: Date.now() % 2_000_000,
              title: titleMap[type] ?? "Nova notificação 🔔",
              body: bodyMap[type] ?? "Você tem uma nova notificação no LinKa.",
              extra: { url: "/notificacoes" },
              smallIcon: "ic_stat_icon_config_sample",
              iconColor: "#f97316",
            }],
          }).catch(() => {/* permission not granted — silent */});
        },
      )
      .subscribe() : null;

    // Realtime subscription for new messages — filtered to current user + debounced
    let msgDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    const messagesChannel = user ? supabase
      ?.channel("app-layout-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `following_id=eq.${user.id}` },
        () => {
          // Debounce: if multiple messages arrive in quick succession, only query once
          if (msgDebounceTimer) clearTimeout(msgDebounceTimer);
          msgDebounceTimer = setTimeout(() => {
            getUnreadMessageCountDb()
              .then(setUnreadCount)
              .catch((err) => console.error("Error loading unread message count:", err));
          }, 1000);
        },
      )
      .subscribe() : null;

    return () => {
      notifChannel?.unsubscribe();
      messagesChannel?.unsubscribe();
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Clear badges when user visits the respective pages
  React.useEffect(() => {
    if (location.pathname === "/notificacoes") {
      setUnreadNotificationsCount(0);
    }
    if (location.pathname === "/comunidade") {
      setUnreadCount(0);
    }
  }, [location.pathname]);

  React.useEffect(() => {
    const loadProfilePhoto = async () => {
      if (!user) return;
      try {
        const profile = await getUserProfileDb(user.id);
        if (profile?.photo) {
          setProfilePhoto(profile.photo);
        }
        if (profile?.gender) {
          setProfileGender(String(profile.gender));
        }
      } catch (err) {
        console.error("Error loading profile photo:", err);
      }
    };

    loadProfilePhoto();
  }, [user]);

  // Scroll hide header — mobile only, only on feed and shots pages
  const isScrollHidePage = location.pathname === "/" || location.pathname === "/shots";

  React.useEffect(() => {
    if (!isScrollHidePage) {
      setHeaderHidden(false);
      return;
    }

    let lastY = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY;
        if (y > 96 && delta > 30) setHeaderHidden(true);
        if (delta < -30) setHeaderHidden(false);
        lastY = y;
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isScrollHidePage]);

  const limitSeconds = dailyLimitMinutes * 60;
  const remainingSeconds = Math.max(0, limitSeconds + timerSnoozeSeconds - usageSecondsElapsed);
  const showTimer = dailyLimitMinutes > 0 && !limitIgnoredToday;
  const timerMins = Math.floor(remainingSeconds / 60);
  const timerSecs = remainingSeconds % 60;
  const timerLabel = remainingSeconds <= 0 ? "00:00" : `${String(timerMins).padStart(2, "0")}:${String(timerSecs).padStart(2, "0")}`;
  const timerUrgent = remainingSeconds <= 300 && remainingSeconds > 0; // last 5 min
  const timerExpired = remainingSeconds <= 0 && dailyLimitMinutes > 0;

  // Show block screen when timer expires (not if user ignored limit today)
  React.useEffect(() => {
    if (timerExpired && !timerBlockVisible && !limitIgnoredToday) {
      setTimerBlockVisible(true);
    }
  }, [timerExpired, limitIgnoredToday]);

  const mainNavItems: NavItem[] = React.useMemo(() => [
    { to: "/", label: t("nav_home"), icon: Home },
    { to: "/shots", label: t("nav_clips"), icon: Video },
    { to: "/postar", label: t("nav_new"), icon: PlusSquare },
    { to: "/metas", label: t("nav_goals"), icon: Dumbbell },
    { to: "/vitrine", label: t("nav_store"), icon: ShoppingBag },
  ], [t]);

  const sidebarExtraItems: NavItem[] = React.useMemo(() => [
    { to: "/buscar", label: t("nav_search") ?? "Buscar", icon: Search },
    { to: "/notificacoes", label: t("settings_notifications"), icon: Bell, badge: unreadNotificationsCount },
    { to: "/comunidade", label: t("nav_community") ?? "Comunidade", icon: Users2, badge: unreadCount },
  ], [t, unreadNotificationsCount, unreadCount]);

  const allSidebarItems = [...mainNavItems, ...sidebarExtraItems];

  return (
    <div className="min-h-dvh bg-background">

      {/* ── DESKTOP LAYOUT (md+): sidebar + feed ── */}
      <div className="hidden md:flex min-h-dvh">

        {/* Sidebar */}
        <aside className="fixed top-0 left-0 z-40 flex h-full w-[244px] flex-col border-r border-border/40 bg-background px-3 py-6">
          {/* Logo */}
          <button
            onClick={() => {
              if (location.pathname === "/") {
                window.dispatchEvent(new CustomEvent("ritmofit-refresh-feed"));
              } else {
                window.location.href = "/";
              }
            }}
            aria-label="Ir para Home"
            className="mb-6 flex items-center px-3 py-2 rounded-xl hover:bg-muted/50 transition cursor-pointer"
          >
            <img src={logoSrc} alt="LinKa" className="h-7" />
          </button>

          {/* Nav items */}
          <nav className="flex flex-col gap-1 flex-1">
            {allSidebarItems.map((item) => {
              const active = isActivePath(location.pathname, item.to);
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.to}
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ x: 2 }}
                  transition={{ duration: 0.15 }}
                >
                  <Link
                    to={item.to}
                    aria-label={item.label}
                    className={cn(
                      "flex items-center gap-4 rounded-xl px-3 py-3 text-[15px] font-medium transition-colors",
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
                    <span>{item.label}</span>
                  </Link>
                </motion.div>
              );
            })}
          </nav>

          {/* Usage timer */}
          {showTimer && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl mb-1",
              timerExpired ? "bg-red-500/10 text-red-500" : timerUrgent ? "bg-orange-500/10 text-orange-500" : "bg-muted/50 text-muted-foreground"
            )}>
              <Timer className="h-4 w-4 flex-shrink-0" />
              <div className="flex flex-col">
                <span className="text-[11px] font-medium">Tempo restante</span>
                <span className="text-sm font-mono font-bold">{timerLabel}</span>
              </div>
            </div>
          )}

          {/* Profile at bottom */}
          <Link
            to="/perfil"
            aria-label="Perfil"
            className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-muted/50"
          >
            <UserAvatar
              photo={profilePhoto}
              gender={profileGender}
              size="sm"
              className="h-9 w-9 border border-border/60"
            />
            <span className="text-[15px] font-medium text-muted-foreground group-hover:text-foreground truncate">
              {t("nav_profile") ?? "Perfil"}
            </span>
          </Link>
        </aside>

        {/* Feed column — centered after sidebar */}
        <div className="ml-[244px] flex flex-1 justify-center">
          <main className="w-full max-w-[680px] min-h-dvh px-0 py-6">
            <PageTransition>
              <Outlet />
            </PageTransition>
          </main>
        </div>
      </div>

      {/* ── MOBILE LAYOUT (< md): top header + bottom nav ── */}
      <div className="flex flex-col min-h-dvh md:hidden">
        <header
          className={cn(
            "sticky top-0 z-50 border-b border-border/60 bg-background/75 backdrop-blur supports-[backdrop-filter]:bg-background/55 transition-transform duration-200",
            headerHidden ? "-translate-y-full pointer-events-none" : "translate-y-0",
          )}
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="relative flex h-16 w-full items-center justify-center gap-4 px-4">
            {/* Left: Profile + Timer */}
            <div className="absolute left-4 flex items-center gap-2">
              <Link to="/perfil" aria-label="Perfil" className="flex-shrink-0 rounded-full hover:opacity-80 transition">
                <UserAvatar
                  photo={profilePhoto}
                  gender={profileGender}
                  size="md"
                  className="border-2 border-border/60"
                />
              </Link>
              {showTimer && (
                <div className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-mono font-semibold",
                  timerExpired ? "bg-red-500/20 text-red-500" : timerUrgent ? "bg-orange-500/20 text-orange-500" : "bg-muted text-muted-foreground"
                )}>
                  <Timer className="h-3 w-3" />
                  {timerLabel}
                </div>
              )}
            </div>

            {/* Center: Logo */}
            <button
              onClick={() => {
                if (location.pathname === "/") {
                  window.dispatchEvent(new CustomEvent("ritmofit-refresh-feed"));
                  const feedContainer = document.querySelector('[data-feed-container]');
                  if (feedContainer) feedContainer.scrollTop = 0;
                } else {
                  window.location.href = "/";
                }
              }}
              aria-label="Ir para Home ou Atualizar Feed"
              className="flex items-center justify-center rounded-2xl px-3 py-1 transition hover:bg-muted/50 cursor-pointer"
            >
              <img src={logoSrc} alt="LinKa" className="h-7" />
            </button>

            {/* Right: actions */}
            <div className="absolute right-4 flex items-center gap-1">
              <Link to="/buscar">
                <Button type="button" variant="ghost" size="icon" className="h-11 w-11 rounded-full" aria-label="Buscar">
                  <Search className="h-5 w-5" />
                </Button>
              </Link>
              <Link to="/notificacoes">
                <Button type="button" variant="ghost" size="icon" className="h-11 w-11 rounded-full relative" aria-label="Notificações">
                  <Bell className="h-5 w-5" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-white text-xs font-semibold">
                      {unreadNotificationsCount > 9 ? "9+" : unreadNotificationsCount}
                    </span>
                  )}
                </Button>
              </Link>
              <Link to="/comunidade">
                <Button type="button" variant="ghost" size="icon" className="h-11 w-11 rounded-full relative" aria-label="Comunidade">
                  <Users2 className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand-2 text-white text-xs font-semibold">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <main className={cn(
          "flex-1 w-full px-4 pt-6",
          layoutMode === "default" ? "pb-[calc(4.25rem+env(safe-area-inset-bottom)+0.5rem)]" : "pb-6"
        )}>
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>

        {layoutMode === "default" && (
          <nav className={cn(
            "fixed bottom-0 left-0 right-0 z-50 border-t border-border/60",
            location.pathname === "/shots"
              ? "bg-background"
              : "bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/65"
          )}>
            <div className="grid w-full grid-cols-5 px-1" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
              {mainNavItems.map((item) => {
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
                      animate={active
                        ? { y: -6, scale: 1 }
                        : { y: 0, scale: 1 }
                      }
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

                    {/* Glow reflection on the nav bar surface */}
                    {active && (
                      <motion.span
                        layoutId="bottom-nav-glow"
                        className="absolute bottom-0 h-[3px] w-10 rounded-t-full bg-brand-gradient opacity-60 blur-[2px]"
                        initial={{ opacity: 0, scaleX: 0.4 }}
                        animate={{ opacity: 0.6, scaleX: 1 }}
                        transition={{ duration: 0.25 }}
                      />
                    )}

                    <span className="hidden sm:block">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>

      {/* Minimized Workout FAB — visible on all pages */}
      {workoutMinimized && (() => {
        const hasAnyValues = Object.values(workoutSeries).some((series) =>
          series.some((s) => (s.kg > 0 || s.reps > 0))
        );
        const showTimer = globalRestTimerActive && globalRestTimerRemaining > 0;
        const timerPercent = globalRestTimerTotal > 0
          ? (globalRestTimerRemaining / globalRestTimerTotal) * 100
          : 0;

        return (
          <div className="fixed bottom-24 right-4 z-[150] flex items-center gap-2">
            <button
              onClick={() => {
                if (hasAnyValues) {
                  if (window.confirm("Encerrar treino? Os dados registrados serão descartados.")) {
                    resetWorkoutState();
                  }
                } else {
                  resetWorkoutState();
                }
              }}
              className="flex items-center justify-center bg-destructive text-white rounded-full shadow-lg w-10 h-10 transition-all active:scale-95"
              title="Encerrar treino"
              aria-label="Encerrar treino"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setPendingReopen(true);
                if (location.pathname !== "/metas") {
                  navigate("/metas");
                }
              }}
              className="flex items-center gap-2 bg-brand text-white rounded-full shadow-lg px-4 py-3 font-semibold text-sm transition-all active:scale-95 animate-pulse relative overflow-hidden"
              style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}
            >
              {showTimer ? (
                <>
                  <Timer className="h-4 w-4 shrink-0" />
                  <span>{globalRestTimerRemaining}s</span>
                  {/* progress bar */}
                  <span
                    className="absolute bottom-0 left-0 h-1 bg-white/40 rounded-full transition-all"
                    style={{ width: `${timerPercent}%` }}
                  />
                </>
              ) : (
                <>
                  <Dumbbell className="h-4 w-4" />
                  Treino em andamento
                </>
              )}
            </button>
          </div>
        );
      })()}

      {/* Timer Expired Full-Screen Block */}
      {timerBlockVisible && (
        <div className="fixed inset-0 z-[500] bg-background flex flex-col items-center justify-center gap-6 px-6 text-center">
          <div className="text-6xl">⏰</div>
          <h2 className="text-2xl font-bold">Tempo esgotado!</h2>
          <p className="text-muted-foreground text-sm max-w-xs">
            Você atingiu o limite diário de uso. Deseja adiar ou ignorar o limite por hoje?
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            {[
              { label: "Adiar por 5 min", seconds: 5 * 60 },
              { label: "Adiar por 10 min", seconds: 10 * 60 },
              { label: "Adiar por 30 min", seconds: 30 * 60 },
            ].map(({ label, seconds }) => (
              <Button
                key={label}
                variant="outline"
                className="w-full rounded-full"
                onClick={() => {
                  setTimerSnoozeSeconds((s) => s + seconds);
                  setTimerBlockVisible(false);
                }}
              >
                {label}
              </Button>
            ))}
            <Button
              className="w-full rounded-full"
              onClick={() => {
                // Ignore limit for today: save flag and hide timer
                localStorage.setItem("ritmofit_limit_ignored_date", new Date().toDateString());
                setLimitIgnoredToday(true);
                setTimerBlockVisible(false);
              }}
            >
              Ignorar limite por hoje
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}
