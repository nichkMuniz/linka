import * as React from "react";
import { getKeyboardHeight, subscribeKeyboardHeight } from "@/lib/keyboard";

/** Sobe do elemento até o ancestral rolável verticalmente mais próximo. */
function findScrollParent(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const overflowY = getComputedStyle(node).overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * Mantém o input de texto em foco visível acima do teclado do iOS rolando um
 * **container interno** (não a janela).
 *
 * Contexto (ver `client/lib/keyboard.ts`): com `Keyboard: { resize: 'none' }` o
 * frame do WKWebView nunca muda — o teclado apenas sobrepõe a tela. O
 * scroll-assist global de `keyboard.ts` (`scrollPageInputIntoView`) resolve
 * inputs no fluxo NORMAL da página com `window.scrollBy`, e ainda pula qualquer
 * `[role="dialog"]` ("drawers/dialogs cuidam de si"). Sobra um caso que ninguém
 * cobre: **inputs dentro de uma área `overflow-y-auto` própria** — drawers com
 * formulário rolável, dialogs de tela cheia e overlays `position:fixed`. Aí a
 * página não rola (quem rola é o container), então `window.scrollBy` é no-op e o
 * campo fica atrás do teclado. Este hook é a peça que faltava para esses casos.
 *
 * **Sempre combine com** `paddingBottom: "calc(<folga> + var(--keyboard-height, 0px))"`
 * no MESMO container — sem esse espaço extra não há para onde rolar o último
 * campo acima do teclado.
 *
 * Referência de "área visível" = `min(fundo do container, linha do teclado)`,
 * que cobre as duas geometrias sem ramificação:
 * - **Drawer** (sobe junto com o teclado via lift wrapper + é limitado pelo clamp
 *   do `global.css`): o fundo do container já está acima do teclado, então a
 *   referência é o próprio container. Como container e input são medidos no mesmo
 *   instante, a conta é invariante ao transform do lift — não há dupla contagem
 *   mesmo medindo no meio da animação.
 * - **Overlay fixo** que não sobe e cujo container se estende atrás do teclado
 *   (ex.: sessão de treino): a linha do teclado vence e o campo para acima dele.
 *
 * @param scrollRef container rolável onde os inputs vivem. **Opcional**: quando
 *   omitido, o hook sobe do input em foco até o ancestral rolável mais próximo
 *   (`overflow-y: auto|scroll` que de fato transborda). Útil quando há vários
 *   containers roláveis independentes na mesma tela (ex.: settings-drawer, com
 *   um sub-drawer por seção), onde um ref único seria frágil.
 * @param enabled   só escuta enquanto o overlay/drawer está aberto (default true)
 */
export function useKeyboardInputScroll(
  scrollRef?: React.RefObject<HTMLElement | null>,
  enabled: boolean = true,
) {
  React.useEffect(() => {
    if (!enabled) return;

    const scrollActiveInputIntoView = () => {
      const kb = getKeyboardHeight();
      if (kb <= 0) return;
      const el = document.activeElement as HTMLElement | null;
      if (!el) return;
      const isField =
        el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
      if (!isField) return;
      const container = scrollRef ? scrollRef.current : findScrollParent(el);
      if (!container || !container.contains(el)) return;

      const inputRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      // 16px de folga entre o campo e a borda inferior visível.
      const visibleBottom = Math.min(containerRect.bottom, window.innerHeight - kb) - 16;
      if (inputRect.bottom > visibleBottom) {
        container.scrollBy({ top: inputRect.bottom - visibleBottom, behavior: "smooth" });
      }
    };

    // Abrir o teclado (altura passa a > 0) rola o campo em foco para a vista.
    const unsubscribe = subscribeKeyboardHeight((height) => {
      if (height > 0) requestAnimationFrame(scrollActiveInputIntoView);
    });

    // Trocar de input com o teclado JÁ aberto não muda a altura (o subscriber não
    // dispara), então também reagimos ao foco. 2 rAF: quando é o próprio foco que
    // abre o teclado, espera o `keyboardWillShow` publicar a altura primeiro.
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      const isField =
        el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
      if (!isField) return;
      requestAnimationFrame(() => requestAnimationFrame(scrollActiveInputIntoView));
    };
    document.addEventListener("focusin", onFocusIn);

    return () => {
      unsubscribe();
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [scrollRef, enabled]);
}
