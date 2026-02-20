import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  PlusSquare,
  Dumbbell,
  Search,
  MessageCircle,
  Bell,
  Video,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageWithFallback } from "@/components/image-with-fallback";
import { getUnreadMessageCountDb, getUserProfileDb } from "@/lib/ritmofit-db";
import { useAuth } from "@/hooks/useAuth";
import { useLayoutMode } from "@/hooks/useLayoutMode";
import { cn } from "@/lib/utils";
import Reels from "@/pages/Reels";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/reels", label: "Clips", icon: Video },
  { to: "/postar", label: "Nova", icon: PlusSquare },
  { to: "/metas", label: "Metas", icon: Dumbbell },
  { to: "/loja", label: "Loja", icon: ShoppingBag },
];

function isActivePath(currentPath: string, to: string) {
  if (to === "/") return currentPath === "/";
  return currentPath === to || currentPath.startsWith(`${to}/`);
}

export function ReelsLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const { layoutMode } = useLayoutMode();
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [profilePhoto, setProfilePhoto] = React.useState<string | null>(null);
  const footerRef = React.useRef<HTMLDivElement>(null);
  const [footerHeight, setFooterHeight] = React.useState(0);

  React.useEffect(() => {
    const loadUnreadCount = async () => {
      try {
        const count = await getUnreadMessageCountDb();
        setUnreadCount(count);
      } catch (err) {
        console.error("Error loading unread message count:", err);
      }
    };

    loadUnreadCount();

    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    const loadProfilePhoto = async () => {
      if (!user) return;
      try {
        const profile = await getUserProfileDb(user.id);
        if (profile?.photo) {
          setProfilePhoto(profile.photo);
        }
      } catch (err) {
        console.error("Error loading profile photo:", err);
      }
    };

    loadProfilePhoto();
  }, [user]);

  // Calcular altura do footer para passar ao Reels
  React.useEffect(() => {
    if (footerRef.current) {
      setFooterHeight(footerRef.current.offsetHeight);
    }
  }, []);

  return (
    <div
      className="w-screen h-screen bg-black flex flex-col overflow-hidden"
      style={{
        width: "100vw",
        height: "100vh",
        maxWidth: "100%",
      }}
    >
      {/* Reels - Fullscreen, respeitando footer */}
      <main
        className="flex-1 w-full overflow-hidden relative"
        style={{
          width: "100vw",
          maxWidth: "100%",
        }}
      >
        <Reels footerHeight={footerHeight} />
      </main>

      {/* Footer Navigation - Fixed at Bottom (only show in default layout) */}
      {layoutMode === "default" && (
        <nav
          ref={footerRef}
          className="fixed bottom-[env(safe-area-inset-bottom)] left-0 right-0 z-40 border-t border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/65 lg:hidden"
          style={{
            width: "100vw",
            maxWidth: "100%",
          }}
        >
          <div className="mx-auto grid w-full max-w-6xl grid-cols-5 px-1">
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
                      "grid h-11 w-11 place-items-center rounded-2xl ring-1 transition",
                      active
                        ? "bg-brand text-white ring-brand/30"
                        : "bg-transparent ring-transparent",
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="hidden md:block">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
