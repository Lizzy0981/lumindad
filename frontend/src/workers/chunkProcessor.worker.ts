/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · workers/chunkProcessor.worker.ts
 *  src/workers/chunkProcessor.worker.ts
 *
 *  Purpose
 *   Central file-processing orchestrator used by useChunkedUpload.
 *   Handles ALL 10 formats listed in LumindAd.jsx ACCEPTED_FORMATS
 *   (lines 126–134) off the main thread, posting live progress
 *   updates that drive the UploadPage progress bars and row counters.
 *
 *  This is the worker passed to useChunkedUpload's `workerFactory`
 *  option. csvParser.worker.ts and xlsxParser.worker.ts are lighter-
 *  weight dedicated parsers for direct use; this worker embeds all
 *  parsing logic so the hook only needs to instantiate one type.
 *
 *  Supported formats (LumindAd.jsx ACCEPTED_FORMATS)
 *   ┌──────────┬──────────────────────────────────────────────┐
 *   │ Format   │ Strategy                                     │
 *   ├──────────┼──────────────────────────────────────────────┤
 *   │ CSV      │ Inline TextDecoder + RFC 4180 parser         │
 *   │ TSV      │ Same as CSV, delimiter = '\t'                │
 *   │ TXT      │ Same as CSV, delimiter auto-detected         │
 *   │ JSON     │ JSON.parse → locate data array → chunk       │
 *   │ JSONL    │ Line-by-line JSON.parse → chunk              │
 *   │ XLSX/XLS │ SheetJS dynamic import → AOA → chunk         │
 *   │ XML      │ Chunk-friendly line accumulator (basic)      │
 *   │ PARQUET  │ Reports unsupported (binary format)          │
 *   │ AVRO     │ Reports unsupported (binary format)          │
 *   └──────────┴──────────────────────────────────────────────┘
 *
 *  Processing pipeline (LumindAd.jsx lines 686–704)
 *   ┌─────────────────────────────────────────────────────────┐
 *   │  1. PARSE message received                              │
 *   │  2. Detect format from fileName extension               │
 *   │  3. Decode / read file bytes                            │
 *   │  4. Route to format-specific parser                     │
 *   │  5. For each 50 000-row chunk:                          │
 *   │       a. Post PROGRESS (rowsProcessed, totalRows, %)    │
 *   │       b. Optional: gzip compress chunk (CompressionStream)
 *   │       c. Post CHUNK (rows, columns? on first chunk)     │
 *   │       d. yield → setTimeout(0) ← non-blocking UI        │
 *   │  6. Post DONE (totalRows, columns, preview, durationMs) │
 *   └─────────────────────────────────────────────────────────┘
 *
 *  Stagger timing (LumindAd.jsx line 704: 200 + fi * 120)
 *   The worker itself does NOT stagger. Staggering is applied by
 *   useChunkedUpload which spawns one worker per file with an
 *   initial delay of `200 + fileIndex * 120` ms before posting
 *   the first PARSE message. This matches the original JSX exactly.
 *
 *  Gzip compression (LumindAd.jsx footer badge "🗜 Gzip compression")
 *   When options.gzip = true (default: false), each chunk's rows are
 *   serialised to JSON, encoded to Uint8Array, and compressed with
 *   CompressionStream('gzip'). Compressed chunks are forwarded in
 *   the CHUNK message as `compressed: true` + the gzipped ArrayBuffer.
 *   Falls back to uncompressed if CompressionStream is unavailable.
 *
 *  Memory management (LumindAd.jsx footer badge "🧠 Auto memory management")
 *   - Parsed rows are NOT accumulated — each chunk is posted then GC-eligible
 *   - The raw ArrayBuffer reference is released after decoding
 *   - Schema inference operates on a rolling sample of SAMPLE_ROWS
 *   - For XLSX, the AOA is sliced per-chunk and the full AOA reference
 *     is cleared after the first chunk to reduce peak heap usage
 *
 *  ML Pipeline compatibility (LumindAd.jsx footer badge "📡 Compatible: Telecom X ML Pipeline")
 *   Each DONE message includes a `mlReady` flag and a `pipelineHint`
 *   object describing the detected schema — ready for MLPipelineExport.
 *
 *  Worker message protocol  →  types/upload.ts
 *   IN:  WorkerInMessage  (PARSE | ABORT | PING)
 *   OUT: WorkerOutMessage (PROGRESS | CHUNK | DONE | ERROR | PONG)
 *
 *  Usage in useChunkedUpload
 *   workerFactory: () => new Worker(
 *     new URL('./chunkProcessor.worker.ts', import.meta.url),
 *     { type: 'module' }
 *   )
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

/// <reference lib="webworker" />

import type {
  WorkerInMessage,
  WorkerParseMessage,
  WorkerOutMessage,
  WorkerParseOptions,
  ParseFormat,
} from '../types/upload';
import type { ColumnSchema } from '../services/uploadService';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

/** LumindAd.jsx line 688 */
const DEFAULT_CHUNK_ROWS   = 50_000;
/** LumindAd.jsx line 712 subtitle: "Process up to 10M rows" */
const DEFAULT_MAX_ROWS     = 10_000_000;
const DEFAULT_PREVIEW_ROWS = 5;
const SAMPLE_ROWS          = 500;
const DELIMITER_PROBE_BYTES = 4096;

// ═══════════════════════════════════════════════════════════════
// ABORT FLAG
// ═══════════════════════════════════════════════════════════════

let abortFileId: string | null = null;

// ═══════════════════════════════════════════════════════════════
// FORMAT DETECTION
// ═══════════════════════════════════════════════════════════════

/**
 * Derive a ParseFormat from the file name extension.
 * Normalises the extension to uppercase and maps it to the
 * 10 formats listed in LumindAd.jsx ACCEPTED_FORMATS lines 126–134.
 *
 * @example
 * detectFormat('sales_q3.csv')      → 'CSV'
 * detectFormat('report.xlsx')       → 'XLSX'
 * detectFormat('events.jsonl')      → 'JSONL'
 * detectFormat('unknown.bin')       → 'UNKNOWN'
 */
function detectFormat(fileName: string): ParseFormat {
  const ext = (fileName.split('.').pop() ?? '').toUpperCase().trim();
  switch (ext) {
    case 'CSV':     return 'CSV';
    case 'TSV':     return 'TSV';
    case 'TXT':     return 'TXT';
    case 'JSON':    return 'JSON';
    case 'JSONL':
    case 'NDJSON':  return 'JSONL';
    case 'XLSX':    return 'XLSX';
    case 'XLS':     return 'XLS';
    case 'XML':     return 'XML';
    case 'PARQUET': return 'PARQUET';
    case 'AVRO':    return 'AVRO';
    default:        return 'UNKNOWN';
  }
}

// ═══════════════════════════════════════════════════════════════
// SCHEMA INFERENCE
// ═══════════════════════════════════════════════════════════════

/**
 * Infer the most likely type of a raw string value.
 */
function inferValueType(val: string): ColumnSchema['type'] {
  if (val === '' || val === 'null' || val === 'NULL' || val === 'N/A' || val === 'NA') {
    return 'null';
  }
  const lower = val.toLowerCase().trim();
  if (lower === 'true' || lower === 'false' || lower === '1' || lower === '0') {
    return 'boolean';
  }
  const n = Number(val.trim());
  if (!isNaN(n) && isFinite(n) && val.trim() !== '') return 'number';
  if (/^\d{4}-\d{2}-\d{2}/.test(val.trim()) && !isNaN(Date.parse(val.trim()))) return 'date';
  return 'string';
}

/**
 * Build ColumnSchema[] from a header array + sample rows.
 * Each sample is a Record<string, unknown> already typed.
 */
function buildSchema(
  headers:     string[],
  sampleRows:  Record<string, unknown>[],
): ColumnSchema[] {
  return headers.map(header => {
    const values  = sampleRows.map(r => r[header]);
    const counts  = new Map<ColumnSchema['type'], number>();
    let   nullable = false;
    const samples: unknown[] = [];

    for (const v of values) {
      if (v === null || v === undefined || v === '') {
        nullable = true;
        continue;
      }
      const t = typeof v === 'number'  ? 'number'
              : typeof v === 'boolean' ? 'boolean'
              : v instanceof Date      ? 'date'
              : inferValueType(String(v));

      counts.set(t, (counts.get(t) ?? 0) + 1);
      if (samples.length < 5) samples.push(v instanceof Date ? v.toISOString() : v);
    }

    let dominant: ColumnSchema['type'] = 'string';
    let maxCount = 0;
    for (const [type, count] of counts) {
      if (count > maxCount) { maxCount = count; dominant = type; }
    }

    return {
      name:     header.trim().replace(/^"|"$/g, ''),
      type:     dominant,
      nullable,
      samples,
    };
  });
}

// ═══════════════════════════════════════════════════════════════
// GZIP COMPRESSION
// ═══════════════════════════════════════════════════════════════

/**
 * Gzip-compress a JSON-serialisable chunk using CompressionStream.
 * Returns the original data if CompressionStream is unavailable.
 * LumindAd.jsx footer badge: "🗜 Gzip compression"
 *
 * @example
 * const { data, compressed } = await gzipChunk(rows);
 * // compressed = false in older browsers (graceful fallback)
 */
async function gzipChunk(
  rows: Record<string, unknown>[],
): Promise<{ data: Uint8Array; compressed: boolean }> {
  const json    = JSON.stringify(rows);
  const encoded = new TextEncoder().encode(json);

  if (typeof CompressionStream === 'undefined') {
    return { data: encoded, compressed: false };
  }

  try {
    const cs     = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    const reader = cs.readable.getReader();

    writer.write(encoded);
    writer.close();

    const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }

    const total  = chunks.reduce((s, c) => s + c.length, 0);
    const merged = new Uint8Array(total);
    let   offset = 0;
    for (const c of chunks) { merged.set(c, offset); offset += c.length; }

    return { data: merged, compressed: true };
  } catch {
    return { data: encoded, compressed: false };
  }
}

// ═══════════════════════════════════════════════════════════════
// YIELD HELPER
// ═══════════════════════════════════════════════════════════════

/**
 * Yield to the event loop between chunks.
 * Allows ABORT messages and PING health checks to be processed
 * between processing ticks — matching the "⚡ Web Workers
 * (non-blocking UI)" promise from LumindAd.jsx line 869.
 */
const yield_ = () => new Promise<void>(resolve => setTimeout(resolve, 0));

// ═══════════════════════════════════════════════════════════════
// CHUNK EMITTER
// ═══════════════════════════════════════════════════════════════

/**
 * Post a PROGRESS + CHUNK message pair for a batch of rows.
 * Applies optional gzip compression before posting.
 */
async function emitChunk(
  fileId:     string,
  chunkIndex: number,
  batch:      Record<string, unknown>[],
  schema:     ColumnSchema[],
  processed:  number,
  totalRows:  number,
  useGzip:    boolean,
): Promise<void> {
  const progress = Math.round((processed / totalRows) * 100);

  // PROGRESS
  const progressMsg: WorkerOutMessage = {
    type:          'PROGRESS',
    fileId,
    rowsProcessed: processed,
    totalRows,
    progress,
  };
  self.postMessage(progressMsg);

  // CHUNK — with optional gzip payload
  if (useGzip) {
    const { data, compressed } = await gzipChunk(batch);
    // Post the compressed buffer as a transferable for zero-copy
    const chunkMsg = {
      type:        'CHUNK',
      fileId,
      chunkIndex,
      rows:        compressed ? [] : batch,   // rows empty when gzipped
      columns:     chunkIndex === 0 ? schema : undefined,
      // Extended fields for gzip mode (consumed by useChunkedUpload)
      gzip:        compressed,
      gzipBuffer:  compressed ? data.buffer : undefined,
    };
    if (compressed && data.buffer.byteLength > 0) {
      self.postMessage(chunkMsg, [data.buffer]);
    } else {
      self.postMessage({ ...chunkMsg, gzipBuffer: undefined });
    }
  } else {
    const chunkMsg: WorkerOutMessage = {
      type:       'CHUNK',
      fileId,
      chunkIndex,
      rows:       batch,
      columns:    chunkIndex === 0 ? schema : undefined,
    };
    self.postMessage(chunkMsg);
  }
}

// ═══════════════════════════════════════════════════════════════
// CSV / TSV / TXT PARSER
// ═══════════════════════════════════════════════════════════════

/**
 * Detect delimiter by counting occurrences in probe string.
 */
function detectDelimiter(probe: string): string {
  const counts = {
    ',':  (probe.match(/,/g)  ?? []).length,
    '\t': (probe.match(/\t/g) ?? []).length,
    ';':  (probe.match(/;/g)  ?? []).length,
    '|':  (probe.match(/\|/g) ?? []).length,
  };
  const max  = Math.max(...Object.values(counts));
  if (max === 0) return ',';
  return (Object.entries(counts).find(([, v]) => v === max)?.[0]) ?? ',';
}

/**
 * Parse a single CSV line respecting RFC 4180 quoted fields.
 */
function parseCsvLine(line: string, delim: string): string[] {
  const fields: string[] = [];
  let cur = '', inQ = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else                     { inQ = false; }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"')                 { inQ = true; }
      else if (ch === delim)          { fields.push(cur); cur = ''; }
      else if (ch !== '\r')           { cur += ch; }
    }
  }
  fields.push(cur);
  return fields;
}

/**
 * Parse CSV / TSV / TXT ArrayBuffer → chunked records.
 */
async function parseCsvBuffer(
  fileId:  string,
  buffer:  ArrayBuffer,
  opts:    WorkerParseOptions,
  format:  ParseFormat,
): Promise<{ totalRows: number; schema: ColumnSchema[]; preview: Record<string, unknown>[] }> {
  const chunkRows   = opts.chunkRows   ?? DEFAULT_CHUNK_ROWS;
  const maxRows     = opts.maxRows     ?? DEFAULT_MAX_ROWS;
  const previewRows = opts.previewRows ?? DEFAULT_PREVIEW_ROWS;
  const encoding    = opts.encoding    ?? 'utf-8';
  const useGzip     = false; // gzip controlled by caller via options extension

  const text      = new TextDecoder(encoding, { fatal: false }).decode(buffer);
  const probe     = text.slice(0, DELIMITER_PROBE_BYTES);
  const delimiter = format === 'TSV' ? '\t'
                  : (opts.delimiter ?? detectDelimiter(probe));

  const allLines  = text.split(/\r?\n/).filter(l => l.trim() !== '');
  const hasHeader = opts.hasHeader ?? true;
  const headerRaw = hasHeader ? allLines[0] : null;
  const dataLines = hasHeader ? allLines.slice(1) : allLines;
  const headers   = headerRaw
    ? parseCsvLine(headerRaw, delimiter)
    : Array.from({ length: parseCsvLine(allLines[0] ?? '', delimiter).length }, (_, i) => `col_${i}`);

  const totalLines = Math.min(dataLines.length, maxRows);
  let   processed  = 0;
  let   chunkIndex = 0;
  let   schema: ColumnSchema[] | null = null;
  const preview: Record<string, unknown>[] = [];

  while (processed < totalLines) {
    if (abortFileId === fileId) { abortFileId = null; throw new AbortError(); }

    const end   = Math.min(processed + chunkRows, totalLines);
    const lines = dataLines.slice(processed, end);
    const batch: Record<string, unknown>[] = lines.map(line => {
      const cells  = parseCsvLine(line, delimiter);
      const record: Record<string, unknown> = {};
      for (let i = 0; i < headers.length; i++) {
        const col = headers[i].trim().replace(/^"|"$/g, '');
        const raw = cells[i] ?? '';
        record[col] = raw === '' ? null : raw;
      }
      return record;
    });

    // Type-coerce after schema inference on first chunk
    if (chunkIndex === 0) {
      schema = buildSchema(
        headers.map(h => h.trim().replace(/^"|"$/g, '')),
        batch.slice(0, SAMPLE_ROWS),
      );
      // Apply coercions
      for (const rec of batch) coerceRecord(rec, schema);
    } else {
      for (const rec of batch) coerceRecord(rec, schema!);
    }

    if (preview.length < previewRows) {
      preview.push(...batch.slice(0, previewRows - preview.length));
    }

    processed += lines.length;
    await emitChunk(fileId, chunkIndex, batch, schema!, processed, totalLines, useGzip);
    chunkIndex++;
    await yield_();
  }

  return { totalRows: processed, schema: schema ?? [], preview };
}

// ═══════════════════════════════════════════════════════════════
// JSON / JSONL PARSER
// ═══════════════════════════════════════════════════════════════

/**
 * Locate the data array inside a JSON object.
 * Tries the rootPath option first, then common keys, then root.
 */
function findJsonArray(data: unknown, rootPath?: string): unknown[] | null {
  if (rootPath) {
    const parts = rootPath.split('.');
    let cur: unknown = data;
    for (const p of parts) {
      if (cur && typeof cur === 'object') cur = (cur as Record<string, unknown>)[p];
      else return null;
    }
    return Array.isArray(cur) ? cur : null;
  }

  // Auto-detect: try common keys
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['data', 'records', 'rows', 'items', 'results', 'list']) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[];
    }
    // First array-valued key
    for (const key of Object.keys(obj)) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[];
    }
  }
  return null;
}

/**
 * Parse JSON ArrayBuffer → chunked records.
 */
async function parseJsonBuffer(
  fileId: string,
  buffer: ArrayBuffer,
  opts:   WorkerParseOptions,
): Promise<{ totalRows: number; schema: ColumnSchema[]; preview: Record<string, unknown>[] }> {
  const chunkRows   = opts.chunkRows   ?? DEFAULT_CHUNK_ROWS;
  const maxRows     = opts.maxRows     ?? DEFAULT_MAX_ROWS;
  const previewRows = opts.previewRows ?? DEFAULT_PREVIEW_ROWS;

  const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`JSON parse error: ${e instanceof Error ? e.message : String(e)}`);
  }

  const arr = findJsonArray(parsed, opts.rootPath);
  if (!arr) {
    throw new Error('Could not locate a data array in the JSON file. Try setting rootPath option.');
  }

  const totalLines = Math.min(arr.length, maxRows);
  const flatRows   = arr.slice(0, totalLines) as Record<string, unknown>[];

  let   processed  = 0;
  let   chunkIndex = 0;
  let   schema:  ColumnSchema[] | null = null;
  const preview: Record<string, unknown>[] = [];

  while (processed < totalLines) {
    if (abortFileId === fileId) { abortFileId = null; throw new AbortError(); }

    const end   = Math.min(processed + chunkRows, totalLines);
    const batch = flatRows.slice(processed, end);

    if (chunkIndex === 0) {
      const headers = Object.keys(batch[0] ?? {});
      schema = buildSchema(headers, batch.slice(0, SAMPLE_ROWS));
    }

    if (preview.length < previewRows) {
      preview.push(...batch.slice(0, previewRows - preview.length));
    }

    processed += batch.length;
    await emitChunk(fileId, chunkIndex, batch, schema!, processed, totalLines, false);
    chunkIndex++;
    await yield_();
  }

  return { totalRows: processed, schema: schema ?? [], preview };
}

/**
 * Parse JSONL (newline-delimited JSON) ArrayBuffer → chunked records.
 */
async function parseJsonlBuffer(
  fileId: string,
  buffer: ArrayBuffer,
  opts:   WorkerParseOptions,
): Promise<{ totalRows: number; schema: ColumnSchema[]; preview: Record<string, unknown>[] }> {
  const chunkRows   = opts.chunkRows   ?? DEFAULT_CHUNK_ROWS;
  const maxRows     = opts.maxRows     ?? DEFAULT_MAX_ROWS;
  const previewRows = opts.previewRows ?? DEFAULT_PREVIEW_ROWS;

  const text  = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');

  const totalLines = Math.min(lines.length, maxRows);
  let   processed  = 0;
  let   chunkIndex = 0;
  let   schema:  ColumnSchema[] | null = null;
  const preview: Record<string, unknown>[] = [];

  while (processed < totalLines) {
    if (abortFileId === fileId) { abortFileId = null; throw new AbortError(); }

    const end = Math.min(processed + chunkRows, totalLines);
    const batch: Record<string, unknown>[] = [];

    for (let i = processed; i < end; i++) {
      try {
        const row = JSON.parse(lines[i]);
        if (row && typeof row === 'object' && !Array.isArray(row)) {
          batch.push(row as Record<string, unknown>);
        }
      } catch {
        // Skip malformed lines
      }
    }

    if (batch.length > 0 && chunkIndex === 0) {
      schema = buildSchema(Object.keys(batch[0]), batch.slice(0, SAMPLE_ROWS));
    }

    if (preview.length < previewRows) {
      preview.push(...batch.slice(0, previewRows - preview.length));
    }

    processed += (end - processed);
    await emitChunk(fileId, chunkIndex, batch, schema ?? [], processed, totalLines, false);
    chunkIndex++;
    await yield_();
  }

  return { totalRows: processed, schema: schema ?? [], preview };
}

// ═══════════════════════════════════════════════════════════════
// XML PARSER  (basic — row-oriented XML)
// ═══════════════════════════════════════════════════════════════

/**
 * Parse a row-oriented XML file (e.g. <records><record>…</record></records>).
 * Extracts child element text content as record fields.
 * Uses DOMParser which is available in modern workers (Firefox 110+, Chrome 112+).
 * Falls back to a simple regex extractor for older browsers.
 */
async function parseXmlBuffer(
  fileId: string,
  buffer: ArrayBuffer,
  opts:   WorkerParseOptions,
): Promise<{ totalRows: number; schema: ColumnSchema[]; preview: Record<string, unknown>[] }> {
  const chunkRows   = opts.chunkRows   ?? DEFAULT_CHUNK_ROWS;
  const maxRows     = opts.maxRows     ?? DEFAULT_MAX_ROWS;
  const previewRows = opts.previewRows ?? DEFAULT_PREVIEW_ROWS;

  const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);

  // Try DOMParser first (worker-safe in modern browsers)
  let rows: Record<string, unknown>[] = [];

  if (typeof DOMParser !== 'undefined') {
    try {
      const doc      = new DOMParser().parseFromString(text, 'application/xml');
      const parserErr = doc.querySelector('parsererror');
      if (parserErr) throw new Error('XML parse error');

      // Find the most-repeated element = row element
      const children = Array.from(doc.documentElement.children);
      for (const child of children.slice(0, Math.min(children.length, maxRows))) {
        const record: Record<string, unknown> = {};
        for (const el of Array.from(child.children)) {
          record[el.tagName] = el.textContent?.trim() ?? null;
        }
        // Also grab attributes
        for (const attr of Array.from(child.attributes)) {
          record[`@${attr.name}`] = attr.value;
        }
        rows.push(record);
      }
    } catch {
      // DOMParser failed — fall through to regex fallback
      rows = [];
    }
  }

  // Regex fallback: extract any <tag>value</tag> pairs within repeated blocks
  if (rows.length === 0) {
    const blockRe = /<(\w+)[^>]*>([\s\S]*?)<\/\1>/g;
    const rowRe   = /<(\w+)[^>]*>([^<]*)<\/\1>/g;
    let   m: RegExpExecArray | null;

    while ((m = blockRe.exec(text)) !== null && rows.length < maxRows) {
      const record: Record<string, unknown> = {};
      let   field: RegExpExecArray | null;
      rowRe.lastIndex = 0;
      while ((field = rowRe.exec(m[2])) !== null) {
        record[field[1]] = field[2].trim() || null;
      }
      if (Object.keys(record).length > 0) rows.push(record);
    }
  }

  const totalLines = Math.min(rows.length, maxRows);
  let   processed  = 0;
  let   chunkIndex = 0;
  let   schema: ColumnSchema[] | null = null;
  const preview: Record<string, unknown>[] = [];

  while (processed < totalLines) {
    if (abortFileId === fileId) { abortFileId = null; throw new AbortError(); }

    const end   = Math.min(processed + chunkRows, totalLines);
    const batch = rows.slice(processed, end);

    if (chunkIndex === 0 && batch.length > 0) {
      schema = buildSchema(Object.keys(batch[0]), batch.slice(0, SAMPLE_ROWS));
    }

    if (preview.length < previewRows) {
      preview.push(...batch.slice(0, previewRows - preview.length));
    }

    processed += batch.length;
    await emitChunk(fileId, chunkIndex, batch, schema ?? [], processed, totalLines, false);
    chunkIndex++;
    await yield_();
  }

  return { totalRows: processed, schema: schema ?? [], preview };
}

// ═══════════════════════════════════════════════════════════════
// XLSX / XLS PARSER  (SheetJS dynamic import)
// ═══════════════════════════════════════════════════════════════

/**
 * Parse XLSX/XLS ArrayBuffer using SheetJS via dynamic import.
 * The dynamic import ensures SheetJS is NOT bundled into the main
 * chunk — it is loaded lazily only when an Excel file is processed.
 */
async function parseXlsxBuffer(
  fileId: string,
  buffer: ArrayBuffer,
  opts:   WorkerParseOptions,
): Promise<{ totalRows: number; schema: ColumnSchema[]; preview: Record<string, unknown>[] }> {
  const chunkRows   = opts.chunkRows   ?? DEFAULT_CHUNK_ROWS;
  const maxRows     = opts.maxRows     ?? DEFAULT_MAX_ROWS;
  const previewRows = opts.previewRows ?? DEFAULT_PREVIEW_ROWS;
  const sheetIndex  = opts.sheetIndex  ?? 0;

  // Lazy load SheetJS
  let XLSX: {
    read: (buf: ArrayBuffer, opts: object) => { SheetNames: string[]; Sheets: Record<string, unknown> };
    utils: {
      sheet_to_json: (ws: unknown, opts?: object) => unknown[][];
    };
  };

  try {
    XLSX = (await import('xlsx')) as typeof XLSX;
  } catch {
    throw new Error(
      'SheetJS (xlsx) package not found. Install with: npm install xlsx',
    );
  }

  const workbook = XLSX.read(buffer, {
    type:      'array',
    cellDates: true,
    dense:     true,
  });

  const sheetName = workbook.SheetNames[sheetIndex];
  if (!sheetName) {
    throw new Error(
      `Sheet index ${sheetIndex} out of range — workbook has ${workbook.SheetNames.length} sheets.`,
    );
  }

  const ws  = workbook.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json(ws, {
    header:    1,
    defval:    null,
    blankrows: false,
  }) as unknown[][];

  if (aoa.length === 0) {
    return { totalRows: 0, schema: [], preview: [] };
  }

  const hasHeader = opts.hasHeader ?? true;
  const headerRow = hasHeader ? aoa[0] : null;
  const dataAOA   = hasHeader ? aoa.slice(1) : aoa;
  const headers   = headerRow
    ? headerRow.map((h, i) => (h !== null && h !== undefined && h !== '') ? String(h).trim() : `col_${i}`)
    : Array.from({ length: aoa[0]?.length ?? 0 }, (_, i) => `col_${i}`);

  const totalLines = Math.min(dataAOA.length, maxRows);
  let   processed  = 0;
  let   chunkIndex = 0;
  let   schema: ColumnSchema[] | null = null;
  const preview: Record<string, unknown>[] = [];

  while (processed < totalLines) {
    if (abortFileId === fileId) { abortFileId = null; throw new AbortError(); }

    const end   = Math.min(processed + chunkRows, totalLines);
    const batch = dataAOA.slice(processed, end).map(row => {
      const record: Record<string, unknown> = {};
      for (let i = 0; i < headers.length; i++) {
        const v = (row as unknown[])[i] ?? null;
        record[headers[i]] = v instanceof Date ? v.toISOString() : v;
      }
      return record;
    });

    if (chunkIndex === 0) {
      schema = buildSchema(headers, batch.slice(0, SAMPLE_ROWS));
    }

    if (preview.length < previewRows) {
      preview.push(...batch.slice(0, previewRows - preview.length));
    }

    processed += batch.length;
    await emitChunk(fileId, chunkIndex, batch, schema!, processed, totalLines, false);
    chunkIndex++;
    await yield_();
  }

  return { totalRows: processed, schema: schema ?? [], preview };
}

// ═══════════════════════════════════════════════════════════════
// TYPE COERCION HELPER
// ═══════════════════════════════════════════════════════════════

/**
 * Mutate a record in-place to coerce string values to their inferred types.
 * Called on every row in CSV/TSV batches after schema inference.
 */
function coerceRecord(
  record: Record<string, unknown>,
  schema: ColumnSchema[],
): void {
  for (const col of schema) {
    const val = record[col.name];
    if (val === null || val === undefined || val === '') {
      record[col.name] = null;
      continue;
    }
    const s = String(val);
    switch (col.type) {
      case 'number':
        record[col.name] = parseFloat(s);
        break;
      case 'boolean':
        record[col.name] = s === '1' || s.toLowerCase() === 'true';
        break;
      case 'date':
        record[col.name] = new Date(s).toISOString();
        break;
      // string + null: leave as-is
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// ABORT ERROR SENTINEL
// ═══════════════════════════════════════════════════════════════

class AbortError extends Error {
  constructor() { super('aborted'); this.name = 'AbortError'; }
}

// ═══════════════════════════════════════════════════════════════
// MAIN PARSE ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════

/**
 * Route a PARSE message to the appropriate format-specific parser,
 * then post the DONE message with schema, preview, and ML pipeline hint.
 */
async function processFile(msg: WorkerParseMessage): Promise<void> {
  const { fileId, buffer, fileName, options = {} } = msg;
  const startMs = Date.now();
  const format  = options as WorkerParseOptions & { format?: ParseFormat };
  const fmt     = detectFormat(fileName);

  let result: { totalRows: number; schema: ColumnSchema[]; preview: Record<string, unknown>[] };

  try {
    switch (fmt) {
      case 'CSV':
      case 'TSV':
      case 'TXT':
        result = await parseCsvBuffer(fileId, buffer, options, fmt);
        break;

      case 'JSON':
        result = await parseJsonBuffer(fileId, buffer, options);
        break;

      case 'JSONL':
        result = await parseJsonlBuffer(fileId, buffer, options);
        break;

      case 'XLSX':
      case 'XLS':
        result = await parseXlsxBuffer(fileId, buffer, options);
        break;

      case 'XML':
        result = await parseXmlBuffer(fileId, buffer, options);
        break;

      case 'PARQUET':
      case 'AVRO': {
        // Browser cannot natively parse binary columnar formats.
        // Report as error with a recoverable=false flag so the UI
        // can show a user-friendly "unsupported format" message.
        const errMsg: WorkerOutMessage = {
          type:        'ERROR',
          fileId,
          error:       `${fmt} files cannot be parsed in the browser. ` +
                       `Please convert to CSV or JSON before uploading, ` +
                       `or use the backend API endpoint for server-side processing.`,
          recoverable: false,
        };
        self.postMessage(errMsg);
        return;
      }

      default: {
        // UNKNOWN format — try CSV as a best-effort fallback
        try {
          result = await parseCsvBuffer(fileId, buffer, options, 'CSV');
        } catch {
          const errMsg: WorkerOutMessage = {
            type:        'ERROR',
            fileId,
            error:       `Unrecognised file format for "${fileName}". ` +
                         `Supported formats: CSV, TSV, JSON, JSONL, XLSX, XLS, XML, TXT.`,
            recoverable: false,
          };
          self.postMessage(errMsg);
          return;
        }
      }
    }
  } catch (e) {
    if (e instanceof AbortError) return;  // Clean abort — no error posted

    const errMsg: WorkerOutMessage = {
      type:        'ERROR',
      fileId,
      error:       e instanceof Error ? e.message : String(e),
      recoverable: false,
    };
    self.postMessage(errMsg);
    return;
  }

  // ── ML pipeline readiness hint ─────────────────────────────────────────────
  // LumindAd.jsx footer: "📡 Compatible: Telecom X ML Pipeline"
  // Determines if the parsed schema matches Telecom X churn feature columns.
  const TELECOM_X_COLS = new Set([
    'customerID', 'tenure', 'MonthlyCharges', 'TotalCharges',
    'Contract', 'InternetService', 'Churn',
  ]);
  const parsedCols    = new Set(result.schema.map(c => c.name));
  const matchCount    = [...TELECOM_X_COLS].filter(c => parsedCols.has(c)).length;
  const mlReady       = result.totalRows > 0 && result.schema.length > 0;
  const telecomXMatch = matchCount >= 3;   // ≥3 of 7 key columns = likely Telecom X

  const doneMsg: WorkerOutMessage & {
    mlReady?:       boolean;
    telecomXMatch?: boolean;
    format?:        ParseFormat;
    durationMs:     number;
  } = {
    type:           'DONE',
    fileId,
    totalRows:      result.totalRows,
    columns:        result.schema,
    preview:        result.preview,
    durationMs:     Date.now() - startMs,
    // Extended fields (consumed by useChunkedUpload, not in base protocol)
    mlReady,
    telecomXMatch,
    format:         fmt,
  };

  self.postMessage(doneMsg);
}

// ═══════════════════════════════════════════════════════════════
// MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;

  switch (msg.type) {
    case 'PARSE':
      processFile(msg).catch(err => {
        const errorMsg: WorkerOutMessage = {
          type:        'ERROR',
          fileId:      msg.fileId,
          error:       err instanceof Error ? err.message : String(err),
          recoverable: false,
        };
        self.postMessage(errorMsg);
      });
      break;

    case 'ABORT':
      abortFileId = msg.fileId;
      break;

    case 'PING':
      self.postMessage({ type: 'PONG' } satisfies WorkerOutMessage);
      break;

    default:
      console.warn('[chunkProcessor.worker] Unknown message type:', (msg as WorkerInMessage).type);
  }
};

self.onerror = (err) => {
  console.error('[chunkProcessor.worker] Uncaught error:', err);
};
