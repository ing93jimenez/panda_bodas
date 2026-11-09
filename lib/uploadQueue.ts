"use client";

/**
 * Cola de subida que sobrevive sin señal y a cerrar la app.
 *
 * Cada foto se comprime y se guarda PRIMERO en el celular (IndexedDB). Luego se
 * sube en segundo plano; solo se borra del celular cuando el servidor confirma.
 * Si no hay conexión, espera y reintenta sola (al volver la señal, al reabrir la
 * app, o cada cierto tiempo). Cada foto lleva una clave única para que un
 * reintento nunca la duplique.
 */
import { api, ApiError } from "@/lib/api";
import { prepareImage } from "@/lib/compress";
import { browserDb } from "@/lib/supabase/browser";

export interface PendingPhoto {
  key: string;
  blob: Blob;
  width: number;
  height: number;
  challengeId: string | null;
  capturedAt: string;
  /** Error que no se arregla reintentando (p. ej. el evento ya cerró). */
  fatal?: string;
}

export interface QueueState {
  /** Fotos guardadas en el celular esperando subirse. */
  pending: number;
  /** Fotos que no se pudieron subir y no se reintentarán solas. */
  stuck: number;
  stuckReason: string | null;
  /** Se está preparando o subiendo algo ahora. */
  busy: boolean;
  online: boolean;
  /** El último intento falló por red: las fotos esperan señal. */
  waitingSignal: boolean;
  /** Último total de fotos confirmado por el servidor. */
  photoCount: number | null;
}

const DB_NAME = "boda-fotos";
const STORE = "pending";

// ---------- almacenamiento (IndexedDB con respaldo en memoria) ----------

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memory = new Map<string, PendingPhoto>();

function openDb(): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "key" });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  if (!db) throw new Error("no-idb");
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putItem(item: PendingPhoto) {
  try {
    await tx("readwrite", (s) => s.put(item));
  } catch {
    memory.set(item.key, item);
  }
}

async function deleteItem(key: string) {
  memory.delete(key);
  try {
    await tx("readwrite", (s) => s.delete(key));
  } catch {}
}

async function allItems(): Promise<PendingPhoto[]> {
  let items: PendingPhoto[] = [];
  try {
    items = await tx<PendingPhoto[]>("readonly", (s) => s.getAll());
  } catch {}
  const keys = new Set(items.map((i) => i.key));
  for (const m of memory.values()) if (!keys.has(m.key)) items.push(m);
  return items.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
}

// ---------- estado observable ----------

const INITIAL: QueueState = {
  pending: 0,
  stuck: 0,
  stuckReason: null,
  busy: false,
  online: true,
  waitingSignal: false,
  photoCount: null,
};
let state: QueueState = INITIAL;
const listeners = new Set<(s: QueueState) => void>();

function set(patch: Partial<QueueState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

export function getState() {
  return state;
}

/** Estado fijo para el render del servidor y la hidratación. */
export function getServerState() {
  return INITIAL;
}

export function subscribe(fn: (s: QueueState) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function refreshCounts() {
  const items = await allItems();
  const stuck = items.filter((i) => i.fatal);
  set({ pending: items.length - stuck.length, stuck: stuck.length, stuckReason: stuck[0]?.fatal ?? null });
}

// ---------- subida ----------

async function uploadOne(item: PendingPhoto): Promise<number> {
  const contentType = item.blob.type || "image/jpeg";
  const { path, token } = await api<{ path: string; token: string }>("/api/upload-url", {
    method: "POST",
    json: { contentType, capturedAt: item.capturedAt },
  });
  const { error } = await browserDb()
    .storage.from("media")
    .uploadToSignedUrl(path, token, item.blob, { contentType, upsert: false });
  if (error) throw new Error(error.message);
  const r = await api<{ photoCount: number }>("/api/photos", {
    method: "POST",
    json: {
      path,
      width: item.width || undefined,
      height: item.height || undefined,
      clientKey: item.key,
      capturedAt: item.capturedAt,
      challengeId: item.challengeId ?? undefined,
    },
  });
  return r.photoCount;
}

let running = false;
let backoff = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

/** Sube todo lo pendiente. Seguro de llamar muchas veces. */
export async function pump(): Promise<void> {
  if (running) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    set({ online: false });
    await refreshCounts();
    return;
  }
  running = true;
  set({ busy: true, online: true });
  try {
    for (const item of await allItems()) {
      if (item.fatal) continue;
      try {
        const count = await uploadOne(item);
        await deleteItem(item.key);
        backoff = 0;
        set({ photoCount: count, waitingSignal: false });
        await refreshCounts();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) break; // sin nombre elegido: esperar
        if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429) {
          await putItem({ ...item, fatal: e.message });
          await refreshCounts();
          continue;
        }
        // Sin señal o error temporal: reintentar más tarde, sin perder la foto.
        backoff = Math.min(backoff ? backoff * 2 : 4000, 60000);
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(() => void pump(), backoff);
        set({ waitingSignal: true });
        if (typeof navigator !== "undefined" && navigator.onLine === false) set({ online: false });
        break;
      }
    }
  } finally {
    running = false;
    set({ busy: false });
    await refreshCounts();
  }
}

let prepChain: Promise<void> = Promise.resolve();

/** Agrega fotos a la cola: se comprimen, se guardan en el celular y se suben. */
export function addPhotos(files: File[], challengeId: string | null) {
  set({ busy: true });
  for (const file of files) {
    prepChain = prepChain.then(async () => {
      const capturedAt = new Date(file.lastModified || Date.now()).toISOString();
      try {
        const p = await prepareImage(file);
        await putItem({
          key: crypto.randomUUID(),
          blob: p.blob,
          width: p.width,
          height: p.height,
          challengeId,
          capturedAt,
        });
      } catch (e) {
        alert(`No se pudo procesar una foto: ${(e as Error).message}`);
      }
      await refreshCounts();
      void pump();
    });
  }
}

/** Vuelve a intentar las fotos que quedaron trabadas. */
export async function retryStuck() {
  for (const item of await allItems()) if (item.fatal) await putItem({ ...item, fatal: undefined });
  backoff = 0;
  await refreshCounts();
  void pump();
}

let started = false;

/** Arranca la sincronización en segundo plano (una vez por página). */
export function startSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("online", () => {
    set({ online: true });
    backoff = 0;
    void pump();
  });
  window.addEventListener("offline", () => set({ online: false }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void pump();
  });
  setInterval(() => void pump(), 30000);
  void refreshCounts().then(pump);
}
