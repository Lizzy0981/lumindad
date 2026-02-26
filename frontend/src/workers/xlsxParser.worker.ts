/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · workers/xlsxParser.worker.ts
 *  src/workers/xlsxParser.worker.ts
 *
 *  Purpose
 *   Parses Excel files (XLSX and legacy XLS) off the main thread.
 *   Uses SheetJS (xlsx npm package) loaded via dynamic import
 *   so the library is only bundled when this worker is actually
 *   instantiated — keeping the main bundle lean.
 *
 *  Supported formats
 *   XLSX — Office Open XML (Excel 2007+)
 *   XLS  — Binary Excel 97–2003 (legacy)
 *
 *  Algorithm
 *   1. Receive PARSE message with ArrayBuffer
 *   2. Lazily import SheetJS: `await import('xlsx')`
 *   3. Read workbook from ArrayBuffer in 'array' mode
 *   4. Select sheet by options.sheetIndex (default: 0)
 *   5. Convert sheet to AOA (array of arrays) via sheet_to_json
 *   6. Extract header row, slice data rows
 *   7. Process CHUNK_ROWS rows at a time (same rhythm as csvParser)
 *   8. Infer schema from first batch
 *   9. Post PROGRESS + CHUNK after each batch
 *  10. Post DONE with schema + 5-row preview
 *
 *  SheetJS cell types → ColumnSchema types
 *   n  (number)  → 'number'
 *   b  (boolean) → 'boolean'
 *   d  (date)    → 'date' (SheetJS cellDates:true option)
 *   s  (string)  → 'string'
 *   z  (stub)    → 'null'
 *
 *  Multi-sheet workbooks
 *   Default: parse sheet at index 0 (options.sheetIndex = 0).
 *   The DONE message includes a `sheets` metadata field listing
 *   all sheet names so the UI can offer sheet selection.
 *
 *  Date handling
 *   SheetJS returns Date objects when cellDates:true.
 *   Worker serialises dates to ISO 8601 strings for JSON safety.
 *
 *  Memory model
 *   SheetJS AOA is produced then immediately chunked — full
 *   AOA is GC-eligible after chunking begins.
 *
 *  Worker message protocol  →  types/upload.ts
 *   IN:  WorkerInMessage  (PARSE | ABORT | PING)
 *   OUT: WorkerOutMessage (PROGRESS | CHUNK | DONE | ERROR | PONG)
 *
 *  Vite configuration note
 *   This worker uses `type: 'module'` so dynamic import() works.
 *   Vite automatically bundles worker-local imports when using:
 *     new Worker(new URL('./xlsxParser.worker.ts', import.meta.url), { type: 'module' })
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

const DEFAULT_CHUNK_ROWS  = 50_000;
const DEFAULT_PREVIEW_ROWS = 5;
const SAMPLE_ROWS          = 500;

// ─── Abort flag ────────────────────────────────────────────────────────────────

let abortFileId: string | null = null;

// ─── SheetJS types (minimal) ──────────────────────────────────────────────────
// We avoid importing the full SheetJS type package to keep the worker lean.
// Full types available via: import type * as XLSX from 'xlsx'

type XLSXCellType = 'n' | 'b' | 'd' | 's' | 'z' | 'e';
interface XLSXCell {
  t: XLSXCellType;
  v?: unknown;
  w?: string;
  f?: string;
}
interface XLSXWorksheet { [ref: string]: XLSXCell | { '!ref'?: string; '!merges'?: unknown[] } }
interface XLSXWorkbook {
  SheetNames: string[];
  Sheets:     Record<string, XLSXWorksheet>;
}
interface XLSXModule {
  read:         (data: ArrayBuffer, opts: object) => XLSXWorkbook;
  utils: {
    sheet_to_json: (ws: XLSXWorksheet, opts?: object) => unknown[][];
    decode_range:  (ref: string) => { s: { c: number; r: number }; e: { c: number; r: number } };
  };
}

// ─── Type inference from SheetJS cell type ────────────────────────────────────

function xlsxCellTypeToSchemaType(t: XLSXCellType): ColumnSchema['type'] {
  switch (t) {
    case 'n': return 'number';
    case 'b': return 'boolean';
    case 'd': return 'date';
    case 'z': return 'null';
    default:  return 'string';
  }
}

/**
 * Infer column schemas from the first SAMPLE_ROWS rows of the AOA.
 * AOA rows are already typed by SheetJS; we only need to check for
 * nullability and sample values.
 *
 * @param headers — column header strings (from row 0 of AOA)
 * @param aoa     — full array-of-arrays from SheetJS
 * @param xlsxMod — the loaded xlsx module (for cell metadata)
 * @param ws      — the worksheet (for cell type info)
 */
function inferSchemaFromAOA(
  headers: string[],
  aoa:     unknown[][],
  ws:      XLSXWorksheet,
): ColumnSchema[] {
  const sample = aoa.slice(0, SAMPLE_ROWS);

  return headers.map((header, colIdx) => {
    const values    = sample.map(row => row[colIdx]);
    const typeCounts = new Map<ColumnSchema['type'], number>();
    let   hasNull   = false;
    const rawSamples: unknown[] = [];

    for (const val of values) {
      if (val === null || val === undefined || val === '') {
        hasNull = true;
        continue;
      }

      let t: ColumnSchema['type'];
      if (typeof val === 'number')             t = 'number';
      else if (typeof val === 'boolean')        t = 'boolean';
      else if (val instanceof Date)             t = 'date';
      else                                      t = 'string';

      typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
      if (rawSamples.length < 5) {
        rawSamples.push(val instanceof Date ? val.toISOString() : val);
      }
    }

    // Dominant type
    let dominant: ColumnSchema['type'] = 'string';
    let maxCount = 0;
    for (const [type, count] of typeCounts) {
      if (count > maxCount) { maxCount = count; dominant = type; }
    }

    return {
      name:     String(header).trim(),
      type:     dominant,
      nullable: hasNull,
      samples:  rawSamples,
    };
  });
}

/**
 * Serialise a single AOA row to a typed Record.
 * Converts Date objects → ISO strings for JSON safety.
 */
function aoaRowToRecord(
  row:     unknown[],
  headers: string[],
  schema:  ColumnSchema[],
): Record<string, unknown> {
  const record: Record<string, unknown> = {};

  for (let i = 0; i < headers.length; i++) {
    const col = String(headers[i]).trim();
    const val = row[i] ?? null;

    if (val === null || val === undefined || val === '') {
      record[col] = null;
      continue;
    }

    if (val instanceof Date) {
      record[col] = val.toISOString();
    } else {
      record[col] = val;
    }
  }

  return record;
}

// ─── Main parse function ──────────────────────────────────────────────────────

async function parseXLSX(msg: WorkerParseMessage): Promise<void> {
  const { fileId, buffer, options = {} } = msg;
  const startMs = Date.now();

  const chunkRows    = options.chunkRows   ?? DEFAULT_CHUNK_ROWS;
  const previewRows  = options.previewRows ?? DEFAULT_PREVIEW_ROWS;
  const sheetIndex   = options.sheetIndex  ?? 0;
  const maxRows      = options.maxRows     ?? 10_000_000;

  // ── Lazy load SheetJS ──────────────────────────────────────────────────────
  // Dynamic import ensures SheetJS is NOT bundled into the main chunk.
  // Vite handles worker-scoped dynamic imports automatically.
  let XLSX: XLSXModule;
  try {
    XLSX = (await import('xlsx')) as unknown as XLSXModule;
  } catch {
    const errMsg: WorkerOutMessage = {
      type:        'ERROR',
      fileId,
      error:       'SheetJS (xlsx) package not found. Run: npm install xlsx',
      recoverable: false,
    };
    self.postMessage(errMsg);
    return;
  }

  // ── Read workbook ──────────────────────────────────────────────────────────
  let workbook: XLSXWorkbook;
  try {
    workbook = XLSX.read(buffer, {
      type:      'array',
      cellDates: true,    // Parse Excel serial dates → JS Date objects
      cellNF:    false,   // Skip number format strings (we infer types)
      dense:     true,    // Use dense representation for large sheets
    });
  } catch (err) {
    const errMsg: WorkerOutMessage = {
      type:        'ERROR',
      fileId,
      error:       `Failed to read workbook: ${err instanceof Error ? err.message : String(err)}`,
      recoverable: false,
    };
    self.postMessage(errMsg);
    return;
  }

  // ── Select sheet ───────────────────────────────────────────────────────────
  const sheetName = workbook.SheetNames[sheetIndex];
  if (!sheetName) {
    const errMsg: WorkerOutMessage = {
      type:        'ERROR',
      fileId,
      error:       `Sheet index ${sheetIndex} out of range. Workbook has ${workbook.SheetNames.length} sheet(s).`,
      recoverable: true,   // Caller can retry with sheetIndex: 0
    };
    self.postMessage(errMsg);
    return;
  }

  const ws = workbook.Sheets[sheetName];

  // ── Convert to AOA ─────────────────────────────────────────────────────────
  // header: 1 → first row becomes headers (returned separately)
  // defval: null → missing cells become null
  let aoa: unknown[][];
  try {
    aoa = XLSX.utils.sheet_to_json(ws, {
      header:    1,
      defval:    null,
      dateNF:    options.dateNF,
      blankrows: false,
    }) as unknown[][];
  } catch (err) {
    const errMsg: WorkerOutMessage = {
      type:        'ERROR',
      fileId,
      error:       `Failed to parse sheet "${sheetName}": ${err instanceof Error ? err.message : String(err)}`,
      recoverable: false,
    };
    self.postMessage(errMsg);
    return;
  }

  if (aoa.length === 0) {
    // Empty sheet
    const doneMsg: WorkerOutMessage = {
      type:       'DONE',
      fileId,
      totalRows:  0,
      columns:    [],
      preview:    [],
      durationMs: Date.now() - startMs,
    };
    self.postMessage(doneMsg);
    return;
  }

  // ── Extract headers and data ───────────────────────────────────────────────
  const hasHeader = options.hasHeader ?? true;
  const headerRow = hasHeader ? aoa[0] : null;
  const dataAOA   = hasHeader ? aoa.slice(1) : aoa;

  const headers: string[] = headerRow
    ? headerRow.map((h, i) => (h !== null && h !== undefined && h !== '') ? String(h) : `col_${i}`)
    : Array.from({ length: aoa[0]?.length ?? 0 }, (_, i) => `col_${i}`);

  // Clamp to maxRows
  const totalLines = Math.min(dataAOA.length, maxRows);
  let   processed  = 0;
  let   chunkIndex = 0;
  let   schema:  ColumnSchema[] | null = null;
  const preview: Record<string, unknown>[] = [];

  // ── Process in chunks ──────────────────────────────────────────────────────
  while (processed < totalLines) {
    if (abortFileId === fileId) {
      abortFileId = null;
      return;
    }

    const batchEnd  = Math.min(processed + chunkRows, totalLines);
    const batchAOA  = dataAOA.slice(processed, batchEnd);

    // Infer schema on first chunk
    if (chunkIndex === 0) {
      schema = inferSchemaFromAOA(headers, batchAOA, ws);
    }

    const batchRecords = batchAOA.map(row => aoaRowToRecord(row, headers, schema!));

    // Collect preview
    if (preview.length < previewRows) {
      const needed = previewRows - preview.length;
      preview.push(...batchRecords.slice(0, needed));
    }

    processed += batchAOA.length;

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

    // Post CHUNK
    const chunkMsg: WorkerOutMessage = {
      type:       'CHUNK',
      fileId,
      chunkIndex,
      rows:       batchRecords,
      columns:    chunkIndex === 0 ? schema! : undefined,
    };
    self.postMessage(chunkMsg);

    chunkIndex++;

    // Yield between chunks — same pattern as csvParser
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }

  // ── Post DONE ──────────────────────────────────────────────────────────────
  const doneMsg: WorkerOutMessage = {
    type:       'DONE',
    fileId,
    totalRows:  processed,
    columns:    schema ?? [],
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
      parseXLSX(msg).catch(err => {
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
      console.warn('[xlsxParser.worker] Unknown message type:', (msg as WorkerInMessage).type);
  }
};

self.onerror = (err) => {
  console.error('[xlsxParser.worker] Uncaught error:', err);
};
