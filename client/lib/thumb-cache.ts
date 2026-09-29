import * as React from "react";

/**
 * Cache de MINIATURAS no próprio aparelho.
 *
 * O problema (medido em 29/09/2026): as imagens do Storage são servidas no
 * tamanho original — avatar com mediana de 841 KB, foto de exercício do
 * catálogo com 975 KB, foto de post com 683 KB — e as transformações da
 * Supabase estão desligadas por cota (ver `image-url.ts`). O feed aguenta
 * porque mostra UMA foto grande por vez; perfil, metas e conversas mostram
 * dezenas de miniaturas, e cada uma decodificava uma foto de megapixels a cada
 * vez que a tela montava — mesmo com o arquivo já em cache HTTP.
 *
 * A saída: na primeira vez que uma imagem aparece pequena, o app a reduz num
 * canvas e guarda o JPEG (poucos KB) no IndexedDB. Daí em diante a tela mostra a
 * miniatura — da memória (síncrono) na mesma sessão, do IndexedDB entre
 * aberturas do app. Nada é gravado no Storage: sem RLS, sem arquivo órfão.
 *
 * Qualquer falha (CORS, rede, IndexedDB indisponível) devolve a URL original —
 * a tela fica como antes, nunca quebra.
 */

// Degraus de tamanho em pixels de DISPOSITIVO (lado menor da miniatura).
// Arredondar para cima reaproveita a mesma miniatura entre telas parecidas.
const STEPS = [96, 192, 384, 768];
const DPR_CAP = 3;
const JPEG_QUALITY = 0.82;
// Arquivo menor que isto já é "miniatura" — gerar outra não compensa.
const SMALL_ENOUGH_BYTES = 48 * 1024;
const MAX_CONCURRENT = 3;
// Teto do acervo no IndexedDB; ao passar, apaga os mais antigos.
const MAX_ENTRIES = 1500;
const PRUNE_BATCH = 300;

const DB_NAME = "lk-thumbs";
const STORE = "thumbs";

/** URL a exibir por chave. `null` = usar a original (pequena ou falhou). */
const memory = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();

function stepFor(cssPx: number): number {
  const dpr = typeof window === "undefined" ? 1 : Math.min(DPR_CAP, window.devicePixelRatio || 1);
  const target = Math.ceil(cssPx * dpr);
  return STEPS.find((s) => s >= target) ?? STEPS[STEPS.length - 1];
}

/** Só imagens remotas do Storage; SVG/GIF/blob/data e assets locais passam direto. */
export function isThumbEligible(src: string | null | undefined): src is string {
  if (!src || !/^https?:\/\//i.test(src)) return false;
  if (!src.includes("/storage/v1/object/")) return false;
  return !/\.(svg|gif)(\?|$)/i.test(src);
}

function keyOf(src: string, step: number) {
  return `${step}|${src}`;
}

// ─── IndexedDB ────────────────────────────────────────────────────────────────

type Stored = { blob: Blob | null; t: number };

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore(STORE);
        store.createIndex("t", "t");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function idbGet(key: string): Promise<Stored | undefined> {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as Stored | undefined);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

let writesSincePrune = 0;

async function idbPut(key: string, value: Stored) {
  const db = await openDb();
  if (!db) return;
  try {
    db.transaction(STORE, "readwrite").objectStore(STORE).put(value, key);
  } catch {
    return;
  }
  if (++writesSincePrune >= 100) {
    writesSincePrune = 0;
    void prune(db);
  }
}

async function prune(db: IDBDatabase) {
  try {
    const store = db.transaction(STORE, "readwrite").objectStore(STORE);
    const countReq = store.count();
    countReq.onsuccess = () => {
      if (countReq.result <= MAX_ENTRIES) return;
      let removed = 0;
      const cursorReq = store.index("t").openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor || removed >= PRUNE_BATCH) return;
        cursor.delete();
        removed++;
        cursor.continue();
      };
    };
  } catch {
    /* sem poda — o próximo lote tenta de novo */
  }
}

// ─── Geração ──────────────────────────────────────────────────────────────────

let running = 0;
const queue: Array<() => void> = [];

function withSlot<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      running++;
      task()
        .then(resolve, reject)
        .finally(() => {
          running--;
          queue.shift()?.();
        });
    };
    if (running < MAX_CONCURRENT) run();
    else queue.push(run);
  });
}

async function decode(blob: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(blob);
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      /* cai no <img> abaixo */
    }
  }
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  await img.decode();
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
}

/** Miniatura em JPEG com o LADO MENOR = `step` — serve a `cover` e a `contain`. `null` = original já é pequena. */
async function makeThumb(src: string, step: number): Promise<Blob | null> {
  const res = await fetch(src, { mode: "cors" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  if (blob.size <= SMALL_ENOUGH_BYTES) return null;

  const img = await decode(blob);
  try {
    const shorter = Math.min(img.width, img.height);
    if (!shorter || shorter <= step) return null; // nunca amplia
    const scale = step / shorter;
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    // Fundo branco: PNG com transparência (fotos de exercício do wger) viraria
    // preto no JPEG.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img.source, 0, 0, w, h);
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!out) throw new Error("toBlob");
    return out.size < blob.size ? out : null;
  } finally {
    img.close();
  }
}

/** Resolve a URL a exibir (miniatura em blob: ou `null` para a original). */
export function loadThumb(src: string, cssPx: number): Promise<string | null> {
  const step = stepFor(cssPx);
  const key = keyOf(src, step);
  if (memory.has(key)) return Promise.resolve(memory.get(key) ?? null);
  const inflight = pending.get(key);
  if (inflight) return inflight;

  const p = (async () => {
    const stored = await idbGet(key);
    if (stored) {
      const url = stored.blob ? URL.createObjectURL(stored.blob) : null;
      memory.set(key, url);
      return url;
    }
    try {
      const thumb = await withSlot(() => makeThumb(src, step));
      const url = thumb ? URL.createObjectURL(thumb) : null;
      memory.set(key, url);
      void idbPut(key, { blob: thumb, t: Date.now() });
      return url;
    } catch {
      // Falha de rede/CORS: não grava no IndexedDB (pode dar certo depois),
      // só usa a original nesta sessão.
      memory.set(key, null);
      return null;
    }
  })().finally(() => pending.delete(key));

  pending.set(key, p);
  return p;
}

/**
 * URL para um `<img>` exibido em até `cssPx` pixels (o maior lado na tela).
 *
 * - Já resolvida nesta sessão → devolve na hora (sem piscar ao voltar à tela).
 * - Senão → `undefined` enquanto consulta o IndexedDB / gera a miniatura, e
 *   depois a miniatura (ou a original, se não valer a pena ou falhar).
 * - `cssPx` ausente ou imagem não elegível → a própria `src`, como antes.
 */
export function useThumbSrc(src: string | null | undefined, cssPx: number | undefined): string | undefined {
  const eligible = !!cssPx && isThumbEligible(src);
  const key = eligible ? keyOf(src as string, stepFor(cssPx as number)) : null;

  const resolveSync = (): string | undefined => {
    if (!eligible) return src ?? undefined;
    if (key && memory.has(key)) return memory.get(key) ?? (src as string);
    return undefined;
  };

  const [shown, setShown] = React.useState<string | undefined>(resolveSync);

  React.useEffect(() => {
    const sync = resolveSync();
    setShown(sync);
    if (sync !== undefined || !eligible) return;
    let cancelled = false;
    loadThumb(src as string, cssPx as number).then((url) => {
      if (!cancelled) setShown(url ?? (src as string));
    });
    return () => {
      cancelled = true;
    };
    // `key` resume src + tamanho
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, src, eligible]);

  return shown;
}
