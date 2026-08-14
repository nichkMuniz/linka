/**
 * Monitoramento de erros em produção (Sentry).
 *
 * **Por que isto existe:** o app roda dentro de um WKWebView. Um erro de
 * JavaScript não é um crash do processo iOS — o relatório automático da Apple
 * (Xcode Organizer / App Store Connect) nunca enxerga esses erros. Sem esta
 * camada, a quase totalidade dos bugs reais chega até nós só como um review de
 * uma estrela. O SDK do Capacitor cobre os dois lados: erro de JS no WebView
 * **e** crash nativo (plugins, StoreKit, GPS).
 *
 * **Configuração:** a variável `VITE_SENTRY_DSN` (ver `.env.example`). Sem ela
 * o módulo inteiro vira no-op — `pnpm dev` e qualquer build sem a variável
 * seguem funcionando normalmente, só sem telemetria.
 *
 * **Privacidade:** nenhum evento automático carrega e-mail, nome ou IP — só o
 * `id` do usuário, que serve para contar "quantas pessoas esse bug atingiu".
 * O e-mail só sai daqui quando a própria pessoa o digita no drawer de
 * "Relatar um problema" (ver `report-problem-drawer.tsx`).
 */
import { Capacitor } from "@capacitor/core";
import type * as SentryReactNS from "@sentry/react";

type SentryReactModule = typeof SentryReactNS;

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

/** Versão de marketing lida do `project.pbxproj` no build (ver vite.config.ts). */
export const APP_VERSION =
  (import.meta.env.VITE_APP_VERSION as string | undefined) || "0.0.0";

let enabled = false;

/**
 * True quando o monitoramento está ATIVO — não quando o SDK já terminou de
 * carregar. A distinção importa: o SDK agora chega por import dinâmico, e o
 * botão "Relatar um problema" precisa decidir se aparece já no primeiro render
 * (ver report-problem-drawer.tsx). Vira false de novo só se o init falhar.
 */
export function isMonitoringEnabled(): boolean {
  return enabled;
}

// ─── Carga assíncrona do SDK ─────────────────────────────────────────────────
//
// Os SDKs do Sentry (React + ponte Capacitor/Cocoa) somam ~100KB minificados.
// Importados estaticamente, entravam no chunk de ENTRADA e eram parseados e
// executados antes do primeiro pixel, em TODA abertura do app — telemetria
// pagando o preço mais caro que existe no cold start.
//
// Agora o módulo é buscado em paralelo e tudo que chega antes dele fica numa
// fila, drenada assim que o init termina. A janela é de alguns milissegundos
// (o arquivo vem do disco local no Capacitor), e nada é perdido nela: o
// ErrorBoundary e o listener de `unhandledrejection` do App.tsx continuam
// capturando desde o primeiro frame — só a ENTREGA é que espera o SDK.

let sentry: SentryReactModule | null = null;
let queue: Array<(s: SentryReactModule) => void> = [];

function whenReady(fn: (s: SentryReactModule) => void): void {
  if (!enabled) return;
  if (sentry) {
    fn(sentry);
    return;
  }
  // Teto de segurança: se o import falhar de vez, a fila não pode crescer sem
  // limite e virar vazamento de memória.
  if (queue.length < 100) queue.push(fn);
}

/**
 * Identificador local do evento, gerado sem depender do SDK.
 *
 * É o código que o usuário lê na tela de erro e cita no suporte. Antes vinha do
 * retorno de `captureException`, que agora pode não estar disponível ainda —
 * então geramos o nosso e o anexamos como tag `report_id`, que é pesquisável no
 * painel exatamente como o event id era.
 */
function newReportId(): string {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    return Math.random().toString(16).slice(2).padEnd(16, "0");
  }
}

/**
 * Mensagens que NÃO são bug e queimariam a cota gratuita à toa.
 *
 * O grosso é rede: o app tem modo offline, então "Failed to fetch" é um estado
 * previsto e já tratado (fila `lk:outbox`), não um defeito. `ignoreErrors` faz
 * match por substring na mensagem.
 */
const IGNORED_ERRORS = [
  // Rede indisponível — offline é um estado suportado, não um bug.
  "Failed to fetch",
  "Load failed",
  "NetworkError",
  "The network connection was lost",
  "The Internet connection appears to be offline",
  "cancelado",
  // Aborts intencionais (troca de tela cancela requisição em voo).
  "AbortError",
  "The operation was aborted",
  "signal is aborted without reason",
  // Ruído clássico de layout, sem impacto para o usuário.
  "ResizeObserver loop",
  // <video> interrompido por outro play()/pause() — acontece o tempo todo em
  // Shots e no viewer de flows ao passar rápido entre itens.
  "The play() request was interrupted",
  "The request is not allowed by the user agent",
];

/** Erros de sessão que o app já trata redirecionando para o login. */
const EXPECTED_AUTH_ERRORS =
  /Auth session missing|Invalid Refresh Token|refresh_token_not_found|JWT expired/i;

type SentryOptions = NonNullable<Parameters<SentryReactModule["init"]>[0]>;
type SentryEvent = Parameters<NonNullable<SentryOptions["beforeSend"]> & object>[0];
type SentryHint = Parameters<NonNullable<SentryOptions["beforeSend"]> & object>[1];

function beforeSend(event: SentryEvent, hint: SentryHint): SentryEvent | null {
  // Em `pnpm dev` o hot reload executa estados INTERMEDIÁRIOS de edição: a
  // declaração já foi cortada, a referência ainda está no JSX, e o painel
  // recebe um `ReferenceError` que parece bug de produção até alguém conferir
  // o `environment`. Os sete primeiros issues do projeto foram exatamente
  // isso. O relato MANUAL continua saindo — é como se testa o drawer
  // "Relatar um problema" sem ter que buildar.
  if (import.meta.env.DEV && event.tags?.report_source !== "in_app") return null;

  const original = hint?.originalException as { message?: string } | string | undefined;
  const message =
    (typeof original === "string" ? original : original?.message) ??
    event.message ??
    event.exception?.values?.[0]?.value ??
    "";

  if (EXPECTED_AUTH_ERRORS.test(message)) return null;

  // Cinto e suspensório: `ignoreErrors` não alcança rejeições que chegam como
  // string solta ou objeto de erro do Supabase sem `message` no topo.
  if (IGNORED_ERRORS.some((needle) => message.includes(needle))) return null;

  // Evento vazio não ajuda ninguém e ainda consome cota.
  if (!message && !event.exception?.values?.length) return null;

  // Nunca vaza PII em evento automático — `id` basta para contar usuários
  // afetados. O e-mail só viaja no relato manual, com o usuário ciente.
  if (event.user) {
    delete event.user.email;
    delete event.user.username;
    delete event.user.ip_address;
  }

  return event;
}

/**
 * Liga o monitoramento. Chamada uma única vez no bootstrap (`App.tsx`).
 *
 * Retorna imediatamente: o SDK é buscado em background e o init acontece
 * quando ele chega. Tudo que for reportado nesse meio-tempo fica na fila do
 * `whenReady` — nada se perde, só atrasa alguns milissegundos.
 */
export function initMonitoring(): void {
  if (enabled || !DSN) return;

  // Já marcamos como ativo aqui (e não depois do init): é o que permite ao
  // `isMonitoringEnabled()` responder na hora e ao `whenReady` aceitar itens
  // na fila antes de o SDK existir.
  enabled = true;

  const options: SentryOptions = {
    dsn: DSN,
    release: `linka@${APP_VERSION}`,
    environment: import.meta.env.DEV ? "development" : "production",
    // Só erros. Tracing e session replay derrubam a cota gratuita em dias e
    // não é isso que estamos procurando agora.
    tracesSampleRate: 0,
    sendDefaultPii: false,
    maxBreadcrumbs: 60,
    ignoreErrors: IGNORED_ERRORS,
    beforeSend,
  };

  void (async () => {
    try {
      const SentryReact = await import("@sentry/react");

      if (Capacitor.isNativePlatform()) {
        // No device o SDK do Capacitor embrulha o init do React e ainda liga o
        // Sentry Cocoa — é o que captura crash nativo de plugin.
        const SentryCapacitor = await import("@sentry/capacitor");
        SentryCapacitor.init(options, SentryReact.init);
      } else {
        // Navegador (pnpm dev / preview): só o SDK web, sem ponte nativa.
        SentryReact.init(options);
      }

      sentry = SentryReact;
      const pending = queue;
      queue = [];
      for (const fn of pending) {
        try {
          fn(SentryReact);
        } catch {
          // Um item defeituoso na fila não pode impedir os outros de saírem.
        }
      }
    } catch (err) {
      // Telemetria nunca pode derrubar o app. Sem SDK, voltamos ao modo
      // no-op — e a fila é descartada para não vazar memória.
      enabled = false;
      queue = [];
      console.warn("[monitoring] falha ao inicializar o Sentry", err);
    }
  })();
}

/** Associa os próximos eventos ao usuário logado (só o id — ver nota de PII). */
export function setMonitoringUser(userId: string | null): void {
  whenReady((s) => s.setUser(userId ? { id: userId } : null));
}

/** Marca a tela atual, para saber onde o erro aconteceu sem depender do stack. */
export function setMonitoringScreen(path: string): void {
  whenReady((s) => {
    s.setTag("screen", path);
    s.addBreadcrumb({ category: "navigation", message: path, level: "info" });
  });
}

/**
 * Reporta um erro que o app JÁ tratou — tipicamente um `catch` que só mostra
 * toast. Do ponto de vista do usuário "deu erro"; sem isto, do nosso ponto de
 * vista nunca aconteceu nada.
 *
 * @param where identificador curto e estável do ponto de falha
 *   (ex.: `"settings:save-profile"`), usado como tag no Sentry.
 */
export function reportHandledError(
  error: unknown,
  where: string,
  extra?: Record<string, unknown>,
): void {
  if (!enabled) {
    console.error(`[${where}]`, error);
    return;
  }
  whenReady((s) =>
    s.withScope((scope) => {
      scope.setTag("handled_at", where);
      scope.setLevel("warning");
      if (extra) scope.setContext("detalhes", extra);
      s.captureException(error);
    }),
  );
}

/**
 * Reporta o erro que derrubou a árvore React (ErrorBoundary).
 *
 * @returns o código a exibir na tela de erro — é o que o usuário pode citar no
 *   suporte. Gerado localmente (`report_id`) em vez de vir do retorno do
 *   `captureException`: o SDK pode ainda não ter chegado no instante em que a
 *   árvore quebra, e justamente um erro no primeiro frame é o mais provável de
 *   cair nessa janela. A tag é pesquisável no painel igual ao event id era.
 */
export function reportFatalError(
  error: unknown,
  componentStack?: string | null,
): string | undefined {
  if (!enabled) {
    console.error("[fatal]", error, componentStack);
    return undefined;
  }

  const reportId = newReportId();
  whenReady((s) =>
    s.withScope((scope) => {
      scope.setLevel("fatal");
      scope.setTag("boundary", "root");
      scope.setTag("report_id", reportId);
      if (componentStack) scope.setContext("react", { componentStack });
      s.captureException(error);
    }),
  );
  return reportId;
}

/** Contexto técnico anexado a um relato manual de problema. */
export interface ProblemReportContext {
  // O `setContext` do Sentry exige um objeto indexável por string.
  [key: string]: unknown;
  appVersion: string;
  build: string;
  platform: string;
  screen: string;
  language: string;
  online: boolean;
  userAgent: string;
  viewport: string;
}

/**
 * Envia o relato escrito pelo usuário. Vira um evento normal no Sentry (com
 * fingerprint único, para dois relatos nunca se fundirem num issue só), o que
 * o coloca na mesma lista onde já olhamos os erros automáticos.
 *
 * @returns o código do relato (tag `report_id`), ou `null` se o monitoramento
 *   está desligado. Na prática o SDK já chegou muito antes — abrir o drawer e
 *   escrever o relato leva segundos —, mas o código é gerado localmente para
 *   nunca depender disso.
 */
export function sendProblemReport(input: {
  message: string;
  email?: string;
  context: ProblemReportContext;
}): string | null {
  if (!enabled) return null;

  const summary = input.message.trim().replace(/\s+/g, " ").slice(0, 80);
  const reportId = newReportId();

  whenReady((s) =>
    s.withScope((scope) => {
      scope.setLevel("info");
      scope.setTag("report_source", "in_app");
      scope.setTag("screen", input.context.screen);
      scope.setTag("report_id", reportId);
      scope.setContext("relato", {
        mensagem: input.message,
        email: input.email || "(não informado)",
      });
      scope.setContext("ambiente", input.context);
      // Cada relato é um relato — sem isto o Sentry agruparia textos parecidos
      // no mesmo issue e o segundo usuário viraria só um contador.
      scope.setFingerprint(["user-report", String(Date.now()), summary]);
      s.captureMessage(`Relato do usuário: ${summary}`, "info");
    }),
  );

  return reportId;
}

/**
 * Garante que o evento saiu antes de fechar a tela.
 *
 * Se o SDK ainda não chegou, espera-o entrar (a fila já foi drenada quando ele
 * chega) — daí o `whenReady` com resolve próprio em vez de um retorno direto.
 */
export function flushMonitoring(timeoutMs = 3000): Promise<boolean> {
  if (!enabled) return Promise.resolve(true);
  if (sentry) return sentry.flush(timeoutMs).catch(() => false);

  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    whenReady((s) => {
      clearTimeout(timer);
      s.flush(timeoutMs).then(resolve).catch(() => resolve(false));
    });
  });
}
