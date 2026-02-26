/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · types/upload.ts
 *  src/types/upload.ts
 *
 *  Canonical TypeScript types for the Upload domain.
 *  Aggregates types from two sources + defines the Web Worker
 *  message protocol shared by all three workers.
 *
 *  Re-exported from
 *   • store/uploadStore        — FileItem queue, session history
 *   • services/uploadService   — chunked upload flow, ML pipeline
 *
 *  New types defined here
 *   ─ Worker message protocol ─────────────────────────────────
 *   • ParseFormat              — file format enum for worker routing
 *   • WorkerInMessage          — messages sent main → worker
 *   • WorkerOutMessage         — messages sent worker → main
 *   • WorkerParseOptions       — per-format parse options
 *
 *   ─ Drop zone ───────────────────────────────────────────────
 *   • DropZoneState            — idle | dragover | error
 *   • FileRejection            — reason a file was rejected
 *
 *   ─ Processing pipeline ────────────────────────────────────
 *   • ParsedChunk              — a batch of rows with schema info
 *   • ProcessingStats          — running stats during processing
 *   • FileProcessingResult     — final result per file
 *
 *  Worker message protocol design
 *   All three workers (csvParser, xlsxParser, chunkProcessor)
 *   share the SAME inbound/outbound message types so that
 *   useWebWorker hook can manage them uniformly.
 *
 *   Main → Worker
 *     { type:'PARSE',   fileId, buffer, fileName, options }
 *     { type:'ABORT',   fileId }
 *     { type:'PING' }               — health check
 *
 *   Worker → Main
 *     { type:'PROGRESS', fileId, rowsProcessed, totalRows, progress }
 *     { type:'CHUNK',    fileId, chunkIndex, rows, columns? }
 *     { type:'DONE',     fileId, totalRows, columns, preview, durationMs }
 *     { type:'ERROR',    fileId, error, recoverable }
 *     { type:'PONG' }               — response to PING
 *
 *  Usage
 *   import type { WorkerInMessage, WorkerOutMessage } from '@/types/upload';
 *
 *   // Inside a worker file:
 *   self.onmessage = (e: MessageEvent<WorkerInMessage>) => { ... }
 *   self.postMessage({ type:'PROGRESS', ... } satisfies WorkerOutMessage);
 *
 *   // In a component / hook:
 *   worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => { ... }
 *   worker.postMessage({ type:'PARSE', ... } satisfies WorkerInMessage);
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ─── Re-exports: store/uploadStore.ts ────────────────────────────────────────

export type {
  UploadFileStatus,
  UploadFileItem,
  UploadSession as UploadHistorySession,
} from '../store/uploadStore';

export {
  MAX_UPLOAD_FILES,
  CHUNK_ROWS,
  buildUploadItem,
} from '../store/uploadStore';

// ─── Re-exports: services/uploadService.ts ───────────────────────────────────

export type {
  AcceptedFormat,
  BenchmarkEntry,
  UploadInitRequest,
  UploadSession,
  ChunkAck,
  JobStatus,
  ProcessingJob,
  JobPollResult,
  ColumnSchema,
  UploadResult,
  MLPipelineExport,
  ValidationResult,
  ProgressCallback,
} from '../services/uploadService';

export {
  MAX_FILE_SIZE_BYTES,
  MAX_ROWS,
  ACCEPTED_FORMATS,
  FILE_INPUT_ACCEPT,
  BENCHMARK_DATA,
  validateFiles,
  fmtSize,
  typeLabel,
  typeColor,
} from '../services/uploadService';

// ─── File format enum ─────────────────────────────────────────────────────────
// LumindAd.jsx ACCEPTED_FORMATS lines 126–134 → 10 supported formats.

/**
 * File format parsed by the worker layer.
 * chunkProcessor.worker.ts reads the file extension and routes
 * to the appropriate parser internally or delegates to csvParser/xlsxParser.
 *
 * @example
 * const fmt: ParseFormat = 'CSV';
 * // → routed to csvParser.worker.ts
 */
export type ParseFormat =
  | 'CSV'
  | 'XLSX'
  | 'XLS'
  | 'JSON'
  | 'JSONL'
  | 'TSV'
  | 'TXT'
  | 'XML'
  | 'PARQUET'
  | 'AVRO'
  | 'UNKNOWN';

// ─── Worker parse options ─────────────────────────────────────────────────────

/**
 * Per-format parse options passed in the PARSE message.
 *
 * CSV / TSV options
 *   delimiter   — ',' for CSV, '\t' for TSV (default auto-detected)
 *   hasHeader   — first row is header (default: true)
 *   encoding    — TextDecoder label (default: 'utf-8')
 *
 * JSON / JSONL options
 *   rootPath    — dot-path to the array e.g. 'data.records' (default: auto)
 *
 * XLSX options
 *   sheetIndex  — 0-based sheet to parse (default: 0)
 *   dateNF      — date number format string for SheetJS
 *
 * General
 *   chunkRows   — rows per batch (default: CHUNK_ROWS = 50000 from LumindAd.jsx)
 *   maxRows     — abort after N rows (default: MAX_ROWS = 10_000_000)
 *   previewRows — rows to include in DONE.preview (default: 5)
 *
 * @example
 * const opts: WorkerParseOptions = {
 *   chunkRows:   50_000,
 *   hasHeader:   true,
 *   delimiter:   ',',
 *   previewRows: 5,
 * };
 */
export interface WorkerParseOptions {
  // General
  chunkRows?:   number;    // default: 50_000
  maxRows?:     number;    // default: 10_000_000
  previewRows?: number;    // default: 5

  // CSV / TSV
  delimiter?:   string;    // default: auto-detect
  hasHeader?:   boolean;   // default: true
  encoding?:    string;    // default: 'utf-8'

  // JSON / JSONL
  rootPath?:    string;    // default: auto

  // XLSX
  sheetIndex?:  number;    // default: 0
  dateNF?:      string;    // SheetJS date format
}

// ─── Worker inbound messages (main → worker) ──────────────────────────────────

/**
 * Parse a file — the primary task message.
 * The ArrayBuffer is transferred (zero-copy) via the Transferable mechanism.
 *
 * @example
 * worker.postMessage(
 *   { type: 'PARSE', fileId: 'abc', buffer, fileName: 'sales.csv', options: {} },
 *   [buffer]   // ← transfer list
 * );
 */
export interface WorkerParseMessage {
  type:     'PARSE';
  fileId:   string;
  /** File content as ArrayBuffer — transferred, not copied */
  buffer:   ArrayBuffer;
  /** Full file name including extension — used for format detection */
  fileName: string;
  options?: WorkerParseOptions;
}

/**
 * Abort an in-progress parse.
 * The worker sets an internal `aborted` flag checked between chunks.
 *
 * @example
 * worker.postMessage({ type: 'ABORT', fileId: 'abc' });
 */
export interface WorkerAbortMessage {
  type:   'ABORT';
  fileId: string;
}

/**
 * Health-check ping — worker responds immediately with PONG.
 * Used by useWebWorker hook to detect worker crashes.
 */
export interface WorkerPingMessage {
  type: 'PING';
}

/** Discriminated union of all inbound worker messages */
export type WorkerInMessage =
  | WorkerParseMessage
  | WorkerAbortMessage
  | WorkerPingMessage;

// ─── Worker outbound messages (worker → main) ─────────────────────────────────

/**
 * Progress update — emitted after each chunk is parsed.
 * LumindAd.jsx line 694: `const progress = Math.round((processed / totalRows) * 100)`
 *
 * @example
 * // Worker:
 * self.postMessage({
 *   type: 'PROGRESS', fileId, rowsProcessed: 50000,
 *   totalRows: 340000, progress: 15,
 * });
 */
export interface WorkerProgressMessage {
  type:          'PROGRESS';
  fileId:        string;
  rowsProcessed: number;
  totalRows:     number;
  /** 0–100 integer */
  progress:      number;
}

/**
 * A parsed chunk ready for downstream processing.
 * Emitted after every CHUNK_ROWS rows.
 * Columns only present in chunkIndex === 0 (inferred from header row).
 *
 * @example
 * // Worker:
 * self.postMessage({
 *   type: 'CHUNK', fileId, chunkIndex: 0,
 *   rows: [{ name: 'Alice', age: 30 }, ...],
 *   columns: [{ name: 'name', type: 'string' }, { name: 'age', type: 'number' }],
 * });
 */
export interface WorkerChunkMessage {
  type:       'CHUNK';
  fileId:     string;
  chunkIndex: number;
  /** Parsed rows for this chunk */
  rows:       Record<string, unknown>[];
  /** Column schema — only populated on chunkIndex === 0 */
  columns?:   import('../services/uploadService').ColumnSchema[];
}

/**
 * Parsing complete — includes full schema and first `previewRows` rows.
 *
 * @example
 * // Worker:
 * self.postMessage({
 *   type: 'DONE', fileId, totalRows: 342_000,
 *   columns: [...], preview: firstFiveRows, durationMs: 4820,
 * });
 */
export interface WorkerDoneMessage {
  type:       'DONE';
  fileId:     string;
  totalRows:  number;
  columns:    import('../services/uploadService').ColumnSchema[];
  /** First N rows (N = options.previewRows, default 5) */
  preview:    Record<string, unknown>[];
  /** Wall-clock ms from PARSE received to DONE sent */
  durationMs: number;
}

/**
 * Parse error — includes whether the error is recoverable (e.g. encoding
 * issue that can be retried with a different encoding vs. corrupted file).
 *
 * @example
 * // Worker:
 * self.postMessage({
 *   type: 'ERROR', fileId, error: 'Unexpected token at row 1042',
 *   recoverable: false,
 * });
 */
export interface WorkerErrorMessage {
  type:        'ERROR';
  fileId:      string;
  error:       string;
  /** true → suggest retry; false → mark file as permanently failed */
  recoverable: boolean;
}

/**
 * PING response — sent immediately upon receiving a PING message.
 */
export interface WorkerPongMessage {
  type: 'PONG';
}

/** Discriminated union of all outbound worker messages */
export type WorkerOutMessage =
  | WorkerProgressMessage
  | WorkerChunkMessage
  | WorkerDoneMessage
  | WorkerErrorMessage
  | WorkerPongMessage;

// ─── Drop zone ────────────────────────────────────────────────────────────────

/**
 * Visual state of the DropZone component.
 * LumindAd.jsx line 723: `className={drop-zone ${dragging?'dragging':''}}`
 */
export type DropZoneState = 'idle' | 'dragover' | 'error';

/**
 * A file rejected by the validation gate before entering the queue.
 *
 * @example
 * const rejection: FileRejection = {
 *   file:   droppedFile,
 *   reason: 'File exceeds the 2 GB limit (3.4 GB).',
 * };
 */
export interface FileRejection {
  file:   File;
  reason: string;
}

// ─── Processing pipeline types ────────────────────────────────────────────────

/**
 * A batch of rows returned by a worker in a single CHUNK message.
 * Includes the chunk index and any schema info inferred from the batch.
 */
export interface ParsedChunk {
  chunkIndex: number;
  rows:       Record<string, unknown>[];
  columns?:   import('../services/uploadService').ColumnSchema[];
}

/**
 * Running statistics accumulated across chunks during processing.
 * Used by FileQueue to show live row counts and throughput.
 *
 * @example
 * const stats: ProcessingStats = {
 *   rowsProcessed: 150_000,
 *   chunksComplete: 3,
 *   bytesRead:     6_291_456,
 *   startedAt:     Date.now(),
 *   throughputRps: 12_400,   // rows/sec
 * };
 */
export interface ProcessingStats {
  rowsProcessed:  number;
  chunksComplete: number;
  bytesRead:      number;
  startedAt:      number;   // unix ms
  /** rows per second — recalculated on each PROGRESS message */
  throughputRps?: number;
}

/**
 * Final result per file after processing completes.
 * Stored in uploadStore.uploadHistory[].fileSummary.
 *
 * @example
 * const result: FileProcessingResult = {
 *   fileId:     'abc123',
 *   fileName:   'telecomx_q3.csv',
 *   totalRows:  342_000,
 *   columns:    [...],
 *   preview:    [...],
 *   durationMs: 4820,
 *   format:     'CSV',
 * };
 */
export interface FileProcessingResult {
  fileId:     string;
  fileName:   string;
  totalRows:  number;
  columns:    import('../services/uploadService').ColumnSchema[];
  preview:    Record<string, unknown>[];
  durationMs: number;
  format:     ParseFormat;
}
