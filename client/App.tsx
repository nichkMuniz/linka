import * as React from "react";

import "./global.css";

import { t as translate, type Language, type TranslationKey } from "@/lib/i18n";
import {
  APP_VERSION,
  initMonitoring,
  reportFatalError,
  reportHandledError,
  setMonitoringScreen,
  setMonitoringUser,
} from "@/lib/monitoring";

// Antes de qualquer render: erro no primeiro frame também precisa ser capturado.
initMonitoring();

/**
 * O boundary vive FORA do LanguageProvider (ele embrulha o <App/> inteiro, que
 * é quem monta os providers), então não dá para usar `useLanguage`. Lê o idioma
 * da mesma chave que o provider persiste — ver language-context.tsx.
 */
function boundaryLanguage(): Language {
  try {
    return localStorage.getItem("ritmofit-language") === "en" ? "en" : "pt";
  } catch {
    return "pt";
  }
}

/**
 * Última linha de defesa: um erro de render derrubaria a árvore inteira e
 * deixaria a tela branca. Aqui ele vira uma tela explicável, com caminho de
 * saída, e — o principal — é reportado. Sem o reporte, uma tela branca em
 * produção é invisível para nós.
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null; eventId?: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ eventId: reportFatalError(error, info.componentStack) });
  }

  render() {
    const { error, eventId } = this.state;
    if (!error) return this.props.children;

    const t = (key: TranslationKey) => translate(boundaryLanguage(), key);

    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          textAlign: "center",
          background: "linear-gradient(rgba(30,28,40,1),rgba(14,13,20,1))",
          color: "#fff",
          paddingTop: "max(24px, env(safe-area-inset-top))",
          paddingBottom: "max(24px, env(safe-area-inset-bottom))",
          paddingLeft: "max(24px, env(safe-area-inset-left))",
          paddingRight: "max(24px, env(safe-area-inset-right))",
        }}
      >
        <span style={{ fontSize: 44 }} aria-hidden>
          ⚠️
        </span>
        <p style={{ fontSize: 18, fontWeight: 600 }}>{t("app_error_title")}</p>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,.6)", maxWidth: 320, lineHeight: 1.5 }}>
          {t("app_error_desc")}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, width: "100%", maxWidth: 280 }}>
          <button
            onClick={() => this.setState({ error: null, eventId: undefined })}
            style={{
              padding: "12px 20px",
              borderRadius: 9999,
              border: "none",
              fontSize: 15,
              fontWeight: 600,
              color: "#fff",
              background: "linear-gradient(135deg,#5b8cff,#9d6bff)",
            }}
          >
            {t("app_error_retry")}
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "12px 20px",
              borderRadius: 9999,
              fontSize: 15,
              fontWeight: 500,
              color: "rgba(255,255,255,.75)",
              background: "rgba(255,255,255,.08)",
              border: "1px solid rgba(255,255,255,.12)",
            }}
          >
            {t("app_error_reload")}
          </button>
        </div>

        {/* O código é o que o usuário consegue citar no suporte, e nos leva
            direto ao evento no painel do Sentry. */}
        {eventId && (
          <p style={{ fontSize: 11, marginTop: 12, color: "rgba(255,255,255,.35)", fontFamily: "monospace" }}>
            {t("app_error_code").replace("{code}", eventId.slice(0, 8))} · v{APP_VERSION}
          </p>
        )}

        {/* Stack só em desenvolvimento: em produção seria um paredão de código
            para o usuário — e um convite à rejeição na review da Apple. */}
        {import.meta.env.DEV && (
          <pre
            style={{
              fontSize: 11,
              marginTop: 16,
              color: "#f87171",
              whiteSpace: "pre-wrap",
              textAlign: "left",
              maxHeight: "40vh",
              overflow: "auto",
              width: "100%",
            }}
          >
            {error.message}
            {"\n\n"}
            {error.stack}
          </pre>
        )}
      </div>
    );
  }
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot, type Root } from "react-dom/client";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { App as CapApp } from "@capacitor/app";
import { StatusBar, Style as StatusBarStyle } from "@capacitor/status-bar";

import { ThemeProvider } from "@/components/layout/theme-provider";
import { LanguageProvider } from "@/lib/language-context";
import { WorkoutProvider } from "@/lib/workout-context";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { useAuthContext as useAuth, AuthProvider } from "@/lib/auth-context";
import { PremiumProvider } from "@/lib/premium-context";
import { useLanguage } from "@/lib/language-context";
import { useLayoutMode } from "@/hooks/useLayoutMode";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { initKeyboardTracker } from "@/lib/keyboard";
import { APP_STORE_URL, parseDeepLinkUrl } from "@/lib/share-url";
import { ADMIN_USER_IDS } from "@/lib/admin";

// Teclado iOS (Keyboard resize:'none'): publica --keyboard-height/kb-open no
// <html> a partir dos eventos nativos. Singleton de app — inicia no bootstrap.
initKeyboardTracker();

// ─── Fronteira do chunk de ENTRADA ───────────────────────────────────────────
//
// Tudo que este arquivo importa ESTATICAMENTE é baixado, parseado e executado
// antes do primeiro pixel — em toda abertura do app. O chunk de entrada estava
// em 1,34 MB porque o caminho estático daqui alcançava o `ritmofit-db`
// (12k linhas, 328 funções) por três arestas ao mesmo tempo: `AppLayout`,
// `Login` e o `PremiumProvider`. Cortadas as três, o módulo passa a viajar num
// chunk próprio, carregado em paralelo com o da rota — e só por quem precisa.
//
// A shell (`AppLayout`) é lazy junto com as páginas de propósito: ela nunca
// aparece sozinha, sempre acompanha uma rota que também é lazy, então os dois
// chunks são buscados no mesmo instante e do disco local (Capacitor).
const AppLayout = React.lazy(() =>
  import("@/components/layout/app-layout").then((m) => ({ default: m.AppLayout })),
);
const BannedScreen = React.lazy(() =>
  import("@/components/shared/banned-screen").then((m) => ({ default: m.BannedScreen })),
);
const FloatingActionMenu = React.lazy(() =>
  import("@/components/layout/floating-action-menu").then((m) => ({ default: m.FloatingActionMenu })),
);

// Lazy-load heavy pages to split the initial bundle
const Index = React.lazy(() => import("@/pages/Index"));
const NewPost = React.lazy(() => import("@/pages/NewPost"));
const Goals = React.lazy(() => import("@/pages/Goals"));
const Profile = React.lazy(() => import("@/pages/Profile"));
const PostDetail = React.lazy(() => import("@/pages/PostDetail"));
const Search = React.lazy(() => import("@/pages/Search"));
const Community = React.lazy(() => import("@/pages/Community"));
const Notifications = React.lazy(() => import("@/pages/Notifications"));
const Store = React.lazy(() => import("@/pages/Store"));
const Shots = React.lazy(() => import("@/pages/Shots"));
const FlowViewer = React.lazy(() => import("@/pages/FlowViewer"));
const Hashtag = React.lazy(() => import("@/pages/Hashtag"));
// Admin: só 3 usuários acessam. Eager, entrava no bundle inicial de TODO mundo.
const Admin = React.lazy(() => import("@/pages/Admin"));

import {
  CommunitySkeleton,
  GoalsSkeleton,
  ProfileSkeleton,
  NotificationsSkeleton,
  PostDetailSkeleton,
  StoreSkeleton,
  PostSkeleton,
  SkeletonLoader,
} from "@/components/shared/animated-loading";

function FeedSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl flex flex-col">
      <div className="bg-background border-b border-border/60 px-3 py-3">
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1 shrink-0">
              <div className="w-14 h-14 rounded-full bg-muted animate-pulse" />
              <div className="w-10 h-2 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid w-full gap-3 py-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <PostSkeleton key={i} tall />
        ))}
      </div>
    </div>
  );
}

function ShotsSkeleton() {
  return (
    <div
      className="bg-black w-full h-[calc(100dvh-4.25rem-env(safe-area-inset-bottom))] md:h-dvh"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    />
  );
}

function GenericPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl p-4">
      <SkeletonLoader lines={6} />
    </div>
  );
}

function Lazy({ skeleton, children }: { skeleton: React.ReactNode; children: React.ReactNode }) {
  return <React.Suspense fallback={skeleton}>{children}</React.Suspense>;
}

// `Login` também é lazy: são 104 KB de fonte que importam o `ritmofit-db`, e
// quem abre o app já logado — a maioria esmagadora das aberturas — nunca
// renderiza esta tela. Deixá-la eager fazia todo mundo pagar por ela.
const Login = React.lazy(() => import("@/pages/Login"));
const ResetPassword = React.lazy(() => import("@/pages/ResetPassword"));

// `NotFound` continua eager: é minúsculo e serve de rota de fallback.
import NotFound from "@/pages/NotFound";

/** Fundo sólido do app — placeholder enquanto um chunk de tela chega do disco. */
function AppShellFallback() {
  return <div className="min-h-dvh bg-background" />;
}

/**
 * Quando o link é aberto no browser (app não instalado), redireciona para a
 * App Store no iOS ou mostra um fallback em outras plataformas.
 * Dentro do WebView do Capacitor, window.Capacitor existe — não faz nada.
 */
function AppStoreRedirect() {
  const { t } = useLanguage();

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as unknown as { Capacitor?: unknown }).Capacitor) return;

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIOS) {
      window.location.replace(APP_STORE_URL);
    }
  }, []);

  if ((window as unknown as { Capacitor?: unknown }).Capacitor) return null;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS) return null;

  return (
    <div className="grid min-h-dvh place-items-center bg-background p-6 text-center">
      <div>
        <img src="/logo-branco.png" alt="Linka" className="h-12 mx-auto mb-6" />
        <p className="text-lg font-semibold mb-2">{t("app_store_title")}</p>
        <p className="text-muted-foreground mb-6 text-sm">
          {t("app_store_desc")}
        </p>
        <a
          href={APP_STORE_URL}
          className="inline-block bg-primary text-primary-foreground rounded-xl px-6 py-3 font-medium"
        >
          {t("app_store_btn")}
        </a>
      </div>
    </div>
  );
}

/**
 * Recebe Universal Links (`https://linkafit.com.br/post/…`) e o custom scheme
 * (`com.linka.meuapp://post/…`) e leva o usuário ao destino.
 *
 * O parsing das duas formas de URL mora em `parseDeepLinkUrl`
 * (`shared/share-config.ts`), junto das constantes de domínio.
 */
function DeepLinkHandler() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // Destino pendente. O `appUrlOpen` é emitido pelo plugin com
  // `retainUntilConsumed: true`: em cold start (app fechado, usuário toca no
  // link no WhatsApp) o evento é entregue no INSTANTE em que este listener
  // monta — quando a sessão do Supabase ainda está sendo restaurada e `user`
  // ainda é null. Decidir o destino nesse momento mandava um usuário LOGADO
  // para /login (a tela de Login o resgatava depois via `deeplink_redirect`,
  // mas com um flash visível). Guardamos o alvo e só resolvemos quando
  // `loading` vira false e `user` já reflete a sessão real.
  const [pendingPath, setPendingPath] = React.useState<string | null>(null);

  React.useEffect(() => {
    const listener = CapApp.addListener("appUrlOpen", ({ url }) => {
      const target = parseDeepLinkUrl(url);

      if (target.kind === "ignore") return;

      // Recuperação de senha: navegar para /login faz o onAuthStateChange
      // disparar PASSWORD_RECOVERY e a tela mostrar o formulário de nova senha.
      if (target.kind === "recovery") {
        navigate("/login", { replace: true });
        return;
      }

      setPendingPath(target.path);
    });

    return () => {
      listener.then((l) => l.remove());
    };
  }, [navigate]);

  React.useEffect(() => {
    if (!pendingPath || loading) return;

    setPendingPath(null);

    if (user) {
      navigate(pendingPath);
    } else {
      // Guarda o destino para redirecionar após login (Login.tsx consome).
      sessionStorage.setItem("deeplink_redirect", pendingPath);
      navigate("/login");
    }
  }, [pendingPath, loading, user, navigate]);

  return null;
}

const queryClient = new QueryClient();

function AuthLoadingScreen() {
  return <div className="min-h-dvh bg-background" />;
}

/**
 * Conta banida pela moderação.
 *
 * Não bloqueia o primeiro render de propósito: a checagem é uma ida ao servidor
 * e travar o app inteiro atrás dela pioraria o cold start de **todo mundo** para
 * pegar o caso raríssimo do banido. Quem manda o usuário embora de fato é o
 * `banned_until` do GoTrue (ver `20260811-admin-ban-user.sql`); esta tela é o
 * aviso imediato, enquanto o access token que ele já tem não expira.
 */
function useBanGuard(userId: string | null): boolean {
  const [banned, setBanned] = React.useState(false);

  React.useEffect(() => {
    if (!userId) {
      setBanned(false);
      return;
    }

    let active = true;
    // Import dinâmico: `ritmofit-db` é enorme e o App.tsx é o chunk de entrada —
    // um import estático aqui atrasaria o primeiro frame de todo mundo.
    import("@/lib/ritmofit-db")
      .then(({ isCurrentUserBannedDb }) => isCurrentUserBannedDb())
      .then((isBanned) => {
        if (active) setBanned(isBanned);
      })
      .catch(() => {
        // Sem resposta = sem bloqueio; o GoTrue ainda barra o refresh.
      });

    return () => {
      active = false;
    };
  }, [userId]);

  return banned;
}

function RequireAuth() {
  const location = useLocation();
  const { user, loading } = useAuth();
  const banned = useBanGuard(user?.id ?? null);

  // Register for remote push notifications when user is authenticated
  usePushNotifications(user?.id ?? null);

  if (loading) return <AuthLoadingScreen />;

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  if (banned) {
    return (
      <React.Suspense fallback={<AppShellFallback />}>
        <BannedScreen />
      </React.Suspense>
    );
  }

  return <Outlet />;
}

function RequireAdmin() {
  const location = useLocation();
  const { user, loading } = useAuth();

  if (loading) return <AuthLoadingScreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!ADMIN_USER_IDS.includes(user.id)) return <Navigate to="/" replace />;

  return <Outlet />;
}

/**
 * Alimenta o Sentry com o contexto que transforma "quebrou" em "quebrou na tela
 * X, para N usuários": quem está logado e em que rota o erro aconteceu.
 * Renderiza dentro do BrowserRouter e do AuthProvider — precisa dos dois.
 */
function MonitoringBridge() {
  const { user } = useAuth();
  const location = useLocation();

  React.useEffect(() => {
    setMonitoringUser(user?.id ?? null);
  }, [user?.id]);

  React.useEffect(() => {
    setMonitoringScreen(location.pathname);
  }, [location.pathname]);

  return null;
}

function GlobalFABContainer() {
  const { layoutMode } = useLayoutMode();
  const { user } = useAuth();

  // Only show FAB when layoutMode is "novo" and user is authenticated
  if (layoutMode !== "novo" || !user) {
    return null;
  }

  // Sem fallback: o FAB é um adorno flutuante — aparecer alguns ms depois é
  // invisível, e um placeholder no lugar dele só piscaria sobre o conteúdo.
  return (
    <React.Suspense fallback={null}>
      <FloatingActionMenu />
    </React.Suspense>
  );
}

const App = () => {
  React.useEffect(() => {
    // Configure native status bar for iOS
    StatusBar.setStyle({ style: StatusBarStyle.Dark }).catch(() => {});
    StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});

    // Handle unhandled promise rejections from network errors
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;

      // Suppress network errors from Supabase during auth initialization
      if (
        reason instanceof TypeError &&
        reason.message.includes("Failed to fetch")
      ) {
        console.warn(
          "[Network] Supabase unreachable - app may be offline or CORS not configured",
        );
        event.preventDefault();
        return;
      }

      // Todo o resto é bug de verdade. `console.error` sozinho não existe para
      // ninguém no device — sem este reporte, todo erro assíncrono que escapa
      // some sem deixar rastro. (O filtro de ruído fica no beforeSend.)
      console.error("[Unhandled rejection]", reason);
      reportHandledError(reason, "unhandled-rejection");
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
      <PremiumProvider>
      <LanguageProvider>
        <WorkoutProvider>
          <ThemeProvider>
            <TooltipProvider>
              <AppStoreRedirect />
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <MonitoringBridge />
                <DeepLinkHandler />
                <GlobalFABContainer />
                <Routes>
                  <Route path="/login" element={<Lazy skeleton={<AppShellFallback />}><Login /></Lazy>} />
                  <Route path="/reset-password" element={<Lazy skeleton={<AppShellFallback />}><ResetPassword /></Lazy>} />

                  <Route element={<RequireAuth />}>
                    <Route path="/flows/:storyId" element={<React.Suspense fallback={<div className="fixed inset-0 bg-black" />}><FlowViewer /></React.Suspense>} />
                    <Route element={<Lazy skeleton={<AppShellFallback />}><AppLayout /></Lazy>}>
                      <Route path="/" element={<Lazy skeleton={<FeedSkeleton />}><Index /></Lazy>} />
                      <Route path="/shots" element={<Lazy skeleton={<ShotsSkeleton />}><Shots /></Lazy>} />
                      <Route path="/postar" element={<Lazy skeleton={<GenericPageSkeleton />}><NewPost /></Lazy>} />
                      <Route path="/metas" element={<Lazy skeleton={<GoalsSkeleton />}><Goals /></Lazy>} />
                      <Route path="/vitrine" element={<Lazy skeleton={<StoreSkeleton />}><Store /></Lazy>} />
                      <Route path="/perfil" element={<Lazy skeleton={<ProfileSkeleton />}><Profile /></Lazy>} />
                      <Route path="/usuario/:userId" element={<Lazy skeleton={<ProfileSkeleton />}><Profile /></Lazy>} />
                      <Route path="/post/:postId" element={<Lazy skeleton={<PostDetailSkeleton />}><PostDetail /></Lazy>} />
                      <Route path="/tag/:tag" element={<Lazy skeleton={<GenericPageSkeleton />}><Hashtag /></Lazy>} />
                      <Route path="/buscar" element={<Lazy skeleton={<GenericPageSkeleton />}><Search /></Lazy>} />
                      <Route path="/comunidade" element={<Lazy skeleton={<CommunitySkeleton />}><Community /></Lazy>} />
                      <Route path="/mensagens" element={<Navigate to="/comunidade" replace />} />
                      <Route path="/notificacoes" element={<Lazy skeleton={<NotificationsSkeleton />}><Notifications /></Lazy>} />

                      {/* compatibility */}
                      <Route
                        path="/criar"
                        element={<Navigate to="/postar" replace />}
                      />

                      <Route path="*" element={<NotFound />} />
                    </Route>
                  </Route>

                  <Route element={<RequireAdmin />}>
                    <Route path="/admin" element={<Lazy skeleton={<GenericPageSkeleton />}><Admin /></Lazy>} />
                  </Route>
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </ThemeProvider>
        </WorkoutProvider>
      </LanguageProvider>
      </PremiumProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

const container = document.getElementById("root")!;

const existingRoot = (container as unknown as { __ritmofitRoot?: Root })
  .__ritmofitRoot;

const root = existingRoot ?? createRoot(container);
(container as unknown as { __ritmofitRoot?: Root }).__ritmofitRoot = root;

root.render(<ErrorBoundary><App /></ErrorBoundary>);
