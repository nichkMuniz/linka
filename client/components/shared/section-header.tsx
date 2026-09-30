import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/lib/haptics";

interface SectionHeaderProps {
  title: string;
  /** Ação curta à direita do título (ex.: "+ Nova meta"). */
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  className?: string;
}

/**
 * Título de seção padrão do app (docs/15-design-system.md §2.5): 20px bold,
 * branco, com uma ação opcional em texto azul à direita. Substitui os estilos
 * soltos que cada seção inventava (rótulo em maiúsculas, 18px/740, título +
 * etiqueta "opcional"…) — uma tela com três seções agora tem três títulos
 * iguais.
 */
export function SectionHeader({ title, action, className }: SectionHeaderProps) {
  const Icon = action?.icon;
  return (
    <div className={cn("flex items-center justify-between gap-3 px-1", className)}>
      <h2 className="min-w-0 truncate text-[20px] font-bold leading-tight tracking-[-0.01em] text-white">
        {title}
      </h2>
      {action && (
        <button
          type="button"
          onClick={() => {
            hapticLight();
            action.onClick();
          }}
          className="-mr-1 inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-1 text-sm font-semibold text-primary active:opacity-60 transition-opacity"
        >
          {Icon && <Icon className="h-4 w-4" strokeWidth={2.4} />}
          {action.label}
        </button>
      )}
    </div>
  );
}
