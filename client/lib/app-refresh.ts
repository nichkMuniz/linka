import * as React from "react";
import { invalidateVolatileQueryCache } from "@/lib/ritmofit-db";

/**
 * Refresh GLOBAL do app.
 *
 * Antes cada tela atualizava só a si mesma: o pull-to-refresh do feed recarregava
 * os posts, mas o header/footer seguiam com os contadores em cache, e o perfil
 * aberto em seguida servia o que já tinha em memória/disco. A pessoa atualizava
 * e metade do app continuava velha.
 *
 * Agora todo gatilho de atualização passa por aqui:
 *  1. derruba o cache de tudo que pode ter mudado (preserva só catálogos
 *     estáticos — ver `invalidateVolatileQueryCache`), então QUALQUER tela
 *     aberta depois lê do banco;
 *  2. avisa as partes montadas (header/footer, feed, perfil, notificações,
 *     comunidade) via `APP_REFRESH_EVENT`, para relerem na hora.
 *
 * Gatilhos: pull-to-refresh de qualquer tela, toque no logo/home e volta do
 * background (o iOS suspende o WebView e o realtime perde o que chegou nesse
 * meio-tempo).
 */
export const APP_REFRESH_EVENT = "lk:app-refresh";

export type AppRefreshReason = "pull" | "home" | "resume";

export type AppRefreshDetail = {
  reason: AppRefreshReason;
  /**
   * Tela que pediu o refresh (ex.: "profile" no pull-to-refresh do perfil). Ela
   * já recarrega por conta própria, então ignora o próprio evento — senão
   * buscaria tudo duas vezes.
   */
  source?: string;
};

// Dois gatilhos quase juntos (ex.: pull logo depois de voltar do background)
// viram um só — a segunda rodada releria exatamente o mesmo dado.
const COALESCE_MS = 1_500;
let lastRefreshAt = 0;

export function requestAppRefresh(reason: AppRefreshReason, source?: string) {
  const now = Date.now();
  if (now - lastRefreshAt < COALESCE_MS) return;
  lastRefreshAt = now;
  invalidateVolatileQueryCache();
  window.dispatchEvent(
    new CustomEvent<AppRefreshDetail>(APP_REFRESH_EVENT, { detail: { reason, source } }),
  );
}

/**
 * Escuta o refresh global enquanto o componente está montado. O handler é
 * lido de uma ref, então pode ser uma função nova a cada render.
 */
export function useAppRefresh(handler: (detail: AppRefreshDetail) => void) {
  const handlerRef = React.useRef(handler);
  handlerRef.current = handler;
  React.useEffect(() => {
    const listener = (e: Event) => {
      const detail = (e as CustomEvent<AppRefreshDetail>).detail ?? { reason: "pull" };
      handlerRef.current(detail);
    };
    window.addEventListener(APP_REFRESH_EVENT, listener);
    return () => window.removeEventListener(APP_REFRESH_EVENT, listener);
  }, []);
}
