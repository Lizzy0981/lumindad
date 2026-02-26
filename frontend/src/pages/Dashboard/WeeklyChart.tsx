/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · Dashboard · WeeklyChart
 *  src/pages/Dashboard/WeeklyChart.tsx
 *
 *  Purpose
 *   Renders the "Weekly Performance" card that occupies the wide
 *   left column (1fr) of the Dashboard charts row. Wraps the
 *   LumindLineChart component with the exact configuration from
 *   LumindAd.jsx and adds a branded card shell with a custom
 *   manual legend in the card header.
 *
 *  Data
 *   weeklyPerf — 7 daily records (Mon → Sun)
 *   Fields used : day (x-axis) · impressions · clicks
 *   Fields available but not charted here: spend · conversions
 *   (these appear in the Analytics charts)
 *
 *  Chart configuration (sourced from LumindAd.jsx line 344–353)
 *   height          240 px
 *   xDataKey        "day"
 *   Impressions     stroke #7c3aed · dot r=4 fill #7c3aed
 *                   activeDot r=6 fill #a78bfa  ← lila claro (distinct from line)
 *   Clicks          stroke #06b6d4 · dot r=4 fill #06b6d4
 *                   activeDot r=6 (no fill override — inherits stroke color)
 *   strokeWidth     2.5 for both series
 *
 *  Manual legend (top-right of card header)
 *   The chart uses a custom inline legend instead of Recharts <Legend />.
 *   Two coloured dot (●) labels: "Impressions" · "Clicks"
 *   This matches the exact JSX:
 *     <span style={{color:'#7c3aed'}}>● Impressions</span>
 *     <span style={{color:'#06b6d4'}}>● Clicks</span>
 *
 *  Value formatter
 *   Numbers ≥ 1000 are compacted: 12,400 → "12.4K", 25,800 → "25.8K"
 *   Applied to tooltip rows via the formatter prop.
 *
 *  Accessibility (WCAG 2.1 AA)
 *   – Card has role="region" aria-label="Weekly Performance chart"
 *   – LumindLineChart receives ariaLabel + summary props
 *   – The summary describes the peak day for screen reader users
 *   – Legend dots are aria-hidden (colour duplicated in the label text)
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { LumindLineChart } from '../../components/charts/LineChart';

// ─── Data ─────────────────────────────────────────────────────────────────────
// Mirrors weeklyPerf in LumindAd.jsx (line 85) exactly.
// Declared here so the chart is self-contained — pages will later
// replace this with real API data fetched in index.tsx and passed as a prop.

export interface WeeklyPerfRecord {
  day:         string;
  impressions: number;
  clicks:      number;
  spend:       number;
  conversions: number;
}

export const WEEKLY_PERF_DEFAULT: WeeklyPerfRecord[] = [
  { day: 'Mon', impressions: 12400, clicks:  890, spend: 1240, conversions:  47 },
  { day: 'Tue', impressions: 18100, clicks: 1340, spend: 1820, conversions:  89 },
  { day: 'Wed', impressions: 14600, clicks: 1050, spend: 1470, conversions:  63 },
  { day: 'Thu', impressions: 22300, clicks: 1780, spend: 2250, conversions: 124 },
  { day: 'Fri', impressions: 25800, clicks: 2100, spend: 2480, conversions: 158 },
  { day: 'Sat', impressions: 19200, clicks: 1420, spend: 1840, conversions:  97 },
  { day: 'Sun', impressions: 13500, clicks:  980, spend: 1350, conversions:  52 },
];

// ─── Series definitions ────────────────────────────────────────────────────────
// activeDotColor on Impressions = #a78bfa (lila claro — see JSX line 350)
// Clicks activeDot has no fill override (defaults to series color #06b6d4)

const SERIES = [
  {
    dataKey:        'impressions',
    name:           'Impressions',
    color:          '#7c3aed',
    strokeWidth:     2.5,
    dotRadius:       4,
    activeDotRadius: 6,
    activeDotColor: '#a78bfa',     // ← unique to this series
  },
  {
    dataKey:        'clicks',
    name:           'Clicks',
    color:          '#06b6d4',
    strokeWidth:     2.5,
    dotRadius:       4,
    activeDotRadius: 6,
    // no activeDotColor — inherits #06b6d4
  },
] as const;

// ─── Value formatter ──────────────────────────────────────────────────────────

/** Compacts large numbers for the tooltip: 12400 → "12.4K" */
function fmt(value: number | string): string {
  const n = Number(value);
  if (isNaN(n)) return String(value);
  return n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(1)}K`
    : n.toLocaleString();
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface WeeklyChartProps {
  /**
   * Weekly performance data array. Defaults to the hardcoded prototype
   * data (weeklyPerf from LumindAd.jsx) when omitted.
   */
  data?: WeeklyPerfRecord[];
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * "Weekly Performance" card — left column of the Dashboard charts row.
 *
 * Renders a two-series line chart (Impressions + Clicks) inside the
 * branded card shell with a custom inline legend.
 *
 * @example
 * // Dashboard/index.tsx — with default prototype data
 * <WeeklyChart />
 *
 * @example
 * // With real API data passed from the page
 * <WeeklyChart data={apiResponse.weeklyPerf} />
 */
export function WeeklyChart({ data = WEEKLY_PERF_DEFAULT }: WeeklyChartProps) {
  return (
    <article
      role="region"
      aria-label="Weekly Performance chart"
      style={{
        background:     'rgba(15, 10, 30, 0.85)',
        border:         '1px solid rgba(124, 58, 237, 0.15)',
        borderRadius:   '16px',
        backdropFilter: 'blur(12px)',
        padding:        '24px',
        transition:     'border-color 0.25s, transform 0.25s',
      }}
      onMouseEnter={(e) => {
        Object.assign(e.currentTarget.style, {
          borderColor: 'rgba(124,58,237,0.4)',
          transform:   'translateY(-2px)',
        });
      }}
      onMouseLeave={(e) => {
        Object.assign(e.currentTarget.style, {
          borderColor: 'rgba(124,58,237,0.15)',
          transform:   '',
        });
      }}
    >
      {/* ── Card header ──────────────────────────────────────────── */}
      <div
        style={{
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'center',
          marginBottom:   '20px',
        }}
      >
        {/* Title + subtitle */}
        <div>
          <div
            style={{
              fontWeight: 700,
              fontSize:   '16px',
              color:      '#e8e8f8',
              fontFamily:"'Outfit', system-ui, sans-serif",
            }}
          >
            Weekly Performance
          </div>
          <div
            style={{
              fontSize:  '12px',
              color:     '#475569',
              marginTop: '2px',
              fontFamily:"'Outfit', system-ui, sans-serif",
            }}
          >
            Impressions &amp; clicks over 7 days
          </div>
        </div>

        {/* Manual legend — mirrors JSX line 339–340 exactly */}
        <div
          role="list"
          aria-label="Chart legend"
          style={{ display: 'flex', gap: '16px', fontSize: '12px' }}
        >
          <span
            role="listitem"
            style={{
              color:      '#7c3aed',
              fontFamily:"'Outfit', system-ui, sans-serif",
              fontWeight:  500,
            }}
          >
            <span aria-hidden="true">● </span>Impressions
          </span>
          <span
            role="listitem"
            style={{
              color:      '#06b6d4',
              fontFamily:"'Outfit', system-ui, sans-serif",
              fontWeight:  500,
            }}
          >
            <span aria-hidden="true">● </span>Clicks
          </span>
        </div>
      </div>

      {/* ── Chart ────────────────────────────────────────────────── */}
      <LumindLineChart
        data={data as Record<string, unknown>[]}
        xDataKey="day"
        series={SERIES as unknown as Parameters<typeof LumindLineChart>[0]['series']}
        height={240}
        tickFontSize={11}
        formatter={fmt}
        ariaLabel="Weekly impressions and clicks from Monday to Sunday"
        summary="Impressions peaked on Friday at 25,800. Clicks peaked on Friday at 2,100."
      />
    </article>
  );
}

WeeklyChart.displayName = 'WeeklyChart';

export default WeeklyChart;
