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
import * as SentryCapacitor from "@sentry/capacitor";
import * as SentryReact from "@sentry/react";

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

/** Versão de marketing lida do `project.pbxproj` no build (ver vite.config.ts). */
export const APP_VERSION =
  (import.meta.env.VITE_APP_VERSION as string | undefined) || "0.0.0";

let enabled = false;

/** True quando o Sentry foi inicializado de fato (DSN presente e init OK). */
export function isMonitoringEnabled(): boolean {
  return enabled;
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

type SentryEvent = Parameters<
  NonNullable<Parameters<typeof SentryReact.init>[0]>["beforeSend"] & object
>[0];
type SentryHint = Parameters<
  NonNullable<Parameters<typeof SentryReact.init>[0]>["beforeSend"] & object
>[1];

function beforeSend(event: SentryEvent, hint: SentryHint): SentryEvent | null {
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
 * Inicializa o Sentry. Chamada uma única vez no bootstrap (`App.tsx`), antes de
 * qualquer render — erro que acontece no primeiro frame também precisa chegar.
 */
export function initMonitoring(): void {
  if (enabled || !DSN) return;

  const options: Parameters<typeof SentryReact.init>[0] = {
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

  try {
    if (Capacitor.isNativePlatform()) {
      // No device o SDK do Capacitor embrulha o init do React e ainda liga o
      // Sentry Cocoa — é o que captura crash nativo de plugin.
      SentryCapacitor.init(options, SentryReact.init);
    } else {
      // Navegador (pnpm dev / preview): só o SDK web, sem ponte nativa.
      SentryReact.init(options);
    }
    enabled = true;
  } catch (err) {
    // Telemetria nunca pode derrubar o app.
    console.warn("[monitoring] falha ao inicializar o Sentry", err);
  }
}

/** Associa os próximos eventos ao usuário logado (só o id — ver nota de PII). */
export function setMonitoringUser(userId: string | null): void {
  if (!enabled) return;
  SentryReact.setUser(userId ? { id: userId } : null);
}

/** Marca a tela atual, para saber onde o erro aconteceu sem depender do stack. */
export function setMonitoringScreen(path: string): void {
  if (!enabled) return;
  SentryReact.setTag("screen", path);
  SentryReact.addBreadcrumb({ category: "navigation", message: path, level: "info" });
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
  SentryReact.withScope((scope) => {
    scope.setTag("handled_at", where);
    scope.setLevel("warning");
    if (extra) scope.setContext("detalhes", extra);
    SentryReact.captureException(error);
  });
}

/**
 * Reporta o erro que derrubou a árvore React (ErrorBoundary).
 * @returns o id do evento, para exibir na tela de erro — é o que o usuário pode
 *   citar no suporte e nos leva direto ao evento no painel.
 */
export function reportFatalError(
  error: unknown,
  componentStack?: string | null,
): string | undefined {
  if (!enabled) {
    console.error("[fatal]", error, componentStack);
    return undefined;
  }
  return SentryReact.withScope((scope) => {
    scope.setLevel("fatal");
    scope.setTag("boundary", "root");
    if (componentStack) scope.setContext("react", { componentStack });
    return SentryReact.captureException(error);
  });
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
 * @returns o id do evento, ou `null` se o envio não pôde ser feito.
 */
export function sendProblemReport(input: {
  message: string;
  email?: string;
  context: ProblemReportContext;
}): string | null {
  if (!enabled) return null;

  const summary = input.message.trim().replace(/\s+/g, " ").slice(0, 80);

  let eventId: string | null = null;
  SentryReact.withScope((scope) => {
    scope.setLevel("info");
    scope.setTag("report_source", "in_app");
    scope.setTag("screen", input.context.screen);
    scope.setContext("relato", {
      mensagem: input.message,
      email: input.email || "(não informado)",
    });
    scope.setContext("ambiente", input.context);
    // Cada relato é um relato — sem isto o Sentry agruparia textos parecidos
    // no mesmo issue e o segundo usuário viraria só um contador.
    scope.setFingerprint(["user-report", String(Date.now()), summary]);
    eventId = SentryReact.captureMessage(`Relato do usuário: ${summary}`, "info");
  });

  return eventId;
}

/** Garante que o evento saiu antes de fechar a tela. */
export function flushMonitoring(timeoutMs = 3000): Promise<boolean> {
  if (!enabled) return Promise.resolve(true);
  return SentryReact.flush(timeoutMs).catch(() => false);
}
