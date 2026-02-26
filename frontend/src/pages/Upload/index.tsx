/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Pages · Upload Data Center
 *  src/pages/Upload/index.tsx
 *
 *  Route   /upload  (matched by App.tsx inside AppLayout)
 *
 *  Layout  (top → bottom, mirrors LumindAd.jsx lines 717–882)
 *  ┌──────────────────────────────────────────────────────────┐
 *  │  Header — "Upload Data"                                  │
 *  │  [⚡ 10 files · 10M rows max]  ← info pill, no action   │
 *  ├──────────────────────────────────────────────────────────┤
 *  │  DropZone  (drag & drop · browse · format badges)        │
 *  ├──────────────────────────────────────────────────────────┤
 *  │  FileQueue  (visible only when files.length > 0)         │
 *  ├──────────────────────────────────────────────────────────┤
 *  │  Action bar — [▶ Procesar] [🗑 Limpiar] [↓ Export]?     │
 *  ├──────────────────────────────────────────────────────────┤
 *  │  Done banner  (visible only when done === true)          │
 *  ├──────────────────────────────────────────────────────────┤
 *  │  BenchmarkTable  (always visible)                        │
 *  └──────────────────────────────────────────────────────────┘
 *
 *  Header info pill (LumindAd.jsx line 720)
 *   background  rgba(6,182,212,0.08)
 *   border      1px solid rgba(6,182,212,0.20)
 *   borderRadius  10px · padding 9px 16px
 *   fontSize 12 · color #06b6d4
 *   text "⚡ 10 files · 10M rows max"
 *
 *  State
 *   files[]     — FileItem array, max 10, mirrors LumindAd.jsx addFiles logic
 *   processing  — boolean, true while any Worker is active
 *   done        — boolean, true after all Workers complete
 *   workers     — Map<fileId, Worker>, one Worker per queued file
 *
 *  addFiles logic (mirrors LumindAd.jsx lines 664–675 exactly)
 *   const toAdd = [...newFiles].slice(0, MAX_FILES - files.length);
 *   Creates FileItem objects: id, file, name, size, type, status:'ready', progress:0, rows:null
 *   type = f.name.split('.').pop().toUpperCase()
 *   setDone(false) on each new file drop
 *
 *  Worker integration (enhancement over prototype setInterval)
 *   processData() creates one ProcessingWorker per file:
 *     const w = new Worker(new URL('./ProcessingWorker.ts', import.meta.url), { type: 'module' })
 *     w.postMessage({ type:'START', payload:{ fileId, fileIndex, fileName, fileSize } })
 *   Worker sends PROGRESS → updates file.status/progress/rows in state
 *   Worker sends DONE     → marks file.status='done', rows=totalRows
 *   When ALL files are done: setProcessing(false), setDone(true)
 *   Workers are terminated after DONE or on clearAll/unmount
 *
 *  Fallback (no Worker support / Vite dev mode without worker config)
 *   If Worker construction fails, falls back to the setInterval approach
 *   from LumindAd.jsx line 692 — same behaviour, main-thread only.
 *
 *  Action bar (LumindAd.jsx lines 805–818)
 *   ▶ Procesar Datos  — btn-success · disabled when !files.length || processing
 *   🗑 Limpiar Datos  — btn-danger  · disabled when !files.length || processing
 *   ↓ Export Results  — btn-secondary · only visible when done
 *   All buttons: flex 1 · opacity 0.6 when disabled · gap 8 inside button
 *   Processing label: '⟳ Processing...' (replaces '▶ Procesar Datos' while active)
 *
 *  Done banner (LumindAd.jsx lines 820–834)
 *   padding 16 · borderRadius 12
 *   background rgba(16,185,129,0.08) · border 1px solid rgba(16,185,129,0.25)
 *   display flex · alignItems center · gap 12
 *   ✅ icon fontSize 24
 *   Title: "Processing Complete!" fontWeight 700 color #10b981
 *   Body:  "{n} file(s) processed · {totalRows} total rows · Ready for ML pipeline"
 *          fontSize 12 · color #065f46 · marginTop 2
 *   Total rows = files.reduce((sum,f) => sum + (f.rows||0), 0)
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – Action buttons are native <button type="button"> with aria-disabled
 *   – Done banner has role="status" aria-live="polite" (appears on completion)
 *   – Procesar/Limpiar buttons are aria-busy when processing
 *   – Header info pill is role="status" (communicates current file/row limits)
 *   – Page has page-enter animation class (from globals.css)
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { useState, useCallback, useEffect, useRef } from 'react';

import { Header }       from '../../components/layout/Header';
import { DropZone }     from './DropZone';
import { FileQueue }    from './FileQueue';
import { BenchmarkTable } from './BenchmarkTable';
import type { FileItem }  from './FileQueue';
import type {
  WorkerOutMessage,
  StartPayload,
} from './ProcessingWorker';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FILES  = 10;
const CHUNK_ROWS = 50_000; // fallback only — Worker uses its own constant

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Builds a FileItem from a raw File object. Matches LumindAd.jsx line 667–673. */
function buildFileItem(f: File): FileItem {
  return {
    id:       Math.random().toString(36).slice(2),
    file:      f,
    name:      f.name,
    size:      f.size,
    // type = last extension, uppercase — "data.csv" → "CSV"
    type:      (f.name.split('.').pop() ?? 'BIN').toUpperCase(),
    status:   'ready',
    progress:  0,
    rows:      null,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Upload Data Center page — route /upload.
 *
 * Orchestrates DropZone, FileQueue, action buttons, done banner and
 * BenchmarkTable with Web Worker-powered chunked processing.
 *
 * @example
 * // Consumed by React Router via App.tsx
 * <Route path="/upload" element={<UploadPage />} />
 *
 * @example
 * // Worker message flow:
 * // index.tsx → Worker: { type:'START', payload:{ fileId, fileIndex, fileName, fileSize } }
 * // Worker → index.tsx: { type:'PROGRESS', payload:{ fileId, progress, rowsProcessed, totalRows } }
 * // Worker → index.tsx: { type:'DONE', payload:{ fileId, totalRows } }
 */
export default function UploadPage() {
  const [files,      setFiles]      = useState<FileItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [done,       setDone]       = useState(false);

  // Worker pool — one Worker per active file id
  const workersRef = useRef<Map<string, Worker>>(new Map());

  // ─── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    const workers = workersRef.current;
    return () => {
      workers.forEach((w) => w.terminate());
      workers.clear();
    };
  }, []);

  // ─── addFiles (mirrors LumindAd.jsx lines 664–675) ────────────────────────
  const addFiles = useCallback((incoming: FileList | File[]) => {
    setFiles((prev) => {
      const available = MAX_FILES - prev.length;
      if (available <= 0) return prev;
      const toAdd = Array.from(incoming).slice(0, available).map(buildFileItem);
      return [...prev, ...toAdd];
    });
    setDone(false);
  }, []);

  // ─── removeFile ────────────────────────────────────────────────────────────
  const removeFile = useCallback((id: string) => {
    // Cancel its worker if active
    const w = workersRef.current.get(id);
    if (w) {
      w.postMessage({ type: 'CANCEL', payload: { fileId: id } });
      w.terminate();
      workersRef.current.delete(id);
    }
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // ─── clearAll ──────────────────────────────────────────────────────────────
  const clearAll = useCallback(() => {
    workersRef.current.forEach((w) => w.terminate());
    workersRef.current.clear();
    setFiles([]);
    setDone(false);
    setProcessing(false);
  }, []);

  // ─── processData (Worker integration) ────────────────────────────────────
  const processData = useCallback(() => {
    if (!files.length || processing) return;
    setProcessing(true);
    setDone(false);

    let doneCount = 0;
    const total   = files.length;

    files.forEach((file, fi) => {
      // ── Try Web Worker first ────────────────────────────────────────────
      let workerOk = false;
      try {
        const w = new Worker(
          new URL('./ProcessingWorker.ts', import.meta.url),
          { type: 'module' },
        );
        workerOk = true;
        workersRef.current.set(file.id, w);

        const startPayload: StartPayload = {
          fileId:    file.id,
          fileIndex: fi,
          fileName:  file.name,
          fileSize:  file.size,
        };
        w.postMessage({ type: 'START', payload: startPayload });

        w.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
          const { type, payload } = e.data;

          if (type === 'PROGRESS') {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === payload.fileId
                  ? {
                      ...f,
                      status:   payload.progress < 100 ? 'processing' : 'done',
                      progress: payload.progress,
                      rows:     payload.rowsProcessed,
                    }
                  : f,
              ),
            );
          }

          if (type === 'DONE') {
            // Update final row count
            setFiles((prev) =>
              prev.map((f) =>
                f.id === payload.fileId
                  ? { ...f, status: 'done', progress: 100, rows: payload.totalRows }
                  : f,
              ),
            );

            w.terminate();
            workersRef.current.delete(payload.fileId);

            doneCount++;
            if (doneCount === total) {
              setProcessing(false);
              setDone(true);
            }
          }
        };

        w.onerror = () => {
          // Mark file as error, count as done
          setFiles((prev) =>
            prev.map((f) =>
              f.id === file.id ? { ...f, status: 'error', progress: 0 } : f,
            ),
          );
          workersRef.current.delete(file.id);
          doneCount++;
          if (doneCount === total) {
            setProcessing(false);
          }
        };
      } catch {
        workerOk = false;
      }

      // ── Fallback: main-thread setInterval (LumindAd.jsx lines 692–706) ──
      if (!workerOk) {
        const totalRows = Math.floor(Math.random() * 900_000) + 50_000;
        let processed   = 0;

        const interval = setInterval(() => {
          processed = Math.min(processed + CHUNK_ROWS, totalRows);
          const progress = Math.round((processed / totalRows) * 100);

          setFiles((prev) =>
            prev.map((f) =>
              f.id === file.id
                ? {
                    ...f,
                    status:   progress < 100 ? 'processing' : 'done',
                    progress,
                    rows:     progress >= 100 ? totalRows : processed,
                  }
                : f,
            ),
          );

          if (progress >= 100) {
            clearInterval(interval);
            doneCount++;
            if (doneCount === total) {
              setProcessing(false);
              setDone(true);
            }
          }
        }, 200 + fi * 120);
      }
    });
  }, [files, processing]);

  // ─── Derived ───────────────────────────────────────────────────────────────
  const activeJobs  = files.filter((f) => f.status === 'processing').length;
  const totalRows   = files.reduce((s, f) => s + (f.rows ?? 0), 0);
  const canProcess  = files.length > 0 && !processing;
  const canClear    = files.length > 0 && !processing;

  const F = "'Outfit', system-ui, sans-serif";

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page-enter">

      {/* ── Header ────────────────────────────────────────── */}
      {/* LumindAd.jsx line 717: title, subtitle, info pill */}
      <Header
        title="Upload Data"
        subtitle="Process up to 10M rows · Chunked parallel processing · Web Workers"
        actions={[
          /* Info pill — not a button; purely informational status */
          <div
            key="info"
            role="status"
            aria-label="Upload limits: 10 files, 10 million rows maximum"
            style={{
              // LumindAd.jsx line 721: rgba(6,182,212,.08) bg rgba(6,182,212,.2) border
              background:   'rgba(6,182,212,0.08)',
              border:       '1px solid rgba(6,182,212,0.20)',
              borderRadius: '10px',
              padding:      '9px 16px',
              fontSize:     '12px',
              color:        '#06b6d4',
              display:      'flex',
              alignItems:   'center',
              gap:          '8px',
              fontFamily:    F,
              fontWeight:    600,
              userSelect:   'none',
            }}
          >
            ⚡ 10 files · 10M rows max
          </div>,
        ]}
      />

      {/* ── Drop Zone ─────────────────────────────────────── */}
      <DropZone
        fileCount={files.length}
        maxFiles={MAX_FILES}
        onFilesAdded={addFiles}
      />

      {/* ── File Queue (conditional) ──────────────────────── */}
      {files.length > 0 && (
        <FileQueue
          files={files}
          maxFiles={MAX_FILES}
          isProcessing={processing}
          onRemove={removeFile}
        />
      )}

      {/* ── Action bar ────────────────────────────────────── */}
      {/* LumindAd.jsx lines 805–818: flex gap 12 marginBottom 24 */}
      <div
        style={{
          display:      'flex',
          gap:          '12px',
          marginBottom: '24px',
        }}
      >
        {/* ▶ Procesar Datos — btn-success */}
        <button
          type="button"
          className="btn-success"
          onClick={processData}
          disabled={!canProcess}
          aria-disabled={!canProcess}
          aria-busy={processing}
          aria-label={processing ? 'Processing files, please wait' : 'Start processing uploaded files'}
          style={{
            opacity:        canProcess ? 1 : 0.6,
            flex:           1,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            '8px',
            cursor:          canProcess ? 'pointer' : 'not-allowed',
          }}
        >
          {processing ? '⟳ Processing...' : '▶ Procesar Datos'}
        </button>

        {/* 🗑 Limpiar Datos — btn-danger */}
        <button
          type="button"
          className="btn-danger"
          onClick={clearAll}
          disabled={!canClear}
          aria-disabled={!canClear}
          aria-label="Clear all files from the upload queue"
          style={{
            opacity:        canClear ? 1 : 0.6,
            flex:           1,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            '8px',
            cursor:          canClear ? 'pointer' : 'not-allowed',
          }}
        >
          🗑 Limpiar Datos
        </button>

        {/* ↓ Export Results — only when done, btn-secondary */}
        {done && (
          <button
            type="button"
            className="btn-secondary"
            aria-label={`Export ${totalRows.toLocaleString()} processed rows`}
            style={{
              display:    'flex',
              alignItems: 'center',
              gap:        '8px',
            }}
          >
            ↓ Export Results
          </button>
        )}
      </div>

      {/* ── Done banner ───────────────────────────────────── */}
      {/* LumindAd.jsx lines 820–834: rgba(16,185,129,.08) bg rgba(16,185,129,.25) border */}
      {done && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{
            padding:      '16px',
            borderRadius: '12px',
            background:   'rgba(16,185,129,0.08)',
            border:       '1px solid rgba(16,185,129,0.25)',
            display:      'flex',
            alignItems:   'center',
            gap:          '12px',
            marginBottom: '4px',
          }}
        >
          <span aria-hidden="true" style={{ fontSize: '24px', lineHeight: 1 }}>
            ✅
          </span>
          <div>
            {/* "Processing Complete!" — fontWeight 700 color #10b981 */}
            <div style={{ fontWeight: 700, color: '#10b981', fontFamily: F }}>
              Processing Complete!
            </div>
            {/* Summary — fontSize 12 color #065f46 marginTop 2 */}
            <div
              style={{
                fontSize:   '12px',
                color:      '#065f46',
                marginTop:  '2px',
                fontFamily:  F,
              }}
            >
              {files.length} file{files.length > 1 ? 's' : ''} processed successfully ·{' '}
              {totalRows.toLocaleString()} total rows ·{' '}
              Ready for ML pipeline
            </div>
          </div>
        </div>
      )}

      {/* ── Benchmark Table ───────────────────────────────── */}
      {/* Always visible — shows active job count when processing */}
      <BenchmarkTable activeJobs={activeJobs} />
    </div>
  );
}

UploadPage.displayName = 'UploadPage';
