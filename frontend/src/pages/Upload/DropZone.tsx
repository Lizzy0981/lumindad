/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Upload · DropZone
 *  src/pages/Upload/DropZone.tsx
 *
 *  Purpose
 *   Drag & drop file upload area with format badge grid.
 *   Matches LumindAd.jsx lines 729–758 exactly, token-for-token.
 *
 *  Anatomy
 *   ┌──────────────────────────────────────────────────────────┐
 *   │                        ⤒                                 │  ← fontSize 40
 *   │         Drag & drop your files here                      │  ← 700 18px #e8e8f8
 *   │  or browse files from your computer                      │  ← #475569 13px
 *   │                                                          │
 *   │  📊 CSV  📗 Excel  🔵 JSON  🔴 PDF  🟠 XML  🟣 TSV      │
 *   │  ⬜ TXT  🟡 Parquet  🩵 Avro  💙 JSONL                  │
 *   │                                                          │
 *   │  Max 10 files · Supports files up to 2GB · ...          │  ← #3d3d60 11px
 *   └──────────────────────────────────────────────────────────┘
 *
 *  Visual states
 *   idle     — class "drop-zone" (from globals.css)
 *   dragging — class "drop-zone dragging" (border glows #7c3aed)
 *   disabled — files.length >= MAX_FILES: cursor not-allowed, reduced opacity
 *   Title text changes: "Drag & drop…" ↔ "Drop your files here!" during drag
 *
 *  Format badges (from LumindAd.jsx ACCEPTED_FORMATS array line 127)
 *   Each badge: background ${color}15 · border 1px solid ${color}30
 *   color: as specified · padding 4px 10px · borderRadius 8
 *   fontSize 11 · fontWeight 700
 *   10 formats: CSV · Excel · JSON · PDF · XML · TSV · TXT · Parquet · Avro · JSONL
 *   accept attribute: ".csv,.xlsx,.xls,.json,.pdf,.xml,.tsv,.txt,.parquet,.avro,.jsonl"
 *
 *  Type mapping — file extension → ACCEPTED_FORMATS entry
 *   The file input `accept` attribute lists the raw extensions.
 *   typeColor() maps the uppercase extension to its brand color:
 *     "XLSX" and "XLS" both map to the "Excel" entry color (#22c55e)
 *   Because ACCEPTED_FORMATS uses "Excel" not "XLSX", the lookup
 *   normalises: XLSX/XLS → "Excel", everything else is exact match.
 *
 *  Interaction
 *   1. Drag over  → setDragging(true), add class "dragging"
 *   2. Drag leave → setDragging(false)
 *   3. Drop       → addFiles(e.dataTransfer.files)
 *   4. Click      → inputRef.current.click() if !disabled
 *   5. Input change → addFiles(e.target.files)
 *   Clicking when disabled (queue full) does nothing.
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – Drop zone is role="button" with aria-label
 *   – aria-describedby references the format list and file limit caption
 *   – aria-disabled when queue is full
 *   – Hidden file input is keyboard-reachable via the button wrapper
 *   – Format badge list uses role="list" + role="listitem"
 *   – onKeyDown: Enter/Space triggers click (native button behaviour)
 *   – Drag events do NOT interfere with keyboard-only users
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { useRef, useState, useCallback, useId } from 'react';

// ─── Format definitions (LumindAd.jsx line 127) ───────────────────────────────

export interface AcceptedFormat {
  ext: string;
  icon: string;
  color: string;
}

/** 11 accepted formats — mirrors ACCEPTED_FORMATS in LumindAd.jsx + Notebook support. */
export const ACCEPTED_FORMATS: AcceptedFormat[] = [
  { ext: 'CSV', icon: '📊', color: '#10b981' },
  { ext: 'Excel', icon: '📗', color: '#22c55e' },
  { ext: 'JSON', icon: '🔵', color: '#3b82f6' },
  { ext: 'PDF', icon: '🔴', color: '#ef4444' },
  { ext: 'XML', icon: '🟠', color: '#f97316' },
  { ext: 'TSV', icon: '🟣', color: '#a855f7' },
  { ext: 'TXT', icon: '⬜', color: '#94a3b8' },
  { ext: 'Parquet', icon: '🟡', color: '#eab308' },
  { ext: 'Avro', icon: '🩵', color: '#06b6d4' },
  { ext: 'JSONL', icon: '💙', color: '#60a5fa' },
  { ext: 'Notebook', icon: '📓', color: '#ff6f00' },
];

/** Maps an uppercase file extension to its brand colour. */
export function typeColor(ext: string): string {
  // Normalise XLSX/XLS → Excel, IPYNB → Notebook
  const key = (ext === 'XLSX' || ext === 'XLS') ? 'Excel'
    : ext === 'IPYNB' ? 'Notebook'
      : ext;
  return ACCEPTED_FORMATS.find((f) => f.ext === key)?.color ?? '#94a3b8';
}

/** File accept string for the hidden <input type="file"> */
export const ACCEPT_ATTR =
  '.csv,.xlsx,.xls,.json,.pdf,.xml,.tsv,.txt,.parquet,.avro,.jsonl,.ipynb';

// ─── Public API ───────────────────────────────────────────────────────────────

export interface DropZoneProps {
  /** Current number of files in the queue */
  fileCount: number;
  /** Maximum files allowed (default: 10) */
  maxFiles?: number;
  /** Called with the FileList when files are dropped or selected */
  onFilesAdded: (files: FileList | File[]) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Drag & drop file upload zone.
 * Matches LumindAd.jsx UploadPage drop-zone section exactly.
 *
 * @example
 * // Upload/index.tsx
 * <DropZone
 *   fileCount={files.length}
 *   maxFiles={10}
 *   onFilesAdded={(f) => dispatch({ type: 'ADD_FILES', files: f })}
 * />
 *
 * @example
 * // Disabled state (queue full)
 * <DropZone fileCount={10} onFilesAdded={noop} />
 */
export function DropZone({
  fileCount,
  maxFiles = 10,
  onFilesAdded,
}: DropZoneProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const disabled = fileCount >= maxFiles;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback(() => setDragging(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!disabled && e.dataTransfer.files.length) {
      onFilesAdded(e.dataTransfer.files);
    }
  }, [disabled, onFilesAdded]);

  const handleClick = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      onFilesAdded(e.target.files);
      // Reset so the same file can be re-added after removal
      e.target.value = '';
    }
  }, [onFilesAdded]);

  const captionId = `${id}-caption`;
  const formatsId = `${id}-formats`;

  return (
    <div
      // LumindAd.jsx line 735: className="drop-zone" + conditional "dragging"
      // These classes live in globals.css (dashed border, hover glow, etc.)
      className={`drop-zone${dragging ? ' dragging' : ''}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={
        disabled
          ? `File upload area — queue full (${maxFiles}/${maxFiles} files)`
          : `File upload area — drag & drop or click to browse. ${fileCount}/${maxFiles} files added.`
      }
      aria-describedby={`${captionId} ${formatsId}`}
      aria-disabled={disabled}
      style={{
        padding: '40px',
        textAlign: 'center',
        marginBottom: '20px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: 'opacity 0.2s ease',
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        aria-hidden="true"
        tabIndex={-1}
        style={{ display: 'none' }}
        onChange={handleChange}
      />

      {/* Upload icon — ⤒ from LumindAd.jsx line 736 */}
      <div
        aria-hidden="true"
        style={{ fontSize: '40px', marginBottom: '12px', lineHeight: 1 }}
      >
        ⤒
      </div>

      {/* Primary text — changes when dragging */}
      <div
        style={{
          fontWeight: 700,
          fontSize: '18px',
          color: '#e8e8f8',
          marginBottom: '6px',
          fontFamily: "'Outfit', system-ui, sans-serif",
          transition: 'color 0.15s ease',
        }}
      >
        {dragging ? 'Drop your files here!' : 'Drag & drop your files here'}
      </div>

      {/* Secondary text */}
      <div
        style={{
          color: '#475569',
          fontSize: '13px',
          marginBottom: '16px',
          fontFamily: "'Outfit', system-ui, sans-serif",
        }}
      >
        or{' '}
        <span style={{ color: '#7c3aed', cursor: 'pointer', fontWeight: 600 }}>
          browse files
        </span>{' '}
        from your computer
      </div>

      {/* Format badge grid — LumindAd.jsx lines 742–748 */}
      <div
        id={formatsId}
        role="list"
        aria-label="Accepted file formats"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        {ACCEPTED_FORMATS.map((f) => (
          <span
            key={f.ext}
            role="listitem"
            style={{
              // background ${color}15 · border 1px solid ${color}30
              // Exact match to LumindAd.jsx line 744
              background: `${f.color}15`,
              border: `1px solid ${f.color}30`,
              color: f.color,
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: "'Outfit', system-ui, sans-serif",
              letterSpacing: '0.2px',
              userSelect: 'none',
            }}
          >
            {f.icon} {f.ext}
          </span>
        ))}
      </div>

      {/* Caption — LumindAd.jsx line 750 */}
      <div
        id={captionId}
        style={{
          marginTop: '12px',
          fontSize: '11px',
          color: '#3d3d60',
          fontFamily: "'Outfit', system-ui, sans-serif",
        }}
      >
        Max {maxFiles} files · Supports files up to 2GB · Parallel chunked processing (50K rows/chunk)
      </div>
    </div>
  );
}

DropZone.displayName = 'DropZone';
export default DropZone;
