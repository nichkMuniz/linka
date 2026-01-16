import "./global.css";

import * as React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "@/components/app-layout";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import Index from "@/pages/Index";
import NewPost from "@/pages/NewPost";
import Search from "@/pages/Search";
import Profile from "@/pages/Profile";
import Messages from "@/pages/Messages";
import Rank from "@/pages/Rank";
import Reels from "@/pages/Reels";
import Install from "@/pages/Install";
import NotFound from "@/pages/NotFound";
import Placeholder from "@/pages/Placeholder";

const queryClient = new QueryClient();

const App = () => {
  React.useEffect(() => {
    // Register Service Worker only in production builds.
    if (!import.meta.env.PROD) return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      // eslint-disable-next-line no-console
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
              <Route element={<AppLayout />}>
                <Route path="/" element={<Index />} />
                <Route path="/postar" element={<NewPost />} />
                <Route path="/buscar" element={<Search />} />
                <Route path="/perfil" element={<Profile />} />
                <Route path="/mensagens" element={<Messages />} />
                <Route path="/rank" element={<Rank />} />
                <Route path="/reels" element={<Reels />} />
                <Route path="/instalar" element={<Install />} />

                {/* compatibility */}
                <Route
                  path="/criar"
                  element={<Navigate to="/postar" replace />}
                />

                <Route
                  path="/login"
                  element={
                    <Placeholder
                      title="Login / Cadastro"
                      subtitle="No MVP, vamos conectar autenticação (ex: Supabase) quando você quiser."
                    />
                  }
                />

                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

createRoot(document.getElementById("root")!).render(<App />);
