import { cn } from "@/lib/utils";
import {
  Home,
  PlusSquare,
  Search,
  User,
  Dumbbell,
  MessagesSquare,
  Trophy,
  PlaySquare,
} from "lucide-react";
import * as React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const MESSAGES_PATH = "/mensagens";

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

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-background">
      {count > 9 ? "9+" : count}
    </span>
  );
}

function BrandMark({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-3 via-brand to-brand-2 shadow-sm ring-1 ring-brand/30",
        className,
      )}
    >
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-foreground/90">
        <Dumbbell className="h-5 w-5 text-white" />
      </div>
    </div>
  );
}

export function AppLayout() {
  const location = useLocation();

  // MVP: contador mockado. Depois isso pode vir do backend/Supabase.
  const unreadMessages = location.pathname.startsWith(MESSAGES_PATH) ? 0 : 2;

  const desktopNavItems = React.useMemo(
    () => navItems.filter((item) => item.to !== MESSAGES_PATH),
    [],
  );
  const messagesItem = React.useMemo(
    () => navItems.find((item) => item.to === MESSAGES_PATH),
    [],
  );

  const [headerHidden, setHeaderHidden] = React.useState(false);

  React.useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;

      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY;

        // evita ficar piscando quando está bem no topo
        const shouldHide = y > 96 && delta > 10;
        const shouldShow = delta < -10;

        if (shouldHide) setHeaderHidden(true);
        if (shouldShow) setHeaderHidden(false);

        lastY = y;
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-dvh bg-background">
      <header
        className={cn(
          "sticky top-0 z-50 border-b border-border/60 bg-background/75 backdrop-blur supports-[backdrop-filter]:bg-background/55 transition-transform duration-200",
          headerHidden
            ? "-translate-y-full pointer-events-none"
            : "translate-y-0",
        )}
      >
        <div className="relative mx-auto flex h-16 w-full max-w-6xl items-center justify-center gap-4 px-4 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:justify-stretch">
          <div className="flex items-center gap-3 lg:justify-start">
            <BrandMark />
            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <span className="bg-gradient-to-br from-brand-3 via-brand to-brand-2 bg-clip-text text-sm font-semibold tracking-tight text-transparent">
                  RitmoFit
                </span>
                <span className="rounded-full border border-border/60 bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  MVP
                </span>
              </div>
            </div>
          </div>

          <div className="absolute right-4 top-1/2 -translate-y-1/2 lg:hidden">
            <Button
              asChild
              variant={
                isActivePath(location.pathname, MESSAGES_PATH)
                  ? "secondary"
                  : "ghost"
              }
              className="h-11 w-11 rounded-full p-0"
            >
              <Link to={MESSAGES_PATH} aria-label="Mensagens">
                <span className="relative">
                  <MessagesSquare className="h-5 w-5" />
                  <UnreadBadge count={unreadMessages} />
                </span>
              </Link>
            </Button>
          </div>

          <nav className="hidden items-center justify-center gap-2 lg:flex">
            {desktopNavItems.map((item) => {
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
                    </span>
                  </Link>
                </Button>
              );
            })}
          </nav>

          <div className="hidden justify-end lg:flex">
            {messagesItem ? (
              <Button
                asChild
                variant={
                  isActivePath(location.pathname, messagesItem.to)
                    ? "secondary"
                    : "ghost"
                }
                className="h-11 w-11 rounded-full p-0"
              >
                <Link to={messagesItem.to} aria-label={messagesItem.label}>
                  <span className="relative">
                    <messagesItem.icon className="h-5 w-5" />
                    <UnreadBadge count={unreadMessages} />
                  </span>
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-6 lg:pb-10">
        <Outlet />
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/65 lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto grid w-full max-w-6xl grid-cols-5 px-2">
          {navItems.map((item) => {
            const active = isActivePath(location.pathname, item.to);
            const Icon = item.icon;

            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2 text-[11px] transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-2xl ring-1 transition",
                    active
                      ? "bg-brand text-white ring-brand/30"
                      : "bg-transparent ring-transparent",
                  )}
                >
                  <span className="relative">
                    <Icon className="h-5 w-5" />
                    {item.to === MESSAGES_PATH ? (
                      <UnreadBadge count={unreadMessages} />
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
