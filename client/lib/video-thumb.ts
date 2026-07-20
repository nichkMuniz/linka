// Sufixa a URL de um vídeo com o media fragment `#t=0.1` para que o WebView faça
// *seek* até esse instante e PINTE aquele frame como thumbnail/poster.
//
// Motivo: um `<video preload="metadata">` sozinho baixa os metadados mas NÃO
// pinta nenhum frame no WKWebView do iOS — o elemento fica preto até dar play.
// O fragment força o primeiro frame a aparecer, servindo de preview estático sem
// precisar de uma coluna de thumbnail no banco.
//
// Idempotente: não anexa se a URL já tiver um fragment (`#`). Propaga
// null/undefined como `undefined` para casar com `src={... ?? undefined}`.
export function videoPosterSrc(
  url: string | null | undefined,
): string | undefined {
  if (!url) return undefined;
  return url.includes("#") ? url : `${url}#t=0.1`;
}
