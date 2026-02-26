/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Hooks · useOfflineCache
 *  src/hooks/useOfflineCache.ts
 *
 *  Purpose
 *   Persistent client-side cache backed by IndexedDB with per-entry
 *   TTL expiration and LRU eviction. Designed for caching dashboard
 *   API responses (campaigns, analytics, budget) so that the app
 *   remains usable when offline or when the network is slow.
 *
 *  Why IndexedDB (not localStorage)?
 *   – Async API — never blocks the main thread
 *   – Stores binary/structured data (File, Blob, ArrayBuffer)
 *   – Capacity: 50MB–GB per origin (vs. ~5MB for localStorage)
 *   – Available in Web Workers (required by ProcessingWorker.ts)
 *   LumindAd processes files up to 2GB — IndexedDB is the only
 *   viable storage layer for partial results and parsed row caches.
 *
 *  Database schema
 *   DB name     : "lumindad_cache_v1"
 *   Object store: "entries"
 *   Key path    : "cacheKey"  (composite: `${namespace}:${key}`)
 *   Indexes     : "accessedAt" (for LRU eviction)
 *                 "expiresAt"  (for TTL sweep)
 *   Record shape:
 *     { cacheKey, value, createdAt, expiresAt, accessedAt, namespace }
 *
 *  TTL strategy
 *   Each set() call accepts a `ttl` in milliseconds.
 *   get() returns null and deletes the entry if Date.now() > expiresAt.
 *   A sweep() removes ALL expired entries (called on hook mount).
 *
 *  LRU eviction
 *   When the store exceeds `maxEntries` records, evict() deletes the
 *   N oldest entries by `accessedAt` index using an IDBIndex cursor.
 *   `maxEntries` default: 200 (configurable per hook instance).
 *
 *  Sync flag
 *   `synced` state is true when the entry is confirmed written to IDB.
 *   During the async write window `synced` is false — consumers can
 *   show a subtle "saving…" indicator if needed.
 *   Relevant for LumindAd upload flow: progress checkpoints are written
 *   to IDB so a page refresh can resume chunked processing.
 *
 *  Fallback (IDB unavailable)
 *   If IndexedDB is not available (some private browsing modes, unit
 *   test environments without jsdom IDB shim), the hook falls back to
 *   a plain Map<string, {value, expiresAt}>. TTL is still honoured;
 *   LRU eviction is disabled. `idbAvailable` flag exposed for UI hints.
 *
 *  Namespaces (built-in presets)
 *   'campaigns'   — campaign list + per-campaign detail (TTL 5 min)
 *   'analytics'   — weekly analytics data (TTL 10 min)
 *   'budget'      — budget allocations (TTL 5 min)
 *   'upload'      — chunked upload progress checkpoints (TTL 24 h)
 *   'ml_models'   — ML model metadata (TTL 30 min)
 *   Any string is also valid as a namespace.
 *
 *  LumindAd integration points
 *   Dashboard  → useOfflineCache('campaigns', { ttl: 5_min })
 *   Analytics  → useOfflineCache('analytics', { ttl: 10_min })
 *   Upload     → useOfflineCache('upload',    { ttl: 24_h }) for resume
 *   CreateAd   → useOfflineCache('ml_models', { ttl: 30_min })
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────

const DB_NAME    = 'lumindad_cache_v1';
const DB_VERSION = 1;
const STORE_NAME = 'entries';

/** Built-in TTL presets in milliseconds */
export const TTL = {
  ONE_MINUTE:  60_000,
  FIVE_MIN:    300_000,
  TEN_MIN:     600_000,
  THIRTY_MIN:  1_800_000,
  ONE_HOUR:    3_600_000,
  SIX_HOURS:   21_600_000,
  ONE_DAY:     86_400_000,
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type CacheNamespace =
  | 'campaigns' | 'analytics' | 'budget' | 'upload' | 'ml_models' | string;

export interface CacheEntry<T = unknown> {
  cacheKey:   string;
  value:       T;
  createdAt:   number;
  expiresAt:   number;
  accessedAt:  number;
  namespace:   string;
}

export interface UseOfflineCacheOptions {
  /**
   * Default TTL for set() calls that don't specify their own.
   * @default TTL.FIVE_MIN
   */
  ttl?: number;
  /**
   * Maximum number of entries in the store before LRU eviction fires.
   * @default 200
   */
  maxEntries?: number;
  /**
   * Whether to sweep expired entries on mount.
   * @default true
   */
  sweepOnMount?: boolean;
}

export interface UseOfflineCacheReturn<T = unknown> {
  /**
   * Retrieve a cached value by key.
   * Returns null if missing or expired (expired entry is also deleted).
   *
   * @example
   * const campaigns = await get<Campaign[]>('list');
   */
  get: (key: string) => Promise<T | null>;

  /**
   * Store a value with optional per-entry TTL override.
   * Sets `synced = false` during the async write, `true` on completion.
   *
   * @example
   * await set('list', campaigns, TTL.TEN_MIN);
   */
  set: (key: string, value: T, ttlOverride?: number) => Promise<void>;

  /**
   * Delete a specific key from the cache.
   * @example await remove('list');
   */
  remove: (key: string) => Promise<void>;

  /**
   * Delete all entries in this namespace.
   * @example await clear();
   */
  clear: () => Promise<void>;

  /**
   * Delete all expired entries across all namespaces.
   * Called automatically on mount when `sweepOnMount: true`.
   */
  sweep: () => Promise<void>;

  /** True when the last set() operation has completed writing to IDB. */
  synced: boolean;

  /** True when IndexedDB is available. False → in-memory Map fallback active. */
  idbAvailable: boolean;

  /** True while the DB is being opened on first mount. */
  loading: boolean;
}

// ─── IDB helpers ──────────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db    = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'cacheKey' });
        store.createIndex('accessedAt', 'accessedAt', { unique: false });
        store.createIndex('expiresAt',  'expiresAt',  { unique: false });
        store.createIndex('namespace',  'namespace',  { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function idbGet<T>(db: IDBDatabase, cacheKey: string): Promise<CacheEntry<T> | undefined> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(cacheKey);
    req.onsuccess = () => resolve(req.result as CacheEntry<T> | undefined);
    req.onerror   = () => reject(req.error);
  });
}

function idbPut<T>(db: IDBDatabase, entry: CacheEntry<T>): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(entry);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

function idbDelete(db: IDBDatabase, cacheKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(cacheKey);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

function idbCount(db: IDBDatabase): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/** Delete oldest N entries by accessedAt index (LRU eviction). */
function idbEvict(db: IDBDatabase, count: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx      = db.transaction(STORE_NAME, 'readwrite');
    const index   = tx.objectStore(STORE_NAME).index('accessedAt');
    const req     = index.openCursor(null, 'next'); // oldest first
    let   deleted = 0;

    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor && deleted < count) {
        cursor.delete();
        deleted++;
        cursor.continue();
      } else {
        resolve();
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/** Delete all entries where expiresAt < now. */
function idbSweepExpired(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const now   = Date.now();
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const range = IDBKeyRange.upperBound(now, false);
    const req   = tx.objectStore(STORE_NAME).index('expiresAt').openCursor(range);

    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/** Delete all entries for a given namespace. */
function idbClearNamespace(db: IDBDatabase, namespace: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME)
                  .index('namespace')
                  .openCursor(IDBKeyRange.only(namespace));

    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) { cursor.delete(); cursor.continue(); }
      else resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Persistent IndexedDB cache with TTL expiration and LRU eviction.
 *
 * @param namespace - Logical group for keys (e.g. 'campaigns', 'analytics').
 * @param options   - TTL, maxEntries, sweepOnMount.
 *
 * @example
 * // Dashboard — cache campaign list for 5 minutes
 * const cache = useOfflineCache<Campaign[]>('campaigns', { ttl: TTL.FIVE_MIN });
 * useEffect(() => {
 *   cache.get('list').then(cached => {
 *     if (cached) { setData(cached); return; }
 *     fetch('/api/campaigns').then(r => r.json()).then(data => {
 *       setData(data);
 *       cache.set('list', data);
 *     });
 *   });
 * }, []);
 *
 * @example
 * // Upload — save chunked upload progress for resume
 * const cache = useOfflineCache('upload', { ttl: TTL.ONE_DAY });
 * await cache.set(`file:${fileId}`, { progress: 67, rows: 335_000 });
 * // On next page load:
 * const checkpoint = await cache.get<UploadCheckpoint>(`file:${fileId}`);
 * if (checkpoint) resumeFrom(checkpoint.rows);
 *
 * @example
 * // Synced indicator
 * const { set, synced } = useOfflineCache('analytics');
 * await set('weekly', data);
 * if (!synced) showSpinner();
 */
export function useOfflineCache<T = unknown>(
  namespace: CacheNamespace,
  options:   UseOfflineCacheOptions = {},
): UseOfflineCacheReturn<T> {
  const {
    ttl          = TTL.FIVE_MIN,
    maxEntries   = 200,
    sweepOnMount = true,
  } = options;

  const [synced,       setSynced]       = useState(true);
  const [idbAvailable, setIdbAvailable] = useState(true);
  const [loading,      setLoading]      = useState(true);

  const dbRef        = useRef<IDBDatabase | null>(null);
  const fallbackMap  = useRef<Map<string, { value: T; expiresAt: number }>>(new Map());

  // ── DB init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const db = await openDB();
        if (cancelled) { db.close(); return; }
        dbRef.current = db;
        setIdbAvailable(true);

        if (sweepOnMount) {
          await idbSweepExpired(db);
        }
      } catch {
        setIdbAvailable(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      dbRef.current?.close();
      dbRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── compositeKey ─────────────────────────────────────────────────────────
  const compositeKey = useCallback(
    (key: string) => `${namespace}:${key}`,
    [namespace],
  );

  // ── get ──────────────────────────────────────────────────────────────────
  const get = useCallback(async (key: string): Promise<T | null> => {
    const ck  = compositeKey(key);
    const now = Date.now();

    if (dbRef.current) {
      const entry = await idbGet<T>(dbRef.current, ck);
      if (!entry) return null;
      if (now > entry.expiresAt) {
        await idbDelete(dbRef.current, ck);
        return null;
      }
      // Update accessedAt for LRU tracking
      await idbPut(dbRef.current, { ...entry, accessedAt: now });
      return entry.value;
    }

    // Fallback
    const fb = fallbackMap.current.get(ck);
    if (!fb) return null;
    if (now > fb.expiresAt) { fallbackMap.current.delete(ck); return null; }
    return fb.value;
  }, [compositeKey]);

  // ── set ──────────────────────────────────────────────────────────────────
  const set = useCallback(async (
    key:         string,
    value:       T,
    ttlOverride?: number,
  ): Promise<void> => {
    const ck    = compositeKey(key);
    const now   = Date.now();
    const entry: CacheEntry<T> = {
      cacheKey:   ck,
      value,
      createdAt:  now,
      expiresAt:  now + (ttlOverride ?? ttl),
      accessedAt: now,
      namespace,
    };

    setSynced(false);

    if (dbRef.current) {
      try {
        await idbPut(dbRef.current, entry);

        // LRU eviction — keep store under maxEntries
        const count = await idbCount(dbRef.current);
        if (count > maxEntries) {
          await idbEvict(dbRef.current, count - maxEntries);
        }
      } finally {
        setSynced(true);
      }
    } else {
      fallbackMap.current.set(ck, { value, expiresAt: entry.expiresAt });
      setSynced(true);
    }
  }, [compositeKey, namespace, ttl, maxEntries]);

  // ── remove ───────────────────────────────────────────────────────────────
  const remove = useCallback(async (key: string): Promise<void> => {
    const ck = compositeKey(key);
    if (dbRef.current) await idbDelete(dbRef.current, ck);
    else fallbackMap.current.delete(ck);
  }, [compositeKey]);

  // ── clear ────────────────────────────────────────────────────────────────
  const clear = useCallback(async (): Promise<void> => {
    if (dbRef.current) {
      await idbClearNamespace(dbRef.current, namespace);
    } else {
      const prefix = `${namespace}:`;
      for (const k of fallbackMap.current.keys()) {
        if (k.startsWith(prefix)) fallbackMap.current.delete(k);
      }
    }
  }, [namespace]);

  // ── sweep ────────────────────────────────────────────────────────────────
  const sweep = useCallback(async (): Promise<void> => {
    if (dbRef.current) {
      await idbSweepExpired(dbRef.current);
    } else {
      const now = Date.now();
      for (const [k, v] of fallbackMap.current) {
        if (now > v.expiresAt) fallbackMap.current.delete(k);
      }
    }
  }, []);

  return { get, set, remove, clear, sweep, synced, idbAvailable, loading };
}

export default useOfflineCache;
