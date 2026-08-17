/**
 * Cópia para a área de transferência com fallback para o WebView do iOS.
 *
 * `navigator.clipboard` existe no WKWebView, mas falha sem gesto do usuário (e
 * em contexto não seguro) — o `<textarea>` + `execCommand` é o caminho que
 * sempre funciona ali dentro.
 */
export function copyToClipboard(text: string): void {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text: string): void {
  const el = document.createElement("textarea");
  el.value = text;
  el.style.cssText = "position:fixed;opacity:0;pointer-events:none;";
  document.body.appendChild(el);
  el.select();
  try { document.execCommand("copy"); } catch { /* silent */ }
  document.body.removeChild(el);
}
