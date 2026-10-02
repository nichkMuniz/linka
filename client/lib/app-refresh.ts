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
 * meio-tempo) depois de `RESUME_REFRESH_AFTER_MS` fora.
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

/**
 * Ausência a partir da qual voltar ao app atualiza TUDO (2026-10-01: 5 min).
 * Vale para os dois jeitos de "voltar": o app suspenso que volta ao primeiro
 * plano (AppLayout) e o app que o iOS fechou em segundo plano e abre do zero
 * (`refreshIfLongAbsenceOnLaunch`).
 */
export const RESUME_REFRESH_AFTER_MS = 5 * 60_000;

// Instante em que o app foi para o segundo plano. No DISCO, não na memória: se o
// iOS matar o app suspenso (comum depois de um tempo fora), a próxima abertura
// é um cold start e só o disco sabe há quanto tempo a pessoa saiu.
const BACKGROUNDED_AT_KEY = "lk:backgroundedAt";

export function markAppBackgrounded() {
  try { localStorage.setItem(BACKGROUNDED_AT_KEY, String(Date.now())); } catch { /* storage indisponível */ }
}

export function clearAppBackgrounded() {
  try { localStorage.removeItem(BACKGROUNDED_AT_KEY); } catch { /* storage indisponível */ }
}

/**
 * Cold start: se o app saiu de cena há mais de `RESUME_REFRESH_AFTER_MS`,
 * derruba o cache volátil ANTES do primeiro render. Sem isto o `cached()`
 * serviria a cópia do disco (até 24h de idade) e revalidaria por trás — mas as
 * telas não releem sozinhas, então a pessoa via o dado velho até navegar.
 * Chamado uma vez em `App.tsx`, antes do `root.render`.
 */
export function refreshIfLongAbsenceOnLaunch() {
  let backgroundedAt = 0;
  try { backgroundedAt = Number(localStorage.getItem(BACKGROUNDED_AT_KEY) ?? 0); } catch { /* storage indisponível */ }
  clearAppBackgrounded();
  if (backgroundedAt > 0 && Date.now() - backgroundedAt >= RESUME_REFRESH_AFTER_MS) {
    invalidateVolatileQueryCache();
  }
}

// Marca/limpa também pelo `visibilitychange`, que dispara mesmo sem o AppLayout
// montado (tela de login, admin) e no navegador.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") markAppBackgrounded();
  });
  window.addEventListener("pagehide", markAppBackgrounded);
}

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

/**
 * Contador que sobe a cada refresh global que passa no `filter` (padrão: volta
 * do background). Para telas que carregam num `useEffect`: pôr o tick nas
 * dependências faz o efeito rodar de novo, sem extrair a carga para uma função.
 */
export function useAppRefreshTick(
  filter: (detail: AppRefreshDetail) => boolean = (d) => d.reason === "resume",
): number {
  const [tick, setTick] = React.useState(0);
  useAppRefresh((detail) => {
    if (filter(detail)) setTick((n) => n + 1);
  });
  return tick;
}
