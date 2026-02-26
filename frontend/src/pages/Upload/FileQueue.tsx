/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Upload · FileQueue
 *  src/pages/Upload/FileQueue.tsx
 *
 *  Purpose
 *   Renders the list of queued files with per-file status, progress
 *   bar, row count, and a remove button.
 *   Mirrors LumindAd.jsx UploadPage "File List" section (lines 755–805).
 *
 *  Anatomy  (one row)
 *   ┌────────────────────────────────────────────────────────┐
 *   │ [TYPE]  filename.csv                          ✓  [✕]  │
 *   │         1.4 MB · 247,382 rows processed               │
 *   │         ███████████████████████████████░░░░  (done)   │
 *   └────────────────────────────────────────────────────────┘
 *
 *  FileItem shape (mirrors the object built in LumindAd.jsx line 669)
 *   id:       string       — Math.random().toString(36).slice(2)
 *   file:     File         — original File object
 *   name:     string       — f.name
 *   size:     number       — f.size (bytes)
 *   type:     string       — f.name.split('.').pop().toUpperCase()
 *   status:   FileStatus   — 'ready' | 'processing' | 'done' | 'error'
 *   progress: number       — 0–100
 *   rows:     number|null  — null until processing starts
 *
 *  Type badge tokens (LumindAd.jsx lines 770–775)
 *   width 40 · height 40 · borderRadius 10
 *   background ${typeColor}15 · color typeColor
 *   fontWeight 800 · fontSize 12 · flexShrink 0
 *   typeColor comes from ACCEPTED_FORMATS lookup (DropZone.tsx)
 *
 *  Progress bar tokens
 *   Shown when status is 'processing' OR 'done'
 *   done:       linear-gradient(90deg, #10b981, #06b6d4)
 *   processing: linear-gradient(90deg, #7c3aed, #06b6d4)
 *   Bar height: from .progress-bar / .progress-fill in globals.css
 *   marginTop 8 on the bar wrapper
 *
 *  Status indicators (right side, LumindAd.jsx lines 788–796)
 *   done       ✓  color #10b981  fontSize 18
 *   processing {n}%  color #f59e0b  fontSize 11  fontWeight 700
 *   ready      "Ready"  color #475569  fontSize 11
 *   error      "Error"  color #ef4444  fontSize 11  fontWeight 600
 *
 *  Remove button (LumindAd.jsx lines 797–801)
 *   background rgba(239,68,68,.08) · border none
 *   color #ef4444 · width 28 · height 28 · borderRadius 7
 *   fontSize 14 · cursor pointer
 *   disabled (opacity 0.4) when file is processing
 *
 *  File size formatter (LumindAd.jsx line 713)
 *   b > 1e6 → "${(b/1e6).toFixed(1)} MB"
 *   else    → "${(b/1e3).toFixed(0)} KB"
 *
 *  Card header
 *   "Uploaded Files (n/10)" · fontWeight 700 fontSize 15 #e8e8f8
 *   Right: "X processed · Y ready" · fontSize 11 #475569
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – Card is role="region" aria-label="File upload queue"
 *   – File list is role="list"; each item role="listitem"
 *   – Progress bars have role="progressbar" + aria-valuenow/label
 *   – Remove buttons have aria-label="Remove {filename}"
 *   – Remove disabled while processing: aria-disabled + pointer-events none
 *   – Status text is read by screen reader alongside filename in aria-label
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { memo } from 'react';
import { typeColor } from './DropZone';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FileStatus = 'ready' | 'processing' | 'done' | 'error';

export interface FileItem {
  id:       string;
  file:     File;
  name:     string;
  size:     number;
  type:     string;           // uppercase extension e.g. "CSV", "XLSX"
  status:   FileStatus;
  progress: number;           // 0–100
  rows:     number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formats file size in human-readable form.
 * Mirrors fmtSize in LumindAd.jsx line 713 exactly.
 * @example fmtSize(1_400_000) → "1.4 MB"
 * @example fmtSize(24_000)    → "24 KB"
 */
export function fmtSize(bytes: number): string {
  return bytes > 1e6
    ? `${(bytes / 1e6).toFixed(1)} MB`
    : `${(bytes / 1e3).toFixed(0)} KB`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Progress bar — gradient changes by status */
function ProgressBar({ progress, status }: { progress: number; status: FileStatus }) {
  const gradient = status === 'done'
    ? 'linear-gradient(90deg,#10b981,#06b6d4)'   // done:       green → cyan
    : 'linear-gradient(90deg,#7c3aed,#06b6d4)';  // processing: purple → cyan

  return (
    <div
      className="progress-bar"
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${status === 'done' ? 'Complete' : 'Processing'}: ${progress}%`}
      style={{ marginTop: '8px' }}
    >
      <div
        className="progress-fill"
        style={{ width: `${progress}%`, background: gradient }}
      />
    </div>
  );
}

/** Single file row */
const FileRow = memo(function FileRow({
  item,
  onRemove,
  isProcessing,
}: {
  item:         FileItem;
  onRemove:     (id: string) => void;
  isProcessing: boolean;
}) {
  const color   = typeColor(item.type);
  const canRemove = !isProcessing && item.status !== 'processing';

  return (
    <div
      role="listitem"
      aria-label={`${item.name} — ${item.status}`}
      style={{
        padding:    '14px',
        borderRadius:'12px',
        // background rgba(124,58,237,.04) · border rgba(124,58,237,.1)
        // LumindAd.jsx line 762
        background: 'rgba(124,58,237,0.04)',
        border:     '1px solid rgba(124,58,237,0.10)',
        display:    'flex',
        alignItems: 'center',
        gap:        '14px',
        transition: 'border-color 0.2s ease',
      }}
    >
      {/* ── Type badge ─────────────────────────────────────── */}
      {/* LumindAd.jsx lines 770–774: 40×40 rounded box, ${typeColor}15 bg */}
      <div
        aria-hidden="true"
        style={{
          width:        '40px',
          height:       '40px',
          borderRadius: '10px',
          background:   `${color}15`,
          display:      'flex',
          alignItems:   'center',
          justifyContent:'center',
          color,
          fontWeight:    800,
          fontSize:     '11px',
          flexShrink:    0,
          fontFamily:  "'Outfit', system-ui, sans-serif",
          letterSpacing:'0.3px',
          userSelect:   'none',
        }}
      >
        {item.type.length > 5 ? item.type.slice(0, 5) : item.type}
      </div>

      {/* ── File info ──────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Filename */}
        <div
          style={{
            fontWeight:   600,
            fontSize:     '13px',
            color:        '#e8e8f8',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
            fontFamily:  "'Outfit', system-ui, sans-serif",
          }}
        >
          {item.name}
        </div>

        {/* Size + row count + chunk label */}
        <div
          style={{
            fontSize:  '11px',
            color:     '#475569',
            marginTop: '2px',
            fontFamily:"'Outfit', system-ui, sans-serif",
          }}
        >
          {fmtSize(item.size)}
          {item.rows !== null && item.status === 'done'
            && ` · ${item.rows.toLocaleString()} rows processed`}
          {item.status === 'processing'
            && item.rows !== null
            && ` · ${item.rows.toLocaleString()} rows · Processing chunk...`}
        </div>

        {/* Progress bar (visible when processing OR done) */}
        {(item.status === 'processing' || item.status === 'done') && (
          <ProgressBar progress={item.progress} status={item.status} />
        )}
      </div>

      {/* ── Status + remove ────────────────────────────────── */}
      <div
        style={{
          display:    'flex',
          alignItems: 'center',
          gap:        '10px',
          flexShrink:  0,
        }}
      >
        {/* Status indicator */}
        {item.status === 'done' && (
          <span
            aria-label="Done"
            style={{ color: '#10b981', fontSize: '18px', lineHeight: 1 }}
          >
            ✓
          </span>
        )}
        {item.status === 'processing' && (
          <span
            aria-live="polite"
            aria-label={`${item.progress}% complete`}
            style={{
              color:      '#f59e0b',
              fontSize:   '11px',
              fontWeight:  700,
              fontFamily:"'Outfit', system-ui, sans-serif",
              minWidth:   '32px',
              textAlign:  'right',
            }}
          >
            {item.progress}%
          </span>
        )}
        {item.status === 'ready' && (
          <span style={{ color: '#475569', fontSize: '11px', fontFamily: "'Outfit', system-ui, sans-serif" }}>
            Ready
          </span>
        )}
        {item.status === 'error' && (
          <span style={{ color: '#ef4444', fontSize: '11px', fontWeight: 600, fontFamily: "'Outfit', system-ui, sans-serif" }}>
            Error
          </span>
        )}

        {/* Remove button — LumindAd.jsx lines 797–801 */}
        <button
          type="button"
          onClick={() => canRemove && onRemove(item.id)}
          disabled={!canRemove}
          aria-label={`Remove ${item.name}`}
          aria-disabled={!canRemove}
          style={{
            background:    'rgba(239,68,68,0.08)',
            border:        'none',
            color:         '#ef4444',
            width:         '28px',
            height:        '28px',
            borderRadius:  '7px',
            cursor:         canRemove ? 'pointer' : 'not-allowed',
            fontSize:      '14px',
            display:       'flex',
            alignItems:    'center',
            justifyContent:'center',
            flexShrink:     0,
            opacity:        canRemove ? 1 : 0.4,
            transition:    'opacity 0.15s, background 0.15s',
          }}
          onMouseEnter={(e) => {
            if (canRemove) e.currentTarget.style.background = 'rgba(239,68,68,0.18)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.08)';
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
});

// ─── Public API ───────────────────────────────────────────────────────────────

export interface FileQueueProps {
  files:        FileItem[];
  maxFiles?:    number;
  isProcessing: boolean;
  onRemove:     (id: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * File queue card — shows all queued files with status and progress.
 * Returns null when the queue is empty (no empty-state rendered here —
 * the DropZone communicates "no files" implicitly).
 *
 * @example
 * // Upload/index.tsx
 * {files.length > 0 && (
 *   <FileQueue
 *     files={files}
 *     isProcessing={processing}
 *     onRemove={(id) => dispatch({ type: 'REMOVE', id })}
 *   />
 * )}
 *
 * @example
 * // With all files in 'done' state
 * <FileQueue files={doneFiles} isProcessing={false} onRemove={noop} />
 */
export function FileQueue({
  files,
  maxFiles    = 10,
  isProcessing,
  onRemove,
}: FileQueueProps) {
  if (files.length === 0) return null;

  const doneCount  = files.filter((f) => f.status === 'done').length;
  const readyCount = files.filter((f) => f.status === 'ready').length;

  return (
    <section
      role="region"
      aria-label={`File upload queue: ${files.length} of ${maxFiles} files`}
      aria-live="polite"
      aria-atomic="false"
      style={{
        background:     'rgba(15, 10, 30, 0.85)',
        border:         '1px solid rgba(124, 58, 237, 0.15)',
        borderRadius:   '16px',
        backdropFilter: 'blur(12px)',
        padding:        '20px',
        marginBottom:   '16px',
      }}
    >
      {/* ── Card header ─────────────────────────────────── */}
      <div
        style={{
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'center',
          marginBottom:   '16px',
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize:   '15px',
            color:      '#e8e8f8',
            fontFamily:"'Outfit', system-ui, sans-serif",
          }}
        >
          Uploaded Files ({files.length}/{maxFiles})
        </div>
        <div
          aria-live="polite"
          style={{
            fontSize:  '11px',
            color:     '#475569',
            fontFamily:"'Outfit', system-ui, sans-serif",
          }}
        >
          {doneCount} processed · {readyCount} ready
        </div>
      </div>

      {/* ── File rows ─────────────────────────────────────── */}
      <div
        role="list"
        aria-label="Queued files"
        style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
      >
        {files.map((f) => (
          <FileRow
            key={f.id}
            item={f}
            onRemove={onRemove}
            isProcessing={isProcessing}
          />
        ))}
      </div>
    </section>
  );
}

FileQueue.displayName = 'FileQueue';
export default FileQueue;
