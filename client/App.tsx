import * as React from "react";

import "./global.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot, type Root } from "react-dom/client";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import { AppLayout } from "@/components/layout/app-layout";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { LanguageProvider } from "@/lib/language-context";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FloatingActionMenu } from "@/components/layout/floating-action-menu";

import { useAuth } from "@/hooks/useAuth";
import { useLayoutMode } from "@/hooks/useLayoutMode";

// Lazy-load heavy pages to split the initial bundle
const Index        = React.lazy(() => import("@/pages/Index"));
const NewPost      = React.lazy(() => import("@/pages/NewPost"));
const Goals        = React.lazy(() => import("@/pages/Goals"));
const Profile      = React.lazy(() => import("@/pages/Profile"));
const PostDetail   = React.lazy(() => import("@/pages/PostDetail"));
const Search       = React.lazy(() => import("@/pages/Search"));
const Community    = React.lazy(() => import("@/pages/Community"));
const Notifications = React.lazy(() => import("@/pages/Notifications"));
const Store        = React.lazy(() => import("@/pages/Store"));
const ShotsLayout  = React.lazy(() => import("@/components/layout/shots-layout").then((m) => ({ default: m.ShotsLayout })));

// Kept eager — tiny files needed on first paint or error boundaries
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function AuthLoadingScreen() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background p-6">
      <div className="text-center">
        <img src="/logo.png" alt="LinKa" className="h-12 mx-auto" />
        <div className="mt-1 text-sm text-muted-foreground">Carregando…</div>
      </div>
    </div>
  );
}

function RequireAuth() {
  const location = useLocation();
  const { user, loading } = useAuth();

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

  return (
    <React.Suspense fallback={<AuthLoadingScreen />}>
      <Outlet />
    </React.Suspense>
  );
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
    // Register Service Worker only in production builds.
    if (!import.meta.env.PROD) return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.warn("SW registration failed", err));
  }, []);

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
      <LanguageProvider>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <GlobalFABContainer />
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route element={<RequireAuth />}>
                {/* Shots with custom footer layout */}
                <Route path="/shots" element={<ShotsLayout />} />

                <Route element={<AppLayout />}>
                  <Route path="/" element={<Index />} />
                  <Route path="/postar" element={<NewPost />} />
                  <Route path="/metas" element={<Goals />} />
                  <Route path="/loja" element={<Store />} />
                  <Route path="/perfil" element={<Profile />} />
                  <Route path="/usuario/:userId" element={<Profile />} />
                  <Route path="/post/:postId" element={<PostDetail />} />
                  <Route path="/buscar" element={<Search />} />
                  <Route path="/comunidade" element={<Community />} />
                  <Route path="/mensagens" element={<Navigate to="/comunidade" replace />} />
                  <Route path="/notificacoes" element={<Notifications />} />

                  {/* compatibility */}
                  <Route
                    path="/criar"
                    element={<Navigate to="/postar" replace />}
                  />

                  <Route path="*" element={<NotFound />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
};

const container = document.getElementById("root")!;

const existingRoot = (container as unknown as { __ritmofitRoot?: Root })
  .__ritmofitRoot;

const root = existingRoot ?? createRoot(container);
(container as unknown as { __ritmofitRoot?: Root }).__ritmofitRoot = root;

root.render(<App />);
