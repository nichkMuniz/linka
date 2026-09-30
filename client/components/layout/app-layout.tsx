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
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Link, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { PageTransition } from "@/components/layout/page-transition";

import { Button } from "@/components/ui/button";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { getActiveConversationUserId } from "@/lib/active-conversation";
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
import { IncomingMessageToast } from "@/components/shared/incoming-message-toast";
import { showIncomingMessageToast, showIncomingNotificationToast } from "@/lib/incoming-message-toast";
import { RoutineCompletedToast } from "@/components/shared/routine-completed-toast";
import { FEATURES } from "@/lib/feature-flags";
import { requestAppRefresh, useAppRefresh } from "@/lib/app-refresh";
import { getUnreadMessageCountDb, getUnreadNotificationsCountDb, getUserProfileDb, subscribeToUnreadNotificationsDb, recordAccessSessionDb, bufferScreenTime, flushScreenTimeDb, invalidateQueryCache, getPendingWorkoutPartyInviteDb, getWorkoutPartyInviteByIdDb, respondWorkoutPartyInviteDb, getOwnVerificationStatusDb, markVerificationSeenDb, type WorkoutPartyInvite } from "@/lib/ritmofit-db";
import { WorkoutPartyInviteDialog } from "@/components/goals/workout-party-invite-dialog";
import { VerifiedCongratsDialog } from "@/components/shared/verified-congrats-dialog";
import { isVerifiedUpgrade, type VerifiedTier } from "@/lib/verified-tier";
import { reportHandledError } from "@/lib/monitoring";
import {
  fetchNotificationCopyData,
  notificationBody,
  notificationDeepLink,
  notificationTitle,
  type NotificationRow,
} from "@/lib/notification-copy";
import { OUTBOX_SYNCED_EVENT } from "@/lib/offline-outbox";
import { prefetchPrimaryRoutes, prefetchRoute } from "@/lib/route-prefetch";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useRoutineNotifications } from "@/hooks/use-routine-notifications";
import { useEdgeSwipeBack } from "@/hooks/use-edge-swipe-back";
import { useLanguage } from "@/lib/language-context";
import { useWorkout, useWorkoutClock } from "@/lib/workout-context";
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

// ── Uso diário (limite de tempo) ─────────────────────────────────────────────
// Acumulado do DIA em localStorage — sobrevive a fechar/matar o app. Antes o
// valor ia para uma chave de sessionStorage que ninguém gravava: o limite só
// contava o tempo desde a última abertura, e reabrir o app zerava tudo. O adiar
// (snooze) mora junto: sem ele, reabrir o app depois de adiar bloqueava de novo.
const DAILY_USAGE_KEY = "lk:dailyUsage";

type DailyUsage = { date: string; seconds: number; snooze: number };

function readDailyUsage(): DailyUsage {
  const today = new Date().toDateString();
  try {
    const raw = localStorage.getItem(DAILY_USAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as DailyUsage) : null;
    if (parsed && parsed.date === today) {
      return { date: today, seconds: Number(parsed.seconds) || 0, snooze: Number(parsed.snooze) || 0 };
    }
  } catch {
    // corrompido/indisponível — recomeça o dia
  }
  return { date: today, seconds: 0, snooze: 0 };
}

function writeDailyUsage(usage: DailyUsage): void {
  try {
    localStorage.setItem(DAILY_USAGE_KEY, JSON.stringify(usage));
  } catch {
    // best-effort
  }
}

// ─── Relógio do limite diário (store externo com seletor) ────────────────────
// O contador sobe a cada segundo. Como estado do AppLayout, ele re-renderizava
// o header/footer inteiros a cada segundo para quem ativou o limite. Agora o
// layout observa só o ESTADO (normal / últimos 5 min / expirado) e apenas o
// texto `mm:ss` (`DailyTimerLabel`) observa os segundos — mesmo padrão do
// relógio do treino (`useWorkoutClock`).
type UsageClock = { seconds: number; snooze: number };

let usageClock: UsageClock = (() => {
  const u = readDailyUsage();
  return { seconds: Math.floor(u.seconds), snooze: u.snooze };
})();
const usageClockListeners = new Set<() => void>();

function setUsageClock(next: UsageClock) {
  if (next.seconds === usageClock.seconds && next.snooze === usageClock.snooze) return;
  usageClock = next;
  usageClockListeners.forEach((listener) => listener());
}

function subscribeUsageClock(listener: () => void) {
  usageClockListeners.add(listener);
  return () => usageClockListeners.delete(listener);
}

function useUsageClock<T>(selector: (clock: UsageClock) => T): T {
  return React.useSyncExternalStore(subscribeUsageClock, () => selector(usageClock), () => selector(usageClock));
}

function remainingOf(clock: UsageClock, limitSeconds: number): number {
  return Math.max(0, limitSeconds + clock.snooze - clock.seconds);
}

/** Único pedaço do layout que re-renderiza a cada segundo com o limite ativo. */
function DailyTimerLabel({ limitSeconds, className }: { limitSeconds: number; className?: string }) {
  const remaining = useUsageClock((c) => remainingOf(c, limitSeconds));
  const label = remaining <= 0
    ? "00:00"
    : `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  return className ? <span className={className}>{label}</span> : <>{label}</>;
}

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  // Agenda as notificações locais das rotinas com horário (treino/dieta/hábito).
  // Sincroniza no mount, ao voltar pro app e via evento "ritmofit-routines-changed".
  useRoutineNotifications(user?.id ?? null);
  const { t } = useLanguage();
  const {
    workoutMinimized, setWorkoutMinimized, pendingReopen, setPendingReopen,
    globalRestTimerActive, globalRestTimerTotal, setGlobalRestTimerTotal,
    workoutSeries, resetWorkoutState,
    workoutModalOpen, workoutStartTime, setPendingPartyJoin,
  } = useWorkout();

  // ── Parabéns pelo selo de verificação ────────────────────────────────────
  // O admin dá o selo em outro aparelho; checamos ao abrir e ao voltar para o
  // app. Só comemora quando o nível SOBE em relação ao último já visto — uma
  // remoção ou rebaixamento só sincroniza a marca, em silêncio.
  const [congratsTier, setCongratsTier] = React.useState<VerifiedTier | null>(null);
  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const check = async () => {
      const status = await getOwnVerificationStatusDb().catch(() => null);
      if (cancelled || !status || status.tier === status.seenTier) return;
      if (isVerifiedUpgrade(status.seenTier, status.tier)) {
        setCongratsTier(status.tier);
      } else {
        markVerificationSeenDb(status.tier).catch(() => {});
      }
    };
    check();
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user]);

  const closeVerifiedCongrats = React.useCallback((goToProfile: boolean) => {
    const tier = congratsTier;
    setCongratsTier(null);
    // Grava ao fechar (e não ao abrir): se o app for morto com o modal na
    // tela, ele reaparece na próxima abertura em vez de se perder.
    if (tier) markVerificationSeenDb(tier).catch(() => {});
    if (goToProfile) navigate("/perfil");
  }, [congratsTier, navigate]);

  // ── Treinar junto: convite recebido ───────────────────────────────────────
  // O diálogo mora AQUI, e não na tela de Metas, porque o convite é para agora:
  // quem está no feed ou no perfil precisa vê-lo na hora, não ao abrir Metas.
  // Aceitar só repassa o convite (`pendingPartyJoin`) e navega — quem sabe
  // iniciar um treino é a tela de Metas.
  const [partyInvite, setPartyInvite] = React.useState<WorkoutPartyInvite | null>(null);
  const isTrainingNow = workoutStartTime !== null && (workoutModalOpen || workoutMinimized);

  // Convite que chegou com o app fechado (ou pelo toque no push): ao montar,
  // procura um pendente que ainda não expirou.
  React.useEffect(() => {
    if (!FEATURES.workoutParty) return;
    if (!user) return;
    getPendingWorkoutPartyInviteDb()
      .then((invite) => { if (invite) setPartyInvite(invite); })
      .catch(() => { /* sem convite — silencioso */ });
  }, [user?.id]);

  const handleAcceptPartyInvite = React.useCallback(async () => {
    const invite = partyInvite;
    if (!invite) return;
    setPartyInvite(null);
    try {
      await respondWorkoutPartyInviteDb(invite.partyId, true, invite.snapshot.items.length);
      setPendingPartyJoin(invite);
      if (window.location.pathname !== "/metas") navigate("/metas");
    } catch (err: any) {
      reportHandledError(err, "app-layout:accept-workout-party");
      toast({ title: t("goals_party_join_error"), description: err?.message, variant: "destructive" });
    }
  }, [partyInvite, navigate, setPendingPartyJoin, t]);

  const handleDeclinePartyInvite = React.useCallback(async () => {
    const invite = partyInvite;
    if (!invite) return;
    setPartyInvite(null);
    try {
      await respondWorkoutPartyInviteDb(invite.partyId, false);
    } catch {
      /* recusar é best-effort: o convite expira sozinho em 1h */
    }
  }, [partyInvite]);

  const [endWorkoutConfirmOpen, setEndWorkoutConfirmOpen] = React.useState(false);

  // Swipe da borda esquerda → volta para a tela anterior visitada (history back).
  // Desligado no editor de novo post (/postar), onde voltar perderia o rascunho
  // e o gesto poderia conflitar com o crop inline.
  const mainRef = React.useRef<HTMLElement>(null);
  useEdgeSwipeBack(mainRef, location.pathname !== "/postar");

  // ─── Prefetch dos chunks de tela ──────────────────────────────────────────
  //
  // Um único listener delegado no documento, em vez de um handler por <Link>:
  // pega qualquer link interno do app (menu, sidebar, header, cards dentro das
  // páginas) sem espalhar a mesma prop por dezenas de lugares — e continua
  // valendo para links criados depois.
  //
  // `pointerdown` e não `click`: entre encostar e soltar o dedo passam ~100ms,
  // e a navegação só acontece no clique. O chunk viaja dentro dessa folga, de
  // graça. Em `capture` para não depender de nenhum `stopPropagation` no meio
  // do caminho, e `passive` para nunca atrasar o scroll.
  React.useEffect(() => {
    const onPointerDown = (e: Event) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      const href = anchor?.getAttribute("href");
      // Só rotas internas: href externo não tem chunk nosso para aquecer.
      if (href && href.startsWith("/")) prefetchRoute(href);
    };

    document.addEventListener("pointerdown", onPointerDown, { passive: true, capture: true });
    return () => document.removeEventListener("pointerdown", onPointerDown, { capture: true });
  }, []);

  // Segunda oportunidade: as telas do bottom nav são aquecidas quando a thread
  // fica ociosa, então mesmo a primeira navegação do dia já encontra o chunk
  // pronto — sem competir com a carga da tela que está na frente do usuário.
  React.useEffect(() => {
    prefetchPrimaryRoutes();
  }, []);

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

  // Fila offline sincronizada (treinos/check-ins feitos sem internet foram
  // enviados) → avisa o usuário em qualquer tela. O evento vem do offline-outbox.
  React.useEffect(() => {
    const onSynced = () => {
      toast({ title: t("goals_sync_done_title"), description: t("goals_sync_done_desc") });
    };
    window.addEventListener(OUTBOX_SYNCED_EVENT, onSynced);
    return () => window.removeEventListener(OUTBOX_SYNCED_EVENT, onSynced);
  }, [t]);

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
  const sessionStartRef = React.useRef<number>(Date.now());

  // Screen time tracking
  const screenEnteredAtRef = React.useRef<number>(Date.now());
  const currentScreenRef = React.useRef<string>(location.pathname);

  // ── Tempo na tela de registrar treino NÃO conta como tempo de uso ─────────
  // Vale para os três relógios: limite diário (bloqueio), sessão de acesso e
  // tempo por tela. Enquanto o treino está aberto (não minimizado), cada relógio
  // desconta o tempo corrido ao vivo; ao fechar, o início dele é empurrado para
  // frente pelo tempo de treino — inclusive no sessionStorage, que é o que o
  // logout (settings-drawer) lê. Um "desde" por relógio: zerar um (troca de
  // tela, background) não pode apagar o desconto do outro.
  const onWorkoutScreenRef = React.useRef(false);
  const sessionWorkoutSinceRef = React.useRef<number | null>(null);
  const screenWorkoutSinceRef = React.useRef<number | null>(null);

  const sessionActiveMs = () => {
    const now = Date.now();
    const since = sessionWorkoutSinceRef.current;
    return Math.max(0, now - sessionStartRef.current - (since != null ? now - since : 0));
  };
  const screenActiveMs = () => {
    const now = Date.now();
    const since = screenWorkoutSinceRef.current;
    return Math.max(0, now - screenEnteredAtRef.current - (since != null ? now - since : 0));
  };
  const resetSessionClock = () => {
    const now = Date.now();
    sessionStartRef.current = now;
    sessionWorkoutSinceRef.current = onWorkoutScreenRef.current ? now : null;
    sessionStorage.setItem("ritmofit_session_start", String(now));
  };
  const resetScreenClock = () => {
    const now = Date.now();
    screenEnteredAtRef.current = now;
    screenWorkoutSinceRef.current = onWorkoutScreenRef.current ? now : null;
    sessionStorage.setItem("ritmofit_screen_start", String(now));
  };

  React.useEffect(() => {
    const now = Date.now();
    if (workoutModalOpen) {
      onWorkoutScreenRef.current = true;
      if (sessionWorkoutSinceRef.current == null) sessionWorkoutSinceRef.current = now;
      if (screenWorkoutSinceRef.current == null) screenWorkoutSinceRef.current = now;
      return;
    }
    onWorkoutScreenRef.current = false;
    if (sessionWorkoutSinceRef.current != null) {
      sessionStartRef.current += now - sessionWorkoutSinceRef.current;
      sessionWorkoutSinceRef.current = null;
      sessionStorage.setItem("ritmofit_session_start", String(sessionStartRef.current));
    }
    if (screenWorkoutSinceRef.current != null) {
      screenEnteredAtRef.current += now - screenWorkoutSinceRef.current;
      screenWorkoutSinceRef.current = null;
      sessionStorage.setItem("ritmofit_screen_start", String(screenEnteredAtRef.current));
    }
  }, [workoutModalOpen]);

  React.useEffect(() => {
    const prev = currentScreenRef.current;
    const durationSeconds = Math.floor(screenActiveMs() / 1000);

    // Só acumula localmente — o envio ao banco acontece em lote no flush
    // (app indo para background), não a cada navegação.
    if (user && durationSeconds >= 3) {
      bufferScreenTime(prev, durationSeconds);
    }

    currentScreenRef.current = location.pathname;
    resetScreenClock();
    sessionStorage.setItem("ritmofit_current_screen", location.pathname);
  }, [location.pathname]);
  const [timerBlockVisible, setTimerBlockVisible] = React.useState(false);
  const [limitIgnoredToday, setLimitIgnoredToday] = React.useState(() => {
    const ignored = localStorage.getItem("ritmofit_limit_ignored_date");
    return ignored === new Date().toDateString();
  });
  const [dailyLimitMinutes, setDailyLimitMinutes] = React.useState(() => {
    const stored = localStorage.getItem("ritmofit_daily_limit_minutes");
    const date = localStorage.getItem("ritmofit_daily_limit_date");
    if (!stored || !date) return 0;
    // O acumulado do dia (lk:dailyUsage) vira sozinho à meia-noite local.
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
    // O evento nativo `storage` só dispara em OUTRA aba — inútil num app
    // Capacitor de webview única. Antes isso era coberto por um setInterval de
    // 5s rodando em toda tela, para sempre, só para vigiar um valor que muda
    // quando o usuário mexe nas Configurações. Agora o próprio settings-drawer
    // avisa por evento, e revalidamos na volta do background (vira o dia).
    window.addEventListener("storage", handleStorage);
    window.addEventListener("lk:daily-limit-changed", handleStorage);
    document.addEventListener("visibilitychange", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("lk:daily-limit-changed", handleStorage);
      document.removeEventListener("visibilitychange", handleStorage);
    };
  }, []);

  // Always record access session on app background/close — independent of daily limit
  React.useEffect(() => {
    if (!user) return;
    resetSessionClock();

    // Sobrou buffer de uma sessão anterior (app morto sem passar por background)?
    // Envia agora, na abertura.
    flushScreenTimeDb(user.id).catch(() => {});

    const flush = () => {
      const sessionSeconds = Math.floor(sessionActiveMs() / 1000);
      if (sessionSeconds >= 10) {
        recordAccessSessionDb(user.id, sessionSeconds).catch(() => {});
      }
      // Contabiliza a tela em que o usuário estava ao sair e despeja o buffer
      // inteiro num único insert em lote.
      const screenSeconds = Math.floor(screenActiveMs() / 1000);
      bufferScreenTime(currentScreenRef.current, screenSeconds);
      resetScreenClock();
      flushScreenTimeDb(user.id).catch(() => {});

      resetSessionClock();
    };

    let capListener: { remove: () => void } | null = null;
    if (Capacitor.isNativePlatform()) {
      CapApp.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) flush();
        else resetSessionClock();
      }).then((l) => { capListener = l; });
    } else {
      const onVisibility = () => { if (document.hidden) flush(); else resetSessionClock(); };
      const onUnload = () => flush();
      window.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("beforeunload", onUnload);
      return () => { window.removeEventListener("visibilitychange", onVisibility); window.removeEventListener("beforeunload", onUnload); };
    }

    return () => { capListener?.remove(); };
  }, [user?.id]);

  React.useEffect(() => {
    if (!dailyLimitMinutes) return;
    const initial = readDailyUsage();
    setUsageClock({ seconds: Math.floor(initial.seconds), snooze: initial.snooze });

    // Soma, a cada segundo, o tempo real desde o tick anterior — só com o app
    // em primeiro plano e fora da tela de registrar treino (o bloqueio nunca
    // interrompe um treino). Um intervalo > 5s entre ticks = o WebView ficou
    // suspenso (background/tela bloqueada): esse buraco não é uso.
    let last = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const delta = now - last;
      last = now;
      const usage = readDailyUsage(); // já zera se o dia virou
      if (!document.hidden && !onWorkoutScreenRef.current && delta <= 5000) {
        usage.seconds += delta / 1000;
        writeDailyUsage(usage);
      }
      setUsageClock({ seconds: Math.floor(usage.seconds), snooze: usage.snooze });
    }, 1000);
    return () => { clearInterval(interval); };
  }, [dailyLimitMinutes]);

  const loadProfilePhoto = React.useCallback(async () => {
    if (!user) return;
    // A leitura do perfil no instante do login às vezes falha (volta null) —
    // e o header ficava com o avatar genérico até um refresh global. O próprio
    // perfil sempre existe, então null aqui é falha: tenta mais duas vezes.
    // (O null não é mais guardado no cache, ver `skipNull` em ritmofit-db.)
    for (const delay of [0, 1500, 4000]) {
      if (delay) await new Promise((r) => setTimeout(r, delay));
      try {
        const profile = await getUserProfileDb(user.id);
        if (profile) {
          if (profile.photo) setProfilePhoto(profile.photo);
          return;
        }
      } catch (err) {
        console.error("Error loading profile photo:", err);
      }
    }
  }, [user]);

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
  // O efeito de volta do background é montado uma vez só; lê a versão atual por ref.
  const loadUnreadCountsRef = React.useRef(loadUnreadCounts);
  loadUnreadCountsRef.current = loadUnreadCounts;

  // Refresh global (pull-to-refresh de qualquer tela, toque no logo, volta do
  // background — ver @/lib/app-refresh): o cache já chega derrubado, então os
  // contadores e a foto do header saem do banco, não da memória. Cobre também
  // a subscription realtime que caiu em silêncio com o app suspenso.
  useAppRefresh(() => {
    loadUnreadCounts();
    loadProfilePhoto();
  });

  // Volta do background: o iOS suspende o WebView e o realtime não entrega o
  // que chegou nesse meio-tempo.
  //  - fora por 3 min ou mais → refresh global (derruba o cache das telas);
  //  - fora por 15 s a 3 min → só os contadores do header/footer, que são
  //    baratos. Derrubar o cache inteiro a cada troca rápida de app fazia
  //    Perfil/Metas abrirem com esqueleto em vez de instantâneos.
  // No nativo o sinal confiável é o `appStateChange` do Capacitor (mesmo
  // critério da dica de atualização do feed); no navegador, `visibilitychange`.
  React.useEffect(() => {
    const RESUME_REFRESH_AFTER_MS = 3 * 60_000;
    const RESUME_BADGES_AFTER_MS = 15_000;
    let hiddenAt: number | null = null;
    const onHide = () => { hiddenAt = Date.now(); };
    const onShow = () => {
      const awayMs = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      if (awayMs >= RESUME_REFRESH_AFTER_MS) {
        requestAppRefresh("resume");
      } else if (awayMs >= RESUME_BADGES_AFTER_MS) {
        invalidateQueryCache("unreadMsgCount");
        invalidateQueryCache("unreadNotifCount");
        void loadUnreadCountsRef.current();
      }
    };
    if (Capacitor.isNativePlatform()) {
      let listener: { remove: () => void } | null = null;
      let disposed = false;
      CapApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive) onShow();
        else onHide();
      }).then((l) => {
        if (disposed) l.remove();
        else listener = l;
      });
      return () => {
        disposed = true;
        listener?.remove();
      };
    }
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onHide();
      else onShow();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // O efeito das subscriptions roda uma única vez ([]), então guardar `t` numa
  // ref é o que faz o banner acompanhar a troca de idioma — capturado direto,
  // ele congelaria no idioma que estava ativo na montagem do layout.
  const tRef = React.useRef(t);
  React.useEffect(() => { tRef.current = t; }, [t]);

  React.useEffect(() => {
    loadUnreadCounts();

    // Com a tela de notificações aberta, a própria tela marca tudo como lido
    // assim que a linha chega — deixar o realtime acender o badge aqui era o
    // caminho de o sinalizador sobreviver à saída da tela.
    const unsubscribe = subscribeToUnreadNotificationsDb((count) => {
      if (window.location.pathname === "/notificacoes") return;
      setUnreadNotificationsCount(count);
    });

    // Nome único por execução: o efeito roda de novo quando o usuário muda, e
    // reaproveitar o nome devolveria o canal antigo já inscrito.
    const channelSuffix = Math.random().toString(36).slice(2, 8);

    // Native local notification when a new social notification arrives
    const notifChannel = user ? supabase
      ?.channel(`app-layout-notif-push:${user.id}:${channelSuffix}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        async (payload) => {
          const row = payload.new as NotificationRow | undefined;
          if (!row) return;
          const type = Number(row.type ?? 0);
          // Mensagem privada (type 10, ou 17 quando é resposta a um flow) em
          // primeiro plano é responsabilidade do canal de `messages` logo abaixo —
          // só ele tem o TEXTO para montar o pop up com preview real. Sair aqui
          // (antes da vibração) é o que impede a mesma mensagem avisar duas vezes.
          if (type === 10 || type === 17) return;
          // Aviso de feature guardada atrás de flag: o banner apareceria e, ao
          // tocar, a pessoa cairia numa lista onde a notificação foi filtrada.
          // Não é hipotético — o banco é o mesmo dos builds do TestFlight, e um
          // testador com versão antiga ainda consegue gerar estes eventos.
          if (!FEATURES.duels && (type === 11 || type === 14 || type === 15)) return;
          if (!FEATURES.store && (type === 8 || type === 12 || type === 13)) return;
          if (!FEATURES.postTags && type === 16) return;
          if (!FEATURES.workoutParty && type === 19) return;
          // Convite de treino (19): o aviso é o DIÁLOGO, com os exercícios e os
          // botões de aceitar/recusar — um banner genérico faria a pessoa abrir
          // o app para descobrir o que fazer, e o convite vale por uma hora.
          if (type === 19 && FEATURES.workoutParty) {
            hapticSuccess();
            const partyId = row.post_id ? String(row.post_id) : null;
            if (partyId) {
              getWorkoutPartyInviteByIdDb(partyId)
                .then((invite) => { if (invite) setPartyInvite(invite); })
                .catch(() => { /* cai no fallback da próxima abertura do app */ });
            }
            return;
          }
          // Vibrate for every incoming notification, regardless of which screen the user is on
          hapticSuccess();
          // Don't fire the visual/local notification if user is already on the notifications page
          if (window.location.pathname === "/notificacoes") return;
          // Texto explícito ("Fulano curtiu sua promoção"), não "você tem uma nova
          // notificação": o banner tinha mapa só dos tipos 1–7 e corpo sem o nome
          // de quem originou, então o usuário precisava abrir o app para descobrir
          // o que tinha acontecido. Ver client/lib/notification-copy.ts.
          //
          // Pop up IN-APP (o mesmo da mensagem privada), não notificação local:
          // o iOS não exibe a notificação local com o app em primeiro plano, e o
          // aviso de incentivo/comentário/seguidor simplesmente não aparecia.
          const translate = tRef.current;
          const data = await fetchNotificationCopyData(row, translate("notif_sender_fallback"));
          showIncomingNotificationToast({
            actorId: row.follower_id ? String(row.follower_id) : null,
            title: notificationTitle(translate, type),
            body: notificationBody(translate, row, data),
            url: notificationDeepLink(row),
          });
        },
      )
      .subscribe() : null;

    // Realtime subscription for new messages — filtered to current user + debounced
    let msgDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    const messagesChannel = user ? supabase
      ?.channel(`app-layout-messages:${user.id}:${channelSuffix}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `following_id=eq.${user.id}` },
        (payload) => {
          // Aviso imediato de mensagem nova, em qualquer tela: vibração leve
          // sempre + pop up com nome, foto e preview (IncomingMessageToast).
          // O banner é suprimido quando a conversa daquele remetente já está
          // aberta — ali o usuário vê a mensagem chegar e só a vibração faz
          // sentido. Fora do debounce abaixo de propósito: o aviso tem que ser
          // instantâneo; o debounce existe só para não repetir a query do badge.
          const msg = payload.new as { user_id?: string | null; text?: string | null } | undefined;
          const senderId = msg?.user_id ?? null;
          if (senderId && senderId !== user.id) {
            hapticLight();
            if (getActiveConversationUserId() !== senderId) {
              showIncomingMessageToast({ senderId, text: String(msg?.text ?? "") });
            }
          }
          // Debounce: if multiple messages arrive in quick succession, only query once
          if (msgDebounceTimer) clearTimeout(msgDebounceTimer);
          msgDebounceTimer = setTimeout(() => {
            // Derruba o cache antes de reler: getUnreadMessageCountDb() é cacheado
            // (30s) e, sem isto, o realtime devolvia a contagem antiga.
            invalidateQueryCache("unreadMsgCount");
            invalidateQueryCache("conversations");
            getUnreadMessageCountDb()
              .then(setUnreadCount)
              .catch((err) => console.error("Error loading unread message count:", err));
          }, 1000);
        },
      )
      .subscribe() : null;

    return () => {
      if (notifChannel) supabase?.removeChannel(notifChannel);
      if (messagesChannel) supabase?.removeChannel(messagesChannel);
      if (msgDebounceTimer) clearTimeout(msgDebounceTimer);
      if (unsubscribe) unsubscribe();
    };
    // Por usuário: com `[]`, se o layout montasse antes da sessão ficar pronta
    // (user null), os canais nunca eram criados e os badges só mudavam com
    // refresh manual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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
    loadProfilePhoto();
  }, [loadProfilePhoto]);

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

  // Scroll hide header — mobile only, only on feed, shots, vitrine, metas and perfil pages.
  // Comunidade ficou de fora de propósito: esconder header/abas atrapalhava a
  // usabilidade da tela (containers com scroll interno, uma aba por vez).
  const isScrollHidePage = location.pathname === "/" || location.pathname === "/shots" || location.pathname === "/vitrine" || location.pathname === "/metas" || location.pathname === "/perfil" || location.pathname.startsWith("/usuario/");

  React.useEffect(() => {
    if (!isScrollHidePage) {
      setHeaderHidden(false);
      return;
    }

    let lastY = window.scrollY;
    let ticking = false;

    const evaluate = (y: number) => {
      const delta = y - lastY;
      if (y > 96 && delta > 30) setHeaderHidden(true);
      if (delta < -30) setHeaderHidden(false);
      lastY = y;
    };

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
  const showTimer = dailyLimitMinutes > 0 && !limitIgnoredToday;
  // Só o estado — o layout re-renderiza quando ele MUDA, não a cada segundo.
  const timerStatus = useUsageClock((c) => {
    if (!dailyLimitMinutes) return "ok";
    const remaining = remainingOf(c, limitSeconds);
    return remaining <= 0 ? "expired" : remaining <= 300 ? "urgent" : "ok";
  });
  const timerUrgent = timerStatus === "urgent"; // last 5 min
  const timerExpired = timerStatus === "expired" && dailyLimitMinutes > 0;

  // Show block screen when timer expires (not if user ignored limit today)
  React.useEffect(() => {
    if (timerExpired && !timerBlockVisible && !limitIgnoredToday) {
      setTimerBlockVisible(true);
    }
  }, [timerExpired, limitIgnoredToday]);

  // Comunidade (mensagens + duelos + ranking) é a superfície social mais rica do
  // app — vive no bottom nav. A Vitrine, sendo consulta ocasional, saiu do nav
  // principal para o header, junto de busca e notificações.
  const mainNavItems: NavItem[] = React.useMemo(() => [
    { to: "/", label: t("nav_home"), icon: Home },
    // Shots guardado para um update futuro (FEATURES.shots): com pouco
    // conteúdo, um feed vertical de vídeo esvazia em segundos. Sem ele o nav
    // fica com 4 itens — o botão central de publicar continua no meio.
    ...(FEATURES.shots ? [{ to: "/shots", label: t("nav_clips"), icon: Video }] : []),
    { to: "/postar", label: t("nav_new"), icon: PlusSquare },
    { to: "/metas", label: t("nav_goals"), icon: Dumbbell },
    { to: "/comunidade", label: t("nav_community") ?? "Comunidade", icon: Users2, badge: unreadCount },
  ], [t, unreadCount]);

  const sidebarExtraItems: NavItem[] = React.useMemo(() => [
    { to: "/buscar", label: t("nav_search") ?? "Buscar", icon: Search },
    { to: "/notificacoes", label: t("settings_notifications"), icon: Bell, badge: unreadNotificationsCount },
    ...(FEATURES.store ? [{ to: "/vitrine", label: t("nav_store"), icon: ShoppingBag }] : []),
  ], [t, unreadNotificationsCount]);

  const allSidebarItems = [...mainNavItems, ...sidebarExtraItems];

  // `isolate`: abre um stacking context aqui. Sem ele, os brilhos de fundo das
  // telas (`fixed inset-0 -z-10`, Feed e Notificações) eram pintados ATRÁS do
  // bg-background deste container e ficavam invisíveis.
  return (
    <div
      className="min-h-dvh bg-background isolate"
      style={{ "--sidebar-width": typeof window !== "undefined" && window.innerWidth >= 768 ? (sidebarExpanded ? "244px" : "68px") : "0px" } as React.CSSProperties}
    >

      {/* ── DESKTOP SIDEBAR (md+) — chrome only, no Outlet ── */}
      {/* Sem transição de largura: o width animando de 68→244px reflui os
          rótulos enquanto o container ainda está estreito, fazendo as letras
          "montarem" verticalmente antes de virar horizontal. Snap direto — os
          nomes já aparecem posicionados assim que expande. */}
      <aside
        className={cn(
          "hidden md:flex fixed top-0 left-0 z-40 h-full flex-col border-r border-border/40 bg-background py-6",
          sidebarExpanded ? "w-[244px] px-3" : "w-[68px] px-2",
        )}
      >
        {/* Logo */}
        <button
          onClick={() => {
            if (location.pathname === "/") {
              requestAppRefresh("home");
              window.dispatchEvent(new CustomEvent("ritmofit-refresh-feed"));
            } else {
              navigate("/");
            }
          }}
          aria-label={t("nav_home_aria")}
          className={cn(
            "mb-6 flex items-center rounded-xl py-2 hover:bg-muted/50 transition cursor-pointer",
            sidebarExpanded ? "px-3" : "justify-center px-0",
          )}
        >
          {sidebarExpanded
            ? <img src="/logo-branco.png" alt="LinKa" className="h-7" />
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
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-unread text-white text-[10px] font-bold">
                        {item.badge > 9 ? "9+" : item.badge}
                      </span>
                    ) : null}
                  </span>
                  {sidebarExpanded && <span className="whitespace-nowrap">{item.label}</span>}
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
                <DailyTimerLabel limitSeconds={limitSeconds} className="text-sm font-mono font-bold" />
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
          aria-label={t("nav_profile")}
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
            <Link to="/perfil" aria-label={t("nav_profile")} onClick={() => hapticLight()}>
              <UserAvatar
                photo={profilePhoto}
                size="sm"
                className="h-9 w-9 border-[1.5px] border-white/40 flex-shrink-0"
              />
            </Link>
            <button
              onClick={() => {
                hapticLight();
                if (location.pathname === "/") {
                  requestAppRefresh("home");
                  window.dispatchEvent(new CustomEvent("ritmofit-refresh-feed"));
                  const feedContainer = document.querySelector('[data-feed-container]');
                  if (feedContainer) feedContainer.scrollTop = 0;
                } else {
                  navigate("/");
                }
              }}
              aria-label={t("nav_home_refresh_aria")}
              className="flex items-center cursor-pointer"
            >
              <img src="/logo-branco.png" alt="LinKa" className="h-6 w-auto object-contain" />
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
                <DailyTimerLabel limitSeconds={limitSeconds} />
              </div>
            )}
            <Link
              to="/buscar"
              aria-label={t("nav_search") ?? "Buscar"}
              onClick={() => hapticLight()}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
              style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.12)" }}
            >
              <Search className="h-[18px] w-[18px]" />
            </Link>
            {FEATURES.store && (
              <Link
                to="/vitrine"
                aria-label={t("nav_store")}
                onClick={() => hapticLight()}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
                style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.12)" }}
              >
                <ShoppingBag className="h-[18px] w-[18px]" />
              </Link>
            )}
            <Link
              to="/notificacoes"
              aria-label={t("settings_notifications")}
              onClick={() => hapticLight()}
              className="relative w-10 h-10 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
              style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.12)" }}
            >
              <Bell className="h-[18px] w-[18px]" />
              {unreadNotificationsCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-unread px-1 text-[10px] font-bold text-white"
                  style={{ border: "1.5px solid #06070c" }}
                >
                  {unreadNotificationsCount > 9 ? "9+" : unreadNotificationsCount}
                </span>
              )}
            </Link>
          </div>
        </header>
      )}

      {/* ── SINGLE OUTLET — rendered once, responsive for mobile and desktop ── */}
      <div
        className={cn(
          // Sem transição: acompanha o snap da sidebar (ver comentário no <aside>)
          // — evita o conteúdo deslizar enquanto a barra abre instantaneamente.
          sidebarExpanded ? "md:ml-[244px]" : "md:ml-[68px]",
        )}
      >
        <main
          ref={mainRef}
          className={cn(
            "w-full",
            isFullscreenPage
              ? "pt-0 px-0 pb-0"
              : location.pathname === "/shots"
                ? "pt-0 px-0 pb-0"
                : cn(
                    // Mobile: no horizontal padding (each page/card controls its own), glass header top offset
                    "px-0",
                    !hideNav
                      ? "pb-[calc(env(safe-area-inset-bottom)+100px)]"
                      : "pb-6",
                  ),
            location.pathname === "/shots"
              ? "md:px-0 md:pb-0 md:pt-0 md:max-w-[680px] md:mx-auto md:min-h-dvh"
              : "md:px-0 md:pb-6 md:pt-6 md:max-w-[680px] md:mx-auto md:min-h-dvh",
          )}
          style={
            !isFullscreenPage && location.pathname !== "/shots"
              ? { paddingTop: "var(--app-header-offset)" }
              : undefined
          }
        >
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>

      {/* ── MOBILE BOTTOM NAV (< md) — floating glass pill ── */}
      {!hideNav && !isFullscreenPage && (
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
          {/* Colunas seguem a quantidade real de itens. `grid-cols-5` fixo
              deixava uma coluna fantasma à direita quando uma flag esconde um
              item (Shots, hoje), empurrando os quatro restantes para a
              esquerda. Vai em style, e não em classe, porque nome de classe
              montado em runtime (`grid-cols-${n}`) não sobrevive à purga do
              Tailwind — sairia sem regra nenhuma no build de produção. */}
          <div
            className="grid w-full h-full"
            style={{ gridTemplateColumns: `repeat(${mainNavItems.length}, minmax(0, 1fr))` }}
          >
            {mainNavItems.map((item) => {
              const active = isActivePath(location.pathname, item.to);
              const Icon = item.icon;
              const isHome = item.to === "/";
              // "Novo post" era o botão-herói do nav: círculo com gradiente,
              // sombra colorida e sem o ponto de item ativo. Aquele destaque
              // fazia sentido com 5 itens, em que ele ocupava o centro exato.
              // Com 4 ele deixa de ser o meio e o gradiente vira só um item
              // gritando mais alto que os outros — agora se comporta como os
              // demais. Ao religar FEATURES.shots, considere restaurá-lo.
              const isCenter = false;
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
                      requestAppRefresh("home");
                      window.dispatchEvent(new CustomEvent("ritmofit-refresh-feed"));
                    }
                  }}
                >
                  <motion.span
                    whileTap={{ scale: 0.82 }}
                    animate={active && !isCenter ? { y: -2, scale: 1 } : { y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="relative grid place-items-center"
                    style={isCenter ? { width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#ff9d6c,#d8567a 50%,#7b3ff2)", boxShadow: "0 4px 14px -4px rgba(216,86,122,.6)" } : { width: 32, height: 32 }}
                  >
                    <Icon className={isCenter ? "h-5 w-5 text-white" : "h-[22px] w-[22px]"} />
                    {item.badge && item.badge > 0 ? (
                      <span
                        className="absolute -top-0.5 -right-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-unread px-1 text-[10px] font-bold text-white"
                        style={{ border: "1.5px solid #0a0b12" }}
                      >
                        {item.badge > 9 ? "9+" : item.badge}
                      </span>
                    ) : null}
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
              className="flex items-center gap-2 text-white rounded-full px-4 py-3 font-semibold text-sm transition-all active:scale-95 relative overflow-hidden"
              style={{
                background: "linear-gradient(rgba(255,255,255,.16),rgba(255,255,255,.06))",
                backdropFilter: "blur(26px) saturate(180%)",
                WebkitBackdropFilter: "blur(26px) saturate(180%)",
                border: "1px solid rgba(255,255,255,.18)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.3), 0 16px 36px -12px rgba(0,0,0,.6)",
              }}
            >
              <MinimizedWorkoutLabel
                restActive={globalRestTimerActive}
                restTotal={globalRestTimerTotal}
                inProgressLabel={t("goals_workout_in_progress")}
              />
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

      {/* Global routine-completed celebration (haptic + on-screen toast) */}
      <RoutineCompletedToast />

      {/* Pop up de mensagem privada recebida com o app aberto (qualquer tela) */}
      <IncomingMessageToast />

      {/* Convite para treinar junto — chega em qualquer tela porque o treino é
          AGORA; deixar só na aba de notificações seria o mesmo que não avisar. */}
      {FEATURES.workoutParty && (
      <WorkoutPartyInviteDialog
        invite={partyInvite}
        busyWithOtherWorkout={isTrainingNow}
        onAccept={handleAcceptPartyInvite}
        onDecline={handleDeclinePartyInvite}
        onDismiss={() => setPartyInvite(null)}
      />
      )}

      {congratsTier && (
        <VerifiedCongratsDialog
          tier={congratsTier}
          onClose={() => closeVerifiedCongrats(false)}
          onConfirm={() => closeVerifiedCongrats(true)}
        />
      )}

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
                  // Persistido com o uso do dia — reabrir o app não desfaz o adiar.
                  const usage = readDailyUsage();
                  usage.snooze += seconds;
                  writeDailyUsage(usage);
                  setUsageClock({ seconds: Math.floor(usage.seconds), snooze: usage.snooze });
                  setTimerBlockVisible(false);
                }}
              >
                {label}
              </Button>
            ))}
            {/* "Ignorar hoje" derrota o propósito do limite — fica como ação
                terciária, nunca como CTA em destaque. */}
            <Button
              variant="ghost"
              className="w-full rounded-full text-muted-foreground"
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

/**
 * Rótulo do botão do treino minimizado. É o único pedaço do layout que observa
 * os segundos do descanso — o resto do header/footer não re-renderiza a cada
 * tique (ver `useWorkoutClock`).
 */
function MinimizedWorkoutLabel({
  restActive,
  restTotal,
  inProgressLabel,
}: {
  restActive: boolean;
  restTotal: number;
  inProgressLabel: string;
}) {
  const remaining = useWorkoutClock((c) => c.restRemaining);
  if (restActive && remaining > 0) {
    const pct = restTotal > 0 ? (remaining / restTotal) * 100 : 0;
    return (
      <>
        <Timer className="h-4 w-4 shrink-0" />
        <span>{remaining}s</span>
        <span
          className="absolute bottom-0 left-0 h-1 bg-white/40 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </>
    );
  }
  return (
    <>
      <Dumbbell className="h-4 w-4" />
      {inProgressLabel}
    </>
  );
}
