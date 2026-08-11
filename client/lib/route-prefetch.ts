/**
 * Pré-carregamento dos chunks de tela.
 *
 * **Problema:** todas as páginas são `React.lazy`, então o chunk de uma tela só
 * começa a ser buscado no instante em que a rota muda. O usuário toca em
 * "Metas", e só aí o app vai buscar 345 KB de JavaScript, parsear e executar —
 * com o dedo já fora da tela. É esse intervalo que dá a sensação de que o app
 * "pensa" antes de trocar de página.
 *
 * **Solução:** aquecer o chunk um pouco antes do destino ser realmente
 * necessário. Duas oportunidades, em ordem de valor:
 *
 *   1. `onPointerDown` no item do menu — entre apertar e soltar o dedo passam
 *      ~100 ms, e a navegação só acontece no clique. Nesse tempo o chunk já
 *      entrou. É de graça e é o que mais se nota.
 *   2. Ocioso após o primeiro paint — as telas do menu principal são aquecidas
 *      quando a thread não tem nada melhor a fazer.
 *
 * **Por que os `import()` estão duplicados aqui e no App.tsx:** o bundler casa
 * chunks pelo especificador literal. Escrever `import("@/pages/Goals")` nos dois
 * lugares aponta para o MESMO arquivo gerado — o prefetch aquece exatamente o
 * chunk que o `React.lazy` vai pedir. Um wrapper genérico que recebesse o
 * caminho como variável quebraria isso: o Rollup não consegue analisar import
 * dinâmico com especificador computado e geraria outro chunk (ou nenhum).
 */

type Thunk = () => Promise<unknown>;

const ROUTE_CHUNKS: Record<string, Thunk> = {
  "/": () => import("@/pages/Index"),
  "/shots": () => import("@/pages/Shots"),
  "/postar": () => import("@/pages/NewPost"),
  "/metas": () => import("@/pages/Goals"),
  "/vitrine": () => import("@/pages/Store"),
  "/perfil": () => import("@/pages/Profile"),
  "/buscar": () => import("@/pages/Search"),
  "/comunidade": () => import("@/pages/Community"),
  "/notificacoes": () => import("@/pages/Notifications"),
};

/** Chunks já solicitados — o import() em si é idempotente, mas isto evita o
 *  custo de recriar a promise e reentrar no runtime a cada toque. */
const warmed = new Set<string>();

/**
 * Aquece o chunk da rota, se ainda não foi.
 *
 * Aceita caminhos com sufixo (`/usuario/123` → `/perfil` não casa, mas `/` sim
 * pelo prefixo exato) — só rotas conhecidas do menu são aquecidas, o resto é
 * ignorado silenciosamente. Nunca lança: falhar aqui não pode quebrar a
 * navegação, que vai buscar o chunk de novo pelo caminho normal.
 */
export function prefetchRoute(path: string): void {
  const thunk = ROUTE_CHUNKS[path];
  if (!thunk || warmed.has(path)) return;
  warmed.add(path);
  void thunk().catch(() => {
    // Deixa tentar de novo depois — pode ter sido uma falha transitória.
    warmed.delete(path);
  });
}

/**
 * Aquece as telas do menu principal quando a thread ficar ociosa.
 *
 * Deliberadamente NÃO inclui tudo: aquecer as 9 telas de uma vez competiria com
 * a carga de dados da tela que o usuário está de fato olhando. Ficam as quatro
 * do bottom nav, que concentram quase toda a navegação — e mesmo assim uma de
 * cada vez, encadeadas, para não disputar banda/CPU entre si.
 */
export function prefetchPrimaryRoutes(): void {
  const targets = ["/", "/metas", "/comunidade", "/shots"];

  const run = () => {
    void targets.reduce<Promise<unknown>>(
      (chain, path) => chain.then(() => {
        const thunk = ROUTE_CHUNKS[path];
        if (!thunk || warmed.has(path)) return;
        warmed.add(path);
        return thunk().catch(() => { warmed.delete(path); });
      }),
      Promise.resolve(),
    );
  };

  // `requestIdleCallback` não existe no WKWebView do iOS (Safari nunca o
  // implementou). O setTimeout é o fallback: 2s é tempo suficiente para a tela
  // inicial ter terminado de carregar seus próprios dados.
  const ric = (window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  }).requestIdleCallback;

  if (typeof ric === "function") ric(run, { timeout: 4000 });
  else setTimeout(run, 2000);
}
