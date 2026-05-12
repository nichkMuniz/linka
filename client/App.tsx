import * as React from "react";

import "./global.css";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: "#fff", background: "#111", minHeight: "100dvh", fontFamily: "monospace" }}>
          <p style={{ fontWeight: "bold", fontSize: 16, marginBottom: 8 }}>App error</p>
          <p style={{ fontSize: 13, color: "#f87171" }}>{this.state.error.message}</p>
          <pre style={{ fontSize: 11, marginTop: 12, color: "#aaa", whiteSpace: "pre-wrap" }}>
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
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

import { AppLayout } from "@/components/layout/app-layout";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { LanguageProvider } from "@/lib/language-context";
import { WorkoutProvider } from "@/lib/workout-context";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FloatingActionMenu } from "@/components/layout/floating-action-menu";

import { useAuthContext as useAuth, AuthProvider } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { useLayoutMode } from "@/hooks/useLayoutMode";
import { usePushNotifications } from "@/hooks/use-push-notifications";

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
        {Array.from({ length: 3 }).map((_, i) => (
          <PostSkeleton key={i} />
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

// Kept eager — tiny files needed on first paint or error boundaries
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import Admin from "@/pages/Admin";

const ADMIN_USER_ID = "c954d5ab-9d72-4785-bc21-bf469a5e8052";
const APP_STORE_URL = "https://apps.apple.com/app/id6761916728";

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

function DeepLinkHandler() {
  const navigate = useNavigate();
  const { user } = useAuth();

  React.useEffect(() => {
    const listener = CapApp.addListener("appUrlOpen", ({ url }) => {
      try {
        const parsed = new URL(url);
        const path = parsed.pathname;
        const hash = parsed.hash;

        // Ignora callbacks de auth comuns — tratados na página de Login
        if (path.includes("login-callback")) return;

        // Link de recuperação de senha: Supabase envia hash com type=recovery
        // Ao abrir o app via deeplink, navegar para /login para que o
        // onAuthStateChange dispare PASSWORD_RECOVERY e mostre o formulário.
        if (hash.includes("type=recovery")) {
          navigate("/login", { replace: true });
          return;
        }

        if (user) {
          navigate(path, { replace: false });
        } else {
          // Guarda o destino para redirecionar após login
          sessionStorage.setItem("deeplink_redirect", path);
          navigate("/login", { replace: false });
        }
      } catch {
        // URL inválida, ignora
      }
    });

    return () => {
      listener.then((l) => l.remove());
    };
  }, [navigate, user]);

  return null;
}

const queryClient = new QueryClient();

function AuthLoadingScreen() {
  return <div className="min-h-dvh bg-background" />;
}

function RequireAuth() {
  const location = useLocation();
  const { user, loading } = useAuth();

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

  return <Outlet />;
}

function RequireAdmin() {
  const location = useLocation();
  const { user, loading } = useAuth();

  if (loading) return <AuthLoadingScreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.id !== ADMIN_USER_ID) return <Navigate to="/" replace />;

  return <Outlet />;
}

function GlobalFABContainer() {
  const { layoutMode } = useLayoutMode();
  const { user } = useAuth();

  // Only show FAB when layoutMode is "novo" and user is authenticated
  if (layoutMode !== "novo" || !user) {
    return null;
  }

  return <FloatingActionMenu />;
}

const App = () => {
  React.useEffect(() => {
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

      // Let other errors propagate
      console.error("[Unhandled rejection]", reason);
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
      <LanguageProvider>
        <WorkoutProvider>
          <ThemeProvider>
            <TooltipProvider>
              <AppStoreRedirect />
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <DeepLinkHandler />
                <GlobalFABContainer />
                <Routes>
                  <Route path="/login" element={<Login />} />

                  <Route element={<RequireAuth />}>
                    <Route element={<AppLayout />}>
                      <Route path="/" element={<Lazy skeleton={<FeedSkeleton />}><Index /></Lazy>} />
                      <Route path="/shots" element={<Lazy skeleton={<ShotsSkeleton />}><Shots /></Lazy>} />
                      <Route path="/postar" element={<Lazy skeleton={<GenericPageSkeleton />}><NewPost /></Lazy>} />
                      <Route path="/metas" element={<Lazy skeleton={<GoalsSkeleton />}><Goals /></Lazy>} />
                      <Route path="/vitrine" element={<Lazy skeleton={<StoreSkeleton />}><Store /></Lazy>} />
                      <Route path="/perfil" element={<Lazy skeleton={<ProfileSkeleton />}><Profile /></Lazy>} />
                      <Route path="/usuario/:userId" element={<Lazy skeleton={<ProfileSkeleton />}><Profile /></Lazy>} />
                      <Route path="/post/:postId" element={<Lazy skeleton={<PostDetailSkeleton />}><PostDetail /></Lazy>} />
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
                    <Route path="/admin" element={<Admin />} />
                  </Route>
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </ThemeProvider>
        </WorkoutProvider>
      </LanguageProvider>
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
