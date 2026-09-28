import * as React from "react";

/**
 * "Segure para ver só o conteúdo": com o dedo parado sobre a mídia por
 * `delayMs`, a interface por cima (cabeçalho, ações, legenda) some; ao soltar,
 * volta. Mesmo gesto do FlowViewer (`handleTapZonePointer*`), extraído para os
 * cards de post.
 *
 * Regras do gesto:
 *  - mover mais de 10px antes do tempo cancela (é swipe do carrossel ou
 *    rolagem do feed, não "segurar");
 *  - um segundo dedo cancela (é pinça — o zoom já esconde a interface sozinho);
 *  - começar em cima de um controle (botão, link, campo) não conta;
 *  - `pointercancel` (o iOS manda quando a rolagem assume o toque) restaura.
 *
 * `consumeHoldClick()` deve ser chamado no `onClick` da área: o toque que
 * encerra um "segurar" não pode virar o toque simples (abrir o post).
 */
export function useHoldToHide(delayMs = 250) {
  const [hidden, setHidden] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = React.useRef<{ x: number; y: number } | null>(null);
  const firedRef = React.useRef(false);
  const pointersRef = React.useRef(0);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  React.useEffect(() => clearTimer, []);

  const onPointerDown = React.useCallback((e: React.PointerEvent) => {
    pointersRef.current += 1;
    if (pointersRef.current > 1) {
      // Segundo dedo = pinça. Não esconde por "segurar".
      clearTimer();
      startRef.current = null;
      return;
    }
    const target = e.target as HTMLElement | null;
    if (target?.closest("button, a, input, textarea, [role='button'], [data-no-hold]")) return;
    firedRef.current = false;
    startRef.current = { x: e.clientX, y: e.clientY };
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      firedRef.current = true;
      setHidden(true);
    }, delayMs);
  }, [delayMs]);

  const onPointerMove = React.useCallback((e: React.PointerEvent) => {
    if (!startRef.current || !timerRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 10) {
      clearTimer();
      startRef.current = null;
    }
  }, []);

  const release = React.useCallback((cancelled: boolean) => {
    pointersRef.current = Math.max(0, pointersRef.current - 1);
    clearTimer();
    startRef.current = null;
    setHidden(false);
    // Cancelado pelo sistema não gera `click` depois — nada a consumir.
    if (cancelled) firedRef.current = false;
  }, []);

  const onPointerUp = React.useCallback(() => release(false), [release]);
  const onPointerCancel = React.useCallback(() => release(true), [release]);

  /** true (e zera) se o clique atual é o fim de um "segurar". */
  const consumeHoldClick = React.useCallback(() => {
    if (!firedRef.current) return false;
    firedRef.current = false;
    return true;
  }, []);

  return {
    hidden,
    consumeHoldClick,
    holdHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      // Segurar sobre a foto no iOS abriria o menu "Salvar imagem".
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    },
  };
}
