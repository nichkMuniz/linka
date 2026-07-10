import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";

/**
 * Tracker global do teclado iOS — funciona em conjunto com
 * `Keyboard: { resize: 'none' }` (capacitor.config.ts).
 *
 * Com resize 'none' o frame do WKWebView NUNCA muda quando o teclado abre —
 * o teclado apenas sobrepõe o webview. Isso elimina o relayout/repaint da
 * página inteira (a "piscada" + delay que o modo 'native' causava, já que o
 * resize do frame acontecia DEPOIS da animação do teclado).
 *
 * Em troca, é o JS/CSS que precisa erguer a UI acima do teclado. Este módulo
 * é a fonte única dessa informação:
 *
 * - Escuta `keyboardWillShow` / `keyboardWillHide` (disparam no INÍCIO da
 *   animação do teclado, já com `keyboardHeight`).
 * - Publica a altura na CSS var `--keyboard-height` (em <html>) e alterna a
 *   classe `kb-open`. Drawers (drawer.tsx) e dialogs (dialog.tsx) usam a var
 *   para se erguer em sincronia com o teclado, via transform/padding com
 *   transition — GPU, sem reflow global.
 * - Notifica subscribers JS (`useKeyboardAwareHeight`) para caps de altura.
 * - Rola a página para revelar inputs em fluxo normal (fora de
 *   drawers/dialogs), ex.: Login, NewPost, Search.
 *
 * Singleton de app: inicializado uma vez em App.tsx e nunca removido.
 */

type KeyboardListener = (height: number) => void;

let currentHeight = 0;
let initialized = false;
const listeners = new Set<KeyboardListener>();

/** Altura atual do teclado em px (0 = fechado). */
export function getKeyboardHeight(): number {
  return currentHeight;
}

/** Assina mudanças de altura do teclado. Retorna função de unsubscribe. */
export function subscribeKeyboardHeight(listener: KeyboardListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function publish(rawHeight: number) {
  const height = Math.max(0, Math.round(rawHeight));
  if (height === currentHeight) return;
  currentHeight = height;
  const root = document.documentElement;
  root.style.setProperty("--keyboard-height", `${height}px`);
  root.classList.toggle("kb-open", height > 0);
  listeners.forEach((listener) => listener(height));
}

/**
 * Inputs no fluxo normal da página (fora de drawers/dialogs) não são erguidos
 * pela CSS var — para esses, rolamos a janela só o suficiente para o campo
 * ficar visível acima do teclado.
 */
function scrollPageInputIntoView() {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return;
  const isTextField =
    el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
  if (!isTextField) return;
  // Drawers (vaul) e dialogs (radix) renderizam role="dialog" e cuidam de si.
  if (el.closest('[role="dialog"]')) return;
  const rect = el.getBoundingClientRect();
  const visibleBottom = window.innerHeight - currentHeight - 16;
  if (rect.bottom > visibleBottom) {
    window.scrollBy({ top: rect.bottom - visibleBottom, behavior: "smooth" });
  }
}

/** Chamar uma única vez no bootstrap do app (App.tsx). No-op fora do nativo. */
export function initKeyboardTracker() {
  if (initialized || !Capacitor.isNativePlatform()) return;
  initialized = true;
  Keyboard.addListener("keyboardWillShow", (info) => {
    publish(info?.keyboardHeight ?? 0);
    requestAnimationFrame(scrollPageInputIntoView);
  });
  Keyboard.addListener("keyboardWillHide", () => {
    publish(0);
  });
}
