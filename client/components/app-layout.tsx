import { cn } from "@/lib/utils";
import {
  Home,
  Plus,
  User,
  LogIn,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import * as React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { to: "/", label: "Feed", icon: Home },
  { to: "/criar", label: "Criar", icon: Plus },
  { to: "/perfil", label: "Perfil", icon: User },
];

function isActivePath(currentPath: string, to: string) {
  if (to === "/") return currentPath === "/";
  return currentPath === to || currentPath.startsWith(`${to}/`);
}

function BrandMark({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-500 shadow-sm ring-1 ring-emerald-500/20",
        className,
      )}
    >
      <Sparkles className="h-5 w-5 text-white" />
    </div>
  );
}

export function AppLayout() {
  const location = useLocation();

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/75 backdrop-blur supports-[backdrop-filter]:bg-background/55">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-tight">
                  RitmoFit
                </span>
                <span className="rounded-full border border-border/60 bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  MVP
                </span>
              </div>
              <div className="text-[12px] text-muted-foreground">
                Disciplina &middot; rotina &middot; constância
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <Button asChild variant="ghost" className="gap-2">
              <Link to="/perfil">
                <ShieldCheck className="h-4 w-4" />
                Meu progresso
              </Link>
            </Button>
            <Button asChild className="gap-2 rounded-full">
              <Link to="/criar">
                <Plus className="h-4 w-4" />
                Nova meta
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2 rounded-full">
              <Link to="/login">
                <LogIn className="h-4 w-4" />
                Entrar
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 md:pb-10">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/65 md:hidden">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-3 px-2">
          {navItems.map((item) => {
            const active = isActivePath(location.pathname, item.to);
            const Icon = item.icon;

            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-3 text-xs transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid h-10 w-10 place-items-center rounded-2xl ring-1 transition",
                    active
                      ? "bg-emerald-500 text-white ring-emerald-500/30"
                      : "bg-transparent ring-transparent",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
