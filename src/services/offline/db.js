// Lightweight persistent storage for offline support: a key/value `cache`
// (last-synced snapshots of Firebase data, so the app has something to show
// on a cold start with no connection) and a `queue` (writes made while
// offline, replayed in order once we're back online — see ./sync.js).
//
// Firebase's Realtime Database JS SDK has no built-in disk persistence
// (unlike Firestore's enableIndexedDbPersistence): it only keeps data in
// memory for as long as a listener stays attached, which doesn't survive a
// page reload or app restart. This module is what actually gives us
// "reload the app with no network and still see your last-synced data".
//
// Falls back to an in-memory Map/array when IndexedDB isn't available.
// That means queued writes won't survive a reload in that fallback case,
// but the app keeps working instead of throwing.

const DB_NAME = "kasseo-offline";
const DB_VERSION = 1;
const CACHE_STORE = "cache";
const QUEUE_STORE = "queue";

function hasIndexedDB() {
  return typeof indexedDB !== "undefined";
}

let dbPromise = null;

function openDb() {
  if (!hasIndexedDB()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const idb = req.result;
        if (!idb.objectStoreNames.contains(CACHE_STORE)) {
          idb.createObjectStore(CACHE_STORE, { keyPath: "key" });
        }
        if (!idb.objectStoreNames.contains(QUEUE_STORE)) {
          idb.createObjectStore(QUEUE_STORE, { keyPath: "id", autoIncrement: true });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        console.warn("Offline storage unavailable, falling back to in-memory only:", req.error);
        resolve(null);
      };
    } catch (err) {
      console.warn("Offline storage unavailable, falling back to in-memory only:", err);
      resolve(null);
    }
  });
  return dbPromise;
}

async function getStore(storeName, mode) {
  const idb = await openDb();
  if (!idb) return null;
  return idb.transaction(storeName, mode).objectStore(storeName);
}

// In-memory fallback, used only when IndexedDB isn't available.
const memCache = new Map();
const memQueue = [];
let memQueueId = 1;

function requestToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Read a cached value by key. Returns null if missing. */
export async function cacheGet(key) {
  const store = await getStore(CACHE_STORE, "readonly");
  if (!store) return memCache.has(key) ? memCache.get(key) : null;
  try {
    const result = await requestToPromise(store.get(key));
    return result ? result.value : null;
  } catch {
    return null;
  }
}

/** Store the last-synced value for a key (fire-and-forget is fine). */
export async function cacheSet(key, value) {
  const store = await getStore(CACHE_STORE, "readwrite");
  if (!store) {
    memCache.set(key, value);
    return;
  }
  try {
    store.put({ key, value, updatedAt: Date.now() });
  } catch (err) {
    console.warn("Failed to cache value for", key, err);
  }
}

/**
 * Queue a write to replay once back online.
 * `op` looks like { kind: 'set' | 'update' | 'remove', path, payload? }.
 * Returns the queue entry's id.
 */
export async function queueAdd(op) {
  const store = await getStore(QUEUE_STORE, "readwrite");
  const entry = { ...op, createdAt: Date.now() };
  if (!store) {
    const id = memQueueId++;
    memQueue.push({ id, ...entry });
    return id;
  }
  return requestToPromise(store.add(entry));
}

/** All queued writes, in the order they were added. */
export async function queueList() {
  const store = await getStore(QUEUE_STORE, "readonly");
  if (!store) return [...memQueue];
  try {
    const all = await requestToPromise(store.getAll());
    return all || [];
  } catch {
    return [];
  }
}

/** Remove a queued write once it's been successfully replayed. */
export async function queueRemove(id) {
  const store = await getStore(QUEUE_STORE, "readwrite");
  if (!store) {
    const idx = memQueue.findIndex((o) => o.id === id);
    if (idx !== -1) memQueue.splice(idx, 1);
    return;
  }
  try {
    store.delete(id);
  } catch (err) {
    console.warn("Failed to remove queued write", id, err);
  }
}

/**
 * Races `promise` against a timeout so a Firebase call that would otherwise
 * hang indefinitely while offline (rather than rejecting) doesn't block the
 * UI forever. Rejects with a plain Error if the timeout wins.
 */
export function withTimeout(promise, ms = 5000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms),
    ),
  ]);
}
