import * as React from "react";
import { Trash2 } from "lucide-react";

const REVEAL_WIDTH = 76; // largura da área vermelha revelada (px)
const OPEN_THRESHOLD = REVEAL_WIDTH / 2; // arrasto mínimo para "abrir"
const DIRECTION_LOCK = 8; // px antes de decidir se o gesto é horizontal ou vertical

interface SwipeableConversationRowProps {
  /** Conteúdo da linha (avatar, nome, preview, badge…). */
  children: React.ReactNode;
  /** Disparado ao tocar no botão de lixeira revelado. */
  onDelete: () => void;
  /** Label acessível do botão de excluir. */
  deleteLabel: string;
}

/**
 * Linha de conversa com gesto de swipe da direita para a esquerda que revela
 * um botão de excluir com fundo vermelho — padrão iOS (Mail/Mensagens).
 * Substitui o antigo botão de lixeira baseado em hover (que não funciona no toque).
 */
export function SwipeableConversationRow({
  children,
  onDelete,
  deleteLabel,
}: SwipeableConversationRowProps) {
  const [translateX, setTranslateX] = React.useState(0);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);

  const startXRef = React.useRef(0);
  const startYRef = React.useRef(0);
  const baseRef = React.useRef(0);
  const directionRef = React.useRef<"none" | "horizontal" | "vertical">("none");

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    baseRef.current = isOpen ? -REVEAL_WIDTH : 0;
    directionRef.current = "none";
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const dx = touch.clientX - startXRef.current;
    const dy = touch.clientY - startYRef.current;

    // Decide a direção do gesto uma única vez
    if (directionRef.current === "none") {
      if (Math.abs(dx) > DIRECTION_LOCK || Math.abs(dy) > DIRECTION_LOCK) {
        directionRef.current =
          Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      }
    }

    // Gesto vertical → deixa a lista rolar normalmente
    if (directionRef.current !== "horizontal") return;

    let next = baseRef.current + dx;
    // Limita: fechado em 0, aberto no máximo em -REVEAL_WIDTH
    if (next > 0) next = 0;
    if (next < -REVEAL_WIDTH) next = -REVEAL_WIDTH - (next + REVEAL_WIDTH) * 0.15; // leve resistência
    setTranslateX(next);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (directionRef.current === "horizontal") {
      const shouldOpen = translateX <= -OPEN_THRESHOLD;
      setIsOpen(shouldOpen);
      setTranslateX(shouldOpen ? -REVEAL_WIDTH : 0);
    }
    directionRef.current = "none";
  };

  const close = () => {
    setIsOpen(false);
    setTranslateX(0);
  };

  // Quando aberto, um toque na linha fecha o swipe em vez de acionar a conversa
  const handleClickCapture = (e: React.MouseEvent) => {
    if (isOpen) {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };

  return (
    <div className="relative overflow-hidden rounded-[20px]">
      {/* Fundo vermelho com lixeira — revelado ao arrastar */}
      <button
        type="button"
        onClick={() => {
          close();
          onDelete();
        }}
        aria-label={deleteLabel}
        className="absolute inset-y-0 right-0 flex items-center justify-center text-white active:bg-red-600 transition-colors"
        style={{ width: REVEAL_WIDTH, background: "#ef4444" }}
        tabIndex={isOpen ? 0 : -1}
      >
        <Trash2 className="h-5 w-5" />
      </button>

      {/* Conteúdo deslizável */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onClickCapture={handleClickCapture}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? "none" : "transform 0.25s cubic-bezier(0.22,0.61,0.36,1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
