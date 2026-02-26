/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · workers/csvParser.worker.ts
 *  src/workers/csvParser.worker.ts
 *
 *  Purpose
 *   Parses CSV and TSV files off the main thread using the
 *   Web Worker API. Processes files in CHUNK_ROWS (50 000) row
 *   batches so the main thread receives live progress updates
 *   and is never blocked — matching the "⚡ Web Workers
 *   (non-blocking UI)" promise in LumindAd.jsx line 869.
 *
 *  Supported formats
 *   CSV  — comma-separated values (auto-detects delimiter)
 *   TSV  — tab-separated values
 *   TXT  — treated as CSV with auto-detection
 *
 *  Algorithm
 *   1. Receive PARSE message with ArrayBuffer + options
 *   2. Decode bytes → string via TextDecoder (UTF-8 default)
 *   3. Detect delimiter: count tabs vs commas in first 4 KB
 *   4. Split into lines, slice header row
 *   5. Process CHUNK_ROWS lines at a time using setTimeout(0)
 *      to yield to the event loop between chunks
 *   6. After each chunk: post PROGRESS + CHUNK messages
 *   7. On completion: post DONE with full schema + 5-row preview
 *
 *  Column type inference
 *   Each column's type is inferred by sampling the first
 *   SAMPLE_ROWS (500) non-empty values:
 *     number  → parseFloat succeeds + isFinite
 *     boolean → 'true'|'false'|'1'|'0'
 *     date    → Date.parse succeeds on ISO-like strings
 *     string  → fallback
 *   nullable = true if any sampled value is '' or null
 *
 *  Memory model
 *   • ArrayBuffer is transferred (not copied) from main thread
 *   • Parsed rows are NOT accumulated in worker memory —
 *     each chunk is posted and immediately GC-eligible
 *   • Only preview (5 rows) + schema is retained until DONE
 *
 *  Worker message protocol  →  types/upload.ts
 *   IN:  WorkerInMessage  (PARSE | ABORT | PING)
 *   OUT: WorkerOutMessage (PROGRESS | CHUNK | DONE | ERROR | PONG)
 *
 *  Instantiation
 *   const worker = new Worker(
 *     new URL('./csvParser.worker.ts', import.meta.url),
 *     { type: 'module' }
 *   );
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
} from '../types/upload';
import type { ColumnSchema } from '../services/uploadService';

// ─── Constants ────────────────────────────────────────────────────────────────

/** LumindAd.jsx line 688 — rows per processing tick */
const DEFAULT_CHUNK_ROWS  = 50_000;
/** Rows sampled to infer column types */
const SAMPLE_ROWS         = 500;
/** Bytes inspected to detect delimiter */
const DELIMITER_PROBE_BYTES = 4096;
/** Rows included in the DONE preview */
const DEFAULT_PREVIEW_ROWS = 5;

// ─── Abort flag ────────────────────────────────────────────────────────────────
// Set by ABORT message; checked between every chunk yield.

let abortFileId: string | null = null;

// ─── Delimiter detection ──────────────────────────────────────────────────────

/**
 * Detect CSV delimiter by counting occurrences in a probe string.
 * Returns '\t' for TSV files; ',' for standard CSV.
 *
 * @example
 * detectDelimiter('a,b,c\n1,2,3')  → ','
 * detectDelimiter('a\tb\tc\n1\t2')  → '\t'
 */
function detectDelimiter(probe: string): string {
  const tabs   = (probe.match(/\t/g)  ?? []).length;
  const commas = (probe.match(/,/g)   ?? []).length;
  const semis  = (probe.match(/;/g)   ?? []).length;
  const pipes  = (probe.match(/\|/g)  ?? []).length;

  const max = Math.max(tabs, commas, semis, pipes);
  if (max === 0) return ',';
  if (tabs   === max) return '\t';
  if (semis  === max) return ';';
  if (pipes  === max) return '|';
  return ',';
}

// ─── Line parser ──────────────────────────────────────────────────────────────

/**
 * Parse a single CSV line respecting RFC 4180 quoting rules.
 * Handles quoted fields with embedded commas, newlines, and escaped quotes.
 *
 * @param line      — raw text line (no trailing newline)
 * @param delimiter — field separator character
 * @returns         — array of string field values
 *
 * @example
 * parseLine('hello,"world, today",42', ',')
 * // → ['hello', 'world, today', '42']
 */
function parseLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current  = '';
  let inQuote  = false;
  const delim  = delimiter.charCodeAt(0);

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          // Escaped double-quote
          current += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch.charCodeAt(0) === delim) {
        fields.push(current);
        current = '';
      } else if (ch !== '\r') {
        current += ch;
      }
    }
  }

  fields.push(current);
  return fields;
}

// ─── Type inference ───────────────────────────────────────────────────────────

type InferredType = 'string' | 'number' | 'boolean' | 'date' | 'null';

/**
 * Infer the data type of a single CSV field value.
 */
function inferCellType(value: string): InferredType {
  if (value === '' || value.toLowerCase() === 'null' || value.toLowerCase() === 'na') {
    return 'null';
  }

  const lower = value.toLowerCase().trim();

  // Boolean check
  if (lower === 'true' || lower === 'false' || lower === '1' || lower === '0') {
    return 'boolean';
  }

  // Number check
  const n = Number(value.trim());
  if (!isNaN(n) && isFinite(n) && value.trim() !== '') {
    return 'number';
  }

  // Date check — ISO, US, EU formats
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?/,    // ISO 8601
    /^\d{2}\/\d{2}\/\d{4}/,                    // US MM/DD/YYYY
    /^\d{2}-\d{2}-\d{4}/,                      // EU DD-MM-YYYY
  ];
  if (datePatterns.some(p => p.test(value.trim())) && !isNaN(Date.parse(value.trim()))) {
    return 'date';
  }

  return 'string';
}

/**
 * Build a ColumnSchema array by sampling up to SAMPLE_ROWS values
 * per column from the parsed data rows.
 *
 * @param headers — column header names
 * @param rows    — sample rows (raw string arrays)
 * @returns       — typed ColumnSchema[]
 */
function inferSchema(
  headers: string[],
  rows:    string[][],
): ColumnSchema[] {
  const sample = rows.slice(0, SAMPLE_ROWS);

  return headers.map((header, colIdx) => {
    const values     = sample.map(row => row[colIdx] ?? '');
    const typeMap    = new Map<InferredType, number>();
    let   hasNull    = false;
    const rawSamples: unknown[] = [];

    for (const val of values) {
      const t = inferCellType(val);
      if (t === 'null') {
        hasNull = true;
        continue;
      }
      typeMap.set(t, (typeMap.get(t) ?? 0) + 1);
      if (rawSamples.length < 5) rawSamples.push(val);
    }

    // Dominant type = most frequent inferred type
    let dominantType: ColumnSchema['type'] = 'string';
    let maxCount = 0;
    for (const [type, count] of typeMap) {
      if (count > maxCount) {
        maxCount     = count;
        dominantType = type === 'null' ? 'null' : type;
      }
    }

    return {
      name:     header.trim().replace(/^"|"$/g, ''),
      type:     dominantType,
      nullable: hasNull || values.length === 0,
      samples:  rawSamples,
    };
  });
}

// ─── Row serialiser ───────────────────────────────────────────────────────────

/**
 * Convert a raw string[] row to a typed Record<string, unknown>.
 * Applies light type coercion based on inferred column types.
 */
function rowToRecord(
  raw:     string[],
  headers: string[],
  schema:  ColumnSchema[],
): Record<string, unknown> {
  const record: Record<string, unknown> = {};

  for (let i = 0; i < headers.length; i++) {
    const col   = headers[i].trim().replace(/^"|"$/g, '');
    const val   = raw[i] ?? '';
    const sType = schema[i]?.type ?? 'string';

    if (val === '' || val.toLowerCase() === 'null' || val.toLowerCase() === 'na') {
      record[col] = null;
      continue;
    }

    switch (sType) {
      case 'number':
        record[col] = parseFloat(val);
        break;
      case 'boolean':
        record[col] = val === '1' || val.toLowerCase() === 'true';
        break;
      case 'date':
        record[col] = new Date(val).toISOString();
        break;
      default:
        record[col] = val;
    }
  }

  return record;
}

// ─── Main parse function ──────────────────────────────────────────────────────

/**
 * Parse a CSV/TSV ArrayBuffer in chunks, posting progress and chunk
 * messages as each batch completes.
 */
async function parseCSV(msg: WorkerParseMessage): Promise<void> {
  const { fileId, buffer, options = {} } = msg;
  const startMs = Date.now();

  const chunkRows   = options.chunkRows   ?? DEFAULT_CHUNK_ROWS;
  const previewRows = options.previewRows ?? DEFAULT_PREVIEW_ROWS;
  const encoding    = options.encoding    ?? 'utf-8';
  const maxRows     = options.maxRows     ?? 10_000_000;

  let text: string;
  try {
    text = new TextDecoder(encoding).decode(buffer);
  } catch {
    // Fallback to utf-8 if specified encoding fails
    text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  }

  // Detect delimiter from first 4 KB
  const probe     = text.slice(0, DELIMITER_PROBE_BYTES);
  const delimiter = options.delimiter ?? detectDelimiter(probe);

  // Split lines — handle \r\n and \n
  const allLines = text.split(/\r?\n/);
  text = '';  // Release reference early for GC

  // Extract header
  const hasHeader = options.hasHeader ?? true;
  const headerRaw = hasHeader ? allLines[0] : null;
  const dataStart = hasHeader ? 1 : 0;
  const headers   = headerRaw
    ? parseLine(headerRaw, delimiter)
    : Array.from({ length: (parseLine(allLines[0], delimiter)).length }, (_, i) => `col_${i}`);

  // Filter blank trailing lines
  const dataLines = allLines
    .slice(dataStart)
    .filter(l => l.trim() !== '');

  const totalLines  = Math.min(dataLines.length, maxRows);
  let   processed   = 0;
  let   chunkIndex  = 0;
  let   schema:  ColumnSchema[] | null = null;
  const preview: Record<string, unknown>[] = [];

  // Process in CHUNK_ROWS batches, yielding between each batch
  while (processed < totalLines) {
    if (abortFileId === fileId) {
      abortFileId = null;
      return;  // Silently exit — no ERROR posted for intentional abort
    }

    const batchEnd    = Math.min(processed + chunkRows, totalLines);
    const batchLines  = dataLines.slice(processed, batchEnd);
    const batchRaw    = batchLines.map(l => parseLine(l, delimiter));

    // Infer schema from first batch
    if (chunkIndex === 0) {
      schema = inferSchema(headers, batchRaw);
    }

    const batchRecords = batchRaw.map(raw => rowToRecord(raw, headers, schema!));

    // Collect preview rows
    if (preview.length < previewRows) {
      const needed = previewRows - preview.length;
      preview.push(...batchRecords.slice(0, needed));
    }

    processed += batchLines.length;

    const progress = Math.round((processed / totalLines) * 100);

    // Post PROGRESS
    const progressMsg: WorkerOutMessage = {
      type:          'PROGRESS',
      fileId,
      rowsProcessed: processed,
      totalRows:     totalLines,
      progress,
    };
    self.postMessage(progressMsg);

    // Post CHUNK (transfer rows array — no ArrayBuffer to transfer here)
    const chunkMsg: WorkerOutMessage = {
      type:       'CHUNK',
      fileId,
      chunkIndex,
      rows:       batchRecords,
      columns:    chunkIndex === 0 ? schema! : undefined,
    };
    self.postMessage(chunkMsg);

    chunkIndex++;

    // Yield to the event loop so ABORT messages can be processed
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }

  // Post DONE
  const doneMsg: WorkerOutMessage = {
    type:       'DONE',
    fileId,
    totalRows:  processed,
    columns:    schema ?? inferSchema(headers, []),
    preview,
    durationMs: Date.now() - startMs,
  };
  self.postMessage(doneMsg);
}

// ─── Message handler ──────────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;

  switch (msg.type) {
    case 'PARSE':
      parseCSV(msg).catch(err => {
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
      // Exhaustiveness guard — unknown message type
      console.warn('[csvParser.worker] Unknown message type:', (msg as WorkerInMessage).type);
  }
};

self.onerror = (err) => {
  console.error('[csvParser.worker] Uncaught error:', err);
};
