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
  PanelLeftOpen,
  PanelLeftClose,
} from "lucide-react";
import * as React from "react";
import { LocalNotifications } from "@capacitor/local-notifications";
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Link, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { PageTransition } from "@/components/layout/page-transition";

import { Button } from "@/components/ui/button";
import { hapticLight } from "@/lib/haptics";
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
import { UserAvatar } from "@/components/shared/user-avatar";
import { IncentiveConfirmToast } from "@/components/shared/incentive-confirm-toast";
import { getUnreadMessageCountDb, getUnreadNotificationsCountDb, getUserProfileDb, subscribeToUnreadNotificationsDb, recordAccessSessionDb, recordScreenTimeDb } from "@/lib/ritmofit-db";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useRoutineNotifications } from "@/hooks/use-routine-notifications";
import { useLayoutMode } from "@/hooks/useLayoutMode";
import { useLanguage } from "@/lib/language-context";
import { useWorkout } from "@/lib/workout-context";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

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
  // Agenda as notificações locais das rotinas com horário (treino/dieta/hábito).
  // Sincroniza no mount, ao voltar pro app e via evento "ritmofit-routines-changed".
  useRoutineNotifications(user?.id ?? null);
  const { layoutMode } = useLayoutMode();
  const { t } = useLanguage();
  const {
    workoutMinimized, setWorkoutMinimized, pendingReopen, setPendingReopen,
    globalRestTimerRemaining, globalRestTimerActive, globalRestTimerTotal, setGlobalRestTimerTotal,
    workoutSeries, resetWorkoutState,
  } = useWorkout();

  const [endWorkoutConfirmOpen, setEndWorkoutConfirmOpen] = React.useState(false);

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

  // Sempre que algo sinalizar pendingReopen (ex: tap na notificação de fim de
  // descanso, mesmo com o app relançado do zero), garante que o usuário seja
  // levado até /metas para que o modal de treino reabra.
  React.useEffect(() => {
    if (pendingReopen && location.pathname !== "/metas") {
      navigate("/metas");
    }
  }, [pendingReopen]);

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

  React.useEffect(() => {
    const update = () => {
      const isDesktop = window.innerWidth >= 768;
      document.documentElement.style.setProperty(
        "--sidebar-width",
        isDesktop ? (sidebarExpanded ? "244px" : "68px") : "0px",
      );
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [sidebarExpanded]);

  const [hideNav, setHideNav] = React.useState(false);
  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      setHideNav(document.body.dataset.hideNav === "true");
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-hide-nav"] });
    return () => observer.disconnect();
  }, []);

  const [headerHidden, setHeaderHidden] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = React.useState(0);
  const [profilePhoto, setProfilePhoto] = React.useState<string | null>(null);

  // Daily usage timer
  const [usageSecondsElapsed, setUsageSecondsElapsed] = React.useState(0);
  const sessionStartRef = React.useRef<number>(Date.now());

  // Screen time tracking
  const screenEnteredAtRef = React.useRef<number>(Date.now());
  const currentScreenRef = React.useRef<string>(location.pathname);

  React.useEffect(() => {
    const prev = currentScreenRef.current;
    const enteredAt = screenEnteredAtRef.current;
    const durationSeconds = Math.floor((Date.now() - enteredAt) / 1000);

    if (user && durationSeconds >= 3) {
      recordScreenTimeDb(user.id, prev, durationSeconds).catch(() => {});
    }

    currentScreenRef.current = location.pathname;
    screenEnteredAtRef.current = Date.now();
    sessionStorage.setItem("ritmofit_screen_start", String(screenEnteredAtRef.current));
    sessionStorage.setItem("ritmofit_current_screen", location.pathname);
  }, [location.pathname]);
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

  // Always record access session on app background/close — independent of daily limit
  React.useEffect(() => {
    if (!user) return;
    sessionStartRef.current = Date.now();
    sessionStorage.setItem("ritmofit_session_start", String(sessionStartRef.current));

    const flush = () => {
      const sessionSeconds = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      if (sessionSeconds >= 10) {
        recordAccessSessionDb(user.id, sessionSeconds).catch(() => {});
      }
      sessionStartRef.current = Date.now();
      sessionStorage.setItem("ritmofit_session_start", String(sessionStartRef.current));
    };

    let capListener: { remove: () => void } | null = null;
    if (Capacitor.isNativePlatform()) {
      CapApp.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) flush();
        else {
          sessionStartRef.current = Date.now();
          sessionStorage.setItem("ritmofit_session_start", String(sessionStartRef.current));
        }
      }).then((l) => { capListener = l; });
    } else {
      const onVisibility = () => { if (document.hidden) flush(); else { sessionStartRef.current = Date.now(); sessionStorage.setItem("ritmofit_session_start", String(sessionStartRef.current)); } };
      const onUnload = () => flush();
      window.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("beforeunload", onUnload);
      return () => { window.removeEventListener("visibilitychange", onVisibility); window.removeEventListener("beforeunload", onUnload); };
    }

    return () => { capListener?.remove(); };
  }, [user?.id]);

  React.useEffect(() => {
    if (!dailyLimitMinutes) return;
    // Restore seconds from today's session
    const stored = sessionStorage.getItem("ritmofit_usage_seconds_today");
    const storedDate = localStorage.getItem("ritmofit_daily_limit_date");
    if (stored && storedDate === new Date().toDateString()) {
      setUsageSecondsElapsed(parseInt(stored, 10));
    }
    sessionStartRef.current = Date.now();
    sessionStorage.setItem("ritmofit_session_start", String(sessionStartRef.current));
    const interval = setInterval(() => {
      const sessionSeconds = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      const base = parseInt(sessionStorage.getItem("ritmofit_usage_seconds_today") || "0", 10);
      const total = base + sessionSeconds;
      setUsageSecondsElapsed(total);
    }, 1000);
    return () => { clearInterval(interval); };
  }, [dailyLimitMinutes]);

  const loadUnreadCounts = React.useCallback(async () => {
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
  }, []);

  // Refetch manual de badges (mensagens/notificações) — cobre o caso da
  // subscription realtime cair silenciosamente (app em background no iOS,
  // reconexão de WebView, etc). Disparado sempre que o usuário sinaliza um
  // refresh explícito: tap no logo/home (`ritmofit-refresh-feed`) ou o gesto
  // de pull-to-refresh do feed (`ritmofit-refresh-badges`).
  React.useEffect(() => {
    window.addEventListener("ritmofit-refresh-feed", loadUnreadCounts);
    window.addEventListener("ritmofit-refresh-badges", loadUnreadCounts);
    return () => {
      window.removeEventListener("ritmofit-refresh-feed", loadUnreadCounts);
      window.removeEventListener("ritmofit-refresh-badges", loadUnreadCounts);
    };
  }, [loadUnreadCounts]);

  React.useEffect(() => {
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
          const row = payload.new as { type?: number;[key: string]: unknown } | undefined;
          if (!row) return;
          const type = row.type as number ?? 0;
          const notifTitles: Record<number, string> = {
            1: t("notif_title_1"), 2: t("notif_title_2"), 3: t("notif_title_3"),
            4: t("notif_title_4"), 5: t("notif_title_5"), 6: t("notif_title_6"), 7: t("notif_title_7"),
          };
          const notifBodies: Record<number, string> = {
            1: t("notif_body_1"), 2: t("notif_body_2"), 3: t("notif_body_3"),
            4: t("notif_body_4"), 5: t("notif_body_5"), 6: t("notif_body_6"), 7: t("notif_body_7"),
          };
          LocalNotifications.schedule({
            notifications: [{
              id: Date.now() % 2_000_000,
              title: notifTitles[type] ?? t("notif_title_default"),
              body: notifBodies[type] ?? t("notif_body_default"),
              extra: { url: "/notificacoes" },
              smallIcon: "ic_stat_icon_config_sample",
              iconColor: "#f97316",
            }],
          }).catch(() => {/* permission not granted — silent */ });
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
      // Clear iOS app icon badge and notification center
      if (Capacitor.isNativePlatform()) {
        PushNotifications.removeAllDeliveredNotifications().catch(() => {});
      }
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
      } catch (err) {
        console.error("Error loading profile photo:", err);
      }
    };

    loadProfilePhoto();
  }, [user]);

  // Full-screen mode: driven by data-fullscreen-step on document.body (set by NewPost).
  // We also treat /postar as fullscreen by default to avoid a flash of header/footer
  // before NewPost's layout effect has a chance to set the dataset (notably when
  // navigating from /shots → /postar, where AppLayout is mounting fresh).
  const isPostarRoute = location.pathname === "/postar";
  const [bodyFullscreen, setBodyFullscreen] = React.useState(
    () => document.body.dataset.fullscreenStep === "true"
  );
  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      setBodyFullscreen(document.body.dataset.fullscreenStep === "true");
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-fullscreen-step"] });
    return () => observer.disconnect();
  }, []);
  // On /postar, start fullscreen (matches NewPost's initial step="select"); once
  // NewPost sets the dataset, follow its value (it may switch to "caption"=false).
  const isFullscreenPage = isPostarRoute
    ? (document.body.dataset.fullscreenStep === undefined ? true : bodyFullscreen)
    : bodyFullscreen;

  // Scroll hide header — mobile only, only on feed, shots, vitrine, comunidade and metas pages
  const isScrollHidePage = location.pathname === "/" || location.pathname === "/shots" || location.pathname === "/vitrine" || location.pathname === "/comunidade" || location.pathname === "/metas";

  React.useEffect(() => {
    if (!isScrollHidePage) {
      setHeaderHidden(false);
      return;
    }

    // Comunidade tem seu próprio container com scroll interno (o layout ocupa a
    // altura fixa da tela, ao contrário de feed/vitrine que rolam a window). Um
    // listener em fase de captura no document pega o evento de scroll do container
    // mesmo que ele seja desmontado/remontado ao trocar de aba ou abrir uma conversa.
    const isCommunityPage = location.pathname === "/comunidade";

    let lastY = 0;
    let ticking = false;

    const evaluate = (y: number) => {
      const delta = y - lastY;
      if (y > 96 && delta > 30) setHeaderHidden(true);
      if (delta < -30) setHeaderHidden(false);
      lastY = y;
    };

    if (isCommunityPage) {
      const onContainerScroll = (e: Event) => {
        const el = e.target as HTMLElement | null;
        if (!el || typeof el.hasAttribute !== "function" || !el.hasAttribute("data-community-scroll-container")) return;
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(() => {
          evaluate(el.scrollTop);
          ticking = false;
        });
      };

      document.addEventListener("scroll", onContainerScroll, { passive: true, capture: true });
      return () => document.removeEventListener("scroll", onContainerScroll, true);
    }

    lastY = window.scrollY;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        evaluate(window.scrollY);
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isScrollHidePage, location.pathname]);

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
    <div
      className="min-h-dvh bg-background"
      style={{ "--sidebar-width": typeof window !== "undefined" && window.innerWidth >= 768 ? (sidebarExpanded ? "244px" : "68px") : "0px" } as React.CSSProperties}
    >

      {/* ── DESKTOP SIDEBAR (md+) — chrome only, no Outlet ── */}
      <aside
        className={cn(
          "hidden md:flex fixed top-0 left-0 z-40 h-full flex-col border-r border-border/40 bg-background py-6 transition-all duration-300",
          sidebarExpanded ? "w-[244px] px-3" : "w-[68px] px-2",
        )}
      >
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
          className={cn(
            "mb-6 flex items-center rounded-xl py-2 hover:bg-muted/50 transition cursor-pointer",
            sidebarExpanded ? "px-3" : "justify-center px-0",
          )}
        >
          {sidebarExpanded
            ? <img src="/linka-copa-5a.png" alt="LinKa" className="h-7" />
            : <img src="/SIMBOLO.png" alt="LinKa" className="h-8 w-8 object-contain" />
          }
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

        {/* Usage timer */}
        {showTimer && (
          <div className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl mb-1",
            sidebarExpanded ? "px-3" : "justify-center px-0",
            timerExpired ? "bg-red-500/10 text-red-500" : timerUrgent ? "bg-orange-500/10 text-orange-500" : "bg-muted/50 text-muted-foreground"
          )}>
            <Timer className="h-4 w-4 flex-shrink-0" />
            {sidebarExpanded && (
              <div className="flex flex-col">
                <span className="text-[11px] font-medium">{t("nav_time_remaining")}</span>
                <span className="text-sm font-mono font-bold">{timerLabel}</span>
              </div>
            )}
          </div>
        )}

        {/* Toggle sidebar button */}
        <button
          onClick={toggleSidebar}
          aria-label={sidebarExpanded ? t("nav_sidebar_collapse_label") : t("nav_sidebar_expand_label")}
          title={sidebarExpanded ? t("nav_sidebar_collapse_label") : t("nav_sidebar_expand_label")}
          className={cn(
            "flex items-center rounded-xl py-3 mb-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors",
            sidebarExpanded ? "gap-4 px-3" : "justify-center px-0",
          )}
        >
          {sidebarExpanded
            ? <><PanelLeftClose className="h-6 w-6 flex-shrink-0" /><span className="text-[15px] font-medium">{t("nav_sidebar_collapse")}</span></>
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
            size="sm"
            className="h-9 w-9 border border-border/60 flex-shrink-0"
          />
          {sidebarExpanded && (
            <span className="text-[15px] font-medium text-muted-foreground group-hover:text-foreground truncate">
              {t("nav_profile") ?? "Perfil"}
            </span>
          )}
        </Link>
      </aside>

      {/* ── MOBILE HEADER (< md) — floating glass pill ── */}
      {!isFullscreenPage && location.pathname !== "/shots" && location.pathname !== "/notificacoes" && (
        <header
          className={cn(
            "md:hidden fixed z-50 flex items-center justify-between transition-transform duration-200",
            headerHidden ? "-translate-y-[200%] pointer-events-none" : "translate-y-0",
          )}
          style={{
            top: "max(14px, calc(env(safe-area-inset-top) + 6px))",
            left: "14px",
            right: "14px",
            height: "52px",
            borderRadius: "26px",
            padding: "0 8px 0 14px",
            background: "linear-gradient(rgba(255,255,255,.13),rgba(255,255,255,.05))",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            border: "1px solid rgba(255,255,255,.14)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.28), 0 8px 24px -8px rgba(0,0,0,.5)",
          }}
        >
          {/* Left: avatar + logo */}
          <div className="flex items-center gap-2">
            <Link to="/perfil" aria-label="Perfil" onClick={() => hapticLight()}>
              <UserAvatar
                photo={profilePhoto}
                size="sm"
                className="h-9 w-9 border-[1.5px] border-white/40 flex-shrink-0"
              />
            </Link>
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
              className="flex items-center cursor-pointer"
            >
              <img src="/linka-copa-5a.png" alt="LinKa" className="h-6 w-auto object-contain" />
            </button>
          </div>

          {/* Right: timer + search + community + notifications */}
          <div className="flex items-center gap-1.5">
            {showTimer && (
              <div className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-mono font-semibold",
                timerExpired ? "bg-red-500/30 text-red-400" : timerUrgent ? "bg-orange-500/25 text-orange-400" : "bg-white/10 text-white/70"
              )}>
                <Timer className="h-3 w-3" />
                {timerLabel}
              </div>
            )}
            <Link to="/buscar" aria-label="Buscar" onClick={() => hapticLight()}>
              <button
                type="button"
                className="w-9 h-9 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
                style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.12)" }}
              >
                <Search className="h-4 w-4" />
              </button>
            </Link>
            <Link to="/comunidade" aria-label="Comunidade" onClick={() => hapticLight()}>
              <button
                type="button"
                className="relative w-9 h-9 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
                style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.12)" }}
              >
                <Users2 className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span
                    className="absolute top-1 right-1.5 w-[7px] h-[7px] rounded-full"
                    style={{ background: "#5b8cff", border: "1.5px solid #06070c" }}
                  />
                )}
              </button>
            </Link>
            <Link to="/notificacoes" aria-label="Notificações" onClick={() => hapticLight()}>
              <button
                type="button"
                className="relative w-9 h-9 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
                style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.12)" }}
              >
                <Bell className="h-4 w-4" />
                {unreadNotificationsCount > 0 && (
                  <span
                    className="absolute top-1 right-1.5 w-[7px] h-[7px] rounded-full"
                    style={{ background: "#ff7a59", border: "1.5px solid #06070c" }}
                  />
                )}
              </button>
            </Link>
          </div>
        </header>
      )}

      {/* ── SINGLE OUTLET — rendered once, responsive for mobile and desktop ── */}
      <div
        className={cn(
          "transition-all duration-300",
          // Desktop: offset by sidebar, centered content
          sidebarExpanded ? "md:ml-[244px]" : "md:ml-[68px]",
        )}
      >
        <main
          className={cn(
            "w-full",
            isFullscreenPage
              ? "pt-0 px-0 pb-0"
              : location.pathname === "/shots"
                ? "pt-0 px-0 pb-0"
                : cn(
                    // Mobile: no horizontal padding (each page/card controls its own), glass header top offset
                    "px-0",
                    layoutMode === "default" && !hideNav
                      ? "pb-[calc(env(safe-area-inset-bottom)+100px)]"
                      : "pb-6",
                  ),
            location.pathname === "/shots"
              ? "md:px-0 md:pb-0 md:pt-0 md:max-w-[680px] md:mx-auto md:min-h-dvh"
              : "md:px-0 md:pb-6 md:pt-6 md:max-w-[680px] md:mx-auto md:min-h-dvh",
          )}
          style={
            !isFullscreenPage && location.pathname !== "/shots"
              ? { paddingTop: "calc(max(14px, env(safe-area-inset-top) + 6px) + 52px + 12px)" }
              : undefined
          }
        >
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>

      {/* ── MOBILE BOTTOM NAV (< md) — floating glass pill ── */}
      {layoutMode === "default" && !hideNav && !isFullscreenPage && (
        <nav
          className="md:hidden fixed z-50"
          style={{
            bottom: "calc(14px + env(safe-area-inset-bottom))",
            left: "14px",
            right: "14px",
            height: "66px",
            borderRadius: "33px",
            background: "linear-gradient(rgba(255,255,255,.13),rgba(255,255,255,.045))",
            backdropFilter: "blur(26px) saturate(180%)",
            WebkitBackdropFilter: "blur(26px) saturate(180%)",
            border: "1px solid rgba(255,255,255,.15)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.3), 0 16px 36px -12px rgba(0,0,0,.6)",
          }}
        >
          <div className="grid w-full h-full grid-cols-5">
            {mainNavItems.map((item) => {
              const active = isActivePath(location.pathname, item.to);
              const Icon = item.icon;
              const isHome = item.to === "/";
              const isCenter = item.to === "/postar";
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-label={item.label}
                  className="flex flex-col items-center justify-center gap-0.5"
                  style={{ color: active ? "#fff" : "rgba(255,255,255,.45)" }}
                  onClick={(e) => {
                    hapticLight();
                    if (isHome && location.pathname === "/") {
                      e.preventDefault();
                      window.scrollTo({ top: 0, behavior: "smooth" });
                      window.dispatchEvent(new CustomEvent("ritmofit-refresh-feed"));
                    }
                  }}
                >
                  <motion.span
                    whileTap={{ scale: 0.82 }}
                    animate={active && !isCenter ? { y: -2, scale: 1 } : { y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="grid place-items-center"
                    style={isCenter ? { width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#ff9d6c,#d8567a 50%,#7b3ff2)", boxShadow: "0 4px 14px -4px rgba(216,86,122,.6)" } : { width: 32, height: 32 }}
                  >
                    <Icon className={isCenter ? "h-5 w-5 text-white" : "h-[22px] w-[22px]"} />
                  </motion.span>
                  {active && !isCenter && (
                    <motion.span
                      layoutId="bottom-nav-indicator"
                      className="h-[3px] w-[3px] rounded-full"
                      style={{ background: "#fff" }}
                      transition={{ type: "spring", stiffness: 500, damping: 28 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      {/* Minimized Workout FAB — visible on all pages */}
      <AnimatePresence>
      {workoutMinimized && (() => {
        const hasAnyValues = Object.values(workoutSeries).some((series) =>
          series.some((s) => (s.kg > 0 || s.reps > 0))
        );
        const showTimer = globalRestTimerActive && globalRestTimerRemaining > 0;
        const timerPercent = globalRestTimerTotal > 0
          ? (globalRestTimerRemaining / globalRestTimerTotal) * 100
          : 0;

        return (
          <motion.div
            className="fixed right-4 z-[150] flex items-center gap-2"
            style={{ bottom: "calc(6rem + env(safe-area-inset-bottom))" }}
            initial={{ opacity: 0, scale: 0.7, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.7, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <button
              onClick={() => {
                if (hasAnyValues) {
                  setEndWorkoutConfirmOpen(true);
                } else {
                  resetWorkoutState();
                }
              }}
              className="flex items-center justify-center text-white rounded-full w-10 h-10 transition-all active:scale-95"
              style={{
                background: "linear-gradient(rgba(255,90,90,.26),rgba(220,40,40,.14))",
                backdropFilter: "blur(26px) saturate(180%)",
                WebkitBackdropFilter: "blur(26px) saturate(180%)",
                border: "1px solid rgba(255,130,130,.32)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.28), 0 12px 30px -10px rgba(0,0,0,.55)",
              }}
              title={t("goals_workout_end_confirm")}
              aria-label={t("goals_workout_end_confirm")}
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
              className="flex items-center gap-2 text-white rounded-full px-4 py-3 font-semibold text-sm transition-all active:scale-95 animate-pulse relative overflow-hidden"
              style={{
                background: "linear-gradient(rgba(255,255,255,.16),rgba(255,255,255,.06))",
                backdropFilter: "blur(26px) saturate(180%)",
                WebkitBackdropFilter: "blur(26px) saturate(180%)",
                border: "1px solid rgba(255,255,255,.18)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.3), 0 16px 36px -12px rgba(0,0,0,.6)",
              }}
            >
              {showTimer ? (
                <>
                  <Timer className="h-4 w-4 shrink-0" />
                  <span>{globalRestTimerRemaining}s</span>
                  <span
                    className="absolute bottom-0 left-0 h-1 bg-white/40 rounded-full transition-all"
                    style={{ width: `${timerPercent}%` }}
                  />
                </>
              ) : (
                <>
                  <Dumbbell className="h-4 w-4" />
                  {t("goals_workout_in_progress")}
                </>
              )}
            </button>
          </motion.div>
        );
      })()}
      </AnimatePresence>

      {/* End Workout Confirmation — substitui window.confirm bloqueado no Capacitor iOS */}
      <AlertDialog open={endWorkoutConfirmOpen} onOpenChange={setEndWorkoutConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("goals_workout_end_confirm")}</AlertDialogTitle>
            <AlertDialogDescription>{t("goals_workout_end_confirm_desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => { resetWorkoutState(); setEndWorkoutConfirmOpen(false); }}
            >
              {t("goals_workout_end_btn")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Global incentive confirmation toast */}
      <IncentiveConfirmToast />

      {/* Timer Expired Full-Screen Block */}
      {timerBlockVisible && (
        <div className="fixed inset-0 z-[500] bg-background flex flex-col items-center justify-center gap-6 px-6 text-center">
          <div className="text-6xl">⏰</div>
          <h2 className="text-2xl font-bold">{t("app_timer_expired_title")}</h2>
          <p className="text-muted-foreground text-sm max-w-xs">
            {t("app_timer_expired_desc")}
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            {[
              { label: t("app_timer_snooze_5"), seconds: 5 * 60 },
              { label: t("app_timer_snooze_10"), seconds: 10 * 60 },
              { label: t("app_timer_snooze_30"), seconds: 30 * 60 },
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
                localStorage.setItem("ritmofit_limit_ignored_date", new Date().toDateString());
                setLimitIgnoredToday(true);
                setTimerBlockVisible(false);
              }}
            >
              {t("app_timer_ignore_today")}
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}
