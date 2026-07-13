import { BackgroundGeolocation, type Location, type CallbackError } from "@capgo/background-geolocation";

// ── Rastreador de corrida por GPS ────────────────────────────────────────────
// Singleton em nível de módulo (fora do React) para que a corrida continue
// mesmo quando o WorkoutSessionDialog é minimizado ou o usuário navega — o
// mesmo motivo pelo qual o timer de descanso vive no workout-context. O painel
// da sessão se inscreve via subscribeRun() e apenas renderiza o estado.
//
// Plugin: @capgo/background-geolocation (2026-07-10 — substituiu o
// @capacitor/geolocation aqui). Passar `backgroundMessage` no start() é o que
// liga `allowsBackgroundLocationUpdates` no iOS: os fixes continuam chegando
// com o app em segundo plano OU com a TELA BLOQUEADA (indicador azul de
// localização visível — mesmo modelo do Strava, permissão "durante o uso"
// basta). No web (pnpm dev) o plugin cai em navigator.geolocation.
//
// Distância: soma de haversine entre fixes consecutivos, com filtros:
//   - fix com precisão pior que MAX_ACCURACY_M é ignorado (não move a âncora);
//   - deslocamento menor que MIN_STEP_M em relação à âncora é ruído de GPS
//     parado — ignorado sem mover a âncora, então caminhada lenta ainda
//     acumula quando o deslocamento total supera o limiar;
//   - velocidade acima de MAX_SPEED_MS (~45 km/h) é glitch/teletransporte —
//     realinha a âncora sem somar distância.
// Tempo: wall-clock (accumulatedMs + agora − início do segmento) — nunca
// depende de tick de JS, então suspensões não atrasam o cronômetro.
//
// Trajeto: cada fix aceito vira um ponto em `path` (array de SEGMENTOS — um
// novo segmento abre a cada retomada de pausa, para o mapa não desenhar uma
// reta ligando o ponto da pausa ao da retomada).

export type RunStatus = "idle" | "acquiring" | "running" | "paused";

export interface RunPoint {
  lat: number;
  lng: number;
}

export interface RunState {
  status: RunStatus;
  /** workout_id do exercício dono da corrida ativa (null quando idle) */
  workoutId: string | null;
  distanceKm: number;
  elapsedMs: number;
  /** ritmo médio em segundos por km — null enquanto a distância é irrelevante */
  paceSecPerKm: number | null;
  /** precisão (m) do último fix recebido */
  accuracy: number | null;
  error: "denied" | "unavailable" | null;
}

export interface RunResult {
  distanceKm: number;
  elapsedMs: number;
  paceSecPerKm: number | null;
  /** trajeto percorrido, em segmentos (quebra a cada pausa→retomada) */
  path: RunPoint[][];
}

const MAX_ACCURACY_M = 40;
const MIN_STEP_M = 3;
const MAX_SPEED_MS = 12.5;
/** distância mínima para o pace fazer sentido (evita paces absurdos no início) */
const MIN_PACE_DISTANCE_KM = 0.05;

let status: RunStatus = "idle";
let workoutId: string | null = null;
let distanceM = 0;
let accumulatedMs = 0;
let segmentStartedAt: number | null = null;
let lastPoint: { lat: number; lng: number; time: number } | null = null;
let lastAccuracy: number | null = null;
let error: RunState["error"] = null;
let hadFix = false;
let path: RunPoint[][] = [];

let watching = false;
let tick: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<(s: RunState) => void>();

function currentElapsedMs(): number {
  return accumulatedMs + (segmentStartedAt ? Date.now() - segmentStartedAt : 0);
}

function snapshot(): RunState {
  const distanceKm = distanceM / 1000;
  const elapsedMs = currentElapsedMs();
  return {
    status,
    workoutId,
    distanceKm,
    elapsedMs,
    paceSecPerKm:
      distanceKm >= MIN_PACE_DISTANCE_KM ? elapsedMs / 1000 / distanceKm : null,
    accuracy: lastAccuracy,
    error,
  };
}

function notify() {
  const s = snapshot();
  listeners.forEach((l) => l(s));
}

function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function pushPoint(lat: number, lng: number) {
  if (path.length === 0) path.push([]);
  path[path.length - 1].push({ lat, lng });
}

function isDeniedError(e?: CallbackError): boolean {
  if (!e) return false;
  // iOS rejeita com "NOT_AUTHORIZED"; o web usa o código numérico do
  // GeolocationPositionError ("1" = PERMISSION_DENIED).
  return (
    e.code === "NOT_AUTHORIZED" ||
    e.code === "1" ||
    /denied|permission|authoriz/i.test(String(e.message ?? ""))
  );
}

function onLocation(loc?: Location, err?: CallbackError) {
  if (status !== "acquiring" && status !== "running") return;
  if (!loc) {
    // Erro antes do primeiro fix = GPS inutilizável (permissão/sinal) → encerra.
    // Depois de já ter fix, erros são transientes (túnel, prédio) — ignora.
    if (!hadFix) {
      const denied = isDeniedError(err);
      void stopRun();
      error = denied ? "denied" : "unavailable";
      notify();
    }
    return;
  }

  const { latitude, longitude, accuracy } = loc;
  const time = loc.time || Date.now();
  hadFix = true;
  lastAccuracy = accuracy ?? null;
  error = null;
  if (status === "acquiring") status = "running";

  if (accuracy != null && accuracy > MAX_ACCURACY_M) {
    notify();
    return;
  }
  if (!lastPoint) {
    lastPoint = { lat: latitude, lng: longitude, time };
    pushPoint(latitude, longitude);
    notify();
    return;
  }

  const d = haversineM(lastPoint.lat, lastPoint.lng, latitude, longitude);
  const dtSec = Math.max(0.001, (time - lastPoint.time) / 1000);
  if (d < MIN_STEP_M) {
    notify();
    return;
  }
  if (d / dtSec > MAX_SPEED_MS) {
    lastPoint = { lat: latitude, lng: longitude, time };
    notify();
    return;
  }

  distanceM += d;
  lastPoint = { lat: latitude, lng: longitude, time };
  pushPoint(latitude, longitude);
  notify();
}

export interface StartRunLabels {
  /** título da notificação Android; no iOS a presença dele liga o background */
  backgroundTitle: string;
  backgroundMessage: string;
}

async function startWatch(labels: StartRunLabels) {
  try {
    await BackgroundGeolocation.start(
      {
        backgroundTitle: labels.backgroundTitle,
        // Presença desta string = allowsBackgroundLocationUpdates no iOS
        // (rastreamento segue com a tela bloqueada).
        backgroundMessage: labels.backgroundMessage,
        requestPermissions: true,
        stale: false,
        distanceFilter: 0,
      },
      onLocation,
    );
    watching = true;
    // A corrida pode ter sido pausada/encerrada enquanto o start resolvia —
    // nesse caso o watcher recém-nascido já é órfão e precisa morrer aqui.
    if (status !== "acquiring" && status !== "running") {
      watching = false;
      await BackgroundGeolocation.stop().catch(() => {});
    }
  } catch (e) {
    // Watcher fantasma de uma sessão anterior (hot reload) — derruba e tenta 1x.
    if ((e as { code?: string })?.code === "ALREADY_STARTED" || /already/i.test(String((e as Error)?.message ?? ""))) {
      await BackgroundGeolocation.stop().catch(() => {});
      try {
        await BackgroundGeolocation.start(
          {
            backgroundTitle: labels.backgroundTitle,
            backgroundMessage: labels.backgroundMessage,
            requestPermissions: true,
            stale: false,
            distanceFilter: 0,
          },
          onLocation,
        );
        watching = true;
        return;
      } catch {
        /* cai no erro genérico abaixo */
      }
    }
    await stopRun();
    error = isDeniedError(e as CallbackError) ? "denied" : "unavailable";
    notify();
  }
}

async function stopWatch() {
  if (!watching) return;
  watching = false;
  try {
    await BackgroundGeolocation.stop();
  } catch {
    /* watcher já morto */
  }
}

function startTick() {
  if (tick) return;
  tick = setInterval(notify, 1000);
}

function stopTick() {
  if (tick) clearInterval(tick);
  tick = null;
}

export async function startRun(id: string, labels: StartRunLabels): Promise<void> {
  if (status !== "idle") return;
  workoutId = id;
  distanceM = 0;
  accumulatedMs = 0;
  lastPoint = null;
  lastAccuracy = null;
  hadFix = false;
  error = null;
  path = [];
  // O cronômetro parte do toque em "Iniciar" (como apps de corrida); a
  // distância só começa a contar quando o primeiro fix chega.
  segmentStartedAt = Date.now();
  status = "acquiring";
  notify();

  await startWatch(labels);
  startTick();
}

export async function pauseRun(): Promise<void> {
  if (status !== "running" && status !== "acquiring") return;
  accumulatedMs += segmentStartedAt ? Date.now() - segmentStartedAt : 0;
  segmentStartedAt = null;
  status = "paused";
  // Âncora zerada: o deslocamento feito durante a pausa não vira distância,
  // e a retomada abre um novo segmento do trajeto (sem reta ligando os dois).
  lastPoint = null;
  stopTick();
  notify();
  await stopWatch();
}

export async function resumeRun(labels: StartRunLabels): Promise<void> {
  if (status !== "paused") return;
  segmentStartedAt = Date.now();
  status = "acquiring";
  if (path.length > 0 && path[path.length - 1].length > 0) path.push([]);
  startTick();
  notify();
  await startWatch(labels);
}

/** Encerra a corrida e devolve o resultado final (no-op seguro quando idle). */
export async function stopRun(): Promise<RunResult> {
  const final = snapshot();
  const finalPath = path.filter((seg) => seg.length > 0);
  stopTick();
  await stopWatch();
  status = "idle";
  workoutId = null;
  distanceM = 0;
  accumulatedMs = 0;
  segmentStartedAt = null;
  lastPoint = null;
  lastAccuracy = null;
  hadFix = false;
  error = null;
  path = [];
  notify();
  return {
    distanceKm: final.distanceKm,
    elapsedMs: final.elapsedMs,
    paceSecPerKm: final.paceSecPerKm,
    path: finalPath,
  };
}

export function getRunState(): RunState {
  return snapshot();
}

/** "27:30" ou "1:02:07" — usado no painel da sessão e no resumo/mapa */
export function formatRunTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** ritmo "5:29" (min/km) — "—" quando a distância ainda é irrelevante */
export function formatRunPace(secPerKm: number | null): string {
  if (secPerKm == null || !isFinite(secPerKm) || secPerKm > 3600) return "—";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function subscribeRun(listener: (s: RunState) => void): () => void {
  listeners.add(listener);
  listener(snapshot());
  return () => {
    listeners.delete(listener);
  };
}

/** Abre os Ajustes do sistema na tela do app (para permissão negada). */
export async function openLocationSettings(): Promise<void> {
  try {
    await BackgroundGeolocation.openSettings();
  } catch {
    /* indisponível no web */
  }
}

// Ao voltar do background/lock, atualiza a UI na hora (o tempo é wall-clock e
// os fixes continuaram chegando pelo plugin nativo — só falta re-renderizar).
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && status !== "idle") notify();
  });
}
