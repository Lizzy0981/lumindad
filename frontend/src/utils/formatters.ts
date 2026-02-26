/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · utils/formatters.ts
 *  src/utils/formatters.ts
 *
 *  Pure formatting utilities used across all layers of the app.
 *  Every function is a pure transformation: (input) → string.
 *  No side effects, no React dependencies — safe in workers,
 *  stores, services, and components alike.
 *
 *  Sections
 *   1. Number formatting    — compact (K/M), locale-aware
 *   2. Currency formatting  — USD with prefix/suffix
 *   3. Percentage & change  — signed delta with ▲/▼ arrow
 *   4. Date & time          — relative, absolute, duration
 *   5. Data size            — bytes → KB/MB/GB
 *   6. Row count            — compact row labels
 *   7. ROAS                 — color-coded thresholds
 *   8. Status labels        — CampaignStatus → display text
 *   9. Throughput           — rows/sec → human string
 *  10. Clamp & truncate     — safe text truncation
 *
 *  Alignment with LumindAd.jsx
 *   fmt()       → line 135: `n>=1e6 ? ${(n/1e6).toFixed(1)}M : ...K`
 *   fmtMoney()  → line 136: `$${n.toLocaleString()}`
 *   fmtSize()   → line 707: `b>1e6 ? ${(b/1e6).toFixed(1)} MB : ...KB`
 *   fmtChange() → KPICard change prop (+ green / − red arrows)
 *   ROAS thresholds → table colouring lines 457–460: >4 green · >3 amber · <3 red
 *
 *  i18n note
 *   All Intl.NumberFormat calls use the locale from i18n/index.ts
 *   `getCurrentLang()` at call time — never at module load time.
 *   Fallback to 'en' when called from a worker context.
 *
 *  Usage
 *   import { fmt, fmtMoney, fmtChange, fmtDate } from '@/utils/formatters';
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ─── Locale helper ────────────────────────────────────────────────────────────
// Safe in both browser and worker contexts.

function currentLocale(): string {
  try {
    // Prefer i18n store locale when available (browser context)
    const stored = typeof localStorage !== 'undefined'
      ? localStorage.getItem('lumindad_lang')
      : null;
    return stored ?? navigator.language ?? 'en';
  } catch {
    return 'en';
  }
}

// ═══════════════════════════════════════════════════════════════
// 1. NUMBER FORMATTING
// ═══════════════════════════════════════════════════════════════

/**
 * Compact number formatter — mirrors LumindAd.jsx line 135.
 * Renders large numbers as abbreviated strings.
 *
 * @example
 * fmt(531200)     → "531.2K"
 * fmt(1_800_000)  → "1.8M"
 * fmt(38940)      → "38.9K"
 * fmt(847)        → "847"
 */
export function fmt(n: number): string {
  if (!isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

/**
 * Locale-aware full number with thousands separator.
 * Used in table cells where precision matters (no abbreviation).
 *
 * @example
 * fmtFull(531200, 'en')  → "531,200"
 * fmtFull(531200, 'de')  → "531.200"
 * fmtFull(531200, 'ar')  → "٥٣١٬٢٠٠"
 */
export function fmtFull(n: number, locale?: string): string {
  if (!isFinite(n)) return '—';
  return new Intl.NumberFormat(locale ?? currentLocale()).format(n);
}

/**
 * Fixed decimal number — for rates and scores.
 *
 * @example
 * fmtDecimal(7.3216, 2)  → "7.32"
 * fmtDecimal(4.18, 1)    → "4.2"
 */
export function fmtDecimal(n: number, decimals = 2): string {
  if (!isFinite(n)) return '—';
  return n.toFixed(decimals);
}

// ═══════════════════════════════════════════════════════════════
// 2. CURRENCY FORMATTING
// ═══════════════════════════════════════════════════════════════

/**
 * Dollar amount with `$` prefix and comma separators.
 * Mirrors LumindAd.jsx line 136: `$${n.toLocaleString()}`
 *
 * @example
 * fmtMoney(48290)       → "$48,290"
 * fmtMoney(1200)        → "$1,200"
 * fmtMoney(0)           → "$0"
 */
export function fmtMoney(n: number): string {
  if (!isFinite(n)) return '—';
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

/**
 * Full Intl.NumberFormat currency — locale-aware with symbol.
 * Used in export reports and BI integrations.
 *
 * @example
 * fmtCurrency(48290, 'USD', 'en-US')  → "$48,290"
 * fmtCurrency(48290, 'EUR', 'de-DE')  → "48.290 €"
 */
export function fmtCurrency(
  amount:   number,
  currency = 'USD',
  locale?:  string,
): string {
  if (!isFinite(amount)) return '—';
  try {
    return new Intl.NumberFormat(locale ?? currentLocale(), {
      style:    'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return fmtMoney(amount);
  }
}

// ═══════════════════════════════════════════════════════════════
// 3. PERCENTAGE & CHANGE
// ═══════════════════════════════════════════════════════════════

/**
 * Percentage string with configurable decimal places.
 *
 * @example
 * fmtPct(7.1616)   → "7.16%"
 * fmtPct(4.18, 1)  → "4.2%"
 * fmtPct(64, 0)    → "64%"
 */
export function fmtPct(n: number, decimals = 2): string {
  if (!isFinite(n)) return '—';
  return `${n.toFixed(decimals)}%`;
}

/**
 * Signed percentage change — used in KPICard `change` prop.
 * Positive → "+12.5%" (rendered green by KPICard).
 * Negative → "-5.2%"  (rendered red  by KPICard).
 *
 * LumindAd.jsx KPICard change examples:
 *   Total Spend: change={12.5}  → "+12.5%"
 *   CPC:         change={-5.2}  → "-5.2%"
 *
 * @example
 * fmtChange(12.5)   → "+12.5%"
 * fmtChange(-5.2)   → "-5.2%"
 * fmtChange(0)      → "0.0%"
 */
export function fmtChange(n: number): string {
  if (!isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

/**
 * Arrow + change — for table change indicators.
 * Returns an object with `text`, `arrow`, and `isPositive`
 * so the component can apply colour independently.
 *
 * @example
 * fmtChangeArrow(12.5)  → { text: '+12.5%', arrow: '▲', isPositive: true }
 * fmtChangeArrow(-5.2)  → { text: '-5.2%',  arrow: '▼', isPositive: false }
 */
export function fmtChangeArrow(n: number): {
  text:       string;
  arrow:      '▲' | '▼' | '─';
  isPositive: boolean;
} {
  if (!isFinite(n)) return { text: '—', arrow: '─', isPositive: true };
  return {
    text:       fmtChange(n),
    arrow:      n > 0 ? '▲' : n < 0 ? '▼' : '─',
    isPositive: n >= 0,
  };
}

// ═══════════════════════════════════════════════════════════════
// 4. DATE & TIME
// ═══════════════════════════════════════════════════════════════

/**
 * Relative time from now — "2 hours ago", "3 days ago".
 * Used in campaign `startDate` and upload history entries.
 *
 * @example
 * fmtRelative(Date.now() - 3_600_000)  → "1 hour ago"
 * fmtRelative(Date.now() - 86_400_000) → "1 day ago"
 */
export function fmtRelative(ts: number | string): string {
  const date = typeof ts === 'string' ? new Date(ts).getTime() : ts;
  const diffMs = Date.now() - date;

  const sec  = Math.round(diffMs / 1_000);
  const min  = Math.round(sec  / 60);
  const hour = Math.round(min  / 60);
  const day  = Math.round(hour / 24);
  const week = Math.round(day  / 7);
  const mon  = Math.round(day  / 30);

  if (sec  < 60)  return sec  <= 1 ? 'just now' : `${sec} seconds ago`;
  if (min  < 60)  return min  === 1 ? '1 minute ago'  : `${min} minutes ago`;
  if (hour < 24)  return hour === 1 ? '1 hour ago'    : `${hour} hours ago`;
  if (day  < 7)   return day  === 1 ? '1 day ago'     : `${day} days ago`;
  if (week < 5)   return week === 1 ? '1 week ago'    : `${week} weeks ago`;
  if (mon  < 12)  return mon  === 1 ? '1 month ago'   : `${mon} months ago`;
  return fmtDate(ts);
}

/**
 * Short absolute date — "Jan 15, 2025".
 * Used in campaign date columns and export report headers.
 *
 * @example
 * fmtDate('2025-01-15T00:00:00Z')  → "Jan 15, 2025"
 * fmtDate(1705276800000)           → "Jan 15, 2025"
 */
export function fmtDate(ts: number | string, locale?: string): string {
  const date = typeof ts === 'string' ? new Date(ts) : new Date(ts);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(locale ?? currentLocale(), {
    year:  'numeric',
    month: 'short',
    day:   'numeric',
  });
}

/**
 * Short date-time — "Jan 15 · 14:32".
 * Used in upload history and analytics export timestamps.
 *
 * @example
 * fmtDateTime(1705276800000)  → "Jan 15 · 14:32"
 */
export function fmtDateTime(ts: number | string): string {
  const date = typeof ts === 'string' ? new Date(ts) : new Date(ts);
  if (isNaN(date.getTime())) return '—';
  const d = date.toLocaleDateString(currentLocale(), { month: 'short', day: 'numeric' });
  const t = date.toLocaleTimeString(currentLocale(), { hour: '2-digit', minute: '2-digit' });
  return `${d} · ${t}`;
}

/**
 * Processing duration — worker DONE.durationMs → human string.
 * Used in BenchmarkTable and FileQueue completion badges.
 *
 * @example
 * fmtDuration(450)      → "0.5s"
 * fmtDuration(3200)     → "3.2s"
 * fmtDuration(185_000)  → "3 min 5s"
 * fmtDuration(4_320_000)→ "1h 12min"
 */
export function fmtDuration(ms: number): string {
  if (ms < 0 || !isFinite(ms)) return '—';
  if (ms < 1_000)   return `${ms}ms`;
  if (ms < 60_000)  return `${(ms / 1_000).toFixed(1)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1_000);
  if (min < 60) return sec > 0 ? `${min} min ${sec}s` : `${min} min`;
  const hr = Math.floor(min / 60);
  const m2 = min % 60;
  return m2 > 0 ? `${hr}h ${m2}min` : `${hr}h`;
}

// ═══════════════════════════════════════════════════════════════
// 5. DATA SIZE
// ═══════════════════════════════════════════════════════════════

/**
 * Human-readable file size.
 * Mirrors LumindAd.jsx line 707: `b>1e6 ? ${(b/1e6).toFixed(1)} MB : ...KB`
 * Extended here with GB support for the 2GB max file size.
 *
 * Also exported from services/uploadService.ts as `fmtSize` —
 * this version is the canonical one used everywhere.
 *
 * @example
 * fmtBytes(1024)            → "1.0 KB"
 * fmtBytes(1_500_000)       → "1.5 MB"
 * fmtBytes(2_147_483_648)   → "2.0 GB"
 */
export function fmtBytes(bytes: number): string {
  if (!isFinite(bytes) || bytes < 0) return '—';
  if (bytes === 0)              return '0 B';
  if (bytes < 1_024)            return `${bytes} B`;
  if (bytes < 1_024 ** 2)       return `${(bytes / 1_024).toFixed(1)} KB`;
  if (bytes < 1_024 ** 3)       return `${(bytes / 1_024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1_024 ** 3).toFixed(1)} GB`;
}

/** Alias — matches the name used in LumindAd.jsx line 707. */
export const fmtSize = fmtBytes;

// ═══════════════════════════════════════════════════════════════
// 6. ROW COUNT
// ═══════════════════════════════════════════════════════════════

/**
 * Compact row count for FileQueue items.
 * Mirrors the fmt() logic but adds "rows" label.
 *
 * @example
 * fmtRows(50000)      → "50K rows"
 * fmtRows(342_000)    → "342K rows"
 * fmtRows(1_000_000)  → "1.0M rows"
 * fmtRows(null)       → "—"
 */
export function fmtRows(n: number | null | undefined): string {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  return `${fmt(n)} rows`;
}

/**
 * Full row count with separator — used in Done banner.
 * LumindAd.jsx UploadPage success state: "342,000 rows processed"
 *
 * @example
 * fmtRowsFull(342000)   → "342,000 rows"
 */
export function fmtRowsFull(n: number): string {
  return `${fmtFull(n)} rows`;
}

// ═══════════════════════════════════════════════════════════════
// 7. ROAS FORMATTING & COLOUR
// ═══════════════════════════════════════════════════════════════

/**
 * Format ROAS as a decimal string.
 * Campaigns with roas=0 (e.g. Draft status) display "—".
 *
 * @example
 * fmtROAS(3.8)  → "3.8x"
 * fmtROAS(0)    → "—"
 */
export function fmtROAS(roas: number): string {
  if (!isFinite(roas) || roas <= 0) return '—';
  return `${roas.toFixed(1)}x`;
}

/**
 * ROAS colour — mirrors LumindAd.jsx CampaignsPage lines 457–460.
 * >4x → green · >3x → amber · ≤3x → red
 *
 * @example
 * roasColor(5.1)  → '#10b981'   // green
 * roasColor(3.8)  → '#f59e0b'   // amber
 * roasColor(2.1)  → '#ef4444'   // red
 * roasColor(0)    → '#94a3b8'   // grey (draft/no-data)
 */
export function roasColor(roas: number): string {
  if (roas <= 0)   return '#94a3b8';
  if (roas >= 4.0) return '#10b981';
  if (roas >= 3.0) return '#f59e0b';
  return '#ef4444';
}

// ═══════════════════════════════════════════════════════════════
// 8. STATUS LABELS
// ═══════════════════════════════════════════════════════════════

/**
 * Display label for a CampaignStatus value.
 * Capitalized for use in table cells and filter dropdowns.
 *
 * @example
 * statusLabel('active')    → "Active"
 * statusLabel('paused')    → "Paused"
 * statusLabel('completed') → "Completed"
 */
export function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Status colour — mirrors STATUS_COLOR from campaignStore.ts.
 * Used as a fallback when importing from the store is inconvenient.
 *
 * @example
 * statusColor('active')    → '#10b981'
 * statusColor('paused')    → '#f59e0b'
 * statusColor('draft')     → '#94a3b8'
 * statusColor('completed') → '#7c3aed'
 */
export function statusColor(status: string): string {
  const map: Record<string, string> = {
    active:    '#10b981',
    paused:    '#f59e0b',
    draft:     '#94a3b8',
    completed: '#7c3aed',
  };
  return map[status] ?? '#94a3b8';
}

/**
 * Platform short label — 4-char abbreviation for tight spaces.
 *
 * @example
 * platformAbbr('Google Ads')  → "GAds"
 * platformAbbr('Meta Ads')    → "Meta"
 * platformAbbr('TikTok')      → "TkTk"
 * platformAbbr('LinkedIn')    → "LKDN"
 * platformAbbr('Twitter/X')   → "X"
 */
export function platformAbbr(platform: string): string {
  const map: Record<string, string> = {
    'Google Ads': 'GAds',
    'Meta Ads':   'Meta',
    'TikTok':     'TkTk',
    'LinkedIn':   'LKDN',
    'Twitter/X':  'X',
  };
  return map[platform] ?? platform.slice(0, 4);
}

// ═══════════════════════════════════════════════════════════════
// 9. THROUGHPUT
// ═══════════════════════════════════════════════════════════════

/**
 * Rows-per-second throughput — used in FileQueue and BenchmarkTable.
 * LumindAd.jsx footer badge: "⚡ Web Workers (non-blocking UI)"
 *
 * @example
 * fmtThroughput(12_400)    → "12.4K rows/s"
 * fmtThroughput(1_200_000) → "1.2M rows/s"
 * fmtThroughput(800)       → "800 rows/s"
 */
export function fmtThroughput(rowsPerSec: number): string {
  return `${fmt(rowsPerSec)} rows/s`;
}

// ═══════════════════════════════════════════════════════════════
// 10. TEXT TRUNCATION & CLAMP
// ═══════════════════════════════════════════════════════════════

/**
 * Truncate a string to maxLen characters with an ellipsis.
 * Used in campaign name cells, AI insight descriptions, and AdPreview.
 *
 * @example
 * truncate('Summer Sale 2025 Extended Campaign', 20)
 * // → "Summer Sale 2025 Ex…"
 */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

/**
 * Clamp a number between min and max — used in progress calculations.
 *
 * @example
 * clamp(105, 0, 100)  → 100
 * clamp(-3, 0, 100)   → 0
 * clamp(75, 0, 100)   → 75
 */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

/**
 * Convert a progress float (0–1) to a rounded percentage integer (0–100).
 *
 * @example
 * toPct(0.342)  → 34
 * toPct(1.0)    → 100
 */
export function toPct(ratio: number): number {
  return Math.round(clamp(ratio, 0, 1) * 100);
}

// ═══════════════════════════════════════════════════════════════
// BARREL — all formatters grouped for destructured imports
// ═══════════════════════════════════════════════════════════════

/**
 * All formatters as a single object — useful when many are needed.
 *
 * @example
 * import { F } from '@/utils/formatters';
 * F.money(48290)   → "$48,290"
 * F.rows(342000)   → "342K rows"
 */
export const F = {
  // Numbers
  compact:    fmt,
  full:       fmtFull,
  decimal:    fmtDecimal,
  // Currency
  money:      fmtMoney,
  currency:   fmtCurrency,
  // Pct & change
  pct:        fmtPct,
  change:     fmtChange,
  changeArrow:fmtChangeArrow,
  // Date
  relative:   fmtRelative,
  date:       fmtDate,
  dateTime:   fmtDateTime,
  duration:   fmtDuration,
  // Size
  bytes:      fmtBytes,
  size:       fmtSize,
  // Rows
  rows:       fmtRows,
  rowsFull:   fmtRowsFull,
  // ROAS
  roas:       fmtROAS,
  roasColor,
  // Status
  statusLabel,
  statusColor,
  platformAbbr,
  // Throughput
  throughput: fmtThroughput,
  // Text
  truncate,
  clamp,
  toPct,
} as const;
