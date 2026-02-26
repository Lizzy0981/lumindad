/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Hooks · useChunkedUpload
 *  src/hooks/useChunkedUpload.ts
 *
 *  Purpose
 *   Manages the chunked file processing pipeline originally implemented
 *   inline in LumindAd.jsx UploadPage.processData (lines 686–705).
 *   Extracts the logic into a reusable hook that:
 *   – Tracks per-file status / progress / row count
 *   – Reports a unified `done` and `processing` flag
 *   – Supports cancellation of individual files or all files
 *   – Uses ProcessingWorker.ts when available; falls back to setInterval
 *
 *  Original processData logic (LumindAd.jsx lines 686–705)
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ const CHUNK_ROWS = 50000;                                │
 *   │ files.forEach((file, fi) => {                            │
 *   │   const totalRows = Math.floor(Math.random()*900000)+50000│
 *   │   let processed = 0;                                     │
 *   │   const interval = setInterval(() => {                   │
 *   │     processed = Math.min(processed+CHUNK_ROWS, totalRows)│
 *   │     const progress = Math.round(processed/totalRows*100) │
 *   │     setFiles(prev => prev.map(f =>                       │
 *   │       f.id === file.id ?                                 │
 *   │         {...f, status: progress<100?'processing':'done', │
 *   │          progress, rows: ...}                            │
 *   │       : f                                                │
 *   │     ));                                                  │
 *   │     if (progress >= 100) clearInterval(interval);        │
 *   │   }, 200 + fi * 120);         ← stagger per file index   │
 *   │ });                                                       │
 *   │ setTimeout(() => {                                        │
 *   │   setProcessing(false); setDone(true);                   │
 *   │ }, files.length * 800 + 1200);                           │
 *   └──────────────────────────────────────────────────────────┘
 *
 *  What changed (hook vs. inline)
 *   – All state (`files`, `processing`, `done`) moved into the hook
 *   – Accepts a Worker factory fn so callers can inject ProcessingWorker
 *   – Cancellation: `cancel(id)` clears one file's interval/worker
 *   – `cancelAll()` terminates every active job and resets state
 *   – `addFiles()` accepts `FileList | File[]` (same as DropZone)
 *   – `removeFile(id)` is safe even during processing
 *   – Exposes `totalRows` as a derived sum for the Done banner
 *
 *  Chunk size (from LumindAd.jsx line 688)
 *   CHUNK_ROWS = 50,000 rows per tick — exposed as hook option.
 *
 *  Interval stagger (from LumindAd.jsx line 200 + fi * 120)
 *   File 0 → interval 200ms · File 1 → 320ms · File 2 → 440ms …
 *   This prevents all files from updating React state simultaneously,
 *   which would cause a single large reconciliation batch.
 *
 *  Worker integration
 *   If `workerFactory` option is provided, the hook creates one Worker
 *   per file using `new workerFactory()` and communicates via the
 *   WorkerInMessage / WorkerOutMessage protocol from ProcessingWorker.ts.
 *   If not provided or construction fails → falls back to setInterval.
 *
 *  File states lifecycle
 *   ready → processing → done
 *                      ↘ error  (on Worker onerror)
 *   cancel(id)  → status unchanged (file removed from queue)
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { useState, useCallback, useEffect, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
// Re-export so callers don't need to import from FileQueue separately

export type FileStatus = 'ready' | 'processing' | 'done' | 'error';

export interface UploadFileItem {
  id:       string;
  file:     File;
  name:     string;
  size:     number;
  type:     string;      // uppercase extension "CSV", "XLSX" …
  status:   FileStatus;
  progress: number;      // 0–100
  rows:     number | null;
}

/** Function that builds a FileItem from a raw File. */
type FileItemFactory = (f: File) => UploadFileItem;

export interface UseChunkedUploadOptions {
  /**
   * Maximum files allowed in the queue simultaneously.
   * @default 10
   */
  maxFiles?: number;
  /**
   * Rows processed per timer tick (chunk size).
   * @default 50_000  — matches LumindAd.jsx line 688 exactly
   */
  chunkRows?: number;
  /**
   * Factory function that returns a new Worker instance.
   * When provided, uses Web Workers instead of setInterval.
   * @example () => new Worker(new URL('../pages/Upload/ProcessingWorker.ts', import.meta.url), { type: 'module' })
   * @default undefined  — falls back to main-thread setInterval
   */
  workerFactory?: () => Worker;
  /**
   * Called each tick with updated file state.
   * @param file - The updated file item.
   */
  onProgress?: (file: UploadFileItem) => void;
  /**
   * Called when all files have reached 'done' or 'error'.
   * @param files - Final file states.
   */
  onAllDone?: (files: UploadFileItem[]) => void;
}

export interface UseChunkedUploadReturn {
  /** Current file queue. */
  files: UploadFileItem[];
  /** True while at least one file is processing. */
  processing: boolean;
  /** True when all files have been processed (done or error). */
  done: boolean;
  /**
   * Sum of rows across all done files.
   * Mirrors `files.reduce((s,f) => s+(f.rows||0), 0)` in LumindAd.jsx.
   */
  totalRows: number;
  /**
   * Add files to the queue. Respects maxFiles limit.
   * Mirrors `addFiles` in LumindAd.jsx lines 664–675.
   *
   * @example addFiles(event.dataTransfer.files)
   */
  addFiles: (incoming: FileList | File[]) => void;
  /**
   * Remove a file by id (safe during processing — cancels its job).
   * Mirrors `removeFile` in LumindAd.jsx line 680.
   */
  removeFile: (id: string) => void;
  /**
   * Start processing all 'ready' files.
   * Mirrors `processData` in LumindAd.jsx lines 686–705.
   */
  process: () => void;
  /**
   * Cancel a single file's processing job and remove it from the queue.
   * @param id - The file's id.
   */
  cancel: (id: string) => void;
  /**
   * Clear all files and reset state.
   * Mirrors `clearAll` in LumindAd.jsx line 682.
   */
  clearAll: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FILES_DEFAULT  = 10;
const CHUNK_ROWS_DEFAULT = 50_000; // LumindAd.jsx line 688

// ─── FileItem factory ─────────────────────────────────────────────────────────

/** Mirrors the object shape created in LumindAd.jsx lines 667–673. */
const defaultFactory: FileItemFactory = (f) => ({
  id:       Math.random().toString(36).slice(2),
  file:      f,
  name:      f.name,
  size:      f.size,
  type:     (f.name.split('.').pop() ?? 'BIN').toUpperCase(),
  status:   'ready',
  progress:  0,
  rows:      null,
});

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Manages 50K-row chunked file processing with optional Web Worker support.
 * Faithfully reproduces LumindAd.jsx UploadPage.processData behaviour.
 *
 * @param options - Configuration: maxFiles, chunkRows, workerFactory, callbacks.
 *
 * @example
 * // Upload/index.tsx — drop-in replacement for inline state
 * const { files, processing, done, addFiles, removeFile, process, clearAll, totalRows }
 *   = useChunkedUpload({
 *     maxFiles: 10,
 *     workerFactory: () => new Worker(
 *       new URL('./ProcessingWorker.ts', import.meta.url),
 *       { type: 'module' }
 *     ),
 *     onAllDone: (files) => console.log('Pipeline ready', files),
 *   });
 *
 * @example
 * // Minimal — setInterval fallback (no Workers), matches prototype exactly
 * const upload = useChunkedUpload();
 * <DropZone onFilesAdded={upload.addFiles} />
 * <button onClick={upload.process}>▶ Procesar</button>
 *
 * @example
 * // Cancel individual file
 * const { cancel } = useChunkedUpload();
 * <button onClick={() => cancel(fileId)}>Cancel</button>
 */
export function useChunkedUpload(
  options: UseChunkedUploadOptions = {},
): UseChunkedUploadReturn {
  const {
    maxFiles      = MAX_FILES_DEFAULT,
    chunkRows     = CHUNK_ROWS_DEFAULT,
    workerFactory,
    onProgress,
    onAllDone,
  } = options;

  const [files,      setFiles]      = useState<UploadFileItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [done,       setDone]       = useState(false);

  // Job handles: interval ids or Worker instances, keyed by fileId
  const intervalHandles = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const workerHandles   = useRef<Map<string, Worker>>(new Map());
  const doneCountRef    = useRef(0);
  const totalCountRef   = useRef(0);

  // ── Cleanup on unmount ─────────────────────────────────────────────────
  useEffect(() => {
    const intervals = intervalHandles.current;
    const workers   = workerHandles.current;
    return () => {
      intervals.forEach(clearInterval);
      intervals.clear();
      workers.forEach((w) => w.terminate());
      workers.clear();
    };
  }, []);

  // ── addFiles ───────────────────────────────────────────────────────────
  // Mirrors LumindAd.jsx lines 664–675 exactly
  const addFiles = useCallback((incoming: FileList | File[]) => {
    setFiles((prev) => {
      const available = maxFiles - prev.length;
      if (available <= 0) return prev;
      const newItems = Array.from(incoming)
        .slice(0, available)
        .map(defaultFactory);
      return [...prev, ...newItems];
    });
    setDone(false);
  }, [maxFiles]);

  // ── cancel (single file) ───────────────────────────────────────────────
  const cancel = useCallback((id: string) => {
    const iid = intervalHandles.current.get(id);
    if (iid !== undefined) { clearInterval(iid); intervalHandles.current.delete(id); }

    const w = workerHandles.current.get(id);
    if (w) {
      try { w.postMessage({ type: 'CANCEL', payload: { fileId: id } }); } catch { /* ignore */ }
      w.terminate();
      workerHandles.current.delete(id);
    }

    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // ── clearAll ───────────────────────────────────────────────────────────
  const clearAll = useCallback(() => {
    intervalHandles.current.forEach(clearInterval);
    intervalHandles.current.clear();
    workerHandles.current.forEach((w) => w.terminate());
    workerHandles.current.clear();
    setFiles([]);
    setProcessing(false);
    setDone(false);
    doneCountRef.current  = 0;
    totalCountRef.current = 0;
  }, []);

  // ── removeFile ─────────────────────────────────────────────────────────
  const removeFile = useCallback((id: string) => {
    cancel(id);
  }, [cancel]);

  // ── Internal: mark a file complete ─────────────────────────────────────
  const markDone = useCallback((
    id:        string,
    totalRows: number,
    currentFiles: UploadFileItem[],
  ) => {
    setFiles((prev) => {
      const updated = prev.map((f) =>
        f.id === id ? { ...f, status: 'done' as const, progress: 100, rows: totalRows } : f,
      );

      doneCountRef.current++;
      if (doneCountRef.current >= totalCountRef.current) {
        setProcessing(false);
        setDone(true);
        onAllDone?.(updated);
      }

      return updated;
    });
    // Suppress unused param warning — `currentFiles` reserved for future resume logic
    void currentFiles;
  }, [onAllDone]);

  // ── process ────────────────────────────────────────────────────────────
  // Core logic mirrors LumindAd.jsx lines 686–705 exactly
  const process = useCallback(() => {
    setFiles((currentFiles) => {
      const readyFiles = currentFiles.filter((f) => f.status === 'ready');
      if (!readyFiles.length || processing) return currentFiles;

      setProcessing(true);
      setDone(false);
      doneCountRef.current  = 0;
      totalCountRef.current = readyFiles.length;

      readyFiles.forEach((file, fi) => {
        let workerStarted = false;

        // ── Try Worker ────────────────────────────────────────────────
        if (workerFactory) {
          try {
            const w = workerFactory();
            workerHandles.current.set(file.id, w);
            workerStarted = true;

            w.postMessage({
              type:    'START',
              payload: { fileId: file.id, fileIndex: fi, fileName: file.name, fileSize: file.size },
            });

            w.onmessage = (e: MessageEvent) => {
              const { type, payload } = e.data;

              if (type === 'PROGRESS') {
                setFiles((prev) => {
                  const updated = prev.map((f) =>
                    f.id === payload.fileId
                      ? { ...f, status: 'processing' as const, progress: payload.progress, rows: payload.rowsProcessed }
                      : f,
                  );
                  const item = updated.find((f) => f.id === payload.fileId);
                  if (item) onProgress?.(item);
                  return updated;
                });
              }

              if (type === 'DONE') {
                w.terminate();
                workerHandles.current.delete(payload.fileId);
                markDone(payload.fileId, payload.totalRows, currentFiles);
              }
            };

            w.onerror = () => {
              w.terminate();
              workerHandles.current.delete(file.id);
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === file.id ? { ...f, status: 'error' as const } : f,
                ),
              );
              doneCountRef.current++;
              if (doneCountRef.current >= totalCountRef.current) setProcessing(false);
            };
          } catch {
            workerStarted = false;
          }
        }

        // ── Fallback: setInterval (LumindAd.jsx lines 690–703) ────────
        if (!workerStarted) {
          // totalRows = Math.floor(Math.random() * 900000) + 50000
          const totalRows = Math.floor(Math.random() * 900_000) + 50_000;
          let   processed = 0;

          // Interval stagger: 200 + fi * 120 — matches LumindAd.jsx line 694
          const intervalMs = 200 + fi * 120;

          const iid = setInterval(() => {
            processed = Math.min(processed + chunkRows, totalRows);
            const progress = Math.round((processed / totalRows) * 100);
            const isDone   = progress >= 100;

            setFiles((prev) => {
              const updated = prev.map((f) =>
                f.id === file.id
                  ? {
                      ...f,
                      status:   isDone ? 'done' as const : 'processing' as const,
                      progress: isDone ? 100 : progress,
                      rows:     isDone ? totalRows : processed,
                    }
                  : f,
              );
              const item = updated.find((f) => f.id === file.id);
              if (item) onProgress?.(item);
              return updated;
            });

            if (isDone) {
              clearInterval(iid);
              intervalHandles.current.delete(file.id);
              markDone(file.id, totalRows, currentFiles);
            }
          }, intervalMs);

          intervalHandles.current.set(file.id, iid);
        }
      });

      return currentFiles;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processing, chunkRows, workerFactory, onProgress, markDone]);

  // ── totalRows ──────────────────────────────────────────────────────────
  const totalRows = files.reduce((s, f) => s + (f.rows ?? 0), 0);

  return { files, processing, done, totalRows, addFiles, removeFile, process, cancel, clearAll };
}

export default useChunkedUpload;
