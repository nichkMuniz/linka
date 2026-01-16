import "./global.css";

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
import NotFound from "@/pages/NotFound";
import Placeholder from "@/pages/Placeholder";

const queryClient = new QueryClient();

const App = () => (
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

createRoot(document.getElementById("root")!).render(<App />);
