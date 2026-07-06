import * as React from "react";
import { useNavigate } from "react-router-dom";

import { hapticLight } from "@/lib/haptics";

/**
 * Gesto estilo iOS: arrastar da borda esquerda para a direita volta para a
 * tela anterior que o usuário visitou (history back nativo do React Router).
 *
 * Por que "history back" atende ao pedido: toda navegação entre telas usa
 * `<Link>` (bottom nav / header), que **empilha** o histórico. Então voltar
 * uma entrada (`navigate(-1)`) equivale sempre à última tela visitada —
 * Feed → Perfil → swipe = Feed; Metas → Comunidade → swipe = Metas.
 *
 * Por que **edge**-swipe (só a partir da borda esquerda) e não swipe em
 * qualquer lugar: telas do app têm carrosséis horizontais no meio da tela
 * (PostCarousel, FlowViewer, InlineCropPreview). Restringir o início do gesto
 * à faixa da borda evita "sequestrar" esses swipes internos.
 *
 * Passa `ref` do elemento que deve deslizar (o <main> com o conteúdo da rota)
 * e `enabled` para desligar em telas onde o gesto não faz sentido (ex: editor
 * de novo post, onde voltar perderia o rascunho).
 */

const EDGE_ZONE = 30; // px a partir da borda esquerda onde o gesto pode iniciar
const DIRECTION_LOCK = 10; // px de movimento até travar direção (horizontal x vertical)
const TRIGGER_RATIO = 0.32; // fração da largura da tela para confirmar o voltar
const TRIGGER_MIN = 70; // distância mínima em px (telas estreitas)
const FLICK_VELOCITY = 0.5; // px/ms — um flick rápido confirma mesmo com pouca distância

export function useEdgeSwipeBack(
  ref: React.RefObject<HTMLElement>,
  enabled: boolean,
) {
  const navigate = useNavigate();

  React.useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    let startX = 0;
    let startY = 0;
    let startT = 0;
    let lastX = 0;
    let lastT = 0;
    let tracking = false; // toque começou na borda e ainda é candidato
    let dragging = false; // direção travada como horizontal → arrastando a página

    // React Router guarda um índice incremental no history.state. idx === 0
    // significa que não há tela anterior dentro do app — não voltar (evita
    // sair do app / sair da SPA no iOS).
    const canGoBack = () =>
      ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;

    // Não disparar se há um dialog/drawer aberto por cima (eles não empilham
    // histórico; voltar navegaria a tela de baixo de forma inesperada).
    const overlayOpen = () =>
      !!document.querySelector('[role="dialog"],[role="alertdialog"],[vaul-drawer]');

    const settleTo = (value: string, animate: boolean) => {
      el.style.transition = animate
        ? "transform 0.22s cubic-bezier(0.22,0.61,0.36,1)"
        : "none";
      el.style.transform = value;
      if (!animate) {
        el.style.transition = "";
        return;
      }
      const done = () => {
        el.style.transition = "";
        el.removeEventListener("transitionend", done);
      };
      el.addEventListener("transitionend", done);
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX > EDGE_ZONE) return;
      if (!canGoBack() || overlayOpen()) return;
      startX = lastX = t.clientX;
      startY = t.clientY;
      startT = lastT = Date.now();
      tracking = true;
      dragging = false;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      if (!dragging) {
        if (Math.abs(dx) < DIRECTION_LOCK && Math.abs(dy) < DIRECTION_LOCK) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          // Movimento predominante vertical → é scroll, desiste do gesto.
          tracking = false;
          return;
        }
        dragging = true;
        el.style.transition = "none";
      }

      lastX = t.clientX;
      lastT = Date.now();
      const drag = Math.max(0, dx);
      el.style.transform = `translateX(${drag}px)`;
      // Bloqueia o scroll horizontal nativo enquanto arrasta a página.
      e.preventDefault();
    };

    const onEnd = () => {
      if (!tracking) return;
      const wasDragging = dragging;
      tracking = false;
      dragging = false;
      if (!wasDragging) return;

      const dx = Math.max(0, lastX - startX);
      const dt = Math.max(1, lastT - startT);
      const velocity = dx / dt;
      const threshold = Math.max(TRIGGER_MIN, window.innerWidth * TRIGGER_RATIO);

      if (dx >= threshold || velocity >= FLICK_VELOCITY) {
        hapticLight();
        navigate(-1);
        // O <main> é estável entre as rotas, então ainda está deslocado em
        // `dx`px quando a tela anterior monta no lugar. Anima esse deslocamento
        // de volta a 0 → a tela anterior "entra" deslizando da esquerda.
        requestAnimationFrame(() => settleTo("", true));
      } else {
        // Não atingiu o limiar → volta a página ao lugar.
        settleTo("", true);
      }
    };

    const onCancel = () => {
      if (!tracking) return;
      const wasDragging = dragging;
      tracking = false;
      dragging = false;
      if (wasDragging) settleTo("", true);
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onCancel, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
      el.style.transform = "";
      el.style.transition = "";
    };
  }, [ref, enabled, navigate]);
}
