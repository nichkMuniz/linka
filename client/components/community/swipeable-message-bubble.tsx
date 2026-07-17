import * as React from "react";
import { Reply } from "lucide-react";
import { hapticLight } from "@/lib/haptics";

const REPLY_TRIGGER = 52; // arrasto (px) para disparar o reply ao soltar
const MAX_DRAG = 76; // limite visual do arrasto
const DIRECTION_LOCK = 8; // px antes de decidir se o gesto é horizontal ou vertical
const LONG_PRESS_MS = 450; // mesmo tempo do overlay de ações

interface SwipeableMessageBubbleProps {
  /** Bolha da mensagem (+ badge de emoji). Arrasta em bloco. */
  children: React.ReactNode;
  /** Disparado ao soltar depois de arrastar além do gatilho. */
  onReply: () => void;
  /** Disparado no long-press (toque parado) ou clique com botão direito. */
  onLongPress: () => void;
}

/**
 * Bolha de mensagem com gesto de arrastar para a direita para responder —
 * padrão WhatsApp. Um ícone de reply surge no vão que se abre à esquerda da
 * bolha conforme o arrasto avança; ao passar do gatilho e soltar, dispara
 * `onReply` (seleciona ESTA mensagem como contexto de resposta).
 *
 * Convive com o long-press: um toque parado ainda abre o overlay de ações
 * (`onLongPress`); qualquer movimento cancela o timer do long-press. O gesto é
 * só para a direita — arrastar para a esquerda não faz nada.
 */
export function SwipeableMessageBubble({
  children,
  onReply,
  onLongPress,
}: SwipeableMessageBubbleProps) {
  const [translateX, setTranslateX] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);

  const startXRef = React.useRef(0);
  const startYRef = React.useRef(0);
  const directionRef = React.useRef<"none" | "horizontal" | "vertical">("none");
  const longPressRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Vibra uma vez ao cruzar o gatilho, e evita disparar o reply duas vezes.
  const passedTriggerRef = React.useRef(false);

  const clearLongPress = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    directionRef.current = "none";
    passedTriggerRef.current = false;
    setDragging(true);
    clearLongPress();
    longPressRef.current = setTimeout(onLongPress, LONG_PRESS_MS);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const dx = touch.clientX - startXRef.current;
    const dy = touch.clientY - startYRef.current;

    // Decide a direção do gesto uma única vez.
    if (directionRef.current === "none") {
      if (Math.abs(dx) > DIRECTION_LOCK || Math.abs(dy) > DIRECTION_LOCK) {
        directionRef.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
        clearLongPress(); // qualquer arrasto cancela o long-press
      }
    }

    // Gesto vertical → deixa a lista rolar normalmente.
    if (directionRef.current !== "horizontal") return;

    // Só reply: arrasto para a direita; à esquerda fica travado em 0.
    let next = dx;
    if (next < 0) next = 0;
    if (next > MAX_DRAG) next = MAX_DRAG;
    setTranslateX(next);

    const passed = next >= REPLY_TRIGGER;
    if (passed && !passedTriggerRef.current) {
      passedTriggerRef.current = true;
      void hapticLight();
    } else if (!passed && passedTriggerRef.current) {
      // Voltou aquém do gatilho — rearma para poder vibrar de novo.
      passedTriggerRef.current = false;
    }
  };

  const handleTouchEnd = () => {
    clearLongPress();
    setDragging(false);
    const shouldReply = directionRef.current === "horizontal" && translateX >= REPLY_TRIGGER;
    setTranslateX(0);
    directionRef.current = "none";
    if (shouldReply) onReply();
  };

  const progress = Math.min(1, translateX / REPLY_TRIGGER);

  return (
    <div className="relative">
      {/* Ícone de reply revelado no vão que se abre à esquerda da bolha. */}
      <div
        className="absolute flex items-center justify-center rounded-full pointer-events-none"
        style={{
          left: 6,
          top: "50%",
          width: 30,
          height: 30,
          background: "rgba(255,255,255,.14)",
          opacity: progress,
          transform: `translateY(-50%) scale(${0.5 + 0.5 * progress})`,
        }}
      >
        <Reply className="h-4 w-4 text-white" />
      </div>

      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: dragging ? "none" : "transform 0.2s cubic-bezier(0.22,0.61,0.36,1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
