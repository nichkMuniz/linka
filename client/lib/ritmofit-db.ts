import { getUserSafe, hasSupabaseConfig, supabase, registerViewerCacheInvalidator, registerAuthUserReadyHandler } from "@/lib/supabase";
import type { PostWorkoutSummary } from "@/lib/workout-summary-types";
import { SHARE_BASE_URL } from "@/lib/share-url";
import { estimateOneRepMax } from "@/lib/one-rep-max";
import { compressImageFile } from "@/lib/image-compress";
import {
  getNetworkStatus,
  isTransientNetworkError,
  checkSupabaseReachability,
} from "@/lib/network-status";
import {
  enqueueOutbox,
  registerOutboxExecutor,
  clearOutbox,
  flushOutbox,
} from "@/lib/offline-outbox";

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export async function checkEmailExistsDb(email: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("check_email_exists", {
    p_email: email.trim().toLowerCase(),
  });
  if (error) return false;
  return data === true;
}

/**
 * Verifica se um handle (@usuário) já está em uso por outro perfil.
 * Compara de forma normalizada (sem "@", minúsculo). Retorna true se ocupado.
 * `excludeUserId` ignora o próprio perfil (usado ao editar nas configurações).
 * Usa a RPC `check_handle_exists` (SECURITY DEFINER), então funciona mesmo antes
 * de o usuário estar autenticado (etapa de cadastro). Se a RPC ainda não existir
 * (migração 20260720 não rodada), degrada para "disponível".
 */
export async function checkHandleExistsDb(
  handle: string,
  excludeUserId?: string,
): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("check_handle_exists", {
    p_handle: handle.trim().toLowerCase(),
    p_exclude_user: excludeUserId ?? null,
  });
  if (error) return false;
  return data === true;
}

// ─── Input validation helpers ────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUUID(value: string, label: string) {
  if (!UUID_RE.test(value)) throw new Error(`${label} inválido`);
}

// shots.id é bigint (identity), não uuid — validar com assertUUID rejeita todo id
// de shot real. Aceita ambos os formatos para não quebrar se o tipo mudar.
function assertShotId(value: string, label: string) {
  const v = String(value).trim();
  if (!/^\d+$/.test(v) && !UUID_RE.test(v)) throw new Error(`${label} inválido`);
}

function assertMaxLength(value: string, max: number, label: string) {
  if (value.length > max) throw new Error(`${label} muito longo (máximo ${max} caracteres)`);
}

function assertNotEmpty(value: string, label: string) {
  if (!value.trim()) throw new Error(`${label} não pode estar vazio`);
}

// ─── Viewer cache ─────────────────────────────────────────────────────────────
// Viewer cache: avoids redundant auth.getUser() calls within the same operation burst
let _viewerCache: { user: import("@supabase/supabase-js").User | null; expiry: number } | null = null;
const VIEWER_TTL_MS = 30_000; // 30s — safe because auth state changes trigger invalidateViewerCache()

function invalidateViewerCache() {
  _viewerCache = null;
  _queryCache.clear();
  // Drop persisted entries too — they may contain data from a previous user.
  persistDelete();
  // Cópias offline e fila de sincronização pertencem ao usuário que saiu.
  offlineCopyDeleteAll();
  clearOutbox();
}

function cleanHandle(raw: string) {
  const slug = raw
    .toLowerCase()
    .replace(/@/g, "")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, "");
  return slug || "voce";
}

export async function getViewer() {
  if (!hasSupabaseConfig || !supabase) return null;

  // Return cached viewer if still valid
  if (_viewerCache && Date.now() < _viewerCache.expiry) {
    return _viewerCache.user;
  }

  try {
    const user = await getUserSafe();
    // Nunca cachear `null`: logo após o login (ou numa falha transitória de
    // refresh do token) um null cacheado por 30s fazia todas as queries
    // user-scoped retornarem vazio — feed sem posts de seguidos, flows/shots/
    // notificações vazios. getSession() lê do localStorage, então re-tentar
    // a cada chamada é barato.
    if (user) {
      _viewerCache = { user, expiry: Date.now() + VIEWER_TTL_MS };
    }
    return user;
  } catch {
    return null;
  }
}

export { invalidateViewerCache };

// Register the cache invalidator so supabase.ts can clear it on sign-out
registerViewerCacheInvalidator(invalidateViewerCache);

// Quando uma sessão fica disponível (login, cold start, refresh de token):
// derruba o viewer cache (pode conter `null` cacheado antes do login) e, se o
// usuário mudou desde a última sessão, purga o cache de queries inteiro — os
// dados persistidos pertencem a outro contexto. Quando é o mesmo usuário, o
// cache persistido é preservado para manter o first paint instantâneo.
const CACHE_OWNER_KEY = "lk:cacheOwner"; // fora do prefixo lk:q: para sobreviver ao persistDelete()
registerAuthUserReadyHandler((userId: string) => {
  _viewerCache = null;
  try {
    if (localStorage.getItem(CACHE_OWNER_KEY) !== userId) {
      _queryCache.clear();
      persistDelete();
      // Usuário mudou: cópias offline e fila pendente são de outro contexto.
      offlineCopyDeleteAll();
      clearOutbox();
      localStorage.setItem(CACHE_OWNER_KEY, userId);
    }
  } catch {
    _queryCache.clear();
  }
  // Sessão disponível + internet → bom momento para drenar a fila offline
  // (alguns replays, como o de progresso de meta, precisam do viewer). Roda
  // DEPOIS da checagem de troca de usuário para nunca drenar fila de outro.
  if (!isLikelyOffline()) void flushOutbox();
});

// ─── Generic query cache ──────────────────────────────────────────────────────
// Two-layer cache:
//   1. Memory (Map) — fresh data, returned synchronously within TTL.
//   2. localStorage — stale-while-revalidate. After memory TTL expires, we
//      return the persisted value immediately and refetch in background, so
//      revisiting a screen feels instant instead of waiting for the network.
//
// Write operations call invalidateQueryCache(prefix) to bust both layers.

const _queryCache = new Map<string, { data: unknown; expiry: number }>();
const _inflight = new Map<string, Promise<unknown>>();

// TTL por MUTABILIDADE do dado — quem pode escrever nele, e não "quão importante
// ele é". Regra que define o tier:
//
//   Escrito por TERCEIROS (curtidas, comentários, mensagens, notificações,
//   ranking, seguidores) → o app não tem como saber que mudou, então o TTL é a
//   única defesa contra dado velho. Fica curto (SHORT/MEDIUM).
//
//   Escrito SÓ pelo próprio usuário neste device (metas, histórico de treino,
//   peso, progressão) → toda escrita já chama invalidateQueryCache(), então o
//   cache NUNCA fica velho por conta própria. O TTL aqui só existiria para
//   cobrir edição em outro device — cenário raro. Fica longo (OWN).
//
//   Catálogo global (exercícios, dietas, hábitos, metas programadas) → muda
//   quando NÓS publicamos conteúdo novo, semanas de intervalo. Fica muito
//   longo (STATIC); mudanças do usuário no catálogo já invalidam.
const CACHE_TTL_SHORT = 30_000;    // 30s — escrito por terceiros, muda o tempo todo
const CACHE_TTL_MEDIUM = 60_000;   // 60s — listas e feeds com escrita de terceiros
const CACHE_TTL_LONG = 300_000;    // 5min — perfis (mudam raro, mas não são só nossos)
const CACHE_TTL_OWN = 900_000;     // 15min — só o próprio usuário escreve; escrita invalida
const CACHE_TTL_STATIC = 43_200_000; // 12h — catálogo global, praticamente imutável

// Persisted entries older than this are ignored (treated as cold miss).
// Long enough that a returning user gets instant first paint; short enough
// to avoid showing wildly outdated data when the network is slow.
const PERSIST_STALE_MAX_MS = 24 * 60 * 60 * 1000; // 24h

// Skip persisting payloads larger than this to protect the ~5MB localStorage quota.
// 250KB (era 100KB): os catálogos de exercícios/dietas passavam do teto antigo e
// caíam fora do disco — logo o TTL longo deles não sobrevivia ao fechar o app, e
// eram rebuscados a cada abertura. São exatamente as chaves que mais compensam
// persistir. Quota continua folgada: poucas chaves chegam perto disso.
const PERSIST_MAX_BYTES = 250_000; // ~250KB per entry

// Bump when the shape of cached payloads changes incompatibly so old entries are ignored.
const PERSIST_VERSION = 1;
const PERSIST_PREFIX = "lk:q:";

type PersistedEntry = { v: number; t: number; d: unknown };

function persistRead<T>(key: string): { data: T; storedAt: number } | null {
  try {
    const raw = localStorage.getItem(PERSIST_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedEntry;
    if (parsed.v !== PERSIST_VERSION) return null;
    if (Date.now() - parsed.t > PERSIST_STALE_MAX_MS) {
      localStorage.removeItem(PERSIST_PREFIX + key);
      return null;
    }
    return { data: parsed.d as T, storedAt: parsed.t };
  } catch {
    return null;
  }
}

function persistWrite(key: string, data: unknown) {
  try {
    const payload = JSON.stringify({ v: PERSIST_VERSION, t: Date.now(), d: data } satisfies PersistedEntry);
    if (payload.length > PERSIST_MAX_BYTES) return;
    localStorage.setItem(PERSIST_PREFIX + key, payload);
  } catch {
    // Quota exceeded or serialization failed — non-fatal.
  }
}

function persistDelete(prefix?: string) {
  try {
    if (!prefix) {
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PERSIST_PREFIX)) toRemove.push(k);
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
      return;
    }
    const full = PERSIST_PREFIX + prefix;
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(full)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

// ─── Cópias offline (Metas offline) ───────────────────────────────────────────
// Cópia local durável das leituras da tela de Metas, no padrão NETWORK-FIRST:
// online, cada leitura bem-sucedida sobrescreve a cópia (nada muda no fluxo
// normal — preserva a correção de 06/07 que removeu o cache das rotinas); sem
// rede, a cópia é servida no lugar do erro. Diferente do lk:q: (stale-while-
// revalidate com teto de 24h), a cópia NÃO expira — o usuário pode ficar dias
// offline e ainda abrir a tela e treinar. Purga no sign-out/troca de usuário.

const OFFLINE_PREFIX = "lk:off:";
const OFFLINE_MAX_BYTES = 512_000;

function offlineCopyRead<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(OFFLINE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function offlineCopyWrite(key: string, data: unknown) {
  try {
    const payload = JSON.stringify(data);
    if (payload.length > OFFLINE_MAX_BYTES) return;
    localStorage.setItem(OFFLINE_PREFIX + key, payload);
  } catch {
    // Quota exceeded ou serialização falhou — non-fatal.
  }
}

// Atualização otimista: aplica `patch` sobre a cópia existente (ou `initial`,
// quando fornecido) para a UI refletir a ação offline imediatamente.
function offlineCopyPatch<T>(key: string, patch: (current: T) => T, initial?: T) {
  const current = offlineCopyRead<T>(key) ?? initial;
  if (current === undefined || current === null) return;
  offlineCopyWrite(key, patch(current));
}

function offlineCopyDeleteAll() {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(OFFLINE_PREFIX)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

// Dono das cópias offline — o último usuário autenticado neste aparelho
// (lk:cacheOwner, gravado quando a sessão fica pronta). Permite servir dados
// user-scoped mesmo quando o token expirou e getViewer() falha sem rede.
function getOfflineOwnerId(): string | null {
  try {
    return localStorage.getItem(CACHE_OWNER_KEY);
  } catch {
    return null;
  }
}

// Sem internet (ou Supabase inalcançável): escritas vão direto para a fila
// offline em vez de esperar o timeout de um fetch fadado a falhar.
function isLikelyOffline(): boolean {
  try {
    const s = getNetworkStatus();
    return !s.isOnline || !s.isSupabaseReachable;
  } catch {
    return false;
  }
}

// Falha de escrita por rede → true (e dispara um recheck de reachability para
// que as PRÓXIMAS escritas da mesma rajada tomem o fast-path da fila, sem
// esperar N timeouts — ex.: as séries de um treino são gravadas em sequência).
function isOfflineWriteError(err: unknown): boolean {
  if (!isTransientNetworkError(err)) return false;
  void checkSupabaseReachability().catch(() => {});
  return true;
}

async function cached<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>,
  opts?: {
    /**
     * Não guardar resultado VAZIO (array sem itens). Existe para catálogos que
     * dependem de uma migração já ter rodado: sem isto, abrir o app antes da
     * migração grava `[]` no localStorage e o app serve "catálogo vazio" pelo
     * TTL inteiro — 12h no caso dos catálogos estáticos. Foi exatamente o que
     * aconteceu com a anatomia (`muscles`) em 05/08/2026.
     */
    skipEmpty?: boolean;
    /**
     * Ignora o que está em cache (memória E localStorage) e vai à rede, mas
     * continua GRAVANDO o resultado. Para telas em que servir dado velho é o
     * mesmo que estar quebrado — ex.: a aba de Solicitações da Comunidade,
     * aberta pelo toque no push, que precisa mostrar o pedido que acabou de
     * chegar (e não o que existia até 60s atrás).
     *
     * Uma requisição já em voo para a mesma chave ainda é reaproveitada: ela
     * também é uma leitura ao vivo, iniciada há milissegundos.
     */
    fresh?: boolean;
  },
): Promise<T> {
  // L1 — fresh memory hit.
  const hit = _queryCache.get(key);
  if (!opts?.fresh && hit && Date.now() < hit.expiry) return hit.data as T;

  // Dedup concurrent callers for the same key.
  const inflight = _inflight.get(key) as Promise<T> | undefined;

  const fetchAndStore = (): Promise<T> => {
    if (inflight) return inflight;
    const p = fn()
      .then((data) => {
        if (opts?.skipEmpty && Array.isArray(data) && data.length === 0) return data;
        _queryCache.set(key, { data, expiry: Date.now() + ttl });
        persistWrite(key, data);
        return data;
      })
      .finally(() => {
        _inflight.delete(key);
      });
    _inflight.set(key, p);
    return p;
  };

  const persisted = opts?.fresh ? null : persistRead<T>(key);
  if (persisted) {
    const age = Date.now() - persisted.storedAt;

    // L2a — persisted AINDA DENTRO DO TTL: é fresco, não só "melhor que nada".
    // Promove para a memória com o tempo de vida restante e NÃO vai à rede.
    // É isto que faz o TTL valer entre aberturas do app: sem este ramo, todo
    // cold start revalidava TODAS as chaves (inclusive catálogos imutáveis),
    // e o TTL só evitava refetch dentro da mesma sessão.
    if (age < ttl) {
      _queryCache.set(key, { data: persisted.data, expiry: persisted.storedAt + ttl });
      return persisted.data;
    }

    // L2b — persisted vencido: stale-while-revalidate. Serve na hora (first
    // paint instantâneo) e revalida em background.
    // Janela curta de frescor na memória para que re-leituras no mesmo tick
    // não disparem outro fetch.
    _queryCache.set(key, { data: persisted.data, expiry: Date.now() + 1_000 });
    fetchAndStore().catch(() => { /* background error already logged by fn */ });
    return persisted.data;
  }

  // Cold — must wait for the network.
  return fetchAndStore();
}

export function invalidateQueryCache(prefix?: string) {
  if (!prefix) {
    _queryCache.clear();
    persistDelete();
    return;
  }
  for (const key of _queryCache.keys()) {
    if (key.startsWith(prefix)) _queryCache.delete(key);
  }
  persistDelete(prefix);
}

// ————————————————————————————————————————————————————————————————
// Localização de catálogo (workouts / diets / habits)
// Os catálogos têm colunas name_eng / description_eng (tradução em inglês —
// ver docs/migrations/20260704-catalog-eng-columns.sql). Quando o idioma da UI
// é "en" e o campo _eng está preenchido, usamos ele; caso contrário caímos
// para o texto original em português (inclui itens criados pelo usuário, que
// não têm tradução). O idioma é lido do mesmo localStorage do language-context.
// ————————————————————————————————————————————————————————————————
export function getUiLanguage(): "pt" | "en" {
  try {
    return typeof localStorage !== "undefined" &&
      localStorage.getItem("ritmofit-language") === "en"
      ? "en"
      : "pt";
  } catch {
    return "pt";
  }
}

function pickLocalized(pt: any, eng: any): string {
  if (getUiLanguage() === "en") {
    const e = eng == null ? "" : String(eng);
    if (e.trim() !== "") return e;
  }
  return pt == null ? "" : String(pt);
}

// Nome no idioma que pickLocalized NÃO escolheu. Só serve para busca: quem usa o
// app em PT acha "Supino Reto" digitando "bench press" (e vice-versa). Retorna
// undefined quando não há tradução ou quando ela é igual ao nome exibido.
function altLocalized(pt: any, eng: any): string | undefined {
  const shown = pickLocalized(pt, eng).trim().toLowerCase();
  const other = (getUiLanguage() === "en" ? pt : eng) ?? "";
  const alt = String(other).trim();
  if (!alt || alt.toLowerCase() === shown) return undefined;
  return alt;
}

function normalizeSearch(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Busca em item de catálogo pelo nome exibido e pelo nome no outro idioma. */
export function matchesCatalogSearch(
  item: { name?: string | null; altName?: string | null },
  query: string,
): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  if (normalizeSearch(item.name ?? "").includes(q)) return true;
  return item.altName ? normalizeSearch(item.altName).includes(q) : false;
}

export type DbProfile = {
  id: string;
  nickname: string;
  handle: string;
  avatarUrl?: string;
};

async function ensureProfile(): Promise<DbProfile | null> {
  const user = await getViewer();
  if (!user || !supabase) return null;

  // Return from the shared profile cache if a fresh/persisted entry exists
  const cachedProfile = await getUserProfileDb(user.id);
  if (cachedProfile) {
    return {
      id: cachedProfile.id,
      nickname: cachedProfile.nickname,
      handle: cachedProfile.handle ?? cleanHandle(cachedProfile.nickname ?? ""),
      avatarUrl: cachedProfile.photo ?? undefined,
    };
  }

  const email = String(user.email ?? "");
  const emailPrefix = email.includes("@") ? email.split("@")[0] : email;

  const nickname =
    String((user.user_metadata as any)?.full_name ?? "").trim() ||
    emailPrefix ||
    "Você";

  const handle = cleanHandle(
    String((user.user_metadata as any)?.handle ?? "").trim() || emailPrefix,
  );

  const avatarUrl = String(
    (user.user_metadata as any)?.avatar_url ?? "",
  ).trim();

  // Check if profile already exists to avoid overwriting user-edited fields
  const { data: existing } = await supabase
    .from("profiles")
    .select("user_id, nickname, handle, photo")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    // Profile already exists — return it as-is without overwriting user edits
    return {
      id: String(existing.user_id),
      nickname: String(existing.nickname ?? nickname),
      handle: String(existing.handle ?? handle),
      avatarUrl: (existing.photo as string | null) ?? undefined,
    };
  }

  // First time — create the profile with initial values
  const upsertPayload: Record<string, any> = {
    user_id: user.id,
    nickname: nickname,
    handle,
    updated_at: new Date().toISOString(),
  };
  if (avatarUrl) {
    upsertPayload.photo = avatarUrl;
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert(upsertPayload, { onConflict: "user_id" })
    .select("user_id, nickname, handle, photo")
    .maybeSingle();

  if (error) {
    return {
      id: user.id,
      nickname,
      handle,
      avatarUrl: avatarUrl || undefined,
    };
  }

  return {
    id: String(data?.user_id ?? user.id),
    nickname: String(data?.nickname ?? nickname),
    handle: String(data?.handle ?? handle),
    avatarUrl: (data?.photo as string | null) ?? undefined,
  };
}

/**
 * Post incentive types:
 * 1 = "Amei" (Heart)
 * 2 = "Pode mais!" (Flame)
 * 3 = "Vencedor!" (Trophy)
 * 4 = "Evolução!" (TrendingUp)
 * 5 = "Boa execução!" (Dumbbell)
 * 6 = "Intensifique!" (Zap)
 */
export type PostIncentiveType = 1 | 2 | 3 | 4 | 5 | 6;

export type PostLikeStats = {
  apoio: number; // type 1
  continua: number; // type 2
  ganhador: number; // type 3
  consegueMais: number; // type 4
  limiteMaior: number; // type 5
  maisAlgum: number; // type 6
};

export type PostWithLikes = {
  id: string;
  description: string;
  photo: string;
  photos?: string[] | null;
  background_color?: string | null;
  created_at: string;
  user_id: string;
  user_goal_id?: string | null;
  likes: PostLikeStats;
  userLikes: PostIncentiveType[]; // Types the current user has liked with
};

// Debounce store: key = `${postId}:${type}` → { timer, wantActive }
// Delays DB writes by 5 s so that multiple incentives given quickly
// are flushed together, resulting in a single burst of DB inserts and
// therefore a single grouped notification on the recipient's side.
const _incentivePending = new Map<string, { timer: ReturnType<typeof setTimeout>; wantActive: boolean }>();

export function togglePostIncentiveDb(
  postId: string,
  incentiveType: PostIncentiveType,
  wantActive: boolean,
): void {
  if (!hasSupabaseConfig || !supabase) return;

  const key = `${postId}:${incentiveType}`;

  const prev = _incentivePending.get(key);
  if (prev) clearTimeout(prev.timer);

  const timer = setTimeout(async () => {
    _incentivePending.delete(key);
    const viewer = await getViewer();
    if (!viewer) return;

    const { data: existing } = await supabase
      .from("likes")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", viewer.id)
      .eq("type", incentiveType)
      .maybeSingle();

    if (wantActive && !existing?.id) {
      const { error } = await supabase.from("likes").insert({
        post_id: postId,
        user_id: viewer.id,
        type: incentiveType,
      });
      if (error) console.error("Error inserting incentive:", error);
    } else if (!wantActive && existing?.id) {
      const { error } = await supabase.from("likes").delete().eq("id", existing.id);
      if (error) console.error("Error deleting incentive:", error);
    }

    invalidateQueryCache("postLikes");
  }, 5000);

  _incentivePending.set(key, { timer, wantActive });
}

// Flush any pending (debounced) incentive writes for a given post immediately.
// Call this before opening the incentives drawer so the DB reflects the latest state.
export async function flushPendingIncentivesDb(postId: string): Promise<void> {
  const pendingKeys = [..._incentivePending.keys()].filter((k) => k.startsWith(`${postId}:`));
  if (pendingKeys.length === 0) return;

  const viewer = await getViewer();
  if (!viewer) return;

  await Promise.all(
    pendingKeys.map(async (key) => {
      const entry = _incentivePending.get(key);
      if (!entry) return;
      clearTimeout(entry.timer);
      _incentivePending.delete(key);

      const incentiveType = key.split(":")[1];
      const { wantActive } = entry;

      const { data: existing } = await supabase!
        .from("likes")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", viewer.id)
        .eq("type", incentiveType)
        .maybeSingle();

      if (wantActive && !existing?.id) {
        await supabase!.from("likes").insert({ post_id: postId, user_id: viewer.id, type: incentiveType });
      } else if (!wantActive && existing?.id) {
        await supabase!.from("likes").delete().eq("id", existing.id);
      }
    }),
  );

  invalidateQueryCache("postLikes");
}

export async function getPostLikesDb(postId: string): Promise<PostLikeStats> {
  if (!hasSupabaseConfig || !supabase) {
    return { apoio: 0, continua: 0, ganhador: 0, consegueMais: 0, limiteMaior: 0, maisAlgum: 0 };
  }
  return cached(`postLikes:${postId}`, CACHE_TTL_SHORT, async () => {
  // Single query — fetch all likes for this post and count by type in JS
  const { data, error } = await supabase
    .from("likes")
    .select("type")
    .eq("post_id", postId);

  if (error || !data) {
    return { apoio: 0, continua: 0, ganhador: 0, consegueMais: 0, limiteMaior: 0, maisAlgum: 0 };
  }

  const counts = [0, 0, 0, 0, 0, 0];
  for (const row of data) {
    const t = Number(row.type);
    if (t >= 1 && t <= 6) counts[t - 1]++;
  }

  return {
    apoio: counts[0],
    continua: counts[1],
    ganhador: counts[2],
    consegueMais: counts[3],
    limiteMaior: counts[4],
    maisAlgum: counts[5],
  };

  });
}

export async function getUserPostLikesDb(
  postId: string,
): Promise<PostIncentiveType[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const viewer = await getViewer();
  if (!viewer) return [];

  const { data } = await supabase
    .from("likes")
    .select("type")
    .eq("post_id", postId)
    .eq("user_id", viewer.id);

  return (data ?? [])
    .map((row: any) => Number(row.type) as PostIncentiveType)
    .filter((incentiveType): incentiveType is PostIncentiveType =>
      [1, 2, 3, 4, 5, 6].includes(incentiveType),
    );
}

export async function getPostLikeUsersDb(postId: string): Promise<Array<{
  userId: string;
  userNickname: string;
  userPhoto: string | null;
  type: number;
}>> {
  if (!hasSupabaseConfig || !supabase) return [];

  try {
    // Get all likes for the post
    const { data: likesData } = await supabase
      .from("likes")
      .select("user_id, type")
      .eq("post_id", postId)
      .order("created_at", { ascending: false });

    if (!likesData || likesData.length === 0) return [];

    // Get unique user IDs
    const userIds = [...new Set(likesData.map((l: any) => l.user_id))];

    // Fetch user profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nickname, photo")
      .in("user_id", userIds);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

    // Combine likes with user info
    const result = likesData
      .map((like: any) => {
        const profile = profileMap.get(like.user_id);
        return {
          userId: like.user_id,
          userNickname: profile?.nickname ?? "Usuário",
          userPhoto: profile?.photo ?? null,
          type: like.type,
        };
      });

    return result;
  } catch (err: any) {
    console.error("Error fetching post like users:", err);
    return [];
  }
}

// ─── Batch helpers (eliminate N+1 in feed) ──────────────────────────────────

/**
 * Fetch both aggregate like stats AND the current viewer's own likes for
 * multiple posts in a SINGLE query, avoiding two round-trips per feed load.
 */
export async function getPostLikesWithViewerBatchDb(
  postIds: string[],
): Promise<{
  likesMap: Map<string, PostLikeStats>;
  userLikesMap: Map<string, PostIncentiveType[]>;
}> {
  const empty: PostLikeStats = { apoio: 0, continua: 0, ganhador: 0, consegueMais: 0, limiteMaior: 0, maisAlgum: 0 };
  const likesMap = new Map<string, PostLikeStats>();
  const userLikesMap = new Map<string, PostIncentiveType[]>();
  postIds.forEach((id) => {
    likesMap.set(id, { ...empty });
    userLikesMap.set(id, []);
  });
  if (!postIds.length || !hasSupabaseConfig || !supabase) {
    return { likesMap, userLikesMap };
  }

  const viewer = await getViewer();
  const viewerId = viewer?.id ?? null;

  const { data } = await supabase
    .from("likes")
    .select("post_id, type, user_id")
    .in("post_id", postIds);

  const TYPE_KEY: Record<number, keyof PostLikeStats> = {
    1: "apoio", 2: "continua", 3: "ganhador",
    4: "consegueMais", 5: "limiteMaior", 6: "maisAlgum",
  };
  for (const row of data ?? []) {
    const stats = likesMap.get(row.post_id);
    const key = TYPE_KEY[row.type as number];
    if (stats && key) stats[key]++;
    if (viewerId && row.user_id === viewerId) {
      const t = Number(row.type) as PostIncentiveType;
      if ([1, 2, 3, 4, 5, 6].includes(t)) {
        userLikesMap.get(row.post_id)?.push(t);
      }
    }
  }

  return { likesMap, userLikesMap };
}

/**
 * Fetch comment counts for multiple posts in ONE query.
 * Returns a Map<postId, number>.
 */
export async function getCommentCountsBatchDb(
  postIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (!postIds.length || !hasSupabaseConfig || !supabase) {
    postIds.forEach((id) => result.set(id, 0));
    return result;
  }

  const { data } = await supabase
    .from("comments")
    .select("post_id")
    .in("post_id", postIds);

  postIds.forEach((id) => result.set(id, 0));
  for (const row of data ?? []) {
    result.set(row.post_id, (result.get(row.post_id) ?? 0) + 1);
  }

  return result;
}

/**
 * Fetch profiles for multiple user IDs in ONE query.
 * Returns a Map<userId, {nickname, photo}>.
 */
export async function getProfilesBatchDb(
  userIds: string[],
): Promise<Map<string, { nickname: string; photo: string | null; is_verified: boolean }>> {
  const result = new Map<string, { nickname: string; photo: string | null; is_verified: boolean }>();
  if (!userIds.length || !hasSupabaseConfig || !supabase) return result;

  const uniqueIds = [...new Set(userIds)];
  const { data } = await supabase
    .from("profiles")
    .select("user_id, nickname, photo, is_verified")
    .in("user_id", uniqueIds);

  for (const row of data ?? []) {
    result.set(row.user_id, {
      nickname: row.nickname ?? "Usuário",
      photo: row.photo ?? null,
      is_verified: row.is_verified === true,
    });
  }

  return result;
}

// ─── Profile cache ────────────────────────────────────────────────────────
// Profile data rarely changes between visits, so it rides the shared
// cached() helper (memory + localStorage stale-while-revalidate) with a long
// TTL instead of refetching on every screen entry.
export function invalidateProfileCache(userId?: string) {
  invalidateQueryCache(userId ? `userProfile:${userId}` : "userProfile");
}

export type PostComment = {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userHandle: string;
  userPhoto: string | null;
  text: string;
  createdAt: string;
  isVerified?: boolean;
};

export async function addPostCommentDb(postId: string, text: string) {
  if (!hasSupabaseConfig || !supabase) return;

  assertUUID(postId, "ID do post");
  assertNotEmpty(text, "Comentário");
  assertMaxLength(text.trim(), 500, "Comentário");

  const viewer = await getViewer();
  if (!viewer) return;

  const { error } = await supabase.from("comments").insert({
    post_id: postId,
    user_id: viewer.id,
    text: text.trim(),
  });

  if (error) {
    console.error("Error adding comment:", error);
    throw error;
  }

  invalidateQueryCache("postComments");
}

export async function getPostCommentsDb(
  postId: string,
): Promise<PostComment[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  return cached(`postComments:${postId}`, CACHE_TTL_SHORT, async () => {
  const { data, error } = await supabase
    .from("comments")
    .select("id, post_id, user_id, text, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("Error fetching comments:", error);
    return [];
  }

  const rows = data ?? [];
  if (rows.length === 0) return [];

  // Batch-fetch nicknames and handles from profiles for all comment authors
  const userIds = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, nickname, handle, photo, is_verified")
    .in("user_id", userIds);

  const profileMap = new Map(
    (profiles ?? []).map((p: any) => [String(p.user_id), { nickname: String(p.nickname ?? "Usuário"), handle: String(p.handle ?? ""), photo: p.photo ?? null, is_verified: p.is_verified === true }]),
  );

  return rows.map(
    (row: any) => {
      const profile = profileMap.get(String(row.user_id));
      return {
        id: String(row.id),
        postId: String(row.post_id),
        userId: String(row.user_id),
        userName: profile?.nickname ?? String(row.user_name ?? "Usuário"),
        userHandle: profile?.handle ?? "",
        userPhoto: profile?.photo ?? null,
        text: String(row.text ?? ""),
        createdAt: String(row.created_at ?? new Date().toISOString()),
        isVerified: profile?.is_verified ?? false,
      } satisfies PostComment;
    },
  );

  });
}

export async function deletePostCommentDb(commentId: string) {
  if (!hasSupabaseConfig || !supabase) return;

  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId);

  if (error) {
    console.error("Error deleting comment:", error);
    throw error;
  }

  invalidateQueryCache("postComments");
}

export async function updatePostCommentDb(commentId: string, text: string) {
  if (!hasSupabaseConfig || !supabase) return;

  assertNotEmpty(text, "Comentário");
  assertMaxLength(text.trim(), 500, "Comentário");

  const { error } = await supabase
    .from("comments")
    .update({ text: text.trim() })
    .eq("id", commentId);

  if (error) {
    console.error("Error updating comment:", error);
    throw error;
  }

  invalidateQueryCache("postComments");
}

export async function markPostCommentsAsReadDb(postId: string): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  const viewer = await getViewer();
  if (!viewer) return;

  // Get the post to check if user is the owner
  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("user_id")
    .eq("id", postId)
    .maybeSingle();

  if (postError || !post || post.user_id !== viewer.id) return;
}

export type ProgrammedGoal = {
  id: string;
  description: string;
  duration: number; // in days
  quantity: number;
  type: number;
  created_by_user?: number | null; // 1 = user-created, null = default
};

export async function getProgrammedGoalsDb(): Promise<ProgrammedGoal[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  return cached("programmedGoals", CACHE_TTL_STATIC, async () => {
  const { data, error } = await supabase
    .from("goals")
    .select("id, description, duration, quantity, type, created_by_user")
    .eq("created_by_user", 0)
    .order("created_at", { ascending: false });

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error fetching goals [${errorCode}]:`, errorMsg);
    throw new Error(`Falha ao carregar metas: ${errorMsg}`);
  }

  return (data ?? []).map(
    (row: any) =>
      ({
        id: String(row.id),
        description: String(row.description ?? ""),
        duration: Number(row.duration ?? 0),
        quantity: Number(row.quantity ?? 0),
        type: Number(row.type ?? ""),
        created_by_user: row.created_by_user != null ? Number(row.created_by_user) : null,
      }) satisfies ProgrammedGoal,
  );

  });
}

export async function createCustomGoalAndSelectDb(
  userId: string,
  description: string,
  type: number,
  duration: number,
  quantity: number,
): Promise<string> {
  if (!hasSupabaseConfig || !supabase) throw new Error("Supabase não configurado");

  assertUUID(userId, "ID do usuário");
  assertNotEmpty(description, "Descrição da meta");
  assertMaxLength(description.trim(), 200, "Descrição da meta");
  if (duration <= 0 || duration > 3650) throw new Error("Duração inválida (1–3650 dias)");
  if (quantity <= 0 || quantity > 100000) throw new Error("Quantidade inválida");

  // Insert goal and link to user in a sequential but validated chain
  const { data, error } = await supabase
    .from("goals")
    .insert({ description: description.trim(), type, duration, quantity, created_by_user: 1 })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating custom goal:", error);
    throw error;
  }

  const goalId = String(data.id);

  try {
    await createUserGoalDb(goalId, userId, type, duration, quantity);
  } catch (linkError) {
    // Attempt to clean up the orphaned goal if linking fails
    try { await supabase.from("goals").delete().eq("id", goalId); } catch { /* ignore */ }
    throw linkError;
  }

  invalidateQueryCache("programmedGoals"); invalidateQueryCache("userGoals"); invalidateQueryCache("selectedGoalIds");
  return goalId;
}

export async function createUserGoalDb(
  goalId: string,
  userId: string,
  typeGoal: string | number,
  duration: number,
  quantity: number,
) {
  if (!hasSupabaseConfig || !supabase) return;

  const { error } = await supabase.from("user_goals").insert({
    goal_id: goalId,
    user_id: userId,
    type_goal: typeGoal,
    duration,
    quantity,
    visibility: 1, // Default to visible
  });

  if (error) {
    console.error("Error creating user goal:", error);
    throw error;
  }


  invalidateQueryCache("userGoals"); invalidateQueryCache("selectedGoalIds");
}

export async function updateUserGoalDb(
  userGoalId: string,
  updates: {
    duration?: number;
    quantity?: number;
    days_completed?: number;
    perc?: number;
    visibility?: number;
  },
) {
  if (!hasSupabaseConfig || !supabase) return;

  const updateData: any = {};

  // Copy duration and quantity as-is
  if (updates.duration !== undefined) updateData.duration = updates.duration;
  if (updates.quantity !== undefined) updateData.quantity = updates.quantity;
  if (updates.days_completed !== undefined)
    updateData.days_completed = updates.days_completed;
  if (updates.visibility !== undefined)
    updateData.visibility = updates.visibility;

  // For perc: use provided value, or calculate from days_completed if available
  if (updates.perc !== undefined) {
    updateData.perc = Math.round(updates.perc);
  }

  const { error } = await supabase
    .from("user_goals")
    .update(updateData)
    .eq("id", userGoalId);

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error updating user goal [${errorCode}]:`, {
      message: errorMsg,
      userGoalId,
      updates: updateData,
    });
    throw new Error(`Failed to update goal: ${errorMsg}`);
  }
  invalidateQueryCache("userGoals");
}

export async function deleteUserGoalDb(userGoalId: string) {
  if (!hasSupabaseConfig || !supabase) return;

  // Check if the linked goal was created by the user (custom goal) — if so, delete it too
  const { data: userGoalRow } = await supabase
    .from("user_goals")
    .select("goal_id")
    .eq("id", userGoalId)
    .maybeSingle();

  const { error } = await supabase
    .from("user_goals")
    .delete()
    .eq("id", userGoalId);

  if (error) {
    console.error("Error deleting user goal:", error);
    throw error;
  }

  // If the goal was user-created, remove it from the goals table as well
  if (userGoalRow?.goal_id) {
    const { data: goalRow } = await supabase
      .from("goals")
      .select("id, created_by_user")
      .eq("id", userGoalRow.goal_id)
      .maybeSingle();

    if (goalRow?.created_by_user === 1) {
      await supabase.from("goals").delete().eq("id", userGoalRow.goal_id);
    }
  }

  invalidateQueryCache("userGoals"); invalidateQueryCache("selectedGoalIds");
}

export type UserGoal = {
  id: string;
  goal_id: string;
  description: string;
  duration: number;
  quantity: number;
  type_goal: number;
  perc: number;
  days_completed: number;
  visibility: number;
};

export async function getGoalByIdDb(goalId: string): Promise<UserGoal | null> {
  if (!hasSupabaseConfig || !supabase) return null;
  assertUUID(goalId, "ID da meta");

  const { data, error } = await supabase
    .from("goals")
    .select("id, description, duration, quantity, type")
    .eq("id", goalId)
    .maybeSingle();

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error fetching goal [${errorCode}]:`, errorMsg);
    return null;
  }

  if (!data) return null;

  return {
    id: String(data.id),
    goal_id: String(data.id),
    description: String(data.description ?? ""),
    duration: Number(data.duration ?? 0),
    quantity: Number(data.quantity ?? 0),
    type_goal: Number(data.type ?? 0),
    perc: 0,
    days_completed: 0,
    visibility: 1,
  };
}

export async function getUserGoalsByUserIdDb(
  userId: string,
): Promise<UserGoal[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const mapRows = (rows: any[], descMap: Map<string, string>): UserGoal[] =>
    rows.map((row: any) => {
      const quantity = Number(row.quantity ?? 0);
      const perc = Number(row.perc ?? 0);
      const days_completed = row.days_completed != null
        ? Number(row.days_completed)
        : Math.round((perc / 100) * quantity);
      return {
        id: String(row.id),
        goal_id: String(row.goal_id ?? ""),
        description: descMap.get(String(row.goal_id)) ?? String((row.goals as any)?.description ?? ""),
        duration: Number(row.duration ?? 0),
        quantity,
        type_goal: Number(row.type_goal ?? 0),
        perc,
        days_completed,
        visibility: Number(row.visibility ?? 1),
      } satisfies UserGoal;
    });

  // Grava a cópia offline a cada leitura bem-sucedida (network-first)
  const finish = (rows: UserGoal[]): UserGoal[] => {
    offlineCopyWrite(`userGoals:${userId}`, rows);
    return rows;
  };

  // Try with embedded join first
  const { data, error } = await supabase
    .from("user_goals")
    .select("id, goal_id, duration, quantity, type_goal, perc, days_completed, visibility, goals(description)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!error) {
    return finish(mapRows(data ?? [], new Map()));
  }

  // Fallback (any error): fetch without join + manual batch lookup
  console.warn(`[getUserGoalsByUserIdDb] Join failed (${error.code}), using fallback`);
  const { data: fallback, error: fbError } = await supabase
    .from("user_goals")
    .select("id, goal_id, duration, quantity, type_goal, perc, days_completed, visibility")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (fbError) {
    console.error(`Error fetching user goals [${fbError.code}]:`, fbError.message);
    // Sem rede: serve a última cópia local em vez de esconder as metas
    if (isTransientNetworkError(fbError)) {
      const off = offlineCopyRead<UserGoal[]>(`userGoals:${userId}`);
      if (off) return off;
    }
    return [];
  }

  const goalIds = (fallback ?? []).map((r: any) => r.goal_id).filter(Boolean);
  const descMap = new Map<string, string>();
  if (goalIds.length > 0) {
    const { data: goalsData } = await supabase.from("goals").select("id, description").in("id", goalIds);
    (goalsData ?? []).forEach((g: any) => descMap.set(String(g.id), String(g.description ?? "")));
  }

  return finish(mapRows(fallback ?? [], descMap));
}

export async function getUserGoalsDb(): Promise<UserGoal[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  // Viewer resolvido FORA do cached(): com viewer null (logo após o login ou
  // falha transitória de auth) retornamos vazio SEM gravar no cache — antes,
  // o vazio era persistido e servido por até 24h (stale-while-revalidate).
  const viewer = await getViewer();
  if (!viewer) {
    // Offline com token expirado: getSession() falha e o viewer vem null mesmo
    // com um usuário local. Serve a cópia offline do dono do aparelho — no
    // sign-out real ela é purgada, então não há risco de vazar dados de outro.
    const ownerId = getOfflineOwnerId();
    if (ownerId) {
      const off = offlineCopyRead<UserGoal[]>(`userGoals:${ownerId}`);
      if (off) return off;
    }
    return [];
  }
  return cached(`userGoals:${viewer.id}`, CACHE_TTL_OWN, async () => {
  return getUserGoalsByUserIdDb(viewer.id);

  });
}

export async function getUserGoalByIdDb(
  userGoalId: string,
): Promise<UserGoal | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  const buildGoal = (row: any, description: string): UserGoal => {
    const quantity = Number(row.quantity ?? 0);
    const perc = Number(row.perc ?? 0);
    const days_completed = row.days_completed != null
      ? Number(row.days_completed)
      : Math.round((perc / 100) * quantity);
    return {
      id: String(row.id),
      goal_id: String(row.goal_id ?? ""),
      description,
      duration: Number(row.duration ?? 0),
      quantity,
      type_goal: Number(row.type_goal ?? 0),
      perc,
      days_completed,
      visibility: Number(row.visibility ?? 1),
    };
  };

  // Try with embedded join first
  const { data, error } = await supabase
    .from("user_goals")
    .select("id, goal_id, duration, quantity, type_goal, perc, days_completed, visibility, goals(description)")
    .eq("id", userGoalId)
    .maybeSingle();

  if (!error) {
    if (!data) return null;
    return buildGoal(data, String((data.goals as any)?.description ?? ""));
  }

  // Fallback (any error): two sequential queries
  console.warn(`[getUserGoalByIdDb] Join failed (${error.code}), using fallback`);
  const { data: fb } = await supabase
    .from("user_goals")
    .select("id, goal_id, duration, quantity, type_goal, perc, days_completed, visibility")
    .eq("id", userGoalId)
    .maybeSingle();
  if (!fb) return null;
  const { data: goalData } = await supabase.from("goals").select("description").eq("id", fb.goal_id).maybeSingle();
  return buildGoal(fb, String(goalData?.description ?? ""));
}

// Caminho online puro (lança erro de rede) — usado pela função pública e pelo
// replay da fila offline, que passa a DATA ORIGINAL da execução. `progressDate`
// permite replays de dias passados sem distorcer a regra de "1x por dia".
async function applyGoalProgressOnlineDb(
  userGoalId: string,
  progressDate: string,
  viewerId: string,
): Promise<UserGoal | null> {
  const { data: currentData, error: fetchError } = await supabase!
    .from("user_goals")
    .select("days_completed, duration, last_progress_date")
    .eq("id", userGoalId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!currentData) return null;

  // Já foi incrementada neste dia (por qualquer rotina vinculada) — só a primeira conta
  if (currentData.last_progress_date === progressDate) return null;

  const currentDaysCompleted = Number(currentData.days_completed ?? 0);
  const duration = Number(currentData.duration ?? 1);
  const newDaysCompleted = Math.min(currentDaysCompleted + 1, duration);

  // Calculate percentage for perc field based on the NEW value
  const perc = duration > 0 ? (newDaysCompleted / duration) * 100 : 0;

  // Nunca regride last_progress_date: um replay de segunda-feira depois de um
  // treino online de terça soma o dia, mas mantém a data mais recente (senão a
  // regra de 1x/dia deixaria terça contar de novo).
  const currentLast = currentData.last_progress_date ? String(currentData.last_progress_date) : "";
  const newLastDate = currentLast > progressDate ? currentLast : progressDate;

  const { data, error } = await supabase!
    .from("user_goals")
    .update({ days_completed: newDaysCompleted, perc: Math.round(perc), last_progress_date: newLastDate })
    .eq("id", userGoalId)
    .eq("user_id", viewerId)
    .select("id, goal_id, duration, quantity, type_goal, days_completed, perc, visibility")
    .maybeSingle();

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error updating goal progress [${errorCode}]:`, errorMsg);
    throw error;
  }

  if (!data) return null;

  invalidateQueryCache("userGoals");

  // A descrição NÃO vive em user_goals — vem do catálogo `goals` por join, e o
  // update acima não a retorna. Quem consome este retorno mostra o nome da meta
  // (diálogo de meta concluída e legenda do compartilhamento), então relemos a
  // linha pelo getUserGoalByIdDb, que já trata o join e seu fallback.
  const withDescription = await getUserGoalByIdDb(userGoalId);
  if (withDescription?.description) return withDescription;

  // Sem descrição (falha na releitura): ainda devolvemos o progresso, para o
  // caller não perder o "meta concluída".
  return {
    id: String(data.id),
    goal_id: String(data.goal_id ?? ""),
    description: withDescription?.description ?? "",
    duration: Number(data.duration ?? 0),
    quantity: Number(data.quantity ?? 0),
    type_goal: Number(data.type_goal ?? 0),
    perc: Number(data.perc ?? Math.round(perc)),
    days_completed: newDaysCompleted,
    visibility: Number(data.visibility ?? 1),
  };
}

export async function incrementGoalProgressDb(
  userGoalId: string,
  progressDate?: string,
): Promise<UserGoal | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  const date = progressDate ?? new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // Offline: incrementa otimisticamente a cópia local das metas (a barra de
  // progresso e o diálogo de "meta concluída" funcionam na hora) e enfileira o
  // incremento com a data de hoje. O dedupe local (goalProgressDates) replica a
  // regra de 1x/dia; o replay ainda revalida no servidor.
  const offlineIncrement = (): UserGoal | null => {
    const ownerId = getOfflineOwnerId();
    if (!ownerId) return null;
    const marksKey = `goalProgressDates:${ownerId}`;
    const marks = offlineCopyRead<Record<string, string>>(marksKey) ?? {};
    if (marks[userGoalId] === date) return null;
    let updated: UserGoal | null = null;
    offlineCopyPatch<UserGoal[]>(`userGoals:${ownerId}`, (goals) =>
      goals.map((g) => {
        if (g.id !== userGoalId) return g;
        const duration = g.duration > 0 ? g.duration : 1;
        const days = Math.min((g.days_completed ?? 0) + 1, duration);
        updated = { ...g, days_completed: days, perc: Math.round((days / duration) * 100) };
        return updated;
      }),
    );
    if (!updated) return null; // meta fora da cópia local — sem base para o otimismo
    enqueueOutbox("goal_progress", { userGoalId, date });
    offlineCopyWrite(marksKey, { ...marks, [userGoalId]: date });
    invalidateQueryCache("userGoals");
    return updated;
  };

  if (isLikelyOffline()) return offlineIncrement();

  const viewer = await getViewer();
  if (!viewer) return null;

  try {
    const result = await applyGoalProgressOnlineDb(userGoalId, date, viewer.id);
    // Marca o dia também no dedupe local — se o usuário ficar offline logo em
    // seguida e concluir outra rotina da mesma meta, não soma duas vezes.
    if (result) {
      offlineCopyPatch<Record<string, string>>(
        `goalProgressDates:${viewer.id}`,
        (m) => ({ ...m, [userGoalId]: date }),
        {},
      );
    }
    return result;
  } catch (err: any) {
    if (isOfflineWriteError(err)) return offlineIncrement();
    const errorMsg = err?.message || String(err);
    console.error("Error updating goal progress:", errorMsg);
    throw new Error(`Erro ao atualizar progresso: ${errorMsg}`);
  }
}

export async function getUserSelectedGoalIdsDb(): Promise<string[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  const viewer = await getViewer();
  if (!viewer) return [];
  return cached(`selectedGoalIds:${viewer.id}`, CACHE_TTL_OWN, async () => {

  const { data, error } = await supabase
    .from("user_goals")
    .select("goal_id")
    .eq("user_id", viewer.id);

  if (error) {
    console.error("Error fetching user selected goal IDs:", error);
    return [];
  }

  return (data ?? []).map((row: any) => String(row.goal_id ?? ""));

  });
}

export type UserProfile = {
  id: string;
  nickname: string;
  bio: string;
  photo: string | null;
  cover_photo?: string | null;
  objectives?: string[] | null;
  handle?: string;
  height?: string | null;
  weight?: string | null;
  age?: string | null;
  /**
   * Sexo biológico informado no cadastro ("male" | "female" | "other").
   * Usado pelo gerador de rotina sugerida para ajustar faixa de repetições e
   * descanso (ver `client/lib/coach-profile.ts`).
   */
  gender?: string | null;
  is_verified?: boolean;
  /** Oculta listas de seguidores/seguindo de outros usuários */
  hide_follow_lists?: boolean;
  /** Oculta posts para quem não segue o usuário */
  hide_posts_from_non_followers?: boolean;
};

export async function getUserProfileDb(
  userId: string,
): Promise<UserProfile | null> {
  if (!hasSupabaseConfig || !supabase) return null;
  assertUUID(userId, "ID do usuário");

  return cached(`userProfile:${userId}`, CACHE_TTL_LONG, async () => {
    const { data, error } = await supabase!
      .from("profiles")
      .select("id, nickname, bio, photo, cover_photo, objectives, height, weight, age, gender, handle, is_verified, hide_follow_lists, hide_posts_from_non_followers")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      const errorMsg = error?.message || String(error);
      const errorCode = error?.code || "UNKNOWN";
      console.error(`Error fetching user profile [${errorCode}]:`, errorMsg);
      return null;
    }

    if (!data) return null;

    const profile: UserProfile = {
      id: String(data.id ?? ""),
      nickname: String(data.nickname ?? ""),
      bio: String(data.bio ?? ""),
      photo: data.photo ? String(data.photo) : null,
      cover_photo: data.cover_photo ? String(data.cover_photo) : null,
      objectives: data.objectives ?? null,
      handle: data.handle ? String(data.handle) : undefined,
      height: data.height != null ? String(data.height) : null,
      weight: data.weight != null ? String(data.weight) : null,
      age: data.age != null ? String(data.age) : null,
      // A coluna aceita texto ou array (o cadastro grava texto) — normaliza.
      gender: data.gender != null
        ? String(Array.isArray(data.gender) ? data.gender[0] ?? "" : data.gender)
        : null,
      is_verified: data.is_verified === true,
      hide_follow_lists: data.hide_follow_lists === true,
      hide_posts_from_non_followers: data.hide_posts_from_non_followers === true,
    };

    return profile;
  });
}

// ── Premium (subscriptions) ─────────────────────────────────────────────────
//
// O status vive na tabela `subscriptions`, que NÃO tem policy de escrita para
// o usuário — só o service role escreve (SQL manual na Fase 1, webhook do
// RevenueCat na Fase 2). A leitura passa pela RPC is_premium(uid), que também
// servirá para RLS futura. Ver docs/migrations/20260715-premium-plan.sql.

/** Retorna se o usuário logado é assinante premium ativo. */
export async function getPremiumStatusDb(): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;
  const viewer = await getViewer();
  // Viewer nulo nunca entra no cache (mesma regra de getViewer): logo após o
  // login uma resposta "false" cacheada esconderia o premium por 60s.
  if (!viewer) return false;

  try {
    // TTL_MEDIUM: quem escreve o status é um terceiro (service role/webhook),
    // o app não tem como invalidar na hora — o TTL é a defesa contra dado velho.
    return await cached(`premium:${viewer.id}`, CACHE_TTL_MEDIUM, async () => {
      const { data, error } = await supabase!.rpc("is_premium", {
        uid: viewer.id,
      });
      if (error) throw error;
      return data === true;
    });
  } catch (err) {
    console.error("Error fetching premium status:", err);
    return false;
  }
}

/** Força releitura do status premium (ex: após restaurar compra na Fase 2). */
export async function invalidatePremiumStatus(): Promise<void> {
  const viewer = await getViewer();
  if (viewer) invalidateQueryCache(`premium:${viewer.id}`);
}

export type Subscription = {
  // ─── Assinatura paga — escrito SÓ pelo webhook do RevenueCat ─────────────
  status: string;            // 'active' | 'inactive' | 'expired' | 'cancelled'
  product_id: string | null; // product id do RevenueCat
  store: string | null;      // 'app_store'
  /** Fim do período pago. NULL quando nunca houve assinatura paga. */
  current_period_end: string | null;

  // ─── Cortesia do admin — escrito SÓ por admin_set_premium() ──────────────
  // Conjunto de colunas DISJUNTO do de cima, para que uma renovação do
  // RevenueCat não apague a liberação manual (e vice-versa).
  /** Acesso concedido manualmente pelo admin. */
  manual_active: boolean;
  /** Fim da cortesia. NULL com manual_active = true → permanente. */
  manual_until: string | null;

  created_at: string;
  updated_at: string;
};

/**
 * Detalhes da assinatura do usuário logado (tela "Gerenciar assinatura").
 * A policy `subscriptions_select_own` permite ler só a própria linha; quem nunca
 * teve assinatura não tem linha — daí o null.
 *
 * Sem cache de propósito: é lida ao abrir o drawer (raro) e mostrar status/data
 * de cobrança velhos é pior que um round-trip. `getPremiumStatusDb` cacheia
 * porque roda em todo gate.
 */
export async function getSubscriptionDb(): Promise<Subscription | null> {
  if (!hasSupabaseConfig || !supabase) return null;
  const viewer = await getViewer();
  if (!viewer) return null;

  try {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("status, product_id, store, current_period_end, manual_active, manual_until, created_at, updated_at")
      .eq("user_id", viewer.id)
      .maybeSingle();
    if (error) throw error;
    return (data as Subscription) ?? null;
  } catch (err) {
    console.error("Error fetching subscription:", err);
    throw err;
  }
}

export async function updateUserProfileDb(
  userId: string,
  updates: { nickname?: string; bio?: string; photo?: string | null; cover_photo?: string | null; height?: number | null; weight?: number | null; age?: number | null; handle?: string; objectives?: string[] | null; hide_follow_lists?: boolean; hide_posts_from_non_followers?: boolean },
): Promise<UserProfile | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  // Invalidate cache for this user so next read gets fresh data
  invalidateProfileCache(userId);

  // Avatar/capa antigos, para apagar do Storage depois da troca. Cada upload
  // grava um caminho novo (`profile-{ts}.jpg`, `covers/{uid}-{ts}.jpg`) para o
  // CDN não servir a versão velha na mesma URL — sem esta limpeza, toda edição
  // de foto deixava um arquivo para trás. Só lê quando a chave veio no update:
  // `undefined` = campo não tocado, `null` = usuário removeu a foto.
  const touchesPhoto = "photo" in updates;
  const touchesCover = "cover_photo" in updates;
  let previous: { photo: string | null; cover_photo: string | null } | null = null;
  if (touchesPhoto || touchesCover) {
    const { data: prev } = await supabase
      .from("profiles")
      .select("photo, cover_photo")
      .eq("user_id", userId)
      .maybeSingle();
    previous = (prev as any) ?? null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("user_id", userId)
    .select("id, nickname, bio, photo, cover_photo, objectives, handle, height, weight, age, is_verified, hide_follow_lists, hide_posts_from_non_followers")
    .maybeSingle();

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error updating user profile [${errorCode}]:`, errorMsg);
    // 23505 = unique_violation → o handle escolhido já pertence a outra pessoa.
    if (errorCode === "23505" && errorMsg.toLowerCase().includes("handle")) {
      throw new Error("Esse @usuário já está em uso. Escolha outro.");
    }
    throw new Error(`Erro ao atualizar perfil: ${errorMsg}`);
  }

  if (!data) return null;

  // Update confirmado — agora é seguro apagar o arquivo substituído.
  if (touchesPhoto) await removeReplacedMedia(previous?.photo, data.photo as string | null);
  if (touchesCover) await removeReplacedMedia(previous?.cover_photo, data.cover_photo as string | null);

  invalidateQueryCache("userStats");
  invalidateQueryCache("allUsers");

  return {
    id: String(data.id ?? ""),
    nickname: String(data.nickname ?? ""),
    bio: String(data.bio ?? ""),
    photo: data.photo ? String(data.photo) : null,
    cover_photo: data.cover_photo ? String(data.cover_photo) : null,
    objectives: data.objectives ?? null,
    handle: data.handle ? String(data.handle) : undefined,
    height: data.height != null ? String(data.height) : null,
    weight: data.weight != null ? String(data.weight) : null,
    age: data.age != null ? String(data.age) : null,
    is_verified: data.is_verified === true,
    hide_follow_lists: data.hide_follow_lists === true,
    hide_posts_from_non_followers: data.hide_posts_from_non_followers === true,
  };
}

export async function updateUserPersonalDataDb(
  userId: string,
  data: { height?: string; weight?: string; age?: string; gender?: string },
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  const updates: Record<string, string | number | null> = {};
  if (data.height !== undefined) updates.height = data.height ? parseInt(data.height, 10) : null;
  if (data.weight !== undefined) updates.weight = data.weight ? parseFloat(data.weight) : null;
  if (data.age !== undefined) updates.age = data.age ? parseInt(data.age, 10) : null;
  if (data.gender !== undefined) updates.gender = data.gender || null;

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("user_id", userId);

  if (error) {
    const errorMsg = error?.message || String(error);
    console.error("Error updating personal data:", errorMsg);
    throw new Error(`Erro ao salvar dados pessoais: ${errorMsg}`);
  }

  invalidateProfileCache(userId);
  invalidateQueryCache("userStats");
  invalidateQueryCache("allUsers");
}

export type PostWithUser = {
  id: string;
  description: string;
  photo: string;
  photos?: string[] | null;
  created_at: string;
  user_id: string;
  user_goal_id?: string | null;
  userNickname: string;
  userPhoto: string | null;
  isVerified?: boolean;
  workoutSummary?: PostWorkoutSummary | null;
  taggedUsers?: SearchUser[];
};

export async function getUserPostsDb(userId: string): Promise<PostWithUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  return cached(`userPosts:${userId}`, CACHE_TTL_SHORT, async () => {
  // Fetch posts and the author's profile in parallel — the profile lookup used
  // to run sequentially after the posts query, adding a needless round-trip.
  const [postsRes, userProfile] = await Promise.all([
    supabase
      .from("posts")
      .select("id, description, photo, photos, created_at, user_id, user_goal_id, workout_summary")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
    getUserProfileDb(userId),
  ]);
  const { data, error } = postsRes;

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error fetching user posts [${errorCode}]:`, errorMsg);
    return [];
  }

  const userNickname = userProfile?.nickname || "Usuário";
  const userPhoto = userProfile?.photo || null;
  const isVerified = userProfile?.is_verified === true;

  return (data ?? []).map((row: any) => ({
    id: String(row.id ?? ""),
    description: String(row.description ?? ""),
    photo: String(row.photo ?? ""),
    photos: Array.isArray(row.photos) ? row.photos : null,
    created_at: String(row.created_at ?? ""),
    user_id: String(row.user_id ?? ""),
    userNickname,
    userPhoto,
    isVerified,
    workoutSummary: (row.workout_summary as PostWorkoutSummary | null) ?? null,
  }));

  });
}

export async function getPostByIdDb(postId: string): Promise<PostWithUser | null> {
  if (!hasSupabaseConfig || !supabase) return null;
  return cached(`post:${postId}`, CACHE_TTL_SHORT, async () => {
  assertUUID(postId, "ID do post");

  const { data, error } = await supabase
    .from("posts")
    .select("id, description, photo, photos, created_at, user_id, user_goal_id, workout_summary")
    .eq("id", postId)
    .maybeSingle();

  if (error || !data) return null;

  const [userProfile, tagsMap] = await Promise.all([
    getUserProfileDb(String(data.user_id)),
    getPostTagsBatchDb([String(data.id)]),
  ]);
  return {
    id: String(data.id),
    description: String(data.description ?? ""),
    photo: String(data.photo ?? ""),
    photos: Array.isArray(data.photos) ? data.photos : null,
    created_at: String(data.created_at ?? ""),
    user_id: String(data.user_id),
    user_goal_id: data.user_goal_id ?? null,
    userNickname: userProfile?.nickname || "Usuário",
    userPhoto: userProfile?.photo || null,
    isVerified: userProfile?.is_verified === true,
    workoutSummary: (data.workout_summary as PostWorkoutSummary | null) ?? null,
    taggedUsers: tagsMap.get(String(data.id)) ?? [],
  };

  });
}

// Um resultado de hashtag pode vir do feed (post) ou dos Shots (vídeo). O `kind`
// diz qual, já que cada um tem miniatura e destino de navegação próprios.
export type HashtagItem = {
  kind: "post" | "shot";
  id: string;
  photo: string;
  photos: string[] | null;
  video_url: string | null;
  description: string;
  created_at: string;
  user_id: string;
};

// Busca posts E shots que contenham a hashtag (#tag) na descrição — as duas
// superfícies têm legenda com hashtag clicável, então ambas precisam aparecer.
// O filtro do banco é amplo (ILIKE %#tag%) e refinado no cliente por regex com
// fronteira de palavra, para "#fit" não casar com "#fitness". As duas fontes são
// intercaladas por data, do mais recente para o mais antigo.
export async function searchContentByHashtagDb(tag: string): Promise<HashtagItem[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  const clean = tag.replace(/^#/, "").trim();
  if (!clean) return [];

  const [postsRes, shotsRes] = await Promise.all([
    supabase
      .from("posts")
      .select("id, photo, photos, description, created_at, user_id")
      .ilike("description", `%#${clean}%`)
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("shots")
      .select("id, video_url, description, created_at, user_id")
      .ilike("description", `%#${clean}%`)
      .not("video_url", "is", null)
      .neq("video_url", "")
      .order("created_at", { ascending: false })
      .limit(120),
  ]);

  const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`#${escaped}(?![\\p{L}\\p{N}_])`, "iu");
  const matches = (row: any) => typeof row.description === "string" && re.test(row.description);

  // Uma fonte falhar não pode zerar a outra — cada lado degrada sozinho.
  const posts: HashtagItem[] = (postsRes.error ? [] : (postsRes.data ?? []))
    .filter(matches)
    .map((p: any) => ({
      kind: "post" as const,
      id: String(p.id),
      photo: String(p.photo ?? ""),
      photos: Array.isArray(p.photos) ? p.photos : null,
      video_url: null,
      description: String(p.description ?? ""),
      created_at: String(p.created_at ?? ""),
      user_id: String(p.user_id),
    }));

  const shots: HashtagItem[] = (shotsRes.error ? [] : (shotsRes.data ?? []))
    .filter(matches)
    .map((s: any) => ({
      kind: "shot" as const,
      id: String(s.id),
      photo: "",
      photos: null,
      video_url: String(s.video_url ?? ""),
      description: String(s.description ?? ""),
      created_at: String(s.created_at ?? ""),
      user_id: String(s.user_id),
    }));

  return [...posts, ...shots].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

// ── Marcação de pessoas em posts (post_tags) ────────────────────────────────

// Busca em lote as pessoas marcadas de vários posts (feed) — 2 queries no total.
// Retorna Map<postId, SearchUser[]>; posts sem marcação não aparecem no Map.
export async function getPostTagsBatchDb(
  postIds: string[],
): Promise<Map<string, SearchUser[]>> {
  const result = new Map<string, SearchUser[]>();
  if (!postIds.length || !hasSupabaseConfig || !supabase) return result;

  try {
    const { data: tagRows, error } = await supabase
      .from("post_tags")
      .select("post_id, user_id, created_at")
      .in("post_id", postIds)
      .order("created_at", { ascending: true });

    // Tabela pode ainda não existir (migração pendente) — degrada sem marcações
    if (error || !tagRows || tagRows.length === 0) return result;

    const taggedIds = [...new Set(tagRows.map((r: any) => String(r.user_id)))];
    const profilesMap = await getProfilesBatchDb(taggedIds);

    for (const row of tagRows) {
      const postId = String(row.post_id);
      const userId = String(row.user_id);
      const profile = profilesMap.get(userId);
      if (!profile) continue;
      if (!result.has(postId)) result.set(postId, []);
      result.get(postId)!.push({
        id: userId,
        nickname: profile.nickname,
        photo: profile.photo,
      });
    }
  } catch (err) {
    console.error("Error fetching post tags:", err);
  }
  return result;
}

// Posts de OUTRAS pessoas em que `userId` foi marcado — alimenta a aba
// "Marcações" do perfil. Não são posts do usuário: o autor de cada um é outra
// pessoa, então os perfis dos autores vêm em lote (2 queries no total).
export async function getTaggedPostsDb(userId: string): Promise<PostWithUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  return cached(`taggedPosts:${userId}`, CACHE_TTL_SHORT, async () => {
    const { data: tagRows, error: tagsError } = await supabase
      .from("post_tags")
      .select("post_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    // Tabela pode ainda não existir (migração pendente) — degrada como aba vazia
    if (tagsError || !tagRows || tagRows.length === 0) return [];

    const postIds = [...new Set(tagRows.map((r: any) => String(r.post_id)))];

    const { data, error } = await supabase
      .from("posts")
      .select("id, description, photo, photos, created_at, user_id, user_goal_id, workout_summary")
      .in("id", postIds)
      .order("created_at", { ascending: false });

    if (error) {
      const errorMsg = error?.message || String(error);
      const errorCode = error?.code || "UNKNOWN";
      console.error(`Error fetching tagged posts [${errorCode}]:`, errorMsg);
      return [];
    }

    const rows = data ?? [];
    const authorsMap = await getProfilesBatchDb(rows.map((r: any) => String(r.user_id)));

    return rows.map((row: any) => {
      const author = authorsMap.get(String(row.user_id));
      return {
        id: String(row.id ?? ""),
        description: String(row.description ?? ""),
        photo: String(row.photo ?? ""),
        photos: Array.isArray(row.photos) ? row.photos : null,
        created_at: String(row.created_at ?? ""),
        user_id: String(row.user_id ?? ""),
        user_goal_id: row.user_goal_id ?? null,
        userNickname: author?.nickname || "Usuário",
        userPhoto: author?.photo ?? null,
        isVerified: author?.is_verified === true,
        workoutSummary: (row.workout_summary as PostWorkoutSummary | null) ?? null,
      };
    });
  });
}

// Substitui as marcações de um post (edição) — aplica o diff em vez de recriar
// tudo: remove quem saiu e insere só os novos, para a trigger notify_post_tag
// notificar apenas quem acabou de ser marcado (sem re-notificar os existentes).
export async function setPostTagsDb(
  postId: string,
  taggedUserIds: string[],
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) throw new Error("Supabase não configurado");

  const viewer = await getViewer();
  if (!viewer) throw new Error("Usuário não autenticado");

  const wanted = [...new Set(taggedUserIds.filter((id) => id && id !== viewer.id))];

  const { data: currentRows, error } = await supabase
    .from("post_tags")
    .select("user_id")
    .eq("post_id", postId);
  if (error) throw error;

  const current = new Set((currentRows ?? []).map((r: any) => String(r.user_id)));
  const toAdd = wanted.filter((id) => !current.has(id));
  const toRemove = [...current].filter((id) => !wanted.includes(id));

  if (toRemove.length > 0) {
    const { error: delError } = await supabase
      .from("post_tags")
      .delete()
      .eq("post_id", postId)
      .in("user_id", toRemove);
    if (delError) throw delError;
  }

  if (toAdd.length > 0) {
    const { error: insError } = await supabase
      .from("post_tags")
      .insert(toAdd.map((userId) => ({ post_id: postId, user_id: userId })));
    if (insError) throw insError;
  }

  invalidateQueryCache(`post:${postId}`);
  // A aba "Marcações" do perfil de quem entrou/saiu da marcação muda com isso
  if (toAdd.length > 0 || toRemove.length > 0) invalidateQueryCache("taggedPosts");
}

export type UserStats = {
  postsCount: number;
  followersCount: number;
  followingCount: number;
  points: number;
  level: number;
};

function resolveWorkoutPhotoUrl(photo: string | null | undefined, wgerId?: number | null): string | null {
  if (!photo && !wgerId) return null;
  if (photo?.startsWith("http")) return photo;
  if (!supabase) return null;
  // Old wger.de path (/media/exercise-images/...) or any non-http value:
  // map to the exercises bucket using wger_id + original extension
  if (wgerId) {
    const ext = photo ? (photo.match(/\.(\w+)$/) ?? [])[1] ?? "jpg" : "jpg";
    const { data } = supabase.storage.from("exercises").getPublicUrl(`exercises/${wgerId}.${ext}`);
    return data?.publicUrl ?? null;
  }
  // Relative path without wger_id — try exercises bucket as-is
  const { data } = supabase.storage.from("exercises").getPublicUrl(photo!);
  return data?.publicUrl ?? null;
}

export async function getWorkoutsDb(): Promise<Workout[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  const viewer = await getViewer();
  const userId = viewer?.id ?? null;
  return cached(`workouts:${getUiLanguage()}:${userId ?? "anon"}`, CACHE_TTL_STATIC, async () => {
  const mapRow = (row: any): Workout => ({
    id: String(row.id ?? ""),
    name: pickLocalized(row.name, row.name_eng),
    altName: altLocalized(row.name, row.name_eng),
    description: pickLocalized(row.description, row.description_eng),
    photo: resolveWorkoutPhotoUrl(row.photo, row.wger_id),
    muscle_group: row.muscle_group ? String(row.muscle_group) : null,
    type: row.type != null ? Number(row.type) : null,
    // Editável só quando é custom E o dono é o próprio usuário.
    isCustom: !!row.created_by_user && !!userId && String(row.created_by ?? "") === userId,
    groupId: row.group_id ? String(row.group_id) : null,
  });

  // Fetch all workouts including created_by_user for client-side filtering
  const { data: allData, error } = await supabase!
    .from("workouts")
    .select("id, name, description, name_eng, description_eng, photo, muscle_group, type, wger_id, created_by_user, created_by, group_id")
    .order("created_at", { ascending: false });

  if (error) {
    // created_by_user column may not exist — fallback shows everything
    const { data } = await supabase!
      .from("workouts")
      .select("id, name, description, name_eng, description_eng, photo, muscle_group, type, wger_id")
      .order("created_at", { ascending: false });
    return (data ?? []).map(mapRow);
  }

  const { data: links } = userId ? await supabase!
    .from("user_workouts")
    .select("workout_id")
    .eq("user_id", userId) : { data: [] };
  const savedIds = new Set((links ?? []).map((r: any) => r.workout_id).filter(Boolean));

  return (allData ?? [])
    .filter((r: any) => {
      if (r.wger_id != null) return true;      // item de catálogo (importado do wger.de) — sempre visível
      if (!r.created_by_user) return true;     // item sem flag de criação manual — visível
      // Custom: pertence a quem o criou. A autoria (created_by) é o que manda —
      // o vínculo com a rotina (savedIds) só cobre os itens antigos, criados
      // antes de existir a coluna. Sem isso, um exercício criado e não usado numa
      // rotina sumia ao reabrir o drawer.
      if (r.created_by) return userId != null && String(r.created_by) === userId;
      return savedIds.has(String(r.id));
    })
    .map(mapRow);
  });
}

/**
 * Catálogo de grupos/movimentos ({@link WorkoutGroup}).
 *
 * Degrada sozinho: sem a migração `20260812-workout-groups.sql` a consulta
 * falha e devolve `[]` — o app volta a listar cada variação como um exercício
 * independente, que é o comportamento anterior. Nada quebra, só não agrupa.
 */
export async function getWorkoutGroupsDb(): Promise<WorkoutGroup[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  return cached(`workoutGroups:${getUiLanguage()}`, CACHE_TTL_STATIC, async () => {
    const { data, error } = await supabase!
      .from("workout_groups")
      .select("id, name, name_eng, muscle_group, default_workout_id");
    if (error || !data) return [];
    return (data as any[]).map((row) => ({
      id: String(row.id),
      name: pickLocalized(row.name, row.name_eng),
      muscle_group: String(row.muscle_group ?? ""),
      defaultWorkoutId: row.default_workout_id ? String(row.default_workout_id) : null,
    }));
  });
}

/**
 * Troca a VARIAÇÃO de um exercício da rotina (`user_workouts.workout_id`) —
 * "hoje o supino vai ser com halteres". Grava para valer: a próxima sessão abre
 * já com a variação escolhida, que é o que faz o app aprender o hábito em vez
 * de perguntar toda vez.
 *
 * O histórico não é tocado: `user_workouts_hist` guarda a variação de CADA
 * série executada, então o que já foi feito continua registrado onde foi feito.
 */
export async function updateUserWorkoutExerciseDb(
  userId: string,
  userWorkoutId: string,
  newWorkoutId: string,
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;
  const { error } = await supabase
    .from("user_workouts")
    .update({ workout_id: newWorkoutId })
    .eq("id", userWorkoutId)
    .eq("user_id", userId);
  if (error) {
    console.error("Error swapping workout variation:", error.message || error);
    throw error;
  }
  invalidateQueryCache("userWorkouts");
  offlineCopyPatch<UserWorkoutWithDetails[]>(`userWorkouts:${userId}`, (rows) =>
    rows.map((r) => (r.id === userWorkoutId ? { ...r, workout_id: newWorkoutId } : r)), []);
}

export async function bulkUpsertCatalogWorkoutsDb(
  exercises: Array<{ name: string; description: string; muscleGroup: string; photo: string | null; wgerId: number }>
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  const rows = exercises.map((ex) => ({
    name: ex.name,
    description: ex.description,
    muscle_group: ex.muscleGroup || null,
    photo: ex.photo || null,
    wger_id: ex.wgerId,
  }));

  // Upsert in batches of 100 to avoid request size limits
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    await supabase
      .from("workouts")
      .upsert(batch, { onConflict: "wger_id", ignoreDuplicates: false });
  }
}

/**
 * Índice nome (PT e EN, minúsculo) → id dos exercícios do catálogo (não-custom).
 * Usado pelo wizard de programas sugeridos para casar exercícios pelo nome bruto
 * do banco, independente do idioma da UI — evita criar customs duplicados quando
 * o app está em inglês (getWorkoutsDb retorna nomes localizados).
 */
export async function getWorkoutNameIdIndexDb(): Promise<Map<string, string>> {
  if (!hasSupabaseConfig || !supabase) return new Map();
  const { data } = await supabase
    .from("workouts")
    .select("id, name, name_eng, created_by_user");
  const map = new Map<string, string>();
  for (const row of (data ?? []) as Array<{ id: string; name: string | null; name_eng: string | null; created_by_user: boolean | null }>) {
    if (row.created_by_user === true) continue;
    const id = String(row.id);
    const pt = row.name?.trim().toLowerCase();
    const en = row.name_eng?.trim().toLowerCase();
    if (pt && !map.has(pt)) map.set(pt, id);
    if (en && !map.has(en)) map.set(en, id);
  }
  return map;
}

export async function getCatalogWorkoutsFromDb(): Promise<Array<{
  id: string; name: string; description: string; muscleGroup: string; photo: string | null; wgerId: number | null;
}>> {
  if (!hasSupabaseConfig || !supabase) return [];
  const viewer = await getViewer();
  const userId = viewer?.id ?? null;
  return cached(`catalogWorkouts:${getUiLanguage()}:${userId ?? "anon"}`, CACHE_TTL_STATIC, async () => {
  const mapRow = (row: any) => ({
    id: String(row.id),
    name: pickLocalized(row.name, row.name_eng),
    description: pickLocalized(row.description, row.description_eng),
    muscleGroup: String(row.muscle_group ?? ""),
    photo: resolveWorkoutPhotoUrl(row.photo, row.wger_id),
    wgerId: row.wger_id ? Number(row.wger_id) : null,
  });

  const { data: allData, error } = await supabase!
    .from("workouts")
    .select("id, name, description, name_eng, description_eng, muscle_group, photo, wger_id, created_by_user")
    .order("name", { ascending: true });

  if (error) {
    const { data } = await supabase!
      .from("workouts")
      .select("id, name, description, name_eng, description_eng, muscle_group, photo, wger_id")
      .order("name", { ascending: true });
    return (data ?? []).map(mapRow);
  }

  const { data: links } = userId ? await supabase!
    .from("user_workouts")
    .select("workout_id")
    .eq("user_id", userId) : { data: [] };
  const savedIds = new Set((links ?? []).map((r: any) => r.workout_id).filter(Boolean));

  return (allData ?? [])
    .filter((r: any) => {
      if (r.wger_id != null) return true;
      if (!r.created_by_user) return true;
      return savedIds.has(String(r.id));
    })
    .map(mapRow);
  });
}

export async function createCustomWorkoutDb(
  name: string,
  description: string,
  muscleGroup: string,
  photo?: string | null,
  equipment?: string | null,
): Promise<Workout> {
  if (!hasSupabaseConfig || !supabase) throw new Error("Supabase não configurado");
  const viewer = await getViewer();
  if (!viewer) throw new Error("Não autenticado");

  // created_by = dono do item. É o que faz o exercício custom sobreviver mesmo
  // que o usuário abandone o drawer sem montar a rotina (ver getWorkoutsDb).
  const insertData: Record<string, any> = {
    name,
    description,
    muscle_group: muscleGroup || null,
    created_by_user: true,
    created_by: viewer.id,
  };
  if (photo) insertData.photo = photo;
  if (equipment) insertData.equipment = equipment;

  const { data, error } = await supabase
    .from("workouts")
    .insert(insertData)
    .select("id, name, description, photo, muscle_group")
    .single();

  if (error) {
    console.error("Error creating custom workout:", error);
    throw error;
  }

  invalidateQueryCache("workouts:"); invalidateQueryCache("catalogWorkouts:");
  return {
    id: String(data.id),
    name: String(data.name),
    description: String(data.description ?? ""),
    photo: data.photo ? resolveWorkoutPhotoUrl(data.photo) : null,
    muscle_group: data.muscle_group ? String(data.muscle_group) : null,
    // Acabou de ser criado por este usuário → já nasce editável, sem esperar
    // um refetch do catálogo.
    isCustom: true,
  };
}

/**
 * Edita um exercício criado manualmente pelo próprio usuário (nome, descrição,
 * grupo muscular e/ou foto). Só campos presentes em `updates` são alterados.
 *
 * O `.eq("created_by", viewer.id)` garante que só o dono edita — item de catálogo
 * ou de outro usuário não é alcançado nem se o id vazar na UI. Como UPDATE
 * barrado por RLS é **no-op silencioso** (0 linhas, sem erro — ver
 * docs/migrations/20260716-hist-delete-rls.sql), pedimos as linhas afetadas de
 * volta e tratamos "0 linhas" como falha, em vez de fingir sucesso.
 */
export async function updateCustomWorkoutDb(
  workoutId: string,
  updates: {
    name?: string;
    description?: string;
    muscleGroup?: string | null;
    photo?: string | null;
  },
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) throw new Error("Supabase não configurado");
  const viewer = await getViewer();
  if (!viewer) throw new Error("Usuário não autenticado");

  const payload: Record<string, any> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.muscleGroup !== undefined) payload.muscle_group = updates.muscleGroup || null;
  if (updates.photo !== undefined) payload.photo = updates.photo;
  if (Object.keys(payload).length === 0) return;

  // Foto anterior, para limpar o Storage depois da troca.
  let previousPhoto: string | null = null;
  if (updates.photo !== undefined) {
    const { data: prev } = await supabase
      .from("workouts")
      .select("photo")
      .eq("id", workoutId)
      .maybeSingle();
    previousPhoto = ((prev as any)?.photo as string | null) ?? null;
  }

  const { data, error } = await supabase
    .from("workouts")
    .update(payload)
    .eq("id", workoutId)
    .eq("created_by", viewer.id)
    .select("id");

  if (error) {
    console.error("Error updating custom workout:", error);
    throw error;
  }
  if (!data || data.length === 0) {
    throw new Error("Não foi possível editar este exercício (ele não é seu ou foi removido).");
  }

  // Foto de exercício pode ser COMPARTILHADA entre linhas do catálogo (imagens
  // por nome, `manual/shared/{slug}`), então só apaga o que mais ninguém usa.
  if (previousPhoto && previousPhoto !== updates.photo) {
    await removeStorageObjects(
      await filterUnreferencedUrls([previousPhoto], "workouts", ["photo"]),
    );
  }

  // O nome/foto aparecem tanto no catálogo quanto nos itens de rotina (join).
  invalidateQueryCache("workouts:");
  invalidateQueryCache("catalogWorkouts:");
  invalidateQueryCache("workoutHistory:");
  invalidateQueryCache("completedRoutines:");
}

/**
 * Apaga por completo um exercício criado manualmente pelo próprio usuário —
 * some do catálogo E de todas as rotinas dele. Para "criei errado, quero remover".
 *
 * Ordem obedece as FKs (`user_workouts.workout_id` e `user_workouts_hist.workout_id`
 * apontam para `workouts.id`, sem cascade): 1) histórico deste exercício, 2)
 * vínculos com rotinas (`user_workouts`), 3) a linha do catálogo. Só o dono
 * alcança a linha do catálogo (`.eq("created_by", viewer.id)`); como DELETE
 * barrado por RLS é no-op silencioso (ver 20260716-hist-delete-rls), pedimos as
 * linhas de volta e tratamos "0 linhas" como erro.
 */
export async function deleteCustomWorkoutDb(workoutId: string): Promise<void> {
  if (!hasSupabaseConfig || !supabase) throw new Error("Supabase não configurado");
  const viewer = await getViewer();
  if (!viewer) throw new Error("Usuário não autenticado");

  // 0. Foto, lida antes de qualquer delete (depois a linha some).
  const { data: prevWorkout } = await supabase
    .from("workouts")
    .select("photo")
    .eq("id", workoutId)
    .maybeSingle();

  // 1. Histórico deste exercício (antes dos vínculos, para não violar FK).
  const { error: histError } = await supabase
    .from("user_workouts_hist")
    .delete()
    .eq("user_id", viewer.id)
    .eq("workout_id", workoutId);
  if (histError) throw histError;

  // 2. Vínculos com rotinas — remove o exercício de todas as rotinas do usuário.
  const { error: linkError } = await supabase
    .from("user_workouts")
    .delete()
    .eq("user_id", viewer.id)
    .eq("workout_id", workoutId);
  if (linkError) throw linkError;

  // 3. Linha do catálogo — só o dono; detecta o no-op silencioso de RLS.
  const { data, error } = await supabase
    .from("workouts")
    .delete()
    .eq("id", workoutId)
    .eq("created_by", viewer.id)
    .select("id");
  if (error) {
    console.error("Error deleting custom workout:", error);
    throw error;
  }
  if (!data || data.length === 0) {
    throw new Error("Não foi possível apagar este exercício (ele não é seu ou foi removido).");
  }

  // Imagem de exercício pode ser compartilhada por nome entre linhas do
  // catálogo (`manual/shared/{slug}`) — só apaga a que ficou sem dono.
  const workoutPhoto = (prevWorkout as any)?.photo as string | null;
  if (workoutPhoto) {
    await removeStorageObjects(
      await filterUnreferencedUrls([workoutPhoto], "workouts", ["photo"]),
    );
  }

  invalidateQueryCache("workouts:");
  invalidateQueryCache("catalogWorkouts:");
  invalidateQueryCache("userWorkouts:");
  invalidateQueryCache("workoutHistory:");
  invalidateQueryCache("completedRoutines:");
}

// Upload da foto de um exercício criado pelo usuário → retorna URL pública.
export async function uploadCustomExercisePhotoDb(rawFile: File): Promise<string> {
  if (!supabase) throw new Error("Supabase não configurado");
  const viewer = await getViewer();
  if (!viewer) throw new Error("Usuário não autenticado");
  // Vem crua do seletor (sem cropper) — encolhe antes de subir. Ver image-compress.ts.
  const file = await compressImageFile(rawFile);
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `exercise-photos/${viewer.id}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("posts")
    .upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });
  if (error) throw error;
  const { data } = supabase.storage.from("posts").getPublicUrl(path);
  return data.publicUrl;
}

export async function getUserStatsDb(userId: string): Promise<UserStats> {
  if (!hasSupabaseConfig || !supabase) {
    return { postsCount: 0, followersCount: 0, followingCount: 0, points: 0, level: 1 };
  }
  return cached(`userStats:${userId}`, CACHE_TTL_SHORT, async () => {
  // Os contadores vêm de get_profile_counts (SECURITY DEFINER): com a RLS de
  // privacidade, um `count` direto em posts/following devolveria 0 para quem
  // ativou "esconder posts/listas". Os NÚMEROS continuam públicos — o que fica
  // oculto é o conteúdo das listas e dos posts.
  // Ver docs/migrations/20260713-security-hardening.sql.
  const [countsRes, rankingRes] = await Promise.all([
    supabase.rpc("get_profile_counts", { target: userId }).maybeSingle(),
    supabase.from("ranking").select("points, level").eq("user_id", userId).single(),
  ]);

  if (countsRes.error) {
    console.error(`Error fetching profile counts:`, countsRes.error?.message);
  }

  const counts = countsRes.data as
    | { posts_count: number; followers_count: number; following_count: number }
    | null;

  const points = Number(rankingRes.data?.points ?? 0);
  const level = Number(rankingRes.data?.level ?? Math.floor(points / 100) + 1);

  return {
    postsCount: Number(counts?.posts_count ?? 0),
    followersCount: Number(counts?.followers_count ?? 0),
    followingCount: Number(counts?.following_count ?? 0),
    points,
    level,
  };

  });
}

// Routine type constants
export const ROUTINE_TYPES = {
  1: "Exercicios",
  2: "Dietas",
  3: "Habitos",
} as const;

export type RoutineTypeCode = 1 | 2 | 3;
export type RoutineType = (typeof ROUTINE_TYPES)[RoutineTypeCode];

export function getRoutineTypeName(code: number): string {
  return ROUTINE_TYPES[code as RoutineTypeCode] || "Desconhecido";
}

/**
 * Modo da experiência de treino, escolhido na criação da rotina
 * (`routines.training_mode`, migração `20260805-training-mode.sql`).
 *
 * - `simple`: a tela clássica do app — tabela KG × REPS, sem tipo de série.
 * - `expert`: série tipada (aquecimento/válida/falha), com aquecimento fora do
 *   volume, da contagem de séries e do PR.
 *
 * É por ROTINA, não por conta: dá para ter "Peito/Tríceps" no expert e
 * "Corrida de domingo" no simplificado. Default `simple` — rotinas criadas
 * antes desta migração não mudam de comportamento.
 */
export type TrainingMode = "simple" | "expert";

/** Normaliza qualquer valor vindo do banco/cache para um {@link TrainingMode} válido. */
export function toTrainingMode(value: unknown): TrainingMode {
  return value === "expert" ? "expert" : "simple";
}

/**
 * Tipo de uma série executada (`user_workouts_hist.set_kind`). Só o modo
 * `expert` classifica séries; no simplificado a coluna vai NULL.
 *
 * - `warmup`: aquecimento. **Conta** como série executada — entra no contador
 *   de séries e no volume da sessão (cabeçalho ao vivo e resumo). O que ele
 *   **não** faz é valer como MARCA: fica fora do PR, do e1RM, da tendência de
 *   carga, do gráfico de progressão, da cobertura muscular, da coluna ANTERIOR
 *   e do prompt de "máquina zerada" — uma rampa leve não é desempenho.
 * - `normal`: série válida (o padrão).
 * - `failure`: série levada à falha; conta como válida em tudo, mas fica
 *   marcada para a leitura de sobrecarga progressiva das fases seguintes.
 */
export type SetKind = "warmup" | "normal" | "failure" | "drop";

/**
 * Séries que podem virar MARCA (recorde/progressão) — tudo que não é
 * aquecimento. Não confundir com "conta como série": para contagem e volume o
 * aquecimento entra normalmente (ver `countsAsSeries`, na tela de treino).
 */
export function isWorkingSet(kind: SetKind | null | undefined): boolean {
  return kind !== "warmup";
}

/**
 * Técnica de um exercício DENTRO de uma rotina (`user_workouts.technique`).
 * Migração: `docs/migrations/20260805-workout-techniques.sql`.
 *
 * - `straight`:   série direta — faz, descansa, repete. O padrão.
 * - `drop`:       drop-set — ao concluir a série, emenda outra com menos carga.
 * - `rest_pause`: rest-pause — micro-pausas de ~15s dentro da mesma série.
 * - `biset` / `triset`: bloco de 2/3 exercícios executados **sem descanso entre
 *   eles**; exigem `technique_group` para saber quem faz par com quem.
 */
export type WorkoutTechnique = "straight" | "drop" | "rest_pause" | "biset" | "triset";

/** Técnicas que ligam VÁRIOS exercícios (precisam de `technique_group`). */
export function isBlockTechnique(t: WorkoutTechnique | null | undefined): boolean {
  return t === "biset" || t === "triset";
}

export function toWorkoutTechnique(value: unknown): WorkoutTechnique {
  return value === "drop" || value === "rest_pause" || value === "biset" || value === "triset"
    ? value
    : "straight";
}

/** Quantos exercícios um bloco comporta. */
export function blockSize(t: WorkoutTechnique): number {
  return t === "triset" ? 3 : t === "biset" ? 2 : 1;
}

export type Routine = {
  id: string;
  user_id: string;
  type: number;
  goal_id: string | null;
  name?: string;
  last_summary: RoutineLastSummary | null;
  program_meta?: RoutineProgramMeta | null;
  training_mode?: TrainingMode;
};

/**
 * Metadados do programa que criou a rotina (coluna `routines.program_meta`,
 * jsonb). Gravado quando a rotina nasce do quiz "Sugerido pelo app": guarda as
 * séries × reps sugeridas por exercício para o pré-preenchimento da sessão de
 * treino — programas gerados são únicos por usuário e não existem no catálogo
 * estático de `suggested-routines-data.ts`. `null` = rotina criada do zero ou
 * de um programa estático antigo (fallback pelo nome continua funcionando).
 */
export type RoutineProgramMeta = {
  /** origem do programa (hoje sempre "quiz") */
  origin: string;
  /** nome bruto PT do exercício no catálogo + séries/reps sugeridas */
  exercises: Array<{ name: string; muscleGroup: string; series: number; reps: string }>;
};

/**
 * Snapshot do último treino finalizado de uma rotina — mesmo formato de
 * `WorkoutSummaryData` (client/components/goals/workout-summary-overlay.tsx)
 * sem `userId`/`userGroups`, resolvidos de novo ao reabrir. Sobrescrito a cada
 * "Finalizar" (sempre o mais recente).
 */
export type RoutineLastSummary = {
  routineName: string;
  totalSeries: number;
  totalVolume: number;
  durationSecs: number;
  badges: string[];
  completedExercises: Array<{
    name: string;
    totalSets: number;
    bestKg: number;
    muscleGroup: string | null;
    // Foto do exercício (opcional). Espelha WorkoutSessionSummary/WorkoutSummaryData.
    photo?: string | null;
    // Carga (kg) e repetições de cada série concluída (opcional: snapshots antigos
    // não têm). Espelha o campo `sets` de WorkoutSessionSummary/WorkoutSummaryData.
    // `elev` = inclinação (%) da esteira naquela série (só quando informada).
    sets?: Array<{ kg: number; reps: number; elev?: number }>;
    // Cardio (kg = MIN, reps = KM) e a maior inclinação (%) entre as séries —
    // ambos espelham WorkoutSessionSummary/WorkoutSummaryData. Ausentes nos
    // snapshots gravados antes de cada campo existir.
    isCardio?: boolean;
    elevationPct?: number | null;
  }>;
  // `kind` e os pares de reps/e1rm são opcionais: snapshots gravados antes de
  // 05/08/2026 (e todo o modo simplificado) só têm recorde de carga. Ver
  // `PrKind` em workout-session-dialog.tsx.
  prExercises: Array<{
    name: string;
    previousBestKg: number;
    newBestKg: number;
    kind?: "weight" | "reps" | "e1rm";
    previousReps?: number;
    newReps?: number;
    previousE1rm?: number;
    newE1rm?: number;
  }>;
  machinedExercises: Array<{ name: string; kg: number }>;
  completedAt: string;
};

export type Workout = {
  id: string;
  name: string;
  /** nome no outro idioma (só para busca — ver matchesCatalogSearch) */
  altName?: string;
  description: string;
  photo: string | null;
  muscle_group?: string | null;
  type?: number | null;
  /**
   * true = exercício criado manualmente PELO usuário logado (created_by_user +
   * created_by = viewer). É o que habilita a edição (nome/descrição/foto) —
   * itens do catálogo e de outros usuários não são editáveis.
   */
  isCustom?: boolean;
  /**
   * Grupo/movimento a que esta variação pertence (`workouts.group_id`), quando
   * o exercício tem irmãos — "Supino Inclinado com Halteres" pertence ao grupo
   * `supino_inclinado`. `null` = exercício sem variações.
   * Migração: `docs/migrations/20260812-workout-groups.sql`.
   */
  groupId?: string | null;
};

/**
 * Movimento que agrupa variações do mesmo exercício ("Supino", "Remada").
 *
 * Existe porque a variação sempre viveu só dentro do NOME do exercício: o
 * catálogo tem 13 supinos e nenhuma coluna dizia que eles são o mesmo
 * movimento. O usuário escolhe o GRUPO ao montar a rotina e a VARIAÇÃO na hora
 * do treino, que é quando ele sabe qual aparelho está livre.
 */
export type WorkoutGroup = {
  id: string;
  name: string;
  muscle_group: string;
  /** variação que a rotina recebe quando o usuário escolhe o grupo */
  defaultWorkoutId: string | null;
};

export type Diet = {
  id: string;
  name: string;
  description: string;
  photo: string | null;
  category?: string | null;
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  food_quality?: "in_natura" | "processado" | "ultraprocessado" | null;
  /** true = alimento que o próprio usuário cadastrou (não é catálogo) */
  created_by_user?: boolean;
};

export async function getDietsDb(): Promise<Diet[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  const viewer = await getViewer();
  const userId = viewer?.id ?? null;
  return cached(`diets:${getUiLanguage()}:${userId ?? "anon"}`, CACHE_TTL_STATIC, async () => {
  const mapRow = (row: any): Diet => ({
    id: String(row.id ?? ""),
    name: pickLocalized(row.name, row.name_eng),
    description: pickLocalized(row.description, row.description_eng),
    photo: row.photo ? String(row.photo) : null,
    category: row.category ? String(row.category) : null,
    calories: row.calories != null ? Number(row.calories) : null,
    protein_g: row.protein_g != null ? Number(row.protein_g) : null,
    carbs_g: row.carbs_g != null ? Number(row.carbs_g) : null,
    fat_g: row.fat_g != null ? Number(row.fat_g) : null,
    fiber_g: row.fiber_g != null ? Number(row.fiber_g) : null,
    sugar_g: row.sugar_g != null ? Number(row.sugar_g) : null,
    food_quality: row.food_quality ?? null,
    created_by_user: Boolean(row.created_by_user),
  });

  // mealdb_id identifica itens de catálogo importados (TheMealDB) — mais confiável que created_by_user
  const { data: allData, error } = await supabase!
    .from("diets")
    .select("id, name, description, name_eng, description_eng, photo, category, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, food_quality, created_by_user, created_by, mealdb_id")
    .order("created_at", { ascending: false });

  if (error) {
    const { data } = await supabase!
      .from("diets")
      .select("id, name, description, name_eng, description_eng, photo, category, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, food_quality")
      .order("created_at", { ascending: false });
    return (data ?? []).map(mapRow);
  }

  const { data: links } = userId ? await supabase!
    .from("user_diets")
    .select("diet_id")
    .eq("user_id", userId) : { data: [] };
  const savedIds = new Set((links ?? []).map((r: any) => r.diet_id).filter(Boolean));

  return (allData ?? [])
    .filter((r: any) => {
      if (r.mealdb_id != null) return true;    // item de catálogo (importado do TheMealDB) — sempre visível
      if (!r.created_by_user) return true;     // item sem flag de criação manual — visível
      // Custom: pertence a quem o criou. A autoria (created_by) é o que manda —
      // o vínculo com a rotina (savedIds) só cobre os itens antigos, criados
      // antes de existir a coluna. Sem isso, um alimento criado e não usado numa
      // rotina sumia ao reabrir o drawer.
      if (r.created_by) return userId != null && String(r.created_by) === userId;
      return savedIds.has(String(r.id));
    })
    .map(mapRow);
  });
}

export async function getCatalogDietsFromDb(): Promise<Array<{
  id: string; name: string; description: string; category: string; photo: string | null; mealdbId: number | null;
}>> {
  if (!hasSupabaseConfig || !supabase) return [];
  return cached(`catalogDiets:${getUiLanguage()}`, CACHE_TTL_STATIC, async () => {
  const { data } = await supabase
    .from("diets")
    .select("id, name, description, name_eng, description_eng, photo, category, mealdb_id")
    .not("mealdb_id", "is", null)
    .not("photo", "is", null);

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    name: pickLocalized(row.name, row.name_eng),
    description: pickLocalized(row.description, row.description_eng),
    category: String(row.category ?? ""),
    photo: row.photo ? String(row.photo) : null,
    mealdbId: row.mealdb_id ? Number(row.mealdb_id) : null,
  }));

  });
}

export async function createCustomDietDb(
  name: string,
  description: string,
  photo?: string | null,
  calories?: number | null,
  protein_g?: number | null,
  carbs_g?: number | null,
  fat_g?: number | null,
  fiber_g?: number | null,
  food_quality?: "in_natura" | "processado" | "ultraprocessado" | null,
  sugar_g?: number | null,
): Promise<Diet> {
  if (!hasSupabaseConfig || !supabase) throw new Error("Supabase não configurado");
  const viewer = await getViewer();
  if (!viewer) throw new Error("Não autenticado");

  // created_by = dono do item. É o que faz o alimento custom sobreviver mesmo
  // que o usuário abandone o drawer sem montar a rotina (ver getDietsDb).
  const insertData: Record<string, any> = {
    name,
    description,
    created_by_user: true,
    created_by: viewer.id,
  };
  if (photo) insertData.photo = photo;
  if (calories != null) insertData.calories = calories;
  if (protein_g != null) insertData.protein_g = protein_g;
  if (carbs_g != null) insertData.carbs_g = carbs_g;
  if (fat_g != null) insertData.fat_g = fat_g;
  if (fiber_g != null) insertData.fiber_g = fiber_g;
  if (sugar_g != null) insertData.sugar_g = sugar_g;
  if (food_quality) insertData.food_quality = food_quality;

  const { data, error } = await supabase
    .from("diets")
    .insert(insertData)
    .select("id, name, description, photo, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, food_quality")
    .single();

  if (error) {
    console.error("Error creating custom diet:", error);
    throw error;
  }

  invalidateQueryCache("diets:"); invalidateQueryCache("catalogDiets");
  return {
    id: String(data.id),
    name: String(data.name),
    description: String(data.description ?? ""),
    photo: data.photo ? String(data.photo) : null,
    calories: data.calories != null ? Number(data.calories) : null,
    protein_g: data.protein_g != null ? Number(data.protein_g) : null,
    carbs_g: data.carbs_g != null ? Number(data.carbs_g) : null,
    fat_g: data.fat_g != null ? Number(data.fat_g) : null,
    fiber_g: data.fiber_g != null ? Number(data.fiber_g) : null,
    sugar_g: data.sugar_g != null ? Number(data.sugar_g) : null,
    food_quality: data.food_quality ?? null,
    created_by_user: true,
  };
}

export type Habit = {
  id: string;
  name: string;
  description: string;
};

export async function getHabitsDb(): Promise<Habit[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  const viewer = await getViewer();
  const userId = viewer?.id ?? null;
  return cached(`habits:${getUiLanguage()}:${userId ?? "anon"}`, CACHE_TTL_STATIC, async () => {
  const mapRow = (row: any): Habit => ({
    id: String(row.id ?? ""),
    name: pickLocalized(row.name, row.name_eng),
    description: pickLocalized(row.description, row.description_eng),
  });

  const { data: allData, error } = await supabase!
    .from("habits")
    .select("id, name, description, name_eng, description_eng, created_by_user, created_by")
    .order("created_at", { ascending: false });

  if (error) {
    const { data } = await supabase!
      .from("habits")
      .select("id, name, description, name_eng, description_eng")
      .order("created_at", { ascending: false });
    return (data ?? []).map(mapRow);
  }

  if (!userId) {
    return (allData ?? []).filter((r: any) => !r.created_by_user).map(mapRow);
  }

  const { data: links } = await supabase!
    .from("user_habits")
    .select("habit_id")
    .eq("user_id", userId);
  const savedIds = new Set((links ?? []).map((r: any) => r.habit_id).filter(Boolean));

  return (allData ?? [])
    .filter((r: any) => {
      if (!r.created_by_user) return true;
      // Mesma regra dos alimentos: a autoria manda; savedIds só cobre o legado.
      if (r.created_by) return String(r.created_by) === userId;
      return savedIds.has(String(r.id));
    })
    .map(mapRow);
  });
}

export async function createCustomHabitDb(
  name: string,
  description: string,
): Promise<Habit> {
  if (!hasSupabaseConfig || !supabase) throw new Error("Supabase não configurado");
  const viewer = await getViewer();
  if (!viewer) throw new Error("Não autenticado");

  const { data, error } = await supabase
    .from("habits")
    .insert({ name, description, created_by_user: true, created_by: viewer.id })
    .select("id, name, description")
    .single();

  if (error) {
    console.error("Error creating custom habit:", error);
    throw error;
  }

  invalidateQueryCache("habits:");
  return {
    id: String(data.id),
    name: String(data.name),
    description: String(data.description ?? ""),
  };
}

export async function getUserRoutinesDb(userId: string): Promise<Routine[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  const { data, error } = await supabase
    .from("routines")
    .select("id, user_id, type, goal_id, name, last_summary, program_meta, training_mode")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error fetching user routines [${errorCode}]:`, errorMsg);
    // Sem rede: última cópia local (a tela de Metas continua funcionando offline)
    if (isTransientNetworkError(error)) {
      const off = offlineCopyRead<Routine[]>(`userRoutines:${userId}`);
      if (off) return off;
    }
    return [];
  }

  const rows = (data ?? []).map((row: any) => ({
    id: String(row.id ?? ""),
    user_id: String(row.user_id ?? ""),
    type: Number(row.type ?? 1),
    goal_id: row.goal_id ? String(row.goal_id) : null,
    name: row.name ? String(row.name) : undefined,
    last_summary: row.last_summary ?? null,
    program_meta: row.program_meta ?? null,
    // Cópias offline gravadas antes de 05/08/2026 não têm a chave — o
    // normalizador devolve 'simple', que é o comportamento clássico.
    training_mode: toTrainingMode(row.training_mode),
  }));
  offlineCopyWrite(`userRoutines:${userId}`, rows);
  return rows;
}

/**
 * Grava o modo de treino de UMA rotina já resolvida por id. Caminho do
 * "Sugerido pelo app": o quiz cria N rotinas e relê `getUserRoutinesDb` para
 * casar cada uma, então o id está em mãos (mesmo padrão de
 * {@link updateRoutineProgramMetaDb}).
 */
export async function updateRoutineTrainingModeDb(
  routineId: string,
  mode: TrainingMode,
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  const { error } = await supabase
    .from("routines")
    .update({ training_mode: mode })
    .eq("id", routineId);

  if (error) {
    console.error("Error saving routine training mode:", error?.message || error);
  }
}

/**
 * Grava o modo de treino casando por (user_id, type, name) — caminho da rotina
 * criada **do zero**.
 *
 * Por que não dá para usar o id aqui: nesse fluxo o app insere só os itens
 * (`user_workouts`) e a linha em `routines` nasce de um **trigger** no banco,
 * então o cliente nunca vê o id de volta. É a mesma estratégia de
 * {@link updateRoutineNameDb} e dos setters de horário/dias.
 *
 * Best-effort: falhar aqui não invalida a rotina criada — ela só fica no modo
 * `simple` (o default da coluna), que é o comportamento clássico.
 */
export async function updateRoutineTrainingModeByNameDb(
  userId: string,
  typeCode: number,
  name: string | null,
  mode: TrainingMode,
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  let query = supabase
    .from("routines")
    .update({ training_mode: mode })
    .eq("user_id", userId)
    .eq("type", typeCode);

  // Rotina sem nome é um grupo legítimo (name NULL) — `.eq("name", null)` não
  // casa nada no Postgres, tem que ser `.is`.
  query = name ? query.eq("name", name) : query.is("name", null);

  const { error } = await query;
  if (error) {
    console.error("Error saving routine training mode by name:", error?.message || error);
  }
}

/**
 * Grava os metadados do programa gerado (séries × reps sugeridas por
 * exercício) na rotina recém-criada pelo quiz. Ver {@link RoutineProgramMeta}.
 */
export async function updateRoutineProgramMetaDb(
  routineId: string,
  meta: RoutineProgramMeta,
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  const { error } = await supabase
    .from("routines")
    .update({ program_meta: meta })
    .eq("id", routineId);

  if (error) {
    console.error("Error saving routine program meta:", error?.message || error);
  }
}

/**
 * Perfil fitness do usuário — respostas do quiz de personalização do
 * "Sugerido pelo app" (tabela `user_fitness_profile`, uma linha por usuário).
 * Usado para pré-preencher o quiz na próxima criação de programa.
 */
export type FitnessProfile = {
  goal: string;
  level: string;
  /** dias de treino escolhidos, índices Monday-first (0=Seg … 6=Dom) */
  trainingDays: number[];
  sessionMinutes: number;
  emphasis: string;
  location: string;
  /**
   * Articulações em cuidado ("knee" | "shoulder" | "lower_back" | "wrist"),
   * guardadas como CSV na coluna `restrictions`. Vetam exercícios no gerador
   * (ver `client/lib/coach-profile.ts`). Coluna criada em
   * `docs/migrations/20260813-fitness-profile-restrictions.sql` — enquanto a
   * migração não roda, leitura e escrita degradam para o comportamento antigo.
   */
  restrictions?: string[];
};

/** `42703 = undefined_column` — a migração das restrições ainda não rodou. */
const UNDEFINED_COLUMN = "42703";

export async function getFitnessProfileDb(userId: string): Promise<FitnessProfile | null> {
  if (!hasSupabaseConfig || !supabase) return null;
  // Duas consultas escritas por extenso de propósito: o supabase-js infere o
  // tipo da linha a partir do LITERAL do `select`, então parametrizar a lista
  // de colunas (template string ou ternário) quebra a inferência.
  let { data, error } = (await supabase
    .from("user_fitness_profile")
    .select("goal, level, training_days, session_minutes, emphasis, location, restrictions")
    .eq("user_id", userId)
    .maybeSingle()) as { data: unknown; error: { code?: string } | null };

  if (error?.code === UNDEFINED_COLUMN) {
    ({ data, error } = (await supabase
      .from("user_fitness_profile")
      .select("goal, level, training_days, session_minutes, emphasis, location")
      .eq("user_id", userId)
      .maybeSingle()) as { data: unknown; error: { code?: string } | null });
  }
  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  return {
    goal: String(row.goal ?? ""),
    level: String(row.level ?? ""),
    trainingDays: String(row.training_days ?? "")
      .split(",")
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
    sessionMinutes: Number(row.session_minutes ?? 0),
    emphasis: String(row.emphasis ?? ""),
    location: String(row.location ?? ""),
    restrictions: String(row.restrictions ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

export async function upsertFitnessProfileDb(
  userId: string,
  profile: FitnessProfile,
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;
  const base = {
    user_id: userId,
    goal: profile.goal,
    level: profile.level,
    training_days: profile.trainingDays.join(","),
    session_minutes: profile.sessionMinutes,
    emphasis: profile.emphasis,
    location: profile.location,
    updated_at: new Date().toISOString(),
  };

  const save = async (payload: Record<string, unknown>) =>
    supabase!.from("user_fitness_profile").upsert(payload, { onConflict: "user_id" });

  let { error } = await save({ ...base, restrictions: (profile.restrictions ?? []).join(",") });
  // Sem a migração das restrições, grava o resto — perder o perfil inteiro por
  // causa de uma coluna nova seria pior do que perder só as restrições.
  if (error?.code === UNDEFINED_COLUMN) ({ error } = await save(base));
  if (error) {
    console.error("Error saving fitness profile:", error?.message || error);
  }
}

/**
 * Sobrescreve o resumo do último treino finalizado desta rotina — sempre há
 * no máximo um snapshot por rotina, o mais recente (ver `RoutineLastSummary`).
 */
export async function updateRoutineLastSummaryDb(
  routineId: string,
  summary: RoutineLastSummary,
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  // Offline: guarda o resumo na fila e na cópia local das rotinas — o ícone de
  // "resumo do último treino" já funciona antes mesmo da sincronização.
  const enqueueOffline = () => {
    enqueueOutbox("routine_summary", { routineId, summary });
    const ownerId = getOfflineOwnerId();
    if (ownerId) {
      offlineCopyPatch<Routine[]>(`userRoutines:${ownerId}`, (rts) =>
        rts.map((r) => (r.id === routineId ? { ...r, last_summary: summary } : r)),
      );
    }
  };

  if (isLikelyOffline()) {
    enqueueOffline();
    return;
  }

  const { error } = await supabase
    .from("routines")
    .update({ last_summary: summary })
    .eq("id", routineId);

  if (error) {
    if (isOfflineWriteError(error)) {
      enqueueOffline();
      return;
    }
    console.error("Error saving routine last summary:", error?.message || error);
    return;
  }
}

export async function createRoutineDb(
  userId: string,
  type: RoutineTypeCode,
  name?: string,
): Promise<Routine | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  const { data, error } = await supabase
    .from("routines")
    .insert({
      user_id: userId,
      type,
      name: name || null,
    })
    .select("id, user_id, type, goal_id, name")
    .maybeSingle();

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error creating routine [${errorCode}]:`, errorMsg);
    throw new Error(`Erro ao criar rotina: ${errorMsg}`);
  }

  if (!data) return null;

  return {
    id: String(data.id ?? ""),
    user_id: String(data.user_id ?? ""),
    type: Number(data.type ?? 1),
    goal_id: data.goal_id ? String(data.goal_id) : null,
    name: data.name ? String(data.name) : undefined,
    last_summary: null,
  };
}

export async function updateRoutineGoalDb(
  routineId: string,
  goalId: string | null,
): Promise<Routine | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  const { data, error } = await supabase
    .from("routines")
    .update({
      goal_id: goalId,
    })
    .eq("id", routineId)
    .select("id, user_id, type, goal_id, name, last_summary")
    .maybeSingle();

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error updating routine goal [${errorCode}]:`, errorMsg);
    throw new Error(`Erro ao atualizar meta da rotina: ${errorMsg}`);
  }

  if (!data) return null;

  return {
    id: String(data.id ?? ""),
    user_id: String(data.user_id ?? ""),
    type: Number(data.type ?? 1),
    goal_id: data.goal_id ? String(data.goal_id) : null,
    name: data.name ? String(data.name) : undefined,
    last_summary: (data as any).last_summary ?? null,
  };
}

export async function updateRoutineNameDb(
  userId: string,
  oldName: string | null | undefined,
  typeCode: number,
  newName: string,
): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  let query = supabase
    .from("routines")
    .update({ name: newName.trim() || null })
    .eq("user_id", userId)
    .eq("type", typeCode);

  if (oldName) {
    query = query.eq("name", oldName);
  } else {
    query = query.is("name", null);
  }

  const { error } = await query;

  if (error) {
    console.error("Error updating routine name:", error);
    return false;
  }

  // Also update user_workouts / user_diets / user_habits name column
  if (typeCode === 1) {
    let wQuery = supabase.from("user_workouts").update({ name: newName.trim() || null }).eq("user_id", userId);
    wQuery = oldName ? wQuery.eq("name", oldName) : wQuery.is("name", null);
    await wQuery;
  } else if (typeCode === 2) {
    let dQuery = supabase.from("user_diets").update({ name: newName.trim() || null }).eq("user_id", userId);
    dQuery = oldName ? dQuery.eq("name", oldName) : dQuery.is("name", null);
    await dQuery;
  } else if (typeCode === 3) {
    let hQuery = supabase.from("user_habits").update({ name: newName.trim() || null }).eq("user_id", userId);
    hQuery = oldName ? hQuery.eq("name", oldName) : hQuery.is("name", null);
    await hQuery;
  }

  return true;
}

export async function updateRoutineItemsScheduledTimeDb(
  userId: string,
  typeCode: number,
  routineName: string | null | undefined,
  scheduledTime: string | null,
): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;
  const table =
    typeCode === 1 ? "user_workouts" : typeCode === 2 ? "user_diets" : "user_habits";
  let q = supabase.from(table).update({ scheduled_time: scheduledTime }).eq("user_id", userId);
  q = routineName ? q.eq("name", routineName) : q.is("name", null);
  const { error } = await q;
  if (error) {
    console.error("Error updating routine items scheduled_time:", error);
    return false;
  }
  return true;
}

/**
 * Sets the weekdays (`scheduled_days`) for every item of a routine card.
 * `days` is a comma-separated list of Monday-first indices (0=Mon…6=Sun), or
 * null/empty for "every day". Mirrors {@link updateRoutineItemsScheduledTimeDb}.
 */
export async function updateRoutineItemsScheduledDaysDb(
  userId: string,
  typeCode: number,
  routineName: string | null | undefined,
  scheduledDays: string | null,
): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;
  const table =
    typeCode === 1 ? "user_workouts" : typeCode === 2 ? "user_diets" : "user_habits";
  let q = supabase
    .from(table)
    .update({ scheduled_days: scheduledDays || null })
    .eq("user_id", userId);
  q = routineName ? q.eq("name", routineName) : q.is("name", null);
  const { error } = await q;
  if (error) {
    console.error("Error updating routine items scheduled_days:", error);
    return false;
  }
  return true;
}

/**
 * Sets the scheduled_time for a single routine item (one row in user_workouts/
 * user_diets/user_habits), instead of every item of the routine. Mirrors
 * {@link updateRoutineItemsScheduledTimeDb} but scoped to one item id — lets
 * habit routines with multiple items carry distinct reminder times.
 */
export async function updateRoutineItemScheduledTimeDb(
  userId: string,
  typeCode: number,
  itemId: string,
  scheduledTime: string | null,
): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;
  const table =
    typeCode === 1 ? "user_workouts" : typeCode === 2 ? "user_diets" : "user_habits";
  const { error } = await supabase
    .from(table)
    .update({ scheduled_time: scheduledTime })
    .eq("user_id", userId)
    .eq("id", itemId);
  if (error) {
    console.error("Error updating routine item scheduled_time:", error);
    return false;
  }
  return true;
}

/**
 * Sets the END time of a single habit (`user_habits.scheduled_end_time`), the
 * closing edge of its execution window — `scheduled_time` is the start.
 * Habit-only: workout/diet routines have one shared time, without a window.
 * `null` clears it (habit with no end time). See migration 20260716-habit-end-time.
 */
export async function updateHabitScheduledEndTimeDb(
  userId: string,
  itemId: string,
  endTime: string | null,
): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;
  const { error } = await supabase
    .from("user_habits")
    .update({ scheduled_end_time: endTime })
    .eq("user_id", userId)
    .eq("id", itemId);
  if (error) {
    console.error("Error updating habit scheduled_end_time:", error);
    return false;
  }
  return true;
}

export async function deleteRoutineDb(routineId: string, userId: string): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  const { error } = await supabase
    .from("routines")
    .delete()
    .eq("id", routineId)
    .eq("user_id", userId);

  if (error) throw error;
}

/**
 * Deletes an entire routine card: its user_* items, the history records that
 * reference them, and the matching `routines` rows. `name = null` targets the
 * unnamed group of that type.
 */
export async function deleteRoutineCardDb(
  userId: string,
  typeCode: RoutineTypeCode,
  name: string | null,
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  const table = typeCode === 1 ? "user_workouts" : typeCode === 2 ? "user_diets" : "user_habits";
  const histTable = typeCode === 1 ? "user_workouts_hist" : typeCode === 2 ? "user_diets_hist" : "user_habits_hist";
  const histFk = typeCode === 1 ? "user_workout_id" : typeCode === 2 ? "user_diet_id" : "user_habit_id";

  const idsQuery = supabase.from(table).select("id").eq("user_id", userId);
  const { data: idsData } = name ? await idsQuery.eq("name", name) : await idsQuery.is("name", null);
  const rowIds = (idsData ?? []).map((r: any) => String(r.id));

  // Ids da(s) linha(s) em `routines` — resolvidos ANTES de apagar qualquer coisa,
  // porque `user_workouts_hist.routine_id` também vira NULL quando a rotina sai.
  const routineIdsQuery = supabase
    .from("routines")
    .select("id")
    .eq("user_id", userId)
    .eq("type", typeCode);
  const { data: routineRows } = name
    ? await routineIdsQuery.eq("name", name)
    : await routineIdsQuery.is("name", null);
  const routineIds = (routineRows ?? []).map((r: any) => String(r.id));

  // ── Histórico PRIMEIRO ──
  // As FKs do histórico são ON DELETE SET NULL (não CASCADE): se o item sair
  // antes, o vínculo vira NULL e o registro fica órfão — impossível de casar
  // com a rotina depois. Ver docs/migrations/20260716-hist-delete-rls.sql.
  if (rowIds.length > 0) {
    // `count` em vez de só `error`: sob RLS, um DELETE sem política permissiva
    // NÃO falha — volta 200 com 0 linhas. Era exatamente assim que o histórico
    // sobrevivia em silêncio. Aqui isso vira erro visível.
    const { error: histError, count } = await supabase
      .from(histTable)
      .delete({ count: "exact" })
      .in(histFk, rowIds);
    if (histError) throw histError;
    if (count === 0) {
      // 0 pode ser legítimo (rotina nunca executada). Só logamos: transformar em
      // erro impediria de apagar uma rotina sem histórico.
      console.warn(
        `[deleteRoutineCardDb] 0 registros de ${histTable} apagados para ${rowIds.length} item(ns). ` +
          "Se a rotina tinha histórico, a política de DELETE (RLS) não está aplicada — rodar 20260716-hist-delete-rls.sql.",
      );
    }
  }

  // Séries gravadas sem `user_workout_id` (o vínculo do item) só saem por aqui.
  if (typeCode === 1 && routineIds.length > 0) {
    const { error: byRoutineError } = await supabase
      .from("user_workouts_hist")
      .delete()
      .eq("user_id", userId)
      .in("routine_id", routineIds);
    if (byRoutineError) throw byRoutineError;
  }

  if (rowIds.length > 0) {
    const { error } = await supabase.from(table).delete().in("id", rowIds);
    if (error) throw error;
  }

  const routinesQuery = supabase
    .from("routines")
    .delete()
    .eq("user_id", userId)
    .eq("type", typeCode);
  const { error: routinesError } = name
    ? await routinesQuery.eq("name", name)
    : await routinesQuery.is("name", null);
  if (routinesError) throw routinesError;

  invalidateHistDerivedCaches();
}

/**
 * Derruba tudo que é DERIVADO de `user_workouts_hist`. Chamar depois de apagar
 * rotina ou item — o histórico some do banco, mas as leituras agregadas têm
 * cache longo E persistido em localStorage, então sem isto o app continua
 * mostrando números de um treino que não existe mais:
 *
 *   - `muscleCoverage` (15min) — foi o sintoma relatado: apagar a rotina não
 *     zerava o card de cobertura muscular;
 *   - `exerciseProgress` (15min) — gráfico de progressão de carga;
 *   - `workoutHistory` / `completedRoutines` / `routineLastDates`.
 *
 * A escrita (`saveWorkoutHistoryDb`) já invalidava essas chaves; o caminho de
 * DELETE nunca invalidou nenhuma.
 */
function invalidateHistDerivedCaches() {
  invalidateQueryCache("muscleCoverage");
  invalidateQueryCache("exerciseProgress");
  invalidateQueryCache("workoutHistory");
  invalidateQueryCache("completedRoutines");
  invalidateQueryCache("lastSeries");
}

/** Deletes a single routine item (user_workouts/user_diets/user_habits row) and its history records. */
export async function deleteRoutineItemDb(
  typeCode: RoutineTypeCode,
  itemId: string,
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  const table = typeCode === 1 ? "user_workouts" : typeCode === 2 ? "user_diets" : "user_habits";
  const histTable = typeCode === 1 ? "user_workouts_hist" : typeCode === 2 ? "user_diets_hist" : "user_habits_hist";
  const histFk = typeCode === 1 ? "user_workout_id" : typeCode === 2 ? "user_diet_id" : "user_habit_id";

  // Histórico primeiro (FK é ON DELETE SET NULL — apagar o item antes deixaria
  // o registro órfão) e o erro sobe: engolir aqui deixava histórico para trás.
  const { error: histError } = await supabase.from(histTable).delete().eq(histFk, itemId);
  if (histError) throw histError;

  const { error } = await supabase.from(table).delete().eq("id", itemId);
  if (error) throw error;

  invalidateHistDerivedCaches();
}

// Get items for a specific routine (by routineId when available, falling back to userId + routineName + type)
export async function getRoutineItemsForViewDb(
  userId: string,
  type: number,
  routineName: string | undefined,
  routineId?: string | null,
): Promise<Array<{ id: string; workoutName?: string; dietName?: string; habitName?: string }>> {
  if (!hasSupabaseConfig || !supabase) return [];

  try {
    if (type === 1) {
      const baseQuery = supabase
        .from("user_workouts")
        .select("id, workout_id, name, routine_id")
        .eq("user_id", userId);
      let { data, error } = routineId
        ? await baseQuery.eq("routine_id", Number(routineId))
        : routineName
          ? await baseQuery.eq("name", routineName)
          : await baseQuery.is("name", null);
      if (error || !data || data.length === 0) return [];

      // Step 2: fetch workout names from workouts table
      const workoutIds = [...new Set(data.map((r: any) => r.workout_id).filter(Boolean))];
      const { data: workoutsData } = workoutIds.length > 0
        ? await supabase.from("workouts").select("id, name, name_eng").in("id", workoutIds)
        : { data: [] };
      const nameMap = new Map((workoutsData ?? []).map((w: any) => [String(w.id), pickLocalized(w.name, w.name_eng)]));

      const seen = new Set<string>();
      return data.filter((r: any) => {
        const k = r.workout_id ?? r.id;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }).map((r: any) => ({
        id: String(r.id),
        workoutName: nameMap.get(String(r.workout_id)) || "Exercício",
      }));

    } else if (type === 2) {
      const baseDietQuery = supabase
        .from("user_diets")
        .select("id, diet_id, name, routine_id")
        .eq("user_id", userId);
      let { data, error } = routineId
        ? await baseDietQuery.eq("routine_id", Number(routineId))
        : routineName
          ? await baseDietQuery.eq("name", routineName)
          : await baseDietQuery.is("name", null);
      if (error || !data || data.length === 0) return [];

      const dietIds = [...new Set(data.map((r: any) => r.diet_id).filter(Boolean))];
      const { data: dietsData } = dietIds.length > 0
        ? await supabase.from("diets").select("id, name, name_eng").in("id", dietIds)
        : { data: [] };
      const nameMap = new Map((dietsData ?? []).map((d: any) => [String(d.id), pickLocalized(d.name, d.name_eng)]));

      const seen = new Set<string>();
      return data.filter((r: any) => {
        const k = r.diet_id ?? r.id;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }).map((r: any) => ({
        id: String(r.id),
        dietName: nameMap.get(String(r.diet_id)) || "Dieta",
      }));

    } else {
      const baseHabitQuery = supabase
        .from("user_habits")
        .select("id, habit_id, name, routine_id")
        .eq("user_id", userId);
      let { data, error } = routineId
        ? await baseHabitQuery.eq("routine_id", Number(routineId))
        : routineName
          ? await baseHabitQuery.eq("name", routineName)
          : await baseHabitQuery.is("name", null);
      if (error || !data || data.length === 0) return [];

      const habitIds = [...new Set(data.map((r: any) => r.habit_id).filter(Boolean))];
      const { data: habitsData } = habitIds.length > 0
        ? await supabase.from("habits").select("id, name, name_eng").in("id", habitIds)
        : { data: [] };
      const nameMap = new Map((habitsData ?? []).map((h: any) => [String(h.id), pickLocalized(h.name, h.name_eng)]));

      const seen = new Set<string>();
      return data.filter((r: any) => {
        const k = r.habit_id ?? r.id;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }).map((r: any) => ({
        id: String(r.id),
        habitName: nameMap.get(String(r.habit_id)) || "Hábito",
      }));
    }
  } catch (err) {
    console.error("Error fetching routine items for view:", err);
    return [];
  }
}

// Finds a routine by user+type+name and backfills routine_id on items that are missing it.
// Called after item insertion (trigger creates routine) to link items to their routine.
export async function backfillRoutineIdOnItemsDb(
  userId: string,
  type: number,
  routineName: string | null,
  itemIds: string[],
): Promise<void> {
  if (!hasSupabaseConfig || !supabase || itemIds.length === 0) return;

  const query = supabase
    .from("routines")
    .select("id")
    .eq("user_id", userId)
    .eq("type", type)
    .order("created_at", { ascending: false })
    .limit(1);

  const { data } = routineName
    ? await query.eq("name", routineName)
    : await query.is("name", null);

  const routineId = data?.[0]?.id;
  if (!routineId) return;

  const table = type === 1 ? "user_workouts" : type === 2 ? "user_diets" : "user_habits";
  await supabase
    .from(table)
    .update({ routine_id: routineId })
    .in("id", itemIds.map(Number));
}

export async function getRoutinesByGoalIdDb(
  goalId: string,
  userId?: string,
): Promise<Routine[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  // `goal_id` aponta para uma meta de catálogo compartilhada entre muitos
  // usuários — filtrar só por ela devolveria as rotinas de TODO MUNDO que
  // vinculou uma rotina à mesma meta. O `userId` (dono do post) restringe às
  // rotinas daquele usuário: no próprio post são "as minhas rotinas"; em post
  // de outra pessoa, são as rotinas do autor (que podem ser copiadas).
  let query = supabase
    .from("routines")
    .select("id, user_id, type, goal_id, name")
    .eq("goal_id", goalId);

  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query;

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error fetching routines by goal [${errorCode}]:`, errorMsg);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id ?? ""),
    user_id: String(row.user_id ?? ""),
    type: Number(row.type ?? 1),
    goal_id: row.goal_id ? String(row.goal_id) : null,
    name: row.name ? String(row.name) : undefined,
    last_summary: null,
  }));
}

export type ExerciseRoutine = {
  id: string;
  routineId: string;
  userId: string;
  exerciseName: string;
  exercisePhoto?: string | null;
};

export type UserWorkout = {
  id: string;
  workout_id: string;
  user_id: string;
  name?: string | null;
};

export async function createUserWorkoutsDb(
  userId: string,
  workoutIds: string[],
  options?: {
    name?: string;
    routine_id?: string | null;
  },
): Promise<UserWorkout[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const workoutsToInsert = workoutIds.map((workoutId) => ({
    workout_id: workoutId,
    user_id: userId,
    name: options?.name || null,
    routine_id: options?.routine_id ? Number(options.routine_id) : null,
  }));

  const { data, error } = await supabase
    .from("user_workouts")
    .insert(workoutsToInsert)
    .select(
      "id, workout_id, user_id, name",
    );

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error creating user workouts [${errorCode}]:`, errorMsg);
    throw new Error(`Erro ao salvar exercícios: ${errorMsg}`);
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id ?? ""),
    workout_id: String(row.workout_id ?? ""),
    user_id: String(row.user_id ?? ""),
    name: row.name ? String(row.name) : null,
  }));
}

// Salva a nota de um exercício na rotina (coluna user_workouts.notes).
// Casa por user_id + workout_id (+ routine_id quando houver), assim funciona
// tanto para itens da rotina quanto para exercícios criados na sessão.
export async function updateUserWorkoutNotesDb(
  userId: string,
  workoutId: string,
  routineId: string | null,
  notes: string | null,
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  // Offline: nota vai para a fila e para a cópia local dos exercícios — a
  // próxima abertura do treino (ainda offline) já mostra a nota salva.
  const enqueueOffline = () => {
    enqueueOutbox("workout_notes", { userId, workoutId, routineId, notes });
    offlineCopyPatch<UserWorkoutWithDetails[]>(`userWorkouts:${userId}`, (rows) =>
      rows.map((r) =>
        r.workout_id === workoutId && (routineId == null || r.routine_id === String(routineId))
          ? { ...r, notes }
          : r,
      ),
    );
  };

  if (isLikelyOffline()) {
    enqueueOffline();
    return;
  }

  let query = supabase
    .from("user_workouts")
    .update({ notes })
    .eq("user_id", userId)
    .eq("workout_id", workoutId);
  if (routineId != null) query = query.eq("routine_id", Number(routineId));
  const { error } = await query;
  if (error) {
    if (isOfflineWriteError(error)) {
      enqueueOffline();
      return;
    }
    console.error("Error updating workout note:", error);
    throw error;
  }
}

/**
 * Persiste o tempo de descanso (segundos) de um exercício da rotina em
 * `user_workouts.time_to_rest`, para valer nos próximos treinos. Casa por
 * user_id + workout_id (+ routine_id quando houver). Atualiza também a cópia
 * local (offline) para a próxima abertura já refletir. Best-effort.
 */
export async function updateUserWorkoutRestDb(
  userId: string,
  workoutId: string,
  routineId: string | null,
  restSecs: number,
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  // Espelha na cópia local para a próxima abertura mostrar o novo descanso.
  offlineCopyPatch<UserWorkoutWithDetails[]>(`userWorkouts:${userId}`, (rows) =>
    rows.map((r) =>
      r.workout_id === workoutId && (routineId == null || r.routine_id === String(routineId))
        ? { ...r, time_to_rest: restSecs }
        : r,
    ),
  );

  let query = supabase
    .from("user_workouts")
    .update({ time_to_rest: restSecs })
    .eq("user_id", userId)
    .eq("workout_id", workoutId);
  if (routineId != null) query = query.eq("routine_id", Number(routineId));
  const { error } = await query;
  if (error) {
    // Offline / rede: a cópia local já foi atualizada acima; não derruba o fluxo.
    if (isOfflineWriteError(error)) return;
    console.error("Error updating workout rest time:", error);
    throw error;
  }
}

export type UserWorkoutWithDetails = {
  id: string;
  workout_id: string;
  user_id: string;
  name?: string | null;
  workoutName?: string;
  workoutPhoto?: string | null;
  workoutDescription?: string;
  muscle_group?: string | null;
  created_at?: string | null;
  scheduled_time?: string | null;
  scheduled_days?: string | null;
  notes?: string | null;
  routine_id?: string | null;
  time_to_rest?: number | null;
  /** técnica deste exercício NESTA rotina — ver {@link WorkoutTechnique} */
  technique?: WorkoutTechnique;
  /** chave do bloco de bi-set/tri-set (mesmo valor = mesmo bloco); null fora de bloco */
  technique_group?: string | null;
  /** ordem na rotina (0-based); null = ordem legada por created_at */
  order_index?: number | null;
  // O GRUPO do exercício (variações) NÃO vem daqui de propósito: incluir
  // `workouts.group_id` neste join derrubaria a lista de rotinas inteira em
  // quem ainda não rodou a migração 20260812 (coluna inexistente = erro na
  // query). A sessão resolve o grupo pelo catálogo (`getWorkoutsDb`), que já é
  // cacheado e tem seu próprio fallback.
  /**
   * true = o exercício do catálogo foi criado manualmente por ESTE usuário
   * (`workouts.created_by_user` + `created_by` = dono). Habilita a edição de
   * nome/descrição/foto no detalhe do exercício.
   */
  isCustom?: boolean;
};

/** Uma linha do plano de técnicas de uma rotina. */
export type TechniqueAssignment = {
  /** `user_workouts.id` */
  userWorkoutId: string;
  technique: WorkoutTechnique;
  /** obrigatório para biset/triset, ignorado no resto */
  techniqueGroup?: string | null;
  orderIndex: number;
};

/**
 * Grava o plano de técnicas de uma rotina inteira, de uma vez.
 *
 * É um update por linha (o Supabase não faz UPDATE em lote com valores
 * diferentes por linha sem um upsert que exigiria todas as colunas NOT NULL),
 * mas rodam em paralelo e uma rotina tem poucos exercícios.
 *
 * **Normaliza antes de gravar**: técnica de bloco sem grupo, ou grupo com um
 * membro só, volta para `straight`. Um bi-set órfão renderizaria um bloco de um
 * exercício só — que não é bi-set nenhum, e é o estado em que a rotina fica se
 * o usuário apagar o par depois.
 */
export async function updateRoutineTechniquesDb(
  userId: string,
  assignments: TechniqueAssignment[],
): Promise<void> {
  if (!hasSupabaseConfig || !supabase || assignments.length === 0) return;

  const membersPerGroup = new Map<string, number>();
  for (const a of assignments) {
    if (isBlockTechnique(a.technique) && a.techniqueGroup) {
      membersPerGroup.set(a.techniqueGroup, (membersPerGroup.get(a.techniqueGroup) ?? 0) + 1);
    }
  }

  const normalized = assignments.map((a) => {
    const isBlock =
      isBlockTechnique(a.technique) &&
      !!a.techniqueGroup &&
      (membersPerGroup.get(a.techniqueGroup) ?? 0) >= 2;
    return {
      id: a.userWorkoutId,
      technique: isBlock ? a.technique : isBlockTechnique(a.technique) ? "straight" : a.technique,
      technique_group: isBlock ? a.techniqueGroup! : null,
      order_index: a.orderIndex,
    };
  });

  const results = await Promise.all(
    normalized.map(({ id, ...patch }) =>
      supabase!
        .from("user_workouts")
        .update(patch)
        .eq("id", id)
        .eq("user_id", userId),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    console.error("Error saving routine techniques:", failed.error.message || failed.error);
    throw failed.error;
  }

  // Espelha na cópia offline — a próxima abertura do treino já monta os blocos
  // mesmo sem rede.
  const byId = new Map(normalized.map((n) => [n.id, n]));
  offlineCopyPatch<UserWorkoutWithDetails[]>(`userWorkouts:${userId}`, (rows) =>
    rows.map((r) => {
      const patch = byId.get(r.id);
      if (!patch) return r;
      return {
        ...r,
        technique: toWorkoutTechnique(patch.technique),
        technique_group: patch.technique_group,
        order_index: patch.order_index,
      };
    }), []);
}

export async function getUserWorkoutsDb(
  userId: string,
): Promise<UserWorkoutWithDetails[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  const { data, error } = await supabase
    .from("user_workouts")
    .select(
      "id, workout_id, user_id, name, created_at, scheduled_time, scheduled_days, notes, routine_id, time_to_rest, technique, technique_group, order_index, workouts(name, name_eng, photo, description, description_eng, muscle_group, wger_id, created_by_user, created_by)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    const errorDetails = (error?.details || error?.message || "").toLowerCase();

    // Silently handle relationship errors - try without join and fetch workouts separately
    if (
      errorDetails.includes("relationship") ||
      errorCode === "PGRST200" ||
      errorMsg.includes("relationship")
    ) {
      console.warn(
        `[getUserWorkoutsDb] Relationship error detected, using fallback method: ${errorMsg}`,
      );

      const { data: dataFallback, error: errorFallback } = await supabase
        .from("user_workouts")
        .select(
          "id, workout_id, user_id, name, created_at, scheduled_time, scheduled_days, routine_id, time_to_rest",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!errorFallback && dataFallback) {
        // Fetch workout details separately
        const workoutIds = dataFallback
          .map((row: any) => row.workout_id)
          .filter(Boolean);
        const workoutDetailsMap: { [key: string]: any } = {};

        if (workoutIds.length > 0) {
          const { data: workoutsData } = await supabase
            .from("workouts")
            .select("id, name, name_eng, photo, description, description_eng, muscle_group, wger_id")
            .in("id", workoutIds);

          if (workoutsData) {
            workoutsData.forEach((w: any) => {
              workoutDetailsMap[String(w.id)] = w;
            });
          }
        }

        return (dataFallback ?? []).map((row: any) => {
          const workoutDetails = workoutDetailsMap[String(row.workout_id)];
          return {
            id: String(row.id ?? ""),
            workout_id: String(row.workout_id ?? ""),
            user_id: String(row.user_id ?? ""),
            name: row.name ? String(row.name) : null,
            workoutName: pickLocalized(workoutDetails?.name, workoutDetails?.name_eng) || "Exercício desconhecido",
            workoutPhoto: resolveWorkoutPhotoUrl(workoutDetails?.photo, workoutDetails?.wger_id),
            workoutDescription: pickLocalized(workoutDetails?.description, workoutDetails?.description_eng) || undefined,
            muscle_group: workoutDetails?.muscle_group || null,
            created_at: row.created_at ? String(row.created_at) : null,
            scheduled_time: row.scheduled_time ? String(row.scheduled_time) : null,
            scheduled_days: row.scheduled_days ? String(row.scheduled_days) : null,
            notes: row.notes ? String(row.notes) : null,
            routine_id: row.routine_id != null ? String(row.routine_id) : null,
            time_to_rest: row.time_to_rest != null ? Number(row.time_to_rest) : null,
          };
        });
      } else if (errorFallback) {
        const fallbackMsg = errorFallback?.message || String(errorFallback);
        const fallbackCode = errorFallback?.code || "UNKNOWN";
        console.error(
          `[getUserWorkoutsDb] Fallback also failed [${fallbackCode}]:`,
          fallbackMsg,
        );
      }
    }

    console.error(`Error fetching user workouts [${errorCode}]:`, errorMsg);
    // Sem rede: última cópia local (a tela de Metas continua funcionando offline)
    if (isTransientNetworkError(error)) {
      const off = offlineCopyRead<UserWorkoutWithDetails[]>(`userWorkouts:${userId}`);
      if (off) return off;
    }
    return [];
  }

  const rows = (data ?? []).map((row: any) => ({
    id: String(row.id ?? ""),
    workout_id: String(row.workout_id ?? ""),
    user_id: String(row.user_id ?? ""),
    name: row.name ? String(row.name) : null,
    workoutName: pickLocalized((row.workouts as any)?.name, (row.workouts as any)?.name_eng) || "Exercício desconhecido",
    workoutPhoto: resolveWorkoutPhotoUrl((row.workouts as any)?.photo, (row.workouts as any)?.wger_id),
    workoutDescription: pickLocalized((row.workouts as any)?.description, (row.workouts as any)?.description_eng) || undefined,
    muscle_group: (row.workouts as any)?.muscle_group || null,
    created_at: row.created_at ? String(row.created_at) : null,
    scheduled_time: row.scheduled_time ? String(row.scheduled_time) : null,
    scheduled_days: row.scheduled_days ? String(row.scheduled_days) : null,
    notes: row.notes ? String(row.notes) : null,
    routine_id: row.routine_id != null ? String(row.routine_id) : null,
    time_to_rest: row.time_to_rest != null ? Number(row.time_to_rest) : null,
    technique: toWorkoutTechnique(row.technique),
    technique_group: row.technique_group ? String(row.technique_group) : null,
    order_index: row.order_index != null ? Number(row.order_index) : null,
    // Editável só quando o exercício do catálogo é custom E pertence a quem pediu.
    isCustom:
      !!(row.workouts as any)?.created_by_user &&
      String((row.workouts as any)?.created_by ?? "") === userId,
  }));
  offlineCopyWrite(`userWorkouts:${userId}`, rows);
  return rows;
}

export type UserDiet = {
  id: string;
  diet_id: string;
  user_id: string;
  name?: string | null;
};

export async function createUserDietsDb(
  userId: string,
  dietIds: string[],
  options?: {
    name?: string;
    execute_at?: string | null;
    routine_id?: string | null;
  },
): Promise<UserDiet[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const dietsToInsert = dietIds.map((dietId) => ({
    diet_id: dietId,
    user_id: userId,
    name: options?.name || null,
    execute_at: options?.execute_at || null,
    routine_id: options?.routine_id ? Number(options.routine_id) : null,
  }));

  const { data, error } = await supabase
    .from("user_diets")
    .insert(dietsToInsert)
    .select("id, diet_id, user_id, name");

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error creating user diets [${errorCode}]:`, errorMsg);
    throw new Error(`Erro ao salvar dietas: ${errorMsg}`);
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id ?? ""),
    diet_id: String(row.diet_id ?? ""),
    user_id: String(row.user_id ?? ""),
    name: row.name ? String(row.name) : null,
  }));
}

export type UserDietWithDetails = {
  id: string;
  diet_id: string;
  user_id: string;
  name?: string | null;
  dietName?: string;
  dietPhoto?: string | null;
  dietDescription?: string;
  dietCategory?: string | null;
  dietCalories?: number | null;
  dietProtein?: number | null;
  dietCarbs?: number | null;
  dietFat?: number | null;
  dietFiber?: number | null;
  dietFoodQuality?: "in_natura" | "processado" | "ultraprocessado" | null;
  is_completed?: boolean | null;
  completed_at?: string | null;
  scheduled_time?: string | null;
  scheduled_days?: string | null;
  routine_id?: string | null;
};

export async function getUserDietsDb(
  userId: string,
): Promise<UserDietWithDetails[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  const { data, error } = await supabase
    .from("user_diets")
    .select(
      "id, diet_id, user_id, name, is_completed, completed_at, scheduled_time, scheduled_days, routine_id, diets(name, name_eng, photo, description, description_eng, category, calories, protein_g, carbs_g, fat_g, fiber_g, food_quality)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    const errorDetails = (error?.details || error?.message || "").toLowerCase();

    // Silently handle relationship errors - try without join and fetch diets separately
    if (
      errorDetails.includes("relationship") ||
      errorCode === "PGRST200" ||
      errorMsg.includes("relationship")
    ) {
      console.warn(
        `[getUserDietsDb] Relationship error detected, using fallback method: ${errorMsg}`,
      );

      const { data: dataFallback, error: errorFallback } = await supabase
        .from("user_diets")
        .select("id, diet_id, user_id, name, is_completed, completed_at, scheduled_time, scheduled_days")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!errorFallback && dataFallback) {
        // Fetch diet details separately
        const dietIds = dataFallback
          .map((row: any) => row.diet_id)
          .filter(Boolean);
        const dietDetailsMap: { [key: string]: any } = {};

        if (dietIds.length > 0) {
          const { data: dietsData } = await supabase
            .from("diets")
            .select("id, name, name_eng, photo, description, description_eng, category, calories, protein_g, carbs_g, fat_g, fiber_g, food_quality")
            .in("id", dietIds);

          if (dietsData) {
            dietsData.forEach((d: any) => {
              dietDetailsMap[String(d.id)] = d;
            });
          }
        }

        return (dataFallback ?? []).map((row: any) => {
          const dietDetails = dietDetailsMap[String(row.diet_id)];
          return {
            id: String(row.id ?? ""),
            diet_id: String(row.diet_id ?? ""),
            user_id: String(row.user_id ?? ""),
            name: row.name ? String(row.name) : null,
            dietName: pickLocalized(dietDetails?.name, dietDetails?.name_eng) || "Dieta desconhecida",
            dietPhoto: dietDetails?.photo || null,
            dietDescription: pickLocalized(dietDetails?.description, dietDetails?.description_eng) || undefined,
            dietCategory: dietDetails?.category || null,
            dietCalories: dietDetails?.calories != null ? Number(dietDetails.calories) : null,
            dietProtein: dietDetails?.protein_g != null ? Number(dietDetails.protein_g) : null,
            dietCarbs: dietDetails?.carbs_g != null ? Number(dietDetails.carbs_g) : null,
            dietFat: dietDetails?.fat_g != null ? Number(dietDetails.fat_g) : null,
            dietFiber: dietDetails?.fiber_g != null ? Number(dietDetails.fiber_g) : null,
            dietFoodQuality: dietDetails?.food_quality ?? null,
            is_completed: row.is_completed ?? false,
            completed_at: row.completed_at ?? null,
            scheduled_time: row.scheduled_time ? String(row.scheduled_time) : null,
            scheduled_days: row.scheduled_days ? String(row.scheduled_days) : null,
          };
        });
      } else if (errorFallback) {
        const fallbackMsg = errorFallback?.message || String(errorFallback);
        const fallbackCode = errorFallback?.code || "UNKNOWN";
        console.error(
          `[getUserDietsDb] Fallback also failed [${fallbackCode}]:`,
          fallbackMsg,
        );
      }
    }

    // Last-resort fallback: columns is_completed/completed_at may not exist yet — fetch without them
    console.warn(`[getUserDietsDb] Trying minimal fallback without is_completed/completed_at: ${errorMsg}`);
    const { data: minData, error: minError } = await supabase
      .from("user_diets")
      .select("id, diet_id, user_id, name, diets(name, name_eng, photo, description, description_eng, category)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!minError && minData) {
      return (minData ?? []).map((row: any) => ({
        id: String(row.id ?? ""),
        diet_id: String(row.diet_id ?? ""),
        user_id: String(row.user_id ?? ""),
        name: row.name ? String(row.name) : null,
        dietName: pickLocalized((row.diets as any)?.name, (row.diets as any)?.name_eng) || "Dieta desconhecida",
        dietPhoto: (row.diets as any)?.photo || null,
        dietDescription: pickLocalized((row.diets as any)?.description, (row.diets as any)?.description_eng) || undefined,
        dietCategory: (row.diets as any)?.category || null,
        dietCalories: (row.diets as any)?.calories != null ? Number((row.diets as any).calories) : null,
        dietProtein: (row.diets as any)?.protein_g != null ? Number((row.diets as any).protein_g) : null,
        dietCarbs: (row.diets as any)?.carbs_g != null ? Number((row.diets as any).carbs_g) : null,
        dietFat: (row.diets as any)?.fat_g != null ? Number((row.diets as any).fat_g) : null,
        dietFiber: (row.diets as any)?.fiber_g != null ? Number((row.diets as any).fiber_g) : null,
        dietFoodQuality: (row.diets as any)?.food_quality ?? null,
        is_completed: false,
        completed_at: null,
      }));
    }

    console.error(`Error fetching user diets [${errorCode}]:`, errorMsg);
    // Sem rede: última cópia local (a tela de Metas continua funcionando offline)
    if (isTransientNetworkError(error)) {
      const off = offlineCopyRead<UserDietWithDetails[]>(`userDiets:${userId}`);
      if (off) return off;
    }
    return [];
  }

  const rows = (data ?? []).map((row: any) => ({
    id: String(row.id ?? ""),
    diet_id: String(row.diet_id ?? ""),
    user_id: String(row.user_id ?? ""),
    name: row.name ? String(row.name) : null,
    dietName: pickLocalized((row.diets as any)?.name, (row.diets as any)?.name_eng) || "Dieta desconhecida",
    dietPhoto: (row.diets as any)?.photo || null,
    dietDescription: pickLocalized((row.diets as any)?.description, (row.diets as any)?.description_eng) || undefined,
    dietCategory: (row.diets as any)?.category || null,
    dietCalories: (row.diets as any)?.calories != null ? Number((row.diets as any).calories) : null,
    dietProtein: (row.diets as any)?.protein_g != null ? Number((row.diets as any).protein_g) : null,
    dietCarbs: (row.diets as any)?.carbs_g != null ? Number((row.diets as any).carbs_g) : null,
    dietFat: (row.diets as any)?.fat_g != null ? Number((row.diets as any).fat_g) : null,
    dietFiber: (row.diets as any)?.fiber_g != null ? Number((row.diets as any).fiber_g) : null,
    dietFoodQuality: (row.diets as any)?.food_quality ?? null,
    is_completed: row.is_completed ?? false,
    completed_at: row.completed_at ?? null,
    scheduled_time: row.scheduled_time ? String(row.scheduled_time) : null,
    scheduled_days: row.scheduled_days ? String(row.scheduled_days) : null,
    routine_id: row.routine_id != null ? String(row.routine_id) : null,
  }));
  offlineCopyWrite(`userDiets:${userId}`, rows);
  return rows;
}

export type UserHabit = {
  id: string;
  habit_id: string;
  user_id: string;
  name?: string | null;
};

export async function createUserHabitsDb(
  userId: string,
  habitIds: string[],
  options?: {
    name?: string;
    execute_at?: string | null;
    routine_id?: string | null;
  },
): Promise<UserHabit[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const habitsToInsert = habitIds.map((habitId) => ({
    habit_id: habitId,
    user_id: userId,
    name: options?.name || null,
    execute_at: options?.execute_at || null,
    routine_id: options?.routine_id ? Number(options.routine_id) : null,
  }));

  const { data, error } = await supabase
    .from("user_habits")
    .insert(habitsToInsert)
    .select("id, habit_id, user_id, name");

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error creating user habits [${errorCode}]:`, errorMsg);
    throw new Error(`Erro ao salvar hábitos: ${errorMsg}`);
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id ?? ""),
    habit_id: String(row.habit_id ?? ""),
    user_id: String(row.user_id ?? ""),
    name: row.name ? String(row.name) : null,
  }));
}

export type UserHabitWithDetails = {
  id: string;
  habit_id: string;
  user_id: string;
  name?: string | null;
  habitName?: string;
  habitDescription?: string;
  is_completed?: boolean | null;
  completed_at?: string | null;
  /** Hora de INÍCIO do hábito. */
  scheduled_time?: string | null;
  /** Hora de FIM (janela de execução). null = sem hora de fim. */
  scheduled_end_time?: string | null;
  scheduled_days?: string | null;
  routine_id?: string | null;
};

export async function getUserHabitsDb(
  userId: string,
): Promise<UserHabitWithDetails[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  const { data, error } = await supabase
    .from("user_habits")
    .select("id, habit_id, user_id, name, is_completed, completed_at, scheduled_time, scheduled_end_time, scheduled_days, routine_id, habits(name, name_eng, description, description_eng)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    const errorDetails = (error?.details || error?.message || "").toLowerCase();

    const isRelationshipError =
      errorDetails.includes("relationship") ||
      errorCode === "PGRST200" ||
      errorMsg.includes("relationship");

    if (isRelationshipError) {
      console.warn(`[getUserHabitsDb] Relationship error, using fallback: ${errorMsg}`);
    }

    // Fallback 1: no join, with optional columns (is_completed only — completed_at may not exist)
    const { data: fb1Data, error: fb1Error } = await supabase
      .from("user_habits")
      .select("id, habit_id, user_id, name, is_completed, completed_at, scheduled_time, scheduled_days")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!fb1Error && fb1Data) {
      const habitIds = fb1Data.map((row: any) => row.habit_id).filter(Boolean);
      const habitDetailsMap: { [key: string]: any } = {};
      if (habitIds.length > 0) {
        const { data: habitsData } = await supabase
          .from("habits")
          .select("id, name, name_eng, description, description_eng")
          .in("id", habitIds);
        if (habitsData) {
          habitsData.forEach((h: any) => { habitDetailsMap[String(h.id)] = h; });
        }
      }
      return fb1Data.map((row: any) => {
        const hd = habitDetailsMap[String(row.habit_id)];
        return {
          id: String(row.id ?? ""),
          habit_id: String(row.habit_id ?? ""),
          user_id: String(row.user_id ?? ""),
          name: row.name ? String(row.name) : null,
          habitName: pickLocalized(hd?.name, hd?.name_eng) || "Hábito desconhecido",
          habitDescription: pickLocalized(hd?.description, hd?.description_eng) || undefined,
          is_completed: row.is_completed ?? false,
          completed_at: row.completed_at ?? null,
          scheduled_time: row.scheduled_time ? String(row.scheduled_time) : null,
          scheduled_days: row.scheduled_days ? String(row.scheduled_days) : null,
        };
      });
    }

    // Fallback 2: only guaranteed columns exist (no join, no optional columns)
    console.warn(`[getUserHabitsDb] Fallback 1 failed, trying minimal fetch: ${fb1Error?.message}`);
    const { data: fb2Data, error: fb2Error } = await supabase
      .from("user_habits")
      .select("id, habit_id, user_id, name, is_completed")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!fb2Error && fb2Data) {
      const habitIds = fb2Data.map((row: any) => row.habit_id).filter(Boolean);
      const habitDetailsMap: { [key: string]: any } = {};
      if (habitIds.length > 0) {
        const { data: habitsData } = await supabase
          .from("habits")
          .select("id, name, name_eng, description, description_eng")
          .in("id", habitIds);
        if (habitsData) {
          habitsData.forEach((h: any) => { habitDetailsMap[String(h.id)] = h; });
        }
      }
      return fb2Data.map((row: any) => {
        const hd = habitDetailsMap[String(row.habit_id)];
        return {
          id: String(row.id ?? ""),
          habit_id: String(row.habit_id ?? ""),
          user_id: String(row.user_id ?? ""),
          name: row.name ? String(row.name) : null,
          habitName: pickLocalized(hd?.name, hd?.name_eng) || "Hábito desconhecido",
          habitDescription: pickLocalized(hd?.description, hd?.description_eng) || undefined,
          is_completed: row.is_completed ?? false,
          completed_at: null,
          scheduled_time: null,
        };
      });
    }

    // Fallback 3: absolute minimum — just IDs and name column
    console.warn(`[getUserHabitsDb] Fallback 2 failed, trying absolute minimum: ${fb2Error?.message}`);
    const { data: fb3Data } = await supabase
      .from("user_habits")
      .select("id, habit_id, user_id, name")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (fb3Data && fb3Data.length > 0) {
      return fb3Data.map((row: any) => ({
        id: String(row.id ?? ""),
        habit_id: String(row.habit_id ?? ""),
        user_id: String(row.user_id ?? ""),
        name: row.name ? String(row.name) : null,
        habitName: "Hábito desconhecido",
        habitDescription: undefined,
        is_completed: false,
        completed_at: null,
        scheduled_time: null,
      }));
    }

    console.error(`Error fetching user habits [${errorCode}]:`, errorMsg);
    // Sem rede: última cópia local (a tela de Metas continua funcionando offline)
    if (isTransientNetworkError(error)) {
      const off = offlineCopyRead<UserHabitWithDetails[]>(`userHabits:${userId}`);
      if (off) return off;
    }
    return [];
  }

  const rows = (data ?? []).map((row: any) => ({
    id: String(row.id ?? ""),
    habit_id: String(row.habit_id ?? ""),
    user_id: String(row.user_id ?? ""),
    name: row.name ? String(row.name) : null,
    habitName: pickLocalized((row.habits as any)?.name, (row.habits as any)?.name_eng) || "Hábito desconhecido",
    habitDescription: pickLocalized((row.habits as any)?.description, (row.habits as any)?.description_eng) || undefined,
    is_completed: row.is_completed ?? false,
    completed_at: row.completed_at ?? null,
    scheduled_time: row.scheduled_time ? String(row.scheduled_time) : null,
    // Ausente nos fallbacks (e antes da migração 20260716) → null, e o app
    // segue funcionando só com a hora de início.
    scheduled_end_time: row.scheduled_end_time ? String(row.scheduled_end_time) : null,
    scheduled_days: row.scheduled_days ? String(row.scheduled_days) : null,
    routine_id: row.routine_id != null ? String(row.routine_id) : null,
  }));
  offlineCopyWrite(`userHabits:${userId}`, rows);
  return rows;
}

// Routine Scheduled Time

export type RoutineKind = "workout" | "diet" | "habit";

export type RoutineScheduleEntry = {
  id: string;
  type: RoutineKind;
  name: string;
  scheduled_time: string;
  /** comma-separated Monday-first weekday indices (0=Mon…6=Sun); null/"" = daily */
  scheduled_days: string | null;
  /**
   * Qual borda da janela este agendamento representa. Um hábito com hora de fim
   * gera DUAS entradas (início e fim) — assim o agendador continua tratando
   * cada entrada como "um horário", só mudando o texto da notificação.
   */
  phase?: "start" | "end";
};

export async function getRoutineSchedulesDb(
  userId: string,
): Promise<RoutineScheduleEntry[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const [workoutsRes, dietsRes, habitsRes] = await Promise.all([
    supabase
      .from("user_workouts")
      .select("id, name, scheduled_time, scheduled_days, workouts(name, name_eng)")
      .eq("user_id", userId)
      .not("scheduled_time", "is", null),
    supabase
      .from("user_diets")
      .select("id, name, scheduled_time, scheduled_days, diets(name, name_eng)")
      .eq("user_id", userId)
      .not("scheduled_time", "is", null),
    supabase
      .from("user_habits")
      .select("id, name, scheduled_time, scheduled_end_time, scheduled_days, habits(name, name_eng)")
      .eq("user_id", userId)
      .not("scheduled_time", "is", null),
  ]);

  const results: RoutineScheduleEntry[] = [];

  (workoutsRes.data ?? []).forEach((row: any) => {
    results.push({
      id: String(row.id),
      type: "workout",
      name: row.name || pickLocalized((row.workouts as any)?.name, (row.workouts as any)?.name_eng) || "Treino",
      scheduled_time: String(row.scheduled_time),
      scheduled_days: row.scheduled_days ? String(row.scheduled_days) : null,
    });
  });
  (dietsRes.data ?? []).forEach((row: any) => {
    results.push({
      id: String(row.id),
      type: "diet",
      name: row.name || pickLocalized((row.diets as any)?.name, (row.diets as any)?.name_eng) || "Dieta",
      scheduled_time: String(row.scheduled_time),
      scheduled_days: row.scheduled_days ? String(row.scheduled_days) : null,
    });
  });
  (habitsRes.data ?? []).forEach((row: any) => {
    const name = row.name || pickLocalized((row.habits as any)?.name, (row.habits as any)?.name_eng) || "Hábito";
    const days = row.scheduled_days ? String(row.scheduled_days) : null;
    results.push({
      id: String(row.id),
      type: "habit",
      name,
      scheduled_time: String(row.scheduled_time),
      scheduled_days: days,
      phase: "start",
    });
    // Hora de fim → um segundo lembrete ("hora de encerrar"). Sem fim
    // (o normal em hábitos pontuais), nada muda.
    if (row.scheduled_end_time) {
      results.push({
        id: `${row.id}:end`,
        type: "habit",
        name,
        scheduled_time: String(row.scheduled_end_time),
        scheduled_days: days,
        phase: "end",
      });
    }
  });

  return results;
}

// Search Functions

export type SearchUser = {
  id: string;
  nickname: string;
  bio?: string;
  photo?: string | null;
};

export async function searchUsersDb(query: string): Promise<SearchUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  if (!query.trim()) return [];

  const searchQuery = `%${query.toLowerCase()}%`;

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, nickname, bio, photo")
    .ilike("nickname", searchQuery)
    .limit(20);

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error searching users [${errorCode}]:`, errorMsg);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.user_id ?? ""),
    nickname: String(row.nickname ?? "Usuário"),
    bio: row.bio ? String(row.bio) : undefined,
    photo: row.photo ? String(row.photo) : null,
  }));
}

export type SearchWorkout = {
  id: string;
  userWorkoutId: string;
  userId: string;
  userName: string;
  userPhoto?: string | null;
  workoutName: string;
  workoutDescription?: string;
  workoutPhoto?: string | null;
};

export type SearchDiet = {
  id: string;
  userDietId: string;
  userId: string;
  userName: string;
  userPhoto?: string | null;
  dietName: string;
  dietDescription?: string;
  dietPhoto?: string | null;
};

// Search routines by name from the routines table (type 1=workout, 2=diet)
export type RoutineResult = {
  routineId: string;
  routineName: string | null;
  routineType: number;
  userId: string;
  userNickname: string;
  userPhoto: string | null;
};

export async function searchRoutinesDb(
  query: string,
  routineType: 1 | 2,
  excludeUserId?: string,
): Promise<RoutineResult[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  try {
    // Query routines grouped by name+user — include named AND unnamed routines
    let dbQuery = supabase
      .from("routines")
      .select("id, user_id, type, name")
      .eq("type", routineType)
      .is("follower_id", null);

    if (query.trim()) {
      dbQuery = dbQuery.ilike("name", `%${query.trim()}%`);
    }

    if (excludeUserId) {
      dbQuery = dbQuery.neq("user_id", excludeUserId);
    }

    const { data, error } = await dbQuery
      .order("user_id", { ascending: true })
      .limit(50);

    if (error || !data?.length) return [];

    // Deduplicate by name+user_id (null name counts as one per user)
    const seen = new Set<string>();
    const unique = (data as any[]).filter((row) => {
      const key = `${row.user_id}::${row.name ?? "__unnamed__"}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Batch-fetch profiles
    const userIds = [...new Set(unique.map((r: any) => String(r.user_id)))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nickname, photo")
      .in("user_id", userIds);

    const profileMap = new Map(
      (profiles ?? []).map((p: any) => [String(p.user_id), p]),
    );

    return unique
      .map((row: any) => {
        const profile = profileMap.get(String(row.user_id));
        return {
          routineId: String(row.id),
          routineName: row.name ? String(row.name) : null,
          routineType: Number(row.type),
          userId: String(row.user_id),
          userNickname: profile?.nickname ? String(profile.nickname) : "Usuário",
          userPhoto: profile?.photo ? String(profile.photo) : null,
        };
      })
      .sort((a, b) => a.userNickname.localeCompare(b.userNickname));
  } catch (err: any) {
    console.error("Error searching routines:", err);
    return [];
  }
}

// Returns keys ("sourceUserId::routineName") for routines the current user has already copied
export async function getCopiedRoutineKeysDb(currentUserId: string): Promise<Set<string>> {
  if (!hasSupabaseConfig || !supabase) return new Set();
  try {
    const { data, error } = await supabase
      .from("routines")
      .select("follower_id, name")
      .eq("user_id", currentUserId)
      .not("follower_id", "is", null);
    if (error || !data?.length) return new Set();
    return new Set(
      (data as any[]).map((row) => `${String(row.follower_id)}::${row.name ?? null}`)
    );
  } catch {
    return new Set();
  }
}

// Fetch exercises for a user's workout routine (for dropdown display)
export type RoutineItemRow = {
  id: string;
  itemId: string;
  itemName: string;
};

export async function getRoutineWorkoutsDb(userId: string, routineName: string | null): Promise<RoutineItemRow[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  try {
    const baseQuery = supabase
      .from("user_workouts")
      .select("id, workout_id, workouts(name, name_eng)")
      .eq("user_id", userId)
      .limit(30);
    const { data, error } = routineName
      ? await baseQuery.eq("name", routineName)
      : await baseQuery.is("name", null);

    if (!error && data) {
      return data.map((r: any) => ({
        id: String(r.id),
        itemId: String(r.workout_id),
        itemName: pickLocalized((r.workouts as any)?.name, (r.workouts as any)?.name_eng) || "Exercício",
      }));
    }

    // Fallback: fetch without join then resolve names separately
    const fbBase = supabase
      .from("user_workouts")
      .select("id, workout_id")
      .eq("user_id", userId)
      .limit(30);
    const { data: fb } = routineName
      ? await fbBase.eq("name", routineName)
      : await fbBase.is("name", null);

    if (!fb?.length) return [];

    const workoutIds = fb.map((r: any) => r.workout_id).filter(Boolean);
    const namesMap: Record<string, string> = {};
    if (workoutIds.length > 0) {
      const { data: wData } = await supabase
        .from("workouts")
        .select("id, name, name_eng")
        .in("id", workoutIds);
      (wData ?? []).forEach((w: any) => { namesMap[String(w.id)] = pickLocalized(w.name, w.name_eng); });
    }

    return fb.map((r: any) => ({
      id: String(r.id),
      itemId: String(r.workout_id),
      itemName: namesMap[String(r.workout_id)] || "Exercício",
    }));
  } catch {
    return [];
  }
}

export async function getRoutineDietsDb(userId: string, routineName: string | null): Promise<RoutineItemRow[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  try {
    const baseQuery = supabase
      .from("user_diets")
      .select("id, diet_id, diets(name, name_eng)")
      .eq("user_id", userId)
      .limit(30);
    const { data, error } = routineName
      ? await baseQuery.eq("name", routineName)
      : await baseQuery.is("name", null);

    if (!error && data) {
      return data.map((r: any) => ({
        id: String(r.id),
        itemId: String(r.diet_id),
        itemName: pickLocalized((r.diets as any)?.name, (r.diets as any)?.name_eng) || "Alimento",
      }));
    }

    // Fallback: fetch without join then resolve names separately
    const fbBase = supabase
      .from("user_diets")
      .select("id, diet_id")
      .eq("user_id", userId)
      .limit(30);
    const { data: fb } = routineName
      ? await fbBase.eq("name", routineName)
      : await fbBase.is("name", null);

    if (!fb?.length) return [];

    const dietIds = fb.map((r: any) => r.diet_id).filter(Boolean);
    const namesMap: Record<string, string> = {};
    if (dietIds.length > 0) {
      const { data: dData } = await supabase
        .from("diets")
        .select("id, name, name_eng")
        .in("id", dietIds);
      (dData ?? []).forEach((d: any) => { namesMap[String(d.id)] = pickLocalized(d.name, d.name_eng); });
    }

    return fb.map((r: any) => ({
      id: String(r.id),
      itemId: String(r.diet_id),
      itemName: namesMap[String(r.diet_id)] || "Alimento",
    }));
  } catch {
    return [];
  }
}

// Copy all workouts, diets or habits from one user to another
export async function copyRoutineToUserDb(
  sourceUserId: string,
  targetUserId: string,
  routineType: 1 | 2 | 3,
  routineName: string | null,
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  // Step 1: Insert the actual items — the DB trigger will create the routines entry.
  if (routineType === 1) {
    const query = supabase
      .from("user_workouts")
      .select("workout_id, name")
      .eq("user_id", sourceUserId);

    const { data, error } = routineName
      ? await query.eq("name", routineName)
      : await query.is("name", null);

    if (error || !data?.length) throw new Error("Nenhum treino encontrado.");

    const toInsert = data.map((row: any) => ({
      workout_id: row.workout_id,
      user_id: targetUserId,
      name: row.name ?? null,
    }));

    const { error: insertError } = await supabase.from("user_workouts").insert(toInsert);
    if (insertError) throw new Error(insertError.message);
  } else {
    const query = supabase
      .from("user_diets")
      .select("diet_id, name")
      .eq("user_id", sourceUserId);

    const { data, error } = routineName
      ? await query.eq("name", routineName)
      : await query.is("name", null);

    if (error || !data?.length) throw new Error("Nenhuma dieta encontrada.");

    const toInsert = data.map((row: any) => ({
      diet_id: row.diet_id,
      user_id: targetUserId,
      name: row.name ?? null,
    }));

    const { error: insertError } = await supabase.from("user_diets").insert(toInsert);
    if (insertError) throw new Error(insertError.message);
  }

  // Step 2: Set follower_id on the routines entry created by the trigger.
  const finalUpdateQuery = supabase
    .from("routines")
    .update({ follower_id: sourceUserId })
    .eq("user_id", targetUserId)
    .eq("type", routineType);

  const { error: finalUpdateError } = routineName
    ? await finalUpdateQuery.eq("name", routineName)
    : await finalUpdateQuery.is("name", null);

  if (finalUpdateError) console.error("Error setting follower_id after copy:", finalUpdateError.message);
}

// Following Functions

export async function getAllUsersDb(
  excludeUserId?: string,
  limit = 100,
  offset = 0,
): Promise<SearchUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  return cached("allUsers", CACHE_TTL_MEDIUM, async () => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, nickname, bio, photo")
      .order("nickname", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      const errorMsg = error?.message || String(error);
      const errorCode = error?.code || "UNKNOWN";
      console.error(`Error fetching all users [${errorCode}]:`, errorMsg);
      return [];
    }

    const allUsers = (data ?? []).map((row: any) => ({
      id: String(row.user_id ?? ""),
      nickname: String(row.nickname ?? "Usuário"),
      bio: row.bio ? String(row.bio) : undefined,
      photo: row.photo ? String(row.photo) : null,
    }));

    // Filter out the current user if excludeUserId is provided
    if (excludeUserId) {
      return allUsers.filter((user) => user.id !== excludeUserId);
    }

    return allUsers;
  } catch (err: any) {
    console.error("Error fetching all users:", err);
    return [];
  }

  });
}

export async function followUserDb(followingId: string): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  const viewer = await getViewer();
  if (!viewer) return false;

  const { error } = await supabase.from("following").insert({
    user_id: viewer.id,
    following_id: followingId,
  });

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error following user [${errorCode}]:`, errorMsg);
    return false;
  }

  invalidateQueryCache("following"); invalidateQueryCache("followers"); invalidateQueryCache("followingIds"); invalidateQueryCache("userStats"); invalidateQueryCache("isFollowing");
  return true;
}

export async function unfollowUserDb(followingId: string): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  const viewer = await getViewer();
  if (!viewer) return false;

  const { error } = await supabase
    .from("following")
    .delete()
    .eq("user_id", viewer.id)
    .eq("following_id", followingId);

  if (error) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || "UNKNOWN";
    console.error(`Error unfollowing user [${errorCode}]:`, errorMsg);
    return false;
  }

  invalidateQueryCache("following"); invalidateQueryCache("followers"); invalidateQueryCache("followingIds"); invalidateQueryCache("userStats"); invalidateQueryCache("isFollowing");
  return true;
}

export async function isFollowingDb(followingId: string): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  const viewer = await getViewer();
  if (!viewer) return false;

  return cached(`isFollowing:${viewer.id}:${followingId}`, CACHE_TTL_SHORT, async () => {
    const { data, error } = await supabase!
      .from("following")
      .select("id")
      .eq("user_id", viewer.id)
      .eq("following_id", followingId)
      .maybeSingle();

    if (error) {
      console.error("Error checking if following:", error);
      return false;
    }

    return !!data;
  });
}

export async function getFollowingIdsDb(): Promise<string[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  // Viewer fora do cached(): um viewer null logo após o login fazia esta
  // função cachear/persistir uma lista vazia — o feed passava a mostrar só os
  // posts do próprio usuário até o cache expirar.
  const viewer = await getViewer();
  if (!viewer) return [];
  return cached(`followingIds:${viewer.id}`, CACHE_TTL_MEDIUM, async () => {

  const { data, error } = await supabase
    .from("following")
    .select("following_id")
    .eq("user_id", viewer.id);

  if (error) {
    console.error("Error fetching following IDs:", error);
    return [];
  }

  return (data ?? []).map((row: any) => String(row.following_id ?? ""));

  });
}

// Stories functionality
export type StoryTextPosition = { x: number; y: number }; // percentages 0–100
export type StoryTextStyle = {
  fontFamily?: string;
  fontWeight?: number;
  align?: "left" | "center" | "right";
  color?: string;
  fontSize?: number; // px; ausente em flows antigos → cai para 30 (equivalente ao text-3xl)
  backgroundColor?: string | null; // realce de fundo estilo Instagram; ausente/null = sem fundo
};
export type StoryTextElement = { text: string; x: number; y: number; style?: StoryTextStyle }; // x/y in %
// Enquadramento da mídia (vídeo): scale unitário, x/y em % do tamanho do elemento
export type StoryMediaTransform = { scale: number; x: number; y: number };

export type Story = {
  id: string;
  user_id: string;
  description: string;
  media_url: string;
  /**
   * Capa do vídeo (1º frame em JPEG, ~720px). O viewer pinta esse frame na hora em que
   * o flow abre, enquanto o clipe ainda está baixando — é o que evita a tela preta.
   * Só existe para flows de vídeo; imagens não precisam.
   */
  poster_url?: string | null;
  /**
   * Duração real do vídeo em ms, medida no cliente ao postar.
   *
   * O `MediaRecorder` do iOS grava MP4 fragmentado, cujo cabeçalho não traz a duração:
   * no viewer, `video.duration` fica `Infinity` até o arquivo INTEIRO baixar — e a barra
   * de progresso fica parada até lá. Com este valor vindo do banco, a barra acompanha o
   * vídeo desde o primeiro frame, sem depender do download terminar.
   */
  duration_ms?: number | null;
  background_color?: string | null;
  text_position?: StoryTextPosition | null;
  text_elements?: StoryTextElement[] | null;
  media_transform?: StoryMediaTransform | null;
  reposted_from?: string | null;
  reposted_from_user?: string | null;
  created_at: string;
};

export type StoryWithUser = Story & {
  userNickname: string;
  userPhoto: string | null;
  /** Pessoas marcadas neste flow (estilo Instagram). */
  taggedUsers?: SearchUser[];
  /** Atribuição de repost: apelido de quem postou o flow original. */
  repostedFromNickname?: string | null;
};

// Com a duração real do vídeo (migração 20260812-flow-duration)
const FLOW_COLS_DURATION =
  "id, user_id, description, media_url, poster_url, duration_ms, background_color, text_position, text_elements, media_transform, created_at";
// Com a capa do vídeo (migração 20260812-flow-poster)
const FLOW_COLS_POSTER =
  "id, user_id, description, media_url, poster_url, background_color, text_position, text_elements, media_transform, created_at";
const FLOW_COLS_FULL =
  "id, user_id, description, media_url, background_color, text_position, text_elements, media_transform, created_at";
// Sem media_transform (banco ainda não migrado), mas preserva os textos
const FLOW_COLS_TEXT =
  "id, user_id, description, media_url, background_color, text_position, text_elements, created_at";
const FLOW_COLS_BASE =
  "id, user_id, description, media_url, background_color, created_at";
// Degradação em camadas: DURATION → POSTER → FULL → TEXT → BASE (cada queda remove só
// o que falta). A primeira query da sessão paga o erro 42703 e o cache guarda o nível.
const FLOW_COLS_TIERS = [
  FLOW_COLS_DURATION,
  FLOW_COLS_POSTER,
  FLOW_COLS_FULL,
  FLOW_COLS_TEXT,
  FLOW_COLS_BASE,
];
let flowColsCache = FLOW_COLS_DURATION;

// PostgREST code for "undefined column"
const isMissingColumnError = (err: any) =>
  err?.code === "42703" || /column .* does not exist/i.test(err?.message ?? "");

async function selectFlow(builder: (cols: string) => any): Promise<{ data: any[]; error: any }> {
  let idx = FLOW_COLS_TIERS.indexOf(flowColsCache);
  if (idx < 0) idx = 0;
  let result = await builder(FLOW_COLS_TIERS[idx]);
  while (result.error && isMissingColumnError(result.error) && idx < FLOW_COLS_TIERS.length - 1) {
    idx++;
    console.warn(`[flow] coluna ausente — caindo para colunas: ${FLOW_COLS_TIERS[idx]}`);
    flowColsCache = FLOW_COLS_TIERS[idx];
    result = await builder(FLOW_COLS_TIERS[idx]);
  }
  return { data: result.data ?? [], error: result.error };
}

export async function getActiveStoriesDb(): Promise<StoryWithUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  const viewer = await getViewer();
  if (!viewer) return [];
  return cached(`activeStories:${viewer.id}`, CACHE_TTL_MEDIUM, async () => {

  // Get stories from the last 24 hours
  const twentyFourHoursAgo = new Date(
    Date.now() - 24 * 60 * 60 * 1000,
  ).toISOString();

  try {
    // Get current user's following IDs
    const followingIds = await getFollowingIdsDb();
    const userIdsToShow = [viewer.id, ...followingIds];

    // Fetch flows and profiles in parallel
    const [flowResult, profilesResult] = await Promise.all([
      selectFlow((cols) =>
        supabase!
          .from("flow")
          .select(cols)
          .in("user_id", userIdsToShow)
          .gte("created_at", twentyFourHoursAgo)
          .order("created_at", { ascending: false }),
      ),
      supabase
        .from("profiles")
        .select("user_id, nickname, photo")
        .in("user_id", userIdsToShow),
    ]);

    if (flowResult.error) {
      console.error("Error fetching stories:", flowResult.error);
      return [];
    }

    const storyList = flowResult.data ?? [];
    const profileMap = new Map<string, { nickname: string; photo: string | null }>();
    (profilesResult.data ?? []).forEach((p: any) => {
      profileMap.set(String(p.user_id), {
        nickname: String(p.nickname ?? "Usuário"),
        photo: p.photo ? String(p.photo) : null,
      });
    });

    return storyList.map((story: any) => {
      const profile = profileMap.get(story.user_id) ?? { nickname: "Usuário", photo: null};
      return {
        ...story,
        id: String(story.id),
        user_id: String(story.user_id),
        userNickname: profile.nickname,
        userPhoto: profile.photo,
      };
    });
  } catch (err: any) {
    console.error("Error fetching active stories:", err);
    return [];
  }

  });
}

export async function getUserActiveStoriesDb(userId: string): Promise<StoryWithUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  return cached(`userActiveStories:${userId}`, CACHE_TTL_MEDIUM, async () => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    try {
      const [flowResult, profileResult] = await Promise.all([
        selectFlow((cols) =>
          supabase!
            .from("flow")
            .select(cols)
            .eq("user_id", userId)
            .gte("created_at", twentyFourHoursAgo)
            .order("created_at", { ascending: true }),
        ),
        supabase!
          .from("profiles")
          .select("user_id, nickname, photo")
          .eq("user_id", userId)
          .limit(1),
      ]);

      if (flowResult.error || !flowResult.data?.length) return [];

      const profile = profileResult.data?.[0];

      return flowResult.data.map((story: any) => ({
        ...story,
        id: String(story.id),
        user_id: String(story.user_id),
        userNickname: profile?.nickname ?? "Usuário",
        userPhoto: profile?.photo ?? null,
      }));
    } catch (err: any) {
      console.error("Error fetching user stories:", err);
      return [];
    }
  });
}

export async function getExpiredUserFlowsDb(): Promise<StoryWithUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const viewer = await getViewer();
  if (!viewer) return [];

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    const [flowResult, profileResult] = await Promise.all([
      // selectFlow (em vez de uma lista fixa de colunas) para trazer também capa e
      // duração: republicar um flow do arquivo reaproveita a mesma mídia, e sem esses
      // campos o novo flow abriria com tela preta e barra dessincronizada.
      selectFlow((cols) =>
        supabase!
          .from("flow")
          .select(cols)
          .eq("user_id", viewer.id)
          .lt("created_at", twentyFourHoursAgo)
          .order("created_at", { ascending: false }),
      ),
      supabase
        .from("profiles")
        .select("user_id, nickname, photo")
        .eq("user_id", viewer.id)
        .limit(1),
    ]);

    if (flowResult.error || !flowResult.data?.length) return [];

    const profile = profileResult.data?.[0];

    return flowResult.data.map((story: any) => ({
      ...story,
      id: String(story.id),
      user_id: String(story.user_id),
      userNickname: profile?.nickname ?? "Usuário",
      userPhoto: profile?.photo ?? null,
    }));
  } catch (err: any) {
    console.error("Error fetching expired flows:", err);
    return [];
  }
}

// Busca um flow por id independente do dono ou de já ter expirado (>24h).
// Usado para redirecionar notificações de reação/comentário quando o flow
// não está mais no ring ativo (getActiveStoriesDb já não o retorna).
export async function getFlowByIdDb(flowId: string): Promise<StoryWithUser | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  try {
    const { data: flowRows, error } = await selectFlow((cols) =>
      supabase!.from("flow").select(cols).eq("id", flowId).limit(1),
    );
    if (error || !flowRows.length) return null;

    const story = flowRows[0];
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("user_id, nickname, photo")
      .eq("user_id", story.user_id)
      .limit(1);

    const profile = profileRows?.[0];

    return {
      ...story,
      id: String(story.id),
      user_id: String(story.user_id),
      userNickname: profile?.nickname ?? "Usuário",
      userPhoto: profile?.photo ?? null,
    };
  } catch (err: any) {
    console.error("Error fetching flow by id:", err);
    return null;
  }
}

export async function createStoryDb(
  description: string,
  mediaUrl: string,
  backgroundColor?: string | null,
  textPosition?: StoryTextPosition | null,
  textElements?: StoryTextElement[] | null,
  mediaTransform?: StoryMediaTransform | null,
  taggedUserIds?: string[],
  repost?: { fromFlowId: string; fromUser: string } | null,
  /** Metadados do vídeo medidos no cliente ao postar (capa + duração real). */
  videoMeta?: { posterUrl?: string | null; durationMs?: number | null } | null,
): Promise<Story | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  const viewer = await getViewer();
  if (!viewer) return null;

  try {
    const fullPayload: Record<string, any> = {
      user_id: viewer.id,
      description,
      media_url: mediaUrl,
      poster_url: videoMeta?.posterUrl || null,
      duration_ms: videoMeta?.durationMs || null,
      background_color: backgroundColor ?? null,
      text_position: textPosition ?? null,
      text_elements: textElements ?? null,
      media_transform: mediaTransform ?? null,
      reposted_from: repost ? Number(repost.fromFlowId) || repost.fromFlowId : null,
      reposted_from_user: repost ? repost.fromUser : null,
    };

    let { data, error } = await supabase
      .from("flow")
      .insert(fullPayload)
      .select()
      .maybeSingle();

    // Fallback: if a new column is missing on the DB, retry without the optional fields
    if (error && isMissingColumnError(error)) {
      console.warn("[flow] insert failed due to missing column — retrying without new fields:", error?.message);
      const {
        text_position: _tp,
        text_elements: _te,
        media_transform: _mt,
        reposted_from: _rf,
        reposted_from_user: _rfu,
        poster_url: _pu,
        duration_ms: _dm,
        ...basePayload
      } = fullPayload;
      const retry = await supabase!
        .from("flow")
        .insert(basePayload)
        .select()
        .maybeSingle();
      data = retry.data as any;
      error = retry.error;
    }

    if (error) {
      const errorMsg = error?.message || String(error);
      const errorCode = error?.code || "UNKNOWN";
      console.error(`Error creating story [${errorCode}]:`, errorMsg);
      return null;
    }

    // Marcação de pessoas (flow_tags) — falha aqui não derruba o flow já criado; a
    // trigger notify_flow_tag gera a notificação type 16 para cada pessoa marcada.
    const tagIds = [...new Set((taggedUserIds ?? []).filter((id) => id && id !== viewer.id))];
    if (data && tagIds.length > 0) {
      const { error: tagsError } = await supabase!
        .from("flow_tags")
        .insert(tagIds.map((userId) => ({ flow_id: data!.id, user_id: userId })));
      if (tagsError) console.error("Error tagging users in flow:", tagsError);
    }

    // Bust the cached story/flow lists so the new flow shows up immediately
    // on the next load/refresh instead of waiting for the 60s TTL to expire.
    invalidateQueryCache("activeStories");
    invalidateQueryCache("userActiveStories");
    invalidateQueryCache("userShots");

    return data ? { ...data, id: String(data.id), user_id: String(data.user_id) } : null;
  } catch (err: any) {
    console.error("Error creating story:", err);
    return null;
  }
}

// ── Marcação de pessoas em Flows (flow_tags) ────────────────────────────────

/** Pessoas marcadas num flow (na ordem em que foram marcadas). */
export async function getFlowTagsDb(flowId: string): Promise<SearchUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  try {
    const numeric = Number(flowId);
    const idVal = Number.isFinite(numeric) ? numeric : flowId;
    const { data, error } = await supabase
      .from("flow_tags")
      .select("user_id, created_at")
      .eq("flow_id", idVal)
      .order("created_at", { ascending: true });
    // Tabela pode ainda não existir (migração pendente) — degrada sem marcações
    if (error || !data || data.length === 0) return [];
    const ids = [...new Set(data.map((r: any) => String(r.user_id)))];
    const profilesMap = await getProfilesBatchDb(ids);
    const out: SearchUser[] = [];
    for (const row of data) {
      const p = profilesMap.get(String(row.user_id));
      if (p) out.push({ id: String(row.user_id), nickname: p.nickname, photo: p.photo });
    }
    return out;
  } catch (err) {
    console.error("Error fetching flow tags:", err);
    return [];
  }
}

/**
 * Reposta um flow como flow do próprio usuário (estilo "adicionar ao seu flow" do
 * Instagram): cria um novo flow reaproveitando a mesma mídia (URL pública), com
 * atribuição ao autor original em `reposted_from*`. Só faz sentido para quem foi
 * marcado no flow — a checagem de permissão fica na UI (o botão só aparece p/ marcados).
 */
export async function repostStoryDb(flowId: string): Promise<Story | null> {
  const original = await getFlowByIdDb(flowId);
  if (!original) return null;
  return createStoryDb(
    original.description ?? "",
    original.media_url,
    original.background_color ?? null,
    original.text_position ?? null,
    original.text_elements ?? null,
    original.media_transform ?? null,
    undefined,
    { fromFlowId: original.id, fromUser: original.user_id },
    // Reaproveita capa e duração do original — o repost abre e sincroniza a barra
    // exatamente como o flow de origem (é o mesmo arquivo de mídia).
    { posterUrl: original.poster_url ?? null, durationMs: original.duration_ms ?? null },
  );
}

export async function deleteOldStoriesDb(): Promise<boolean> {
  // Flows are no longer auto-deleted after 24h — they are only hidden from
  // the active feed by the created_at filter in getActiveStoriesDb.
  // Manual deletion happens via deleteStoryDb only.
  return true;
}

export async function deleteStoryDb(storyId: string): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  const viewer = await getViewer();
  if (!viewer) return false;

  try {
    // Cast to number in case PK is bigint — string comparison may not match
    const numericId = Number(storyId);
    const idValue = Number.isFinite(numericId) ? numericId : storyId;

    // Mídia lida antes do delete (depois a linha some). `poster_url` é a capa
    // do vídeo, um segundo arquivo no bucket.
    const { data: flowData } = await supabase
      .from("flow")
      .select("media_url, poster_url")
      .eq("id", idValue)
      .maybeSingle();

    // Delete dependencies first to avoid FK violations
    // Try both numeric and string forms to handle bigint vs text FK columns
    const { error: e1 } = await supabase.from("flow_likes").delete().eq("flow_id", idValue);
    if (e1) { const { error: e1b } = await supabase.from("flow_likes").delete().eq("flow_id", String(storyId)); if (e1b) console.error("flow_likes delete error:", e1b.message); }
    const { error: e2 } = await supabase.from("flow_comments").delete().eq("flow_id", idValue);
    if (e2) { const { error: e2b } = await supabase.from("flow_comments").delete().eq("flow_id", String(storyId)); if (e2b) console.error("flow_comments delete error:", e2b.message); }
    const { error: e3 } = await supabase.from("flow_user_viewed").delete().eq("flow_id", idValue);
    if (e3) { const { error: e3b } = await supabase.from("flow_user_viewed").delete().eq("flow_id", String(storyId)); if (e3b) console.error("flow_user_viewed delete error:", e3b.message); }

    // Only allow deleting own flow
    const { error } = await supabase
      .from("flow")
      .delete()
      .eq("id", idValue)
      .eq("user_id", viewer.id);

    if (error) {
      console.error("Error deleting story:", error);
      return false;
    }

    // Um repost aponta para o MESMO arquivo do original (`repostStoryDb` não
    // copia a mídia). Apagar direto quebraria o flow de outra pessoa — por isso
    // só sai do bucket o que nenhuma linha de `flow` referencia mais.
    const media = collectMediaUrls(flowData, ["media_url", "poster_url"]);
    if (media.length > 0) {
      await removeStorageObjects(
        await filterUnreferencedUrls(media, "flow", ["media_url", "poster_url"]),
      );
    }

    invalidateQueryCache("activeStories");
    invalidateQueryCache("userActiveStories");
    return true;
  } catch (err: any) {
    console.error("Error deleting story:", err);
    return false;
  }
}

// Story likes (incentives)
export async function toggleStoryLikeDb(
  storyId: string,
  incentiveType: PostIncentiveType,
) {
  if (!hasSupabaseConfig || !supabase) return;

  const viewer = await getViewer();
  if (!viewer) return;

  // Cast to number in case PK is bigint
  const numericId = Number(storyId);
  const idValue = Number.isFinite(numericId) ? numericId : storyId;

  const { data: existing } = await supabase
    .from("flow_likes")
    .select("id")
    .eq("flow_id", idValue)
    .eq("user_id", viewer.id)
    .eq("type", incentiveType)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase.from("flow_likes").delete().eq("id", existing.id);
    if (error) console.error("Error removing story like:", error);
  } else {
    const { error } = await supabase.from("flow_likes").insert({
      flow_id: idValue,
      user_id: viewer.id,
      type: incentiveType,
    });
    if (error) {
      console.error("Error inserting story like:", error);
      throw error;
    }
    // Notification is created by the DB trigger `trg_notify_on_flow_incentive`
    // on flow_likes (mirrors shots). Do not insert here or it duplicates.
  }
}

export async function getUserStoryLikesDb(
  storyId: string,
): Promise<PostIncentiveType[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const viewer = await getViewer();
  if (!viewer) return [];

  const numId2 = Number(storyId);
  const idVal2 = Number.isFinite(numId2) ? numId2 : storyId;
  const { data } = await supabase
    .from("flow_likes")
    .select("type")
    .eq("flow_id", idVal2)
    .eq("user_id", viewer.id);

  return (data ?? [])
    .map((row: any) => Number(row.type) as PostIncentiveType)
    .filter((incentiveType): incentiveType is PostIncentiveType =>
      [1, 2, 3, 4, 5, 6].includes(incentiveType),
    );
}

export type FlowViewer = {
  followerId: string;
  userNickname: string;
  userPhoto: string | null;
  incentiveTypes: number[]; // empty = no incentive sent
  viewedAt: string;
};

// Story comments
export type StoryComment = {
  id: string;
  storyId: string;
  userId: string;
  userName: string;
  userHandle: string;
  userPhoto: string | null;
  text: string;
  createdAt: string;
};

export async function addStoryCommentDb(
  storyId: string,
  text: string,
): Promise<StoryComment | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  assertNotEmpty(text, "Comentário");
  assertMaxLength(text.trim(), 500, "Comentário");

  const viewer = await getViewer();
  if (!viewer) return null;

  try {
    const numIdC = Number(storyId);
    const idValC = Number.isFinite(numIdC) ? numIdC : storyId;
    const { data, error } = await supabase
      .from("flow_comments")
      .insert({
        flow_id: idValC,
        user_id: viewer.id,
        text,
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    // Notification is created by the DB trigger `trg_notify_flow_comment`
    // on flow_comments (mirrors shots). Do not insert here or it duplicates.

    // Fetch nickname in the same round-trip as the insert result (single query)
    const { data: profileData } = await supabase
      .from("profiles")
      .select("nickname, handle, photo")
      .eq("user_id", viewer.id)
      .maybeSingle();

    return {
      id: data?.id || "",
      storyId: storyId,
      userId: viewer.id,
      userName: profileData?.nickname || "Usuário",
      userHandle: profileData?.handle || "",
      userPhoto: profileData?.photo || null,
      text,
      createdAt: data?.created_at || new Date().toISOString(),
    };
  } catch (err: any) {
    console.error("Error adding story comment:", err);
    return null;
  }
}

export async function getStoryCommentsDb(
  storyId: string,
): Promise<StoryComment[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  try {
    const numIdG = Number(storyId);
    const idValG = Number.isFinite(numIdG) ? numIdG : storyId;
    const { data, error } = await supabase
      .from("flow_comments")
      .select("*")
      .eq("flow_id", idValG)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const rows = data ?? [];
    if (rows.length === 0) return [];

    // Batch-fetch all comment authors in a single query to avoid N+1
    const userIds = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nickname, handle, photo")
      .in("user_id", userIds);

    const profileMap = new Map(
      (profiles ?? []).map((p: any) => [String(p.user_id), { nickname: String(p.nickname ?? "Usuário"), handle: String(p.handle ?? ""), photo: p.photo || null}]),
    );

    return rows.map((comment: any) => {
      const profile = profileMap.get(String(comment.user_id));
      return {
        id: String(comment.id),
        storyId: storyId,
        userId: String(comment.user_id),
        userName: profile?.nickname ?? "Usuário",
        userHandle: profile?.handle ?? "",
        userPhoto: profile?.photo ?? null,
        text: String(comment.text ?? ""),
        createdAt: String(comment.created_at),
      };
    });
  } catch (err: any) {
    console.error("Error fetching story comments:", err?.message || err);
    return [];
  }
}

export async function deleteStoryCommentDb(commentId: string): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  try {
    const numIdDel = Number(commentId);
    const idValDel = Number.isFinite(numIdDel) ? numIdDel : commentId;
    const { error } = await supabase
      .from("flow_comments")
      .delete()
      .eq("id", idValDel);

    if (error) throw error;
    return true;
  } catch (err: any) {
    console.error("Error deleting story comment:", err);
    return false;
  }
}

export async function updateStoryCommentDb(commentId: string, text: string): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  try {
    assertNotEmpty(text, "Comentário");
    assertMaxLength(text.trim(), 500, "Comentário");

    const numId = Number(commentId);
    const idVal = Number.isFinite(numId) ? numId : commentId;
    const { error } = await supabase
      .from("flow_comments")
      .update({ text: text.trim() })
      .eq("id", idVal);

    if (error) throw error;
    return true;
  } catch (err: any) {
    console.error("Error updating story comment:", err);
    return false;
  }
}

// In-memory set to avoid duplicate inserts within the same browser session
const _recordedFlowViews = new Set<string>();
// In-flight lock set to prevent race conditions
const _recordingInFlight = new Set<string>();

export async function recordFlowViewDb(storyId: string, storyOwnerId: string): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  const viewer = await getViewer();
  if (!viewer || viewer.id === storyOwnerId) return;

  const key = `${viewer.id}:${storyId}`;

  // Already recorded in this session or currently being recorded — skip
  if (_recordedFlowViews.has(key) || _recordingInFlight.has(key)) return;

  _recordingInFlight.add(key);

  try {
    // Convert to number for bigint column compatibility
    const numericFlowId = Number(storyId);
    const flowIdValue = Number.isFinite(numericFlowId) ? numericFlowId : storyId;

    // Check DB first to avoid duplicates across sessions/screens
    const { data: existing } = await supabase
      .from("flow_user_viewed")
      .select("flow_id")
      .eq("flow_id", flowIdValue)
      .eq("follower_id", viewer.id)
      .maybeSingle();

    if (existing) {
      _recordedFlowViews.add(key);
      return;
    }

    const { error } = await supabase
      .from("flow_user_viewed")
      .insert({
        user_id: storyOwnerId,
        follower_id: viewer.id,
        flow_id: flowIdValue,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      // 23505 = duplicate key — record already exists, treat as success
      if (error.code === "23505") {
        _recordedFlowViews.add(key);
      } else {
        console.error("Error inserting flow view:", error.message);
      }
    } else {
      _recordedFlowViews.add(key);
    }
  } catch (err: any) {
    console.error("Error recording flow view:", err?.message || err);
  } finally {
    _recordingInFlight.delete(key);
  }
}

/**
 * Returns the set of flow_ids (from the provided active list) that the current viewer has already seen.
 * Filters by the provided active flow IDs so that new flows reset the "viewed" state.
 */
export async function getMyViewedFlowUserIdsDb(activeFlowIds: string[]): Promise<Set<string>> {
  if (!hasSupabaseConfig || !supabase) return new Set();
  if (activeFlowIds.length === 0) return new Set();
  const viewer = await getViewer();
  if (!viewer) return new Set();

  try {
    // Convert to numbers for bigint column compatibility
    const numericIds = activeFlowIds.map(Number).filter(Number.isFinite);
    if (numericIds.length === 0) return new Set();

    const { data, error } = await supabase
      .from("flow_user_viewed")
      .select("flow_id")
      .eq("follower_id", viewer.id)
      .in("flow_id", numericIds);

    if (error) throw error;
    return new Set((data ?? []).map((r: any) => String(r.flow_id)));
  } catch (err: any) {
    console.error("Error fetching viewed flow user ids:", err?.message || err);
    return new Set();
  }
}

export async function getFlowViewersDb(storyId: string): Promise<FlowViewer[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  try {
    const { data: views, error } = await supabase
      .from("flow_user_viewed")
      .select("follower_id, created_at, updated_at")
      .eq("flow_id", storyId)
      .order("updated_at", { ascending: false });

    if (error || !views || views.length === 0) return [];

    const followerIds = views.map((v: any) => v.follower_id);

    const [profilesResult, likesResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, nickname, photo")
        .in("user_id", followerIds),
      supabase
        .from("flow_likes")
        .select("user_id, type")
        .eq("flow_id", storyId)
        .in("user_id", followerIds),
    ]);

    const profileMap = new Map(
      (profilesResult.data ?? []).map((p: any) => [String(p.user_id), p]),
    );

    // Group all incentive types per user (a user can send multiple)
    const likesPerUser = new Map<string, number[]>();
    for (const l of (likesResult.data ?? [])) {
      const uid = String(l.user_id);
      if (!likesPerUser.has(uid)) likesPerUser.set(uid, []);
      likesPerUser.get(uid)!.push(Number(l.type));
    }

    return views.map((view: any) => {
      const profile = profileMap.get(String(view.follower_id));
      return {
        followerId: String(view.follower_id),
        userNickname: profile?.nickname ?? "Usuário",
        userPhoto: profile?.photo ?? null,
        incentiveTypes: likesPerUser.get(String(view.follower_id)) ?? [],
        viewedAt: String(view.updated_at ?? view.created_at),
      };
    });
  } catch (err: any) {
    console.error("Error fetching flow viewers:", err?.message || err);
    return [];
  }
}

// ─────────────────────────── Shot views ───────────────────────────
// Espelha o sistema de visualizações do Flow (recordFlowViewDb /
// getFlowViewersDb), gravando quem viu cada Shot em `shot_user_viewed`.

export type ShotViewer = {
  followerId: string;
  userNickname: string;
  userPhoto: string | null;
  incentiveTypes: number[]; // empty = no incentive sent
  viewedAt: string;
};

// In-memory set to avoid duplicate inserts within the same browser session
const _recordedShotViews = new Set<string>();
// In-flight lock set to prevent race conditions
const _recordingShotInFlight = new Set<string>();

export async function recordShotViewDb(shotId: string, shotOwnerId: string): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  const viewer = await getViewer();
  if (!viewer || viewer.id === shotOwnerId) return;

  const key = `${viewer.id}:${shotId}`;

  // Already recorded in this session or currently being recorded — skip
  if (_recordedShotViews.has(key) || _recordingShotInFlight.has(key)) return;

  _recordingShotInFlight.add(key);

  try {
    // Convert to number for bigint column compatibility
    const numericShotId = Number(shotId);
    const shotIdValue = Number.isFinite(numericShotId) ? numericShotId : shotId;

    // Check DB first to avoid duplicates across sessions/screens
    const { data: existing } = await supabase
      .from("shot_user_viewed")
      .select("shot_id")
      .eq("shot_id", shotIdValue)
      .eq("follower_id", viewer.id)
      .maybeSingle();

    if (existing) {
      _recordedShotViews.add(key);
      return;
    }

    const { error } = await supabase
      .from("shot_user_viewed")
      .insert({
        user_id: shotOwnerId,
        follower_id: viewer.id,
        shot_id: shotIdValue,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      // 23505 = duplicate key — record already exists, treat as success
      if (error.code === "23505") {
        _recordedShotViews.add(key);
      } else {
        console.error("Error inserting shot view:", error.message);
      }
    } else {
      _recordedShotViews.add(key);
    }
  } catch (err: any) {
    console.error("Error recording shot view:", err?.message || err);
  } finally {
    _recordingShotInFlight.delete(key);
  }
}

export async function getShotViewersDb(shotId: string): Promise<ShotViewer[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  try {
    const { data: views, error } = await supabase
      .from("shot_user_viewed")
      .select("follower_id, created_at, updated_at")
      .eq("shot_id", shotId)
      .order("updated_at", { ascending: false });

    if (error || !views || views.length === 0) return [];

    const followerIds = views.map((v: any) => v.follower_id);

    const [profilesResult, likesResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, nickname, photo")
        .in("user_id", followerIds),
      supabase
        .from("shots_likes")
        .select("user_id, type")
        .eq("shots_id", shotId)
        .in("user_id", followerIds),
    ]);

    const profileMap = new Map(
      (profilesResult.data ?? []).map((p: any) => [String(p.user_id), p]),
    );

    // Group all incentive types per user (a user can send multiple)
    const likesPerUser = new Map<string, number[]>();
    for (const l of (likesResult.data ?? [])) {
      const uid = String(l.user_id);
      if (!likesPerUser.has(uid)) likesPerUser.set(uid, []);
      likesPerUser.get(uid)!.push(Number(l.type));
    }

    return views.map((view: any) => {
      const profile = profileMap.get(String(view.follower_id));
      return {
        followerId: String(view.follower_id),
        userNickname: profile?.nickname ?? "Usuário",
        userPhoto: profile?.photo ?? null,
        incentiveTypes: likesPerUser.get(String(view.follower_id)) ?? [],
        viewedAt: String(view.updated_at ?? view.created_at),
      };
    });
  } catch (err: any) {
    console.error("Error fetching shot viewers:", err?.message || err);
    return [];
  }
}

// Messages functionality
export type Message = {
  id: string;
  user_id: string;
  following_id: string;
  text: string;
  read: 0 | 1;
  created_at: string;
  emoji: string | null;
};

export type MessageWithUser = Message & {
  senderNickname: string;
  senderPhoto: string | null;
  recipientNickname: string;
  recipientPhoto: string | null;
};

export type Conversation = {
  userId: string;
  userNickname: string;
  userPhoto: string | null;
  userBio?: string | null;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isVerified?: boolean;
};

// ─── Mídia de mensagem direta (bucket privado) ──────────────────────────────
//
// Até 2026-07-13 as fotos e os áudios de DM iam para o bucket PÚBLICO `posts`:
// a URL era permanente, sem checagem de destinatário, e o caminho era
// previsível (`message-images/{user_id}/{timestamp}.jpg`) — ou seja, conversa
// privada com mídia efetivamente pública.
//
// Agora vão para o bucket privado `chat-media`, em `{idA}_{idB}/{uuid}.{ext}`
// (os dois uuids da conversa, ordenados). A RLS de storage.objects só libera
// quem é uma das duas pontas, e o app lê via signed URL de vida curta.
// Ver docs/migrations/20260713-security-hardening.sql.

const CHAT_MEDIA_BUCKET = "chat-media";
/** Marcador que distingue um caminho no bucket privado de uma URL pública legada. */
const CHAT_MEDIA_PREFIX = "chat:";
const SIGNED_URL_TTL_SECONDS = 3600;

/** Pasta da conversa: os dois ids ordenados, para a policy conseguir validar. */
function chatFolder(a: string, b: string): string {
  return [a, b].sort().join("_");
}

/** Cache de signed URLs (a URL expira — guardamos o instante de validade). */
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Resolve o valor guardado na mensagem para uma URL exibível.
 * - `chat:<path>`  → signed URL do bucket privado (renovada quando expira).
 * - `https://...`  → mensagem antiga, no bucket público. Devolvida como está.
 */
/**
 * Leitura SÍNCRONA do cache de signed URLs. Devolve `null` quando ainda não há
 * URL válida em memória (aí só resta o caminho assíncrono).
 *
 * Existe para o first paint das bolhas de mídia: sem isto, reabrir a conversa
 * remontava as bolhas com `url = null`, mostrava placeholder e só então trocava
 * pela imagem — mesmo com a URL já assinada em memória. Além do piscar, a troca
 * placeholder→imagem muda a altura da bolha e empurra a rolagem.
 */
export function peekChatMediaUrl(ref: string): string | null {
  const value = ref.trim();
  if (!value) return null;
  if (!value.startsWith(CHAT_MEDIA_PREFIX)) return value;

  const cachedEntry = signedUrlCache.get(value.slice(CHAT_MEDIA_PREFIX.length));
  if (cachedEntry && cachedEntry.expiresAt > Date.now() + 60_000) return cachedEntry.url;
  return null;
}

export async function getChatMediaUrlDb(ref: string): Promise<string | null> {
  const value = ref.trim();
  if (!value) return null;

  // Mídia antiga (pré-migração) já é uma URL pública completa.
  if (!value.startsWith(CHAT_MEDIA_PREFIX)) return value;
  if (!supabase) return null;

  const path = value.slice(CHAT_MEDIA_PREFIX.length);
  const cachedEntry = signedUrlCache.get(path);
  // 60s de folga para a URL não expirar no meio do carregamento.
  if (cachedEntry && cachedEntry.expiresAt > Date.now() + 60_000) return cachedEntry.url;

  const { data, error } = await supabase.storage
    .from(CHAT_MEDIA_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.error("Error signing chat media URL:", error?.message);
    return null;
  }

  signedUrlCache.set(path, {
    url: data.signedUrl,
    expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
  });
  return data.signedUrl;
}

export async function uploadMessageAudioDb(blob: Blob, recipientId: string): Promise<string> {
  if (!supabase) throw new Error("Supabase not configured");
  assertUUID(recipientId, "ID do destinatário");
  const viewer = await getViewer();
  if (!viewer) throw new Error("Usuário não autenticado");

  const ext = blob.type.includes("mp4") ? "mp4" : "webm";
  const path = `${chatFolder(viewer.id, recipientId)}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(CHAT_MEDIA_BUCKET)
    .upload(path, blob, { upsert: false, contentType: blob.type || "audio/mp4" });
  if (error) throw error;

  return `${CHAT_MEDIA_PREFIX}${path}`;
}

export async function uploadMessageImageDb(rawFile: File, recipientId: string): Promise<string> {
  if (!supabase) throw new Error("Supabase not configured");
  assertUUID(recipientId, "ID do destinatário");
  // Vem crua do seletor (sem cropper) — encolhe antes de subir. Ver image-compress.ts.
  const file = await compressImageFile(rawFile);
  const viewer = await getViewer();
  if (!viewer) throw new Error("Usuário não autenticado");

  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${chatFolder(viewer.id, recipientId)}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(CHAT_MEDIA_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });
  if (error) throw error;

  return `${CHAT_MEDIA_PREFIX}${path}`;
}

/**
 * Contexto opcional do envio — muda apenas **qual push** o destinatário recebe.
 * A mensagem em si é sempre uma linha normal em `messages`.
 */
export type SendMessageContext = {
  /**
   * Tipo da notificação que dispara o push. Padrão 10 ("te enviou uma mensagem").
   * 17 = resposta a um flow ("respondeu ao seu flow"). Qualquer tipo usado aqui
   * precisa entrar em `NOTIF_TYPES_PUSH_ONLY`, senão vira card na lista do sino.
   */
  notificationType?: 10 | 17;
  /** Flow respondido (tipo 17) — deixa a linha auto-explicativa no banco. */
  flowId?: string;
};

export async function sendMessageDb(
  recipientId: string,
  text: string,
  context?: SendMessageContext,
): Promise<Message | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  assertUUID(recipientId, "ID do destinatário");
  assertNotEmpty(text, "Mensagem");
  assertMaxLength(text.trim(), 1000, "Mensagem");

  const viewer = await getViewer();
  if (!viewer) return null;

  try {
    // Create the message
    const { data, error } = await supabase
      .from("messages")
      .insert({
        user_id: viewer.id,
        following_id: recipientId,
        text,
        read: 0,
      })
      .select()
      .maybeSingle();

    if (error) {
      const errorMsg = error?.message || String(error);
      const errorCode = error?.code || "UNKNOWN";
      console.error(`Error sending message [${errorCode}]:`, errorMsg);
      return null;
    }

    invalidateQueryCache("conversations"); invalidateQueryCache("unreadMsgCount");

    // Notifica o destinatário (fire-and-forget — não bloqueia o envio da mensagem)
    sendMessageNotificationDb(recipientId, context).catch((err) =>
      console.error("Error sending message notification:", err),
    );

    return data;
  } catch (err: any) {
    console.error("Error sending message:", err);
    return null;
  }
}

/**
 * Notificação de mensagem privada (tipo 10, ou 17 quando é resposta a um flow) —
 * **só push, nunca card na lista**.
 *
 * A linha em `notifications` existe por um único motivo: é ela que dispara o
 * webhook `notify-push-on-notification` → edge function → push no iPhone. Não há
 * como pedir o push sem gravar a linha (o segredo do webhook não pode viver no
 * cliente). Por isso a linha continua sendo criada, mas os dois tipos são
 * **filtrados na leitura** (`NOTIF_TYPES_PUSH_ONLY`), em `getNotificationsDb` e
 * `getUnreadNotificationsCountDb`.
 *
 * O tipo 17 existe só para o **texto** do push mudar de "te enviou uma mensagem"
 * para "respondeu ao seu flow" — o destino do toque e o lugar onde a mensagem
 * aparece são idênticos aos do tipo 10. Ele **não é** um tipo de card novo: se um
 * dia sair de `NOTIF_TYPES_PUSH_ONLY`, vira card duplicando o que a Comunidade
 * já mostra.
 *
 * Motivo (2026-07-21): uma conversa em ritmo de bate-papo enchia a tela de
 * Notificações de cards de mensagem, empurrando para baixo o que o usuário
 * realmente quer ver ali. Quem avisa de mensagem não lida dentro do app é o badge
 * da Comunidade (`getUnreadMessageCountDb`, que lê a tabela `messages`).
 *
 * Um push por mensagem é **deliberado** — é o comportamento normal de um
 * mensageiro, e o iOS já agrupa os banners por remetente. A janela de dedup de 60s
 * que existia aqui foi removida: ela nunca funcionou (o `SELECT` em `notifications`
 * do destinatário sempre volta vazio sob RLS, ver docs/10-notificacoes.md) e, com
 * os cards fora da lista, o que ela protegia deixou de existir.
 */
async function sendMessageNotificationDb(
  recipientId: string,
  context?: SendMessageContext,
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  const viewer = await getViewer();
  if (!viewer || viewer.id === recipientId) return;

  const type = context?.notificationType ?? 10;
  const { error } = await supabase.from("notifications").insert({
    user_id: recipientId,
    follower_id: viewer.id,
    type,
    // Só o tipo 17 carrega flow: numa mensagem comum a coluna tem de ficar nula
    // (o `context` da edge function usa flow_id para escolher a frase).
    ...(type === 17 && context?.flowId ? { flow_id: context.flowId } : {}),
    read: false,
  });

  if (error) {
    console.error("Error inserting message notification:", error);
  }
}

export async function getConversationsDb(): Promise<Conversation[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  const viewer = await getViewer();
  if (!viewer) return [];
  return cached(`conversations:${viewer.id}`, CACHE_TTL_MEDIUM, async () => {

  try {
    // Get recent messages excluding ones soft-deleted by the viewer
    const { data: messages, error } = await supabase
      .from("messages")
      .select("id, user_id, following_id, text, read, created_at, message_deletions!left(user_id)")
      .or(`user_id.eq.${viewer.id},following_id.eq.${viewer.id}`)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("Error fetching conversations:", error);
      return [];
    }

    // Filter out messages soft-deleted by the viewer
    const visibleMessages = (messages ?? []).filter((msg: any) => {
      const deletions: { user_id: string }[] = msg.message_deletions ?? [];
      return !deletions.some((d) => d.user_id === viewer.id);
    });

    // Group messages by conversation
    const conversationMap = new Map<string, (typeof visibleMessages)[0][]>();
    visibleMessages.forEach((msg: any) => {
      const otherUserId =
        msg.user_id === viewer.id ? msg.following_id : msg.user_id;
      if (!conversationMap.has(otherUserId)) {
        conversationMap.set(otherUserId, []);
      }
      conversationMap.get(otherUserId)?.push(msg);
    });

    // Batch-fetch all conversation partner profiles in a single query
    const otherUserIds = Array.from(conversationMap.keys()).filter(Boolean);
    const profileMap = new Map<string, { nickname: string; photo: string | null; bio: string | null; is_verified: boolean }>();

    if (otherUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nickname, photo, bio, is_verified")
        .in("user_id", otherUserIds);

      (profiles ?? []).forEach((p: any) => {
        profileMap.set(String(p.user_id), {
          nickname: String(p.nickname ?? "Usuário"),
          photo: p.photo ? String(p.photo) : null,
          bio: p.bio ? String(p.bio) : null,
          is_verified: p.is_verified === true,
        });
      });
    }

    // Build conversations from map (no serial awaits)
    const conversations: Conversation[] = [];

    for (const [userId, msgs] of conversationMap.entries()) {
      const profile = profileMap.get(userId) ?? { nickname: "Usuário", photo: null, bio: null, is_verified: false };
      const unreadCount = msgs.filter(
        (msg) => msg.following_id === viewer.id && msg.read === 0,
      ).length;

      conversations.push({
        userId,
        userNickname: profile.nickname,
        userPhoto: profile.photo,
        userBio: profile.bio,
        isVerified: profile.is_verified,
        lastMessage: msgs[0]?.text || "",
        lastMessageTime: msgs[0]?.created_at || new Date().toISOString(),
        unreadCount,
      });
    }

    return conversations;
  } catch (err: any) {
    console.error("Error getting conversations:", err);
    return [];
  }

  });
}

/**
 * Semente de first paint da conversa (últimas mensagens já vistas neste
 * aparelho). Guardada no mesmo prefixo `lk:q:` do cache de queries, então o
 * sign-out / troca de usuário já a purga junto com o resto.
 *
 * Não é um cache no sentido de "evita a rede": `getConversationMessagesDb`
 * SEMPRE vai buscar a versão fresca. A semente só existe para a conversa abrir
 * já pintada, em vez de abrir vazia e esperar a query.
 */
const CHAT_SEED_MAX = 60; // últimas N mensagens — o bastante para encher a tela

function chatSeedKey(viewerId: string, otherUserId: string): string {
  return `chatMessages:${viewerId}:${otherUserId}`;
}

/** Leitura SÍNCRONA da semente. `null` = nunca abrimos essa conversa aqui. */
export function peekConversationMessages(otherUserId: string): MessageWithUser[] | null {
  const viewerId = getOfflineOwnerId();
  if (!viewerId) return null;
  return persistRead<MessageWithUser[]>(chatSeedKey(viewerId, otherUserId))?.data ?? null;
}

/** Atualiza a semente (chamada também pela tela, ao enviar/receber em tempo real). */
export function cacheConversationMessages(otherUserId: string, messages: MessageWithUser[]) {
  const viewerId = getOfflineOwnerId();
  if (!viewerId) return;
  persistWrite(chatSeedKey(viewerId, otherUserId), messages.slice(-CHAT_SEED_MAX));
}

/**
 * Apaga a semente de uma conversa. Chamada ao excluir o histórico: sem isto, a
 * semente persistida no localStorage repintava as mensagens "apagadas" na
 * próxima vez que a conversa fosse aberta — como o histórico é soft-deletado, a
 * rede volta vazia, mas a semente entrava antes e a antiga conversa reaparecia.
 * `viewerId` é passado explicitamente por quem tem o viewer em mãos (a leitura
 * de `getOfflineOwnerId` é um fallback para chamadas sem esse contexto).
 */
export function clearConversationSeed(otherUserId: string, viewerId?: string) {
  const id = viewerId ?? getOfflineOwnerId();
  if (!id) return;
  const key = chatSeedKey(id, otherUserId);
  _queryCache.delete(key);
  persistDelete(key);
}

export async function getConversationMessagesDb(
  otherUserId: string,
): Promise<MessageWithUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const viewer = await getViewer();
  if (!viewer) return [];

  try {
    // Os perfis não dependem das mensagens — buscar em paralelo, e não depois,
    // corta uma ida à rede do tempo de abertura da conversa.
    const [result, senderProfile, recipientProfile] = await Promise.all([
      // Get messages between current user and other user, excluding soft-deleted ones
      supabase
        .from("messages")
        .select("id, user_id, following_id, text, read, created_at, emoji, message_deletions!left(user_id)")
        .or(
          `and(user_id.eq.${viewer.id},following_id.eq.${otherUserId}),and(user_id.eq.${otherUserId},following_id.eq.${viewer.id})`,
        )
        .order("created_at", { ascending: false })
        .limit(200),
      getUserProfileDb(viewer.id),
      getUserProfileDb(otherUserId),
    ]);

    const { data: messages, error } = result;

    if (error) {
      console.error("Error fetching messages:", error);
      return [];
    }

    // Filter out messages soft-deleted by the current viewer
    const visible = (messages ?? []).filter((msg: any) => {
      const deletions: { user_id: string }[] = msg.message_deletions ?? [];
      return !deletions.some((d) => d.user_id === viewer.id);
    });

    // Reverse to chronological order (we fetched DESC for limit to get the latest 200)
    const enriched: MessageWithUser[] = visible.reverse().map((msg: any) => ({
      ...msg,
      senderNickname:
        msg.user_id === viewer.id
          ? senderProfile?.nickname || "Você"
          : recipientProfile?.nickname || "Usuário",
      senderPhoto:
        msg.user_id === viewer.id
          ? senderProfile?.photo || null
          : recipientProfile?.photo || null,
      recipientNickname:
        msg.following_id === viewer.id
          ? senderProfile?.nickname || "Você"
          : recipientProfile?.nickname || "Usuário",
      recipientPhoto:
        msg.following_id === viewer.id
          ? senderProfile?.photo || null
          : recipientProfile?.photo || null,
    }));

    cacheConversationMessages(otherUserId, enriched);
    return enriched;
  } catch (err: any) {
    console.error("Error getting conversation messages:", err);
    return [];
  }
}

export async function markMessagesAsReadDb(
  senderUserId: string,
): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  const viewer = await getViewer();
  if (!viewer) return false;

  try {
    const { error } = await supabase
      .from("messages")
      .update({ read: 1 })
      .eq("user_id", senderUserId)
      .eq("following_id", viewer.id)
      .eq("read", 0);

    if (error) {
      console.error("Error marking messages as read:", error);
      return false;
    }

    invalidateQueryCache("unreadMsgCount"); invalidateQueryCache("conversations");
    return true;
  } catch (err: any) {
    console.error("Error marking messages as read:", err);
    return false;
  }
}

export async function setMessageEmojiDb(
  messageId: string,
  emoji: string | null,
): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  const { error } = await supabase
    .from("messages")
    .update({ emoji })
    .eq("id", messageId);

  if (error) {
    console.error("Error setting message emoji:", error);
    return false;
  }

  return true;
}

export async function getUnreadMessageCountDb(): Promise<number> {
  if (!hasSupabaseConfig || !supabase) return 0;
  const viewer = await getViewer();
  if (!viewer) return 0;
  return cached(`unreadMsgCount:${viewer.id}`, CACHE_TTL_SHORT, async () => {

  try {
    // Count distinct senders with unread messages — fetch only user_id, cap at 100 to avoid huge payloads
    const { data, error } = await supabase
      .from("messages")
      .select("user_id")
      .eq("following_id", viewer.id)
      .eq("read", 0)
      .limit(100);

    if (error) {
      console.error("Error fetching unread message count:", error);
      return 0;
    }

    const distinctSenders = new Set((data ?? []).map((row: any) => row.user_id)).size;
    return distinctSenders;
  } catch (err: any) {
    console.error("Error getting unread message count:", err);
    return 0;
  }

  });
}

export type MessageReactionRecord = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

// ─── Comment Reactions ───────────────────────────────────────────────────────
// Unified table: comment_reactions(id, comment_type, comment_id, user_id, emoji, created_at)
// comment_type: 'post' | 'shot' | 'flow' | 'checkin'

export type CommentReactionRecord = {
  id: string;
  comment_type: string;
  comment_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

export type CommentReactionSummary = {
  emoji: string;
  count: number;
  userReacted: boolean;
};

export async function getCommentReactionsDb(
  commentType: string,
  commentIds: string[],
): Promise<CommentReactionRecord[]> {
  if (!hasSupabaseConfig || !supabase || commentIds.length === 0) return [];

  const { data, error } = await supabase
    .from("comment_reactions")
    .select("*")
    .eq("comment_type", commentType)
    .in("comment_id", commentIds);

  if (error) {
    console.error("Error fetching comment reactions:", error);
    return [];
  }

  return data ?? [];
}

export async function toggleCommentReactionDb(
  commentType: string,
  commentId: string,
  emoji: string,
  commentOwnerId?: string,
  sourceId?: string,
): Promise<"added" | "removed" | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  const viewer = await getViewer();
  if (!viewer) return null;

  // Check if reaction already exists
  const { data: existing } = await supabase
    .from("comment_reactions")
    .select("id")
    .eq("comment_type", commentType)
    .eq("comment_id", commentId)
    .eq("user_id", viewer.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("comment_reactions")
      .delete()
      .eq("id", existing.id);
    if (error) { console.error("Error removing comment reaction:", error); throw error; }
    return "removed";
  } else {
    const { error } = await supabase
      .from("comment_reactions")
      .insert({ comment_type: commentType, comment_id: commentId, user_id: viewer.id, emoji });
    if (error) { console.error("Error adding comment reaction:", error); throw error; }

    // Notify comment owner (type 6 = comment reaction), skip if owner is self
    if (commentOwnerId && commentOwnerId !== viewer.id && sourceId) {
      const notifPayload: Record<string, any> = {
        user_id: commentOwnerId,
        follower_id: viewer.id,
        type: 6,
        read: false,
      };
      // Encode commentType into the ID fields so navigation knows where to go:
      // - post  → post_id = sourceId (postId, UUID)
      // - shot  → shots_id = sourceId (shotId, UUID)
      // - flow  → shots_id = "flow:<flowId>"   (prefixed, so UI can detect)
      // - checkin → shots_id = "checkin:<checkInId>" (prefixed)
      if (commentType === "shot") {
        notifPayload.shots_id = sourceId;
      } else if (commentType === "flow") {
        notifPayload.flow_id = sourceId;
      } else if (commentType === "checkin") {
        notifPayload.duel_check_in_id = sourceId;
      } else {
        notifPayload.post_id = sourceId;
      }
      const { error: notifError } = await supabase.from("notifications").insert(notifPayload);
      if (notifError) {
        console.error("Error inserting comment reaction notification:", notifError);
      }
    }

    return "added";
  }
}

export function groupCommentReactions(
  records: CommentReactionRecord[],
  viewerUserId: string | null,
): CommentReactionSummary[] {
  const map: Record<string, { count: number; userReacted: boolean }> = {};
  for (const r of records) {
    if (!map[r.emoji]) map[r.emoji] = { count: 0, userReacted: false };
    map[r.emoji].count += 1;
    if (viewerUserId && r.user_id === viewerUserId) map[r.emoji].userReacted = true;
  }
  return Object.entries(map)
    .map(([emoji, v]) => ({ emoji, ...v }))
    .sort((a, b) => b.count - a.count);
}

export async function getFollowersDb(userId?: string): Promise<SearchUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  const viewer = await getViewer();
  if (!viewer) return [];

  const targetUserId = userId ?? viewer.id;
  return cached(`followers:${targetUserId}`, CACHE_TTL_SHORT, async () => {

  try {
    // Get all followers of the target user
    const { data, error } = await supabase
      .from("following")
      .select("user_id")
      .eq("following_id", targetUserId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching followers:", error);
      return [];
    }

    const followerIds = (data ?? []).map((row: any) =>
      String(row.user_id ?? ""),
    );

    if (followerIds.length === 0) return [];

    // Fetch profile data for each follower
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, nickname, bio, photo")
      .in("user_id", followerIds);

    if (profileError) {
      console.error("Error fetching follower profiles:", profileError);
      return [];
    }

    return (profiles ?? []).map((row: any) => ({
      id: String(row.user_id ?? ""),
      nickname: String(row.nickname ?? "Usuário"),
      bio: row.bio ? String(row.bio) : undefined,
      photo: row.photo ? String(row.photo) : null,
    }));
  } catch (err: any) {
    console.error("Error getting followers:", err);
    return [];
  }

  });
}

export async function getFollowingDb(
  userId?: string,
): Promise<SearchUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const viewer = await getViewer();
  if (!viewer) return [];

  const targetUserId = userId || viewer.id;

  return cached(`following:${targetUserId}`, CACHE_TTL_SHORT, async () => {
  try {
    // Get all users that the target user is following
    const { data, error } = await supabase!
      .from("following")
      .select("following_id")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching following:", error);
      return [];
    }

    const followingIds = (data ?? []).map((row: any) =>
      String(row.following_id ?? ""),
    );

    if (followingIds.length === 0) return [];

    // Fetch profile data for each user being followed
    const { data: profiles, error: profileError } = await supabase!
      .from("profiles")
      .select("user_id, nickname, bio, photo")
      .in("user_id", followingIds);

    if (profileError) {
      console.error("Error fetching following profiles:", profileError);
      return [];
    }

    return (profiles ?? []).map((row: any) => ({
      id: String(row.user_id ?? ""),
      nickname: String(row.nickname ?? "Usuário"),
      bio: row.bio ? String(row.bio) : undefined,
      photo: row.photo ? String(row.photo) : null,
    }));
  } catch (err: any) {
    console.error("Error getting following:", err);
    return [];
  }
  }); // end cached
}

export type Shot = {
  id: string;
  user_id: string;
  video_url: string;
  description: string;
  created_at: string;
  likes: PostLikeStats;
  userLikes: PostIncentiveType[];
};

export type ShotWithUser = Shot & {
  userNickname: string;
  userHandle?: string | null;
  userPhoto: string | null;
  commentCount?: number;
  isVerified?: boolean;
};

export async function getShotsDb(): Promise<ShotWithUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  const viewer = await getViewer();
  if (!viewer) return [];
  return cached(`shots:${viewer.id}`, CACHE_TTL_MEDIUM, async () => {

  try {
    // Get recent shots from all users (algorithm shows everyone's content)
    const { data: shotsData, error: shotsError } = await supabase
      .from("shots")
      .select("id, user_id, video_url, description, created_at")
      .not("video_url", "is", null)
      .neq("video_url", "")
      .order("created_at", { ascending: false })
      .limit(50);

    if (shotsError) {
      console.error("[getShotsDb] Error fetching shots:", shotsError);
      return [];
    }


    if (!shotsData || shotsData.length === 0) {
      return [];
    }

    const shotIds = shotsData.map((r: any) => String(r.id));
    const uniqueUserIds = [...new Set(shotsData.map((r: any) => String(r.user_id)))];

    // Fetch profiles, likes, and comment counts in parallel
    const [profilesResult, likesResult, commentsResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, nickname, handle, photo, is_verified")
        .in("user_id", uniqueUserIds),
      supabase
        .from("shots_likes")
        .select("shots_id, type, user_id")
        .in("shots_id", shotIds),
      supabase
        .from("shots_comments")
        .select("shots_id")
        .in("shots_id", shotIds),
    ]);

    const profiles: any[] = profilesResult.data ?? [];
    if (profilesResult.error) console.error("[getShotsDb] Error fetching profiles:", profilesResult.error);

    let allLikes: any[] = [];
    if (likesResult.error) {
      console.error("[getShotsDb] Error fetching likes:", likesResult.error?.message);
    } else {
      allLikes = likesResult.data ?? [];
    }

    const profileMap = new Map(
      profiles.map((p: any) => [
        p.user_id,
        { nickname: p.nickname, handle: p.handle, photo: p.photo, is_verified: p.is_verified === true },
      ]),
    );

    // Build comment count map
    const commentCountMap = new Map<string, number>();
    if (!commentsResult.error && commentsResult.data) {
      for (const row of commentsResult.data) {
        const id = String(row.shots_id);
        commentCountMap.set(id, (commentCountMap.get(id) ?? 0) + 1);
      }
    }


    const likesMap = new Map<
      string,
      { likes: PostLikeStats; userLikes: PostIncentiveType[] }
    >();

    (allLikes ?? []).forEach((like: any) => {
      const shotId = String(like.shots_id);
      if (!likesMap.has(shotId)) {
        likesMap.set(shotId, {
          likes: { apoio: 0, continua: 0, ganhador: 0, consegueMais: 0, limiteMaior: 0, maisAlgum: 0 },
          userLikes: [],
        });
      }

      const entry = likesMap.get(shotId)!;
      const type = Number(like.type) as PostIncentiveType;

      if (type === 1) entry.likes.apoio += 1;
      else if (type === 2) entry.likes.continua += 1;
      else if (type === 3) entry.likes.ganhador += 1;
      else if (type === 4) entry.likes.consegueMais += 1;
      else if (type === 5) entry.likes.limiteMaior += 1;
      else if (type === 6) entry.likes.maisAlgum += 1;

      if (like.user_id === viewer.id) {
        entry.userLikes.push(type);
      }
    });

    // Build final shot objects
    const shotsWithUserData: ShotWithUser[] = (shotsData ?? []).map(
      (shot: any) => {
        const userProfile = profileMap.get(String(shot.user_id)) || {
          nickname: "Usuário",
          handle: null,
          photo: null,
          is_verified: false,
        };
        const likeData = likesMap.get(String(shot.id)) || {
          likes: { apoio: 0, continua: 0, ganhador: 0, consegueMais: 0, limiteMaior: 0, maisAlgum: 0 },
          userLikes: [],
        };

        return {
          id: String(shot.id ?? ""),
          user_id: String(shot.user_id ?? ""),
          video_url: String(shot.video_url ?? ""),
          description: String(shot.description ?? ""),
          created_at: String(shot.created_at ?? new Date().toISOString()),
          likes: likeData.likes,
          userLikes: likeData.userLikes,
          commentCount: commentCountMap.get(String(shot.id)) ?? 0,
          userNickname: String(userProfile.nickname ?? "Usuário"),
          userHandle: userProfile.handle ? String(userProfile.handle) : null,
          userPhoto: userProfile.photo ? String(userProfile.photo) : null,
          isVerified: (userProfile as any).is_verified === true,
        };
      },
    );

    return shotsWithUserData;
  } catch (err: any) {
    console.error("Error getting shots:", err?.message || JSON.stringify(err));
    return [];
  }

  });
}

// Busca um shot específico por id — usado por mensagens compartilhadas e pelo
// deep link ?shot=<id> da tela de Shots (shot pode não estar entre os 50 do feed).
export async function getShotByIdDb(shotId: string): Promise<ShotWithUser | null> {
  if (!hasSupabaseConfig || !supabase) return null;
  assertShotId(shotId, "ID do shot");
  return cached(`shot:${shotId}`, CACHE_TTL_SHORT, async () => {
  const viewer = await getViewer();
  if (!viewer) return null;

  try {
    const { data: shot, error } = await supabase
      .from("shots")
      .select("id, user_id, video_url, description, created_at")
      .eq("id", shotId)
      .maybeSingle();

    if (error || !shot || !shot.video_url) return null;

    const [userProfile, likesResult, commentsResult] = await Promise.all([
      getUserProfileDb(String(shot.user_id)),
      supabase.from("shots_likes").select("type, user_id").eq("shots_id", shotId),
      supabase.from("shots_comments").select("id", { count: "exact", head: true }).eq("shots_id", shotId),
    ]);

    const likes: PostLikeStats = { apoio: 0, continua: 0, ganhador: 0, consegueMais: 0, limiteMaior: 0, maisAlgum: 0 };
    const userLikes: PostIncentiveType[] = [];
    (likesResult.data ?? []).forEach((like: any) => {
      const type = Number(like.type) as PostIncentiveType;
      if (type === 1) likes.apoio += 1;
      else if (type === 2) likes.continua += 1;
      else if (type === 3) likes.ganhador += 1;
      else if (type === 4) likes.consegueMais += 1;
      else if (type === 5) likes.limiteMaior += 1;
      else if (type === 6) likes.maisAlgum += 1;
      if (like.user_id === viewer.id) userLikes.push(type);
    });

    return {
      id: String(shot.id),
      user_id: String(shot.user_id),
      video_url: String(shot.video_url ?? ""),
      description: String(shot.description ?? ""),
      created_at: String(shot.created_at ?? new Date().toISOString()),
      likes,
      userLikes,
      commentCount: commentsResult.count ?? 0,
      userNickname: userProfile?.nickname || "Usuário",
      userHandle: userProfile?.handle ? String(userProfile.handle) : null,
      userPhoto: userProfile?.photo || null,
      isVerified: userProfile?.is_verified === true,
    };
  } catch (err: any) {
    console.error("Error getting shot by id:", err?.message || String(err));
    return null;
  }

  });
}

export async function createShotDb(
  videoUrl: string,
  description: string,
  userGoalId: string | null = null,
): Promise<Shot | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  const viewer = await getViewer();
  if (!viewer) return null;

  try {
    const { data, error } = await supabase
      .from("shots")
      .insert({
        user_id: viewer.id,
        video_url: videoUrl,
        description: description.trim()
      })
      .select()
      .maybeSingle();

    if (error) {
      const errorMsg = error?.message || String(error);
      const errorCode = error?.code || "UNKNOWN";
      console.error(`Error creating shot [${errorCode}]:`, errorMsg);
      return null;
    }

    invalidateQueryCache("shots"); invalidateQueryCache("userShots");
    return data || null;
  } catch (err: any) {
    console.error("Error creating shot:", err);
    return null;
  }
}

export async function updateShotDb(
  shotId: string,
  description: string,
): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  const viewer = await getViewer();
  if (!viewer) return false;

  try {
    const { error } = await supabase
      .from("shots")
      .update({
        description: description.trim(),
      })
      .eq("id", shotId)
      .eq("user_id", viewer.id);

    if (error) {
      console.error("Error updating shot:", error);
      return false;
    }

    invalidateQueryCache("shots"); invalidateQueryCache("userShots");
    return true;
  } catch (err: any) {
    console.error("Error updating shot:", err);
    return false;
  }
}

export async function deleteShotDb(shotId: string): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  const viewer = await getViewer();
  if (!viewer) return false;

  try {
    // Lê a mídia ANTES do delete — depois a linha já não está lá.
    const { data: shotData } = await supabase
      .from("shots")
      .select("video_url")
      .eq("id", shotId)
      .maybeSingle();

    // Delete dependencies first (likes, comments and view records)
    await supabase.from("shots_likes").delete().eq("shots_id", shotId);
    await supabase.from("shots_comments").delete().eq("shots_id", shotId);
    await supabase.from("shot_user_viewed").delete().eq("shot_id", shotId);

    const { error } = await supabase
      .from("shots")
      .delete()
      .eq("id", shotId)
      .eq("user_id", viewer.id);

    if (error) {
      console.error("Error deleting shot:", error);
      return false;
    }

    // Só depois do delete confirmado: shot é vídeo, o arquivo mais pesado que o
    // app publica. Sem isso cada shot excluído ficava no bucket para sempre.
    await removeStorageObjects(collectMediaUrls(shotData, ["video_url"]));

    invalidateQueryCache("shots"); invalidateQueryCache("userShots");
    return true;
  } catch (err: any) {
    console.error("Error deleting shot:", err);
    return false;
  }
}

export async function getShotLikeUsersDb(shotId: string): Promise<Array<{
  userId: string;
  userNickname: string;
  userPhoto: string | null;
  type: number;
}>> {
  if (!hasSupabaseConfig || !supabase) return [];

  try {
    const { data: likesData } = await supabase
      .from("shots_likes")
      .select("user_id, type")
      .eq("shots_id", shotId)
      .order("created_at", { ascending: false });

    if (!likesData || likesData.length === 0) return [];

    const userIds = [...new Set(likesData.map((l: any) => l.user_id))];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nickname, photo")
      .in("user_id", userIds);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

    return likesData.map((like: any) => {
      const profile = profileMap.get(like.user_id);
      return {
        userId: like.user_id,
        userNickname: profile?.nickname ?? "Usuário",
        userPhoto: profile?.photo ?? null,
        type: like.type,
      };
    });
  } catch (err: any) {
    console.error("Error fetching shot like users:", err);
    return [];
  }
}

export async function toggleShotIncentiveDb(
  shotId: string,
  incentiveType: PostIncentiveType,
  shotOwnerId?: string,
) {
  if (!hasSupabaseConfig || !supabase) return;

  const viewer = await getViewer();
  if (!viewer) return;

  try {
    let { data: existing, error: checkError } = await supabase
      .from("shots_likes")
      .select("id")
      .eq("shots_id", shotId)
      .eq("user_id", viewer.id)
      .eq("type", incentiveType)
      .maybeSingle();

    // If shots_likes table doesn't exist, try legacy likes table
    if (checkError) {
      const { data: legacyExisting } = await supabase
        .from("likes")
        .select("id")
        .eq("post_id", shotId)
        .eq("user_id", viewer.id)
        .eq("type", incentiveType)
        .maybeSingle();

      existing = legacyExisting;
    }

    if (existing?.id) {
      // Remove the like
      const tableName = checkError ? "likes" : "shots_likes";
      await supabase.from(tableName).delete().eq("id", existing.id);
    } else {
      // Add the like — try shots_likes first, fall back to legacy likes table
      const { error: shotLikeError } = await supabase
        .from("shots_likes")
        .insert({
          shots_id: shotId,
          user_id: viewer.id,
          type: incentiveType,
        });

      if (shotLikeError) {
        await supabase
          .from("likes")
          .insert({
            post_id: shotId,
            user_id: viewer.id,
            type: incentiveType,
          });
      }

    }
  } catch (err: any) {
    console.error(
      "Error toggling shot incentive:",
      err?.message || JSON.stringify(err),
    );
  }

  invalidateQueryCache("shots");
}

export type ShotComment = {
  id: string;
  shotId: string;
  userId: string;
  userName: string;
  userHandle: string;
  userPhoto: string | null;
  text: string;
  createdAt: string;
};

export async function addShotCommentDb(shotId: string, text: string, shotOwnerId?: string) {
  if (!hasSupabaseConfig || !supabase) return;

  const viewer = await getViewer();
  if (!viewer) return;

  const profile = await ensureProfile();
  const userHandle = profile?.handle ?? "@voce";

  try {
    const { error } = await supabase.from("shots_comments").insert({
      shots_id: shotId,
      user_id: viewer.id,
      user_handle: userHandle,
      text: text.trim(),
    });

    if (error) {
      // Try legacy format if shots_comments table doesn't exist
      const { error: legacyError } = await supabase.from("comments").insert({
        post_id: shotId,
        user_id: viewer.id,
        user_handle: userHandle,
        text: text.trim(),
      });

      if (legacyError) {
        console.error(
          "Error adding shot comment:",
          legacyError?.message || JSON.stringify(legacyError),
        );
        throw legacyError;
      }
    }

    // Notify shot owner (type 3 = comment), skip if owner is self
    if (shotOwnerId && shotOwnerId !== viewer.id) {
      const { error: notifError } = await supabase.from("notifications").insert({
        user_id: shotOwnerId,
        follower_id: viewer.id,
        type: 3,
        shots_id: shotId,
        read: false,
      });
      if (notifError) {
        console.error("Error inserting shot comment notification:", notifError);
      }
    }
  } catch (err: any) {
    console.error(
      "Error adding shot comment:",
      err?.message || JSON.stringify(err),
    );
    throw err;
  }

  invalidateQueryCache("shotComments");
}

export async function getShotCommentsDb(
  shotId: string,
): Promise<ShotComment[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  return cached(`shotComments:${shotId}`, CACHE_TTL_SHORT, async () => {
  try {
    const { data, error } = await supabase
      .from("shots_comments")
      .select("*")
      .eq("shots_id", shotId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(
        "Error fetching shot comments:",
        error?.message || JSON.stringify(error),
      );
      // Try legacy format if shots_comments table doesn't exist
      const { data: legacyData, error: legacyError } = await supabase
        .from("comments")
        .select("*")
        .eq("post_id", shotId)
        .order("created_at", { ascending: false });

      if (legacyError) {
        console.error(
          "Error fetching shot comments (legacy):",
          legacyError?.message || JSON.stringify(legacyError),
        );
        return [];
      }

      return (legacyData ?? []).map(
        (row: any) =>
          ({
            id: String(row.id),
            shotId: String(row.post_id),
            userId: String(row.user_id),
            userName: String(row.user_name ?? "Usuário"),
            userHandle: String(row.user_handle ?? "user"),
            userPhoto: null,
            text: String(row.text ?? ""),
            createdAt: String(row.created_at ?? new Date().toISOString()),
          }) satisfies ShotComment,
      );
    }

    // Batch-fetch all commenter profiles in a single query
    const commentList = data ?? [];
    const uniqueUserIds = [...new Set(commentList.map((r: any) => r.user_id).filter(Boolean))];
    const profileMap = new Map<string, { nickname: string; handle: string | null; photo: string | null }>();

    if (uniqueUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nickname, handle, photo")
        .in("user_id", uniqueUserIds);

      (profiles ?? []).forEach((p: any) => {
        profileMap.set(String(p.user_id), { nickname: p.nickname ?? "Usuário", handle: p.handle ?? null, photo: p.photo ?? null});
      });
    }

    return commentList.map((row: any) => {
      const profile = profileMap.get(String(row.user_id));
      return {
        id: String(row.id),
        shotId: String(row.shots_id),
        userId: String(row.user_id),
        userName: profile?.nickname ?? String(row.user_name ?? "Usuário"),
        userHandle: profile?.handle ?? String(row.user_handle ?? "user"),
        userPhoto: profile?.photo ?? null,
        text: String(row.text ?? ""),
        createdAt: String(row.created_at ?? new Date().toISOString()),
      } satisfies ShotComment;
    });
  } catch (err: any) {
    console.error(
      "Error getting shot comments:",
      err?.message || JSON.stringify(err),
    );
    return [];
  }

  });
}

export async function deleteShotCommentDb(commentId: string) {
  if (!hasSupabaseConfig || !supabase) return;
  assertUUID(commentId, "ID do comentário");

  const viewer = await getViewer();
  if (!viewer) return;

  try {
    const { error } = await supabase
      .from("shots_comments")
      .delete()
      .eq("id", commentId)
      .eq("user_id", viewer.id);

    if (error) {
      // Try legacy format if shots_comments table doesn't exist
      const { error: legacyError } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId)
        .eq("user_id", viewer.id);

      if (legacyError) {
        console.error(
          "Error deleting shot comment:",
          legacyError?.message || JSON.stringify(legacyError),
        );
        throw legacyError;
      }
    }
  } catch (err: any) {
    console.error(
      "Error deleting shot comment:",
      err?.message || JSON.stringify(err),
    );
    throw err;
  }

  invalidateQueryCache("shotComments");
}

export async function updateShotCommentDb(commentId: string, text: string) {
  if (!hasSupabaseConfig || !supabase) return;
  assertUUID(commentId, "ID do comentário");
  assertNotEmpty(text, "Comentário");
  assertMaxLength(text.trim(), 500, "Comentário");

  const viewer = await getViewer();
  if (!viewer) return;

  const { error } = await supabase
    .from("shots_comments")
    .update({ text: text.trim() })
    .eq("id", commentId)
    .eq("user_id", viewer.id);

  if (error) {
    console.error("Error updating shot comment:", error);
    throw error;
  }

  invalidateQueryCache("shotComments");
}

export type RankingUser = {
  userId: string;
  userNickname: string;
  userPhoto: string | null;
  points: number;
  level: number;
};

export async function getRankingDb(): Promise<RankingUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  return cached("ranking", CACHE_TTL_MEDIUM, async () => {
  try {
    // Read top ranking users (capped at 100 to avoid huge payloads)
    const { data: rankingData, error } = await supabase
      .from("ranking")
      .select("user_id, points")
      .order("points", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Error fetching ranking table:", error);
      return [];
    }

    if (!rankingData || rankingData.length === 0) return [];

    const userIds = rankingData.map((r: any) => String(r.user_id));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nickname, photo")
      .in("user_id", userIds);

    const profileMap = new Map(
      (profiles ?? []).map((p: any) => [
        String(p.user_id),
        { nickname: p.nickname, photo: p.photo},
      ]),
    );

    return rankingData.map((r: any) => {
      const uid = String(r.user_id);
      const points = Number(r.points) || 0;
      const profile = profileMap.get(uid) || { nickname: "Usuário", photo: null};
      return {
        userId: uid,
        userNickname: String(profile.nickname),
        userPhoto: profile.photo ? String(profile.photo) : null,
        points,
        level: Math.floor(points / 7) + 1,
      };
    });
  } catch (err: any) {
    console.error("Error getting ranking:", err);
    return [];
  }

  });
}

// Toggle completion for user diet
export async function toggleUserDietCompletionDb(
  userDietId: string,
  isCompleted: boolean,
): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  const completedAt = isCompleted ? new Date().toISOString() : null;

  // Offline: check/uncheck vai para a fila (com o horário original) e para a
  // cópia local — o item aparece concluído na hora, sem internet.
  const enqueueOffline = (): boolean => {
    enqueueOutbox("diet_toggle", { userDietId, isCompleted, completedAt });
    const ownerId = getOfflineOwnerId();
    if (ownerId) {
      offlineCopyPatch<UserDietWithDetails[]>(`userDiets:${ownerId}`, (rows) =>
        rows.map((r) =>
          r.id === userDietId ? { ...r, is_completed: isCompleted, completed_at: completedAt } : r,
        ),
      );
    }
    return true;
  };

  if (isLikelyOffline()) return enqueueOffline();

  const { error } = await supabase
    .from("user_diets")
    .update({ is_completed: isCompleted, completed_at: completedAt })
    .eq("id", userDietId);

  if (error) {
    if (isOfflineWriteError(error)) return enqueueOffline();
    console.error("Error updating user diet:", error);
    return false;
  }

  return true;
}

// Toggle completion for user habit
export async function toggleUserHabitCompletionDb(
  userHabitId: string,
  isCompleted: boolean,
): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  const completedAt = isCompleted ? new Date().toISOString() : null;

  // Offline: mesmo contrato do toggle de dieta (fila + cópia local).
  const enqueueOffline = (): boolean => {
    enqueueOutbox("habit_toggle", { userHabitId, isCompleted, completedAt });
    const ownerId = getOfflineOwnerId();
    if (ownerId) {
      offlineCopyPatch<UserHabitWithDetails[]>(`userHabits:${ownerId}`, (rows) =>
        rows.map((r) =>
          r.id === userHabitId ? { ...r, is_completed: isCompleted, completed_at: completedAt } : r,
        ),
      );
    }
    return true;
  };

  if (isLikelyOffline()) return enqueueOffline();

  const { error } = await supabase
    .from("user_habits")
    .update({ is_completed: isCompleted, completed_at: completedAt })
    .eq("id", userHabitId);

  if (error) {
    if (isOfflineWriteError(error)) return enqueueOffline();
    console.error("Error updating user habit:", error);
    return false;
  }

  return true;
}

// Notifications functionality
export type NotificationItem = {
  id: string;
  type: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17; // 1 = new follower, 2 = incentive, 3 = comment, 4 = duel invite, 5 = join request, 6 = comment reaction, 7 = check-in reaction, 8 = promotion comment, 9 = tagged in post, 10 = private message, 11 = duel check-in, 12 = promotion like, 13 = promotion expired, 14 = check-in classificado, 15 = check-in desclassificado, 16 = tagged in flow, 17 = resposta a um flow (mensagem privada, só push)
  userId: string;
  userNickname: string;
  userPhoto: string | null;
  isVerified?: boolean;
  postId?: string;
  shotId?: string; // Present when notification relates to a shot (from shots_id column in notifications)
  flowId?: string; // Present when type=6 and reaction was on a flow comment (decoded from shots_id "flow:<id>")
  checkInId?: string; // Check-in de duelo: comentário (3), reação em comentário (6), reação no check-in (7), check-in de membro (11) e avaliação classificado/desclassificado (14/15) — vem da coluna duel_check_in_id ou do prefixo legado "checkin:<id>" em shots_id
  promotionId?: string; // For types 8/12/13 (promotion comment, like, expired) — stored in post_id column
  postPhoto?: string;
  incentiveType?: number; // For type 2 (incentive): 1=apoio, 2=continua, 3=ganhador, 4=consegueMais, 5=limiteMaior, 6=maisAlgum
  groupName?: string; // For type 4 (duel invite)
  createdAt: string;
  read?: boolean; // Whether the notification has been read
};

// A coluna post_id é reaproveitada por vários tipos: nestes ela guarda o id de um
// grupo de duelo (4, 5, 11) ou de uma promoção (8, 12, 13) — nunca o id de um post.
// Os tipos de check-in (7, 14, 15) não usam post_id de forma alguma.
const NOTIF_TYPES_WITHOUT_POST = new Set([4, 5, 7, 8, 11, 12, 13, 14, 15]);

// Mensagem privada: a linha só existe para disparar o push, então some da lista
// e da contagem do sino. 10 = mensagem comum, 17 = resposta a um flow (mesma
// mensagem, só muda o texto do push). Ver sendMessageNotificationDb.
const NOTIF_TYPES_PUSH_ONLY = [10, 17] as const;
// PostgREST espera a lista entre parênteses: `not.in.(10,17)`.
const NOTIF_TYPES_PUSH_ONLY_FILTER = `(${NOTIF_TYPES_PUSH_ONLY.join(",")})`;

export async function getNotificationsDb(): Promise<NotificationItem[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  const viewer = await getViewer();
  if (!viewer) return [];
  return cached(`notifications:${viewer.id}`, CACHE_TTL_MEDIUM, async () => {

  try {
    // Read directly from notifications table
    const { data: notificationsData, error } = await supabase
      .from("notifications")
      .select(
        `
        id,
        follower_id,
        type,
        post_id,
        shots_id,
        flow_id,
        duel_check_in_id,
        incentive_type,
        created_at,
        read
      `
      )
      .eq("user_id", viewer.id)
      // Tipos 10 e 17 (mensagem privada / resposta a flow) são só gatilho de push —
      // nunca viram card aqui. Ver sendMessageNotificationDb.
      .not("type", "in", NOTIF_TYPES_PUSH_ONLY_FILTER)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Error fetching notifications:", error);
      return [];
    }

    if (!notificationsData || notificationsData.length === 0) {
      return [];
    }

    // Get all follower IDs and post IDs to fetch related data
    const followerIds = [...new Set(notificationsData.map((n: any) => n.follower_id))];
    // Tipos cujo post_id NÃO guarda um post: 4/5/11 → id do grupo de duelo; 8/12/13 → id da promoção
    const postIds = [...new Set(notificationsData.filter((n: any) => !NOTIF_TYPES_WITHOUT_POST.has(Number(n.type)) && !n.shots_id && !n.flow_id).map((n: any) => n.post_id).filter(Boolean))];
    // shots_id may contain "flow:<id>" or "checkin:<id>" prefixed values — exclude those from the shots DB query
    const shotNotifIds = [...new Set(notificationsData.filter((n: any) => n.shots_id && !String(n.shots_id).startsWith("flow:") && !String(n.shots_id).startsWith("checkin:")).map((n: any) => n.shots_id).filter(Boolean))];
    const groupIds = [...new Set(notificationsData.filter((n: any) => n.type === 4 || n.type === 5 || n.type === 11).map((n: any) => n.post_id).filter(Boolean))];
    // Direct flow_id column support
    const flowResultIds = [...new Set(notificationsData.filter((n: any) => n.flow_id).map((n: any) => n.flow_id).filter(Boolean))];
    const incentiveNotifications = notificationsData.filter((n: any) => n.type === 2);

    // Fetch follower profiles, post photos, flow media, group names, and like data in parallel
    // Each query uses .catch() so a single failure doesn't abort the whole batch
    const safeQuery = (q: any) => Promise.resolve(q).catch(() => ({ data: [] as any[] }));

    const [profilesResult, postsResult, shotNotifResult, groupsResult, flowsResult] = await Promise.all([
      safeQuery(supabase
        .from("profiles")
        .select("user_id, nickname, photo, is_verified")
        .in("user_id", followerIds)),
      postIds.length > 0
        ? safeQuery(supabase
          .from("posts")
          .select("id, photo")
          .in("id", postIds))
        : Promise.resolve({ data: [] as any[] }),
      shotNotifIds.length > 0
        ? safeQuery(supabase
          .from("shots")
          .select("id, video_url")
          .in("id", shotNotifIds))
        : Promise.resolve({ data: [] as any[] }),
      groupIds.length > 0
        ? safeQuery(supabase
          .from("duel_groups")
          .select("id, name")
          .in("id", groupIds))
        : Promise.resolve({ data: [] as any[] }),
      flowResultIds.length > 0
        ? safeQuery(supabase
          .from("flow")
          .select("id, media_url")
          .in("id", flowResultIds))
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const { data: profiles } = profilesResult as any;
    const { data: posts } = postsResult as any;
    const { data: shotNotifs } = shotNotifResult as any;
    const { data: groups } = groupsResult as any;
    const { data: flows } = flowsResult as any;

    const profileMap = new Map<string, any>((profiles ?? []).map((p: any) => [p.user_id, p]));
    const postMap = new Map<string, any>((posts ?? []).map((p: any) => [p.id, { photo: p.photo }] as [string, any]));
    // Map for shots coming via shots_id column
    const shotNotifMap = new Map<string, any>((shotNotifs ?? []).map((s: any) => [s.id, { photo: s.video_url }]));
    const groupMap = new Map<string, any>((groups ?? []).map((g: any) => [g.id, g]));
    const flowMap = new Map<string, any>((flows ?? []).map((f: any) => [String(f.id), { photo: f.media_url }]));

    // Build incentive type map. New notifications have incentive_type stored directly on the row.
    // For old notifications (incentive_type is null), fall back to looking up the likes tables.
    let likesMap = new Map<string, number>(); // notif.id → incentive type

    // Apply direct incentive_type values first
    for (const n of incentiveNotifications) {
      if (n.incentive_type != null) {
        likesMap.set(n.id, Number(n.incentive_type));
      }
    }

    // Only run the legacy likes lookup for notifications that don't have incentive_type yet
    const legacyIncentiveNotifs = incentiveNotifications.filter((n: any) => n.incentive_type == null);

    if (legacyIncentiveNotifs.length > 0) {
      // Separate incentive notifications: shots (have shots_id) vs regular posts (have post_id)
      const shotIncentiveNotifs = legacyIncentiveNotifs.filter((n: any) => n.shots_id);
      const postIncentiveNotifs = incentiveNotifications.filter((n: any) => !n.shots_id && n.post_id);

      // --- Regular post incentives (likes primary; shots_likes fallback for old shot notifs with post_id) ---
      const groupedPostNotifs = new Map<string, any[]>();
      for (const notif of postIncentiveNotifs) {
        const key = `${notif.follower_id}:${notif.post_id}`;
        if (!groupedPostNotifs.has(key)) groupedPostNotifs.set(key, []);
        groupedPostNotifs.get(key)!.push(notif);
      }
      for (const group of groupedPostNotifs.values()) {
        group.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
      const uniquePostPairs = [...groupedPostNotifs.keys()];

      // --- Shot incentives (shots_likes primary, likes fallback) ---
      const groupedShotNotifs = new Map<string, any[]>();
      for (const notif of shotIncentiveNotifs) {
        const key = `${notif.follower_id}:${notif.shots_id}`;
        if (!groupedShotNotifs.has(key)) groupedShotNotifs.set(key, []);
        groupedShotNotifs.get(key)!.push(notif);
      }
      for (const group of groupedShotNotifs.values()) {
        group.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
      const uniqueShotPairs = [...groupedShotNotifs.keys()];

      // --- Flow incentives (tabela: flow_likes, coluna: flow_id) ---
      const flowIncentiveNotifs = legacyIncentiveNotifs.filter((n: any) => n.flow_id);
      const groupedFlowNotifs = new Map<string, any[]>();
      for (const notif of flowIncentiveNotifs) {
        const key = `${notif.follower_id}:${notif.flow_id}`;
        if (!groupedFlowNotifs.has(key)) groupedFlowNotifs.set(key, []);
        groupedFlowNotifs.get(key)!.push(notif);
      }
      for (const group of groupedFlowNotifs.values()) {
        group.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
      const uniqueFlowPairs = [...groupedFlowNotifs.keys()];

      // Bulk-lookup helpers: previously each (follower, post/shot/flow) pair fired
      // its own query — an N+1 that could mean dozens of simultaneous requests
      // for accounts with many legacy incentive notifications. Instead, fetch all
      // rows for the involved ids in one query per table and group client-side.
      const idsFromPairs = (pairs: string[], index: 0 | 1) =>
        [...new Set(pairs.map((k) => k.split(":")[index]))];

      const groupRowsByPair = (rows: any[], idField: string) => {
        const map = new Map<string, any[]>();
        for (const row of rows) {
          const key = `${row.user_id}:${row[idField]}`;
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(row);
        }
        return map;
      };

      // --- Bulk fetch: post incentives (likes primary, shots_likes fallback) ---
      let postLikesMap = new Map<string, any[]>();
      if (uniquePostPairs.length > 0) {
        const postIds = idsFromPairs(uniquePostPairs, 1);
        const followerIdsForPosts = idsFromPairs(uniquePostPairs, 0);
        const { data: postLikeRows } = await safeQuery(
          supabase
            .from("likes")
            .select("post_id, user_id, type, created_at")
            .in("post_id", postIds)
            .in("user_id", followerIdsForPosts)
            .order("created_at", { ascending: true }),
        );
        postLikesMap = groupRowsByPair((postLikeRows as any[]) ?? [], "post_id");

        // Fallback to shots_likes only for pairs that got nothing back (old shot
        // incentive notifs that stored post_id but whose like lives in shots_likes)
        const missingPostPairs = uniquePostPairs.filter((key) => !postLikesMap.has(key));
        if (missingPostPairs.length > 0) {
          const { data: fallbackRows } = await safeQuery(
            supabase
              .from("shots_likes")
              .select("shots_id, user_id, type, created_at")
              .in("shots_id", idsFromPairs(missingPostPairs, 1))
              .in("user_id", idsFromPairs(missingPostPairs, 0))
              .order("created_at", { ascending: true }),
          );
          const fallbackMap = groupRowsByPair((fallbackRows as any[]) ?? [], "shots_id");
          for (const key of missingPostPairs) {
            const rows = fallbackMap.get(key);
            if (rows) postLikesMap.set(key, rows);
          }
        }
      }

      // --- Bulk fetch: shot incentives (shots_likes primary, likes fallback) ---
      let shotLikesMap = new Map<string, any[]>();
      if (uniqueShotPairs.length > 0) {
        const shotIds = idsFromPairs(uniqueShotPairs, 1);
        const followerIdsForShots = idsFromPairs(uniqueShotPairs, 0);
        const { data: shotLikeRows } = await safeQuery(
          supabase
            .from("shots_likes")
            .select("shots_id, user_id, type, created_at")
            .in("shots_id", shotIds)
            .in("user_id", followerIdsForShots)
            .order("created_at", { ascending: true }),
        );
        shotLikesMap = groupRowsByPair((shotLikeRows as any[]) ?? [], "shots_id");

        // Fallback: check legacy likes table (used when shots_likes insert failed)
        const missingShotPairs = uniqueShotPairs.filter((key) => !shotLikesMap.has(key));
        if (missingShotPairs.length > 0) {
          const { data: fallbackRows } = await safeQuery(
            supabase
              .from("likes")
              .select("post_id, user_id, type, created_at")
              .in("post_id", idsFromPairs(missingShotPairs, 1))
              .in("user_id", idsFromPairs(missingShotPairs, 0))
              .order("created_at", { ascending: true }),
          );
          const fallbackMap = groupRowsByPair((fallbackRows as any[]) ?? [], "post_id");
          for (const key of missingShotPairs) {
            const rows = fallbackMap.get(key);
            if (rows) shotLikesMap.set(key, rows);
          }
        }
      }

      // --- Bulk fetch: flow incentives (flow_likes only, no fallback) ---
      let flowLikesMap = new Map<string, any[]>();
      if (uniqueFlowPairs.length > 0) {
        const { data: flowLikeRows } = await safeQuery(
          supabase
            .from("flow_likes")
            .select("flow_id, user_id, type, created_at")
            .in("flow_id", idsFromPairs(uniqueFlowPairs, 1))
            .in("user_id", idsFromPairs(uniqueFlowPairs, 0))
            .order("created_at", { ascending: true }),
        );
        flowLikesMap = groupRowsByPair((flowLikeRows as any[]) ?? [], "flow_id");
      }

      uniquePostPairs.forEach((key) => {
        const likes: any[] = postLikesMap.get(key) ?? [];
        const notifs = groupedPostNotifs.get(key)!;
        notifs.forEach((notif: any, i: number) => {
          const like = likes[i];
          if (like?.type !== undefined && like.type !== null) {
            likesMap.set(notif.id, Number(like.type));
          }
        });
      });

      uniqueShotPairs.forEach((key) => {
        const likes: any[] = shotLikesMap.get(key) ?? [];
        const notifs = groupedShotNotifs.get(key)!;
        notifs.forEach((notif: any, i: number) => {
          const like = likes[i];
          if (like?.type !== undefined && like.type !== null) {
            likesMap.set(notif.id, Number(like.type));
          }
        });
      });

      uniqueFlowPairs.forEach((key) => {
        const likes: any[] = flowLikesMap.get(key) ?? [];
        const notifs = groupedFlowNotifs.get(key)!;
        notifs.forEach((notif: any, i: number) => {
          const like = likes[i];
          if (like?.type !== undefined && like.type !== null) {
            likesMap.set(notif.id, Number(like.type));
          }
        });
      });
    }

    // Transform notifications table records to NotificationItem format
    const notifications: NotificationItem[] = notificationsData
      .map((notif: any) => {
        const profile = profileMap.get(notif.follower_id);
        if (!profile) return null;

        const notification: NotificationItem = {
          id: notif.id,
          type: notif.type,
          userId: notif.follower_id,
          userNickname: profile.nickname,
          userPhoto: profile.photo,
          isVerified: profile.is_verified === true,
          createdAt: notif.created_at,
          read: notif.read ?? false,
        };

        // Add incentive type for type 2 notifications.
        // Prefer the dedicated column; fall back to the legacy likes-lookup map for old rows.
        if (notif.type === 2) {
          if (notif.incentive_type != null) {
            notification.incentiveType = Number(notif.incentive_type);
          } else if (likesMap.has(notif.id)) {
            notification.incentiveType = likesMap.get(notif.id);
          }
        }

        // Map new dedicated columns
        if (notif.flow_id) {
          notification.flowId = String(notif.flow_id);
          const f = flowMap.get(String(notif.flow_id));
          if (f?.photo) {
            notification.postPhoto = f.photo;
          }
        }
        if (notif.duel_check_in_id) {
          notification.checkInId = notif.duel_check_in_id;
        }

        // Add shot/flow/checkin-related fields when shots_id is present (legacy prefix support)
        if (notif.shots_id && notif.type !== 4 && notif.type !== 5) {
          const shotsIdVal: string = String(notif.shots_id);
          if (shotsIdVal.startsWith("flow:")) {
            notification.flowId = shotsIdVal.slice(5);
          } else if (shotsIdVal.startsWith("checkin:")) {
            notification.checkInId = shotsIdVal.slice(8);
          } else {
            notification.shotId = shotsIdVal;
            const shot = shotNotifMap.get(shotsIdVal);
            if (shot?.photo) {
              notification.postPhoto = shot.photo;
            }
          }
        }
        // Add post-related fields for non-duel notifications (regular posts)
        else if (notif.post_id && !NOTIF_TYPES_WITHOUT_POST.has(Number(notif.type))) {
          notification.postId = notif.post_id;
          const post = postMap.get(notif.post_id);
          if (post?.photo) {
            notification.postPhoto = post.photo;
          }
        }

        // Add group name for duel notifications (invite, join request, member check-in)
        if ((notif.type === 4 || notif.type === 5 || notif.type === 11) && notif.post_id) {
          const group = groupMap.get(notif.post_id);
          notification.groupName = group?.name ?? "Duelo";
        }

        // Types 8/12/13: promotion comment, like and expiry — promotion_id stored in post_id column
        if ((notif.type === 8 || notif.type === 12 || notif.type === 13) && notif.post_id) {
          notification.promotionId = String(notif.post_id);
        }

        return notification;
      })
      .filter((n: NotificationItem | null) => n !== null) as NotificationItem[];

    return notifications;
  } catch (err: any) {
    console.error("Error getting notifications:", err);
    return [];
  }

  });
}

export async function getUnreadNotificationsCountDb(): Promise<number> {
  if (!hasSupabaseConfig || !supabase) return 0;
  const viewer = await getViewer();
  if (!viewer) return 0;
  return cached(`unreadNotifCount:${viewer.id}`, CACHE_TTL_SHORT, async () => {

  try {
    // Fetch unread notification rows (we need post/shot IDs to apply grouping logic)
    let { data, error } = await supabase
      .from("notifications")
      .select("id, type, follower_id, post_id, shots_id, flow_id, read")
      .eq("user_id", viewer.id)
      .eq("read", false)
      // Fora da lista, fora do badge — 10 e 17 só existem para gerar o push.
      .not("type", "in", NOTIF_TYPES_PUSH_ONLY_FILTER)
      .limit(200);

    // If read column doesn't exist, fallback to fetching all
    if (error && (error.message?.includes("read") || error.message?.includes("column"))) {
      console.warn("Read column might not exist, fetching all notifications count");
      const { data: allData, error: fallbackError } = await supabase
        .from("notifications")
        .select("id, type, follower_id, post_id, shots_id, flow_id")
        .eq("user_id", viewer.id)
        .not("type", "in", NOTIF_TYPES_PUSH_ONLY_FILTER);

      if (fallbackError) {
        const errorMsg = typeof fallbackError === 'object' ? JSON.stringify(fallbackError) : String(fallbackError);
        console.error("Error fetching unread count:", errorMsg);
        return 0;
      }
      data = (allData ?? []).map(n => ({ ...n, read: false }));
    } else if (error) {
      const errorMsg = typeof error === 'object' ? JSON.stringify(error) : String(error);
      console.error("Error fetching unread count:", errorMsg);
      return 0;
    }

    if (!data || data.length === 0) return 0;

    // Apply the same grouping as the UI: incentive notifications (type 2) for the same
    // post/shot are collapsed into a single entry regardless of incentive subtype or sender.
    const seenPostKeys = new Set<string>();
    let groupedCount = 0;

    for (const n of data) {
      if (n.type === 2) {
        const key = String(n.flow_id ?? n.shots_id ?? n.post_id ?? n.id);
        if (!seenPostKeys.has(key)) {
          seenPostKeys.add(key);
          groupedCount++;
        }
      } else {
        groupedCount++;
      }
    }

    return groupedCount;
  } catch (err: any) {
    const errorMsg = typeof err === 'object' ? JSON.stringify(err) : String(err);
    console.error("Error getting unread notifications count:", errorMsg);
    return 0;
  }

  });
}

export async function markNotificationsAsReadDb(): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  const viewer = await getViewer();
  if (!viewer) return false;

  try {
    // Try to update with read filter
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", viewer.id)
      .eq("read", false);

    if (error) {
      // Log the error properly
      const errorMsg = typeof error === 'object' ? JSON.stringify(error) : String(error);
      console.warn("Error marking notifications as read (this might be normal if read column doesn't exist):", errorMsg);

      // If it's a column not found error, just return true since we can't track read status
      if (errorMsg.includes("read") || errorMsg.includes("column")) {
        return true;
      }

      return false;
    }

    // Invalidar ANTES do return (antes ficava depois dele, código morto): sem
    // isto o badge do sino continuava lendo a contagem velha do cache — e o
    // cache persistido servia esse valor até no relaunch do app, então o
    // indicador de pendência voltava mesmo com tudo já lido no banco.
    invalidateQueryCache("notifications");
    invalidateQueryCache("unreadNotifCount");
    return true;
  } catch (err: any) {
    const errorMsg = typeof err === 'object' ? JSON.stringify(err) : String(err);
    console.warn("Error marking notifications as read:", errorMsg);
    // Don't fail the operation if read column doesn't exist
    return true;
  }
}

export async function clearNotificationsDb(): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  const viewer = await getViewer();
  if (!viewer) return false;

  try {
    // Delete all notifications for the current user
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", viewer.id);

    if (error) {
      const errorMsg = typeof error === 'object' ? JSON.stringify(error) : String(error);
      console.error("Error clearing notifications:", errorMsg);
      return false;
    }

    // Mesma armadilha do markNotificationsAsReadDb: sem invalidar, a lista e a
    // contagem do sino continuavam vindo do cache como se nada tivesse mudado.
    invalidateQueryCache("notifications");
    invalidateQueryCache("unreadNotifCount");
    return true;
  } catch (err: any) {
    const errorMsg = typeof err === 'object' ? JSON.stringify(err) : String(err);
    console.error("Error clearing notifications:", errorMsg);
    return false;
  }
}

export function subscribeToUnreadNotificationsDb(
  onNewNotification: (count: number) => void
): (() => void) | null {
  if (!hasSupabaseConfig || !supabase) return null;

  let isSubscribed = true;

  (async () => {
    try {
      const viewer = await getViewer();
      if (!viewer || !isSubscribed) return;

      // Remove existing channel before creating a new one to avoid duplicate subscription errors
      const channelName = `notifications:${viewer.id}`;
      await supabase.removeChannel(supabase.channel(channelName));

      // Subscribe to insert/update events on notifications table
      supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${viewer.id}`,
          },
          async () => {
            if (!isSubscribed) return;
            // O realtime é a prova de que o dado mudou — sem derrubar o cache
            // antes, getUnreadNotificationsCountDb() releria a própria entrada
            // velha e o badge só acertaria quando o TTL vencesse.
            invalidateQueryCache(`unreadNotifCount:${viewer.id}`);
            invalidateQueryCache(`notifications:${viewer.id}`);
            const count = await getUnreadNotificationsCountDb();
            onNewNotification(count);
          }
        )
        .subscribe();

    } catch (err: any) {
      console.error("Error subscribing to notifications:", err);
    }
  })();

  return () => {
    isSubscribed = false;
    if (supabase) {
      // getViewer is async so we do best-effort removal
      getViewer().then((viewer) => {
        if (viewer) supabase!.removeChannel(supabase!.channel(`notifications:${viewer.id}`));
      });
    }
  };
}

// Post Creation Function
export async function createPostDb(
  photoUrl: string | string[] | null,
  description: string,
  userGoalId?: string | null,
  workoutSummary?: PostWorkoutSummary | null,
  taggedUserIds?: string[] | null,
): Promise<string> {
  if (!supabase) throw new Error("Supabase não configurado");

  try {
    const viewer = await getViewer();
    if (!viewer) throw new Error("Usuário não autenticado");

    // Handle null (text-only post), single string, or array of strings
    const photos = photoUrl === null ? [] : Array.isArray(photoUrl) ? photoUrl : [photoUrl];
    const firstPhoto = photos.length > 0 ? photos[0] : null;
    const photosJson = photos.length > 1 ? photos : null;

    const { data, error } = await supabase
      .from("posts")
      .insert({
        user_id: viewer.id,
        photo: firstPhoto,
        photos: photosJson,
        description: description.trim(),
        user_goal_id: userGoalId ? Number(userGoalId) : null,
        // Resumo estruturado do treino (só em posts de "resumo do treino"
        // compartilhados no feed) — habilita o pill "Ver treino" + modal de detalhe.
        workout_summary: workoutSummary ?? null,
        created_at: new Date().toISOString(),
      })
      .select("id");

    if (error) throw error;
    if (!data || data.length === 0) throw new Error("Failed to create post");

    const postId = data[0].id;

    // Marcação de pessoas (post_tags) — falha aqui não derruba o post já criado;
    // a trigger notify_post_tag gera a notificação type 9 para cada marcado.
    const tagIds = [...new Set((taggedUserIds ?? []).filter((id) => id && id !== viewer.id))];
    if (tagIds.length > 0) {
      const { error: tagsError } = await supabase
        .from("post_tags")
        .insert(tagIds.map((userId) => ({ post_id: postId, user_id: userId })));
      if (tagsError) console.error("Error tagging users in post:", tagsError);
      else invalidateQueryCache("taggedPosts");
    }

    invalidateQueryCache("userPosts"); invalidateQueryCache("post:");
    return postId;
  } catch (err: any) {
    console.error("Error creating post:", err);
    throw err;
  }
}

// Delete Post Function
export async function deletePostDb(postId: string): Promise<boolean> {
  if (!supabase) throw new Error("Supabase não configurado");

  try {
    const viewer = await getViewer();
    if (!viewer) throw new Error("Usuário não autenticado");

    // Get the post first to verify ownership and get media URLs.
    // `photos` é o array do carrossel — sem ele, todas as fotos exceto a
    // primeira (e o card de resumo de treino, que entra como último slide)
    // ficavam órfãs no bucket para sempre.
    const { data: postData, error: fetchError } = await supabase
      .from("posts")
      .select("user_id, photo, photos")
      .eq("id", postId)
      .single();

    if (fetchError) throw fetchError;
    if (!postData) throw new Error("Post não encontrado");

    // Verify ownership
    if (postData.user_id !== viewer.id) {
      throw new Error("Você não tem permissão para deletar este post");
    }

    // Delete notifications referencing this post
    await supabase.from("notifications").delete().eq("post_id", postId);

    // Delete likes/incentives associated with the post
    await supabase.from("likes").delete().eq("post_id", postId);

    // Delete comments associated with the post (must succeed before deleting post due to FK)
    const { error: commentsError } = await supabase
      .from("comments")
      .delete()
      .eq("post_id", postId);

    if (commentsError) {
      console.error("Error deleting comments:", commentsError);
      throw commentsError;
    }

    // Delete the post itself
    const deleteResponse = await supabase
      .from("posts")
      .delete()
      .eq("id", postId)
      .select();


    const { error: postDeleteError } = deleteResponse;

    if (postDeleteError) {
      console.error("Erro ao deletar post:", postDeleteError);
      throw postDeleteError;
    }


    // Apaga TODA a mídia do post do storage — foto principal + carrossel.
    // Best-effort: o post já saiu do banco, falhar aqui só deixa lixo.
    await removeStorageObjects(collectMediaUrls(postData, ["photo"], ["photos"]));

    // Invalidar ANTES do return — o post excluído não pode continuar sendo
    // servido pelo cache (memória/localStorage) na grade do perfil, e o
    // contador de posts (userStats) muda junto.
    invalidateQueryCache("userPosts");
    invalidateQueryCache("post:");
    invalidateQueryCache(`userStats:${viewer.id}`);
    // O post sai junto da aba "Marcações" de quem estava marcado nele
    invalidateQueryCache("taggedPosts");
    return true;
  } catch (err: any) {
    console.error("Error deleting post:", err);
    throw err;
  }
}

export async function updatePostDb(
  postId: string,
  description: string,
  userGoalId: string | null,
): Promise<boolean> {
  if (!supabase) throw new Error("Supabase não configurado");

  try {
    const viewer = await getViewer();
    if (!viewer) throw new Error("Usuário não autenticado");

    // Verify ownership
    const { data: postData, error: fetchError } = await supabase
      .from("posts")
      .select("user_id")
      .eq("id", postId)
      .single();

    if (fetchError) throw fetchError;
    if (!postData) throw new Error("Post não encontrado");

    if (postData.user_id !== viewer.id) {
      throw new Error("Você não tem permissão para editar este post");
    }

    // Update the post
    const { error } = await supabase
      .from("posts")
      .update({
        description: description.trim(),
        user_goal_id: userGoalId,
      })
      .eq("id", postId);

    if (error) throw error;
    // Invalidar ANTES do return — senão o cache continua servindo a descrição antiga
    invalidateQueryCache("userPosts");
    invalidateQueryCache("post:");
    return true;
  } catch (err: any) {
    console.error("Error updating post:", err);
    throw err;
  }
}

export async function removePostPhotoDb(
  postId: string,
  photoUrl: string,
): Promise<string[]> {
  if (!supabase) throw new Error("Supabase não configurado");

  const viewer = await getViewer();
  if (!viewer) throw new Error("Usuário não autenticado");

  const { data: postData, error: fetchError } = await supabase
    .from("posts")
    .select("user_id, photo, photos")
    .eq("id", postId)
    .single();

  if (fetchError) throw fetchError;
  if (!postData) throw new Error("Post não encontrado");
  if (postData.user_id !== viewer.id) throw new Error("Sem permissão para editar este post");

  const currentPhotos: string[] = Array.isArray(postData.photos)
    ? postData.photos
    : [postData.photo].filter(Boolean);

  if (currentPhotos.length <= 1) {
    throw new Error("Não é possível remover a última foto do post");
  }

  const updatedPhotos = currentPhotos.filter((p) => p !== photoUrl);

  const { error } = await supabase
    .from("posts")
    .update({
      photo: updatedPhotos[0],
      photos: updatedPhotos.length > 1 ? updatedPhotos : null,
    })
    .eq("id", postId);

  if (error) throw error;

  invalidateQueryCache("userPosts"); invalidateQueryCache("post:");
  return updatedPhotos;
}

export async function getUserShotsDb(userId: string): Promise<ShotWithUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  return cached(`userShots:${userId}`, CACHE_TTL_SHORT, async () => {
  try {
    const { data: shotsData, error: shotsError } = await supabase
      .from("shots")
      .select("id, user_id, video_url, description, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (shotsError) {
      console.error("Error fetching user shots:", shotsError);
      return [];
    }

    if (!shotsData || shotsData.length === 0) {
      return [];
    }

    // Get user profile
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, nickname, handle, photo")
      .eq("user_id", userId)
      .single();

    if (profileError) {
      console.error("Error fetching user profile:", profileError);
      return [];
    }

    // Get all likes for these shots
    const shotIds = (shotsData ?? []).map((r: any) => String(r.id));
    let allLikes: any[] = [];
    if (shotIds.length > 0) {
      const { data: likesData, error: likesError } = await supabase
        .from("shots_likes")
        .select("shots_id, type, user_id")
        .in("shots_id", shotIds);

      if (likesError) {
        // Try legacy format
        const { data: legacyLikes } = await supabase
          .from("likes")
          .select("post_id, type, user_id")
          .in("post_id", shotIds);
        allLikes = legacyLikes ?? [];
      } else {
        allLikes = likesData ?? [];
      }
    }

    // Get comment counts
    const { data: commentsData, error: commentsError } = await supabase
      .from("shots_comments")
      .select("shots_id")
      .in("shots_id", shotIds);

    const commentMap = new Map<string, number>();
    if (!commentsError && commentsData) {
      commentsData.forEach((c: any) => {
        commentMap.set(c.shots_id, (commentMap.get(c.shots_id) ?? 0) + 1);
      });
    }

    // Transform to ShotWithUser format
    const shotsWithUserData: ShotWithUser[] = (shotsData ?? []).map((shot: any) => {
      const likes = {
        apoio: 0,
        continua: 0,
        ganhador: 0,
        consegueMais: 0,
        limiteMaior: 0,
        maisAlgum: 0,
      };

      allLikes.forEach((like: any) => {
        const shotIdStr = String(like.shots_id || like.post_id);
        if (shotIdStr === String(shot.id)) {
          const typeMap: Record<number, keyof typeof likes> = {
            1: "apoio",
            2: "continua",
            3: "ganhador",
            4: "consegueMais",
            5: "limiteMaior",
            6: "maisAlgum",
          };
          const key = typeMap[like.type];
          if (key) likes[key]++;
        }
      });

      return {
        ...shot,
        userNickname: profileData?.nickname || "Usuário",
        userHandle: profileData?.handle || null,
        userPhoto: profileData?.photo || null,
        likes,
        userLikes: [],
        commentCount: commentMap.get(shot.id) ?? 0,
      };
    });

    return shotsWithUserData;
  } catch (err: any) {
    console.error("Error getting user shots:", err);
    return [];
  }

  });
}

// Complaint Functions
export async function reportUserDb(followerId: string, reason: string): Promise<boolean> {
  if (!supabase) throw new Error("Supabase não configurado");

  try {
    const viewer = await getViewer();
    if (!viewer) throw new Error("Usuário não autenticado");

    const { error } = await supabase
      .from("user_complaint")
      .insert({
        user_id: viewer.id,
        follower_id: followerId,
        reason: reason,
        created_at: new Date().toISOString(),
      });

    if (error) throw error;
    return true;
  } catch (err: any) {
    console.error("Error reporting user:", err);
    throw err;
  }
}

export async function reportPostDb(postId: string, reason: string): Promise<boolean> {
  if (!supabase) throw new Error("Supabase não configurado");

  try {
    const viewer = await getViewer();
    if (!viewer) throw new Error("Usuário não autenticado");

    const { error } = await supabase
      .from("post_complaint")
      .insert({
        user_id: viewer.id,
        post_id: postId,
        reason: reason,
        created_at: new Date().toISOString(),
      });

    if (error) throw error;
    return true;
  } catch (err: any) {
    console.error("Error reporting post:", err);
    throw err;
  }
}

export async function reportShotDb(shotId: string, reason: string): Promise<boolean> {
  if (!supabase) throw new Error("Supabase não configurado");

  try {
    const viewer = await getViewer();
    if (!viewer) throw new Error("Usuário não autenticado");

    const { error } = await supabase
      .from("shots_complaint")
      .insert({
        user_id: viewer.id,
        shots_id: shotId,
        reason: reason,
        created_at: new Date().toISOString(),
      });

    if (error) throw error;
    return true;
  } catch (err: any) {
    console.error("Error reporting shot:", err);
    throw err;
  }
}

// Check-in Functions
export type CheckIn = {
  id: string;
  user_id: string;
  check_in_date: string;
  day_of_week: number;
  created_at: string;
  updated_at: string;
};

// Caminho online puro (lança erro de rede) — usado pela função pública e pelo
// replay da fila offline, que passa a DATA ORIGINAL do check-in.
async function insertCheckInOnlineDb(userId: string, checkInDate: string): Promise<CheckIn> {
  if (!supabase) throw new Error("Supabase não configurado");

  // Já existe check-in nesta data? Evita o 409 do constraint sem depender do
  // registro mais recente (o replay pode gravar datas passadas).
  const { data: existing } = await supabase
    .from("check_ins")
    .select()
    .eq("user_id", userId)
    .eq("check_in_date", checkInDate)
    .maybeSingle();
  if (existing) return existing as CheckIn;

  const dayOfWeek = new Date(checkInDate + "T12:00:00").getDay();

  const { data: inserted, error: insertError } = await supabase
    .from("check_ins")
    .insert({ user_id: userId, check_in_date: checkInDate, day_of_week: dayOfWeek })
    .select()
    .single();

  if (insertError) {
    // 23505 / 409 = unique constraint violation — either check-in already exists
    // for today, or a DB trigger on check_ins failed due to a duplicate in user_badges.
    if (insertError.code === '23505' || (insertError as any).status === 409) {
      const { data: existingToday } = await supabase
        .from("check_ins")
        .select()
        .eq("user_id", userId)
        .eq("check_in_date", checkInDate)
        .maybeSingle();
      if (existingToday) return existingToday as CheckIn;

      // If the check-in doesn't exist but we got 23505, the violation came from a
      // DB trigger (e.g. awarding badges) rather than from the check_ins constraint.
      // Log it but don't surface it as a check-in failure — the trigger should be
      // removed via the 20260422-fix-badge-trigger.sql migration.
      if (insertError.message?.includes('user_badges')) {
        console.warn('createCheckInDb: 23505 from user_badges trigger — run migration 20260422-fix-badge-trigger.sql');
        throw new Error('Trigger de badges causou conflito. Execute a migration 20260422-fix-badge-trigger.sql no Supabase.');
      }
    }
    throw insertError;
  }

  invalidateQueryCache("todayCheckIn"); invalidateQueryCache("weekCheckIns"); invalidateQueryCache("checkInHistory"); invalidateQueryCache("completedRoutines");
  // Contagem total e acervo de insígnias (o check-in pode conceder novas).
  // A insígnia EXIBIDA não muda com o check-in (é escolha persistida do usuário),
  // mas o fallback de quem nunca escolheu depende do acervo — daí invalidar também.
  invalidateQueryCache(`totalCheckIns:${userId}`); invalidateQueryCache(`displayBadge:${userId}`); invalidateQueryCache(`userBadges:${userId}`);
  return inserted as CheckIn;
}

export async function createCheckInDb(userId: string, checkInDate?: string): Promise<CheckIn> {
  if (!supabase) throw new Error("Supabase não configurado");

  const now = new Date();
  const dateStr =
    checkInDate ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Offline: registra o check-in na fila (com a data de HOJE) e na cópia local
  // do histórico — streak/anel/calendário refletem na hora, e o replay grava a
  // data correta quando a internet voltar.
  const offlineCheckIn = (): CheckIn => {
    const copy = offlineCopyRead<CheckIn[]>(`checkInHistory:${userId}`) ?? [];
    const existing = copy.find((c) => c.check_in_date === dateStr);
    const synthetic: CheckIn = existing ?? {
      id: `offline-${Date.now()}`,
      user_id: userId,
      check_in_date: dateStr,
      day_of_week: new Date(dateStr + "T12:00:00").getDay(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    if (!existing) {
      enqueueOutbox("check_in", { userId, checkInDate: dateStr });
      offlineCopyWrite(`checkInHistory:${userId}`, [synthetic, ...copy]);
      offlineCopyPatch<number>(`totalCheckIns:${userId}`, (n) => n + 1);
      invalidateQueryCache("todayCheckIn"); invalidateQueryCache("weekCheckIns"); invalidateQueryCache("checkInHistory"); invalidateQueryCache("completedRoutines");
    }
    return synthetic;
  };

  if (isLikelyOffline()) return offlineCheckIn();

  try {
    return await insertCheckInOnlineDb(userId, dateStr);
  } catch (err: any) {
    if (isOfflineWriteError(err)) return offlineCheckIn();
    console.error("Error creating check-in:", err);
    throw err;
  }
}

export async function getCheckInHistoryDb(userId: string, days: number = 30): Promise<CheckIn[]> {
  try {
    return await cached(`checkInHistory:${userId}`, CACHE_TTL_SHORT, async () => {
      if (!supabase) throw new Error("Supabase não configurado");

      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);
      const sinceDateStr = sinceDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from("check_ins")
        .select()
        .eq("user_id", userId)
        .gte("check_in_date", sinceDateStr)
        .order("check_in_date", { ascending: false });

      if (error) throw error;
      const rows = (data ?? []) as CheckIn[];
      offlineCopyWrite(`checkInHistory:${userId}`, rows);
      return rows;
    });
  } catch (err: any) {
    // Sem rede: cópia local (streak/anel/calendário continuam corretos offline).
    // O erro deixou de ser engolido DENTRO do cached() de propósito — antes um
    // [] transitório era persistido e servido por até 24h.
    console.error("Error getting check-in history:", err);
    return offlineCopyRead<CheckIn[]>(`checkInHistory:${userId}`) ?? [];
  }
}

// Commercial Profile Functions
export type ServicePlan = {
  name: string;
  price: number | null;
  description?: string;
};

export type CommercialProfile = {
  id: string;
  user_id: string;
  business_segment?: string;
  business_name?: string;
  business_description?: string;
  business_phone?: string;
  business_email?: string;
  business_website?: string;
  business_logo_url?: string;
  business_banner_url?: string;
  service_plans?: ServicePlan[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function getCommercialProfileDb(userId: string): Promise<CommercialProfile | null> {
  return cached(`commercialProfile:${userId}`, CACHE_TTL_SHORT, async () => {  if (!supabase) throw new Error("Supabase não configurado");

  try {
    const { data, error } = await supabase
      .from("commercial_profiles")
      .select()
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return data as CommercialProfile | null;
  } catch (err: any) {
    console.error("Error getting commercial profile:", err);
    return null;
  }

  });
}

export async function createOrUpdateCommercialProfileDb(
  userId: string,
  profile: Partial<CommercialProfile>,
): Promise<CommercialProfile> {
  if (!supabase) throw new Error("Supabase não configurado");

  try {
    const existingProfile = await getCommercialProfileDb(userId);
    invalidateQueryCache("commercialProfile");

    if (existingProfile) {
      // Update existing profile
      const { data, error } = await supabase
        .from("commercial_profiles")
        .update({
          ...profile,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;
      return data as CommercialProfile;
    } else {
      // Create new profile
      const { data, error } = await supabase
        .from("commercial_profiles")
        .insert({
          user_id: userId,
          ...profile,
        })
        .select()
        .single();

      if (error) throw error;
      return data as CommercialProfile;
    }
  } catch (err: any) {
    console.error("Error creating/updating commercial profile:", err);
    throw err;
  }
}

export async function deleteCommercialProfileDb(userId: string): Promise<boolean> {
  if (!supabase) throw new Error("Supabase não configurado");

  try {
    const { error } = await supabase
      .from("commercial_profiles")
      .delete()
      .eq("user_id", userId);

    if (error) throw error;
    invalidateQueryCache("commercialProfile");
    return true;
  } catch (err: any) {
    console.error("Error deleting commercial profile:", err);
    throw err;
  }
}

// Commercial Offer Functions
export type CommercialOffer = {
  id: string;
  user_id: string;
  title: string;
  price: string;
  link_url: string;
  coupon_code?: string;
  image_url: string;
  additional_info?: string;
  is_active: boolean;
  view_count: number;
  click_count: number;
  created_at: string;
};

export async function getCommercialOffersByUserIdDb(userId: string): Promise<CommercialOffer[]> {
  if (!supabase) throw new Error("Supabase não configurado");

  try {
    const { data, error } = await supabase
      .from("commercial_offers")
      .select()
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as CommercialOffer[];
  } catch (err: any) {
    console.error("Error getting commercial offers:", err);
    return [];
  }
}

export type CommercialOfferWithSeller = CommercialOffer & {
  seller_nickname: string;
  seller_photo: string | null;
  seller_handle: string;
  seller_is_commercial: boolean; // true = verified commercial partner
};

export async function incrementOfferClickDb(offerId: string, offerOwnerId: string): Promise<void> {
  if (!supabase) return;

  try {
    const { data: offer } = await supabase
      .from("commercial_offers")
      .select("click_count")
      .eq("id", offerId)
      .single();

    if (offer) {
      await supabase
        .from("commercial_offers")
        .update({ click_count: (offer.click_count ?? 0) + 1 })
        .eq("id", offerId);
    }

    // Notify the seller — only if the viewer is not the owner
    const viewer = await getViewer();
    if (viewer && viewer.id !== offerOwnerId) {
      await supabase.from("notifications").insert({
        user_id: offerOwnerId,
        follower_id: viewer.id,
        type: 8,
        post_id: offerId,
        read: false,
      });
    }
  } catch (err) {
    console.error("Error incrementing offer click:", err);
  }
}

// Commercial Plans (tabela dedicada)
export type CommercialPlan = {
  id: string;
  user_id: string;
  name: string;
  price: number | null;
  description: string | null;
  position: number;
  created_at: string;
};

export async function getCommercialPlansDb(userId: string): Promise<CommercialPlan[]> {
  return cached(`commercialPlans:${userId}`, CACHE_TTL_SHORT, async () => {
    if (!supabase) throw new Error("Supabase não configurado");
    const { data, error } = await supabase
      .from("commercial_plans")
      .select("*")
      .eq("user_id", userId)
      .order("position", { ascending: true });
    if (error) throw error;
    return (data ?? []) as CommercialPlan[];
  });
}

export async function saveCommercialPlansDb(userId: string, plans: ServicePlan[]): Promise<void> {
  if (!supabase) throw new Error("Supabase não configurado");

  console.log("[saveCommercialPlansDb] saving", plans.length, "plans for user", userId);

  // Delete all existing plans for this user, then insert the new list
  const { error: deleteError } = await supabase
    .from("commercial_plans")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    console.error("[saveCommercialPlansDb] delete error:", deleteError);
    throw deleteError;
  }

  if (plans.length > 0) {
    const rows = plans.map((p, idx) => ({
      user_id: userId,
      name: p.name,
      price: p.price ?? null,
      description: p.description ?? null,
      position: idx,
    }));
    console.log("[saveCommercialPlansDb] inserting rows:", rows);
    const { data, error: insertError } = await supabase
      .from("commercial_plans")
      .insert(rows)
      .select();

    if (insertError) {
      console.error("[saveCommercialPlansDb] insert error:", insertError);
      throw insertError;
    }
    console.log("[saveCommercialPlansDb] inserted:", data);
  }
  invalidateQueryCache(`commercialPlans:${userId}`);
}

// Professional Directory
export type ProfessionalProfile = {
  user_id: string;
  nickname: string;
  photo: string | null;
  handle: string | null;
  business_name: string;
  business_segment: string;
  business_description: string | null;
  business_phone: string | null;
  business_email: string | null;
  business_website: string | null;
  business_logo_url: string | null;
  service_plans: ServicePlan[];
};

export async function getProfessionalsDb(segment?: string): Promise<ProfessionalProfile[]> {
  return cached(`professionals:${segment ?? "all"}`, CACHE_TTL_SHORT, async () => {
    if (!supabase) throw new Error("Supabase não configurado");
    try {
      let query = supabase
        .from("commercial_profiles")
        .select("user_id, business_name, business_segment, business_description, business_phone, business_email, business_website, business_logo_url")
        .eq("is_active", true);

      if (segment) query = query.eq("business_segment", segment);

      const { data: commercialData, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      if (!commercialData || commercialData.length === 0) return [];

      const userIds = commercialData.map((c: any) => c.user_id);

      const [profilesResult, plansResult] = await Promise.all([
        supabase.from("profiles").select("user_id, nickname, photo, handle").in("user_id", userIds),
        supabase.from("commercial_plans").select("*").in("user_id", userIds).order("position", { ascending: true }),
      ]);

      const profileMap = new Map((profilesResult.data ?? []).map((p: any) => [p.user_id, p]));
      const plansMap = new Map<string, ServicePlan[]>();
      for (const plan of (plansResult.data ?? []) as any[]) {
        if (!plansMap.has(plan.user_id)) plansMap.set(plan.user_id, []);
        plansMap.get(plan.user_id)!.push({ name: plan.name, price: plan.price ?? null, description: plan.description ?? undefined });
      }

      return commercialData.map((c: any) => {
        const profile = profileMap.get(c.user_id) as any;
        return {
          user_id: c.user_id,
          nickname: profile?.nickname ?? "Profissional",
          photo: profile?.photo ?? null,
          handle: profile?.handle ?? null,
          business_name: c.business_name ?? "",
          business_segment: c.business_segment ?? "",
          business_description: c.business_description ?? null,
          business_phone: c.business_phone ?? null,
          business_email: c.business_email ?? null,
          business_website: c.business_website ?? null,
          business_logo_url: c.business_logo_url ?? null,
          service_plans: plansMap.get(c.user_id) ?? [],
        };
      });
    } catch (err: any) {
      console.error("Error getting professionals:", err);
      return [];
    }
  });
}

// Workout History Functions
export type WorkoutHistoryRecord = {
  id: string;
  userId: string;
  userWorkoutId: string | null;
  workoutId: string;
  workoutName: string;
  kilos: number | null;
  volume: string | null;
  dateCompleted: string;
  createdAt: string;
};

// Insert puro (lança erro de rede) — usado pela função pública E pelo replay
// da fila offline. O replay NÃO pode passar pelo caminho com fallback offline,
// senão uma falha seria confundida com sucesso e a entrada se perderia.
async function insertWorkoutHistRowDb(p: {
  userId: string;
  userWorkoutId: number | null;
  workoutId: string;
  kilos: number | null;
  volume: string | null;
  routineId: string | null;
  dateCompleted: string;
  setKind?: SetKind | null;
}): Promise<void> {
  const { error } = await supabase!
    .from("user_workouts_hist")
    .insert([
      {
        user_id: p.userId,
        user_workout_id: p.userWorkoutId,
        workout_id: p.workoutId,
        kilos: p.kilos,
        volume: p.volume,
        routine_id: p.routineId != null ? Number(p.routineId) : null,
        date_completed: p.dateCompleted,
        // NULL no modo simplificado (que não tipa séries) — a leitura trata
        // NULL como 'normal', então nada muda para quem já usava o app.
        set_kind: p.setKind ?? null,
      },
    ]);
  if (error) throw error;
}

export async function saveWorkoutHistoryDb(
  userId: string,
  userWorkoutId: number | null,
  workoutId: string,
  kilos: number | null = null,
  volume: string | null = null,
  routineId: string | null = null,
  // Carimbo único da sessão: todas as séries gravadas em um mesmo "Finalizar"
  // devem compartilhar o mesmo date_completed, para que a leitura da última
  // sessão (getLastWorkoutSessionSeriesDb) agrupe exatamente uma execução —
  // nunca misturando registros de finalizações diferentes.
  dateCompleted: string | null = null,
  // Tipo da série (modo expert). NULL/omitido = modo simplificado → lido como
  // 'normal'. Ver {@link SetKind}.
  setKind: SetKind | null = null,
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  const stamp = dateCompleted ?? new Date().toISOString();
  const payload = { userId, userWorkoutId, workoutId, kilos, volume, routineId, dateCompleted: stamp, setKind };

  // Offline: a série vai para a fila (com a data original) e a rotina passa a
  // constar como executada agora na cópia local — Hub do Hoje, anel semanal e
  // linha "Ontem" continuam corretos sem internet.
  const enqueueOffline = () => {
    enqueueOutbox("workout_hist", payload);
    if (userWorkoutId != null) {
      offlineCopyPatch<Record<string, string>>(
        `routineLastDates:${userId}`,
        (cur) => ({ ...cur, [String(userWorkoutId)]: stamp }),
        {},
      );
    }
  };

  if (isLikelyOffline()) {
    enqueueOffline();
    return;
  }

  try {
    await insertWorkoutHistRowDb(payload);
  } catch (err: any) {
    if (isOfflineWriteError(err)) {
      enqueueOffline();
      return;
    }
    console.error("Error saving workout history:", err);
    throw err;
  }

  invalidateQueryCache("workoutHistory");
  // Mesma origem (user_workouts_hist): o gráfico de progressão e a cobertura
  // muscular precisam cair junto com o histórico, senão ficam velhos durante
  // todo o TTL (15min no caso da cobertura).
  invalidateQueryCache("exerciseProgress");
  invalidateQueryCache("muscleCoverage");
}

// Filtro "só séries de trabalho": descarta o aquecimento e MANTÉM as linhas com
// `set_kind` NULL (modo simplificado e todo o histórico anterior a 05/08/2026,
// que é lido como 'normal'). Um `.neq("set_kind", "warmup")` sozinho não serve:
// no Postgres, NULL <> 'warmup' é NULL, não TRUE — o filtro apagaria justamente
// o histórico antigo.
const WORKING_SETS_FILTER = "set_kind.is.null,set_kind.neq.warmup";

export async function getPreviousBestKgDb(userId: string, workoutId: string): Promise<number> {
  if (!hasSupabaseConfig || !supabase) return 0;
  try {
    const { data } = await supabase
      .from("user_workouts_hist")
      .select("kilos")
      .eq("user_id", userId)
      .eq("workout_id", workoutId)
      .not("kilos", "is", null)
      .or(WORKING_SETS_FILTER)
      .order("kilos", { ascending: false })
      .limit(1);
    return Number(data?.[0]?.kilos ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Recordes anteriores de UM exercício, para os três tipos de PR do modo expert.
 * Todos calculados só sobre séries de trabalho (aquecimento fora).
 */
export type ExercisePersonalRecords = {
  /** maior carga já levantada, em qualquer nº de repetições */
  bestKg: number;
  /** maior 1RM estimado já atingido (ver client/lib/one-rep-max.ts) */
  bestE1rm: number;
  /**
   * Maior nº de repetições já feito em CADA carga (chave = kg como string).
   * É o que permite reconhecer "mesmo peso, mais repetições" como recorde —
   * o tipo de progresso mais comum e o único que o app ignorava por completo.
   */
  repsByKg: Record<string, number>;
};

/**
 * Lê o histórico de séries de trabalho de um exercício e resume os três
 * recordes. Uma consulta só: as três leituras vinham da mesma tabela e fazer
 * três idas ao banco por exercício estouraria o tempo de finalização de um
 * treino com 8 exercícios.
 *
 * `limit` cobre as últimas ~400 séries — o suficiente para o recorde histórico
 * de qualquer exercício que a pessoa treina de verdade, sem baixar anos de
 * histórico no meio do "Finalizar".
 */
export async function getExercisePersonalRecordsDb(
  userId: string,
  workoutId: string,
  limit = 400,
): Promise<ExercisePersonalRecords> {
  const empty: ExercisePersonalRecords = { bestKg: 0, bestE1rm: 0, repsByKg: {} };
  if (!hasSupabaseConfig || !supabase) return empty;
  try {
    const { data, error } = await supabase
      .from("user_workouts_hist")
      .select("kilos, volume")
      .eq("user_id", userId)
      .eq("workout_id", workoutId)
      .not("kilos", "is", null)
      .or(WORKING_SETS_FILTER)
      .order("date_completed", { ascending: false })
      .limit(limit);
    if (error || !data) return empty;

    const records: ExercisePersonalRecords = { bestKg: 0, bestE1rm: 0, repsByKg: {} };
    for (const row of data as any[]) {
      const kg = Number(row.kilos ?? 0);
      if (!(kg > 0)) continue;
      // `volume` guarda as repetições como texto ("10 reps") — mesmo parse de
      // getLastWorkoutSessionSeriesDb.
      const reps = Number(String(row.volume ?? "").replace(/[^0-9.]/g, "")) || 0;

      if (kg > records.bestKg) records.bestKg = kg;
      const e1rm = estimateOneRepMax(kg, reps);
      if (e1rm > records.bestE1rm) records.bestE1rm = e1rm;
      if (reps > 0) {
        const key = String(kg);
        if (reps > (records.repsByKg[key] ?? 0)) records.repsByKg[key] = reps;
      }
    }
    return records;
  } catch {
    return empty;
  }
}

// ── Anatomia: músculos e recrutamento por exercício ─────────────────────────
// Camada ACIMA de `workouts.muscle_group` (que continua existindo e servindo o
// card/filtro/imagem). Migração: `docs/migrations/20260805-muscle-anatomy.sql`.

/** Papel de um músculo em um exercício. `stabilizer` aparece na ficha mas não conta volume. */
export type MuscleRole = "primary" | "secondary" | "stabilizer";

export type Muscle = {
  /** slug estável: 'peitoral_clavicular' */
  id: string;
  /** casa com os valores de `workouts.muscle_group` ('Peito', 'Costas'…) */
  groupName: string;
  /** já localizado (pt/en) via pickLocalized */
  name: string;
  /** 'superior' | 'medio' | 'inferior' | 'lateral' | 'anterior' | 'posterior' | null */
  region: string | null;
  /** região do mapa corporal que este músculo acende */
  bodyPart: string;
  view: "front" | "back";
  sortOrder: number;
};

/** Um músculo recrutado por um exercício, já com o rótulo localizado. */
export type WorkoutMuscle = Muscle & {
  role: MuscleRole;
  /** intensidade 0–100 — NÃO é repartição percentual (as linhas não somam 100) */
  emphasis: number;
};

function mapMuscleRow(row: any): Muscle {
  return {
    id: String(row.id ?? ""),
    groupName: String(row.group_name ?? ""),
    name: pickLocalized(row.name, row.name_eng),
    region: row.region ? String(row.region) : null,
    bodyPart: String(row.body_part ?? ""),
    view: row.view === "back" ? "back" : "front",
    sortOrder: Number(row.sort_order ?? 0),
  };
}

/**
 * Catálogo completo de músculos, ordenado por grupo e posição. Praticamente
 * imutável (só muda por migração), então TTL de catálogo.
 *
 * Cache por idioma: `pickLocalized` resolve no momento do map, então uma
 * entrada única serviria rótulos em português para quem trocou para inglês.
 */
export async function getMusclesDb(): Promise<Muscle[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  // `:v2` invalida as entradas gravadas antes de 05/08/2026 — quem abriu o app
  // ANTES de rodar a migração da anatomia ficou com `[]` preso no localStorage
  // por 12h, e a tela inteira sumia sem explicação. O `skipEmpty` impede que
  // isso volte a acontecer; a versão na chave conserta quem já pegou o vazio.
  return cached(`muscles:v2:${getUiLanguage()}`, CACHE_TTL_STATIC, async () => {
    const { data, error } = await supabase!
      .from("muscles")
      .select("id, group_name, name, name_eng, region, body_part, view, sort_order")
      .order("group_name")
      .order("sort_order");
    if (error || !data) return [];
    return (data as any[]).map(mapMuscleRow);
  }, { skipEmpty: true });
}

/**
 * Músculos recrutados por UM exercício, do mais enfatizado para o menos.
 * Alimenta a ficha de anatomia do detalhe do exercício.
 */
export async function getWorkoutMusclesDb(workoutId: string): Promise<WorkoutMuscle[]> {
  if (!hasSupabaseConfig || !supabase || !workoutId) return [];
  return cached(`workoutMuscles:v2:${workoutId}:${getUiLanguage()}`, CACHE_TTL_STATIC, async () => {
    const { data, error } = await supabase!
      .from("workout_muscles")
      .select("role, emphasis, muscles(id, group_name, name, name_eng, region, body_part, view, sort_order)")
      .eq("workout_id", workoutId)
      .order("emphasis", { ascending: false });
    if (error || !data) return [];
    return (data as any[])
      .filter((row) => row.muscles)
      .map((row) => ({
        ...mapMuscleRow(row.muscles),
        role: (row.role === "primary" || row.role === "stabilizer" ? row.role : "secondary") as MuscleRole,
        emphasis: Number(row.emphasis ?? 0),
      }));
  }, { skipEmpty: true });
}

/**
 * Exercícios que recrutam um músculo, do que mais enfatiza para o que menos —
 * a consulta INVERSA que motivou a tabela de ligação ("quais pegam a porção
 * superior do peito?"). É o que alimenta a navegação por músculo específico.
 *
 * `minEmphasis` corta o ruído: sem ele, todo exercício de peito apareceria na
 * lista da porção inferior por causa das linhas secundárias de ênfase baixa.
 */
export async function getWorkoutsByMuscleDb(
  muscleId: string,
  minEmphasis = 40,
): Promise<Workout[]> {
  if (!hasSupabaseConfig || !supabase || !muscleId) return [];
  const viewer = await getViewer();
  return cached(
    `workoutsByMuscle:v2:${muscleId}:${minEmphasis}:${viewer?.id ?? "anon"}:${getUiLanguage()}`,
    CACHE_TTL_STATIC,
    async () => {
      const { data, error } = await supabase!
        .from("workout_muscles")
        .select(
          "emphasis, workouts(id, name, description, name_eng, description_eng, photo, muscle_group, type, wger_id, created_by_user, created_by)",
        )
        .eq("muscle_id", muscleId)
        .gte("emphasis", minEmphasis)
        .order("emphasis", { ascending: false });
      if (error || !data) return [];
      return (data as any[])
        .map((row) => row.workouts)
        .filter(Boolean)
        // Exercício custom de OUTRO usuário não pode vazar aqui (a RLS de
        // `workouts` é leitura pública) — mesma regra de getWorkoutsDb.
        .filter((w: any) => !w.created_by_user || (viewer && w.created_by === viewer.id))
        .map((w: any) => ({
          id: String(w.id ?? ""),
          name: pickLocalized(w.name, w.name_eng),
          altName: altLocalized(w.name, w.name_eng),
          description: pickLocalized(w.description, w.description_eng),
          photo: resolveWorkoutPhotoUrl(w.photo, w.wger_id),
          muscle_group: w.muscle_group ? String(w.muscle_group) : null,
          type: w.type != null ? Number(w.type) : null,
          isCustom: !!w.created_by_user && !!viewer && w.created_by === viewer.id,
        }));
    },
    { skipEmpty: true },
  );
}

/**
 * Cobertura de UM músculo no período — o que a Fase 4 agrega em cima do que as
 * Fases 1 e 2 passaram a gravar. Sem migração nova.
 */
export type MuscleCoverage = {
  muscle: Muscle;
  /**
   * **Séries efetivas** — a métrica que a literatura de hipertrofia usa
   * (10–20 por músculo por semana), não a contagem crua. Uma série de supino
   * reto não é "1 série de tríceps": ela vale `emphasis/100` para cada músculo
   * que recruta, então 4 séries de supino (tríceps 30) = 1,2 série de tríceps.
   */
  effectiveSets: number;
  /** volume (kg × reps) ponderado pela mesma ênfase */
  volume: number;
  /**
   * Última vez que este músculo levou estímulo RELEVANTE (ênfase ≥ 50), em
   * toda a janela de lookback. `null` = não apareceu no período — é o que
   * alimenta a detecção de lacuna.
   */
  lastTrainedAt: string | null;
};

/**
 * Volume e cobertura por músculo. Uma consulta ao histórico + uma às ligações
 * de anatomia dos exercícios envolvidos; a agregação é no cliente.
 *
 * `windowDays` é a janela das MÉTRICAS (padrão 7 = a semana de treino).
 * `lookbackDays` é a janela do "há quanto tempo não treino isso" — precisa ser
 * maior, senão um músculo parado há 3 semanas seria indistinguível de um nunca
 * treinado.
 *
 * Devolve **todos** os músculos do catálogo, inclusive os zerados: a lacuna
 * ("posterior de ombro sem estímulo") é a informação mais valiosa aqui e ela só
 * existe nas linhas com `effectiveSets === 0`.
 *
 * Estabilizadores não contam volume (ver comentário de `workout_muscles.role`):
 * a prancha estabiliza o deltoide anterior, mas ninguém diria que ela é treino
 * de ombro.
 */
export async function getMuscleCoverageDb(
  windowDays = 7,
  lookbackDays = 90,
): Promise<MuscleCoverage[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  const viewer = await getViewer();
  if (!viewer) return [];

  return cached(
    `muscleCoverage:v2:${viewer.id}:${windowDays}:${lookbackDays}:${getUiLanguage()}`,
    CACHE_TTL_OWN,
    async () => {
      const allMuscles = await getMusclesDb();
      if (allMuscles.length === 0) return [];

      const lookbackStart = new Date(Date.now() - lookbackDays * 86400_000).toISOString();
      const windowStartMs = Date.now() - windowDays * 86400_000;

      const { data: hist, error } = await supabase!
        .from("user_workouts_hist")
        .select("workout_id, kilos, volume, date_completed")
        .eq("user_id", viewer.id)
        .gte("date_completed", lookbackStart)
        // Aquecimento não é estímulo — mesma regra do volume e do PR.
        .or(WORKING_SETS_FILTER);
      if (error || !hist) return [];

      const workoutIds = [...new Set((hist as any[]).map((r) => String(r.workout_id)).filter(Boolean))];
      // Sem NENHUMA série no período (usuário novo, ou apagou as rotinas e com
      // elas o histórico): devolve vazio para o card sumir. Devolver todos os
      // músculos zerados fazia o card renderizar "0 séries + tudo é lacuna",
      // que parece dado velho de um treino que não existe mais.
      if (workoutIds.length === 0) return [];

      const { data: links } = await supabase!
        .from("workout_muscles")
        .select("workout_id, muscle_id, role, emphasis")
        .in("workout_id", workoutIds);

      // workout_id → linhas de anatomia (estabilizador fora)
      const byWorkout = new Map<string, Array<{ muscleId: string; emphasis: number }>>();
      for (const row of (links ?? []) as any[]) {
        if (row.role === "stabilizer") continue;
        const wid = String(row.workout_id);
        const list = byWorkout.get(wid) ?? [];
        list.push({ muscleId: String(row.muscle_id), emphasis: Number(row.emphasis ?? 0) });
        byWorkout.set(wid, list);
      }

      const sets = new Map<string, number>();
      const volume = new Map<string, number>();
      const lastAt = new Map<string, string>();

      for (const row of hist as any[]) {
        const links = byWorkout.get(String(row.workout_id));
        if (!links?.length) continue;

        const date = String(row.date_completed ?? "");
        const inWindow = new Date(date).getTime() >= windowStartMs;
        const kg = Number(row.kilos ?? 0);
        const reps = Number(String(row.volume ?? "").replace(/[^0-9.]/g, "")) || 0;
        const setVolume = kg * reps;

        for (const { muscleId, emphasis } of links) {
          const weight = emphasis / 100;
          if (inWindow) {
            sets.set(muscleId, (sets.get(muscleId) ?? 0) + weight);
            volume.set(muscleId, (volume.get(muscleId) ?? 0) + setVolume * weight);
          }
          // "Treinou" = estímulo relevante. Uma linha secundária fraca não
          // deveria zerar o alerta de "faz tempo que você não treina isso".
          if (emphasis >= 50 && date > (lastAt.get(muscleId) ?? "")) {
            lastAt.set(muscleId, date);
          }
        }
      }

      // Havia histórico, mas nenhuma série caiu em músculo nenhum — acontece
      // quando os exercícios treinados ainda não têm anatomia mapeada (seed não
      // rodou, ou só exercícios custom). Mesmo tratamento: card fora, em vez de
      // uma lista de lacunas que não reflete o que a pessoa fez.
      if (sets.size === 0 && lastAt.size === 0) return [];

      return allMuscles.map((muscle) => ({
        muscle,
        effectiveSets: Math.round((sets.get(muscle.id) ?? 0) * 10) / 10,
        volume: Math.round(volume.get(muscle.id) ?? 0),
        lastTrainedAt: lastAt.get(muscle.id) ?? null,
      }));
    },
    { skipEmpty: true },
  );
}

export type ExerciseProgressPoint = { date: string; maxKg: number; volume: number };

// Progressão de carga de UM exercício, agregada por dia (data → maior kg do dia e
// volume somado), ascendente por data. Alimenta o mini-gráfico de progresso no
// detalhe da rotina (Hevy-parity). Considera as últimas ~300 séries registradas.
export async function getExerciseProgressionDb(
  workoutId: string,
  limit = 300,
): Promise<ExerciseProgressPoint[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  const viewer = await getViewer();
  if (!viewer) return [];
  return cached(`exerciseProgress:${viewer.id}:${workoutId}`, CACHE_TTL_OWN, async () => {
    const { data, error } = await supabase!
      .from("user_workouts_hist")
      .select("kilos, volume, date_completed")
      .eq("user_id", viewer.id)
      .eq("workout_id", workoutId)
      // Aquecimento fora do gráfico: uma rampa de 40kg antes de 4×80kg puxaria
      // a curva de progressão para baixo sem o usuário ter regredido em nada.
      .or(WORKING_SETS_FILTER)
      .order("date_completed", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    const byDay = new Map<string, { maxKg: number; volume: number }>();
    for (const r of data as any[]) {
      const day = String(r.date_completed).slice(0, 10);
      const kg = Number(r.kilos ?? 0);
      const vol = Number(r.volume ?? 0);
      const cur = byDay.get(day) ?? { maxKg: 0, volume: 0 };
      if (kg > cur.maxKg) cur.maxKg = kg;
      cur.volume += vol;
      byDay.set(day, cur);
    }
    return [...byDay.entries()]
      .map(([date, v]) => ({ date, maxKg: v.maxKg, volume: v.volume }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  });
}

export async function uploadWorkoutImageDb(userId: string, blob: Blob): Promise<string> {
  if (!hasSupabaseConfig || !supabase) throw new Error("Supabase não configurado");
  const ext = blob.type.includes("png") ? "png" : "jpg";
  const path = `workout-summary/${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("posts")
    .upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("posts").getPublicUrl(path);
  return data.publicUrl;
}

export async function getWorkoutHistoryDb(
  userId: string,
  workoutId: string
): Promise<WorkoutHistoryRecord[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  return cached(`workoutHistory:${getUiLanguage()}:${userId}`, CACHE_TTL_OWN, async () => {
  try {
    const { data, error } = await supabase
      .from("user_workouts_hist")
      .select(`
        id,
        user_id,
        user_workout_id,
        workout_id,
        kilos,
        volume,
        date_completed,
        created_at,
        workouts (name, name_eng)
      `)
      .eq("user_id", userId)
      .eq("workout_id", workoutId)
      .order("date_completed", { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      id: String(row.id),
      userId: String(row.user_id),
      userWorkoutId: row.user_workout_id,
      workoutId: String(row.workout_id),
      workoutName: pickLocalized(row.workouts?.name, row.workouts?.name_eng) || "Exercício",
      kilos: row.kilos,
      volume: row.volume,
      dateCompleted: String(row.date_completed),
      createdAt: String(row.created_at),
    }));
  } catch (err: any) {
    console.error("Error fetching workout history:", err);
    return [];
  }

  });
}

/**
 * For each workout_id, returns the series from the most recent completed session.
 * Each series is returned as { kg, reps } in the order they were saved.
 * Used to pre-populate the workout modal with the user's last performance.
 */
export async function getLastWorkoutSessionSeriesDb(
  userId: string,
  workoutIds: string[],
): Promise<Record<string, Array<{ kg: number; reps: number }>>> {
  if (!hasSupabaseConfig || !supabase || workoutIds.length === 0) return {};

  // Cópia offline por conjunto de exercícios (= por rotina): o pré-preenchimento
  // das séries/coluna ANTERIOR funciona igual sem internet.
  const offKey = `lastSeries:${userId}:${workoutIds.slice().sort().join("|")}`;

  try {
    const { data, error } = await supabase
      .from("user_workouts_hist")
      .select("id, workout_id, kilos, volume, date_completed")
      .eq("user_id", userId)
      .in("workout_id", workoutIds)
      // A coluna ANTERIOR é a referência de carga da última vez — aquecimento
      // ali faria a sessão anterior parecer mais leve do que foi, e o
      // pré-preenchimento nasceria com o peso da rampa.
      .or(WORKING_SETS_FILTER)
      .order("date_completed", { ascending: false })
      .order("id", { ascending: false })
      .limit(workoutIds.length * 20);

    if (error || !data) {
      if (error && isTransientNetworkError(error)) {
        const off = offlineCopyRead<Record<string, Array<{ kg: number; reps: number }>>>(offKey);
        if (off) return off;
      }
      return {};
    }

    // Agrupa por workout_id e isola APENAS a sessão mais recente de cada um.
    // Uma sessão = as séries gravadas em um mesmo "Finalizar", carimbadas em
    // rajada (base + índice em ms), portanto a poucos ms umas das outras.
    // Finalizações distintas estão sempre a segundos/minutos/dias de distância.
    // Uma janela curta separa as sessões com segurança, então a contagem de
    // séries é sempre exatamente a da última execução — nunca a soma de
    // execuções anteriores. (Antes, uma janela de 2h misturava finalizações
    // próximas e inflava a contagem.)
    const SESSION_WINDOW_MS = 2000; // 2s: > rajada de uma execução, << intervalo entre execuções
    const result: Record<string, Array<{ kg: number; reps: number }>> = {};

    for (const workoutId of workoutIds) {
      // Linhas deste exercício, mais recentes primeiro (date_completed desc)
      const rows = (data as any[]).filter((r) => String(r.workout_id) === workoutId);
      if (rows.length === 0) continue;

      const latestTime = new Date(rows[0].date_completed).getTime();
      const sessionRows = rows.filter(
        (r) => latestTime - new Date(r.date_completed).getTime() <= SESSION_WINDOW_MS,
      );

      // Ordena por date_completed ascendente para restaurar a ordem das séries
      // (1..N) — cada série recebeu um carimbo crescente na gravação.
      sessionRows.sort((a, b) =>
        new Date(a.date_completed).getTime() - new Date(b.date_completed).getTime(),
      );

      result[workoutId] = sessionRows.map((r) => {
        const kg = r.kilos != null ? Number(r.kilos) : 0;
        const repsRaw = r.volume ? String(r.volume).replace(/[^0-9.]/g, "") : "0";
        const reps = repsRaw ? Number(repsRaw) : 0;
        return { kg, reps };
      });
    }

    offlineCopyWrite(offKey, result);
    return result;
  } catch (err) {
    if (isTransientNetworkError(err)) {
      const off = offlineCopyRead<Record<string, Array<{ kg: number; reps: number }>>>(offKey);
      if (off) return off;
    }
    return {};
  }
}

/**
 * Returns the most recent date_completed for each user_workout_id (routine).
 * Used to display "last executed" date on exercise routine cards.
 * Returns a map of user_workout_id → ISO date string of last execution.
 */
export async function getRoutineLastDatesBatchDb(
  userId: string,
  userWorkoutIds: string[],
): Promise<Record<string, string>> {
  if (!hasSupabaseConfig || !supabase || userWorkoutIds.length === 0) return {};

  try {
    const { data, error } = await supabase
      .from("user_workouts_hist")
      .select("user_workout_id, date_completed")
      .eq("user_id", userId)
      .in("user_workout_id", userWorkoutIds)
      .order("date_completed", { ascending: false });

    if (error) throw error;

    const result: Record<string, string> = {};
    (data ?? []).forEach((row: any) => {
      const uwId = String(row.user_workout_id);
      if (!result[uwId] && row.date_completed) {
        result[uwId] = String(row.date_completed);
      }
    });

    offlineCopyWrite(`routineLastDates:${userId}`, result);
    return result;
  } catch (err: any) {
    console.error("Error fetching routine last dates:", err);
    // Sem rede: cópia local — inclui os patches otimistas de treinos concluídos
    // offline, então "concluído hoje"/anel semanal continuam corretos.
    if (isTransientNetworkError(err)) {
      const off = offlineCopyRead<Record<string, string>>(`routineLastDates:${userId}`);
      if (off) return off;
    }
    return {};
  }
}

/**
 * Batch-check follow status for multiple user IDs in a single query.
 * Returns a map of userId → boolean (is current viewer following that user)
 */
export async function getFollowingStatusBatchDb(
  targetUserIds: string[],
): Promise<Record<string, boolean>> {
  if (!hasSupabaseConfig || !supabase || targetUserIds.length === 0) return {};

  const viewer = await getViewer();
  if (!viewer) return Object.fromEntries(targetUserIds.map((id) => [id, false]));

  try {
    const { data, error } = await supabase
      .from("following")
      .select("following_id")
      .eq("user_id", viewer.id)
      .in("following_id", targetUserIds);

    if (error) throw error;

    const followingSet = new Set((data ?? []).map((r: any) => String(r.following_id)));
    return Object.fromEntries(targetUserIds.map((id) => [id, followingSet.has(id)]));
  } catch (err: any) {
    console.error("Error batch-checking follow status:", err);
    return Object.fromEntries(targetUserIds.map((id) => [id, false]));
  }
}

// Save diet history record
async function insertDietHistRowDb(p: {
  userId: string;
  userDietId: string | null;
  dietId: number;
  quantity: number | null;
  createdAt: string;
}): Promise<void> {
  const { error } = await supabase!
    .from("user_diets_hist")
    .insert([
      {
        user_id: p.userId,
        user_diet_id: p.userDietId,
        diet_id: p.dietId,
        quantity: p.quantity,
        created_at: p.createdAt,
      },
    ]);
  if (error) throw error;
}

export async function saveDietHistoryDb(
  userId: string,
  userDietId: string | null,
  dietId: number,
  quantity: number | null = null,
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  const payload = { userId, userDietId, dietId, quantity, createdAt: new Date().toISOString() };

  if (isLikelyOffline()) {
    enqueueOutbox("diet_hist", payload);
    return;
  }

  try {
    await insertDietHistRowDb(payload);
  } catch (err: any) {
    if (isOfflineWriteError(err)) {
      enqueueOutbox("diet_hist", payload);
      return;
    }
    console.error("Error saving diet history:", err);
    throw err;
  }

  invalidateQueryCache("workoutHistory");
  // Mesma origem (user_workouts_hist): o gráfico de progressão e a cobertura
  // muscular precisam cair junto com o histórico, senão ficam velhos durante
  // todo o TTL (15min no caso da cobertura).
  invalidateQueryCache("exerciseProgress");
  invalidateQueryCache("muscleCoverage");
}

async function insertHabitHistRowDb(p: {
  userId: string;
  userHabitId: string | null;
  habitId: number;
  quantity: number | null;
  frequency: number | null;
  createdAt: string;
}): Promise<void> {
  const { error } = await supabase!
    .from("user_habits_hist")
    .insert([
      {
        user_id: p.userId,
        user_habit_id: p.userHabitId,
        habit_id: p.habitId,
        quantity: p.quantity,
        frequency: p.frequency,
        created_at: p.createdAt,
      },
    ]);
  if (error) throw error;
}

// Save habit history record
export async function saveHabitHistoryDb(
  userId: string,
  userHabitId: string | null,
  habitId: number,
  quantity: number | null = null,
  frequency: number | null = null
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  const payload = { userId, userHabitId, habitId, quantity, frequency, createdAt: new Date().toISOString() };

  if (isLikelyOffline()) {
    enqueueOutbox("habit_hist", payload);
    return;
  }

  try {
    await insertHabitHistRowDb(payload);
  } catch (err: any) {
    if (isOfflineWriteError(err)) {
      enqueueOutbox("habit_hist", payload);
      return;
    }
    console.error("Error saving habit history:", err);
    throw err;
  }

  invalidateQueryCache("workoutHistory");
  // Mesma origem (user_workouts_hist): o gráfico de progressão e a cobertura
  // muscular precisam cair junto com o histórico, senão ficam velhos durante
  // todo o TTL (15min no caso da cobertura).
  invalidateQueryCache("exerciseProgress");
  invalidateQueryCache("muscleCoverage");
}

// Group and Check-in Types
export type DuelScoringType =
  | "active_days"
  | "hustle_points"
  | "check_in_count"
  | "duration"
  | "distance"
  | "steps"
  | "calories"
  | "memes";

export type DuelCheckInVoteType = "classify" | "disqualify";

export type DuelCheckInVote = {
  checkInId: string;
  userId: string;
  voteType: DuelCheckInVoteType;
};

export type DuelGroup = {
  id: string;
  createdBy: string;
  name: string;
  location: string;
  goal: string;
  icon: string;
  photo?: string | null;
  createdAt: string;
  updatedAt?: string;
  endDate?: string;
  scoringType: DuelScoringType;
  memeRule?: string | null;
};

export type CompletedRoutineExercise = {
  workoutId: string;
  workoutName: string;
  muscleGroup: string | null;
  kilos: number | null;
  volume: string | null;
};

export type CompletedRoutine = {
  /** user_workouts.id — used as the selector key */
  userWorkoutId: string;
  routineName: string;
  /** exercises belonging to this routine (from user_workouts_hist today) */
  exercises: CompletedRoutineExercise[];
  /** total volume across all exercises */
  totalVolume: number;
  /** total sets across all exercises (count of hist records) */
  totalSeries: number;
  /** primary muscle group (most common) */
  primaryMuscleGroup: string | null;
  completedAt: string;
};

/**
 * Returns routines the user completed in the last 7 days, built from
 * user_workouts_hist joined with user_workouts → routines (for the routine name)
 * and workouts (for muscle_group). Used by the duel check-in selector so a
 * workout done on a previous day can still be picked when checking in late.
 */
export async function getRecentCompletedRoutinesDb(userId: string): Promise<CompletedRoutine[]> {
  if (!hasSupabaseConfig || !supabase || !userId) return [];
  return cached(`completedRoutines:${getUiLanguage()}:${userId}`, CACHE_TTL_OWN, async () => {
  try {
    // Fetch completed workouts from the last 7 days (including today)
    const since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("user_workouts_hist")
      .select(`
        id,
        user_workout_id,
        routine_id,
        workout_id,
        kilos,
        volume,
        date_completed,
        workouts (name, name_eng, muscle_group)
      `)
      .eq("user_id", userId)
      .gte("date_completed", since.toISOString())
      .order("date_completed", { ascending: false });

    if (error || !data || data.length === 0) return [];

    // Nome da rotina: `user_workouts.name` é o nome denormalizado em CADA
    // exercício da rotina; `routines.name` é a fonte de verdade e serve de
    // reserva quando a linha do exercício está sem nome (rotina antiga, item
    // criado sem `name`). Só entram no mapa os nomes de verdade — um nome
    // vazio tem que cair para a reserva seguinte, não virar "Rotina de
    // Exercícios" antes da hora.
    const userWorkoutIds = [...new Set((data as any[]).map((r: any) => r.user_workout_id).filter(Boolean))];
    const routineIds = [...new Set((data as any[]).map((r: any) => r.routine_id).filter((v: any) => v != null))];

    const itemNameMap: Record<string, string> = {};
    const routineNameMap: Record<string, string> = {};
    await Promise.all([
      (async () => {
        if (userWorkoutIds.length === 0) return;
        const { data: uwData } = await supabase!
          .from("user_workouts")
          .select("id, name")
          .in("id", userWorkoutIds);
        (uwData ?? []).forEach((uw: any) => {
          if (uw.name) itemNameMap[String(uw.id)] = String(uw.name);
        });
      })(),
      (async () => {
        if (routineIds.length === 0) return;
        const { data: rData } = await supabase!
          .from("routines")
          .select("id, name")
          .in("id", routineIds);
        (rData ?? []).forEach((r: any) => {
          if (r.name) routineNameMap[String(r.id)] = String(r.name);
        });
      })(),
    ]);

    // ── Sessões ───────────────────────────────────────────────────────────
    // Uma sessão = as séries gravadas em um mesmo "Finalizar": todas recebem
    // `sessionBaseMs + índice` em ms, portanto ficam a poucos ms umas das
    // outras (mesma premissa de getLastWorkoutSessionSeriesDb). Agrupar só
    // por NOME, como antes, quebrava uma única execução em dois cards sempre
    // que parte das séries não resolvia o nome — o caso mais comum é o
    // exercício AVULSO adicionado durante o treino, que grava
    // `user_workout_id` NULL e caía num segundo card "Rotina de Exercícios".
    // Clusterizar pelo carimbo mantém a execução inteira num card só.
    const SESSION_GAP_MS = 60_000; // >> rajada de uma execução, << intervalo entre execuções
    type HistSession = { rows: any[]; endMs: number };
    const sessions: HistSession[] = [];
    const sortedRows = (data as any[])
      .slice()
      .sort((a, b) => new Date(a.date_completed).getTime() - new Date(b.date_completed).getTime());

    for (const row of sortedRows) {
      const raw = new Date(row.date_completed).getTime();
      const current = sessions[sessions.length - 1];
      // Data inválida não pode abrir uma sessão nova a cada linha: cola na
      // sessão em aberto (ou começa a primeira).
      const ms = Number.isFinite(raw) ? raw : current?.endMs ?? 0;
      if (current && ms - current.endMs <= SESSION_GAP_MS) {
        current.rows.push(row);
        current.endMs = ms;
      } else {
        sessions.push({ rows: [row], endMs: ms });
      }
    }

    // Dia LOCAL — é o que o card mostra ("Hoje HH:mm", com o relógio do
    // aparelho) e o que o bloqueio de check-in repetido compara. Cortar a
    // string ISO daria o dia em UTC, e à noite no Brasil isso já é o dia
    // seguinte: a mesma rotina virava dois cards em dias diferentes.
    const localDayKey = (iso: string) => {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso ?? "unknown").slice(0, 10);
      return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    };

    // Sessões da mesma rotina no mesmo dia local viram um card só — é o
    // mesmo par (rotina, dia) que o check-in usa como chave de duplicidade.
    const sessionMap: Record<string, { userWorkoutId: string; routineName: string; exercises: CompletedRoutineExercise[]; completedAt: string }> = {};

    for (const session of sessions) {
      const namedItem = session.rows.find((r: any) => r.user_workout_id && itemNameMap[String(r.user_workout_id)]);
      const namedRoutine = session.rows.find((r: any) => r.routine_id != null && routineNameMap[String(r.routine_id)]);
      const routineName =
        (namedItem && itemNameMap[String(namedItem.user_workout_id)]) ||
        (namedRoutine && routineNameMap[String(namedRoutine.routine_id)]) ||
        "Rotina de Exercícios";
      const completedAt = String(session.rows[session.rows.length - 1].date_completed);
      const key = `${routineName.trim().toLowerCase()}__${localDayKey(completedAt)}`;

      if (!sessionMap[key]) {
        sessionMap[key] = {
          userWorkoutId: session.rows.find((r: any) => r.user_workout_id)?.user_workout_id
            ? String(session.rows.find((r: any) => r.user_workout_id).user_workout_id)
            : "__none__",
          routineName,
          exercises: [],
          completedAt,
        };
      }
      // Cards mesclados guardam o horário da execução mais recente do dia.
      if (new Date(completedAt).getTime() >= new Date(sessionMap[key].completedAt).getTime()) {
        sessionMap[key].completedAt = completedAt;
      }

      for (const row of session.rows) {
        // Avoid adding the exact same exercise twice (same workout_id + kilos)
        const exerciseKey = `${row.workout_id}__${row.kilos ?? ""}`;
        const alreadyAdded = sessionMap[key].exercises.some(
          (ex) => `${ex.workoutId}__${ex.kilos ?? ""}` === exerciseKey,
        );
        if (alreadyAdded) continue;
        sessionMap[key].exercises.push({
          workoutId: String(row.workout_id),
          workoutName: pickLocalized((row.workouts as any)?.name, (row.workouts as any)?.name_eng) || "Exercício",
          muscleGroup: (row.workouts as any)?.muscle_group || null,
          kilos: row.kilos,
          volume: row.volume,
        });
      }
    }

    return Object.values(sessionMap)
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      .map((session) => {
        const totalSeries = session.exercises.length;
        const totalVolume = session.exercises.reduce((sum, ex) => {
          const v = parseFloat(String(ex.volume ?? "0")) || 0;
          return sum + v;
        }, 0);

        // Most frequent muscle group
        const mgCount: Record<string, number> = {};
        session.exercises.forEach((ex) => {
          if (ex.muscleGroup) mgCount[ex.muscleGroup] = (mgCount[ex.muscleGroup] || 0) + 1;
        });
        const primaryMuscleGroup = Object.entries(mgCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

        return {
          userWorkoutId: session.userWorkoutId,
          routineName: session.routineName,
          exercises: session.exercises,
          totalVolume,
          totalSeries,
          primaryMuscleGroup,
          completedAt: session.completedAt,
        };
      });
  } catch (err: any) {
    console.error("Error fetching completed routines:", err);
    return [];
  }

  });
}

export type GroupCheckIn = {
  id: string;
  groupId: string;
  userId: string;
  userName: string;
  userPhoto: string | null;
  photo: string;
  photos?: string[] | null;
  description: string;
  workoutInfo: string;
  muscleGroup: string | null;
  /** All distinct muscle groups trained in this check-in (may have more than one, e.g. Legs + Shoulders). */
  muscleGroups: string[];
  exercises: CompletedRoutineExercise[];
  series: number;
  volume: number;
  durationMinutes?: number | null;
  distanceKm?: number | null;
  steps?: number | null;
  calories?: number | null;
  createdAt: string;
};

// Create a new duel group
export async function createDuelGroupDb(
  createdBy: string,
  name: string,
  location: string,
  goal: string,
  members: string[],
  endDate?: string,
  scoringType: DuelScoringType = "check_in_count",
  memeRule?: string
): Promise<DuelGroup> {
  if (!supabase) throw new Error("Supabase not configured");

  try {
    // Create the group
    const { data: groupData, error: groupError } = await supabase
      .from("duel_groups")
      .insert({
        created_by: createdBy,
        name,
        location,
        goal,
        end_date: endDate || null,
        icon: "⚔️",
        scoring_type: scoringType,
        meme_rule: memeRule || null,
      })
      .select()
      .single();

    if (groupError) throw groupError;
    if (!groupData) throw new Error("Failed to create group");

    // Add the creator as accepted participant, invited members as pending
    const rows = [
      { group_id: groupData.id, user_id: createdBy, status: "accepted" },
      ...members.map((userId) => ({ group_id: groupData.id, user_id: userId, status: "invited" })),
    ];
    const { error: participantsError } = await supabase
      .from("duel_group_participants")
      .insert(rows);

    if (participantsError) throw participantsError;

    // Send duel invite notification to each invited member (never to the creator themselves)
    const membersToNotify = members.filter((id) => id !== createdBy);
    if (membersToNotify.length > 0) {
      const { error: notifError } = await supabase.from("notifications").insert(
        membersToNotify.map((userId) => ({
          user_id: userId,
          follower_id: createdBy,
          type: 4,
          post_id: groupData.id,
          read: false,
        }))
      );
      if (notifError) {
        console.error("Error inserting duel invite notifications:", notifError);
      }
    }


    invalidateQueryCache("enrichedDuelGroups"); invalidateQueryCache("followingGroups"); invalidateQueryCache("userDuelGroups");
    return {
      id: groupData.id,
      createdBy: groupData.created_by,
      name: groupData.name,
      location: groupData.location,
      goal: groupData.goal,
      icon: groupData.icon,
      createdAt: groupData.created_at,
      updatedAt: groupData.updated_at,
      endDate: groupData.end_date,
      scoringType: (groupData.scoring_type as DuelScoringType) || "check_in_count",
      memeRule: groupData.meme_rule || null,
    };
  } catch (error: any) {
    const errorMsg = error?.message || JSON.stringify(error);
    console.error("Error creating duel group:", errorMsg);
    console.error("Full error details:", error);
    throw new Error(errorMsg);
  }
}

// Get group by ID with participant count
export async function getDuelGroupDb(groupId: string): Promise<DuelGroup | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("duel_groups")
      .select("*")
      .eq("id", groupId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      createdBy: data.created_by,
      name: data.name,
      location: data.location,
      goal: data.goal,
      icon: data.icon,
      photo: data.photo || null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      endDate: data.end_date,
      scoringType: (data.scoring_type as DuelScoringType) || "check_in_count",
      memeRule: data.meme_rule || null,
    };
  } catch (error) {
    console.error("Error getting duel group:", error);
    return null;
  }
}

// Optimized: fetch available groups enriched with participant count, creator profile and membership
// status in 3 parallel queries instead of N*2+1 sequential ones.
export type EnrichedDuelGroup = DuelGroup & {
  creatorNickname: string;
  creatorPhoto: string | null;
  participants: number;
  isAlreadyMember: boolean;
  isPending: boolean;
};

export async function getEnrichedDuelGroupsDb(
  userId: string,
  /** `fresh` ignora o cache — usado pela aba de Solicitações e pelo realtime. */
  opts?: { fresh?: boolean },
): Promise<{ myGroups: EnrichedDuelGroup[]; availableGroups: EnrichedDuelGroup[]; pendingInvites: Array<{ groupId: string; groupName: string; groupGoal: string; groupLocation: string }> }> {
  if (!supabase) return { myGroups: [], availableGroups: [], pendingInvites: [] };

  return cached(`enrichedDuelGroups:${userId}`, CACHE_TTL_SHORT, async () => {
  try {
    // 3 parallel queries — no waterfall
    const [createdResult, availResult, participantsResult] = await Promise.all([
      // My created groups
      supabase
        .from("duel_groups")
        .select("id, created_by, name, location, goal, icon, photo, created_at, updated_at, end_date, scoring_type")
        .eq("created_by", userId)
        .order("created_at", { ascending: false }),

      // Available groups (not created by me)
      supabase
        .from("duel_groups")
        .select("id, created_by, name, location, goal, icon, photo, created_at, updated_at, end_date, scoring_type")
        .neq("created_by", userId)
        .order("created_at", { ascending: false }),

      // All participations across all groups (accepted + pending) — one query for everything
      supabase
        .from("duel_group_participants")
        .select("group_id, user_id, status"),
    ]);

    const createdGroups = createdResult.data ?? [];
    const availGroups = availResult.data ?? [];
    const allParticipants = participantsResult.data ?? [];

    // Build lookup maps from the single participants query
    const countMap: Record<string, number> = {};
    const memberMap: Record<string, boolean> = {};
    const pendingMap: Record<string, boolean> = {}; // join requests sent by the user (status = "pending")
    const invitedMap: Record<string, boolean> = {}; // invites received by the user (status = "invited")

    for (const p of allParticipants) {
      if (!p.group_id) continue;
      const isAccepted = !p.status || p.status === "accepted";
      if (isAccepted) {
        countMap[p.group_id] = (countMap[p.group_id] ?? 0) + 1;
        if (p.user_id === userId) memberMap[p.group_id] = true;
      } else if (p.status === "pending" && p.user_id === userId) {
        pendingMap[p.group_id] = true;
      } else if (p.status === "invited" && p.user_id === userId) {
        invitedMap[p.group_id] = true;
      }
    }

    // Batch-fetch creator profiles for available groups + current user (for created groups)
    const creatorIds = [...new Set([userId, ...availGroups.map((g: any) => g.created_by)].filter(Boolean))];
    const creatorProfileMap: Record<string, { nickname: string; photo: string | null }> = {};
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nickname, photo")
        .in("user_id", creatorIds);
      (profiles ?? []).forEach((p: any) => {
        creatorProfileMap[p.user_id] = { nickname: p.nickname || "Usuário", photo: p.photo || null};
      });
    }


    const toBase = (g: any): DuelGroup => ({
      id: g.id,
      createdBy: g.created_by,
      name: g.name,
      location: g.location,
      goal: g.goal,
      icon: g.icon ?? "⚔️",
      photo: g.photo || null,
      createdAt: g.created_at,
      updatedAt: g.updated_at,
      endDate: g.end_date,
      scoringType: (g.scoring_type as DuelScoringType) || "check_in_count",
      memeRule: g.meme_rule || null,
    });

    // Groups where user is a participant (accepted, not created by user)
    const participantGroupIds = allParticipants
      .filter((p) => p.user_id === userId && (!p.status || p.status === "accepted"))
      .map((p) => String(p.group_id));
    const createdGroupIds = new Set(createdGroups.map((g: any) => String(g.id)));
    const participantOnlyGroupIds = participantGroupIds.filter((id) => !createdGroupIds.has(id));

    let participantGroups: any[] = [];
    if (participantOnlyGroupIds.length > 0) {
      const { data: pgData } = await supabase
        .from("duel_groups")
        .select("id, created_by, name, location, goal, icon, photo, created_at, updated_at, end_date, scoring_type")
        .in("id", participantOnlyGroupIds);
      participantGroups = pgData ?? [];
    }

    // Fetch creator profiles for participant groups (they have a different creator than the current user)
    const participantGroupCreatorIds = [...new Set(participantGroups.map((g: any) => g.created_by).filter(Boolean))];
    const participantCreatorProfileMap: Record<string, { nickname: string; photo: string | null }> = {};
    if (participantGroupCreatorIds.length > 0) {
      const { data: pgProfiles } = await supabase
        .from("profiles")
        .select("user_id, nickname, photo")
        .in("user_id", participantGroupCreatorIds);
      (pgProfiles ?? []).forEach((p: any) => {
        participantCreatorProfileMap[p.user_id] = { nickname: p.nickname || "Usuário", photo: p.photo || null};
      });
    }

    const myGroups: EnrichedDuelGroup[] = [
      ...createdGroups.map((g: any) => {
        const creator = creatorProfileMap[g.created_by] ?? { nickname: "Usuário", photo: null};
        return {
          ...toBase(g),
          creatorNickname: creator.nickname,
          creatorPhoto: creator.photo,
          participants: countMap[g.id] ?? 1,
          isAlreadyMember: true,
          isPending: false,
        };
      }),
      ...participantGroups.map((g: any) => {
        const creator = participantCreatorProfileMap[g.created_by] ?? { nickname: "Usuário", photo: null};
        return {
          ...toBase(g),
          creatorNickname: creator.nickname,
          creatorPhoto: creator.photo,
          participants: countMap[g.id] ?? 1,
          isAlreadyMember: true,
          isPending: false,
        };
      }),
    ];

    const availableGroups: EnrichedDuelGroup[] = availGroups.map((g: any) => {
      const creator = creatorProfileMap[g.created_by] ?? { nickname: "Usuário", photo: null};
      return {
        ...toBase(g),
        creatorNickname: creator.nickname,
        creatorPhoto: creator.photo,
        participants: countMap[g.id] ?? 1,
        isAlreadyMember: memberMap[g.id] ?? false,
        isPending: pendingMap[g.id] ?? false,
      };
    });

    // Build pendingInvites from invitedMap (groups where the user received an invite, NOT where they requested to join)
    const invitedGroupIds = Object.keys(invitedMap);
    const pendingInvites = availGroups
      .filter((g: any) => invitedGroupIds.includes(String(g.id)))
      .map((g: any) => ({
        groupId: String(g.id),
        groupName: String(g.name),
        groupGoal: String(g.goal || ""),
        groupLocation: String(g.location || ""),
      }));

    return { myGroups, availableGroups, pendingInvites };
  } catch (error) {
    console.error("Error getting enriched duel groups:", error);
    return { myGroups: [], availableGroups: [], pendingInvites: [] };
  }
  }, { fresh: opts?.fresh }); // end cached
}

// Upload group cover photo and persist URL to DB
export async function updateGroupInfoDb(
  groupId: string,
  name: string,
  goal: string,
  /** Regra do modo memes. `undefined` não toca na coluna (grupo de outra
   *  modalidade); string vazia limpa. */
  memeRule?: string | null,
): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const patch: { name: string; goal: string; meme_rule?: string | null } = { name, goal };
  if (memeRule !== undefined) patch.meme_rule = memeRule || null;
  const { error } = await supabase
    .from("duel_groups")
    .update(patch)
    .eq("id", groupId);
  if (error) throw error;

  invalidateQueryCache("enrichedDuelGroups");
}

export async function updateGroupPhotoDb(groupId: string, file: File): Promise<string> {
  if (!supabase) throw new Error("Supabase not configured");
  const ext = file.name.split(".").pop() ?? "jpg";
  // Capa antiga, para apagar depois que a nova estiver gravada.
  const { data: prevGroup } = await supabase
    .from("duel_groups")
    .select("photo")
    .eq("id", groupId)
    .maybeSingle();
  // Caminho único por upload: reusar `cover.{ext}` fazia o CDN e o WebView
  // continuarem servindo a capa antiga na mesma URL por até 1h.
  const path = `group-covers/${groupId}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("posts")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (uploadError) throw uploadError;
  const { data: urlData } = supabase.storage.from("posts").getPublicUrl(path);
  const photoUrl = urlData.publicUrl;
  const { error: updateError } = await supabase
    .from("duel_groups")
    .update({ photo: photoUrl })
    .eq("id", groupId);
  if (updateError) throw updateError;

  // NOTA: `group-covers/{groupId}/…` não tem uid no caminho, então a policy
  // `posts_delete_own_media` só libera pelo critério `owner = auth.uid()` —
  // funciona para quem subiu a capa (o dono do grupo, na prática).
  await removeReplacedMedia((prevGroup as any)?.photo, photoUrl);

  invalidateQueryCache("enrichedDuelGroups"); invalidateQueryCache("followingGroups"); invalidateQueryCache("userDuelGroups");
  return photoUrl;
}

// Add check-in to group
export async function addGroupCheckInDb(
  groupId: string,
  userId: string,
  photo: string,
  description: string,
  workoutInfo: string,
  series: number = 0,
  volume: number = 0,
  muscleGroup: string | null = null,
  exercises: CompletedRoutineExercise[] = [],
  photos: string[] = [],
  durationMinutes: number | null = null,
  distanceKm: number | null = null,
  steps: number | null = null,
  calories: number | null = null,
  workoutCompletedAt: string | null = null,
): Promise<GroupCheckIn> {
  if (!supabase) throw new Error("Supabase not configured");

  try {
    // Fetch current profile to avoid storing stale nickname/photo
    const { data: profile } = await supabase
      .from("profiles")
      .select("nickname, photo")
      .eq("user_id", userId)
      .single();

    const currentNickname = profile?.nickname || "Usuário";

    // All distinct muscle groups trained in this check-in, most-frequent
    // first (same ranking as `muscleGroup`, which is just muscleGroups[0]).
    // A session with both Legs and Shoulders shows a tag for each, instead
    // of only the one with the most exercises.
    const muscleGroupCounts: Record<string, number> = {};
    exercises.forEach((ex) => {
      if (ex.muscleGroup) muscleGroupCounts[ex.muscleGroup] = (muscleGroupCounts[ex.muscleGroup] || 0) + 1;
    });
    const muscleGroups = Object.entries(muscleGroupCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([mg]) => mg);

    const { data, error } = await supabase
      .from("duel_check_ins")
      .insert({
        group_id: groupId,
        user_id: userId,
        user_name: currentNickname,
        photo,
        photos,
        description,
        workout_info: workoutInfo,
        series,
        volume,
        muscle_group: muscleGroup,
        muscle_groups: muscleGroups.length > 0 ? muscleGroups : null,
        exercises: JSON.stringify(exercises),
        duration_minutes: durationMinutes,
        distance_km: distanceKm,
        steps,
        calories,
        // Check-in's date/time follows when the routine was actually completed,
        // not when the user got around to posting it (e.g. posting today a
        // workout done yesterday should still land on yesterday's date).
        ...(workoutCompletedAt ? { created_at: workoutCompletedAt } : {}),
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error("Failed to create check-in");

    // Avisa os outros participantes do duelo (fire-and-forget — não segura a UI)
    sendDuelCheckInNotificationsDb(groupId, data.id, userId).catch((err) =>
      console.error("Error sending duel check-in notifications:", err),
    );

    invalidateQueryCache("groupCheckIns");
    return {
      id: data.id,
      groupId: data.group_id,
      userId: data.user_id,
      userName: currentNickname,
      userPhoto: profile?.photo || null,
      photo: data.photo || "",
      photos: data.photos || (data.photo ? [data.photo] : []),
      description: data.description || "",
      workoutInfo: data.workout_info || "",
      muscleGroup: data.muscle_group || null,
      muscleGroups: Array.isArray(data.muscle_groups) ? data.muscle_groups : muscleGroups,
      exercises,
      series: data.series || 0,
      volume: data.volume || 0,
      durationMinutes: data.duration_minutes ?? null,
      distanceKm: data.distance_km ?? null,
      steps: data.steps ?? null,
      calories: data.calories ?? null,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error("Error adding check-in:", error);
    throw error;
  }
}

/**
 * Notificação de check-in em grupo de duelo (tipo 11).
 *
 * Todo participante já aceito no grupo — exceto o autor — recebe uma linha em
 * `notifications` (e, por consequência do webhook, um push). O id do grupo vai em
 * `post_id` (mesma convenção dos tipos 4 e 5, usada para exibir o nome do duelo) e
 * o id do check-in em `duel_check_in_id`, que é o que abre o check-in ao tocar no card.
 */
async function sendDuelCheckInNotificationsDb(
  groupId: string,
  checkInId: string,
  authorId: string,
): Promise<void> {
  if (!supabase) return;

  const { data: participants, error } = await supabase
    .from("duel_group_participants")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("status", "accepted");

  if (error) {
    console.error("Error loading duel participants for notification:", error);
    return;
  }

  const recipients = [
    ...new Set((participants ?? []).map((p: any) => String(p.user_id))),
  ].filter((id) => id && id !== authorId);

  if (recipients.length === 0) return;

  const { error: notifError } = await supabase.from("notifications").insert(
    recipients.map((userId) => ({
      user_id: userId,
      follower_id: authorId,
      type: 11,
      post_id: groupId,
      duel_check_in_id: checkInId,
      read: false,
    })),
  );

  if (notifError) {
    console.error("Error inserting duel check-in notifications:", notifError);
  }
}

// Get check-ins for a group (optimized: only columns needed for the list, no exercises payload)
export async function getGroupCheckInsDb(groupId: string): Promise<GroupCheckIn[]> {
  return cached(`groupCheckIns:${groupId}`, CACHE_TTL_SHORT, async () => {  if (!supabase) return [];

  try {
    // Sem `.limit()`: o placar, o líder e o calendário de check-ins do membro
    // são calculados no cliente a partir desta lista, então um teto aqui não
    // "cortava a lista", ele dava pontuação errada. Quem consome pagina a
    // *renderização* (ver `visibleCheckInCount` em Community.tsx), que é onde o
    // custo de verdade estava. O PostgREST ainda aplica o teto global de 1000
    // linhas, folgado para um grupo de duelo.
    const { data, error } = await supabase
      .from("duel_check_ins")
      .select("id, group_id, user_id, user_name, photo, description, workout_info, muscle_group, muscle_groups, series, volume, duration_minutes, distance_km, steps, calories, created_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });

    if (error) console.error("Error getting check-ins:", error);
    if (error || !data) return [];

    // Batch-fetch current profiles (nickname + photo) to avoid stale stored data
    const userIds = [...new Set(data.map((c: any) => String(c.user_id)).filter(Boolean))];
    const profileMap = new Map<string, { nickname: string; photo: string | null }>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nickname, photo")
        .in("user_id", userIds);
      (profiles ?? []).forEach((p: any) => {
        profileMap.set(String(p.user_id), { nickname: p.nickname || "Usuário", photo: p.photo || null});
      });
    }

    return data.map((checkIn: any) => {
      const profile = profileMap.get(String(checkIn.user_id));
      return {
        id: checkIn.id,
        groupId: checkIn.group_id,
        userId: checkIn.user_id,
        userName: profile?.nickname ?? checkIn.user_name ?? "Usuário",
        userPhoto: profile?.photo ?? null,
        photo: checkIn.photo || "",
        // Ensure photos is always an array, even if it's a string or null from the DB
        photos: Array.isArray(checkIn.photos)
          ? checkIn.photos
          : (typeof checkIn.photos === "string" && checkIn.photos.startsWith("[")
            ? (() => { try { return JSON.parse(checkIn.photos); } catch { return [checkIn.photo || ""]; } })()
            : (checkIn.photo ? [checkIn.photo] : [])),
        description: checkIn.description || "",
        workoutInfo: checkIn.workout_info || "",
        muscleGroup: checkIn.muscle_group || null,
        muscleGroups: Array.isArray(checkIn.muscle_groups) && checkIn.muscle_groups.length > 0
          ? checkIn.muscle_groups
          : (checkIn.muscle_group ? [checkIn.muscle_group] : []),
        exercises: [],
        series: checkIn.series || 0,
        volume: checkIn.volume || 0,
        durationMinutes: checkIn.duration_minutes ?? null,
        distanceKm: checkIn.distance_km ?? null,
        steps: checkIn.steps ?? null,
        calories: checkIn.calories ?? null,
        createdAt: checkIn.created_at,
      };
    });
  } catch (error) {
    console.error("Error getting check-ins:", error);
    return [];
  }

  });
}

// Get full check-in detail (with exercises, description, series, volume and user photo)
export async function getGroupCheckInDetailDb(checkInId: string): Promise<GroupCheckIn | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("duel_check_ins")
      .select("*")
      .eq("id", checkInId)
      .single();

    if (error) console.error("Error getting check-in detail:", error);
    if (error || !data) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("nickname, photo")
      .eq("user_id", data.user_id)
      .single();

    return {
      id: data.id,
      groupId: data.group_id,
      userId: data.user_id,
      userName: profile?.nickname ?? data.user_name ?? "Usuário",
      userPhoto: profile?.photo ?? null,
      photo: data.photo || "",
      // Ensure photos is always an array, even if it's a string or null from the DB
      photos: Array.isArray(data.photos)
        ? data.photos
        : (typeof data.photos === "string" && data.photos.startsWith("[")
          ? (() => { try { return JSON.parse(data.photos); } catch { return [data.photo || ""]; } })()
          : (data.photo ? [data.photo] : [])),
      description: data.description || "",
      workoutInfo: data.workout_info || "",
      muscleGroup: data.muscle_group || null,
      muscleGroups: (() => {
        if (Array.isArray(data.muscle_groups) && data.muscle_groups.length > 0) return data.muscle_groups;
        // Older check-ins predate the muscle_groups column — derive it from
        // the exercises payload so the detail view still shows every group.
        try {
          const parsed = JSON.parse(data.exercises || "[]");
          return [...new Set(parsed.map((ex: any) => ex.muscleGroup).filter(Boolean))] as string[];
        } catch {
          return data.muscle_group ? [data.muscle_group] : [];
        }
      })(),
      exercises: (() => {
        try { return JSON.parse(data.exercises || "[]"); } catch { return []; }
      })(),
      series: data.series || 0,
      volume: data.volume || 0,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error("Error getting check-in detail:", error);
    return null;
  }
}

// Update a check-in
export async function uploadCheckInPhotoDb(userId: string, file: File, index: number): Promise<string> {
  if (!supabase) throw new Error("Supabase not configured");
  const ext = file.name.split(".").pop() || "jpg";
  const filePath = `checkins/${userId}/${Date.now()}-${index}.${ext}`;
  const { error } = await supabase.storage
    .from("posts")
    .upload(filePath, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("posts").getPublicUrl(filePath);
  return data.publicUrl;
}

export async function updateGroupCheckInDb(
  checkInId: string,
  workoutInfo: string,
  description: string,
  photo?: string,
  photos?: string[]
): Promise<GroupCheckIn> {
  if (!supabase) throw new Error("Supabase not configured");

  try {
    const updatePayload: Record<string, unknown> = {
      workout_info: workoutInfo,
      description: description,
    };
    if (photo !== undefined) updatePayload.photo = photo;
    if (photos !== undefined) updatePayload.photos = photos;

    const { data, error } = await supabase
      .from("duel_check_ins")
      .update(updatePayload)
      .eq("id", checkInId)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error("Failed to update check-in");

    invalidateQueryCache("groupCheckIns");

    return {
      id: data.id,
      groupId: data.group_id,
      userId: data.user_id,
      userName: data.user_name,
      userPhoto: null,
      photo: data.photo || "",
      photos: Array.isArray(data.photos) ? data.photos : (data.photo ? [data.photo] : []),
      description: data.description || "",
      workoutInfo: data.workout_info || "",
      muscleGroup: data.muscle_group || null,
      muscleGroups: Array.isArray(data.muscle_groups) && data.muscle_groups.length > 0
        ? data.muscle_groups
        : (data.muscle_group ? [data.muscle_group] : []),
      exercises: (() => { try { return JSON.parse(data.exercises || "[]"); } catch { return []; } })(),
      series: data.series || 0,
      volume: data.volume || 0,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error("Error updating check-in:", error);
    throw error;
  }
}

// Delete a check-in
export async function deleteGroupCheckInDb(checkInId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");

  try {
    // Mídia antes do delete. `photos` é o carrossel do check-in; a foto padrão
    // do mascote (asset do app, não do Storage) é ignorada por removeStorageObjects.
    const { data: checkInData } = await supabase
      .from("duel_check_ins")
      .select("photo, photos")
      .eq("id", checkInId)
      .maybeSingle();

    const { error } = await supabase
      .from("duel_check_ins")
      .delete()
      .eq("id", checkInId);

    if (error) throw error;

    await removeStorageObjects(collectMediaUrls(checkInData, ["photo"], ["photos"]));
  } catch (error) {
    console.error("Error deleting check-in:", error);
    throw error;
  }

  invalidateQueryCache("groupCheckIns");
}

// Fetch all votes for check-ins in a group (for "memes" scoring mode)
export async function getCheckInVotesDb(groupId: string): Promise<DuelCheckInVote[]> {
  if (!supabase) return [];
  try {
    // Join through duel_check_ins to filter by group
    const { data, error } = await supabase
      .from("duel_check_in_votes")
      .select("check_in_id, user_id, vote_type, duel_check_ins!inner(group_id)")
      .eq("duel_check_ins.group_id", groupId);

    if (error || !data) return [];
    return (data as any[]).map((v) => ({
      checkInId: v.check_in_id,
      userId: v.user_id,
      voteType: v.vote_type as DuelCheckInVoteType,
    }));
  } catch {
    return [];
  }
}

// Set (or remove) a vote on a check-in. Pass null to remove.
export async function setCheckInVoteDb(
  checkInId: string,
  voteType: DuelCheckInVoteType | null
): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const viewer = await getViewer();
  if (!viewer) throw new Error("Not authenticated");

  if (voteType === null) {
    const { error } = await supabase
      .from("duel_check_in_votes")
      .delete()
      .eq("check_in_id", checkInId)
      .eq("user_id", viewer.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("duel_check_in_votes")
      .upsert({ check_in_id: checkInId, user_id: viewer.id, vote_type: voteType }, { onConflict: "check_in_id,user_id" });
    if (error) throw error;
  }
}

// Add members to a duel group
export async function addMembersToGroupDb(
  groupId: string,
  memberIds: string[],
  status: "pending" | "invited" = "pending"
): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");

  const viewer = await getViewer();

  try {
    // Get existing participants
    const { data: existingParticipants, error: fetchError } = await supabase
      .from("duel_group_participants")
      .select("user_id")
      .eq("group_id", groupId);

    if (fetchError) throw fetchError;

    const existingUserIds = new Set(existingParticipants?.map((p: any) => p.user_id) || []);

    // Filter out members who are already in the group
    const newMembers = memberIds.filter((id) => !existingUserIds.has(id));

    if (newMembers.length === 0) return;

    // Add new members with pending status
    const { error: insertError } = await supabase
      .from("duel_group_participants")
      .insert(
        newMembers.map((userId) => ({
          group_id: groupId,
          user_id: userId,
          status: status,
        }))
      );

    if (insertError) throw insertError;

    // Only send duel invite notifications when members were explicitly invited (not for self join requests)
    // Also never notify the viewer about their own action
    if (status === "invited") {
      const membersToInvite = newMembers.filter((id) => id !== viewer.id);
      const { error: notifError } = membersToInvite.length > 0
        ? await supabase.from("notifications").insert(
            membersToInvite.map((userId) => ({
              user_id: userId,
              follower_id: viewer.id,
              type: 4,
              post_id: groupId,
              read: false,
            }))
          )
        : { error: null };
      if (notifError) {
        console.error("Error inserting duel invite notifications:", notifError);
      }
    }
  } catch (error) {
    console.error("Error adding members to group:", error);
    throw error;
  }

  invalidateQueryCache("groupParticipants"); invalidateQueryCache("enrichedDuelGroups"); invalidateQueryCache("pendingGroupRequests");
}

// Leave a duel group (remove current user from participants)
export async function leaveGroupDb(groupId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");

  const viewer = await getViewer();
  if (!viewer) throw new Error("Usuário não autenticado");

  // Get all check-in IDs of this user in this group
  const { data: checkIns } = await supabase
    .from("duel_check_ins")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", viewer.id);

  if (checkIns && checkIns.length > 0) {
    const checkInIds = checkIns.map((c: any) => c.id);

    // Delete reactions and comments on this user's check-ins
    await supabase.from("duel_check_in_reactions").delete().in("check_in_id", checkInIds);
    await supabase.from("duel_check_in_comments").delete().in("check_in_id", checkInIds);

    // Delete the check-ins themselves
    await supabase.from("duel_check_ins").delete().in("id", checkInIds);
  }

  // Also remove any reactions/comments this user left on other check-ins in this group
  const { data: otherCheckIns } = await supabase
    .from("duel_check_ins")
    .select("id")
    .eq("group_id", groupId);

  if (otherCheckIns && otherCheckIns.length > 0) {
    const allCheckInIds = otherCheckIns.map((c: any) => c.id);
    await supabase
      .from("duel_check_in_reactions")
      .delete()
      .in("check_in_id", allCheckInIds)
      .eq("user_id", viewer.id);
    await supabase
      .from("duel_check_in_comments")
      .delete()
      .in("check_in_id", allCheckInIds)
      .eq("user_id", viewer.id);
  }

  const { error } = await supabase
    .from("duel_group_participants")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", viewer.id);

  if (error) throw error;

  invalidateQueryCache("enrichedDuelGroups"); invalidateQueryCache("followingGroups"); invalidateQueryCache("userDuelGroups"); invalidateQueryCache("groupParticipants");
}

// Accept a pending group invite
export async function acceptGroupInviteDb(groupId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const viewer = await getViewer();
  if (!viewer) throw new Error("Usuário não autenticado");

  const { error } = await supabase
    .from("duel_group_participants")
    .update({ status: "accepted" })
    .eq("group_id", groupId)
    .eq("user_id", viewer.id);

  if (error) throw error;

  invalidateQueryCache("pendingInvites"); invalidateQueryCache("enrichedDuelGroups"); invalidateQueryCache("groupParticipants");
}

// Send a join-request notification to the group creator (type 5 = join request)
export async function sendGroupJoinRequestNotificationDb(groupId: string, creatorId: string): Promise<void> {
  if (!supabase) return;
  const viewer = await getViewer();
  if (!viewer) return;
  // Never send a notification to yourself (happens if createdBy === viewer due to stale data)
  if (viewer.id === creatorId) return;

  const { error } = await supabase.from("notifications").insert({
    user_id: creatorId,
    follower_id: viewer.id,
    type: 5,
    post_id: groupId,
    read: false,
  });
  if (error) {
    console.error("Error sending join request notification:", error);
  }
}

// Decline (delete) a pending group invite
export async function declineGroupInviteDb(groupId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const viewer = await getViewer();
  if (!viewer) throw new Error("Usuário não autenticado");

  const { error } = await supabase
    .from("duel_group_participants")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", viewer.id)
    .eq("status", "invited");

  if (error) throw error;

  // `pendingInvites` não é uma chave de cache própria — a lista sai de
  // `enrichedDuelGroups`. Sem invalidar esta, o convite recusado voltava a
  // aparecer por até 30s (e sobrevivia ao fechar o app, via localStorage).
  invalidateQueryCache("pendingInvites"); invalidateQueryCache("enrichedDuelGroups"); invalidateQueryCache("groupParticipants");
}

// Get all participants of a duel group with their user details
export async function getGroupParticipantsDb(
  groupId: string
): Promise<Array<{ userId: string; userNickname: string; userPhoto: string | null }>> {
  return cached(`groupParticipants:${groupId}`, CACHE_TTL_SHORT, async () => {  if (!supabase) return [];

  try {
    // Get accepted participants from duel_group_participants table, then get their user details
    const { data: participants, error: fetchError } = await supabase
      .from("duel_group_participants")
      .select("user_id")
      .eq("group_id", groupId)
      .or("status.eq.accepted,status.is.null");

    if (fetchError) {
      const errorMsg = fetchError?.message || JSON.stringify(fetchError);
      console.error("Error fetching participants:", errorMsg);
      throw fetchError;
    }

    if (!participants || participants.length === 0) return [];

    // Get user details for each participant
    const userIds = participants.map((p: any) => p.user_id);
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, nickname, photo")
      .in("user_id", userIds);

    if (profileError) {
      const errorMsg = profileError?.message || JSON.stringify(profileError);
      console.error("Error fetching user profiles:", errorMsg);
      throw profileError;
    }

    return (profiles || []).map((profile: any) => ({
      userId: profile.user_id,
      userNickname: profile.nickname || "Usuário",
      userPhoto: profile.photo || null,
    }));
  } catch (error: any) {
    const errorMsg = error?.message || JSON.stringify(error);
    console.error("Error getting group participants:", errorMsg);
    console.error("Full error details:", error);
    return [];
  }

  });
}

// Delete a duel group
export async function deleteGroupDb(groupId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");

  const viewer = await getViewer();
  if (!viewer) throw new Error("Not authenticated");

  try {
    // Delete related rows first to avoid FK constraint violations
    const { data: checkIns } = await supabase
      .from("duel_check_ins")
      .select("id")
      .eq("group_id", groupId);

    if (checkIns && checkIns.length > 0) {
      const checkInIds = checkIns.map((c: any) => c.id);
      await supabase.from("duel_check_in_reactions").delete().in("check_in_id", checkInIds);
      await supabase.from("duel_check_in_comments").delete().in("check_in_id", checkInIds);
    }

    await supabase.from("duel_check_ins").delete().eq("group_id", groupId);
    await supabase.from("duel_group_participants").delete().eq("group_id", groupId);

    const { error: deleteError } = await supabase
      .from("duel_groups")
      .delete()
      .eq("id", groupId)
      .eq("created_by", viewer.id);

    if (deleteError) throw deleteError;
  } catch (error) {
    console.error("Error deleting group:", error);
    throw error;
  }

  invalidateQueryCache("enrichedDuelGroups"); invalidateQueryCache("followingGroups"); invalidateQueryCache("userDuelGroups");
}

// ─── Access Session Tracking ────────────────────────────────────────────────

// ─── Telemetria de tempo de tela (bufferizada) ────────────────────────────────
// Antes: 1 INSERT por troca de rota. Um usuário que navega 80x na sessão gerava
// 80 round-trips e 80 linhas — puro custo de escrita, num dado que ninguém lê em
// tempo real (a tabela é só analytics).
//
// Agora: a duração é acumulada em localStorage, somada por (dia, tela), e vai ao
// banco num único insert em lote no flush (app indo para background / próxima
// abertura). A semântica do dado é preservada — duration_seconds continua sendo o
// total do usuário naquela tela naquele dia, só que somado no cliente em vez de
// espalhado em dezenas de linhas.

const SCREEN_TIME_BUFFER_KEY = "lk:screenTimeBuf";

type ScreenTimeBuffer = Record<string, number>; // "YYYY-MM-DD|/rota" → segundos

function readScreenTimeBuffer(): ScreenTimeBuffer {
  try {
    const raw = localStorage.getItem(SCREEN_TIME_BUFFER_KEY);
    return raw ? (JSON.parse(raw) as ScreenTimeBuffer) : {};
  } catch {
    return {};
  }
}

/** Acumula tempo de tela localmente. Não faz rede. */
export function bufferScreenTime(screen: string, durationSeconds: number): void {
  if (durationSeconds < 3) return;
  try {
    const buf = readScreenTimeBuffer();
    const key = `${new Date().toISOString().split("T")[0]}|${screen}`;
    buf[key] = (buf[key] ?? 0) + durationSeconds;
    localStorage.setItem(SCREEN_TIME_BUFFER_KEY, JSON.stringify(buf));
  } catch {
    // Quota/serialização — telemetria é best-effort, nunca quebra a navegação.
  }
}

/** Envia o buffer acumulado num único insert em lote e limpa. */
export async function flushScreenTimeDb(userId: string): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;
  const buf = readScreenTimeBuffer();
  const entries = Object.entries(buf);
  if (entries.length === 0) return;

  // Limpa ANTES do await: se o insert falhar, perdemos telemetria (aceitável),
  // mas nunca reenviamos em dobro nem crescemos o buffer indefinidamente.
  try {
    localStorage.removeItem(SCREEN_TIME_BUFFER_KEY);
  } catch {
    // ignore
  }

  const rows = entries.map(([key, seconds]) => {
    const sep = key.indexOf("|");
    return {
      user_id: userId,
      screen: key.slice(sep + 1),
      duration_seconds: Math.round(seconds),
      log_date: key.slice(0, sep),
    };
  });

  try {
    await supabase.from("screen_time_logs").insert(rows);
  } catch (err) {
    console.error("Error flushing screen time:", err);
  }
}

export async function recordAccessSessionDb(userId: string, durationSeconds: number): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;
  try {
    await supabase.from("access_sessions").insert({
      user_id: userId,
      duration_seconds: durationSeconds,
      session_date: new Date().toISOString().split("T")[0],
    });
  } catch (err) {
    console.error("Error recording access session:", err);
  }
}

// ─── Delete Account ──────────────────────────────────────────────────────────

/**
 * Permanently deletes all data associated with a user across every table.
 * Order respects FK dependencies: dependent rows first, then parent rows.
 */
export async function deleteAllUserDataDb(userId: string): Promise<void> {
  if (!hasSupabaseConfig || !supabase) throw new Error("Supabase não configurado");
  assertUUID(userId, "ID do usuário");

  // Helper: delete from a table by a column filter, ignoring "no rows" errors
  const del = async (table: string, column: string, value: string) => {
    const { error } = await (supabase as any).from(table).delete().eq(column, value);
    if (error) console.error(`[deleteAllUserDataDb] ${table}.${column}:`, error.message);
  };

  // ── Batch 1: leaf tables with no children ───────────────────────────────
  await Promise.all([
    del("access_sessions", "user_id", userId),
    del("screen_time_logs", "user_id", userId),
    del("check_ins", "user_id", userId),
    del("flow_complaint", "user_id", userId),
    del("flow_user_viewed", "user_id", userId),
    del("flow_user_viewed", "follower_id", userId),
    del("shot_user_viewed", "user_id", userId),
    del("shot_user_viewed", "follower_id", userId),
    del("post_complaint", "user_id", userId),
    del("shots_complaint", "user_id", userId),
    del("user_complaint", "user_id", userId),
    del("user_complaint", "follower_id", userId),
    del("ranking", "user_id", userId),
    del("user_goals", "user_id", userId),
    del("user_habits_hist", "user_id", userId),
    del("user_diets_hist", "user_id", userId),
    del("user_workouts_hist", "user_id", userId),
    del("duel_check_ins", "user_id", userId),
    del("duel_group_participants", "user_id", userId),
  ]);

  // ── Batch 2: comments, likes and notifications (depend on posts/shots/flow) ─
  await Promise.all([
    del("comments", "user_id", userId),
    del("likes", "user_id", userId),
    del("flow_comments", "user_id", userId),
    del("flow_likes", "user_id", userId),
    del("shots_comments", "user_id", userId),
    del("shots_likes", "user_id", userId),
    del("notifications", "user_id", userId),
    del("notifications", "follower_id", userId),
    del("messages", "user_id", userId),
    del("messages", "following_id", userId),
  ]);

  // ── Batch 3: follow graph ─────────────────────────────────────────────────
  await Promise.all([
    del("following", "user_id", userId),
    del("following", "following_id", userId),
    del("followers", "user_id", userId),
    del("followers", "follower_id", userId),
  ]);

  // ── Batch 4: content owned by user ───────────────────────────────────────
  await Promise.all([
    del("routines", "user_id", userId),
    del("user_workouts", "user_id", userId),
    del("user_diets", "user_id", userId),
    del("user_habits", "user_id", userId),
    del("posts", "user_id", userId),
    del("shots", "user_id", userId),
    del("flow", "user_id", userId),
    del("duel_groups", "created_by", userId),
    del("commercial_profiles", "user_id", userId),
  ]);

  // ── Batch 4.5: mídia no Storage ──────────────────────────────────────────
  // Antes do Batch 6 obrigatoriamente: a policy de DELETE do Storage depende de
  // `auth.uid()`, e depois que a conta sai de `auth.users` não há mais sessão
  // para provar posse — a mídia ficaria órfã para sempre.
  await purgeUserStorageDb(userId);

  // ── Batch 5: profile (last — other tables may reference it) ──────────────
  await del("profiles", "user_id", userId);

  // ── Batch 6: delete from auth.users via server-side admin API ────────────
  const { data: sessionData } = await (supabase as NonNullable<typeof supabase>).auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  // Sem token não há como autenticar a exclusão. Falhar alto: as linhas do
  // usuário já foram apagadas acima, e um `return` silencioso deixaria a conta
  // viva em auth.users sem ninguém saber.
  if (!accessToken) {
    throw new Error("Sessão expirada — entre novamente para excluir a conta");
  }

  // URL ABSOLUTA obrigatoriamente. Dentro do WebView do Capacitor a base é
  // `capacitor://localhost`, então um caminho relativo nunca sai do aparelho:
  // ele bate no servidor local de assets, que — por não haver extensão no
  // caminho — devolve o index.html com HTTP 200. O `response.ok` dava true e a
  // conta em auth.users sobrevivia em silêncio, mesmo com todas as linhas do
  // usuário já apagadas. Ver `docs/19-compartilhamento-e-deep-links.md`.
  const response = await fetch(`${SHARE_BASE_URL}/api/delete-auth-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ userId }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    console.error("[deleteAllUserDataDb] delete-account HTTP", response.status, body);
    throw new Error(body?.error || `Falha ao encerrar conta (HTTP ${response.status})`);
  }
}

// ─── Conversations ───────────────────────────────────────────────────────────

/**
 * Hard-delete a message sent by the current user (only allowed within 10 minutes of sending).
 * Removes the record for both participants.
 */
export async function deleteMessagePermanentlyDb(messageId: string): Promise<void> {
  if (!hasSupabaseConfig || !supabase) throw new Error("Supabase não configurado");

  const viewer = await getViewer();
  if (!viewer) throw new Error("Não autenticado");

  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("id", messageId)
    .eq("user_id", viewer.id); // only own messages

  if (error) throw error;
}

/**
 * Soft-delete a message only for the current user by inserting into message_deletions.
 * The message remains visible for the other participant.
 *
 * Migration required:
 *   CREATE TABLE message_deletions (
 *     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *     message_id bigint NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
 *     user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 *     created_at timestamptz DEFAULT now() NOT NULL,
 *     UNIQUE(message_id, user_id)
 *   );
 *   ALTER TABLE message_deletions ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "Users manage own deletions" ON message_deletions FOR ALL USING (auth.uid() = user_id);
 */
export async function deleteMessageForMeDb(messageId: string): Promise<void> {
  if (!hasSupabaseConfig || !supabase) throw new Error("Supabase não configurado");

  const viewer = await getViewer();
  if (!viewer) throw new Error("Não autenticado");

  const { error } = await supabase
    .from("message_deletions")
    .upsert({ message_id: messageId, user_id: viewer.id }, { onConflict: "message_id,user_id" });

  if (error) throw error;
}

/** Soft-delete the entire conversation history for the current user only. */
export async function deleteConversationForMeDb(otherUserId: string): Promise<void> {
  if (!hasSupabaseConfig || !supabase) throw new Error("Supabase não configurado");
  assertUUID(otherUserId, "ID do usuário");

  const viewer = await getViewer();
  if (!viewer) throw new Error("Não autenticado");

  // Fetch all message IDs in this conversation
  const { data: msgs, error: fetchError } = await supabase
    .from("messages")
    .select("id")
    .or(
      `and(user_id.eq.${viewer.id},following_id.eq.${otherUserId}),and(user_id.eq.${otherUserId},following_id.eq.${viewer.id})`
    );

  if (fetchError) throw fetchError;
  if (!msgs || msgs.length === 0) return;

  const rows = msgs.map((m) => ({ message_id: m.id, user_id: viewer.id }));

  const { error } = await supabase
    .from("message_deletions")
    .upsert(rows, { onConflict: "message_id,user_id" });

  if (error) throw error;

  // Sem isto, a semente de first paint repinta o histórico "apagado" ao reabrir.
  clearConversationSeed(otherUserId, viewer.id);
  invalidateQueryCache("conversations"); invalidateQueryCache("unreadMsgCount");
}

// ─── Group Join Requests (owner view) ────────────────────────────────────────

export type GroupJoinRequest = {
  groupId: string;
  groupName: string;
  userId: string;
  userNickname: string;
  userPhoto: string | null;
  participants: number;
};

/**
 * Pedidos de entrada pendentes nos grupos de que o usuário é dono.
 *
 * `fresh` pula o cache: a aba de Solicitações é aberta pelo toque no push do
 * pedido que ACABOU de chegar — servir a lista de até 60s atrás ali é o mesmo
 * que não mostrar o pedido.
 */
export async function getPendingGroupRequestsDb(opts?: { fresh?: boolean }): Promise<GroupJoinRequest[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  const viewer = await getViewer();
  if (!viewer) return [];
  return cached(`pendingGroupRequests:${viewer.id}`, CACHE_TTL_MEDIUM, async () => {

  try {
    // Get my groups
    const { data: myGroups, error: groupsError } = await supabase
      .from("duel_groups")
      .select("id, name")
      .eq("created_by", viewer.id);

    if (groupsError || !myGroups || myGroups.length === 0) return [];

    const myGroupIds = myGroups.map((g: any) => g.id);

    // Get pending participants for those groups + accepted count
    const [pendingResult, countResult] = await Promise.all([
      supabase
        .from("duel_group_participants")
        .select("group_id, user_id")
        .in("group_id", myGroupIds)
        .eq("status", "pending"),
      supabase
        .from("duel_group_participants")
        .select("group_id, user_id, status")
        .in("group_id", myGroupIds),
    ]);

    const pendingRows = pendingResult.data ?? [];
    if (pendingRows.length === 0) return [];

    // Build accepted count map
    const countMap: Record<string, number> = {};
    for (const p of countResult.data ?? []) {
      if (!p.status || p.status === "accepted") {
        countMap[p.group_id] = (countMap[p.group_id] ?? 0) + 1;
      }
    }

    // Fetch profiles for pending users
    const userIds = [...new Set(pendingRows.map((p: any) => p.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nickname, photo")
      .in("user_id", userIds);

    const profileMap: Record<string, { nickname: string; photo: string | null }> = {};
    for (const p of profiles ?? []) {
      profileMap[p.user_id] = { nickname: p.nickname || "Usuário", photo: p.photo || null };
    }

    const groupNameMap: Record<string, string> = {};
    for (const g of myGroups) groupNameMap[g.id] = g.name;

    return pendingRows.map((p: any) => ({
      groupId: p.group_id,
      groupName: groupNameMap[p.group_id] || "Grupo",
      userId: p.user_id,
      userNickname: profileMap[p.user_id]?.nickname || "Usuário",
      userPhoto: profileMap[p.user_id]?.photo || null,
      participants: countMap[p.group_id] ?? 1,
    }));
  } catch (err) {
    console.error("Error getting pending group requests:", err);
    return [];
  }

  }, { fresh: opts?.fresh });
}

/** Approve a pending group join request */
export async function approveGroupRequestDb(groupId: string, requestUserId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase
    .from("duel_group_participants")
    .update({ status: "accepted" })
    .eq("group_id", groupId)
    .eq("user_id", requestUserId)
    .eq("status", "pending");
  if (error) throw error;

  invalidateQueryCache("pendingGroupRequests"); invalidateQueryCache("enrichedDuelGroups"); invalidateQueryCache("groupParticipants");
}

/** Reject a pending group join request */
export async function rejectGroupRequestDb(groupId: string, requestUserId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase
    .from("duel_group_participants")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", requestUserId)
    .eq("status", "pending");
  if (error) throw error;

  invalidateQueryCache("pendingGroupRequests"); invalidateQueryCache("enrichedDuelGroups"); invalidateQueryCache("groupParticipants");
}

/** Remove an accepted member from a group (owner action) */
export async function removeGroupMemberDb(groupId: string, memberUserId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase não configurado");
  const viewer = await getViewer();
  if (!viewer) throw new Error("Não autenticado");

  // Verify caller is the group owner
  const { data: group, error: groupError } = await supabase
    .from("duel_groups")
    .select("created_by")
    .eq("id", groupId)
    .single();

  if (groupError || !group) throw new Error("Grupo não encontrado");
  if (group.created_by !== viewer.id) throw new Error("Apenas o dono pode remover participantes");

  const { error } = await supabase
    .from("duel_group_participants")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", memberUserId);

  if (error) throw error;

  invalidateQueryCache("groupParticipants"); invalidateQueryCache("enrichedDuelGroups");
}

// ─── Check-in Comments ───────────────────────────────────────────────────────

export type CheckInComment = {
  id: string;
  checkInId: string;
  userId: string;
  userNickname: string;
  userPhoto: string | null;
  text: string;
  createdAt: string;
};

export async function getCheckInCommentsDb(checkInId: string): Promise<CheckInComment[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  return cached(`checkInComments:${checkInId}`, CACHE_TTL_SHORT, async () => {  assertUUID(checkInId, "ID do check-in");

  try {
    const { data, error } = await supabase
      .from("duel_check_in_comments")
      .select("id, check_in_id, user_id, text, created_at")
      .eq("check_in_id", checkInId)
      .order("created_at", { ascending: true });

    if (error) { console.error("Error fetching check-in comments:", error); return []; }
    if (!data || data.length === 0) return [];

    const userIds = [...new Set(data.map((c: any) => c.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nickname, photo")
      .in("user_id", userIds);

    const profileMap: Record<string, { nickname: string; photo: string | null }> = {};
    for (const p of profiles ?? []) {
      profileMap[p.user_id] = { nickname: p.nickname || "Usuário", photo: p.photo || null};
    }

    return data.map((c: any) => ({
      id: c.id,
      checkInId: c.check_in_id,
      userId: c.user_id,
      userNickname: profileMap[c.user_id]?.nickname || "Usuário",
      userPhoto: profileMap[c.user_id]?.photo || null,
      text: c.text,
      createdAt: c.created_at,
    }));
  } catch (err) {
    console.error("Error fetching check-in comments:", err);
    return [];
  }

  });
}

// ─── Check-in Emoji Reactions ─────────────────────────────────────────────────

export type CheckInReaction = {
  checkInId: string;
  userId: string;
  emoji: string;
  userName?: string;
  userPhoto?: string | null;
};

export async function getCheckInReactionsDb(checkInIds: string[]): Promise<Record<string, CheckInReaction[]>> {
  if (!hasSupabaseConfig || !supabase || checkInIds.length === 0) return {};
  return cached(`checkInReactions:${checkInIds}`, CACHE_TTL_SHORT, async () => {
  try {
    const { data } = await supabase
      .from("duel_check_in_reactions")
      .select("check_in_id, user_id, emoji")
      .in("check_in_id", checkInIds);

    const result: Record<string, CheckInReaction[]> = {};
    for (const r of data ?? []) {
      if (!result[r.check_in_id]) result[r.check_in_id] = [];
      result[r.check_in_id].push({ checkInId: r.check_in_id, userId: r.user_id, emoji: r.emoji });
    }
    return result;
  } catch {
    return {};
  }

  });
}

export type CheckInReactionWithUser = {
  userId: string;
  emoji: string;
  userName: string;
  userPhoto: string | null;
};

export async function getCheckInReactionUsersDb(checkInId: string): Promise<CheckInReactionWithUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  try {
    const { data: reactions } = await supabase
      .from("duel_check_in_reactions")
      .select("user_id, emoji")
      .eq("check_in_id", checkInId);

    if (!reactions || reactions.length === 0) return [];

    const userIds = reactions.map((r) => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nickname, photo")
      .in("user_id", userIds);

    const profileMap: Record<string, { nickname: string; photo: string | null }> = {};
    for (const p of profiles ?? []) {
      profileMap[p.user_id] = { nickname: p.nickname, photo: p.photo };
    }

    return reactions.map((r) => ({
      userId: r.user_id,
      emoji: r.emoji,
      userName: profileMap[r.user_id]?.nickname ?? "Usuário",
      userPhoto: profileMap[r.user_id]?.photo ?? null,
    }));
  } catch {
    return [];
  }
}

export async function setCheckInReactionDb(checkInId: string, emoji: string | null): Promise<void> {
  if (!supabase) return;
  const viewer = await getViewer();
  if (!viewer) return;

  if (emoji === null) {
    await supabase
      .from("duel_check_in_reactions")
      .delete()
      .eq("check_in_id", checkInId)
      .eq("user_id", viewer.id);
  } else {
    await supabase
      .from("duel_check_in_reactions")
      .upsert({ check_in_id: checkInId, user_id: viewer.id, emoji }, { onConflict: "check_in_id,user_id" });
  }

  invalidateQueryCache("checkInReactions");
}

// Notify the check-in owner when someone reacts to their check-in (type 7)
export async function sendCheckInReactionNotificationDb(checkInId: string, checkInOwnerId: string): Promise<void> {
  if (!supabase) return;
  const viewer = await getViewer();
  if (!viewer || viewer.id === checkInOwnerId) return;
  // Avoid duplicate: only notify once per reactor per check-in
  const { data: existing } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", checkInOwnerId)
    .eq("follower_id", viewer.id)
    .eq("type", 7)
    .eq("duel_check_in_id", checkInId)
    .maybeSingle();
  if (existing) return;
  await supabase.from("notifications").insert({
    user_id: checkInOwnerId,
    follower_id: viewer.id,
    type: 7,
    duel_check_in_id: checkInId,
    read: false,
  });
}

export async function addCheckInCommentDb(checkInId: string, text: string): Promise<CheckInComment> {
  if (!supabase) throw new Error("Supabase não configurado");
  assertUUID(checkInId, "ID do check-in");
  assertNotEmpty(text, "Comentário");
  assertMaxLength(text.trim(), 500, "Comentário");

  const viewer = await getViewer();
  if (!viewer) throw new Error("Não autenticado");

  const { data, error } = await supabase
    .from("duel_check_in_comments")
    .insert({ check_in_id: checkInId, user_id: viewer.id, text: text.trim() })
    .select("id, check_in_id, user_id, text, created_at")
    .single();

  if (error) throw error;

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname, photo")
    .eq("user_id", viewer.id)
    .maybeSingle();

  // Avisa o dono do check-in — pulado quando comenta no próprio check-in.
  //
  // Tipo 3 (comentário), NÃO tipo 6: até 2026-07-21 esta inserção usava o tipo 6,
  // que é "reagiu ao seu comentário". Quem recebia um comentário no check-in lia
  // "fulano reagiu ao seu comentário" — evento errado, e indistinguível da reação
  // real (que também grava tipo 6 + duel_check_in_id, em toggleCommentReactionDb).
  // Com o tipo 3 + duel_check_in_id o texto vira "fulano comentou no seu check-in".
  const { data: checkInRow } = await supabase
    .from("duel_check_ins")
    .select("user_id")
    .eq("id", checkInId)
    .maybeSingle();
  if (checkInRow?.user_id && checkInRow.user_id !== viewer.id) {
    await supabase.from("notifications").insert({
      user_id: checkInRow.user_id,
      follower_id: viewer.id,
      type: 3,
      duel_check_in_id: checkInId,
      read: false,
    });
  }

  invalidateQueryCache("checkInComments");

  return {
    id: data.id,
    checkInId: data.check_in_id,
    userId: data.user_id,
    userNickname: profile?.nickname || "Usuário",
    userPhoto: profile?.photo || null,
    text: data.text,
    createdAt: data.created_at,
  };
}

export async function deleteCheckInCommentDb(commentId: string): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  const { error } = await supabase
    .from("duel_check_in_comments")
    .delete()
    .eq("id", commentId);

  if (error) {
    console.error("Error deleting check-in comment:", error);
    throw error;
  }

  invalidateQueryCache("checkInComments");
}

export async function updateCheckInCommentDb(commentId: string, text: string): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  assertNotEmpty(text, "Comentário");
  assertMaxLength(text.trim(), 500, "Comentário");

  const { error } = await supabase
    .from("duel_check_in_comments")
    .update({ text: text.trim() })
    .eq("id", commentId);

  if (error) {
    console.error("Error updating check-in comment:", error);
    throw error;
  }

  invalidateQueryCache("checkInComments");
}

// ─── Access Sessions ────────────────────────────────────────────────────────

// ============================================================
// Badge / Insígnia Functions
// ============================================================

export type BadgeConditionType =
  | 'checkin_total'         // total acumulado de check-ins
  | 'checkin_week'          // check-ins na semana atual (Dom–Sáb)
  | 'checkin_streak'        // dias consecutivos de check-in
  | 'checkin_after_midnight'// check-in realizado entre 00:00 e 05:59
  | 'checkin_before_time'   // check-in antes de hora X (condition_metadata.hour)
  | 'checkin_comeback'      // primeiro check-in após ≥7 dias sem atividade
  | 'workout_week'          // treinos realizados na semana atual
  | 'workout_type'          // treinos de tipo específico (condition_metadata.type)
  | 'nutrition_hydration'   // meta de hidratação
  | 'nutrition_week'        // semana nutritiva
  | 'nutrition_no_ultra'    // sem ultraprocessados
  | 'nutrition_no_sugar'    // sem açúcar
  | 'nutrition_protein'     // meta de proteína
  | 'nutrition_home_food'   // comida caseira
  | 'nutrition_fruits'      // consumo de frutas
  | 'habit_sleep'           // sono regulado
  | 'habit_no_alcohol'      // sem álcool
  | 'habit_meditation'      // meditação
  | 'habit_steps'           // 10k passos
  | 'habit_perfect_week'    // semana perfeita de hábitos
  | 'habit_perfect_day'     // dia perfeito de hábitos
  | 'habit_perfect_30d'     // 30 dias perfeitos
  | 'app_usage'             // dias de uso do app
  | 'challenge_count';      // desafios completados

export type Badge = {
  id: string;
  key: string;
  name: string;
  emoji: string;
  description: string;
  required_checkins: number;
  sort_order: number;
  condition_type: BadgeConditionType;
  condition_metadata: Record<string, any> | null;
  /** Insígnia exclusiva de assinante premium (seleção gateada no app). */
  premium?: boolean;
};

export type UserBadge = {
  badge_id: string;
  earned_at: string;
  badge: Badge;
};

/** Retorna o total de check-ins acumulados de um usuário (todos os tempos) */
export async function getTotalCheckInsDb(userId: string): Promise<number> {
  if (!hasSupabaseConfig || !supabase) return 0;
  try {
    // Cacheado pelo mesmo motivo de getDisplayBadgeDb (UserInsignias remonta
    // a cada post aberto). Check-ins novos invalidam via createCheckInDb.
    return await cached(`totalCheckIns:${userId}`, CACHE_TTL_SHORT, async () => {
      const { count, error } = await supabase!
        .from("check_ins")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if (error) throw error;
      const total = count ?? 0;
      offlineCopyWrite(`totalCheckIns:${userId}`, total);
      return total;
    });
  } catch (err) {
    console.error("Error fetching total check-ins:", err);
    if (isTransientNetworkError(err)) {
      const off = offlineCopyRead<number>(`totalCheckIns:${userId}`);
      if (off != null) return off;
    }
    return 0;
  }
}

/** Retorna todos os badges do catálogo ordenados por sort_order */
export async function getAllBadgesDb(): Promise<Badge[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  try {
    return await cached("allBadges", CACHE_TTL_LONG, async () => {
      const { data, error } = await supabase!
        .from("badges")
        .select("id, key, name, emoji, description, required_checkins, sort_order, condition_type, condition_metadata, premium")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as Badge[];
      offlineCopyWrite("allBadges", rows);
      return rows;
    });
  } catch (err) {
    console.error("Error fetching badges:", err);
    return offlineCopyRead<Badge[]>("allBadges") ?? [];
  }
}

/** Retorna as insígnias conquistadas por um usuário */
export async function getUserBadgesDb(userId: string): Promise<UserBadge[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  try {
    return await cached(`userBadges:${userId}`, CACHE_TTL_SHORT, async () => {
      const { data, error } = await supabase!
        .from("user_badges")
        .select("badge_id, earned_at, badges(id, key, name, emoji, description, required_checkins, sort_order, condition_type, condition_metadata, premium)")
        .eq("user_id", userId)
        .order("earned_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []).map((row: any) => ({
        badge_id: String(row.badge_id),
        earned_at: String(row.earned_at),
        badge: row.badges as Badge,
      }));
      offlineCopyWrite(`userBadges:${userId}`, rows);
      return rows;
    });
  } catch (err) {
    console.error("Error fetching user badges:", err);
    return offlineCopyRead<UserBadge[]>(`userBadges:${userId}`) ?? [];
  }
}

/**
 * Define manualmente qual insígnia o usuário quer exibir.
 * Valida se o usuário já tem o requisito de check-ins necessário.
 */
// ── Peso corporal (user_weight_logs) ────────────────────────────────────────

export type WeightLog = { id: string; weight: number; logged_at: string };

// Histórico de peso ordenado do mais ANTIGO para o mais recente (pronto para o gráfico).
export async function getWeightLogsDb(limit = 90): Promise<WeightLog[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  const viewer = await getViewer();
  if (!viewer) return [];
  return cached(`weightLogs:${viewer.id}`, CACHE_TTL_OWN, async () => {
    const { data, error } = await supabase!
      .from("user_weight_logs")
      .select("id, weight, logged_at")
      .eq("user_id", viewer.id)
      .order("logged_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data
      .map((r: any) => ({ id: String(r.id), weight: Number(r.weight), logged_at: String(r.logged_at) }))
      .reverse();
  });
}

// Registra (ou atualiza) o peso de um dia. Um registro por dia (upsert por user+data).
// Sincroniza profiles.weight com o valor informado (é o peso "atual" do perfil).
export async function addWeightLogDb(weight: number, loggedAt?: string): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;
  const viewer = await getViewer();
  if (!viewer) throw new Error("Não autenticado");
  const day = loggedAt ?? new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from("user_weight_logs")
    .upsert({ user_id: viewer.id, weight, logged_at: day }, { onConflict: "user_id,logged_at" });
  if (error) throw error;
  await supabase.from("profiles").update({ weight }).eq("user_id", viewer.id);
  invalidateQueryCache(`weightLogs:${viewer.id}`);
  invalidateProfileCache(viewer.id);
}

export async function deleteWeightLogDb(id: string): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;
  const viewer = await getViewer();
  if (!viewer) throw new Error("Não autenticado");
  const { error } = await supabase
    .from("user_weight_logs")
    .delete()
    .eq("id", id)
    .eq("user_id", viewer.id);
  if (error) throw error;
  invalidateQueryCache(`weightLogs:${viewer.id}`);
}

// ─── Diário alimentar (user_food_logs / user_nutrition_goals) ────────────────
// O usuário registra o que comeu no dia, por refeição, com calorias e macros.
// Calorias/macros de cada linha já são o TOTAL consumido (por porção ×
// quantidade), então somar a coluna dá o total do dia. Ver migração
// docs/migrations/20260714-food-diary.sql.

/** 0 = café da manhã, 1 = almoço, 2 = lanche, 3 = jantar */
export type FoodLogMealType = 0 | 1 | 2 | 3;

export type FoodLog = {
  id: string;
  log_date: string; // YYYY-MM-DD
  meal_type: FoodLogMealType;
  diet_id: string | null;
  user_diet_id: string | null;
  name: string;
  quantity: number;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  /** Açúcar consumido (g). `null` = desconhecido — não é o mesmo que zero (ver insígnia sem açúcar). */
  sugar_g: number | null;
};

export type NutritionGoals = {
  calories_target: number | null;
  protein_target_g: number | null;
  carbs_target_g: number | null;
  fat_target_g: number | null;
  water_target_ml: number | null;
};

const FOOD_LOG_COLS =
  "id, log_date, meal_type, diet_id, user_diet_id, name, quantity, calories, protein_g, carbs_g, fat_g, sugar_g";

const mapFoodLogRow = (r: any): FoodLog => ({
  id: String(r.id),
  log_date: String(r.log_date),
  meal_type: (Number(r.meal_type) as FoodLogMealType) ?? 0,
  diet_id: r.diet_id != null ? String(r.diet_id) : null,
  user_diet_id: r.user_diet_id != null ? String(r.user_diet_id) : null,
  name: String(r.name ?? ""),
  quantity: r.quantity != null ? Number(r.quantity) : 1,
  calories: r.calories != null ? Number(r.calories) : null,
  protein_g: r.protein_g != null ? Number(r.protein_g) : null,
  carbs_g: r.carbs_g != null ? Number(r.carbs_g) : null,
  fat_g: r.fat_g != null ? Number(r.fat_g) : null,
  sugar_g: r.sugar_g != null ? Number(r.sugar_g) : null,
});

/** Entradas do diário de um dia (YYYY-MM-DD), na ordem de registro. */
export async function getFoodLogsDb(date: string): Promise<FoodLog[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  const viewer = await getViewer();
  if (!viewer) return [];
  return cached(`foodLogs:${viewer.id}:${date}`, CACHE_TTL_OWN, async () => {
    const { data, error } = await supabase!
      .from("user_food_logs")
      .select(FOOD_LOG_COLS)
      .eq("user_id", viewer.id)
      .eq("log_date", date)
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return data.map(mapFoodLogRow);
  });
}

export type NewFoodLog = {
  log_date: string;
  meal_type: FoodLogMealType;
  name: string;
  quantity?: number;
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  sugar_g?: number | null;
  diet_id?: string | null;
  user_diet_id?: string | null;
};

export async function addFoodLogDb(entry: NewFoodLog): Promise<FoodLog> {
  if (!hasSupabaseConfig || !supabase) throw new Error("Sem conexão com o banco");
  const viewer = await getViewer();
  if (!viewer) throw new Error("Não autenticado");
  const quantity = entry.quantity ?? 1;

  // Item do catálogo sem açúcar informado (ex.: o auto-log da rotina de dieta):
  // busca do catálogo em vez de gravar null. `null` significa DESCONHECIDO e
  // invalidaria o dia para a insígnia "sem açúcar" — não pode acontecer com um
  // alimento cujo valor o catálogo conhece.
  let sugar = entry.sugar_g ?? null;
  if (sugar == null && entry.diet_id != null) {
    const { data: diet } = await supabase
      .from("diets")
      .select("sugar_g")
      .eq("id", Number(entry.diet_id))
      .maybeSingle();
    if (diet?.sugar_g != null) sugar = Number(diet.sugar_g) * quantity;
  }

  const { data, error } = await supabase
    .from("user_food_logs")
    .insert({
      user_id: viewer.id,
      log_date: entry.log_date,
      meal_type: entry.meal_type,
      name: entry.name,
      quantity,
      calories: entry.calories ?? null,
      protein_g: entry.protein_g ?? null,
      carbs_g: entry.carbs_g ?? null,
      fat_g: entry.fat_g ?? null,
      sugar_g: sugar,
      diet_id: entry.diet_id != null ? Number(entry.diet_id) : null,
      user_diet_id: entry.user_diet_id != null ? Number(entry.user_diet_id) : null,
    })
    .select(FOOD_LOG_COLS)
    .single();
  if (error || !data) throw error ?? new Error("Erro ao registrar alimento");
  invalidateQueryCache(`foodLogs:${viewer.id}:`);
  return mapFoodLogRow(data);
}

export async function deleteFoodLogDb(id: string): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;
  const viewer = await getViewer();
  if (!viewer) throw new Error("Não autenticado");
  const { error } = await supabase
    .from("user_food_logs")
    .delete()
    .eq("id", id)
    .eq("user_id", viewer.id);
  if (error) throw error;
  invalidateQueryCache(`foodLogs:${viewer.id}:`);
}

/**
 * Remove a entrada AUTOMÁTICA do diário criada ao concluir um item da rotina
 * de dieta (vinculada por user_diet_id) no dia informado. Usada quando o
 * usuário desmarca o item — o registro manual do mesmo alimento não é tocado.
 */
export async function deleteFoodLogForDietItemDb(userDietId: string, date: string): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;
  const viewer = await getViewer();
  if (!viewer) return;
  const { error } = await supabase
    .from("user_food_logs")
    .delete()
    .eq("user_id", viewer.id)
    .eq("user_diet_id", Number(userDietId))
    .eq("log_date", date);
  if (error) throw error;
  invalidateQueryCache(`foodLogs:${viewer.id}:`);
}

/**
 * Alimentos registrados recentemente (distintos por nome, mais recente
 * primeiro) — alimenta a fileira "Recentes" do diário para repetir uma
 * refeição com 1 toque.
 */
export async function getRecentFoodsDb(limit = 8): Promise<
  Array<Pick<FoodLog, "name" | "calories" | "protein_g" | "carbs_g" | "fat_g" | "sugar_g" | "diet_id">>
> {
  if (!hasSupabaseConfig || !supabase) return [];
  const viewer = await getViewer();
  if (!viewer) return [];
  const { data, error } = await supabase
    .from("user_food_logs")
    .select("name, calories, protein_g, carbs_g, fat_g, sugar_g, diet_id, quantity, created_at")
    .eq("user_id", viewer.id)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error || !data) return [];
  const seen = new Set<string>();
  const out: Array<Pick<FoodLog, "name" | "calories" | "protein_g" | "carbs_g" | "fat_g" | "sugar_g" | "diet_id">> = [];
  for (const r of data as any[]) {
    const key = String(r.name ?? "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const qty = r.quantity != null && Number(r.quantity) > 0 ? Number(r.quantity) : 1;
    // normaliza para valores de 1 porção (a linha guarda o total consumido)
    out.push({
      name: String(r.name),
      calories: r.calories != null ? Number(r.calories) / qty : null,
      protein_g: r.protein_g != null ? Number(r.protein_g) / qty : null,
      carbs_g: r.carbs_g != null ? Number(r.carbs_g) / qty : null,
      fat_g: r.fat_g != null ? Number(r.fat_g) / qty : null,
      sugar_g: r.sugar_g != null ? Number(r.sugar_g) / qty : null,
      diet_id: r.diet_id != null ? String(r.diet_id) : null,
    });
    if (out.length >= limit) break;
  }
  return out;
}

// ─── Água (user_water_logs) ─────────────────────────────────────────────────
// Uma linha por dia com o TOTAL bebido — o app faz upsert do total, não um
// registro por copo. Ver docs/migrations/20260714-water-sugar.sql.

/** Água bebida (ml) num dia (YYYY-MM-DD local). */
export async function getWaterLogDb(date: string): Promise<number> {
  if (!hasSupabaseConfig || !supabase) return 0;
  const viewer = await getViewer();
  if (!viewer) return 0;
  return cached(`waterLog:${viewer.id}:${date}`, CACHE_TTL_OWN, async () => {
    const { data, error } = await supabase!
      .from("user_water_logs")
      .select("ml")
      .eq("user_id", viewer.id)
      .eq("log_date", date)
      .maybeSingle();
    if (error || !data) return 0;
    return Number(data.ml ?? 0);
  });
}

/** Grava o total de água (ml) do dia. Valores negativos viram 0. */
export async function setWaterLogDb(date: string, ml: number): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;
  const viewer = await getViewer();
  if (!viewer) throw new Error("Não autenticado");
  const value = Math.max(0, Math.round(ml));
  const { error } = await supabase
    .from("user_water_logs")
    .upsert(
      { user_id: viewer.id, log_date: date, ml: value, updated_at: new Date().toISOString() },
      { onConflict: "user_id,log_date" }
    );
  if (error) throw error;
  invalidateQueryCache(`waterLog:${viewer.id}:${date}`);
}

/** Total de calorias por dia dos últimos `days` dias (para o gráfico de tendência). */
export async function getFoodLogDayTotalsDb(days = 7): Promise<Array<{ date: string; calories: number }>> {
  if (!hasSupabaseConfig || !supabase) return [];
  const viewer = await getViewer();
  if (!viewer) return [];
  const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("user_food_logs")
    .select("log_date, calories")
    .eq("user_id", viewer.id)
    .gte("log_date", since)
    .order("log_date", { ascending: true });
  if (error || !data) return [];
  const totals = new Map<string, number>();
  for (const r of data as any[]) {
    const d = String(r.log_date);
    totals.set(d, (totals.get(d) ?? 0) + (r.calories != null ? Number(r.calories) : 0));
  }
  return Array.from(totals, ([date, calories]) => ({ date, calories: Math.round(calories) }));
}

export async function getNutritionGoalsDb(): Promise<NutritionGoals | null> {
  if (!hasSupabaseConfig || !supabase) return null;
  const viewer = await getViewer();
  if (!viewer) return null;
  return cached(`nutritionGoals:${viewer.id}`, CACHE_TTL_OWN, async () => {
    const { data, error } = await supabase!
      .from("user_nutrition_goals")
      .select("calories_target, protein_target_g, carbs_target_g, fat_target_g, water_target_ml")
      .eq("user_id", viewer.id)
      .maybeSingle();
    if (error || !data) return null;
    return {
      calories_target: data.calories_target != null ? Number(data.calories_target) : null,
      protein_target_g: data.protein_target_g != null ? Number(data.protein_target_g) : null,
      carbs_target_g: data.carbs_target_g != null ? Number(data.carbs_target_g) : null,
      fat_target_g: data.fat_target_g != null ? Number(data.fat_target_g) : null,
      water_target_ml: data.water_target_ml != null ? Number(data.water_target_ml) : null,
    };
  });
}

export async function upsertNutritionGoalsDb(goals: NutritionGoals): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;
  const viewer = await getViewer();
  if (!viewer) throw new Error("Não autenticado");
  const { error } = await supabase
    .from("user_nutrition_goals")
    .upsert(
      {
        user_id: viewer.id,
        calories_target: goals.calories_target,
        protein_target_g: goals.protein_target_g,
        carbs_target_g: goals.carbs_target_g,
        fat_target_g: goals.fat_target_g,
        water_target_ml: goals.water_target_ml,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error) throw error;
  invalidateQueryCache(`nutritionGoals:${viewer.id}`);
}

/**
 * Uma insígnia está desbloqueada se o usuário a CONQUISTOU (linha em
 * user_badges). Insígnias de `checkin_total` também contam quando o total de
 * check-ins já cobre o requisito, mesmo sem linha: o awarding roda no cliente
 * durante o check-in, então quem acumulou check-ins fora desse caminho (ou
 * antes da migração 20260714) ainda enxerga a insígnia como sua.
 *
 * Para os demais tipos, `required_checkins` é o limiar de OUTRA métrica (dias
 * de streak, treinos na semana…), então comparar com o total de check-ins
 * liberaria insígnias não conquistadas — por isso só o acervo vale.
 */
export function isBadgeUnlocked(
  badge: Badge,
  earnedBadgeIds: Set<string> | string[],
  totalCheckIns: number
): boolean {
  const earned =
    earnedBadgeIds instanceof Set ? earnedBadgeIds : new Set(earnedBadgeIds);
  if (earned.has(String(badge.id))) return true;
  return (
    badge.condition_type === "checkin_total" &&
    totalCheckIns >= (badge.required_checkins ?? 0)
  );
}

/**
 * Define qual insígnia o usuário exibe. A escolha vive em
 * `profiles.selected_badge_id` e PERSISTE: check-ins e novas conquistas nunca a
 * alteram — só uma nova escolha explícita do usuário.
 *
 * Nunca apagar linhas de `user_badges` aqui. Era o que a versão antiga fazia
 * (delete-all + insert da escolhida) e é o que fazia a insígnia "virar sozinha":
 * o acervo era destruído, o check-in seguinte reconquistava tudo e a insígnia
 * de maior sort_order voltava a ser exibida. Ver docs/migrations/20260714-badge-selection-persist.sql.
 */
export async function setSelectedBadgeDb(badgeId: string): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;
  const viewer = await getViewer();
  if (!viewer) throw new Error("Não autenticado");

  try {
    // 1. Validar que a insígnia foi de fato conquistada
    const [badgeRes, earned, totalCheckIns] = await Promise.all([
      supabase
        .from("badges")
        .select("id, key, name, emoji, description, required_checkins, sort_order, condition_type, condition_metadata, premium")
        .eq("id", badgeId)
        .single(),
      getUserBadgesDb(viewer.id),
      getTotalCheckInsDb(viewer.id),
    ]);

    const badge = badgeRes.data as Badge | null;
    if (!badge) throw new Error("Insígnia não encontrada");

    const earnedIds = new Set(earned.map((ub) => String(ub.badge_id)));
    if (!isBadgeUnlocked(badge, earnedIds, totalCheckIns)) {
      // Código, não frase: quem exibe traduz (ver InsigniasDrawer).
      throw new Error("BADGE_NOT_UNLOCKED");
    }

    // Insígnia premium só pode ser exibida por assinante ativo. O gate visual
    // fica no InsigniasDrawer; este é o backstop.
    if (badge.premium && !(await getPremiumStatusDb())) {
      throw new Error("BADGE_PREMIUM_LOCKED");
    }

    // 2. Garantir a linha no acervo (idempotente). Cobre a insígnia de
    // `checkin_total` liberada pelo total mas ainda sem linha.
    if (!earnedIds.has(String(badge.id))) {
      await supabase
        .from("user_badges")
        .upsert(
          { user_id: viewer.id, badge_id: badge.id },
          { onConflict: "user_id,badge_id", ignoreDuplicates: true }
        );
    }

    // 3. Persistir a escolha
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ selected_badge_id: badge.id })
      .eq("user_id", viewer.id);
    if (updateError) throw updateError;
  } catch (err) {
    console.error("Error in setSelectedBadgeDb:", err);
    throw err;
  }

  invalidateQueryCache(`userBadges:${viewer.id}`);
  invalidateQueryCache(`displayBadge:${viewer.id}`);
}

// ─── Helpers para condições de insígnias ─────────────────────────────────────

/**
 * Data em YYYY-MM-DD no fuso LOCAL do dispositivo. `toISOString()` seria UTC e
 * jogaria o jantar das 22h (ou a madrugada) para o dia errado.
 */
function fmtLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Conta check-ins na semana atual (Domingo a Sábado, usando data local). */
async function _getWeekCheckinCountDb(userId: string): Promise<number> {
  if (!supabase) return 0;
  const today = new Date();
  const dow = today.getDay(); // 0=Dom
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - dow);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const { count } = await supabase
    .from("check_ins")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("check_in_date", fmt(sunday))
    .lte("check_in_date", fmt(saturday));
  return count ?? 0;
}

/** Calcula a sequência atual de dias consecutivos de check-in (streak). */
async function _getCheckinStreakDb(userId: string): Promise<number> {
  if (!supabase) return 0;
  // Busca os últimos 100 dias para cobrir streaks longos
  const since = new Date();
  since.setDate(since.getDate() - 100);
  const { data } = await supabase
    .from("check_ins")
    .select("check_in_date")
    .eq("user_id", userId)
    .gte("check_in_date", since.toISOString().slice(0, 10))
    .order("check_in_date", { ascending: false });

  if (!data || data.length === 0) return 0;

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const today = fmt(new Date());
  const yesterday = fmt(new Date(Date.now() - 86400000));
  const mostRecent = data[0].check_in_date;

  // Streak só conta se o check-in mais recente foi hoje ou ontem
  if (mostRecent !== today && mostRecent !== yesterday) return 0;

  const dateSet = new Set(data.map((r: any) => String(r.check_in_date)));
  let streak = 0;
  const cursor = new Date();
  if (mostRecent === yesterday) cursor.setDate(cursor.getDate() - 1);

  while (dateSet.has(fmt(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * Retorna a data do check-in anterior ao mais recente (o penúltimo).
 * Usado para detectar "comeback" (retorno após longa ausência).
 */
async function _getPreviousCheckinDateDb(userId: string): Promise<Date | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from("check_ins")
    .select("check_in_date")
    .eq("user_id", userId)
    .order("check_in_date", { ascending: false })
    .limit(2);
  if (!data || data.length < 2) return null;
  return new Date(data[1].check_in_date + "T12:00:00");
}

/** Conta treinos na semana atual (usando workout_histories). */
async function _getWeekWorkoutCountDb(userId: string): Promise<number> {
  if (!supabase) return 0;
  const today = new Date();
  const dow = today.getDay();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - dow);
  const { count } = await supabase
    .from("workout_histories")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", sunday.toISOString());
  return count ?? 0;
}

/**
 * Horas LOCAIS de todos os check-ins do usuário (a partir de `created_at`).
 * Usado pelas insígnias de horário (madrugador / noturno), que precisam contar
 * QUANTOS check-ins bateram a janela de hora — não só o do momento.
 */
async function _getCheckinHoursDb(userId: string): Promise<number[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("check_ins")
    .select("created_at")
    .eq("user_id", userId)
    .not("created_at", "is", null)
    .limit(2000);
  if (!data) return [];
  return data
    .map((r: any) => new Date(String(r.created_at)).getHours())
    .filter((h) => Number.isFinite(h));
}

/** Conta dias distintos em que o usuário abriu o app (access_sessions). */
async function _getAppUsageDaysDb(userId: string): Promise<number> {
  if (!supabase) return 0;
  const { data } = await supabase
    .from("access_sessions")
    .select("session_date")
    .eq("user_id", userId)
    .limit(2000);
  if (!data) return 0;
  return new Set(data.map((r: any) => String(r.session_date))).size;
}

/** Conta treinos de um tipo específico ('forca' | 'cardio' | …) no total. */
async function _getWorkoutTypeCountDb(userId: string, type: string): Promise<number> {
  if (!supabase) return 0;
  const { count } = await supabase
    .from("workout_histories")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("workout_type", type);
  return count ?? 0;
}

/**
 * Avalia se uma insígnia foi desbloqueada dado o contexto do check-in atual.
 *
 * Regra geral: `required_checkins` é o **limiar da métrica daquele tipo** — nunca
 * o total de check-ins. Para os tipos de horário isso significa "N check-ins
 * DENTRO da janela de hora", e não "1 check-in na janela" nem "N check-ins
 * quaisquer": a insígnia Madrugador (`checkin_before_time`, 9h) exige N check-ins
 * feitos antes das 9h. Um `threshold` de 0/1 degenera naturalmente em "basta um".
 */
async function _evaluateBadgeCondition(
  badge: Badge,
  userId: string,
  checkinAt: Date,
  context: {
    totalCheckIns: number;
    weekCount?: number;
    streak?: number;
    prevCheckinDate?: Date | null;
    weekWorkouts?: number;
    checkinHours?: number[];
  }
): Promise<boolean> {
  const { condition_type, condition_metadata, required_checkins } = badge;
  const threshold = Math.max(1, required_checkins ?? 1);

  switch (condition_type) {
    case "checkin_total":
      return context.totalCheckIns >= threshold;

    case "checkin_week": {
      const weekCount = context.weekCount ?? 0;
      return weekCount >= threshold;
    }

    case "checkin_streak": {
      const streak = context.streak ?? 0;
      return streak >= threshold;
    }

    case "checkin_after_midnight": {
      // Quantos check-ins caíram na madrugada (00:00–05:59) — não só o de agora.
      const hours = context.checkinHours ?? [];
      const nightly = hours.filter((h) => h >= 0 && h < 6).length;
      return nightly >= threshold;
    }

    case "checkin_before_time": {
      // Quantos check-ins foram feitos ANTES da hora limite — não só o de agora.
      const limitHour: number = condition_metadata?.hour ?? 9;
      const hours = context.checkinHours ?? [];
      const early = hours.filter((h) => h < limitHour).length;
      return early >= threshold;
    }

    case "checkin_comeback": {
      const prev = context.prevCheckinDate ?? null;
      if (!prev) return false;
      const daysDiff = Math.floor(
        (checkinAt.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysDiff >= 7;
    }

    case "workout_week": {
      const weekWorkouts = context.weekWorkouts ?? 0;
      return weekWorkouts >= threshold;
    }

    case "workout_type": {
      const wType: string = condition_metadata?.type ?? "";
      if (!wType) return false;
      const typeCount = await _getWorkoutTypeCountDb(userId, wType);
      return typeCount >= threshold;
    }

    case "app_usage": {
      const days = await _getAppUsageDaysDb(userId);
      return days >= threshold;
    }

    // Sem tracking dedicado ainda: nutrition_* (hidratação, sem açúcar, proteína…),
    // habit_* (sono, meditação, passos…) e challenge_count. Não há como verificar a
    // condição, então NUNCA são concedidas — jamais liberar por contagem de check-ins,
    // que foi exatamente o bug de 14/07/2026 (Madrugador saía sem treino de manhã).
    default:
      return false;
  }
}

/**
 * Avalia as condições de cada insígnia no momento de um check-in,
 * concede as que foram desbloqueadas e retorna as recém-ganhas (para exibir popup).
 *
 * @param userId - ID do usuário
 * @param checkinAt - Timestamp do check-in (default: agora)
 */
export async function awardBadgesForCheckInsDb(
  userId: string,
  checkinAt: Date = new Date()
): Promise<Badge[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  // Avaliar insígnias exige o estado REAL do servidor (check-ins totais, streak,
  // badges já conquistadas). Offline, as cópias locais responderiam e a lista de
  // "já conquistadas" viria vazia — celebrando de novo badges antigas sem
  // persistir nada. Sem rede, a avaliação fica para o replay do check-in.
  if (isLikelyOffline()) return [];
  try {
    // Buscar dados em paralelo para minimizar latência
    const [totalCheckIns, allBadges, existingRows, weekCount, streak, prevCheckinDate, weekWorkouts, checkinHours, isPremium] =
      await Promise.all([
        getTotalCheckInsDb(userId),
        getAllBadgesDb(),
        supabase.from("user_badges").select("badge_id").eq("user_id", userId),
        _getWeekCheckinCountDb(userId),
        _getCheckinStreakDb(userId),
        _getPreviousCheckinDateDb(userId),
        _getWeekWorkoutCountDb(userId),
        _getCheckinHoursDb(userId),
        getPremiumStatusDb(),
      ]);

    // Falha ao ler as badges existentes (ex.: rede caiu no meio) → aborta em
    // vez de tratar como "nenhuma conquistada" e premiar duplicado.
    if (existingRows.error) throw existingRows.error;

    const alreadyEarnedIds = new Set(
      ((existingRows.data ?? []) as any[]).map((r) => String(r.badge_id))
    );

    // Badges que o usuário ainda não tem e cujo condition_type é elegível neste check-in
    const CHECKIN_CONDITIONS: BadgeConditionType[] = [
      "checkin_total",
      "checkin_week",
      "checkin_streak",
      "checkin_after_midnight",
      "checkin_before_time",
      "checkin_comeback",
      "workout_week",
      "workout_type",
      "app_usage",
    ];

    const candidates = allBadges.filter(
      (b) =>
        !alreadyEarnedIds.has(String(b.id)) &&
        CHECKIN_CONDITIONS.includes(b.condition_type) &&
        // Insígnia premium só é concedida a assinante ativo (is_premium → tabela
        // subscriptions). As 2 premium são checkin_total com required_checkins=0,
        // então SEM este gate qualquer check-in as liberava para todo mundo.
        !(b.premium && !isPremium)
    );

    const context = { totalCheckIns, weekCount, streak, prevCheckinDate, weekWorkouts, checkinHours };

    const newBadges: Badge[] = [];
    for (const badge of candidates) {
      const earned = await _evaluateBadgeCondition(badge, userId, checkinAt, context);
      if (earned) newBadges.push(badge);
    }

    if (newBadges.length > 0) {
      const { error: upsertError } = await supabase
        .from("user_badges")
        .upsert(
          newBadges.map((b) => ({ user_id: userId, badge_id: b.id })),
          { onConflict: "user_id,badge_id", ignoreDuplicates: true }
        );
      // Não celebrou se não persistiu (ex.: rede caiu entre a avaliação e o upsert)
      if (upsertError) throw upsertError;
      invalidateQueryCache(`userBadges:${userId}`);
      invalidateQueryCache("allBadges");
    }

    return newBadges;
  } catch (err) {
    console.error("Error in awardBadgesForCheckInsDb:", err);
    return [];
  }
}

/**
 * Concede as insígnias de NUTRIÇÃO avaliáveis a partir do diário alimentar
 * (`user_food_logs`). Chamada após registrar um alimento.
 *
 * Só os tipos que o diário consegue PROVAR são avaliados:
 *   • nutrition_no_ultra → N dias seguidos sem ultraprocessado
 *   • nutrition_protein  → N dias seguidos batendo a meta de proteína
 *   • nutrition_week     → N dias com registro na semana atual (Dom–Sáb)
 *   • nutrition_no_sugar → N dias seguidos com açúcar ≤ limite (metadata.max_sugar_g)
 *   • nutrition_hydration→ N dias seguidos batendo a meta de água
 *
 * `nutrition_fruits` e `nutrition_home_food` continuam sem tracking — o diário
 * não classifica fruta nem "comida caseira" — e por isso NUNCA são concedidas.
 * Não inventar heurística por nome do alimento: liberar sem provar a condição é
 * o bug que estamos consertando.
 *
 * **Desconhecido nunca conta como zero.** Qualidade e açúcar vêm do catálogo
 * (`diets.food_quality` / `sugar_g`) — entradas manuais sem esse dado tornam o
 * dia inválido para `nutrition_no_ultra` / `nutrition_no_sugar`. Não dá para
 * provar que não houve ultraprocessado (ou açúcar), e aceitar o desconhecido
 * entregaria a insígnia a quem registra tudo na mão.
 */
export async function awardNutritionBadgesDb(userId?: string): Promise<Badge[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  if (isLikelyOffline()) return [];
  const uid = userId ?? (await getViewer())?.id;
  if (!uid) return [];

  try {
    const since = new Date();
    since.setDate(since.getDate() - 60);
    const sinceISO = fmtLocalDate(since);

    const [logsRes, waterRes, allBadges, existingRows, goals, isPremium] = await Promise.all([
      supabase
        .from("user_food_logs")
        .select("log_date, protein_g, sugar_g, diet_id, diets(food_quality)")
        .eq("user_id", uid)
        .gte("log_date", sinceISO),
      supabase
        .from("user_water_logs")
        .select("log_date, ml")
        .eq("user_id", uid)
        .gte("log_date", sinceISO),
      getAllBadgesDb(),
      supabase.from("user_badges").select("badge_id").eq("user_id", uid),
      getNutritionGoalsDb(),
      getPremiumStatusDb(),
    ]);
    if (logsRes.error) throw logsRes.error;
    if (existingRows.error) throw existingRows.error;

    // Agrega por dia local
    type Day = {
      protein: number;
      sugar: number;
      hasUnknownQuality: boolean;
      hasUnknownSugar: boolean;
      hasUltra: boolean;
    };
    const newDay = (): Day => ({
      protein: 0,
      sugar: 0,
      hasUnknownQuality: false,
      hasUnknownSugar: false,
      hasUltra: false,
    });
    const days = new Map<string, Day>();
    for (const row of (logsRes.data ?? []) as any[]) {
      const date = String(row.log_date);
      const day = days.get(date) ?? newDay();
      day.protein += Number(row.protein_g ?? 0);
      if (row.sugar_g == null) day.hasUnknownSugar = true;
      else day.sugar += Number(row.sugar_g);
      const quality = (row.diets as any)?.food_quality ?? null;
      if (!quality) day.hasUnknownQuality = true;
      else if (quality === "ultraprocessado") day.hasUltra = true;
      days.set(date, day);
    }

    const water = new Map<string, number>();
    for (const row of (waterRes.data ?? []) as any[]) {
      water.set(String(row.log_date), Number(row.ml ?? 0));
    }

    /** Dias consecutivos que satisfazem `ok`, contados de hoje (ou ontem) para trás. */
    const streakOf = (ok: (date: string) => boolean): number => {
      const cursor = new Date();
      // Ainda não bateu a condição hoje → a sequência vale até ontem (o dia não acabou).
      if (!ok(fmtLocalDate(cursor))) cursor.setDate(cursor.getDate() - 1);
      let streak = 0;
      while (ok(fmtLocalDate(cursor))) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      }
      return streak;
    };

    /** Dia com comida registrada que satisfaz `ok` — sem registro não prova nada. */
    const onDay = (ok: (d: Day) => boolean) => (date: string) => {
      const day = days.get(date);
      return day != null && ok(day);
    };

    const noUltraStreak = streakOf(onDay((d) => !d.hasUnknownQuality && !d.hasUltra));

    const proteinTarget = goals?.protein_target_g ?? 0;
    const proteinStreak =
      proteinTarget > 0 ? streakOf(onDay((d) => d.protein >= proteinTarget)) : 0;

    // Açúcar: sem o dado (catálogo sem sugar_g / entrada manual em branco) o dia
    // não conta — desconhecido não é zero.
    const sugarStreakFor = (maxSugar: number) =>
      streakOf(onDay((d) => !d.hasUnknownSugar && d.sugar <= maxSugar));

    // Água: meta do usuário quando definida; senão a da própria insígnia.
    const waterStreakFor = (targetMl: number) =>
      targetMl > 0 ? streakOf((date) => (water.get(date) ?? 0) >= targetMl) : 0;

    // Dias com registro na semana atual (Dom–Sáb)
    const now = new Date();
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - now.getDay());
    let weekDays = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      if (days.has(fmtLocalDate(d))) weekDays++;
    }

    const alreadyEarned = new Set(
      ((existingRows.data ?? []) as any[]).map((r) => String(r.badge_id))
    );

    const newBadges = allBadges.filter((b) => {
      if (alreadyEarned.has(String(b.id))) return false;
      // Premium só para assinante ativo (mesmo gate do award de check-in).
      if (b.premium && !isPremium) return false;
      const threshold = Math.max(1, b.required_checkins ?? 1);
      switch (b.condition_type) {
        case "nutrition_no_ultra":
          return noUltraStreak >= threshold;
        case "nutrition_protein":
          return proteinStreak >= threshold;
        case "nutrition_week":
          return weekDays >= threshold;
        case "nutrition_no_sugar": {
          const maxSugar = Number(b.condition_metadata?.max_sugar_g ?? 25);
          return sugarStreakFor(maxSugar) >= threshold;
        }
        case "nutrition_hydration": {
          const targetMl = Number(
            goals?.water_target_ml ?? b.condition_metadata?.ml ?? 2000
          );
          return waterStreakFor(targetMl) >= threshold;
        }
        default:
          return false; // frutas e comida caseira: sem tracking
      }
    });

    if (newBadges.length > 0) {
      const { error: upsertError } = await supabase
        .from("user_badges")
        .upsert(
          newBadges.map((b) => ({ user_id: uid, badge_id: b.id })),
          { onConflict: "user_id,badge_id", ignoreDuplicates: true }
        );
      if (upsertError) throw upsertError; // não celebrar o que não persistiu
      invalidateQueryCache(`userBadges:${uid}`);
      invalidateQueryCache(`displayBadge:${uid}`);
    }

    return newBadges;
  } catch (err) {
    console.error("Error in awardNutritionBadgesDb:", err);
    return [];
  }
}

/**
 * Retorna a insígnia que o usuário exibe no feed e no perfil.
 *
 * Regra: a insígnia ESCOLHIDA (`profiles.selected_badge_id`) sempre vence,
 * desde que ainda esteja no acervo. Conquistar novas insígnias não muda a
 * exibida — só uma escolha explícita muda. O fallback para a de maior
 * sort_order vale só para quem nunca escolheu nenhuma (o comportamento
 * automático de sempre, até a primeira escolha).
 *
 * Nota: o Supabase JS v2 não suporta order por coluna de tabela relacionada,
 * então buscamos todos e filtramos no cliente.
 */
export async function getDisplayBadgeDb(userId: string): Promise<Badge | null> {
  if (!hasSupabaseConfig || !supabase) return null;
  try {
    // Cacheado: UserInsignias monta no header do perfil E a cada post aberto
    // no drawer — sem cache eram 2 queries extras por post visualizado.
    return await cached(`displayBadge:${userId}`, CACHE_TTL_SHORT, async () => {
      const [earnedRes, profileRes] = await Promise.all([
        supabase!
          .from("user_badges")
          .select("badges(id, key, name, emoji, description, required_checkins, sort_order, condition_type, condition_metadata, premium)")
          .eq("user_id", userId),
        supabase!
          .from("profiles")
          .select("selected_badge_id")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);
      if (earnedRes.error) throw earnedRes.error;

      const earned = ((earnedRes.data ?? []) as any[])
        .map((row) => row.badges as Badge)
        .filter(Boolean);
      if (earned.length === 0) return null;

      const selectedId = profileRes.data?.selected_badge_id
        ? String(profileRes.data.selected_badge_id)
        : null;
      if (selectedId) {
        const chosen = earned.find((b) => String(b.id) === selectedId);
        if (chosen) return chosen;
      }

      // Nunca escolheu (ou a escolhida saiu do acervo): maior sort_order.
      return earned.reduce((best, b) =>
        (b?.sort_order ?? 0) > (best?.sort_order ?? 0) ? b : best
      );
    });
  } catch (err) {
    console.error("Error fetching display badge:", err);
    return null;
  }
}

// ─── Promoções (Hub de Promoções) ─────────────────────────────────────────────

export type Promotion = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  original_price: number | null;
  promo_price: number | null;
  discount_percent: number | null;
  photo_url: string | null;
  external_link: string | null;
  coupon_code: string | null;
  expires_at: string | null;
  created_at: string;
  // joined from profiles
  user_nickname?: string;
  user_handle?: string;
  user_photo?: string;
  // stats
  likes_count?: number;
  user_liked?: boolean;
  // status reports
  active_reports?: number;
  expired_reports?: number;
  user_status_vote?: "active" | "expired" | null;
  // comments
  comments_count?: number;
};

export type PromotionCategory =
  | "equipamento"
  | "suplemento"
  | "alimento"
  | "vestuario"
  | "servico"
  | "outro";

export const PROMOTION_CATEGORIES: { value: PromotionCategory; label: string }[] = [
  { value: "equipamento", label: "Equipamento" },
  { value: "suplemento", label: "Suplemento" },
  { value: "alimento", label: "Alimento" },
  { value: "vestuario", label: "Vestuário" },
  { value: "servico", label: "Serviço" },
  { value: "outro", label: "Outro" },
];

export async function getPromotionsDb(
  category?: PromotionCategory | "todos",
): Promise<Promotion[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const viewer = await getViewer();

  const cacheKey = `promotions:${category ?? "todos"}`;
  return cached(cacheKey, CACHE_TTL_MEDIUM, async () => {
    let query = supabase!
      .from("promotions")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(100);

    if (category && category !== "todos") {
      query = query.eq("category", category);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching promotions:", error);
      return [];
    }

    const rows: Promotion[] = data ?? [];

    if (rows.length === 0) return [];

    // Enrich with profile data
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const { data: profiles } = await supabase!
      .from("profiles")
      .select("user_id, nickname, handle, photo")
      .in("user_id", userIds);

    const profileMap = new Map(
      (profiles ?? []).map((p: any) => [String(p.user_id), p]),
    );

    // Fetch likes for viewer
    let likedSet = new Set<string>();
    if (viewer) {
      const { data: likedRows } = await supabase!
        .from("promotion_likes")
        .select("promotion_id")
        .eq("user_id", viewer.id)
        .in(
          "promotion_id",
          rows.map((r) => r.id),
        );
      likedSet = new Set((likedRows ?? []).map((l: any) => String(l.promotion_id)));
    }

    // Fetch likes counts
    const { data: likeCounts } = await supabase!
      .from("promotion_likes")
      .select("promotion_id")
      .in(
        "promotion_id",
        rows.map((r) => r.id),
      );

    const countMap = new Map<string, number>();
    for (const l of likeCounts ?? []) {
      const pid = String(l.promotion_id);
      countMap.set(pid, (countMap.get(pid) ?? 0) + 1);
    }

    // Fetch status reports counts
    const { data: statusReports } = await supabase!
      .from("promotion_status_reports")
      .select("promotion_id, status")
      .in("promotion_id", rows.map((r) => r.id));

    const activeReportsMap = new Map<string, number>();
    const expiredReportsMap = new Map<string, number>();
    for (const r of statusReports ?? []) {
      const pid = String(r.promotion_id);
      if (r.status === "active") activeReportsMap.set(pid, (activeReportsMap.get(pid) ?? 0) + 1);
      else if (r.status === "expired") expiredReportsMap.set(pid, (expiredReportsMap.get(pid) ?? 0) + 1);
    }

    // Viewer's own votes
    let userVoteMap = new Map<string, "active" | "expired">();
    if (viewer) {
      const { data: myVotes } = await supabase!
        .from("promotion_status_reports")
        .select("promotion_id, status")
        .eq("user_id", viewer.id)
        .in("promotion_id", rows.map((r) => r.id));
      for (const v of myVotes ?? []) {
        userVoteMap.set(String(v.promotion_id), v.status as "active" | "expired");
      }
    }

    // Fetch comments counts
    const { data: commentCountRows } = await supabase!
      .from("promotion_comments")
      .select("promotion_id")
      .in("promotion_id", rows.map((r) => r.id));

    const commentCountMap = new Map<string, number>();
    for (const c of commentCountRows ?? []) {
      const pid = String(c.promotion_id);
      commentCountMap.set(pid, (commentCountMap.get(pid) ?? 0) + 1);
    }

    return rows.map((r) => {
      const profile = profileMap.get(String(r.user_id));
      return {
        ...r,
        user_nickname: profile?.nickname ?? "Usuário",
        user_handle: profile?.handle ?? "",
        user_photo: profile?.photo ?? null,
        likes_count: countMap.get(r.id) ?? 0,
        user_liked: likedSet.has(r.id),
        active_reports: activeReportsMap.get(r.id) ?? 0,
        expired_reports: expiredReportsMap.get(r.id) ?? 0,
        user_status_vote: userVoteMap.get(r.id) ?? null,
        comments_count: commentCountMap.get(r.id) ?? 0,
      };
    });
  });
}

export async function createPromotionDb(payload: {
  title: string;
  description?: string;
  category: PromotionCategory;
  original_price?: number;
  promo_price?: number;
  discount_percent?: number;
  photo_url?: string;
  external_link?: string;
  coupon_code?: string;
  expires_at?: string;
}): Promise<Promotion | null> {
  if (!hasSupabaseConfig || !supabase) return null;

  assertNotEmpty(payload.title, "Título");
  assertMaxLength(payload.title, 120, "Título");

  const viewer = await getViewer();
  if (!viewer) return null;

  const { data, error } = await supabase
    .from("promotions")
    .insert({
      user_id: viewer.id,
      title: payload.title.trim(),
      description: payload.description?.trim() ?? null,
      category: payload.category,
      original_price: payload.original_price ?? null,
      promo_price: payload.promo_price ?? null,
      discount_percent: payload.discount_percent ?? null,
      photo_url: payload.photo_url ?? null,
      external_link: payload.external_link?.trim() ?? null,
      coupon_code: payload.coupon_code?.trim().toUpperCase() ?? null,
      expires_at: payload.expires_at ?? null,
      is_active: true,
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error("Error creating promotion:", error);
    throw error;
  }

  invalidateQueryCache("promotions");
  return data as Promotion;
}

export async function deletePromotionDb(promotionId: string): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;
  assertUUID(promotionId, "promotionId");

  const viewer = await getViewer();
  if (!viewer) return;

  const { error } = await supabase
    .from("promotions")
    .update({ is_active: false })
    .eq("id", promotionId)
    .eq("user_id", viewer.id);

  if (error) throw error;
  invalidateQueryCache("promotions");
}

export async function updatePromotionDb(
  promotionId: string,
  payload: {
    description?: string;
    coupon_code?: string;
    is_active?: boolean;
    title?: string;
    original_price?: number | null;
    promo_price?: number | null;
    expires_at?: string | null;
    category?: string;
    photo_url?: string | null;
  },
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;
  assertUUID(promotionId, "promotionId");

  const viewer = await getViewer();
  if (!viewer) return;

  const updateData: any = {};
  if (payload.description !== undefined) updateData.description = payload.description.trim() || null;
  if (payload.coupon_code !== undefined) updateData.coupon_code = payload.coupon_code.trim().toUpperCase() || null;
  if (payload.is_active !== undefined) updateData.is_active = payload.is_active;
  if (payload.title !== undefined) updateData.title = payload.title.trim() || null;
  if (payload.original_price !== undefined) updateData.original_price = payload.original_price;
  if (payload.promo_price !== undefined) updateData.promo_price = payload.promo_price;
  if (payload.expires_at !== undefined) updateData.expires_at = payload.expires_at || null;
  if (payload.category !== undefined) updateData.category = payload.category;
  if (payload.photo_url !== undefined) updateData.photo_url = payload.photo_url || null;

  const { error } = await supabase
    .from("promotions")
    .update(updateData)
    .eq("id", promotionId)
    .eq("user_id", viewer.id);

  if (error) {
    console.error("Error updating promotion:", error);
    throw error;
  }

  invalidateQueryCache("promotions");
}

export async function togglePromotionLikeDb(promotionId: string): Promise<"liked" | "unliked"> {
  if (!hasSupabaseConfig || !supabase) throw new Error("No Supabase config");
  assertUUID(promotionId, "promotionId");

  const viewer = await getViewer();
  if (!viewer) throw new Error("Não autenticado");

  const { data: existing } = await supabase
    .from("promotion_likes")
    .select("id")
    .eq("promotion_id", promotionId)
    .eq("user_id", viewer.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("promotion_likes")
      .delete()
      .eq("promotion_id", promotionId)
      .eq("user_id", viewer.id);
    invalidateQueryCache("promotions");
    return "unliked";
  } else {
    await supabase
      .from("promotion_likes")
      .insert({ promotion_id: promotionId, user_id: viewer.id });
    invalidateQueryCache("promotions");

    // Notifica o dono da promoção (fire-and-forget — não bloqueia o toque no coração)
    sendPromotionLikeNotificationDb(promotionId).catch((err) =>
      console.error("Error sending promotion like notification:", err),
    );

    return "liked";
  }
}

/**
 * Notificação de curtida em promoção (tipo 12) — o id da promoção vai em `post_id`,
 * mesma convenção do comentário em promoção (tipo 8). Deduplicada por
 * (dono, curtidor, promoção): descurtir e curtir de novo não gera novo push.
 */
async function sendPromotionLikeNotificationDb(promotionId: string): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  const viewer = await getViewer();
  if (!viewer) return;

  const { data: promo } = await supabase
    .from("promotions")
    .select("user_id")
    .eq("id", promotionId)
    .maybeSingle();

  const ownerId = promo?.user_id ? String(promo.user_id) : null;
  if (!ownerId || ownerId === viewer.id) return;

  const { data: existing } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", ownerId)
    .eq("follower_id", viewer.id)
    .eq("type", 12)
    .eq("post_id", promotionId)
    .maybeSingle();

  if (existing) return;

  const { error } = await supabase.from("notifications").insert({
    user_id: ownerId,
    follower_id: viewer.id,
    type: 12,
    post_id: promotionId,
    read: false,
  });

  if (error) {
    console.error("Error inserting promotion like notification:", error);
    return;
  }

  invalidateQueryCache("notifications");
  invalidateQueryCache("unreadNotifCount");
}

// Mesmo limiar que a Vitrine usa para riscar a promoção como expirada (`majorityExpired` em Store.tsx)
const isMajorityExpired = (total: number, expired: number) => total >= 3 && expired / total > 0.5;

/**
 * Notificação de promoção expirada (tipo 13).
 *
 * Disparada apenas no voto que faz a promoção **cruzar** o limiar de expirada (≥ 3
 * votos de status e maioria em "expired"): as contagens de antes são reconstruídas
 * a partir do voto que acabou de ser gravado, então os votos seguintes não geram
 * um novo push. Só o autor é avisado, e `follower_id` guarda quem deu o voto que
 * fechou a maioria — é o nome que aparece no card e no push ("{name} marcou sua
 * promoção como expirada").
 */
async function sendPromotionExpiredNotificationDb(
  promotionId: string,
  prevStatus: "active" | "expired" | null,
  newStatus: "active" | "expired" | null,
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  const [{ data: reports }, { data: promo }] = await Promise.all([
    supabase.from("promotion_status_reports").select("status").eq("promotion_id", promotionId),
    supabase.from("promotions").select("user_id").eq("id", promotionId).maybeSingle(),
  ]);

  const total = (reports ?? []).length;
  const expired = (reports ?? []).filter((r: any) => r.status === "expired").length;

  // Estado anterior ao voto recém-gravado, desfazendo o delta deste usuário
  const prevTotal = total - (newStatus ? 1 : 0) + (prevStatus ? 1 : 0);
  const prevExpired =
    expired - (newStatus === "expired" ? 1 : 0) + (prevStatus === "expired" ? 1 : 0);

  if (!isMajorityExpired(total, expired)) return;
  if (isMajorityExpired(prevTotal, prevExpired)) return; // já estava expirada — não avisa de novo

  const viewer = await getViewer();
  const ownerId = promo?.user_id ? String(promo.user_id) : null;
  if (!ownerId || !viewer || viewer.id === ownerId) return;

  const { data: existing } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", ownerId)
    .eq("type", 13)
    .eq("post_id", promotionId)
    .maybeSingle();

  if (existing) return;

  const { error } = await supabase.from("notifications").insert({
    user_id: ownerId,
    follower_id: viewer.id, // quem deu o voto que fechou a maioria
    type: 13,
    post_id: promotionId,
    read: false,
  });

  if (error) {
    console.error("Error inserting promotion expired notification:", error);
    return;
  }

  invalidateQueryCache("notifications");
  invalidateQueryCache("unreadNotifCount");
}

export async function reportPromotionStatusDb(
  promotionId: string,
  status: "active" | "expired",
): Promise<"voted" | "removed"> {
  if (!hasSupabaseConfig || !supabase) throw new Error("No Supabase config");
  assertUUID(promotionId, "promotionId");

  const viewer = await getViewer();
  if (!viewer) throw new Error("Não autenticado");

  const { data: existing } = await supabase
    .from("promotion_status_reports")
    .select("id, status")
    .eq("promotion_id", promotionId)
    .eq("user_id", viewer.id)
    .maybeSingle();

  const prevStatus = (existing?.status as "active" | "expired" | undefined) ?? null;

  // Avisa o dono se este voto acabou de marcar a promoção como expirada (fire-and-forget)
  const notifyIfExpired = (newStatus: "active" | "expired" | null) =>
    sendPromotionExpiredNotificationDb(promotionId, prevStatus, newStatus).catch((err) =>
      console.error("Error sending promotion expired notification:", err),
    );

  if (existing) {
    if (existing.status === status) {
      // Toggle off — remove vote
      await supabase
        .from("promotion_status_reports")
        .delete()
        .eq("promotion_id", promotionId)
        .eq("user_id", viewer.id);
      invalidateQueryCache("promotions");
      notifyIfExpired(null);
      return "removed";
    } else {
      // Change vote
      await supabase
        .from("promotion_status_reports")
        .update({ status })
        .eq("promotion_id", promotionId)
        .eq("user_id", viewer.id);
      invalidateQueryCache("promotions");
      notifyIfExpired(status);
      return "voted";
    }
  } else {
    await supabase
      .from("promotion_status_reports")
      .insert({ promotion_id: promotionId, user_id: viewer.id, status });
    invalidateQueryCache("promotions");
    notifyIfExpired(status);
    return "voted";
  }
}

// ─── Promotion Comments ───────────────────────────────────────────────────────

export type PromotionComment = {
  id: string;
  promotionId: string;
  userId: string;
  userName: string;
  userHandle: string;
  userPhoto: string | null;
  text: string;
  createdAt: string;
};

export async function getPromotionCommentsDb(
  promotionId: string,
): Promise<PromotionComment[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  return cached(`promotionComments:${promotionId}`, CACHE_TTL_SHORT, async () => {
    const { data, error } = await supabase
      .from("promotion_comments")
      .select("id, promotion_id, user_id, text, created_at")
      .eq("promotion_id", promotionId)
      .order("created_at", { ascending: true })
      .limit(500);

    if (error) {
      console.error("Error fetching promotion comments:", error);
      return [];
    }

    const rows = data ?? [];
    if (rows.length === 0) return [];

    const userIds = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nickname, handle, photo")
      .in("user_id", userIds);

    const profileMap = new Map(
      (profiles ?? []).map((p: any) => [
        String(p.user_id),
        { nickname: String(p.nickname ?? "Usuário"), handle: String(p.handle ?? ""), photo: p.photo ?? null},
      ]),
    );

    return rows.map((row: any) => {
      const profile = profileMap.get(String(row.user_id));
      return {
        id: String(row.id),
        promotionId: String(row.promotion_id),
        userId: String(row.user_id),
        userName: profile?.nickname ?? "Usuário",
        userHandle: profile?.handle ?? "",
        userPhoto: profile?.photo ?? null,
        text: String(row.text ?? ""),
        createdAt: String(row.created_at ?? new Date().toISOString()),
      } satisfies PromotionComment;
    });
  });
}

export async function addPromotionCommentDb(promotionId: string, text: string) {
  if (!hasSupabaseConfig || !supabase) return;

  assertUUID(promotionId, "ID da promoção");
  assertNotEmpty(text, "Comentário");
  assertMaxLength(text.trim(), 500, "Comentário");

  const viewer = await getViewer();
  if (!viewer) return;

  const { error } = await supabase.from("promotion_comments").insert({
    promotion_id: promotionId,
    user_id: viewer.id,
    text: text.trim(),
  });

  if (error) {
    console.error("Error adding promotion comment:", error);
    throw error;
  }

  invalidateQueryCache("promotionComments");
  invalidateQueryCache("promotions");

  // Notify the promotion owner (fire-and-forget — don't block the UI)
  const { data: promo } = await supabase
    .from("promotions")
    .select("user_id")
    .eq("id", promotionId)
    .maybeSingle();

  if (promo?.user_id) {
    sendPromotionCommentNotificationDb(promotionId, promo.user_id).catch((err) =>
      console.error("Error sending promotion comment notification:", err),
    );
  }
}

export async function deletePromotionCommentDb(commentId: string) {
  if (!hasSupabaseConfig || !supabase) return;

  const { error } = await supabase
    .from("promotion_comments")
    .delete()
    .eq("id", commentId);

  if (error) {
    console.error("Error deleting promotion comment:", error);
    throw error;
  }

  invalidateQueryCache("promotionComments");
  invalidateQueryCache("promotions");
}

export async function updatePromotionCommentDb(commentId: string, text: string) {
  if (!hasSupabaseConfig || !supabase) return;

  assertNotEmpty(text, "Comentário");
  assertMaxLength(text.trim(), 500, "Comentário");

  const { error } = await supabase
    .from("promotion_comments")
    .update({ text: text.trim() })
    .eq("id", commentId);

  if (error) {
    console.error("Error updating promotion comment:", error);
    throw error;
  }

  invalidateQueryCache("promotionComments");
}

export async function sendPromotionCommentNotificationDb(
  promotionId: string,
  promotionOwnerId: string,
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;

  const viewer = await getViewer();
  if (!viewer) return;
  // Don't notify the owner when they comment on their own promotion
  if (viewer.id === promotionOwnerId) return;

  // Avoid duplicate notifications: one per commenter per promotion
  const { data: existing } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", promotionOwnerId)
    .eq("follower_id", viewer.id)
    .eq("type", 8)
    .eq("post_id", promotionId)
    .maybeSingle();

  if (existing) return;

  const { error } = await supabase.from("notifications").insert({
    user_id: promotionOwnerId,
    follower_id: viewer.id,
    type: 8,
    post_id: promotionId, // reuse post_id column to store promotion_id
    read: false,
  });

  if (error) {
    console.error("Error sending promotion comment notification:", error);
  }

  invalidateQueryCache("notifications");
  invalidateQueryCache("unreadNotifCount");
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export const ADMIN_USER_ID = "c954d5ab-9d72-4785-bc21-bf469a5e8052";

export type AdminComplaint = {
  tipo: "post" | "shot" | "flow" | "usuario";
  id: string;
  denunciante_id: string;
  conteudo_id: string;
  autor_id: string | null;
  reason: string | null;
  created_at: string;
};

export type AdminStats = {
  totalUsers: number;
  postsHoje: number;
  shotsHoje: number;
  complaintsTotal: number;
};

export type AdminTopScreen = {
  screen: string;
  total_seconds: number;
  acessos: number;
  usuarios_unicos: number;
};

export type AdminDayCount = {
  dia?: string;
  session_date?: string;
  total?: number;
  usuarios_ativos?: number;
};

export type AdminTopFollowed = {
  user_id: string;
  nickname: string;
  handle: string;
  photo: string | null;
  followers: number;
};

export type AdminAnalytics = {
  // Usuários
  usuarios_hoje: number;
  usuarios_semana: number;
  usuarios_mes: number;
  total_usuarios: number;
  usuarios_banidos: number;
  // Sessões
  dau_hoje: number;
  dau_ontem: number;
  wau: number;
  mau: number;
  stickiness: number; // %
  novos_ativos_hoje: number;
  recorrentes_hoje: number;
  total_sessoes_hoje: number;
  avg_sessao_segundos_7d: number;
  total_horas_hoje: number;
  // Retenção (%)
  retencao_d1: number;
  retencao_d7: number;
  // Conteúdo hoje
  posts_hoje: number;
  shots_hoje: number;
  comments_hoje: number;
  likes_hoje: number;
  check_ins_hoje: number;
  // Totais
  total_posts: number;
  total_shots: number;
  total_check_ins: number;
  // Séries / rankings
  top_screens: AdminTopScreen[];
  top_seguidos: AdminTopFollowed[];
  novos_usuarios_7d: AdminDayCount[];
  dau_7d: AdminDayCount[];
};

export async function getAdminAnalyticsDb(): Promise<AdminAnalytics | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_admin_analytics");
  if (error) throw new Error(error.message);
  return data as AdminAnalytics;
}

export type AdminActiveUser = {
  user_id: string;
  nickname: string;
  handle: string;
  photo: string | null;
  total_seconds: number;
};

export async function getAdminActiveUsersDb(): Promise<AdminActiveUser[]> {
  if (!supabase) return [];
  // Usa access_sessions (mesma fonte do DAU em get_admin_analytics) para garantir
  // que o ranking sempre bate com o card "Usuários ativos hoje". screen_time_logs
  // só registra tempo por tela e pode não ter linha para um usuário que abriu o
  // app sem navegar — daí divergência entre as duas métricas.
  const { data: logs, error } = await supabase
    .from("access_sessions")
    .select("user_id, duration_seconds")
    .eq("session_date", new Date().toISOString().slice(0, 10));
  if (error || !logs?.length) return [];

  const map = new Map<string, number>();
  for (const row of logs) {
    map.set(row.user_id, (map.get(row.user_id) ?? 0) + ((row as any).duration_seconds ?? 0));
  }

  const userIds = Array.from(map.keys());
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, nickname, handle, photo")
    .in("user_id", userIds);

  const profileMap = new Map<string, { nickname: string; handle: string; photo: string | null }>();
  for (const p of profiles ?? []) {
    profileMap.set(p.user_id, { nickname: p.nickname ?? "—", handle: p.handle ?? "", photo: p.photo ?? null });
  }

  return userIds
    .map((uid) => {
      const p = profileMap.get(uid);
      return {
        user_id: uid,
        nickname: p?.nickname ?? "—",
        handle: p?.handle ?? "",
        photo: p?.photo ?? null,
        total_seconds: map.get(uid) ?? 0,
      };
    })
    .sort((a, b) => b.total_seconds - a.total_seconds)
    .slice(0, 10);
}

// ─── Admin: atividade de hoje (telas + ações por usuário) ─────────────────────
//
// RPC `get_admin_today_activity` (migração 20260729-admin-today-activity.sql):
// telemetria de terceiros não é legível com a anon key, então a leitura é
// SECURITY DEFINER com check de admin no servidor.

export type AdminTodayScreen = {
  screen: string;
  seconds: number;
  /** Quantos lotes de screen_time_logs — proxy de "quantas vezes abriu a tela". */
  registros: number;
};

export type AdminTodayAction = {
  /** post | shot | flow | comentario | comentario_shot | curtida | curtida_shot |
   *  check_in | check_in_duelo | mensagem | refeicao | treino */
  acao: string;
  total: number;
  /** ISO da última ocorrência hoje. */
  ultima: string | null;
};

export type AdminTodayUser = {
  user_id: string;
  nickname: string;
  handle: string;
  photo: string | null;
  /** Sessões fechadas hoje (o app grava ao ir para background). */
  sessoes: number;
  total_seconds: number;
  primeiro_acesso: string | null;
  ultimo_acesso: string | null;
  /** Soma do tempo por tela — pode divergir de total_seconds (fontes distintas). */
  screen_seconds: number;
  telas: AdminTodayScreen[];
  acoes: AdminTodayAction[];
  acoes_total: number;
  novo_hoje: boolean;
};

export async function getAdminTodayActivityDb(): Promise<AdminTodayUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const { data, error } = await supabase.rpc("get_admin_today_activity");
  if (error) {
    console.error("Error fetching today activity:", error);
    return [];
  }

  return ((data ?? []) as any[]).map((u) => ({
    user_id: String(u.user_id),
    nickname: String(u.nickname ?? "—"),
    handle: String(u.handle ?? ""),
    photo: u.photo ? String(u.photo) : null,
    sessoes: Number(u.sessoes ?? 0),
    total_seconds: Number(u.total_seconds ?? 0),
    primeiro_acesso: u.primeiro_acesso ? String(u.primeiro_acesso) : null,
    ultimo_acesso: u.ultimo_acesso ? String(u.ultimo_acesso) : null,
    screen_seconds: Number(u.screen_seconds ?? 0),
    telas: ((u.telas ?? []) as any[]).map((t) => ({
      screen: String(t.screen ?? ""),
      seconds: Number(t.seconds ?? 0),
      registros: Number(t.registros ?? 0),
    })),
    acoes: ((u.acoes ?? []) as any[]).map((a) => ({
      acao: String(a.acao ?? ""),
      total: Number(a.total ?? 0),
      ultima: a.ultima ? String(a.ultima) : null,
    })),
    acoes_total: Number(u.acoes_total ?? 0),
    novo_hoje: u.novo_hoje === true,
  }));
}

export async function getAdminComplaintsDb(): Promise<AdminComplaint[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("admin_complaints_view")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminComplaint[];
}

export async function getAdminStatsDb(): Promise<AdminStats> {
  if (!supabase) return { totalUsers: 0, postsHoje: 0, shotsHoje: 0, complaintsTotal: 0 };

  const today = new Date().toISOString().split("T")[0];

  const [usersRes, postsRes, shotsRes, complaintsRes] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("posts").select("id", { count: "exact", head: true }).gte("created_at", `${today}T00:00:00`),
    supabase.from("shots").select("id", { count: "exact", head: true }).gte("created_at", `${today}T00:00:00`),
    supabase.from("admin_complaints_view").select("id", { count: "exact", head: true }),
  ]);

  return {
    totalUsers: usersRes.count ?? 0,
    postsHoje: postsRes.count ?? 0,
    shotsHoje: shotsRes.count ?? 0,
    complaintsTotal: complaintsRes.count ?? 0,
  };
}

export async function adminDismissComplaintDb(
  tipo: AdminComplaint["tipo"],
  id: string,
): Promise<void> {
  if (!supabase) return;
  const tableMap = {
    post: "post_complaint",
    shot: "shots_complaint",
    flow: "flow_complaint",
    usuario: "user_complaint",
  } as const;
  const { error } = await supabase.from(tableMap[tipo]).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Apaga do storage os arquivos que sobraram de um conteúdo removido.
 *
 * Best-effort por definição: mídia órfã é desperdício de cota, não um bug
 * visível — falhar aqui não pode desfazer uma remoção que já aconteceu no
 * banco. Por isso nunca lança; quem chama segue em frente.
 *
 * URLs que não são do Storage público (asset estático do app, URL externa,
 * signed URL) são ignoradas em silêncio — a checagem do marcador cuida disso.
 *
 * **Cuidado com arquivo compartilhado:** um repost de flow aponta para a MESMA
 * `media_url` do original (`repostStoryDb` não copia o arquivo). Antes de
 * chamar aqui, garanta que nenhuma outra linha referencia a URL — ver
 * `filterUnreferencedUrls`.
 */
export async function removeStorageObjects(urls: string[]): Promise<void> {
  if (!supabase || urls.length === 0) return;

  const MARKER = "/storage/v1/object/public/";
  // Agrupa por bucket: `remove` só aceita caminhos de um bucket por chamada.
  const byBucket = new Map<string, string[]>();

  for (const url of urls) {
    const at = url.indexOf(MARKER);
    if (at === -1) continue;
    const rest = url.slice(at + MARKER.length).split("?")[0];
    const slash = rest.indexOf("/");
    if (slash <= 0) continue;
    const bucket = rest.slice(0, slash);
    const path = decodeURIComponent(rest.slice(slash + 1));
    if (!path) continue;
    const current = byBucket.get(bucket) ?? [];
    // Dedup: `posts.photo` costuma repetir o primeiro item de `posts.photos`.
    if (!current.includes(path)) byBucket.set(bucket, [...current, path]);
  }

  await Promise.all(
    Array.from(byBucket.entries()).map(async ([bucket, paths]) => {
      try {
        const { data, error } = await supabase!.storage.from(bucket).remove(paths);
        if (error) {
          console.error(`[removeStorageObjects] ${bucket}:`, error.message);
          return;
        }
        // A RLS do Storage barra DELETE **em silêncio**: sem policy de delete
        // para o dono, `remove` volta 200 com lista vazia e o arquivo continua
        // lá. Sem este aviso, a limpeza parece funcionar e a cota segue subindo.
        // Ver docs/migrations/20260814-storage-delete-policies.sql.
        if ((data?.length ?? 0) < paths.length) {
          console.warn(
            `[removeStorageObjects] ${bucket}: pedido ${paths.length}, removido ${data?.length ?? 0} — ` +
              `provável falta de policy de DELETE em storage.objects`,
          );
        }
      } catch (err: any) {
        console.error(`[removeStorageObjects] ${bucket}:`, err?.message ?? err);
      }
    }),
  );
}

/**
 * Lista recursivamente os caminhos de um prefixo do Storage.
 *
 * `storage.list()` não é recursivo e mistura arquivos com "pastas" (que vêm com
 * `id: null`), então a recursão é manual. Pagina de 100 em 100 — sem isso um
 * usuário com muitas fotos teria só as primeiras apagadas.
 */
async function listStoragePaths(bucket: string, prefix: string): Promise<string[]> {
  if (!supabase) return [];
  const found: string[] = [];
  const PAGE = 100;
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: PAGE, offset });
    if (error || !data || data.length === 0) break;
    for (const entry of data) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      // `id: null` = prefixo (pasta), não objeto — desce nele.
      if ((entry as any).id === null) {
        found.push(...(await listStoragePaths(bucket, full)));
      } else {
        found.push(full);
      }
    }
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return found;
}

/**
 * Apaga TODA a mídia de um usuário — usado na exclusão de conta.
 *
 * Precisa rodar **antes** de a conta sair de `auth.users`: a policy de DELETE do
 * Storage depende de `auth.uid()`, e depois da exclusão não há mais sessão.
 *
 * Best-effort: nenhuma falha aqui pode impedir a exclusão da conta, que é
 * direito do usuário e requisito da App Store. O que sobrar vira mídia órfã,
 * que o script `scripts/sweep-orphan-media.mjs` recolhe depois.
 */
async function purgeUserStorageDb(userId: string): Promise<void> {
  if (!supabase) return;
  try {
    // Pastas cujo caminho já isola o usuário.
    const ownedPrefixes = [
      userId, // {uid}/… → post, avatar, shot (shots/), flow (stories/)
      `checkins/${userId}`,
      `workout-summary/${userId}`,
      `exercise-photos/${userId}`,
    ];

    const paths: string[] = [];
    for (const prefix of ownedPrefixes) {
      paths.push(...(await listStoragePaths("posts", prefix)));
    }

    // `covers/` é uma pasta comum a todo mundo: o uid está no NOME do arquivo
    // (`covers/{uid}-{ts}.jpg`), então filtra em vez de varrer a pasta.
    const covers = await listStoragePaths("posts", "covers");
    paths.push(...covers.filter((p) => p.startsWith(`covers/${userId}-`)));

    if (paths.length > 0) {
      const { error } = await supabase.storage.from("posts").remove(paths);
      if (error) console.error("[purgeUserStorageDb] posts:", error.message);
    }

    // Conversas privadas: a pasta é `{uidA}_{uidB}` (ordenados), então basta
    // achar as que têm este uid numa das pontas.
    const chatFolders = await supabase.storage.from(CHAT_MEDIA_BUCKET).list("", { limit: 1000 });
    const mine = (chatFolders.data ?? [])
      .filter((e: any) => e.id === null && String(e.name).split("_").includes(userId))
      .map((e: any) => String(e.name));
    for (const folder of mine) {
      const chatPaths = await listStoragePaths(CHAT_MEDIA_BUCKET, folder);
      if (chatPaths.length > 0) {
        await supabase.storage.from(CHAT_MEDIA_BUCKET).remove(chatPaths);
      }
    }
  } catch (err: any) {
    console.error("[purgeUserStorageDb]", err?.message ?? err);
  }
}

/**
 * Filtra as URLs que ainda são usadas por outra linha da tabela.
 *
 * Existe por causa do repost de flow: `repostStoryDb` reaproveita a `media_url`
 * e a `poster_url` do original em vez de copiar o arquivo. Apagar o storage ao
 * excluir um dos dois quebraria o outro — que é de outra pessoa.
 *
 * Chamar **depois** do DELETE da linha, para que ela não conte a si mesma.
 * Em qualquer falha devolve lista vazia: preferimos deixar mídia órfã a apagar
 * um arquivo que ainda está no ar.
 */
async function filterUnreferencedUrls(
  urls: string[],
  table: string,
  columns: string[],
): Promise<string[]> {
  if (!supabase || urls.length === 0) return [];
  const unreferenced: string[] = [];
  for (const url of urls) {
    try {
      const orFilter = columns.map((c) => `${c}.eq.${url}`).join(",");
      const { count, error } = await (supabase as any)
        .from(table)
        .select("*", { count: "exact", head: true })
        .or(orFilter);
      if (error) continue;
      if ((count ?? 0) === 0) unreferenced.push(url);
    } catch {
      // Silêncio proposital: mídia órfã é barata, arquivo apagado à toa não é.
    }
  }
  return unreferenced;
}

/**
 * Apaga o arquivo ANTIGO depois de uma troca (avatar, capa, logo, foto de item).
 *
 * Cada upload novo grava um caminho único (`profile-{ts}.jpg`, `covers/{uid}-{ts}.jpg`
 * …) para o CDN não continuar servindo a versão velha na mesma URL. O efeito
 * colateral é que, sem esta limpeza, TODA edição de perfil deixava um arquivo
 * para trás — vazamento lento e proporcional ao engajamento.
 *
 * Chamar só **depois** de a gravação da URL nova ter dado certo: se o update
 * falhar, o registro ainda aponta para o arquivo antigo.
 *
 * Nenhuma tabela guarda cópia histórica de avatar (`duel_check_ins.user_photo`
 * existe mas é morta — as telas re-buscam `profiles.photo`), então apagar o
 * antigo não deixa foto quebrada em conteúdo passado.
 */
async function removeReplacedMedia(
  oldUrl: string | null | undefined,
  newUrl: string | null | undefined,
): Promise<void> {
  if (!oldUrl) return;
  if (oldUrl === newUrl) return; // nada mudou — não é troca
  await removeStorageObjects([oldUrl]);
}

/** Junta colunas de mídia de uma linha (texto solto + array jsonb) numa lista limpa. */
function collectMediaUrls(row: any, textCols: string[], arrayCols: string[] = []): string[] {
  const out: string[] = [];
  for (const col of textCols) {
    const v = row?.[col];
    if (typeof v === "string" && v) out.push(v);
  }
  for (const col of arrayCols) {
    const v = row?.[col];
    if (Array.isArray(v)) {
      for (const item of v) if (typeof item === "string" && item) out.push(item);
    }
  }
  return Array.from(new Set(out));
}

/**
 * Remove um post/shot/flow denunciado, junto das dependências (comentários,
 * curtidas, marcações, visualizações e a própria denúncia).
 *
 * Via RPC `SECURITY DEFINER` porque a RLS de `posts`/`shots`/`flow` só deixa o
 * **autor** apagar: o DELETE direto do painel casava 0 linhas, não retornava
 * erro, e a tela dava baixa na denúncia com o conteúdo ainda no ar.
 *
 * Migration: `docs/migrations/20260811-admin-moderation.sql`.
 */
export async function adminDeleteContentDb(
  tipo: AdminComplaint["tipo"],
  conteudo_id: string,
): Promise<{ deleted: boolean }> {
  if (!hasSupabaseConfig || !supabase) throw new Error("Supabase não configurado");
  if (tipo === "usuario") return { deleted: false }; // ban handled separately

  const { data, error } = await supabase.rpc("admin_delete_content", {
    p_tipo: tipo,
    p_id: String(conteudo_id),
  });

  if (error) {
    if (error.message?.includes("NOT_ADMIN")) {
      throw new Error("Sua conta não tem permissão de admin no servidor.");
    }
    throw new Error(error.message);
  }

  const result = (data ?? {}) as { deleted?: boolean; media?: string[] };

  // Flow: a mídia pode estar compartilhada com um repost (`repostStoryDb` não
  // copia o arquivo). Remover a lista crua apagaria o flow de outra pessoa —
  // que sequer foi denunciada. Post e shot não têm esse compartilhamento.
  const media = result.media ?? [];
  await removeStorageObjects(
    tipo === "flow"
      ? await filterUnreferencedUrls(media, "flow", ["media_url", "poster_url"])
      : media,
  );

  invalidateQueryCache("userPosts");
  invalidateQueryCache("post:");
  invalidateQueryCache("shots");
  invalidateQueryCache("userShots");
  invalidateQueryCache("activeStories");
  invalidateQueryCache("userActiveStories");

  // `deleted: false` aqui só pode significar que a linha já não existia — a RPC
  // ignora RLS, então não há mais o no-op silencioso de antes. Quem chama usa
  // isso para arquivar a denúncia avisando, em vez de travá-la na fila.
  return { deleted: result.deleted === true };
}

/**
 * Marca (ou desmarca) um perfil como banido.
 *
 * Passa por RPC `SECURITY DEFINER` por dois motivos, os dois já custaram bug:
 *   1. `profiles.id` é bigint e o uuid mora em `user_id` — o UPDATE direto
 *      filtrando por `id` estourava `invalid input syntax for type bigint`.
 *   2. Mesmo com a coluna certa, `profiles_update_own` limita o UPDATE à
 *      própria linha: banir outra pessoa casaria 0 linhas **sem erro** e o
 *      painel diria "usuário banido" sem ter banido ninguém.
 *
 * Migration: `docs/migrations/20260811-admin-ban-user.sql`.
 */
/**
 * O usuário logado está banido?
 *
 * Usado pelo guard de rota para mostrar a tela de bloqueio na hora. A trava de
 * verdade é o `banned_until` do GoTrue (que derruba login e refresh); esta
 * checagem existe porque o access token corrente ainda vale até expirar, e
 * ninguém deveria continuar postando nessa janela.
 *
 * Devolve `false` em qualquer falha — rede fora do ar ou migração ainda não
 * rodada não podem trancar quem não fez nada.
 */
export async function isCurrentUserBannedDb(): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;

  try {
    const { data, error } = await supabase.rpc("is_current_user_banned");
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

export async function adminBanUserDb(
  userId: string,
  banned = true,
): Promise<{ sessionRevoked: boolean }> {
  if (!hasSupabaseConfig || !supabase) throw new Error("Supabase não configurado");
  assertUUID(userId, "ID do usuário");

  const { data, error } = await supabase.rpc("admin_set_banned", {
    p_user_id: userId,
    p_banned: banned,
  });

  if (error) {
    if (error.message?.includes("NOT_ADMIN")) {
      throw new Error("Sua conta não tem permissão de admin no servidor.");
    }
    if (error.message?.includes("CANNOT_BAN_SELF")) {
      throw new Error("Você não pode banir a própria conta.");
    }
    throw new Error(error.message);
  }

  const result = (data ?? {}) as { updated?: boolean; session_revoked?: boolean };

  // A RPC devolve updated=false quando nenhuma linha casou (perfil
  // inexistente) — sem isto o painel comemoraria um no-op.
  if (result.updated === false) {
    throw new Error("Perfil não encontrado para este usuário.");
  }

  return { sessionRevoked: result.session_revoked === true };
}

// ─── Push Token Management ─────────────────────────────────────────────────────

/**
 * Upserts the device push token for the current user.
 * Called after the app receives a registration token from @capacitor/push-notifications.
 */
export async function savePushTokenDb(token: string, platform: "ios" | "android" = "ios"): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;
  const viewer = await getViewer();
  if (!viewer) return;
  // Remove este token de qualquer outro usuário que o possua (troca de conta no mesmo dispositivo)
  await supabase
    .from("push_tokens")
    .delete()
    .eq("token", token)
    .neq("user_id", viewer.id);
  const { error } = await supabase
    .from("push_tokens")
    .upsert(
      { user_id: viewer.id, token, platform, updated_at: new Date().toISOString() },
      { onConflict: "user_id,token" }
    );
  if (error) console.error("Error saving push token:", error.message);
}

/**
 * Removes the device push token for the current user (e.g. on logout).
 */
export async function deletePushTokenDb(token: string): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return;
  const viewer = await getViewer();
  if (!viewer) return;
  await supabase
    .from("push_tokens")
    .delete()
    .eq("user_id", viewer.id)
    .eq("token", token);
}

// ─── Admin: cobertura da anatomia (curadoria de workout_muscles) ──────────────
//
// A ficha de anatomia (`ExerciseAnatomy`) some SEM aviso quando o exercício não
// tem linha em `workout_muscles` — é de propósito para o usuário final, mas
// deixava a lacuna invisível também para quem cura o catálogo. Exercício novo
// entra sem anatomia e ninguém fica sabendo. Isto aqui é o inventário do que
// falta mapear.

/** Um exercício sem nenhuma linha em `workout_muscles`. */
export type AnatomyGapItem = {
  id: string;
  name: string;
  muscleGroup: string | null;
  /** `workouts.type` — 2 costuma ser alongamento/mobilidade no catálogo importado. */
  type: number | null;
  /** Criado por um usuário (não é catálogo curado — pode não valer mapear). */
  isCustom: boolean;
  /**
   * Lacuna ESPERADA: o seed da anatomia pula alongamento e mobilidade de
   * propósito (não faz sentido falar em ênfase de recrutamento ali). Separar os
   * dois grupos é o que mantém a lista acionável — sem isso, 26 alongamentos
   * afogariam os poucos exercícios que realmente precisam de atenção.
   */
  isStretch: boolean;
};

export type AnatomyCoverage = {
  /** Exercícios no catálogo (inclui os custom visíveis pela RLS). */
  total: number;
  /** Quantos têm pelo menos uma linha de anatomia. */
  mapped: number;
  /** Os que não têm — alongamento/mobilidade no fim. */
  gaps: AnatomyGapItem[];
};

const ANATOMY_STRETCH_GROUPS = ["alongamento", "mobilidade"];

/**
 * Lê uma tabela inteira em páginas. O PostgREST corta em 1000 linhas por
 * padrão: `workout_muscles` já passa de 800 e cresce a cada exercício mapeado,
 * então um `select` cru começaria a mentir (exercício mapeado apareceria como
 * lacuna) justamente conforme a curadoria avança.
 */
async function fetchAllRows(table: string, columns: string): Promise<any[]> {
  const PAGE = 1000;
  const out: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase!
      .from(table)
      .select(columns)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as any[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

/**
 * Inventário da curadoria de anatomia: quantos exercícios têm músculos
 * mapeados e quais não têm.
 *
 * O diff é no cliente porque o PostgREST não faz `NOT EXISTS` — são duas
 * leituras pequenas de tabelas públicas (nenhuma RPC, nenhuma migração).
 * Sem cache: é tela de gestão, e dado de 12h atrás esconderia exatamente o
 * exercício que o admin acabou de mapear.
 */
export async function getAdminAnatomyCoverageDb(): Promise<AnatomyCoverage> {
  if (!hasSupabaseConfig || !supabase) return { total: 0, mapped: 0, gaps: [] };

  const [workouts, links] = await Promise.all([
    fetchAllRows("workouts", "id, name, name_eng, muscle_group, type, created_by_user"),
    fetchAllRows("workout_muscles", "workout_id"),
  ]);

  const mappedIds = new Set(links.map((r) => String(r.workout_id)));

  const gaps: AnatomyGapItem[] = workouts
    .filter((w) => !mappedIds.has(String(w.id)))
    .map((w) => ({
      id: String(w.id ?? ""),
      name: pickLocalized(w.name, w.name_eng),
      muscleGroup: w.muscle_group ? String(w.muscle_group) : null,
      type: w.type != null ? Number(w.type) : null,
      isCustom: !!w.created_by_user,
      isStretch: ANATOMY_STRETCH_GROUPS.includes(String(w.muscle_group ?? "").toLowerCase()),
    }))
    // Ordem = ordem de trabalho: primeiro o que precisa de atenção, depois
    // alongamento/mobilidade; dentro de cada bloco, agrupado por músculo.
    .sort((a, b) =>
      Number(a.isStretch) - Number(b.isStretch) ||
      (a.muscleGroup ?? "").localeCompare(b.muscleGroup ?? "") ||
      a.name.localeCompare(b.name),
    );

  return { total: workouts.length, mapped: workouts.length - gaps.length, gaps };
}

// ─── Admin: verified accounts ─────────────────────────────────────────────────

/**
 * Marca/desmarca a conta como verificada (selo dourado).
 *
 * Via RPC `SECURITY DEFINER`: o UPDATE direto batia em duas travas de uma vez —
 * `profiles_update_own` (só a própria linha) e o trigger `freeze_is_verified`,
 * que reverte a coluna fora do service_role. As duas falham **sem erro**, então
 * a tela dizia "verificado com sucesso" sem ter verificado ninguém.
 *
 * Migration: `docs/migrations/20260811-admin-moderation.sql`.
 */
export async function setUserVerifiedDb(userId: string, verified: boolean): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;
  assertUUID(userId, "ID do usuário");

  const { data, error } = await supabase.rpc("admin_set_verified", {
    p_user_id: userId,
    p_verified: verified,
  });

  if (error) {
    console.error("Error setting verified status:", error);
    return false;
  }

  // false = nenhuma linha casou (perfil inexistente).
  if (data === false) return false;

  invalidateProfileCache(userId);
  return true;
}

// ─── Admin: LinKa Premium (ativação manual) ───────────────────────────────────
//
// A tabela `subscriptions` não tem policy de escrita (é o que impede o
// auto-upgrade via anon key), então o painel escreve pelas RPCs
// SECURITY DEFINER da migração 20260729-admin-premium.sql, que checam
// `app_admins` no servidor — a lista ADMIN_USER_IDS de App.tsx é só guarda de
// rota e não autoriza nada.

export type AdminPremiumUser = {
  userId: string;
  nickname: string;
  handle: string;
  photo: string | null;
  /** 'active' | 'inactive' | 'expired' | 'cancelled' */
  status: string;
  store: string | null;
  /** Fim do período pago. null = nunca houve assinatura paga. */
  currentPeriodEnd: string | null;
  updatedAt: string;
  /** Cortesia concedida pelo admin (independente da assinatura paga). */
  manualActive: boolean;
  /** Fim da cortesia. null com manualActive = true → permanente. */
  manualUntil: string | null;
  manualNote: string | null;
  /** Assinatura paga vigente (pagou de verdade, via App Store). */
  paidActive: boolean;
  /** Tem premium por qualquer motivo — mesma regra de is_premium(). */
  isActive: boolean;
};

export type AdminUserSearchResult = {
  userId: string;
  nickname: string;
  handle: string;
  photo: string | null;
};

/** Todas as linhas de `subscriptions` com o perfil (só admin). */
export async function getAdminPremiumUsersDb(): Promise<AdminPremiumUser[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const { data, error } = await supabase.rpc("admin_list_premium");
  if (error) {
    console.error("Error listing premium users:", error);
    return [];
  }

  return (data ?? []).map((r: any) => ({
    userId: String(r.user_id),
    nickname: String(r.nickname ?? ""),
    handle: String(r.handle ?? ""),
    photo: r.photo ? String(r.photo) : null,
    status: String(r.status ?? "inactive"),
    store: r.store ? String(r.store) : null,
    currentPeriodEnd: r.current_period_end ? String(r.current_period_end) : null,
    updatedAt: String(r.updated_at ?? ""),
    manualActive: r.manual_active === true,
    manualUntil: r.manual_until ? String(r.manual_until) : null,
    manualNote: r.manual_note ? String(r.manual_note) : null,
    paidActive: r.paid_active === true,
    isActive: r.is_active === true,
  }));
}

/**
 * Concede (ou revoga) o premium **de cortesia** de um usuário.
 * `days` nulo = sem expiração.
 *
 * Mexe só nas colunas `manual_*`: conceder cortesia a um assinante pagante não
 * altera a assinatura dele, e revogar a cortesia não cancela nada na Apple.
 */
export async function adminSetPremiumDb(
  userId: string,
  active: boolean,
  days: number | null = null,
  note: string | null = null,
): Promise<void> {
  if (!hasSupabaseConfig || !supabase) throw new Error("Supabase não configurado");
  assertUUID(userId, "ID do usuário");

  const { error } = await supabase.rpc("admin_set_premium", {
    p_user_id: userId,
    p_active: active,
    p_days: days,
    p_note: note,
  });

  if (error) {
    if (error.message?.includes("NOT_ADMIN")) {
      throw new Error("Sua conta não tem permissão de admin no servidor.");
    }
    throw new Error(error.message);
  }

  // O alvo costuma ser outro device, onde o cache `premium:{uid}` expira sozinho
  // em 60s. Se o admin ativou para si mesmo, reflete na hora.
  invalidateQueryCache(`premium:${userId}`);
}

/** Busca usuários por @handle ou nome, para o painel admin. */
export async function adminSearchUsersDb(
  term: string,
  limit = 8,
): Promise<AdminUserSearchResult[]> {
  if (!hasSupabaseConfig || !supabase) return [];
  const raw = term.trim().replace(/^@/, "");
  if (raw.length < 2) return [];
  // Vírgula/parêntese quebram a sintaxe do `or()` do PostgREST; % e _ são
  // curingas do LIKE. Fora todos.
  const pattern = `%${raw.replace(/[%_,()]/g, "")}%`;

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, nickname, handle, photo")
    .or(`handle.ilike.${pattern},nickname.ilike.${pattern}`)
    .limit(limit);

  if (error) {
    console.error("Error searching users (admin):", error);
    return [];
  }

  return (data ?? []).map((p: any) => ({
    userId: String(p.user_id),
    nickname: String(p.nickname ?? ""),
    handle: String(p.handle ?? ""),
    photo: p.photo ? String(p.photo) : null,
  }));
}

export async function getVerifiedAccountsDb(): Promise<{ userId: string; nickname: string; handle: string; photo: string | null }[]> {
  if (!hasSupabaseConfig || !supabase) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, nickname, handle, photo")
    .eq("is_verified", true)
    .order("nickname");

  if (error) {
    console.error("Error fetching verified accounts:", error);
    return [];
  }

  return (data ?? []).map((p: any) => ({
    userId: String(p.user_id),
    nickname: String(p.nickname ?? ""),
    handle: String(p.handle ?? ""),
    photo: p.photo ? String(p.photo) : null,
  }));
}


// ─── Replay da fila offline (Metas offline) ───────────────────────────────────
// Executores registrados no offline-outbox: quando a internet volta, cada
// entrada enfileirada sem rede é regravada no banco COM A DATA ORIGINAL da
// ação. Importante: todos usam os caminhos "online puros" (que lançam erro de
// rede) — nunca as funções públicas com fallback offline, senão uma falha no
// replay seria confundida com sucesso e a entrada se perderia.

registerOutboxExecutor("workout_hist", async (p: any) => {
  await insertWorkoutHistRowDb({
    userId: String(p.userId),
    userWorkoutId: p.userWorkoutId != null ? Number(p.userWorkoutId) : null,
    workoutId: String(p.workoutId),
    kilos: p.kilos != null ? Number(p.kilos) : null,
    volume: p.volume != null ? String(p.volume) : null,
    routineId: p.routineId != null ? String(p.routineId) : null,
    dateCompleted: String(p.dateCompleted),
    // Payloads enfileirados antes de 05/08/2026 não têm a chave — `undefined`
    // vira NULL no insert (= série do modo simplificado), então um treino que
    // ficou na fila durante o deploy continua sincronizando normalmente.
    setKind: p.setKind === "warmup" || p.setKind === "normal" || p.setKind === "failure"
      ? p.setKind
      : null,
  });
  invalidateQueryCache("workoutHistory");
  // Mesma origem (user_workouts_hist): o gráfico de progressão e a cobertura
  // muscular precisam cair junto com o histórico, senão ficam velhos durante
  // todo o TTL (15min no caso da cobertura).
  invalidateQueryCache("exerciseProgress");
  invalidateQueryCache("muscleCoverage");
});

registerOutboxExecutor("check_in", async (p: any) => {
  await insertCheckInOnlineDb(String(p.userId), String(p.checkInDate));
  // Insígnias que dependiam deste check-in (streak, total…) são avaliadas na
  // sincronização; a celebração visual fica para a próxima tela que carregá-las.
  await awardBadgesForCheckInsDb(
    String(p.userId),
    new Date(String(p.checkInDate) + "T12:00:00"),
  ).catch(() => { /* best-effort */ });
});

registerOutboxExecutor("goal_progress", async (p: any) => {
  const viewer = await getViewer();
  if (!viewer) throw new Error("Sem sessão para sincronizar progresso de meta");
  await applyGoalProgressOnlineDb(String(p.userGoalId), String(p.date), viewer.id);
});

registerOutboxExecutor("routine_summary", async (p: any) => {
  const { error } = await supabase!
    .from("routines")
    .update({ last_summary: p.summary })
    .eq("id", String(p.routineId));
  if (error) throw error;
});

registerOutboxExecutor("workout_notes", async (p: any) => {
  let query = supabase!
    .from("user_workouts")
    .update({ notes: p.notes != null ? String(p.notes) : null })
    .eq("user_id", String(p.userId))
    .eq("workout_id", String(p.workoutId));
  if (p.routineId != null) query = query.eq("routine_id", Number(p.routineId));
  const { error } = await query;
  if (error) throw error;
});

registerOutboxExecutor("diet_toggle", async (p: any) => {
  const { error } = await supabase!
    .from("user_diets")
    .update({
      is_completed: Boolean(p.isCompleted),
      completed_at: p.completedAt != null ? String(p.completedAt) : null,
    })
    .eq("id", String(p.userDietId));
  if (error) throw error;
});

registerOutboxExecutor("habit_toggle", async (p: any) => {
  const { error } = await supabase!
    .from("user_habits")
    .update({
      is_completed: Boolean(p.isCompleted),
      completed_at: p.completedAt != null ? String(p.completedAt) : null,
    })
    .eq("id", String(p.userHabitId));
  if (error) throw error;
});

registerOutboxExecutor("diet_hist", async (p: any) => {
  await insertDietHistRowDb({
    userId: String(p.userId),
    userDietId: p.userDietId != null ? String(p.userDietId) : null,
    dietId: Number(p.dietId),
    quantity: p.quantity != null ? Number(p.quantity) : null,
    createdAt: String(p.createdAt),
  });
});

registerOutboxExecutor("habit_hist", async (p: any) => {
  await insertHabitHistRowDb({
    userId: String(p.userId),
    userHabitId: p.userHabitId != null ? String(p.userHabitId) : null,
    habitId: Number(p.habitId),
    quantity: p.quantity != null ? Number(p.quantity) : null,
    frequency: p.frequency != null ? Number(p.frequency) : null,
    createdAt: String(p.createdAt),
  });
});

// Executores prontos: se o app abriu online com entradas pendentes de uma
// sessão offline anterior, tenta drenar já (além dos gatilhos do outbox).
if (typeof window !== "undefined") {
  setTimeout(() => {
    if (!isLikelyOffline()) void flushOutbox();
  }, 1500);
}
