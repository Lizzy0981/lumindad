/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · utils/fileValidation.ts
 *  src/utils/fileValidation.ts
 *
 *  Purpose
 *   Central validation layer for all file uploads in LumindAd.
 *   Enforces the constraints from LumindAd.jsx:
 *     - Max 10 files (LumindAd.jsx line 663: MAX_FILES)
 *     - Max 2 GB per file (LumindAd.jsx line 747)
 *     - 10 accepted formats (LumindAd.jsx lines 126–134)
 *
 *  10-Format whitelist (LumindAd.jsx ACCEPTED_FORMATS lines 126–134)
 *   CSV · Excel · JSON · PDF · XML · TSV · TXT · Parquet · Avro · JSONL
 *
 *  Validation layers
 *   1. Queue count — files + queue ≤ MAX_FILES
 *   2. Individual file size — ≤ MAX_FILE_SIZE_BYTES (2 GB)
 *   3. Extension whitelist — derived from ACCEPTED_FORMATS
 *   4. MIME type cross-check — warns on mismatch (non-blocking)
 *   5. Empty file guard — zero-byte files rejected
 *   6. Duplicate guard — optional, based on name+size hash
 *
 *  Usage
 *   import { validateFileList, validateFile, ACCEPTED_EXTS } from '@/utils/fileValidation';
 *
 *   // Validate a FileList from a drop event:
 *   const result = validateFileList(e.dataTransfer.files, { currentCount: queue.length });
 *   if (!result.valid) showErrors(result.errors);
 *   addFiles(result.accepted); // only files that passed
 *
 *   // Validate a single file:
 *   const err = validateFile(file);
 *   if (err) showError(err);
 *
 *  Relationship to services/uploadService.ts
 *   uploadService.ts exports `validateFiles()` — a simpler version
 *   used inside the upload service layer. This module is the full
 *   validation layer used at the UI edge (DropZone, file input).
 *   Both are intentionally kept in sync.
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ─── Constants (LumindAd.jsx) ─────────────────────────────────────────────────

/** Maximum files in the queue simultaneously — LumindAd.jsx line 663 */
export const MAX_FILES = 10;

/** Maximum individual file size: 2 GB — LumindAd.jsx line 747 */
export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024;

/** Maximum total rows across all queued files — LumindAd.jsx subtitle line 712 */
export const MAX_TOTAL_ROWS = 10_000_000;

// ─── Accepted format registry ─────────────────────────────────────────────────
// Mirrors ACCEPTED_FORMATS in LumindAd.jsx lines 126–134 exactly.

/**
 * Full definition of each accepted file format.
 * Used for DropZone chip rendering and validation.
 */
export interface AcceptedFormatDef {
  /** Uppercase extension displayed in the UI — matches ACCEPTED_FORMATS[].ext */
  ext:    string;
  /** One or more lowercase extensions that map to this format */
  exts:   string[];
  /** Emoji icon — matches LumindAd.jsx ACCEPTED_FORMATS[].icon */
  icon:   string;
  /** Accent colour hex — matches LumindAd.jsx ACCEPTED_FORMATS[].color */
  color:  string;
  /** Known MIME types for this format (non-exhaustive — extensions are primary) */
  mimes:  string[];
  /** Estimated max rows before performance degrades (informational) */
  maxRows: number;
}

/**
 * The 10 accepted formats — LumindAd.jsx ACCEPTED_FORMATS lines 126–134.
 * Order matches the original JSX for chip rendering consistency.
 */
export const ACCEPTED_FORMAT_DEFS: AcceptedFormatDef[] = [
  {
    ext:     'CSV',
    exts:    ['csv'],
    icon:    '📊',
    color:   '#10b981',
    mimes:   ['text/csv', 'application/csv', 'text/plain'],
    maxRows: 10_000_000,
  },
  {
    ext:     'Excel',
    exts:    ['xlsx', 'xls'],
    icon:    '📗',
    color:   '#22c55e',
    mimes:   [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ],
    maxRows: 1_000_000,
  },
  {
    ext:     'JSON',
    exts:    ['json'],
    icon:    '🔵',
    color:   '#3b82f6',
    mimes:   ['application/json'],
    maxRows: 10_000_000,
  },
  {
    ext:     'PDF',
    exts:    ['pdf'],
    icon:    '🔴',
    color:   '#ef4444',
    mimes:   ['application/pdf'],
    maxRows: 0,   // PDFs processed as documents, not row data
  },
  {
    ext:     'XML',
    exts:    ['xml'],
    icon:    '🟠',
    color:   '#f97316',
    mimes:   ['text/xml', 'application/xml'],
    maxRows: 10_000_000,
  },
  {
    ext:     'TSV',
    exts:    ['tsv'],
    icon:    '🟣',
    color:   '#a855f7',
    mimes:   ['text/tab-separated-values', 'text/tsv'],
    maxRows: 10_000_000,
  },
  {
    ext:     'TXT',
    exts:    ['txt'],
    icon:    '⬜',
    color:   '#94a3b8',
    mimes:   ['text/plain'],
    maxRows: 2_000_000,
  },
  {
    ext:     'Parquet',
    exts:    ['parquet'],
    icon:    '🟡',
    color:   '#eab308',
    mimes:   ['application/octet-stream', 'application/parquet'],
    maxRows: 100_000_000,  // Backend processed
  },
  {
    ext:     'Avro',
    exts:    ['avro'],
    icon:    '🩵',
    color:   '#06b6d4',
    mimes:   ['application/octet-stream', 'application/avro'],
    maxRows: 10_000_000,   // Backend processed
  },
  {
    ext:     'JSONL',
    exts:    ['jsonl', 'ndjson'],
    icon:    '💙',
    color:   '#60a5fa',
    mimes:   ['application/jsonlines', 'application/x-ndjson', 'text/plain'],
    maxRows: 10_000_000,
  },
];

/** Set of all valid lowercase extensions — fast O(1) lookup. */
export const ACCEPTED_EXTS = new Set<string>(
  ACCEPTED_FORMAT_DEFS.flatMap(f => f.exts),
);

/** HTML `accept` attribute value for the file input. */
export const FILE_INPUT_ACCEPT =
  '.csv,.xlsx,.xls,.json,.pdf,.xml,.tsv,.txt,.parquet,.avro,.jsonl';

// ─── Validation result types ──────────────────────────────────────────────────

/** Error attached to a specific file. */
export interface FileError {
  file:   File;
  reason: 'TOO_LARGE' | 'UNSUPPORTED_FORMAT' | 'EMPTY' | 'DUPLICATE' | 'MIME_MISMATCH';
  /** Human-readable message for display in DropZone */
  message: string;
}

/** Result of validating a single file. */
export interface SingleFileResult {
  valid:   boolean;
  error?:  FileError;
  /** Matched format definition if valid */
  format?: AcceptedFormatDef;
}

/** Result of validating an entire FileList drop or input change. */
export interface FileListResult {
  valid:    boolean;
  /** Files that passed all validation checks */
  accepted: File[];
  /** Files that failed with reasons */
  rejected: FileError[];
  /** Queue-level errors (count limit, etc.) */
  errors:   string[];
}

// ─── Options ──────────────────────────────────────────────────────────────────

export interface FileValidationOptions {
  /**
   * Number of files already in the queue.
   * Used to check if adding new files would exceed MAX_FILES.
   * @default 0
   */
  currentCount?: number;
  /**
   * Check for duplicate files (by name + size).
   * @default false
   */
  checkDuplicates?: boolean;
  /**
   * Names of files already in the queue — used for duplicate check.
   */
  existingNames?: Set<string>;
  /**
   * Warn on MIME type mismatch but do not reject.
   * @default true
   */
  warnMimeMismatch?: boolean;
}

// ─── Single-file validation ───────────────────────────────────────────────────

/**
 * Validate a single File against size, format, and optionally MIME type.
 *
 * @example
 * const result = validateFile(file);
 * if (!result.valid) showError(result.error!.message);
 */
export function validateFile(
  file:    File,
  options: FileValidationOptions = {},
): SingleFileResult {
  const { warnMimeMismatch = true, existingNames, checkDuplicates = false } = options;

  // ── 1. Empty file guard ────────────────────────────────────────────────────
  if (file.size === 0) {
    return {
      valid: false,
      error: {
        file,
        reason:  'EMPTY',
        message: `"${file.name}" is empty (0 bytes). Please upload a file with content.`,
      },
    };
  }

  // ── 2. File size ───────────────────────────────────────────────────────────
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const actualGB = (file.size / (1024 ** 3)).toFixed(2);
    return {
      valid: false,
      error: {
        file,
        reason:  'TOO_LARGE',
        message: `"${file.name}" is ${actualGB} GB — exceeds the 2 GB limit.`,
      },
    };
  }

  // ── 3. Extension whitelist ─────────────────────────────────────────────────
  const rawExt = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ACCEPTED_EXTS.has(rawExt)) {
    const allowed = ACCEPTED_FORMAT_DEFS.map(f => f.exts[0]).join(', ');
    return {
      valid: false,
      error: {
        file,
        reason:  'UNSUPPORTED_FORMAT',
        message: `"${file.name}" has unsupported format ".${rawExt}". Accepted: ${allowed}.`,
      },
    };
  }

  // ── 4. Find format definition ──────────────────────────────────────────────
  const format = ACCEPTED_FORMAT_DEFS.find(f => f.exts.includes(rawExt));

  // ── 5. MIME type cross-check (warning only) ────────────────────────────────
  if (warnMimeMismatch && format && file.type) {
    const mimeOk = format.mimes.some(m => file.type.startsWith(m));
    if (!mimeOk && file.type !== 'application/octet-stream') {
      // Non-fatal — browsers often report incorrect MIME types for uncommon formats
      console.warn(
        `[LumindAd] MIME mismatch for "${file.name}": ` +
        `expected one of [${format.mimes.join(', ')}] but got "${file.type}". ` +
        `Extension validation takes precedence.`,
      );
    }
  }

  // ── 6. Duplicate guard ─────────────────────────────────────────────────────
  if (checkDuplicates && existingNames) {
    const nameKey = `${file.name}:${file.size}`;
    if (existingNames.has(nameKey)) {
      return {
        valid: false,
        error: {
          file,
          reason:  'DUPLICATE',
          message: `"${file.name}" is already in the queue.`,
        },
      };
    }
  }

  return { valid: true, format };
}

// ─── FileList / batch validation ──────────────────────────────────────────────

/**
 * Validate a batch of files (from a drop event or file input).
 * Returns separated `accepted` and `rejected` arrays.
 *
 * @example
 * const result = validateFileList(e.dataTransfer.files, {
 *   currentCount: fileQueue.length,
 *   checkDuplicates: true,
 *   existingNames: new Set(fileQueue.map(f => `${f.name}:${f.size}`)),
 * });
 *
 * if (!result.valid) displayErrors(result.rejected.map(r => r.message));
 * addToQueue(result.accepted);
 */
export function validateFileList(
  files:   FileList | File[],
  options: FileValidationOptions = {},
): FileListResult {
  const {
    currentCount     = 0,
    checkDuplicates  = false,
    existingNames    = new Set<string>(),
    warnMimeMismatch = true,
  } = options;

  const arr: File[] = Array.from(files);

  const accepted: File[]       = [];
  const rejected: FileError[]  = [];
  const errors:   string[]     = [];

  // ── 1. Queue count pre-check ───────────────────────────────────────────────
  if (currentCount >= MAX_FILES) {
    errors.push(
      `Queue is full (${currentCount}/${MAX_FILES} files). ` +
      `Remove existing files before adding more.`,
    );
    return { valid: false, accepted: [], rejected: [], errors };
  }

  const slots = MAX_FILES - currentCount;

  // ── 2. Count cap: warn but still validate what fits ───────────────────────
  if (arr.length > slots) {
    errors.push(
      `You dropped ${arr.length} file${arr.length > 1 ? 's' : ''} but only ${slots} ` +
      `slot${slots > 1 ? 's' : ''} remain${slots === 1 ? 's' : ''}. ` +
      `The first ${slots} eligible file${slots > 1 ? 's' : ''} will be added.`,
    );
  }

  // ── 3. Per-file validation ─────────────────────────────────────────────────
  // Track duplicate names seen in THIS drop batch
  const batchNames = new Set<string>(existingNames);

  for (const file of arr) {
    if (accepted.length >= slots) break; // Respect slot limit

    const result = validateFile(file, {
      checkDuplicates,
      existingNames:   batchNames,
      warnMimeMismatch,
    });

    if (result.valid) {
      accepted.push(file);
      if (checkDuplicates) {
        batchNames.add(`${file.name}:${file.size}`);
      }
    } else {
      rejected.push(result.error!);
    }
  }

  return {
    valid:    rejected.length === 0 && errors.length === 0,
    accepted,
    rejected,
    errors,
  };
}

// ─── Format helpers ───────────────────────────────────────────────────────────

/**
 * Get format definition for a file by extension.
 *
 * @example
 * getFormat('sales.xlsx')  → { ext: 'Excel', icon: '📗', color: '#22c55e', ... }
 * getFormat('data.csv')    → { ext: 'CSV',   icon: '📊', color: '#10b981', ... }
 */
export function getFormat(fileName: string): AcceptedFormatDef | undefined {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return ACCEPTED_FORMAT_DEFS.find(f => f.exts.includes(ext));
}

/**
 * Accent colour for a file's extension.
 * Mirrors LumindAd.jsx line 708: `typeColor = t => ACCEPTED_FORMATS.find(...)`
 *
 * @example
 * formatColor('data.csv')    → '#10b981'
 * formatColor('report.xlsx') → '#22c55e'
 * formatColor('unknown.bin') → '#94a3b8'  (fallback)
 */
export function formatColor(fileName: string): string {
  return getFormat(fileName)?.color ?? '#94a3b8';
}

/**
 * Emoji icon for a file's extension.
 *
 * @example
 * formatIcon('events.jsonl')  → '💙'
 * formatIcon('data.parquet')  → '🟡'
 */
export function formatIcon(fileName: string): string {
  return getFormat(fileName)?.icon ?? '📄';
}

/**
 * Uppercase extension label for UI display.
 * LumindAd.jsx FileQueue item: shows "CSV", "Excel", "JSONL" etc.
 *
 * @example
 * formatLabel('sales.xlsx')   → 'Excel'
 * formatLabel('data.csv')     → 'CSV'
 * formatLabel('unknown.xyz')  → 'XYZ'
 */
export function formatLabel(fileName: string): string {
  const def = getFormat(fileName);
  if (def) return def.ext;
  const ext = fileName.split('.').pop()?.toUpperCase() ?? 'FILE';
  return ext;
}

/**
 * Returns true if a file format is browser-parseable (no backend required).
 * PARQUET and AVRO require backend processing.
 * LumindAd.jsx footer: "📡 Compatible: Telecom X ML Pipeline"
 *
 * @example
 * isBrowserParseable('data.csv')      → true
 * isBrowserParseable('data.parquet')  → false
 */
export function isBrowserParseable(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return !['parquet', 'avro'].includes(ext);
}

/**
 * Returns a performance warning for large files.
 * Used to show advisory messages before processing starts.
 *
 * @example
 * const warn = formatWarning(file);
 * // → "Excel files over 100K rows may take several minutes."
 */
export function formatWarning(file: File): string | null {
  const def = getFormat(file.name);
  if (!def) return null;

  // Excel is significantly slower than CSV for large datasets
  if (['xlsx', 'xls'].includes(file.name.split('.').pop()?.toLowerCase() ?? '')) {
    if (file.size > 50 * 1024 * 1024) {  // > 50 MB
      return 'Large Excel files may take several minutes. Consider converting to CSV for faster processing.';
    }
  }

  // PDF is document extraction, not tabular
  if (file.name.endsWith('.pdf')) {
    return 'PDF files are extracted as text — row counts reflect text blocks, not data rows.';
  }

  // Binary columnar formats need backend
  if (!isBrowserParseable(file.name)) {
    return `${def.ext} files are processed server-side for optimal performance.`;
  }

  return null;
}
