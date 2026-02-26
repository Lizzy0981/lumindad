/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · utils/offlineCache.ts
 *  src/utils/offlineCache.ts
 *
 *  Purpose
 *   Standalone (no React) IndexedDB cache layer with per-entry
 *   TTL expiration and LRU eviction. Designed for use in:
 *     • Services (campaignService, analyticsStore): cache API responses
 *     • Workers: store parsed row chunks for upload resumption
 *     • Background sync: queue writes when offline
 *
 *  Relationship to hooks/useOfflineCache.ts
 *   useOfflineCache.ts is the React hook wrapper that exposes this
 *   module as reactive state (useState + useEffect). This file is
 *   the pure async utility layer underneath — it can be called
 *   from ANY context (worker, service, store, component).
 *
 *  Database schema
 *   DB name     : "lumindad_cache_v1"
 *   Object store: "entries"
 *   Key path    : "cacheKey"  (format: `${namespace}:${key}`)
 *   Indexes     : "accessedAt"   (LRU eviction cursor)
 *                 "expiresAt"    (TTL sweep)
 *                 "namespace"    (bulk namespace clear)
 *
 *  TTL presets (ms)
 *   CAMPAIGN_TTL  = 5 min  — campaign list / per-campaign detail
 *   ANALYTICS_TTL = 10 min — weekly performance charts
 *   BUDGET_TTL    = 5 min  — budget allocations
 *   UPLOAD_TTL    = 24 h   — chunked upload progress checkpoints
 *   ML_TTL        = 30 min — ML model metadata
 *
 *  API
 *   get<T>(namespace, key)           → T | null
 *   set<T>(namespace, key, value, ttlMs) → void
 *   remove(namespace, key)           → void
 *   clear(namespace?)                → void  (namespace or all)
 *   sweep()                          → number (deleted count)
 *   evictLRU(maxEntries)             → number (deleted count)
 *   keys(namespace)                  → string[]
 *   has(namespace, key)              → boolean
 *
 *  Fallback
 *   If IndexedDB is unavailable (private mode, worker environments
 *   without IDB access), falls back to an in-memory Map with the
 *   same TTL semantics. The `idbAvailable` export reveals which
 *   backend is active so callers can display offline-mode warnings.
 *
 *  Usage
 *   import { offlineCache, TTL } from '@/utils/offlineCache';
 *
 *   // In a service:
 *   const cached = await offlineCache.get<Campaign[]>('campaigns', 'list');
 *   if (!cached) {
 *     const data = await api.get('/campaigns');
 *     await offlineCache.set('campaigns', 'list', data, TTL.CAMPAIGN);
 *   }
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ─── Database constants ───────────────────────────────────────────────────────

const DB_NAME    = 'lumindad_cache_v1';
const DB_VERSION = 1;
const STORE      = 'entries';

// ─── TTL presets ──────────────────────────────────────────────────────────────

/**
 * Built-in TTL presets aligned with LumindAd documentation section 4:
 * "Redis 7.2 — API cache (5min TTL)"
 */
export const TTL = {
  ONE_MINUTE:  60_000,
  CAMPAIGN:    300_000,    //  5 min — campaign list + detail
  ANALYTICS:   600_000,   // 10 min — weekly charts
  BUDGET:      300_000,   //  5 min — budget allocations
  ML_MODELS:   1_800_000, // 30 min — ML metadata
  UPLOAD:      86_400_000,// 24 h   — chunked upload checkpoints
  SIX_HOURS:   21_600_000,//  6 h   — general heavy data
} as const;

export type TTLPreset = (typeof TTL)[keyof typeof TTL];

// ─── Cache namespaces ─────────────────────────────────────────────────────────

export type CacheNamespace =
  | 'campaigns'
  | 'analytics'
  | 'budget'
  | 'upload'
  | 'ml_models'
  | string;

// ─── Entry shape ──────────────────────────────────────────────────────────────

interface CacheEntry<T = unknown> {
  cacheKey:   string;   // namespace:key
  value:      T;
  createdAt:  number;   // unix ms
  expiresAt:  number;   // unix ms
  accessedAt: number;   // unix ms — updated on get()
  namespace:  string;
}

// ─── IDB initialisation ───────────────────────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db    = (e.target as IDBOpenDBRequest).result;
      const store = db.createObjectStore(STORE, { keyPath: 'cacheKey' });
      store.createIndex('accessedAt', 'accessedAt', { unique: false });
      store.createIndex('expiresAt',  'expiresAt',  { unique: false });
      store.createIndex('namespace',  'namespace',  { unique: false });
    };

    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror   = (e) => reject((e.target as IDBOpenDBRequest).error);
  });

  return dbPromise;
}

// ─── IDB availability detection ───────────────────────────────────────────────

let _idbAvailable: boolean | null = null;

async function checkIDB(): Promise<boolean> {
  if (_idbAvailable !== null) return _idbAvailable;
  try {
    if (typeof indexedDB === 'undefined') { _idbAvailable = false; return false; }
    await openDB();
    _idbAvailable = true;
  } catch {
    _idbAvailable = false;
    dbPromise = null;
  }
  return _idbAvailable;
}

/** True when IndexedDB is available and the DB opened successfully. */
export let idbAvailable = false;
checkIDB().then(ok => { idbAvailable = ok; });

// ─── In-memory fallback ───────────────────────────────────────────────────────

type FallbackEntry = { value: unknown; expiresAt: number; accessedAt: number };
const memCache = new Map<string, FallbackEntry>();

// ─── Helper: compose / decompose key ─────────────────────────────────────────

function makeKey(namespace: string, key: string): string {
  return `${namespace}:${key}`;
}

// ─── IDB transaction helpers ─────────────────────────────────────────────────

async function idbGet<T>(cacheKey: string): Promise<CacheEntry<T> | null> {
  const db  = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(cacheKey);
    req.onsuccess = () => resolve(req.result as CacheEntry<T> | null);
    req.onerror   = () => reject(req.error);
  });
}

async function idbPut<T>(entry: CacheEntry<T>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).put(entry);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

async function idbDelete(cacheKey: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(cacheKey);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ─── Core API ─────────────────────────────────────────────────────────────────

/**
 * Retrieve a cached value.
 * Returns null if the entry does not exist or has expired.
 * Updates `accessedAt` on a successful hit (for LRU tracking).
 *
 * @example
 * const campaigns = await offlineCache.get<Campaign[]>('campaigns', 'list');
 */
async function get<T>(namespace: CacheNamespace, key: string): Promise<T | null> {
  const cacheKey = makeKey(namespace, key);
  const now      = Date.now();

  // ── IDB path ──────────────────────────────────────────────────────────────
  if (await checkIDB()) {
    try {
      const entry = await idbGet<T>(cacheKey);
      if (!entry) return null;
      if (entry.expiresAt < now) {
        await idbDelete(cacheKey);
        return null;
      }
      // Update accessedAt for LRU
      await idbPut({ ...entry, accessedAt: now });
      return entry.value;
    } catch {
      // Fall through to memory cache
    }
  }

  // ── Memory fallback ───────────────────────────────────────────────────────
  const mem = memCache.get(cacheKey);
  if (!mem || mem.expiresAt < now) {
    memCache.delete(cacheKey);
    return null;
  }
  mem.accessedAt = now;
  return mem.value as T;
}

/**
 * Store a value with a TTL.
 *
 * @example
 * await offlineCache.set('campaigns', 'list', data, TTL.CAMPAIGN);
 * await offlineCache.set('upload', fileId, progress, TTL.UPLOAD);
 */
async function set<T>(
  namespace: CacheNamespace,
  key:       string,
  value:     T,
  ttlMs:     number = TTL.CAMPAIGN,
): Promise<void> {
  const cacheKey  = makeKey(namespace, key);
  const now       = Date.now();
  const expiresAt = now + ttlMs;

  // ── IDB path ──────────────────────────────────────────────────────────────
  if (await checkIDB()) {
    try {
      await idbPut<T>({
        cacheKey,
        value,
        createdAt:  now,
        expiresAt,
        accessedAt: now,
        namespace,
      });
      return;
    } catch {
      // Fall through to memory
    }
  }

  // ── Memory fallback ───────────────────────────────────────────────────────
  memCache.set(cacheKey, { value, expiresAt, accessedAt: now });
}

/**
 * Remove a single entry.
 *
 * @example
 * await offlineCache.remove('campaigns', 'C-001');
 */
async function remove(namespace: CacheNamespace, key: string): Promise<void> {
  const cacheKey = makeKey(namespace, key);

  if (await checkIDB()) {
    try {
      await idbDelete(cacheKey);
      return;
    } catch { /* fall through */ }
  }

  memCache.delete(cacheKey);
}

/**
 * Clear all entries in a namespace, or all entries if no namespace given.
 *
 * @example
 * await offlineCache.clear('campaigns');  // clear only campaigns
 * await offlineCache.clear();             // wipe everything
 */
async function clear(namespace?: CacheNamespace): Promise<void> {
  if (await checkIDB()) {
    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx    = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);

        if (!namespace) {
          // Clear all
          const req = store.clear();
          req.onsuccess = () => resolve();
          req.onerror   = () => reject(req.error);
        } else {
          // Delete by namespace index
          const idx  = store.index('namespace');
          const req  = idx.openCursor(IDBKeyRange.only(namespace));
          req.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
              cursor.delete();
              cursor.continue();
            } else {
              resolve();
            }
          };
          req.onerror = () => reject(req.error);
        }
      });
      return;
    } catch { /* fall through */ }
  }

  // Memory fallback
  if (!namespace) {
    memCache.clear();
  } else {
    const prefix = `${namespace}:`;
    for (const k of memCache.keys()) {
      if (k.startsWith(prefix)) memCache.delete(k);
    }
  }
}

/**
 * Sweep all expired entries from the cache.
 * Call on app startup to reclaim space.
 * Returns the number of entries deleted.
 *
 * @example
 * const deleted = await offlineCache.sweep();
 * console.log(`Swept ${deleted} expired entries`);
 */
async function sweep(): Promise<number> {
  let deleted = 0;
  const now   = Date.now();

  if (await checkIDB()) {
    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx    = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const idx   = store.index('expiresAt');
        // Open cursor over all entries with expiresAt < now
        const range = IDBKeyRange.upperBound(now, false);
        const req   = idx.openCursor(range);
        req.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            cursor.delete();
            deleted++;
            cursor.continue();
          } else {
            resolve();
          }
        };
        req.onerror = () => reject(req.error);
      });
      return deleted;
    } catch { /* fall through */ }
  }

  // Memory fallback
  for (const [k, v] of memCache.entries()) {
    if (v.expiresAt < now) { memCache.delete(k); deleted++; }
  }
  return deleted;
}

/**
 * LRU eviction — delete the N least-recently-accessed entries
 * when the store size exceeds `maxEntries`.
 * Returns the number of entries deleted.
 *
 * @example
 * await offlineCache.evictLRU(200);  // keep at most 200 entries
 */
async function evictLRU(maxEntries: number): Promise<number> {
  let deleted = 0;

  if (await checkIDB()) {
    try {
      const db = await openDB();
      // Count entries
      const count = await new Promise<number>((resolve, reject) => {
        const tx  = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).count();
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => reject(req.error);
      });

      if (count <= maxEntries) return 0;

      const toDelete = count - maxEntries;

      await new Promise<void>((resolve, reject) => {
        const tx    = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const idx   = store.index('accessedAt');
        const req   = idx.openCursor(); // ascending = oldest first

        let n = 0;
        req.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor && n < toDelete) {
            cursor.delete();
            n++; deleted++;
            cursor.continue();
          } else {
            resolve();
          }
        };
        req.onerror = () => reject(req.error);
      });
      return deleted;
    } catch { /* fall through */ }
  }

  // Memory fallback — evict oldest by accessedAt
  const entries = [...memCache.entries()]
    .sort((a, b) => a[1].accessedAt - b[1].accessedAt);
  const toRemove = Math.max(0, entries.length - maxEntries);
  for (let i = 0; i < toRemove; i++) {
    memCache.delete(entries[i][0]);
    deleted++;
  }
  return deleted;
}

/**
 * List all keys in a namespace.
 *
 * @example
 * const keys = await offlineCache.keys('upload');
 * // → ['upload:file-abc', 'upload:file-xyz']
 */
async function keys(namespace: CacheNamespace): Promise<string[]> {
  const prefix = `${namespace}:`;

  if (await checkIDB()) {
    try {
      const db = await openDB();
      return new Promise<string[]>((resolve, reject) => {
        const tx  = db.transaction(STORE, 'readonly');
        const idx = tx.objectStore(STORE).index('namespace');
        const req = idx.getAllKeys(IDBKeyRange.only(namespace));
        req.onsuccess = () => {
          resolve((req.result as string[]).map(k => k.replace(prefix, '')));
        };
        req.onerror = () => reject(req.error);
      });
    } catch { /* fall through */ }
  }

  return [...memCache.keys()]
    .filter(k => k.startsWith(prefix))
    .map(k => k.replace(prefix, ''));
}

/**
 * Check if a key exists and is not expired.
 *
 * @example
 * if (await offlineCache.has('campaigns', 'list')) {
 *   // serve from cache
 * }
 */
async function has(namespace: CacheNamespace, key: string): Promise<boolean> {
  const value = await get(namespace, key);
  return value !== null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Singleton cache object — import once, use everywhere.
 *
 * @example
 * import { offlineCache, TTL } from '@/utils/offlineCache';
 *
 * const data = await offlineCache.get<Campaign[]>('campaigns', 'list');
 * await offlineCache.set('campaigns', 'list', data, TTL.CAMPAIGN);
 * await offlineCache.clear('campaigns');
 * await offlineCache.sweep();
 */
export const offlineCache = {
  get,
  set,
  remove,
  clear,
  sweep,
  evictLRU,
  keys,
  has,
} as const;

export default offlineCache;
