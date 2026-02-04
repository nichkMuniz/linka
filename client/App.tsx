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

import { AppLayout } from "@/components/app-layout";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { useAuth } from "@/hooks/useAuth";

import ChooseGoal from "@/pages/ChooseGoal";
import ExerciseDetails from "@/pages/ExerciseDetails";
import Index from "@/pages/Index";
import Login from "@/pages/Login";
import NewPost from "@/pages/NewPost";
import NotFound from "@/pages/NotFound";
import Profile from "@/pages/Profile";
import RoutineDetails from "@/pages/RoutineDetails";
import WorkoutSession from "@/pages/WorkoutSession";

const queryClient = new QueryClient();

const NEEDS_GOAL_CHOICE_KEY = "ritmofit:needsGoalChoice";

function needsGoalChoice() {
  return localStorage.getItem(NEEDS_GOAL_CHOICE_KEY) === "1";
}

function AuthLoadingScreen() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background p-6">
      <div className="text-center">
        <div className="text-lg font-semibold tracking-tight">RitmoFit</div>
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

  if (needsGoalChoice() && location.pathname !== "/escolher-meta") {
    return <Navigate to="/escolher-meta" replace />;
  }

  return <Outlet />;
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

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route element={<RequireAuth />}>
                <Route path="/escolher-meta" element={<ChooseGoal />} />

                <Route element={<AppLayout />}>
                  <Route path="/" element={<Index />} />
                  <Route path="/postar" element={<NewPost />} />
                  <Route path="/buscar" element={<Search />} />
                  <Route path="/perfil" element={<Profile />} />
                  <Route path="/mensagens" element={<Messages />} />
                  <Route path="/rank" element={<Rank />} />
                  <Route path="/reels" element={<Reels />} />
                  <Route
                    path="/rotinas/:routineId/iniciar"
                    element={<WorkoutSession />}
                  />
                  <Route
                    path="/rotinas/:routineId"
                    element={<RoutineDetails />}
                  />
                  <Route
                    path="/exercicios/:exerciseId"
                    element={<ExerciseDetails />}
                  />

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
    </QueryClientProvider>
  );
};

const container = document.getElementById("root")!;

const existingRoot = (container as unknown as { __ritmofitRoot?: Root })
  .__ritmofitRoot;

const root = existingRoot ?? createRoot(container);
(container as unknown as { __ritmofitRoot?: Root }).__ritmofitRoot = root;

root.render(<App />);
