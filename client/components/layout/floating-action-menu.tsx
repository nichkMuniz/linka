import React from "react";
import { Link, useLocation } from "react-router-dom";
import { hapticLight, hapticMedium } from "@/lib/haptics";
import {
  Home,
  PlusSquare,
  Dumbbell,
  Video,
  ShoppingBag,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
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

      // Keep button within viewport respecting safe areas
      const buttonWidth = 64;
      const buttonHeight = 64;
      const padding = 16;
      const sabRaw = getComputedStyle(document.documentElement).getPropertyValue("--sab").trim();
      const safeAreaBottom = parseFloat(sabRaw) || 0;

      newX = Math.max(padding, Math.min(newX, window.innerWidth - buttonWidth - padding));
      newY = Math.max(padding, Math.min(newY, window.innerHeight - buttonHeight - padding - safeAreaBottom));

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
        <AnimatePresence>
          {isOpen && (
            <div className="absolute bottom-20 right-0 flex flex-col gap-3 mb-2">
              {navItems.map((item, i) => {
                const active = isActivePath(location.pathname, item.to);
                const Icon = item.icon;
                const reverseIndex = navItems.length - 1 - i;

                return (
                  <motion.div
                    key={item.to}
                    initial={{ opacity: 0, y: 12, scale: 0.88 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.9 }}
                    transition={{
                      type: "spring",
                      stiffness: 420,
                      damping: 26,
                      delay: reverseIndex * 0.045,
                    }}
                  >
                    <Link to={item.to} onClick={() => { hapticLight(); handleClose(); }} className="block">
                      <button
                        className={cn(
                          "flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-200 text-xs font-medium whitespace-nowrap active:scale-95",
                          active
                            ? "bg-brand text-white shadow-lg"
                            : "bg-muted text-foreground shadow-md hover:bg-muted/80",
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span>{item.label}</span>
                      </button>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>

        {/* Main FAB Button */}
        <motion.button
          onMouseDown={handleMouseDown}
          onClick={() => { if (!isDragging) { hapticMedium(); setIsOpen(!isOpen); } }}
          whileTap={{ scale: 0.9 }}
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
          className={cn(
            "relative h-16 w-16 rounded-full shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing transition-colors duration-200",
            isDragging && "cursor-grabbing",
            isOpen
              ? "bg-destructive text-white hover:bg-destructive/90"
              : "bg-brand text-white hover:bg-brand/90",
          )}
          aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
        >
          <AnimatePresence mode="wait" initial={false}>
            {isOpen ? (
              <motion.span
                key="close"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.12 }}
              >
                <X className="h-6 w-6" />
              </motion.span>
            ) : (
              <motion.span
                key="menu"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.12 }}
                className="text-2xl leading-none"
              >
                ≡
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </>
  );
}
