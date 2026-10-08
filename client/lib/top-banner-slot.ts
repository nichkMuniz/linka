/**
 * Vez no topo da tela (2026-10-06).
 *
 * Dois banners moram no mesmo lugar (topo, safe area, `z-[9999]`): o aviso de
 * mensagem/notificação (`IncomingMessageToast`) e o pop up de conquista
 * (`BadgeCelebrationBanner`). Sem coordenação o último a renderizar cobria o
 * outro — ex.: "Fulano começou a seguir você" escondia a insígnia que chegava
 * junto.
 *
 * Regra: o aviso do sistema tem prioridade. Enquanto ele está na tela a
 * insígnia espera; se ele chega com a insígnia aberta, ela sai e volta depois.
 * Quem tem prioridade só PUBLICA quando está visível; quem espera assina.
 */

/** Folga depois que o aviso some — a animação de saída dele termina antes de a insígnia entrar. */
export const TOP_BANNER_HANDOFF_MS = 450;

let systemBannerVisible = false;
const listeners = new Set<(visible: boolean) => void>();

export function setSystemBannerVisible(visible: boolean): void {
  if (systemBannerVisible === visible) return;
  systemBannerVisible = visible;
  listeners.forEach((listener) => listener(visible));
}

export function isSystemBannerVisible(): boolean {
  return systemBannerVisible;
}

export function subscribeSystemBannerVisibility(listener: (visible: boolean) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
