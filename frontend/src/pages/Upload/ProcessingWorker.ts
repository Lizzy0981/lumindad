/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Upload · ProcessingWorker
 *  src/pages/Upload/ProcessingWorker.ts
 *
 *  Purpose
 *   Web Worker script that simulates chunked file processing on a
 *   background thread, keeping the main UI thread fully responsive
 *   even when processing files up to 10M rows.
 *
 *  Why a Web Worker?
 *   The LumindAd.jsx prototype uses setInterval on the main thread
 *   (line 692). This works for simulation but blocks React renders
 *   when chunk sizes are large. Moving the timer into a Worker means:
 *   – Progress updates arrive via postMessage (no RAF contention)
 *   – The UI never freezes during "processing"
 *   – Multiple files can be processed concurrently in separate Workers
 *
 *  Message protocol
 *   ─── Main → Worker (start) ──────────────────────────────────
 *   { type: 'START', payload: { fileId, fileIndex, fileName, fileSize } }
 *     fileId    : unique string id for the file (matches FileItem.id)
 *     fileIndex : 0-based index (used for interval stagger: 200 + fi*120)
 *     fileName  : used for logging only
 *     fileSize  : used for totalRows estimation heuristic
 *
 *   ─── Worker → Main (progress) ───────────────────────────────
 *   { type: 'PROGRESS', payload: { fileId, progress, rowsProcessed, totalRows } }
 *     progress      : integer 0–100
 *     rowsProcessed : rows processed so far (≤ totalRows)
 *     totalRows     : total rows for this file (stable after START)
 *
 *   ─── Worker → Main (done) ───────────────────────────────────
 *   { type: 'DONE', payload: { fileId, totalRows } }
 *
 *   ─── Main → Worker (cancel) ─────────────────────────────────
 *   { type: 'CANCEL', payload: { fileId } }
 *   Worker clears the interval and stops sending messages.
 *
 *  Chunked processing simulation (mirrors LumindAd.jsx lines 692–706)
 *   CHUNK_ROWS = 50,000            — rows processed per tick
 *   totalRows  = random 50K–950K  — matches Math.random()*900000 + 50000
 *   interval   = 200 + fi * 120   — stagger per file index (fi)
 *   On each tick: processed += CHUNK_ROWS (capped at totalRows)
 *   progress = Math.round(processed / totalRows * 100)
 *   When progress >= 100: clearInterval → postMessage DONE
 *
 *  Real-world extension
 *   Replace the simulated interval with actual parsing:
 *     case 'CSV':   use papaparse Worker-compatible build
 *     case 'XLSX':  use SheetJS streaming read in chunks
 *     case 'JSON':  use oboe.js streaming parser
 *     case 'Parquet': use parquet-wasm (WebAssembly)
 *   The message protocol remains identical regardless of parser.
 *
 *  Instantiation (from ProcessingWorker.ts as a module worker)
 *   const worker = new Worker(
 *     new URL('./ProcessingWorker.ts', import.meta.url),
 *     { type: 'module' }
 *   );
 *   Vite handles the bundling of the worker file automatically.
 *
 *  Vite worker asset note
 *   Vite ≥ 4.x resolves `new URL('./file', import.meta.url)` at build
 *   time and emits a hashed worker bundle. No vite.config.ts changes needed.
 *   The worker shares no state with the main bundle — all comms via messages.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ─── Message types ────────────────────────────────────────────────────────────
// Shared between main thread (typed import) and worker (self.onmessage)

/**
 * Union of all messages the main thread can send to the worker.
 * @example
 * worker.postMessage({ type: 'START', payload: { fileId: 'abc', fileIndex: 0, fileName: 'data.csv', fileSize: 1_400_000 } });
 * worker.postMessage({ type: 'CANCEL', payload: { fileId: 'abc' } });
 */
export type WorkerInMessage =
  | { type: 'START';  payload: StartPayload  }
  | { type: 'CANCEL'; payload: CancelPayload };

/**
 * Union of all messages the worker sends back to the main thread.
 * @example
 * worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
 *   if (e.data.type === 'PROGRESS') updateFileProgress(e.data.payload);
 *   if (e.data.type === 'DONE')     markFileDone(e.data.payload);
 * };
 */
export type WorkerOutMessage =
  | { type: 'PROGRESS'; payload: ProgressPayload }
  | { type: 'DONE';     payload: DonePayload     };

/**
 * Payload for the START message.
 * @param fileId    Unique string id matching FileItem.id in the UI.
 * @param fileIndex 0-based index — stagger interval = 200 + fileIndex * 120 ms.
 * @param fileName  Display name, used for logging only.
 * @param fileSize  Bytes — available for future totalRows heuristic.
 */
export interface StartPayload {
  fileId:    string;
  fileIndex: number;
  fileName:  string;
  fileSize:  number;
}

export interface CancelPayload {
  fileId: string;
}

export interface ProgressPayload {
  fileId:        string;
  progress:      number;   // 0–100 integer
  rowsProcessed: number;
  totalRows:     number;
}

export interface DonePayload {
  fileId:    string;
  totalRows: number;
}

// ─── Worker implementation ────────────────────────────────────────────────────
// TypeScript detects this is a Worker context via `self` (DedicatedWorkerGlobalScope).

const CHUNK_ROWS = 50_000;   // mirrors LumindAd.jsx line 691

// Active intervals keyed by fileId — allows cancellation
const activeIntervals = new Map<string, ReturnType<typeof setInterval>>();

self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const { type, payload } = event.data;

  // ── START ──────────────────────────────────────────────────────────────────
  if (type === 'START') {
    const { fileId, fileIndex, } = payload as StartPayload;

    // Simulate: totalRows = Math.floor(Math.random() * 900000) + 50000
    // Matches LumindAd.jsx line 693 exactly
    const totalRows = Math.floor(Math.random() * 900_000) + 50_000;

    let processed = 0;

    // Interval stagger: 200 + fileIndex * 120
    // Matches LumindAd.jsx line 694: setTimeout per file delay pattern
    const intervalMs = 200 + fileIndex * 120;

    const intervalId = setInterval(() => {
      processed = Math.min(processed + CHUNK_ROWS, totalRows);
      const progress = Math.round((processed / totalRows) * 100);

      const isDone = progress >= 100;

      // Send PROGRESS message
      const progressMsg: WorkerOutMessage = {
        type:    'PROGRESS',
        payload: {
          fileId,
          progress,
          rowsProcessed: processed,
          totalRows,
        },
      };
      self.postMessage(progressMsg);

      if (isDone) {
        clearInterval(intervalId);
        activeIntervals.delete(fileId);

        // Send DONE message
        const doneMsg: WorkerOutMessage = {
          type:    'DONE',
          payload: { fileId, totalRows },
        };
        self.postMessage(doneMsg);
      }
    }, intervalMs);

    activeIntervals.set(fileId, intervalId);
  }

  // ── CANCEL ─────────────────────────────────────────────────────────────────
  if (type === 'CANCEL') {
    const { fileId } = payload as CancelPayload;
    const intervalId = activeIntervals.get(fileId);
    if (intervalId !== undefined) {
      clearInterval(intervalId);
      activeIntervals.delete(fileId);
    }
  }
};
