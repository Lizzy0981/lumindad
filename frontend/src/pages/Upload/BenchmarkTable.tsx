/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Upload · BenchmarkTable
 *  src/pages/Upload/BenchmarkTable.tsx
 *
 *  Purpose
 *   Full-width card with the Processing Engine performance benchmarks.
 *   Mirrors LumindAd.jsx UploadPage "Processing Benchmarks" section
 *   (lines 843–878) token-for-token.
 *
 *  Anatomy
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  ⚡ Processing Engine — Performance Benchmarks           │  ← 700 15px #e8e8f8
 *   │                                                          │
 *   │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
 *   │  │ 10K rows │ │100K rows │ │  1M rows │ │ 10M rows │   │  ← 700 #a78bfa 13px
 *   │  │ ⏱ 0.5s  │ │  ⏱ 3s   │ │  ⏱ 18s  │ │ ⏱ 3 min │   │  ← 11px #64748b lh 1.8
 *   │  │ 💾 20 MB │ │ 💾 80 MB │ │💾 180 MB │ │💾 1.5 GB │   │
 *   │  │ 🖥 UI ✅  │ │ 🖥 UI ✅  │ │ 🖥 UI ✅  │ │ 🖥 UI ✅  │   │
 *   │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
 *   │                                                          │
 *   │  🔄 Chunked  ⚡ Workers  🗜 Gzip  🧠 Memory  📡 Telecom │  ← 11px #3d3d60
 *   └──────────────────────────────────────────────────────────┘
 *
 *  Benchmark data (from LumindAd.jsx lines 849–852 exactly)
 *   { size:'10K rows',  time:'0.5s',   mem:'20 MB',   ui:'✅' }
 *   { size:'100K rows', time:'3s',     mem:'80 MB',   ui:'✅' }
 *   { size:'1M rows',   time:'18s',    mem:'180 MB',  ui:'✅' }
 *   { size:'10M rows',  time:'3 min',  mem:'1.5 GB',  ui:'✅' }
 *
 *  Benchmark card tokens (LumindAd.jsx lines 853–862)
 *   padding      12px · borderRadius 10px
 *   background   rgba(124,58,237,0.05)
 *   border       1px solid rgba(124,58,237,0.10)
 *   Size label   fontWeight 700 · color #a78bfa · fontSize 13 · marginBottom 8
 *   Metrics row  fontSize 11 · color #64748b · lineHeight 1.8
 *
 *  Grid layout  repeat(4, 1fr)  gap 8  (LumindAd.jsx line 848)
 *
 *  Footer capability tags (LumindAd.jsx lines 864–870)
 *   marginTop 12 · fontSize 11 · color #3d3d60 · display flex · gap 20 · flexWrap wrap
 *   5 tags: Chunked Processing · Web Workers · Gzip compression ·
 *           Auto memory management · Compatible: Telecom X ML Pipeline
 *
 *  Live status row (enhancement beyond prototype)
 *   When `activeJobs > 0`, a status bar appears above the benchmark grid
 *   showing current throughput as an animated progress fill. This gives
 *   the user real-time context for the static benchmark numbers.
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – Card is role="region" aria-label="Processing Engine Benchmarks"
 *   – Benchmark grid is role="list"; each cell role="listitem"
 *   – Capability tags use role="list" + role="listitem"
 *   – Metric rows are not tables because the data has no row/col relationship
 *     (each card is a self-contained scalar set); role="group" per card
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ─── Benchmark data (LumindAd.jsx lines 849–852 exact) ───────────────────────

export interface BenchmarkEntry {
  size: string;
  time: string;
  mem:  string;
  ui:   string;
}

/** 4-tier benchmark data — mirrors LumindAd.jsx inline array exactly. */
export const BENCHMARK_DATA: BenchmarkEntry[] = [
  { size: '10K rows',  time: '0.5s',  mem: '20 MB',  ui: '✅' },
  { size: '100K rows', time: '3s',    mem: '80 MB',  ui: '✅' },
  { size: '1M rows',   time: '18s',   mem: '180 MB', ui: '✅' },
  { size: '10M rows',  time: '3 min', mem: '1.5 GB', ui: '✅' },
];

/** Footer capability tags — mirrors LumindAd.jsx lines 864–869 exactly. */
const CAPABILITY_TAGS = [
  '🔄 Chunked Processing (50K rows/chunk)',
  '⚡ Web Workers (non-blocking UI)',
  '🗜 Gzip compression',
  '🧠 Auto memory management',
  '📡 Compatible: Telecom X ML Pipeline',
] as const;

// ─── Shared tokens ────────────────────────────────────────────────────────────

const F = "'Outfit', system-ui, sans-serif";

// ─── Public API ───────────────────────────────────────────────────────────────

export interface BenchmarkTableProps {
  /**
   * Number of files currently being processed.
   * When > 0, shows an animated "processing active" indicator.
   * @default 0
   */
  activeJobs?: number;
  /**
   * Optional override for benchmark rows. Defaults to the 4-tier prototype data.
   * @default BENCHMARK_DATA
   */
  data?: BenchmarkEntry[];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Single benchmark tier card */
function BenchmarkCard({ entry }: { entry: BenchmarkEntry }) {
  return (
    <div
      role="listitem"
      aria-label={`${entry.size}: ${entry.time}, ${entry.mem} RAM, UI responsive`}
      style={{
        // LumindAd.jsx line 853: padding 12, borderRadius 10, bg .05, border .1
        padding:      '12px',
        borderRadius: '10px',
        background:   'rgba(124,58,237,0.05)',
        border:       '1px solid rgba(124,58,237,0.10)',
        transition:   'border-color 0.2s ease, transform 0.2s ease',
      }}
      onMouseEnter={(e) => {
        Object.assign(e.currentTarget.style, {
          borderColor: 'rgba(124,58,237,0.3)',
          transform:   'translateY(-2px)',
        });
      }}
      onMouseLeave={(e) => {
        Object.assign(e.currentTarget.style, {
          borderColor: 'rgba(124,58,237,0.10)',
          transform:   '',
        });
      }}
    >
      {/* Size label — fontWeight 700 color #a78bfa fontSize 13 marginBottom 8 */}
      <div
        style={{
          fontWeight:   700,
          color:        '#a78bfa',
          fontSize:     '13px',
          marginBottom: '8px',
          fontFamily:    F,
        }}
      >
        {entry.size}
      </div>

      {/* Metrics — fontSize 11 color #64748b lineHeight 1.8 */}
      <div
        role="group"
        aria-label={`Metrics for ${entry.size}`}
        style={{
          fontSize:   '11px',
          color:      '#64748b',
          lineHeight:  1.8,
          fontFamily:  F,
        }}
      >
        <div>⏱ {entry.time}</div>
        <div>💾 {entry.mem}</div>
        <div>🖥 UI {entry.ui}</div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Processing Engine benchmarks panel.
 * Always rendered at the bottom of the Upload page.
 *
 * @example
 * // Upload/index.tsx — always visible
 * <BenchmarkTable activeJobs={processingCount} />
 *
 * @example
 * // With real benchmark data from an API
 * <BenchmarkTable data={serverBenchmarks} activeJobs={0} />
 */
export function BenchmarkTable({
  activeJobs = 0,
  data       = BENCHMARK_DATA,
}: BenchmarkTableProps) {
  return (
    <section
      role="region"
      aria-label="Processing Engine Performance Benchmarks"
      style={{
        // LumindAd.jsx line 845: padding 20, marginTop 16
        background:     'rgba(15, 10, 30, 0.85)',
        border:         '1px solid rgba(124, 58, 237, 0.15)',
        borderRadius:   '16px',
        backdropFilter: 'blur(12px)',
        padding:        '20px',
        marginTop:      '16px',
      }}
    >
      {/* ── Panel title ───────────────────────────────────── */}
      {/* LumindAd.jsx line 846: fontWeight 700 fontSize 15 #e8e8f8 marginBottom 14 */}
      <div
        style={{
          fontWeight:   700,
          fontSize:     '15px',
          color:        '#e8e8f8',
          marginBottom: '14px',
          fontFamily:    F,
          display:      'flex',
          alignItems:   'center',
          gap:          '8px',
        }}
      >
        ⚡ Processing Engine — Performance Benchmarks
        {activeJobs > 0 && (
          <span
            aria-live="polite"
            aria-label={`${activeJobs} file${activeJobs > 1 ? 's' : ''} processing now`}
            style={{
              fontSize:      '10px',
              fontWeight:     700,
              color:         '#f59e0b',
              background:    'rgba(245,158,11,0.12)',
              border:        '1px solid rgba(245,158,11,0.25)',
              borderRadius:  '5px',
              padding:       '2px 8px',
              letterSpacing: '0.3px',
              fontFamily:     F,
            }}
          >
            ⟳ {activeJobs} active
          </span>
        )}
      </div>

      {/* ── Active processing pulse bar (enhancement) ─────── */}
      {activeJobs > 0 && (
        <div
          aria-hidden="true"
          style={{
            height:        '3px',
            borderRadius:  '2px',
            background:    '#1e1e35',
            overflow:      'hidden',
            marginBottom:  '12px',
          }}
        >
          <div
            style={{
              height:    '100%',
              width:     '40%',
              background:'linear-gradient(90deg,#7c3aed,#06b6d4)',
              borderRadius:'2px',
              animation: 'shimmer 1.5s ease-in-out infinite',
            }}
          />
          <style>{`
            @keyframes shimmer {
              0%   { transform: translateX(-100%); }
              100% { transform: translateX(350%);  }
            }
          `}</style>
        </div>
      )}

      {/* ── Benchmark grid — repeat(4,1fr) gap 8 ─────────── */}
      {/* LumindAd.jsx line 848 */}
      <div
        role="list"
        aria-label="Performance benchmark tiers"
        style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap:                 '8px',
        }}
      >
        {data.map((entry) => (
          <BenchmarkCard key={entry.size} entry={entry} />
        ))}
      </div>

      {/* ── Footer capability tags ────────────────────────── */}
      {/* LumindAd.jsx lines 864–869: fontSize 11 #3d3d60 flex gap 20 flexWrap wrap */}
      <div
        role="list"
        aria-label="Processing engine capabilities"
        style={{
          marginTop: '12px',
          fontSize:  '11px',
          color:     '#3d3d60',
          display:   'flex',
          gap:       '20px',
          flexWrap:  'wrap',
          fontFamily: F,
        }}
      >
        {CAPABILITY_TAGS.map((tag) => (
          <span key={tag} role="listitem">
            {tag}
          </span>
        ))}
      </div>
    </section>
  );
}

BenchmarkTable.displayName = 'BenchmarkTable';
export default BenchmarkTable;
