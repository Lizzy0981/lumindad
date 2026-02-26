/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Store · uploadStore
 *  src/store/uploadStore.ts
 *
 *  Purpose
 *   Zustand store that owns all upload pipeline state consumed by
 *   UploadPage, FileQueue, DropZone, and BenchmarkTable.
 *   Mirrors every state variable and action in LumindAd.jsx
 *   UploadPage (lines 657–705) exactly.
 *
 *  Original inline state (LumindAd.jsx lines 657–662)
 *   const [files, setFiles]           = useState([]);
 *   const [dragging, setDragging]     = useState(false);
 *   const [processing, setProcessing] = useState(false);
 *   const [done, setDone]             = useState(false);
 *   const MAX_FILES = 10;
 *
 *  FileItem shape (LumindAd.jsx lines 667–672)
 *   { id, file, name, size, type, status:'ready', progress:0, rows:null }
 *   type = f.name.split('.').pop().toUpperCase()
 *
 *  addFiles logic (LumindAd.jsx lines 664–675)
 *   const toAdd = [...newFiles].slice(0, MAX_FILES - files.length)
 *   → caps queue at 10, resets done flag
 *
 *  processData logic (LumindAd.jsx lines 686–705)
 *   CHUNK_ROWS = 50000
 *   interval = 200 + fi * 120   (stagger per file index)
 *   totalRows = random 50K–950K
 *   setTimeout(..., files.length * 800 + 1200) → setProcessing(false) + setDone(true)
 *
 *  State shape
 *   files[]       — FileItem queue, max 10
 *   dragging      — true during dragover (for DropZone .dragging class)
 *   processing    — true while any Worker/interval is active
 *   done          — true when all files reach 'done' status
 *   uploadHistory — completed upload sessions (for audit log)
 *
 *  Persistence
 *   `files` is NOT persisted — in-memory only.
 *   `uploadHistory` IS persisted — allows reviewing past uploads on refresh.
 *
 *  Relationship to useChunkedUpload
 *   uploadStore owns the persistent/shareable state (queue, history).
 *   useChunkedUpload owns the ephemeral processing logic (timers, Workers).
 *   UploadPage wires them together: useChunkedUpload reads/writes the store
 *   via store actions rather than maintaining its own local state.
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// ─── Domain types ─────────────────────────────────────────────────────────────

export type UploadFileStatus = 'ready' | 'processing' | 'done' | 'error';

/** Mirrors the object shape built in LumindAd.jsx lines 667–672 exactly */
export interface UploadFileItem {
  id:       string;
  /** Raw File object — not serialisable, excluded from persist */
  file:     File | null;
  name:     string;
  size:     number;
  /** Uppercase extension: "CSV", "XLSX", "PARQUET" … */
  type:     string;
  status:   UploadFileStatus;
  /** 0–100 */
  progress: number;
  /** null until processing begins; total rows when done */
  rows:     number | null;
}

/** Completed upload session stored in history */
export interface UploadSession {
  id:          string;
  completedAt: number;
  fileCount:   number;
  totalRows:   number;
  fileSummary: Array<{ name: string; rows: number; type: string }>;
}

// ─── Constants (LumindAd.jsx) ─────────────────────────────────────────────────

/** LumindAd.jsx line 663 */
export const MAX_UPLOAD_FILES = 10;

/** LumindAd.jsx line 688 */
export const CHUNK_ROWS = 50_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Builds a FileItem from a raw File — mirrors LumindAd.jsx lines 667–672 */
export function buildUploadItem(f: File): UploadFileItem {
  return {
    id:       Math.random().toString(36).slice(2),
    file:      f,
    name:      f.name,
    size:      f.size,
    type:     (f.name.split('.').pop() ?? 'BIN').toUpperCase(),
    status:   'ready',
    progress:  0,
    rows:      null,
  };
}

// ─── Store shape ──────────────────────────────────────────────────────────────

interface UploadState {
  files:         UploadFileItem[];
  dragging:      boolean;
  processing:    boolean;
  done:          boolean;
  uploadHistory: UploadSession[];

  // Actions
  addFiles:       (incoming: FileList | File[]) => void;
  removeFile:     (id: string) => void;
  clearAll:       () => void;
  updateFile:     (id: string, patch: Partial<UploadFileItem>) => void;
  setDragging:    (v: boolean) => void;
  setProcessing:  (v: boolean) => void;
  setDone:        (v: boolean) => void;
  pushHistory:    (session: UploadSession) => void;
  clearHistory:   () => void;

  // Derived selectors
  /** Sum of all file.rows — shown in Done banner */
  totalRows:      () => number;
  /** Number of files with status === 'done' */
  doneCount:      () => number;
  /** Number of files with status === 'ready' */
  readyCount:     () => number;
  /** Number of files still processing */
  activeCount:    () => number;
  /** Remaining slots before hitting MAX_UPLOAD_FILES */
  remainingSlots: () => number;
}

// ─── Store ────────────────────────────────────────────────────────────────────

/**
 * Zustand upload store — queue, progress, and history for UploadPage.
 *
 * @example
 * // UploadPage — read queue + actions
 * const { files, processing, done, addFiles, clearAll } = useUploadStore();
 *
 * @example
 * // DropZone — dragging class toggle
 * const { dragging, setDragging } = useUploadStore();
 * // className={`drop-zone${dragging ? ' dragging' : ''}`}
 *
 * @example
 * // Done banner (LumindAd.jsx lines 820–834)
 * const { done, files, totalRows } = useUploadStore(s => ({
 *   done:      s.done,
 *   files:     s.files,
 *   totalRows: s.totalRows(),
 * }));
 * // totalRows → sum of all f.rows across completed files
 *
 * @example
 * // FileQueue — per-file progress update (from Worker/interval)
 * const update = useUploadStore(s => s.updateFile);
 * update(fileId, { status: 'processing', progress: 42, rows: 21000 });
 *
 * @example
 * // On processing complete — save session to history
 * const { pushHistory, files, totalRows } = useUploadStore();
 * pushHistory({
 *   id:          Date.now().toString(),
 *   completedAt: Date.now(),
 *   fileCount:   files.length,
 *   totalRows:   totalRows(),
 *   fileSummary: files.map(f => ({ name: f.name, rows: f.rows ?? 0, type: f.type })),
 * });
 */
export const useUploadStore = create<UploadState>()(
  devtools(
    persist(
      (set, get) => ({
        // ── Initial state ────────────────────────────────────────────
        files:         [],
        dragging:      false,
        processing:    false,
        done:          false,
        uploadHistory: [],

        // ── Actions ──────────────────────────────────────────────────

        /**
         * Add files to queue, capping at MAX_UPLOAD_FILES.
         * Mirrors LumindAd.jsx lines 664–675:
         *   const toAdd = [...newFiles].slice(0, MAX_FILES - files.length)
         */
        addFiles: (incoming) =>
          set(
            (s) => {
              const slots = MAX_UPLOAD_FILES - s.files.length;
              if (slots <= 0) return s;
              const newItems = Array.from(incoming)
                .slice(0, slots)
                .map(buildUploadItem);
              return {
                files: [...s.files, ...newItems],
                done:  false,
              };
            },
            false,
            'addFiles',
          ),

        removeFile: (id) =>
          set(
            (s) => ({ files: s.files.filter((f) => f.id !== id) }),
            false,
            'removeFile',
          ),

        /**
         * Clear queue and reset flags.
         * Mirrors LumindAd.jsx line 682: setFiles([]); setDone(false)
         */
        clearAll: () =>
          set(
            { files: [], processing: false, done: false },
            false,
            'clearAll',
          ),

        updateFile: (id, patch) =>
          set(
            (s) => ({
              files: s.files.map((f) =>
                f.id === id ? { ...f, ...patch } : f,
              ),
            }),
            false,
            'updateFile',
          ),

        setDragging:   (dragging)   => set({ dragging },   false, 'setDragging'),
        setProcessing: (processing) => set({ processing }, false, 'setProcessing'),
        setDone:       (done)       => set({ done },       false, 'setDone'),

        pushHistory: (session) =>
          set(
            (s) => ({
              uploadHistory: [session, ...s.uploadHistory].slice(0, 50),
            }),
            false,
            'pushHistory',
          ),

        clearHistory: () =>
          set({ uploadHistory: [] }, false, 'clearHistory'),

        // ── Derived selectors ────────────────────────────────────────

        /**
         * Sum of all file.rows across done files.
         * Used in Done banner: "{totalRows.toLocaleString()} total rows"
         * Mirrors LumindAd.jsx line 833: files.reduce((s,f)=>s+(f.rows||0),0)
         */
        totalRows: () =>
          get().files.reduce((s, f) => s + (f.rows ?? 0), 0),

        doneCount: () =>
          get().files.filter((f) => f.status === 'done').length,

        readyCount: () =>
          get().files.filter((f) => f.status === 'ready').length,

        activeCount: () =>
          get().files.filter((f) => f.status === 'processing').length,

        remainingSlots: () =>
          Math.max(0, MAX_UPLOAD_FILES - get().files.length),
      }),
      {
        name: 'lumindad-upload',
        partialize: (s) => ({
          // files excluded — File objects are not serialisable
          uploadHistory: s.uploadHistory,
        }),
      },
    ),
    { name: 'UploadStore' },
  ),
);

export default useUploadStore;
