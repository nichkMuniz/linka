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
import { useLayoutMode, getDefaultFABPosition } from "@/hooks/useLayoutMode";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/shots", label: "Shots", icon: Video },
  { to: "/postar", label: "Nova", icon: PlusSquare },
  { to: "/metas", label: "Metas", icon: Dumbbell },
  { to: "/vitrine", label: "Vitrine", icon: ShoppingBag },
];

function isActivePath(currentPath: string, to: string) {
  if (to === "/") return currentPath === "/";
  return currentPath === to || currentPath.startsWith(`${to}/`);
}

export function FloatingActionMenu() {
  const location = useLocation();
  const { fabPosition, setFabPosition } = useLayoutMode();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Initialize FAB position to bottom-right on mount if not set
  React.useEffect(() => {
    if (fabPosition.x === -1 || fabPosition.y === -1) {
      const defaultPos = getDefaultFABPosition();
      setFabPosition(defaultPos);
    }
  }, []);

  const handleClose = () => setIsOpen(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isOpen) return; // Don't drag while menu is open
    setIsDragging(true);
    setDragStart({
      x: e.clientX - fabPosition.x,
      y: e.clientY - fabPosition.y,
    });
  };

  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      let newX = e.clientX - dragStart.x;
      let newY = e.clientY - dragStart.y;

      // Keep button within viewport
      const buttonWidth = 64;
      const buttonHeight = 64;
      const padding = 16;

      newX = Math.max(padding, Math.min(newX, window.innerWidth - buttonWidth - padding));
      newY = Math.max(padding, Math.min(newY, window.innerHeight - buttonHeight - padding));

      setFabPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStart, setFabPosition]);

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
      <div
        ref={containerRef}
        className="fixed z-50 lg:hidden"
        style={{
          left: `${fabPosition.x}px`,
          top: `${fabPosition.y}px`,
          transition: isDragging ? "none" : "all 0.2s ease-out",
        }}
      >
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
          onMouseDown={handleMouseDown}
          onClick={() => !isDragging && setIsOpen(!isOpen)}
          className={cn(
            "relative h-16 w-16 rounded-full shadow-lg transition-all duration-200 flex items-center justify-center cursor-grab active:cursor-grabbing",
            isDragging && "cursor-grabbing",
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
