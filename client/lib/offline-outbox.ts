import {
  addNetworkStatusListener,
  getNetworkStatus,
  isTransientNetworkError,
} from "@/lib/network-status";

// ─── Fila de sincronização offline (outbox) ──────────────────────────────────
// Escritas da tela de Metas feitas sem internet (histórico de treino, check-in,
// progresso de meta, notas, conclusão de dieta/hábito) entram nesta fila
// persistida em localStorage e são reenviadas em ordem (FIFO) quando o Supabase
// volta a ficar alcançável. Cada entrada carrega a DATA ORIGINAL da ação, então
// streak, "última execução" e progresso de meta não se distorcem no replay.
//
// Os executores (quem sabe efetivamente gravar cada tipo no banco) são
// registrados pelo ritmofit-db.ts via registerOutboxExecutor — este módulo não
// importa o ritmofit-db para evitar dependência circular. IMPORTANTE: executores
// devem usar caminhos "online puros" (que lançam erro de rede), nunca as funções
// públicas com fallback offline — senão uma falha no replay seria confundida
// com sucesso e a entrada seria perdida.

export type OutboxEntryType =
  | "workout_hist"
  | "check_in"
  | "goal_progress"
  | "routine_summary"
  | "workout_notes"
  | "diet_toggle"
  | "habit_toggle"
  | "diet_hist"
  | "habit_hist";

export type OutboxEntry = {
  id: string;
  type: OutboxEntryType;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
};

const STORAGE_KEY = "lk:outbox";
// Entradas que falham com erro NÃO-transitório (RLS, dado inválido) são
// descartadas após este nº de tentativas para não bloquear a fila para sempre.
// Erros de rede nunca descartam — os dados esperam a conexão voltar.
const MAX_ATTEMPTS = 8;

/** Evento global disparado quando um flush envia ≥ 1 entrada com sucesso. */
export const OUTBOX_SYNCED_EVENT = "linka-offline-synced";

function loadQueue(): OutboxEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OutboxEntry[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: OutboxEntry[]) {
  try {
    if (queue.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error("[outbox] Failed to persist queue:", err);
  }
}

export function enqueueOutbox(
  type: OutboxEntryType,
  payload: Record<string, unknown>,
): void {
  const queue = loadQueue();
  queue.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
  saveQueue(queue);
}

export function outboxSize(): number {
  return loadQueue().length;
}

/** Limpa a fila — usado no sign-out/troca de usuário (dados de outro contexto). */
export function clearOutbox(): void {
  saveQueue([]);
}

type OutboxExecutor = (payload: Record<string, unknown>) => Promise<void>;
const executors = new Map<OutboxEntryType, OutboxExecutor>();

export function registerOutboxExecutor(
  type: OutboxEntryType,
  fn: OutboxExecutor,
): void {
  executors.set(type, fn);
}

let flushing = false;

/**
 * Drena a fila em ordem. Para no primeiro erro de rede (continua offline —
 * tenta de novo no próximo gatilho). Retorna quantas entradas foram enviadas.
 */
export async function flushOutbox(): Promise<number> {
  if (flushing) return 0;
  if (loadQueue().length === 0) return 0;
  flushing = true;
  let flushed = 0;
  // Entradas puladas nesta passada (sem executor registrado ainda).
  const skipIds = new Set<string>();
  try {
    while (true) {
      // A fila é RECARREGADA a cada iteração e as mutações são feitas por id:
      // entradas enfileiradas durante um await do flush (ex.: usuário finaliza
      // outro treino no meio da sincronização) nunca são sobrescritas.
      const queue = loadQueue();
      const entry = queue.find((e) => !skipIds.has(e.id));
      if (!entry) break;
      const exec = executors.get(entry.type);
      if (!exec) {
        skipIds.add(entry.id);
        continue;
      }
      try {
        await exec(entry.payload);
        saveQueue(loadQueue().filter((e) => e.id !== entry.id));
        flushed++;
      } catch (err) {
        const fresh = loadQueue();
        const idx = fresh.findIndex((e) => e.id === entry.id);
        if (idx >= 0) {
          fresh[idx].attempts = (fresh[idx].attempts ?? 0) + 1;
          if (!isTransientNetworkError(err) && fresh[idx].attempts >= MAX_ATTEMPTS) {
            console.error(
              `[outbox] Dropping "${entry.type}" entry after ${fresh[idx].attempts} failed attempts:`,
              err,
            );
            fresh.splice(idx, 1);
            saveQueue(fresh);
            continue; // segue para a próxima entrada
          }
          saveQueue(fresh);
        }
        break; // provável falta de rede — tenta de novo no próximo gatilho
      }
    }
  } finally {
    flushing = false;
  }
  if (flushed > 0) {
    try {
      window.dispatchEvent(
        new CustomEvent(OUTBOX_SYNCED_EVENT, { detail: { count: flushed } }),
      );
    } catch {
      /* ignore */
    }
  }
  return flushed;
}

// ─── Gatilhos de flush ────────────────────────────────────────────────────────

// 1. Internet/Supabase voltou a ficar alcançável.
addNetworkStatusListener((status) => {
  if (status.isOnline && status.isSupabaseReachable) void flushOutbox();
});

if (typeof window !== "undefined") {
  // 2. Cold start já com internet (o listener acima só dispara em MUDANÇA de
  //    estado). O atraso dá tempo do ritmofit-db registrar os executores e do
  //    check inicial de reachability do network-status rodar.
  setTimeout(() => {
    const s = getNetworkStatus();
    if (s.isOnline && s.isSupabaseReachable && outboxSize() > 0) void flushOutbox();
  }, 4000);

  // 3. App voltou do background (iOS pode ter recuperado a rede enquanto
  //    suspenso, sem disparar o evento "online" do WebView).
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    const s = getNetworkStatus();
    if (s.isOnline && s.isSupabaseReachable && outboxSize() > 0) void flushOutbox();
  });
}
