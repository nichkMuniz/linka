import { AnimatePresence, motion } from "framer-motion";
import { useRef } from "react";
import { useLocation } from "react-router-dom";

// Order mirrors bottom nav + sidebar order — used to determine slide direction
const NAV_ORDER = ["/", "/shots", "/postar", "/metas", "/vitrine", "/buscar", "/notificacoes", "/comunidade", "/perfil"];

function getRouteIndex(path: string) {
  return NAV_ORDER.findIndex((r) =>
    r === "/" ? path === "/" : path === r || path.startsWith(r + "/")
  );
}

const variants = {
  initial: (dir: number) => ({
    opacity: 0,
    x: dir * 16,
  }),
  animate: {
    opacity: 1,
    x: 0,
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: -dir * 10,
  }),
};

export function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  const directionRef = useRef(1);

  const currentIdx = getRouteIndex(location.pathname);
  const prevIdx = getRouteIndex(prevPathRef.current);

  if (location.pathname !== prevPathRef.current) {
    if (currentIdx !== -1 && prevIdx !== -1) {
      directionRef.current = currentIdx >= prevIdx ? 1 : -1;
    }
    prevPathRef.current = location.pathname;
  }

  return (
    <AnimatePresence mode="popLayout" initial={false} custom={directionRef.current}>
      <motion.div
        key={location.pathname}
        custom={directionRef.current}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ type: "spring", stiffness: 380, damping: 32, mass: 0.8 }}
        style={{ willChange: "opacity, transform" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
