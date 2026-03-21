/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Services · uploadService
 *  src/services/uploadService.ts
 *
 *  Purpose
 *   API client for file upload, chunked processing, and pipeline
 *   ingestion. Consumed by UploadPage, useChunkedUpload, and the
 *   ML pipeline bridge that feeds processed rows into analyticsStore.
 *
 *  Upload flow
 *   1. initUpload(file)    → UploadSession { sessionId, chunkSize, totalChunks }
 *   2. uploadChunk(...)    → ChunkAck      { received, offset }  (loop)
 *   3. finalizeUpload(...) → ProcessingJob { jobId, status }
 *   4. pollJob(jobId)      → JobStatus     { progress, rows, status }
 *   5. getResult(jobId)    → UploadResult  { totalRows, schema, preview }
 *
 *  Accepted formats (LumindAd.jsx lines 126–134)
 *   CSV · Excel (XLSX/XLS) · JSON · PDF · XML · TSV · TXT
 *   Parquet · Avro · JSONL
 *   Max file size: 2GB   Max files: 10   Max rows: 10M
 *
 *  Benchmark targets (LumindAd.jsx lines 851–854)
 *   10K rows  → 0.5s  · 20 MB
 *   100K rows → 3s    · 80 MB
 *   1M rows   → 18s   · 180 MB
 *   10M rows  → 3 min · 1.5 GB
 *
 *  Chunked processing constants (LumindAd.jsx lines 688, 694)
 *   CHUNK_ROWS = 50,000 rows per interval tick
 *   interval stagger = 200 + fileIndex * 120 ms
 *   totalRows = Math.floor(Math.random() * 900000) + 50000
 *
 *  ML Pipeline compatibility (LumindAd.jsx line 872)
 *   "📡 Compatible: Telecom X ML Pipeline"
 *   After finalize, processed rows can be forwarded directly to
 *   the ML pipeline endpoint for churn prediction and anomaly detection.
 *   exportToMLPipeline(jobId) handles this bridge call.
 *
 *  Gzip compression (LumindAd.jsx footer badge "🗜 Gzip compression")
 *   Chunks are compressed with CompressionStream('gzip') before upload
 *   when the browser supports it. Falls back to raw binary.
 *   Content-Encoding header is set accordingly.
 *
 *  Instances
 *   Uses uploadApi (5-min timeout) from api.ts — NOT the default `api`
 *   instance — to handle the extended time for large file uploads.
 *
 *  Seed mode (VITE_USE_SEED_DATA=true)
 *   Simulates the full upload flow with the same timing as
 *   UploadPage.processData: interval 200+fi*120ms, CHUNK_ROWS 50000,
 *   totalRows random 50K–950K. No real HTTP calls are made.
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { uploadApi, api } from './api';
import type { UploadFileItem } from '../store/uploadStore';
import {
  MAX_UPLOAD_FILES,
  CHUNK_ROWS,
} from '../store/uploadStore';

// ─── Config ───────────────────────────────────────────────────────────────────

const USE_SEED   = import.meta.env.VITE_USE_SEED_DATA === 'true';
const simDelay   = (ms = 400) => new Promise<void>((r) => setTimeout(r, ms));

/** Max individual file size: 2 GB — LumindAd.jsx line 747 */
export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024;

/** Max rows per upload job — LumindAd.jsx line 717 */
export const MAX_ROWS = 10_000_000;

// ─── Accepted formats (LumindAd.jsx lines 126–134) ───────────────────────────

export interface AcceptedFormat {
  ext:   string;
  icon:  string;
  color: string;
  /** MIME types that map to this extension */
  mime:  string[];
}

export const ACCEPTED_FORMATS: AcceptedFormat[] = [
  { ext: 'CSV',      icon: '📊', color: '#10b981', mime: ['text/csv', 'application/csv'] },
  { ext: 'Excel',    icon: '📗', color: '#22c55e', mime: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'] },
  { ext: 'JSON',     icon: '🔵', color: '#3b82f6', mime: ['application/json'] },
  { ext: 'PDF',      icon: '🔴', color: '#ef4444', mime: ['application/pdf'] },
  { ext: 'XML',      icon: '🟠', color: '#f97316', mime: ['text/xml', 'application/xml'] },
  { ext: 'TSV',      icon: '🟣', color: '#a855f7', mime: ['text/tab-separated-values'] },
  { ext: 'TXT',      icon: '⬜', color: '#94a3b8', mime: ['text/plain'] },
  { ext: 'Parquet',  icon: '🟡', color: '#eab308', mime: ['application/octet-stream'] },
  { ext: 'Avro',     icon: '🩵', color: '#06b6d4', mime: ['application/octet-stream'] },
  { ext: 'JSONL',    icon: '💙', color: '#60a5fa', mime: ['application/jsonlines', 'application/x-ndjson'] },
  { ext: 'Notebook', icon: '📓', color: '#ff6f00', mime: ['application/x-ipynb+json'] },
];

/** HTML accept attribute string for the hidden file input */
export const FILE_INPUT_ACCEPT =
  '.csv,.xlsx,.xls,.json,.pdf,.xml,.tsv,.txt,.parquet,.avro,.jsonl,.ipynb';

// ─── Benchmark targets (LumindAd.jsx lines 851–854) ──────────────────────────

export interface BenchmarkEntry {
  size:  string;
  time:  string;
  mem:   string;
  ui:    string;
  rows:  number;   // numeric for comparisons
}

export const BENCHMARK_DATA: BenchmarkEntry[] = [
  { size: '10K rows',  time: '0.5s',  mem: '20 MB',  ui: '✅', rows: 10_000    },
  { size: '100K rows', time: '3s',    mem: '80 MB',  ui: '✅', rows: 100_000   },
  { size: '1M rows',   time: '18s',   mem: '180 MB', ui: '✅', rows: 1_000_000 },
  { size: '10M rows',  time: '3 min', mem: '1.5 GB', ui: '✅', rows: 10_000_000},
];

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface UploadInitRequest {
  fileName:  string;
  fileSize:  number;
  mimeType:  string;
  fileIndex: number;   // 0-based — used for stagger: 200 + fi * 120
}

export interface UploadSession {
  sessionId:   string;
  chunkSize:   number;    // bytes per chunk
  totalChunks: number;
  expiresAt:   number;    // unix ms
}

export interface ChunkAck {
  sessionId: string;
  chunkIdx:  number;
  received:  number;    // bytes
  offset:    number;    // total bytes received so far
}

export type JobStatus = 'queued' | 'processing' | 'done' | 'error' | 'cancelled';

export interface ProcessingJob {
  jobId:      string;
  sessionId:  string;
  status:     JobStatus;
  queuePos?:  number;
}

export interface JobPollResult {
  jobId:     string;
  status:    JobStatus;
  progress:  number;     // 0–100
  rows:      number;     // rows processed so far
  totalRows: number;     // estimated total
  errorMsg?: string;
}

export interface ColumnSchema {
  name:     string;
  type:     'string' | 'number' | 'boolean' | 'date' | 'null';
  nullable: boolean;
  samples:  unknown[];
}

export interface UploadResult {
  jobId:     string;
  totalRows: number;
  columns:   ColumnSchema[];
  /** First 5 rows as preview — displayed in FileQueue after processing */
  preview:   Record<string, unknown>[];
  fileSize:  number;
  duration:  number;    // ms
  format:    string;    // e.g. 'CSV'
}

export interface MLPipelineExport {
  jobId:       string;
  pipelineId:  string;
  rowsForwarded: number;
  status:      'accepted' | 'queued' | 'error';
  endpoint:    string;
}

/** Progress callback type — matches useChunkedUpload onProgress signature */
export type ProgressCallback = (fileId: string, progress: number, rows: number, totalRows: number) => void;

// ─── Gzip compression helper ──────────────────────────────────────────────────

/**
 * Compresses a Uint8Array using the browser's CompressionStream API.
 * Falls back to the original data if CompressionStream is unavailable.
 * LumindAd.jsx footer badge: "🗜 Gzip compression"
 */
async function gzipCompress(data: Uint8Array): Promise<{ data: Uint8Array; compressed: boolean }> {
  if (typeof CompressionStream === 'undefined') {
    return { data, compressed: false };
  }
  try {
    const cs     = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    const reader = cs.readable.getReader();

    writer.write(data as unknown as Uint8Array<ArrayBuffer>);
    writer.close();

    const chunks: Uint8Array[] = [];
    let done = false;
    while (!done) {
      const { value, done: d } = await reader.read();
      if (value) chunks.push(value);
      done = d;
    }

    const total  = chunks.reduce((s, c) => s + c.length, 0);
    const merged = new Uint8Array(total);
    let offset   = 0;
    for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }

    return { data: merged, compressed: true };
  } catch {
    return { data, compressed: false };
  }
}

// ─── File validation ──────────────────────────────────────────────────────────

export interface ValidationResult {
  valid:   boolean;
  errors:  string[];
}

/**
 * Validates a FileList before upload.
 * Checks: count ≤ MAX_UPLOAD_FILES, each file ≤ 2GB, accepted extension.
 *
 * @example
 * const { valid, errors } = validateFiles(event.dataTransfer.files);
 * if (!valid) showErrors(errors);
 */
export function validateFiles(
  files:   FileList | File[],
  current: number = 0,
): ValidationResult {
  const errors: string[] = [];
  const arr = Array.from(files);

  if (current + arr.length > MAX_UPLOAD_FILES) {
    errors.push(
      `Maximum ${MAX_UPLOAD_FILES} files allowed. Queue has ${current}, adding ${arr.length} would exceed limit.`,
    );
  }

  for (const f of arr) {
    if (f.size > MAX_FILE_SIZE_BYTES) {
      errors.push(`"${f.name}" exceeds the 2 GB limit (${(f.size / 1e9).toFixed(2)} GB).`);
    }

    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    // Normalise extension aliases to their ACCEPTED_FORMATS label
    const normalised = (ext === 'xlsx' || ext === 'xls') ? 'Excel'
                     : ext === 'ipynb' ? 'Notebook'
                     : ext.toUpperCase();
    const supported = ACCEPTED_FORMATS.some(
      (af) => af.ext.toUpperCase() === normalised.toUpperCase(),
    );
    if (!supported) {
      errors.push(`"${f.name}" has unsupported format ".${ext}".`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Format helpers ───────────────────────────────────────────────────────────

/**
 * Human-readable file size.
 * Mirrors LumindAd.jsx line 707 `fmtSize`:
 *   b > 1e6 → "X.X MB"  else → "X KB"
 *
 * @example fmtSize(2_400_000) → "2.4 MB"
 * @example fmtSize(45_000)    → "45 KB"
 */
export function fmtSize(bytes: number): string {
  if (bytes > 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${(bytes / 1e3).toFixed(0)} KB`;
}

/**
 * Returns the type label for a filename.
 * Mirrors LumindAd.jsx typeColor helper — normalises XLSX/XLS → "Excel".
 *
 * @example typeLabel('report.xlsx')   → "Excel"
 * @example typeLabel('data.csv')      → "CSV"
 * @example typeLabel('model.parquet') → "Parquet"
 */
export function typeLabel(fileName: string): string {
  const ext = fileName.split('.').pop()?.toUpperCase() ?? '';
  if (ext === 'XLSX' || ext === 'XLS') return 'Excel';
  if (ext === 'IPYNB') return 'Notebook';
  const match = ACCEPTED_FORMATS.find((f) => f.ext.toUpperCase() === ext);
  return match ? match.ext : ext;
}

/**
 * Returns the brand colour for a file type.
 * Mirrors LumindAd.jsx `typeColor` helper (line 708).
 *
 * @example typeColor('CSV')     → '#10b981'
 * @example typeColor('Excel')   → '#22c55e'
 * @example typeColor('Unknown') → '#94a3b8'
 */
export function typeColor(ext: string): string {
  const match = ACCEPTED_FORMATS.find((f) => f.ext === ext);
  return match?.color ?? '#94a3b8';
}

// ─── Service ──────────────────────────────────────────────────────────────────

const uploadService = {
  /**
   * Initialise an upload session with the server.
   * Returns chunk size and session ID for subsequent uploadChunk calls.
   *
   * @example
   * const session = await uploadService.initUpload({
   *   fileName:  'data.csv',
   *   fileSize:  45_000_000,
   *   mimeType:  'text/csv',
   *   fileIndex: 0,
   * });
   * // session.sessionId  → 'sess_k5j2x8...'
   * // session.chunkSize  → 5_242_880  (5 MB)
   * // session.totalChunks → 9
   */
  async initUpload(req: UploadInitRequest): Promise<UploadSession> {
    if (USE_SEED) {
      await simDelay(150);
      const chunkSize = 5 * 1024 * 1024;   // 5 MB
      return {
        sessionId:   `sess_${Date.now().toString(36)}`,
        chunkSize,
        totalChunks: Math.ceil(req.fileSize / chunkSize),
        expiresAt:   Date.now() + 24 * 60 * 60 * 1000,
      };
    }
    const { data } = await uploadApi.post<UploadSession>('/upload/init', req);
    return data;
  },

  /**
   * Upload a single binary chunk.
   * Automatically applies gzip compression when available.
   * Uses uploadApi (5-min timeout) for large payloads.
   *
   * @example
   * const buffer = await file.arrayBuffer();
   * const chunk  = buffer.slice(offset, offset + chunkSize);
   * const ack = await uploadService.uploadChunk(sessionId, chunkIdx, new Uint8Array(chunk));
   */
  async uploadChunk(
    sessionId: string,
    chunkIdx:  number,
    data:      Uint8Array,
  ): Promise<ChunkAck> {
    if (USE_SEED) {
      await simDelay(30 + Math.random() * 20);
      return {
        sessionId,
        chunkIdx,
        received: data.length,
        offset:   chunkIdx * data.length + data.length,
      };
    }

    const { data: compressed, compressed: isGzip } = await gzipCompress(data);
    const formData = new FormData();
    formData.append('sessionId', sessionId);
    formData.append('chunkIdx',  String(chunkIdx));
    formData.append('chunk',     new Blob([compressed.buffer as ArrayBuffer]));

    const headers: Record<string, string> = {};
    if (isGzip) headers['Content-Encoding'] = 'gzip';

    const { data: ack } = await uploadApi.post<ChunkAck>(
      '/upload/chunk',
      formData,
      { headers },
    );
    return ack;
  },

  /**
   * Signal that all chunks have been uploaded. Starts the processing job.
   *
   * @example
   * const job = await uploadService.finalizeUpload(sessionId, file.name);
   * // job.jobId  → 'job_ab3xk9...'
   * // job.status → 'queued'
   */
  async finalizeUpload(
    sessionId: string,
    fileName:  string,
  ): Promise<ProcessingJob> {
    if (USE_SEED) {
      await simDelay(200);
      return {
        jobId:     `job_${Date.now().toString(36)}`,
        sessionId,
        status:    'queued',
        queuePos:  1,
      };
    }
    const { data } = await api.post<ProcessingJob>('/upload/finalize', {
      sessionId,
      fileName,
    });
    return data;
  },

  /**
   * Poll a processing job for progress updates.
   * Call at the same interval as the setInterval stagger:
   *   200 + fileIndex * 120 ms — mirrors LumindAd.jsx line 694.
   *
   * @example
   * // Polling loop
   * const poll = setInterval(async () => {
   *   const status = await uploadService.pollJob(jobId);
   *   updateFile(fileId, { progress: status.progress, rows: status.rows });
   *   if (status.status === 'done' || status.status === 'error') {
   *     clearInterval(poll);
   *   }
   * }, 200 + fileIndex * 120);
   */
  async pollJob(jobId: string): Promise<JobPollResult> {
    if (USE_SEED) {
      await simDelay(60);
      // Simulated progress — caller manages actual state via useChunkedUpload
      return {
        jobId,
        status:    'processing',
        progress:  0,
        rows:      0,
        totalRows: Math.floor(Math.random() * 900_000) + 50_000,
      };
    }
    const { data } = await api.get<JobPollResult>(`/upload/jobs/${jobId}`);
    return data;
  },

  /**
   * Fetch the final result of a completed job.
   * Returns schema, total row count, and a 5-row preview.
   *
   * @example
   * const result = await uploadService.getResult(jobId);
   * // result.totalRows → 531_200
   * // result.columns[0] → { name:'customer_id', type:'string', nullable:false }
   * // result.preview[0] → { customer_id:'C-001', tenure:8, monthly_charges:85.4, ... }
   */
  async getResult(jobId: string): Promise<UploadResult> {
    if (USE_SEED) {
      await simDelay(300);
      return {
        jobId,
        totalRows: Math.floor(Math.random() * 900_000) + 50_000,
        columns:   [
          { name: 'customer_id',     type: 'string',  nullable: false, samples: ['C-001', 'C-002'] },
          { name: 'tenure',          type: 'number',  nullable: false, samples: [8, 24, 36] },
          { name: 'monthly_charges', type: 'number',  nullable: false, samples: [85.4, 65.2] },
          { name: 'churn',           type: 'boolean', nullable: false, samples: [true, false] },
        ],
        preview:  [],
        fileSize: 0,
        duration: 800,
        format:   'CSV',
      };
    }
    const { data } = await api.get<UploadResult>(`/upload/jobs/${jobId}/result`);
    return data;
  },

  /**
   * Cancel an in-progress job.
   *
   * @example
   * await uploadService.cancelJob(jobId);
   * useUploadStore.getState().updateFile(fileId, { status:'error' });
   */
  async cancelJob(jobId: string): Promise<void> {
    if (USE_SEED) { await simDelay(100); return; }
    await api.delete(`/upload/jobs/${jobId}`);
  },

  /**
   * High-level convenience: process a single File end-to-end,
   * reporting progress via `onProgress` at each chunk and poll tick.
   * Uses CHUNK_ROWS and stagger timing from the LumindAd.jsx prototype.
   *
   * In seed mode, uses the exact setInterval logic from LumindAd.jsx
   * lines 688–704: 50K rows/tick, stagger 200+fi*120ms, random totalRows.
   *
   * @param file      - Raw File object
   * @param fileId    - Store ID from UploadFileItem.id
   * @param fileIndex - Position in queue (for stagger: 200 + fi * 120)
   * @param onProgress - Called each tick with (fileId, progress%, rows, totalRows)
   * @returns Promise resolving to UploadResult when done
   *
   * @example
   * // UploadPage — process all ready files
   * await Promise.all(
   *   readyFiles.map((f, fi) =>
   *     uploadService.processFile(f.file!, f.id, fi, (id, pct, rows, total) => {
   *       useUploadStore.getState().updateFile(id, { progress: pct, rows, status: pct < 100 ? 'processing' : 'done' });
   *     })
   *   )
   * );
   */
  processFile(
    file:       File,
    fileId:     string,
    fileIndex:  number,
    onProgress: ProgressCallback,
  ): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      if (USE_SEED) {
        // ── Seed: mirrors LumindAd.jsx lines 688–704 exactly ────────
        const totalRows = Math.floor(Math.random() * 900_000) + 50_000;
        let   processed = 0;
        const intervalMs = 200 + fileIndex * 120;   // LumindAd.jsx line 694

        const iid = setInterval(() => {
          processed = Math.min(processed + CHUNK_ROWS, totalRows);
          const progress = Math.round((processed / totalRows) * 100);
          const isDone   = progress >= 100;

          onProgress(fileId, isDone ? 100 : progress, processed, totalRows);

          if (isDone) {
            clearInterval(iid);
            resolve({
              jobId:     `job_${fileId}`,
              totalRows,
              columns:   [],
              preview:   [],
              fileSize:  file.size,
              duration:  totalRows / CHUNK_ROWS * intervalMs,
              format:    typeLabel(file.name),
            });
          }
        }, intervalMs);
        return;
      }

      // ── Real API: init → chunks → finalize → poll → result ───────
      (async () => {
        try {
          const session = await uploadService.initUpload({
            fileName:  file.name,
            fileSize:  file.size,
            mimeType:  file.type,
            fileIndex,
          });

          const buffer = await file.arrayBuffer();
          const bytes  = new Uint8Array(buffer);

          for (let i = 0; i < session.totalChunks; i++) {
            const start = i * session.chunkSize;
            const end   = Math.min(start + session.chunkSize, bytes.length);
            await uploadService.uploadChunk(session.sessionId, i, bytes.slice(start, end));
            // Upload progress (0–50%): chunk upload takes half the progress budget
            const uploadPct = Math.round(((i + 1) / session.totalChunks) * 50);
            onProgress(fileId, uploadPct, 0, 0);
          }

          const job = await uploadService.finalizeUpload(session.sessionId, file.name);

          const intervalMs = 200 + fileIndex * 120;
          await new Promise<void>((res, rej) => {
            const poll = setInterval(async () => {
              try {
                const status = await uploadService.pollJob(job.jobId);
                // Processing progress (50–100%): second half of progress budget
                const processPct = 50 + Math.round(status.progress / 2);
                onProgress(fileId, processPct, status.rows, status.totalRows);

                if (status.status === 'done') { clearInterval(poll); res(); }
                if (status.status === 'error') { clearInterval(poll); rej(new Error(status.errorMsg)); }
              } catch (e) { clearInterval(poll); rej(e); }
            }, intervalMs);
          });

          const result = await uploadService.getResult(job.jobId);
          onProgress(fileId, 100, result.totalRows, result.totalRows);
          resolve(result);
        } catch (e) { reject(e); }
      })();
    });
  },

  /**
   * Forward processed data directly to the Telecom X ML Pipeline.
   * "📡 Compatible: Telecom X ML Pipeline" — LumindAd.jsx line 872.
   * Called after all files are done when user clicks "Export Results".
   *
   * @example
   * const export = await uploadService.exportToMLPipeline(jobId);
   * // export.rowsForwarded → 531_200
   * // export.status        → 'accepted'
   * // export.endpoint      → 'https://telecomx.pipeline/ingest'
   */
  async exportToMLPipeline(jobId: string): Promise<MLPipelineExport> {
    if (USE_SEED) {
      await simDelay(800);
      return {
        jobId,
        pipelineId:    `pipe_${Date.now().toString(36)}`,
        rowsForwarded: Math.floor(Math.random() * 900_000) + 50_000,
        status:        'accepted',
        endpoint:      'https://telecomx.pipeline/ingest',
      };
    }
    const { data } = await api.post<MLPipelineExport>(
      `/upload/jobs/${jobId}/export-ml`,
    );
    return data;
  },

  /**
   * Delete a completed upload and its processed data from the server.
   *
   * @example
   * await uploadService.deleteUpload(jobId);
   */
  async deleteUpload(jobId: string): Promise<void> {
    if (USE_SEED) { await simDelay(200); return; }
    await api.delete(`/upload/jobs/${jobId}`);
  },

  // ── Format utilities (re-exported for component use) ─────────────────────

  validateFiles,
  fmtSize,
  typeLabel,
  typeColor,
  ACCEPTED_FORMATS,
  BENCHMARK_DATA,
  FILE_INPUT_ACCEPT,
};

export default uploadService;
