import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  PlusSquare,
  Dumbbell,
  Video,
  ShoppingBag,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

export function FloatingActionMenu() {
  const location = useLocation();
  const [isOpen, setIsOpen] = React.useState(false);

  const handleClose = () => setIsOpen(false);

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <button
          onClick={handleClose}
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          aria-label="Close menu"
        />
      )}

      {/* Floating Action Menu */}
      <div className="fixed bottom-6 right-6 z-50 lg:hidden">
        {/* Expanded Menu Items */}
        {isOpen && (
          <div className="absolute bottom-20 right-0 flex flex-col gap-3 mb-2">
            {navItems.map((item) => {
              const active = isActivePath(location.pathname, item.to);
              const Icon = item.icon;

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={handleClose}
                  className="block"
                >
                  <button
                    className={cn(
                      "flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-200 text-xs font-medium whitespace-nowrap",
                      active
                        ? "bg-brand text-white shadow-lg"
                        : "bg-muted text-foreground shadow-md hover:bg-muted/80",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </button>
                </Link>
              );
            })}
          </div>
        )}

        {/* Main FAB Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "relative h-16 w-16 rounded-full shadow-lg transition-all duration-200 flex items-center justify-center",
            isOpen
              ? "bg-destructive text-white hover:bg-destructive/90"
              : "bg-brand text-white hover:bg-brand/90",
          )}
          aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
        >
          {isOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <span className="text-2xl">≡</span>
          )}
        </button>
      </div>
    </>
  );
}
