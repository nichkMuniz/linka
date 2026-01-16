import { cn } from "@/lib/utils";
import {
  Home,
  PlusSquare,
  Search,
  User,
  Sparkles,
  MessagesSquare,
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
  { to: "/", label: "Home", icon: Home },
  { to: "/postar", label: "Nova", icon: PlusSquare },
  { to: "/buscar", label: "Buscar", icon: Search },
  { to: "/mensagens", label: "Msgs", icon: MessagesSquare },
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
        "grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-3 via-brand to-brand-2 shadow-sm ring-1 ring-brand/20",
        className,
      )}
    >
      <Sparkles className="h-5 w-5 text-white" />
    </div>
  );
}

export function AppLayout() {
  const location = useLocation();

  // MVP: contador mockado. Depois isso pode vir do backend/Supabase.
  const unreadMessages = location.pathname.startsWith("/mensagens") ? 0 : 2;

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/75 backdrop-blur supports-[backdrop-filter]:bg-background/55">
        <div className="mx-auto grid h-16 w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4">
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

          <nav className="hidden items-center justify-center gap-2 md:flex">
            {navItems.map((item) => {
              const active = isActivePath(location.pathname, item.to);
              const Icon = item.icon;

              return (
                <Button
                  key={item.to}
                  asChild
                  variant={active ? "secondary" : "ghost"}
                  className="h-11 w-11 rounded-full p-0"
                >
                  <Link to={item.to} aria-label={item.label}>
                    <span className="relative">
                      <Icon className="h-5 w-5" />
                      {item.to === "/mensagens" && unreadMessages > 0 ? (
                        <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-background">
                          {unreadMessages > 9 ? "9+" : unreadMessages}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </Button>
              );
            })}
          </nav>

          <div className="hidden justify-end md:flex">
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/login">Entrar</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 md:pb-10">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/65 md:hidden">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-5 px-2">
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
                      ? "bg-brand text-white ring-brand/30"
                      : "bg-transparent ring-transparent",
                  )}
                >
                  <span className="relative">
                    <Icon className="h-5 w-5" />
                    {item.to === "/mensagens" && unreadMessages > 0 ? (
                      <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-background">
                        {unreadMessages > 9 ? "9+" : unreadMessages}
                      </span>
                    ) : null}
                  </span>
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
